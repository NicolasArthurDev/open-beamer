import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import type { ServerResponse } from 'node:http';
import path from 'node:path';
import { NITEX_STY_FILENAME, NITEX_STY_SOURCE } from '@nitex/nitex';
import {
  applyOpToSource,
  frameBeginLines,
  listFrames,
  parseTex,
  type TexEditOp,
} from '@nitex-studio/editing';
import { type CompileResult, compile } from '@nitex-studio/engine';
import fg from 'fast-glob';
import { type Connect, loadConfigFromFile, type Plugin } from 'vite';
import type { NitexStudioConfig } from '../config.ts';
import { validateMutationRequest } from '../http/request-guard.ts';

const CONFIG_FILE = 'nitex-studio.config.ts';
const DECK_ID_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;

/** A deck that uses \nibox needs the NiTeX package loaded in its preamble. */
function ensureNitexUsepackage(src: string): string {
  if (src.includes('\\usepackage{nitex}')) return src;
  return src.replace(/\\begin\{document\}/, '\\usepackage{nitex}\n\\begin{document}');
}

/** Escape the LaTeX-special characters a free-text title might contain. */
function escapeLatex(s: string): string {
  return s
    .replace(/([&%$#_{}])/g, '\\$1')
    .replace(/~/g, '\\textasciitilde{}')
    .replace(/\^/g, '\\textasciicircum{}');
}

/** Minimal portable starter deck (fontspec-free, compiles on a plain TeX Live). */
function starterTex(title: string): string {
  return `\\documentclass[aspectratio=169]{beamer}
\\definecolor{obAccent}{HTML}{2563EB}
\\setbeamercolor{frametitle}{fg=obAccent}

\\title{${escapeLatex(title)}}
\\date{}

\\begin{document}

\\begin{frame}
  \\titlepage
\\end{frame}

\\begin{frame}{Primeiro slide}
  \\begin{itemize}
    \\item Edite no inspector ou use \\textbf{Inserir}.
  \\end{itemize}
\\end{frame}

\\end{document}
`;
}

async function readBody(req: Connect.IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString('utf8');
}

export type NitexStudioPluginOptions = {
  userCwd: string;
  config: NitexStudioConfig;
};

type DeckState = {
  status: 'ok' | 'error';
  pdfPath: string | null;
  log: string;
  srcHash?: string;
  /** Snapshot of the produced PDF, read once after the compile fully finished. */
  pdfBytes?: Buffer;
  /** Number of pages in the produced PDF (parsed from the LaTeX log). */
  pageCount?: number;
};

export async function findDecks(presentationsRoot: string): Promise<string[]> {
  if (!existsSync(presentationsRoot)) return [];
  const hits = await fg('*/main.tex', { cwd: presentationsRoot, onlyFiles: true });
  return hits.map((h) => h.split('/')[0]).sort();
}

export function nitexStudioPlugin(opts: NitexStudioPluginOptions): Plugin {
  const { userCwd, config } = opts;
  const presentationsDir = config.presentationsDir ?? 'presentations';
  const presentationsRoot = path.resolve(userCwd, presentationsDir);
  const engine = config.engine ?? 'lualatex';
  // Compile outputs live here, outside the watched source — so generated
  // .pdf/.aux/.log never re-trigger the watcher. Vite ignores node_modules.
  const cacheRoot = path.join(userCwd, 'node_modules', '.nitex-studio');

  const cache = new Map<string, DeckState>();
  const inflight = new Map<string, Promise<DeckState>>();
  // PDF page → frame index per deck (0-based), cached by source hash.
  const pageMapCache = new Map<string, { hash: string; pageToFrame: number[] }>();
  // Per-deck undo/redo history — snapshots of main.tex (text is cheap and bulletproof).
  const history = new Map<string, { undo: string[]; redo: string[] }>();
  const HISTORY_LIMIT = 50;

  const deckMain = (id: string) => path.join(presentationsRoot, id, 'main.tex');

  /** Record the pre-edit source so it can be undone; a fresh edit drops the redo stack. */
  function recordHistory(id: string, prevSrc: string): void {
    const h = history.get(id) ?? { undo: [], redo: [] };
    h.undo.push(prevSrc);
    if (h.undo.length > HISTORY_LIMIT) h.undo.shift();
    h.redo = [];
    history.set(id, h);
  }

  /** Restore the previous (undo) or next (redo) source snapshot. Returns whether it moved. */
  async function stepHistory(id: string, dir: 'undo' | 'redo'): Promise<boolean> {
    const h = history.get(id);
    const from = dir === 'undo' ? h?.undo : h?.redo;
    if (!h || !from || from.length === 0) return false;
    const file = deckMain(id);
    if (!existsSync(file)) return false;
    const current = await readFile(file, 'utf8');
    const target = from.pop() as string;
    (dir === 'undo' ? h.redo : h.undo).push(current);
    await writeFile(file, target, 'utf8'); // the watcher recompiles + notifies
    return true;
  }

  const deckIdForPath = (p: string): string | null => {
    const rel = path.relative(presentationsRoot, p);
    if (rel.startsWith('..') || path.isAbsolute(rel)) return null;
    return rel.split(path.sep)[0] || null;
  };

  function compileDeck(id: string): Promise<DeckState> {
    const existing = inflight.get(id);
    if (existing) return existing;
    const run = (async (): Promise<DeckState> => {
      if (!existsSync(deckMain(id))) {
        const miss: DeckState = { status: 'error', pdfPath: null, log: `deck not found: ${id}` };
        cache.set(id, miss);
        return miss;
      }
      const srcHash = createHash('sha1')
        .update(await readFile(deckMain(id), 'utf8'))
        .digest('hex');
      const prev = cache.get(id);
      // Skip recompiling when the source is byte-identical to the last good build.
      if (
        prev?.srcHash === srcHash &&
        prev.status === 'ok' &&
        prev.pdfPath &&
        existsSync(prev.pdfPath)
      ) {
        return prev;
      }
      const result: CompileResult = await compile({
        projectDir: path.join(presentationsRoot, id),
        mainFile: 'main.tex',
        engine,
        passes: 2,
        outDir: path.join(cacheRoot, id),
      });
      const state: DeckState = {
        status: result.status === 0 ? 'ok' : 'error',
        pdfPath: result.pdfPath,
        log: result.log,
        srcHash,
      };
      // Snapshot the bytes now, while we hold the inflight lock and the file is
      // complete — so /__pdf never reads main.pdf mid-rewrite by the next compile.
      if (state.status === 'ok' && state.pdfPath) {
        state.pdfBytes = await readFile(state.pdfPath);
        state.pageCount = Number(result.log.match(/Output written on .*?\((\d+) pages?/)?.[1] ?? 0);
      }
      cache.set(id, state);
      return state;
    })();
    inflight.set(id, run);
    return run.finally(() => inflight.delete(id));
  }

  async function getDeck(id: string): Promise<DeckState> {
    // Wait out an in-progress compile so we never serve a half-written PDF.
    const pending = inflight.get(id);
    if (pending) return await pending;
    return cache.get(id) ?? (await compileDeck(id));
  }

  const idFromUrl = (url: string | undefined): string =>
    decodeURIComponent((url ?? '/').slice(1).split('?')[0]);

  return {
    name: 'nitex-studio',
    config() {
      return { server: { fs: { allow: [userCwd] } } };
    },
    configureServer(server) {
      const timers = new Map<string, ReturnType<typeof setTimeout>>();
      const queueRecompile = (id: string) => {
        const prev = timers.get(id);
        if (prev) clearTimeout(prev);
        timers.set(
          id,
          setTimeout(async () => {
            timers.delete(id);
            // Tell the client a compile is starting so it can show a loading state
            // for the whole compile, not just the brief PDF fetch afterwards.
            server.ws.send({ type: 'custom', event: 'nitex-studio:deck-compiling', data: { id } });
            const state = await compileDeck(id);
            server.ws.send({
              type: 'custom',
              event: 'nitex-studio:deck-changed',
              data: { id, status: state.status },
            });
          }, 150),
        );
      };

      if (existsSync(presentationsRoot)) server.watcher.add(presentationsRoot);
      const onChange = (p: string) => {
        const id = deckIdForPath(p);
        if (id) queueRecompile(id);
      };
      server.watcher.on('change', onChange);
      server.watcher.on('add', onChange);
      server.watcher.on('unlink', onChange);

      server.middlewares.use('/__decks', async (_req, res) => {
        const ids = await findDecks(presentationsRoot);
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify({ decks: ids.map((id) => ({ id })) }));
      });

      server.middlewares.use('/__pdf/', async (req, res) => {
        const state = await getDeck(idFromUrl(req.url));
        if (state.status !== 'ok' || !state.pdfBytes) {
          res.statusCode = 409;
          res.setHeader('content-type', 'application/json');
          res.end(JSON.stringify({ status: 'error' }));
          return;
        }
        res.setHeader('content-type', 'application/pdf');
        res.setHeader('cache-control', 'no-store');
        res.end(state.pdfBytes);
      });

      server.middlewares.use('/__status/', async (req, res) => {
        const state = await getDeck(idFromUrl(req.url));
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify({ status: state.status, log: state.log.slice(-4000) }));
      });

      server.middlewares.use('/__outline/', async (req, res) => {
        const file = deckMain(idFromUrl(req.url));
        res.setHeader('content-type', 'application/json');
        if (!existsSync(file)) {
          res.statusCode = 404;
          res.end(JSON.stringify({ frames: [] }));
          return;
        }
        const frames = listFrames(parseTex(await readFile(file, 'utf8')));
        res.end(JSON.stringify({ frames }));
      });

      // PDF page → frame index via inverse SyncTeX. For each page we ask which
      // source line it came from, then find the frame whose range contains that
      // line. (Forward search on a frame's first line is unreliable — SyncTeX maps
      // a `\frametitle` to the previous page, so it can't tell a frame's first page.)
      server.middlewares.use('/__pagemap/', async (req, res) => {
        res.setHeader('content-type', 'application/json');
        const id = idFromUrl(req.url);
        const file = deckMain(id);
        const outDir = path.join(cacheRoot, id);
        if (!existsSync(file) || !existsSync(path.join(outDir, 'main.synctex.gz'))) {
          res.end(JSON.stringify({ pageToFrame: [] }));
          return;
        }
        const src = await readFile(file, 'utf8');
        const hash = createHash('sha1').update(src).digest('hex');
        const cached = pageMapCache.get(id);
        if (cached?.hash === hash) {
          res.end(JSON.stringify({ pageToFrame: cached.pageToFrame }));
          return;
        }
        const pageCount = (await getDeck(id)).pageCount ?? 0;
        const begins = frameBeginLines(src);
        const frameForLine = (line: number): number => {
          let idx = 0;
          for (let i = 0; i < begins.length; i++) if (begins[i] <= line) idx = i;
          return idx;
        };
        const pageToFrame: number[] = [];
        for (let pg = 1; pg <= pageCount; pg++) {
          const out = await new Promise<string>((resolve) => {
            execFile(
              'synctex',
              ['edit', '-o', `${pg}:100:100:main.pdf`],
              { cwd: outDir },
              (_err, o) => resolve(o ?? ''),
            );
          });
          const m = out.match(/Line:(\d+)/);
          pageToFrame.push(m ? frameForLine(Number(m[1])) : (pageToFrame.at(-1) ?? 0));
        }
        pageMapCache.set(id, { hash, pageToFrame });
        res.end(JSON.stringify({ pageToFrame }));
      });

      server.middlewares.use('/__edit', async (req, res, next) => {
        if (req.method !== 'POST') return next();
        res.setHeader('content-type', 'application/json');
        const guard = validateMutationRequest(req, { requireJsonBody: true });
        if (!guard.ok) {
          res.statusCode = guard.status;
          res.end(JSON.stringify({ ok: false, error: guard.error }));
          return;
        }
        let body: { deckId?: string; op?: TexEditOp };
        try {
          body = JSON.parse(await readBody(req));
        } catch {
          res.statusCode = 400;
          res.end(JSON.stringify({ ok: false, error: 'invalid json' }));
          return;
        }
        const file = body.deckId ? deckMain(body.deckId) : '';
        if (!body.op || !existsSync(file)) {
          res.statusCode = 404;
          res.end(JSON.stringify({ ok: false, error: 'deck or op missing' }));
          return;
        }
        const src = await readFile(file, 'utf8');
        let updated = applyOpToSource(src, body.op);
        if (updated !== null) {
          // A deck that now contains \nibox needs the NiTeX package + its .sty.
          if (updated.includes('\\nibox')) {
            updated = ensureNitexUsepackage(updated);
            const sty = path.join(path.dirname(file), NITEX_STY_FILENAME);
            if (!existsSync(sty)) await writeFile(sty, NITEX_STY_SOURCE, 'utf8');
          }
          recordHistory(body.deckId as string, src); // snapshot for undo
          await writeFile(file, updated, 'utf8');
        }
        // The file watcher picks up the write and triggers recompile + ws notify.
        res.end(JSON.stringify({ ok: true, changed: updated !== null }));
      });

      // Undo / redo — restore a source snapshot. The watcher handles recompile + notify.
      const historyRoute =
        (dir: 'undo' | 'redo') =>
        async (req: Connect.IncomingMessage, res: ServerResponse, next: Connect.NextFunction) => {
          if (req.method !== 'POST') return next();
          res.setHeader('content-type', 'application/json');
          const guard = validateMutationRequest(req, { requireJsonBody: true });
          if (!guard.ok) {
            res.statusCode = guard.status;
            res.end(JSON.stringify({ ok: false, error: guard.error }));
            return;
          }
          let id = '';
          try {
            id = (JSON.parse(await readBody(req)) as { deckId?: string }).deckId ?? '';
          } catch {
            res.statusCode = 400;
            res.end(JSON.stringify({ ok: false, error: 'invalid json' }));
            return;
          }
          const changed = id ? await stepHistory(id, dir) : false;
          res.end(JSON.stringify({ ok: true, changed }));
        };
      server.middlewares.use('/__undo', historyRoute('undo'));
      server.middlewares.use('/__redo', historyRoute('redo'));

      // Create a new deck from the starter template.
      server.middlewares.use('/__new', async (req, res, next) => {
        if (req.method !== 'POST') return next();
        res.setHeader('content-type', 'application/json');
        const guard = validateMutationRequest(req, { requireJsonBody: true });
        if (!guard.ok) {
          res.statusCode = guard.status;
          res.end(JSON.stringify({ ok: false, error: guard.error }));
          return;
        }
        let body: { id?: string; title?: string };
        try {
          body = JSON.parse(await readBody(req));
        } catch {
          res.statusCode = 400;
          res.end(JSON.stringify({ ok: false, error: 'invalid json' }));
          return;
        }
        const id = (body.id ?? '').trim();
        if (!DECK_ID_RE.test(id)) {
          res.statusCode = 400;
          res.end(JSON.stringify({ ok: false, error: 'id inválido' }));
          return;
        }
        const file = deckMain(id);
        if (existsSync(file)) {
          res.statusCode = 409;
          res.end(JSON.stringify({ ok: false, error: 'já existe um deck com esse nome' }));
          return;
        }
        await mkdir(path.dirname(file), { recursive: true });
        await writeFile(file, starterTex(body.title?.trim() || id), 'utf8');
        res.end(JSON.stringify({ ok: true, id }));
      });
    },
  };
}

export async function loadUserConfig(userCwd: string): Promise<NitexStudioConfig> {
  const file = path.join(userCwd, CONFIG_FILE);
  if (!existsSync(file)) return {};
  const loaded = await loadConfigFromFile(
    { command: 'serve', mode: 'development' },
    file,
    userCwd,
    'silent',
  );
  return (loaded?.config ?? {}) as NitexStudioConfig;
}

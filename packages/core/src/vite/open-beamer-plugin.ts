import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  addFrame,
  deleteFrame,
  deleteFrameComponent,
  duplicateFrame,
  editFrameText,
  editFrameTitle,
  type FontSize,
  frameBeginLines,
  insertIntoFrame,
  listFrames,
  parseTex,
  printTex,
  reorderFrame,
  setFrameColor,
  setFrameFontSize,
  setRunColor,
  setRunFontSize,
  toggleRunBold,
} from '@open-beamer/editing';
import { type CompileResult, compile } from '@open-beamer/engine';
import fg from 'fast-glob';
import { type Connect, loadConfigFromFile, type Plugin } from 'vite';
import type { OpenBeamerConfig } from '../config.ts';
import { validateMutationRequest } from '../http/request-guard.ts';

const CONFIG_FILE = 'open-beamer.config.ts';

export type TexEditOp =
  | { kind: 'title'; frameIndex: number; value: string }
  | { kind: 'text'; frameIndex: number; prevText: string; value: string }
  | { kind: 'fontSize'; frameIndex: number; size: FontSize }
  | { kind: 'color'; frameIndex: number; color: string }
  | { kind: 'reorder'; from: number; to: number }
  | { kind: 'duplicate'; frameIndex: number }
  | { kind: 'delete'; frameIndex: number }
  | { kind: 'runColor'; frameIndex: number; runText: string; color: string }
  | { kind: 'runFontSize'; frameIndex: number; runText: string; size: FontSize }
  | { kind: 'runBold'; frameIndex: number; runText: string }
  | { kind: 'insert'; frameIndex: number; snippet: string }
  | { kind: 'addFrame'; snippet: string; afterIndex: number }
  | { kind: 'deleteComponent'; frameIndex: number; componentIndex: number };

function applyOp(ast: ReturnType<typeof parseTex>, op: TexEditOp): boolean {
  switch (op.kind) {
    case 'title':
      return editFrameTitle(ast, op.frameIndex, op.value);
    case 'text':
      return editFrameText(ast, op.frameIndex, op.prevText, op.value);
    case 'fontSize':
      return setFrameFontSize(ast, op.frameIndex, op.size);
    case 'color':
      return setFrameColor(ast, op.frameIndex, op.color);
    case 'reorder':
      return reorderFrame(ast, op.from, op.to);
    case 'duplicate':
      return duplicateFrame(ast, op.frameIndex);
    case 'delete':
      return deleteFrame(ast, op.frameIndex);
    case 'runColor':
      return setRunColor(ast, op.frameIndex, op.runText, op.color);
    case 'runFontSize':
      return setRunFontSize(ast, op.frameIndex, op.runText, op.size);
    case 'runBold':
      return toggleRunBold(ast, op.frameIndex, op.runText);
    case 'insert':
      return insertIntoFrame(ast, op.frameIndex, op.snippet);
    case 'addFrame':
      return addFrame(ast, op.snippet, op.afterIndex);
    case 'deleteComponent':
      return deleteFrameComponent(ast, op.frameIndex, op.componentIndex);
    default:
      return false;
  }
}

async function readBody(req: Connect.IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString('utf8');
}

export type OpenBeamerPluginOptions = {
  userCwd: string;
  config: OpenBeamerConfig;
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

export function openBeamerPlugin(opts: OpenBeamerPluginOptions): Plugin {
  const { userCwd, config } = opts;
  const presentationsDir = config.presentationsDir ?? 'presentations';
  const presentationsRoot = path.resolve(userCwd, presentationsDir);
  const engine = config.engine ?? 'lualatex';
  // Compile outputs live here, outside the watched source — so generated
  // .pdf/.aux/.log never re-trigger the watcher. Vite ignores node_modules.
  const cacheRoot = path.join(userCwd, 'node_modules', '.open-beamer');

  const cache = new Map<string, DeckState>();
  const inflight = new Map<string, Promise<DeckState>>();
  // PDF page → frame index per deck (0-based), cached by source hash.
  const pageMapCache = new Map<string, { hash: string; pageToFrame: number[] }>();

  const deckMain = (id: string) => path.join(presentationsRoot, id, 'main.tex');

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
    name: 'open-beamer',
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
            server.ws.send({ type: 'custom', event: 'open-beamer:deck-compiling', data: { id } });
            const state = await compileDeck(id);
            server.ws.send({
              type: 'custom',
              event: 'open-beamer:deck-changed',
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
        const ast = parseTex(src);
        let written = false;
        if (applyOp(ast, body.op)) {
          const updated = printTex(ast);
          if (updated !== src) {
            await writeFile(file, updated, 'utf8');
            written = true;
          }
        }
        // The file watcher picks up the write and triggers recompile + ws notify.
        res.end(JSON.stringify({ ok: true, changed: written }));
      });
    },
  };
}

export async function loadUserConfig(userCwd: string): Promise<OpenBeamerConfig> {
  const file = path.join(userCwd, CONFIG_FILE);
  if (!existsSync(file)) return {};
  const loaded = await loadConfigFromFile(
    { command: 'serve', mode: 'development' },
    file,
    userCwd,
    'silent',
  );
  return (loaded?.config ?? {}) as OpenBeamerConfig;
}

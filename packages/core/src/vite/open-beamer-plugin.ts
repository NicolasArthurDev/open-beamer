import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  deleteFrame,
  duplicateFrame,
  editFrameText,
  editFrameTitle,
  type FontSize,
  frameAtLine,
  listFrames,
  parseTex,
  printTex,
  reorderFrame,
  setFrameColor,
  setFrameFontSize,
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
  | { kind: 'delete'; frameIndex: number };

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
      };
      cache.set(id, state);
      return state;
    })();
    inflight.set(id, run);
    return run.finally(() => inflight.delete(id));
  }

  async function getDeck(id: string): Promise<DeckState> {
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
        if (state.status !== 'ok' || !state.pdfPath) {
          res.statusCode = 409;
          res.setHeader('content-type', 'application/json');
          res.end(JSON.stringify({ status: 'error' }));
          return;
        }
        const bytes = await readFile(state.pdfPath);
        res.setHeader('content-type', 'application/pdf');
        res.setHeader('cache-control', 'no-store');
        res.end(bytes);
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

      server.middlewares.use('/__locate/', async (req, res) => {
        res.setHeader('content-type', 'application/json');
        const raw = req.url ?? '/';
        const id = decodeURIComponent(raw.slice(1).split('?')[0]);
        const q = new URLSearchParams(raw.split('?')[1] ?? '');
        const page = Number(q.get('page'));
        const x = Number(q.get('x'));
        const y = Number(q.get('y'));
        const file = deckMain(id);
        const outDir = path.join(cacheRoot, id);
        if (
          !existsSync(file) ||
          !existsSync(path.join(outDir, 'main.synctex.gz')) ||
          !Number.isFinite(page) ||
          !Number.isFinite(x) ||
          !Number.isFinite(y)
        ) {
          res.end(JSON.stringify({ frameIndex: null }));
          return;
        }
        const stdout = await new Promise<string>((resolve) => {
          execFile(
            'synctex',
            ['edit', '-o', `${page}:${x}:${y}:main.pdf`],
            { cwd: outDir },
            (_err, out) => resolve(out ?? ''),
          );
        });
        const match = stdout.match(/Line:(\d+)/);
        const frameIndex = match
          ? frameAtLine(await readFile(file, 'utf8'), Number(match[1]))
          : null;
        res.end(JSON.stringify({ frameIndex }));
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

import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { type CompileResult, compile } from '@open-beamer/engine';
import fg from 'fast-glob';
import { loadConfigFromFile, type Plugin } from 'vite';
import type { OpenBeamerConfig } from '../config.ts';

const CONFIG_FILE = 'open-beamer.config.ts';

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

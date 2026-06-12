import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import type { InlineConfig } from 'vite';
import type { OpenBeamerConfig } from '../config.ts';
import { loadUserConfig, openBeamerPlugin } from './open-beamer-plugin.ts';

function findPackageRoot(fromFile: string): string {
  let dir = path.dirname(fromFile);
  while (dir !== path.dirname(dir)) {
    if (existsSync(path.join(dir, 'package.json'))) return dir;
    dir = path.dirname(dir);
  }
  throw new Error(`Could not find package.json walking up from ${fromFile}`);
}

const PKG_ROOT = findPackageRoot(fileURLToPath(import.meta.url));
const APP_ROOT = path.join(PKG_ROOT, 'src', 'app');

export type CreateViteConfigOptions = {
  userCwd: string;
  config?: OpenBeamerConfig;
};

export async function createViteConfig(opts: CreateViteConfigOptions): Promise<InlineConfig> {
  const userCwd = path.resolve(opts.userCwd);
  const config = opts.config ?? (await loadUserConfig(userCwd));
  const presentationsDir = config.presentationsDir ?? 'presentations';
  const assetsDir = config.assetsDir ?? 'assets';
  const presentationsAbs = path.resolve(userCwd, presentationsDir);
  const assetsAbs = path.resolve(userCwd, assetsDir);

  return {
    base: config.base ?? '/',
    root: APP_ROOT,
    configFile: false,
    envDir: userCwd,
    plugins: [react(), openBeamerPlugin({ userCwd, config })],
    resolve: {
      alias: {
        '@': APP_ROOT,
        '@assets': assetsAbs,
      },
    },
    optimizeDeps: {
      entries: [path.join(APP_ROOT, 'main.tsx')],
      include: ['react', 'react-dom', 'react-dom/client', 'react-router-dom', 'pdfjs-dist'],
    },
    server: {
      port: config.port ?? 5173,
      fs: { allow: [APP_ROOT, userCwd, presentationsAbs, assetsAbs] },
    },
  };
}

export { APP_ROOT };

import type { LatexEngine } from '@open-beamer/engine';

export type OpenBeamerConfig = {
  /** Vite base path. Defaults to `/`. */
  base?: string;
  /** Directory holding `<id>/main.tex` decks. Defaults to `presentations`. */
  presentationsDir?: string;
  /** Directory for shared assets. Defaults to `assets`. */
  assetsDir?: string;
  /** Dev server port. Defaults to `5173`. */
  port?: number;
  /** LaTeX engine used to compile decks. Defaults to `lualatex`. */
  engine?: LatexEngine;
};

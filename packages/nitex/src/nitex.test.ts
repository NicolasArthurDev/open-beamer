import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compile } from '@nitex-studio/engine';
import { describe, expect, it } from 'vitest';
import { clampCoord, NITEX_STY_FILENAME, NITEX_STY_SOURCE, roundCoord } from './index';

describe('nitex package', () => {
  it('NITEX_STY_SOURCE stays byte-identical to nitex.sty (no drift)', () => {
    const file = readFileSync(fileURLToPath(new URL('../nitex.sty', import.meta.url)), 'utf8');
    expect(NITEX_STY_SOURCE).toBe(file);
  });

  it('clampCoord keeps values inside the 0..100 plane', () => {
    expect(clampCoord(-5)).toBe(0);
    expect(clampCoord(150)).toBe(100);
    expect(clampCoord(42.5)).toBe(42.5);
    expect(clampCoord(Number.NaN)).toBe(0);
  });

  it('roundCoord keeps 3 decimals', () => {
    expect(roundCoord(10.21049)).toBe(10.21);
    expect(roundCoord(20.5905)).toBe(20.591);
  });
});

function hasLualatex(): boolean {
  try {
    execFileSync('lualatex', ['--version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

describe('nitex compiles', () => {
  it.runIf(hasLualatex())('a deck using \\nibox compiles to a PDF', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'nitex-'));
    const out = mkdtempSync(join(tmpdir(), 'nitex-out-'));
    try {
      writeFileSync(join(dir, NITEX_STY_FILENAME), NITEX_STY_SOURCE, 'utf8');
      writeFileSync(
        join(dir, 'main.tex'),
        [
          '\\documentclass[aspectratio=169]{beamer}',
          '\\usepackage{nitex}',
          '\\begin{document}',
          '\\begin{frame}[plain]',
          '\\nibox{10.5}{80}{40}{Hello NiTeX}',
          '\\nibox{55}{20.5}{40}{Outra caixa}',
          '\\end{frame}',
          '\\end{document}',
          '',
        ].join('\n'),
        'utf8',
      );
      const r = await compile({ projectDir: dir, mainFile: 'main.tex', passes: 2, outDir: out });
      if (r.status !== 0) console.error(r.log.slice(-1500));
      expect(r.status).toBe(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
      rmSync(out, { recursive: true, force: true });
    }
  });
});

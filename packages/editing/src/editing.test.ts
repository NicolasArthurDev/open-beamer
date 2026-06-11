import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compile, type LatexEngine } from '@open-beamer/engine';
import { describe, expect, it } from 'vitest';
import { parseTex, printTex, setFrameTitle, wrapInColor } from './index';

const here = dirname(fileURLToPath(import.meta.url));
const fixturePath = join(here, '../../engine/fixtures/sample/main.tex');
const source = readFileSync(fixturePath, 'utf8');

function detectEngine(): LatexEngine | null {
  for (const candidate of ['lualatex', 'xelatex'] as const) {
    try {
      execFileSync(candidate, ['--version'], { stdio: 'ignore' });
      return candidate;
    } catch {
      // not installed — try the next
    }
  }
  return null;
}

const engine = detectEngine();

describe('@open-beamer/editing round-trip', () => {
  it('edits frame title and wraps a word in color, preserving the rest', () => {
    const ast = parseTex(source);

    expect(setFrameTitle(ast, 'Primeiro slide', 'Slide alterado')).toBe(true);
    expect(wrapInColor(ast, 'destaque', 'red')).toBe(true);

    const out = printTex(ast);

    expect(out).toContain('Slide alterado');
    expect(out).not.toContain('Primeiro slide');
    expect(out).toMatch(/\\textcolor\{red\}\{destaque\}/);
    // untouched regions stay intact
    expect(out).toContain('Segundo slide');
    expect(out).toContain('remember picture');
  });

  it.runIf(engine)(`the edited .tex still compiles (${engine})`, async () => {
    const ast = parseTex(source);
    setFrameTitle(ast, 'Primeiro slide', 'Slide alterado');
    wrapInColor(ast, 'destaque', 'red');
    const edited = printTex(ast);

    const work = mkdtempSync(join(tmpdir(), 'ob-editing-'));
    try {
      writeFileSync(join(work, 'main.tex'), edited, 'utf8');
      const result = await compile({
        projectDir: work,
        mainFile: 'main.tex',
        engine: engine ?? 'lualatex',
        passes: 2,
      });
      if (result.status !== 0) {
        console.error('--- LaTeX log tail ---\n', result.log.slice(-3000));
      }
      expect(result.status).toBe(0);
      expect(result.pdfPath).not.toBeNull();
    } finally {
      rmSync(work, { recursive: true, force: true });
    }
  });
});

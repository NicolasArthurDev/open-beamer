import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { compile } from '@open-beamer/engine';
import { describe, expect, it } from 'vitest';
import {
  deleteFrame,
  duplicateFrame,
  editFrameText,
  editFrameTitle,
  frameAtLine,
  listFrames,
  parseTex,
  printTex,
  reorderFrame,
  setFrameColor,
  setFrameFontSize,
} from './index';

const SAMPLE = `\\documentclass{beamer}
\\begin{document}
\\begin{frame}{Alpha}
Hello world.
\\end{frame}
\\begin{frame}
\\frametitle{Beta}
Second body here.
\\end{frame}
\\end{document}
`;

const count = (s: string, sub: string) => s.split(sub).length - 1;

describe('frame editing ops', () => {
  it('lists frames with titles and body text', () => {
    const frames = listFrames(parseTex(SAMPLE));
    expect(frames.map((f) => f.title)).toEqual(['Alpha', 'Beta']);
    expect(frames[0].texts.join(' ')).toContain('Hello world.');
    expect(frames[1].texts.join(' ')).toContain('Second body here.');
  });

  it('edits a frame title (group style and \\frametitle style)', () => {
    const ast = parseTex(SAMPLE);
    expect(editFrameTitle(ast, 0, 'Alpha One')).toBe(true);
    expect(editFrameTitle(ast, 1, 'Beta Two')).toBe(true);
    const out = printTex(ast);
    expect(out).toContain('Alpha One');
    expect(out).toContain('Beta Two');
    expect(out).not.toContain('{Alpha}');
  });

  it('replaces a body text run', () => {
    const ast = parseTex(SAMPLE);
    expect(editFrameText(ast, 0, 'Hello world.', 'Bye now.')).toBe(true);
    const out = printTex(ast);
    expect(out).toContain('Bye now.');
    expect(out).not.toContain('Hello world.');
  });

  it('sets font size idempotently (no nesting on re-apply)', () => {
    const ast = parseTex(SAMPLE);
    expect(setFrameFontSize(ast, 0, 'large')).toBe(true);
    setFrameFontSize(ast, 0, 'large');
    expect(count(printTex(ast), '\\large')).toBe(1);
    setFrameFontSize(ast, 0, 'small');
    const out = printTex(ast);
    expect(count(out, '\\small')).toBe(1);
    expect(count(out, '\\large')).toBe(0);
  });

  it('sets color idempotently', () => {
    const ast = parseTex(SAMPLE);
    setFrameColor(ast, 0, 'red');
    setFrameColor(ast, 0, 'blue');
    const out = printTex(ast);
    expect(count(out, '\\color')).toBe(1);
    expect(out).toContain('\\color{blue}');
  });

  it('duplicates, deletes and reorders frames', () => {
    let ast = parseTex(SAMPLE);
    expect(duplicateFrame(ast, 0)).toBe(true);
    expect(listFrames(ast).length).toBe(3);

    ast = parseTex(SAMPLE);
    expect(deleteFrame(ast, 0)).toBe(true);
    expect(listFrames(ast).map((f) => f.title)).toEqual(['Beta']);

    ast = parseTex(SAMPLE);
    expect(reorderFrame(ast, 0, 1)).toBe(true);
    expect(listFrames(ast).map((f) => f.title)).toEqual(['Beta', 'Alpha']);
  });
});

describe('frameAtLine', () => {
  // line: 1 \documentclass, 2 \begin{document}, 3 \begin{frame}{Alpha},
  //       4 Hello world., 5 \end{frame}, 6 \begin{frame}, 7 \frametitle{Beta},
  //       8 Second body here., 9 \end{frame}, 10 \end{document}
  it('maps a source line to its containing frame index', () => {
    expect(frameAtLine(SAMPLE, 4)).toBe(0); // inside Alpha
    expect(frameAtLine(SAMPLE, 3)).toBe(0); // the \begin line
    expect(frameAtLine(SAMPLE, 5)).toBe(0); // the \end line
    expect(frameAtLine(SAMPLE, 7)).toBe(1); // inside Beta
    expect(frameAtLine(SAMPLE, 9)).toBe(1);
  });

  it('returns null outside any frame', () => {
    expect(frameAtLine(SAMPLE, 1)).toBeNull();
    expect(frameAtLine(SAMPLE, 2)).toBeNull();
    expect(frameAtLine(SAMPLE, 10)).toBeNull();
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

describe('edited deck still compiles', () => {
  it.runIf(hasLualatex())('title + size + color edits reprint to compilable LaTeX', async () => {
    const ast = parseTex(SAMPLE);
    editFrameTitle(ast, 0, 'Edited');
    setFrameFontSize(ast, 0, 'large');
    setFrameColor(ast, 0, 'blue');
    const edited = printTex(ast);

    const dir = mkdtempSync(join(tmpdir(), 'ob-frame-'));
    const out = mkdtempSync(join(tmpdir(), 'ob-frame-out-'));
    try {
      writeFileSync(join(dir, 'main.tex'), edited, 'utf8');
      const result = await compile({
        projectDir: dir,
        mainFile: 'main.tex',
        passes: 2,
        outDir: out,
      });
      if (result.status !== 0) console.error(result.log.slice(-2000));
      expect(result.status).toBe(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
      rmSync(out, { recursive: true, force: true });
    }
  });
});

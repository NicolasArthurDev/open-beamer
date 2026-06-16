import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { compile } from '@nitex-studio/engine';
import { describe, expect, it } from 'vitest';
import {
  addFrame,
  applyOp,
  applyOpToSource,
  deleteFrame,
  deleteFrameComponent,
  duplicateFrame,
  editFrameText,
  editFrameTitle,
  frameAtLine,
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

const NESTED = `\\documentclass{beamer}
\\begin{document}
\\begin{frame}{Agenda}
\\begin{itemize}
\\item First topic
\\item Second topic
\\end{itemize}
\\end{frame}
\\end{document}
`;

describe('nested body text (itemize/block/columns)', () => {
  it('lists text runs nested inside environments', () => {
    const frames = listFrames(parseTex(NESTED));
    expect(frames[0].texts).toContain('First topic');
    expect(frames[0].texts).toContain('Second topic');
  });

  it('edits a nested bullet in place without gluing onto \\item', () => {
    const ast = parseTex(NESTED);
    expect(editFrameText(ast, 0, 'First topic', 'Edited topic')).toBe(true);
    const out = printTex(ast);
    expect(out).toContain('Edited topic');
    expect(out).not.toContain('First topic');
    expect(out).toContain('Second topic'); // the other bullet is untouched
    // regression: must not produce `\itemEdited` (control word eating the text)
    expect(out).not.toMatch(/\\item[A-Za-z]/);
  });
});

const countOf = (s: string, sub: string) => s.split(sub).length - 1;

describe('per-run formatting (color/size/bold)', () => {
  it('colors a single run and re-applying replaces (no nesting), keeping it listed', () => {
    const ast = parseTex(NESTED);
    expect(setRunColor(ast, 0, 'First topic', 'red')).toBe(true);
    let out = printTex(ast);
    expect(out).toContain('\\color{red}');
    expect(out).toContain('First topic');
    // the other bullet is untouched
    expect(out).toContain('Second topic');
    // run still listed (re-editable) after formatting
    expect(listFrames(ast)[0].texts).toContain('First topic');

    expect(setRunColor(ast, 0, 'First topic', 'blue')).toBe(true);
    out = printTex(ast);
    expect(countOf(out, '\\color')).toBe(1);
    expect(out).toContain('\\color{blue}');
  });

  it('sets per-run font size idempotently', () => {
    const ast = parseTex(NESTED);
    setRunFontSize(ast, 0, 'First topic', 'large');
    setRunFontSize(ast, 0, 'First topic', 'small');
    const out = printTex(ast);
    expect(countOf(out, '\\large')).toBe(0);
    expect(countOf(out, '\\small')).toBe(1);
  });

  it('toggles bold on and off', () => {
    const ast = parseTex(NESTED);
    expect(toggleRunBold(ast, 0, 'First topic')).toBe(true);
    expect(printTex(ast)).toContain('\\bfseries');
    expect(toggleRunBold(ast, 0, 'First topic')).toBe(true);
    expect(printTex(ast)).not.toContain('\\bfseries');
  });

  it('stacks color + size + bold in one group, run still listed', () => {
    const ast = parseTex(NESTED);
    setRunColor(ast, 0, 'First topic', 'red');
    setRunFontSize(ast, 0, 'First topic', 'large');
    toggleRunBold(ast, 0, 'First topic');
    const out = printTex(ast);
    expect(out).toContain('\\color{red}');
    expect(out).toContain('\\large');
    expect(out).toContain('\\bfseries');
    expect(countOf(out, '\\color')).toBe(1);
    expect(listFrames(ast)[0].texts).toContain('First topic');
  });
});

describe('inserting components', () => {
  it('inserts a snippet into a frame body (listed afterwards)', () => {
    const ast = parseTex(SAMPLE);
    expect(insertIntoFrame(ast, 0, '\\begin{itemize}\\item New bullet\\end{itemize}')).toBe(true);
    expect(listFrames(ast)[0].texts).toContain('New bullet');
  });

  it('adds a new frame after the given index, in order', () => {
    const ast = parseTex(SAMPLE);
    expect(addFrame(ast, '\\begin{frame}{Gamma}\nHi there.\n\\end{frame}', 0)).toBe(true);
    expect(listFrames(ast).map((f) => f.title)).toEqual(['Alpha', 'Gamma', 'Beta']);
  });

  it('prepends a new frame at the beginning when afterIndex < 0', () => {
    const ast = parseTex(SAMPLE);
    expect(addFrame(ast, '\\begin{frame}{Intro}\nHi.\n\\end{frame}', -1)).toBe(true);
    expect(listFrames(ast).map((f) => f.title)).toEqual(['Intro', 'Alpha', 'Beta']);
  });

  it('lists inserted components and deletes one by index', () => {
    const ast = parseTex(SAMPLE);
    insertIntoFrame(ast, 0, '\\begin{itemize}\\item One\\end{itemize}');
    insertIntoFrame(ast, 0, '\\begin{block}{T}\nBody.\n\\end{block}');
    expect(listFrames(ast)[0].components.map((c) => c.env)).toEqual(['itemize', 'block']);

    // delete the first component (the itemize); the block survives
    expect(deleteFrameComponent(ast, 0, 0)).toBe(true);
    const after = listFrames(ast)[0];
    expect(after.components.map((c) => c.env)).toEqual(['block']);
    const out = printTex(ast);
    expect(out).not.toContain('\\begin{itemize}');
    expect(out).toContain('\\begin{block}');
    expect(out).toContain('Hello world.'); // original body text untouched
  });
});

describe('applyOp (shared op layer)', () => {
  it('dispatches an op to the AST (title)', () => {
    const ast = parseTex(SAMPLE);
    expect(applyOp(ast, { kind: 'title', frameIndex: 0, value: 'Renamed' })).toBe(true);
    expect(listFrames(ast)[0].title).toBe('Renamed');
  });

  it('applyOpToSource reprints, or returns null when nothing changed', () => {
    const out = applyOpToSource(SAMPLE, { kind: 'title', frameIndex: 0, value: 'Renamed' });
    expect(out).not.toBeNull();
    expect(out).toContain('Renamed');
    // a no-op (same title) yields null
    expect(applyOpToSource(SAMPLE, { kind: 'title', frameIndex: 0, value: 'Alpha' })).toBeNull();
    // an out-of-range frame yields null
    expect(applyOpToSource(SAMPLE, { kind: 'delete', frameIndex: 99 })).toBeNull();
  });
});

describe('frameBeginLines', () => {
  it('returns the 1-based line of each \\begin{frame} in order', () => {
    // SAMPLE: line 3 = \begin{frame}{Alpha}, line 6 = \begin{frame}
    expect(frameBeginLines(SAMPLE)).toEqual([3, 6]);
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

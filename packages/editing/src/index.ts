import type * as Ast from '@unified-latex/unified-latex-types';
import { getParser } from '@unified-latex/unified-latex-util-parse';
import { replaceNode } from '@unified-latex/unified-latex-util-replace';
import { toString as latexToString } from '@unified-latex/unified-latex-util-to-string';
import { visit } from '@unified-latex/unified-latex-util-visit';

// unified-latex only attaches arguments to macros it knows the signature of. Beamer's
// content macros aren't in the default table, so we register the ones we edit. `m` = one
// mandatory argument.
const parser = getParser({
  macros: {
    frametitle: { signature: 'm' },
    title: { signature: 'm' },
    frame: { signature: 'm' },
  },
});

export function parseTex(src: string): Ast.Root {
  return parser.parse(src);
}

export function printTex(ast: Ast.Root): string {
  return latexToString(ast);
}

function textArgument(text: string): Ast.Argument {
  return {
    type: 'argument',
    openMark: '{',
    closeMark: '}',
    content: [{ type: 'string', content: text }],
  };
}

/**
 * Replace the title of a frame whose current `\frametitle` text matches `oldTitle`.
 * Returns whether anything changed.
 */
export function setFrameTitle(ast: Ast.Root, oldTitle: string, newTitle: string): boolean {
  let changed = false;
  visit(ast, (node) => {
    if (node.type !== 'macro' || node.content !== 'frametitle' || !node.args?.length) {
      return;
    }
    const arg = node.args[node.args.length - 1];
    if (latexToString(arg.content).trim() === oldTitle) {
      arg.content = parser.parse(newTitle).content;
      changed = true;
    }
  });
  return changed;
}

/**
 * Wrap a standalone word in `\textcolor{color}{word}`. Returns whether anything changed.
 */
export function wrapInColor(ast: Ast.Root, word: string, color: string): boolean {
  let changed = false;
  replaceNode(ast, (node) => {
    if (node.type === 'string' && node.content === word) {
      changed = true;
      return {
        type: 'macro',
        content: 'textcolor',
        args: [textArgument(color), textArgument(word)],
      } as Ast.Macro;
    }
    return undefined;
  });
  return changed;
}

// ---------------------------------------------------------------------------
// Frame-level editing (Phase 2). Targets are located by frame index in document
// order. Edits mutate the AST and the caller reprints with printTex.
// ---------------------------------------------------------------------------

export type FrameInfo = { index: number; title: string; texts: string[] };

/** Beamer font-size switches, smallest → largest. */
export const FONT_SIZES = [
  'tiny',
  'scriptsize',
  'footnotesize',
  'small',
  'normalsize',
  'large',
  'Large',
  'LARGE',
  'huge',
  'Huge',
] as const;
export type FontSize = (typeof FONT_SIZES)[number];

type FrameRef = { node: Ast.Environment; container: (Ast.Node | Ast.Argument)[] };

function collectFrames(ast: Ast.Root): FrameRef[] {
  const frames: FrameRef[] = [];
  visit(ast, (node, info) => {
    if (node.type === 'environment' && node.env === 'frame') {
      frames.push({ node, container: info.containingArray ?? [] });
    }
  });
  return frames;
}

function isSpacing(n: Ast.Node): boolean {
  return n.type === 'whitespace' || n.type === 'parbreak' || n.type === 'comment';
}

/**
 * The node + accessors for a frame's title. Beamer's `frame` environment has a known
 * signature, so `\begin{frame}{Title}` puts the title in `frame.args`; `\frametitle{..}`
 * puts it in the body. `afterIndex` is where the body starts in `content` (-1 = title is
 * not a content node, body starts at the top).
 */
function titleTarget(
  frame: Ast.Environment,
): { get: () => string; set: (v: string) => void; afterIndex: number } | null {
  const content = frame.content;
  // (1) explicit \frametitle{..} in the body
  for (let i = 0; i < content.length; i++) {
    const n = content[i];
    if (n.type === 'macro' && n.content === 'frametitle' && n.args?.length) {
      const arg = n.args[n.args.length - 1];
      return {
        get: () => latexToString(arg.content).trim(),
        set: (v) => {
          arg.content = parseTex(v).content;
        },
        afterIndex: i + 1,
      };
    }
  }
  // (2) the frame environment's mandatory `{title}` argument
  const titleArg = frame.args?.find((a) => a.openMark === '{' && a.content.length > 0);
  if (titleArg) {
    return {
      get: () => latexToString(titleArg.content).trim(),
      set: (v) => {
        titleArg.content = parseTex(v).content;
      },
      afterIndex: -1,
    };
  }
  // (3) a leading `{..}` group in the body (fallback)
  let i = 0;
  while (i < content.length && isSpacing(content[i])) i++;
  const first = content[i];
  if (first && first.type === 'group') {
    return {
      get: () => latexToString(first.content).trim(),
      set: (v) => {
        first.content = parseTex(v).content;
      },
      afterIndex: i + 1,
    };
  }
  return null;
}

type TextRun = {
  text: string;
  container: Ast.Node[];
  start: number;
  end: number;
  parent: Ast.Node | null;
};

// Environments whose contents aren't editable prose (skip when collecting runs).
const SKIP_ENVS = new Set(['tikzpicture', 'tabular', 'array', 'verbatim']);
// Macros whose arguments ARE editable prose. unified-latex attaches `\item` text as the
// macro's argument, so without this bullets would be invisible. Excludes title/color/
// layout macros (frametitle, color, vspace, …) so they don't show up as editable text.
const TEXT_MACROS = new Set([
  'item',
  'textbf',
  'textit',
  'emph',
  'alert',
  'underline',
  'textsf',
  'texttt',
  'textrm',
  'textsc',
]);

/**
 * Text runs (string + whitespace sequences) anywhere in a frame's body — including
 * inside itemize/block/columns/groups — so bullets and nested prose are editable, not
 * just top-level text. Each run carries its actual container array for in-place edits.
 */
function collectTextRuns(nodes: Ast.Node[], out: TextRun[], parent: Ast.Node | null): void {
  let i = 0;
  while (i < nodes.length) {
    const n = nodes[i];
    if (n.type === 'string' || n.type === 'whitespace') {
      const start = i;
      while (i < nodes.length && (nodes[i].type === 'string' || nodes[i].type === 'whitespace'))
        i++;
      const text = latexToString(nodes.slice(start, i)).trim();
      if (text) out.push({ text, container: nodes, start, end: i, parent });
    } else {
      if (n.type === 'group') {
        collectTextRuns(n.content, out, n);
      } else if (n.type === 'environment' && !SKIP_ENVS.has(n.env)) {
        collectTextRuns(n.content, out, n);
      } else if (n.type === 'macro' && TEXT_MACROS.has(n.content) && n.args) {
        for (const arg of n.args) collectTextRuns(arg.content, out, n);
      }
      i++;
    }
  }
}

function frameTextRuns(frame: Ast.Environment): TextRun[] {
  const out: TextRun[] = [];
  collectTextRuns(frame.content, out, null);
  return out;
}

export function listFrames(ast: Ast.Root): FrameInfo[] {
  return collectFrames(ast).map(({ node }, index) => ({
    index,
    title: titleTarget(node)?.get() ?? '',
    texts: frameTextRuns(node).map((r) => r.text),
  }));
}

export function editFrameTitle(ast: Ast.Root, index: number, value: string): boolean {
  const frame = collectFrames(ast)[index]?.node;
  const target = frame && titleTarget(frame);
  if (!target || target.get() === value.trim()) return false;
  target.set(value);
  return true;
}

export function editFrameText(
  ast: Ast.Root,
  index: number,
  prevText: string,
  value: string,
): boolean {
  const frame = collectFrames(ast)[index]?.node;
  if (!frame) return false;
  const run = frameTextRuns(frame).find((r) => r.text === prevText.trim());
  if (!run) return false;
  run.container.splice(run.start, run.end - run.start, ...parseTex(value).content);
  return true;
}

/** Insertion point for a body-level switch: right after the title (or first body node). */
function bodyStart(frame: Ast.Environment): number {
  const target = titleTarget(frame);
  if (target && target.afterIndex >= 0) return target.afterIndex;
  let i = 0;
  while (i < frame.content.length && isSpacing(frame.content[i])) i++;
  return i;
}

type SwitchKind = 'size' | 'color' | 'bold';

function isSizeMacro(n: Ast.Macro): boolean {
  return (FONT_SIZES as readonly string[]).includes(n.content);
}

function switchKind(n: Ast.Node): SwitchKind | null {
  if (n.type !== 'macro') return null;
  if (isSizeMacro(n)) return 'size';
  if (n.content === 'color') return 'color';
  if (n.content === 'bfseries') return 'bold';
  return null;
}

function makeSwitch(kind: SwitchKind, value: string): Ast.Macro {
  if (kind === 'color') return { type: 'macro', content: 'color', args: [textArgument(value)] };
  if (kind === 'bold') return { type: 'macro', content: 'bfseries' };
  return { type: 'macro', content: value }; // size
}

/**
 * Insert / replace / remove (value === null) a leading formatting switch of `kind` among the
 * leading switches of `nodes`, starting at `startIdx`. Idempotent: an existing switch of the
 * same kind is replaced, never duplicated. Returns whether anything changed.
 */
function setLeadingSwitch(
  nodes: Ast.Node[],
  startIdx: number,
  kind: SwitchKind,
  value: string | null,
): boolean {
  let scan = startIdx;
  while (scan < nodes.length && isSpacing(nodes[scan])) scan++;
  let found = -1;
  let s = scan;
  while (s < nodes.length) {
    const k = switchKind(nodes[s]);
    if (k === null) break;
    if (k === kind) {
      found = s;
      break;
    }
    s++;
    while (s < nodes.length && isSpacing(nodes[s])) s++;
  }
  if (found >= 0) {
    if (value === null) {
      const extra = nodes[found + 1] && isSpacing(nodes[found + 1]) ? 2 : 1;
      nodes.splice(found, extra);
    } else {
      nodes.splice(found, 1, makeSwitch(kind, value));
    }
    return true;
  }
  if (value === null) return false;
  nodes.splice(scan, 0, makeSwitch(kind, value), { type: 'whitespace' });
  return true;
}

function leadingSwitchPresent(nodes: Ast.Node[], startIdx: number, kind: SwitchKind): boolean {
  let s = startIdx;
  while (s < nodes.length && isSpacing(nodes[s])) s++;
  while (s < nodes.length) {
    const k = switchKind(nodes[s]);
    if (k === null) return false;
    if (k === kind) return true;
    s++;
    while (s < nodes.length && isSpacing(nodes[s])) s++;
  }
  return false;
}

export function setFrameFontSize(ast: Ast.Root, index: number, size: FontSize): boolean {
  const frame = collectFrames(ast)[index]?.node;
  if (!frame) return false;
  return setLeadingSwitch(frame.content, bodyStart(frame), 'size', size);
}

export function setFrameColor(ast: Ast.Root, index: number, color: string): boolean {
  const frame = collectFrames(ast)[index]?.node;
  if (!frame) return false;
  return setLeadingSwitch(frame.content, bodyStart(frame), 'color', color);
}

// --- per-run formatting (Trilha A) ---------------------------------------

/** True when the run is the sole text of a `{<switches> text}` group we manage. */
function inFormattingGroup(run: TextRun): run is TextRun & { parent: Ast.Group } {
  if (run.parent?.type !== 'group' || run.parent.content !== run.container) return false;
  const c = run.container;
  let i = 0;
  while (i < c.length && isSpacing(c[i])) i++;
  let hasSwitch = false;
  while (i < c.length && switchKind(c[i]) !== null) {
    hasSwitch = true;
    i++;
    while (i < c.length && isSpacing(c[i])) i++;
  }
  // The run is the text right after the leading switches, running to the end of the group.
  return hasSwitch && run.start <= i && run.end === c.length;
}

/** The content array of the formatting group wrapping a run, wrapping it first if needed. */
function runFormatGroupContent(run: TextRun): Ast.Node[] {
  if (inFormattingGroup(run)) return run.parent.content;
  const inner = run.container.slice(run.start, run.end);
  const group: Ast.Group = { type: 'group', content: inner };
  run.container.splice(run.start, run.end - run.start, group);
  return group.content;
}

function applyRunFormat(
  ast: Ast.Root,
  frameIndex: number,
  runText: string,
  kind: SwitchKind,
  value: string | null,
): boolean {
  const frame = collectFrames(ast)[frameIndex]?.node;
  if (!frame) return false;
  const run = frameTextRuns(frame).find((r) => r.text === runText.trim());
  if (!run) return false;
  if (value === null && !inFormattingGroup(run)) return false;
  return setLeadingSwitch(runFormatGroupContent(run), 0, kind, value);
}

export function setRunColor(
  ast: Ast.Root,
  frameIndex: number,
  runText: string,
  color: string,
): boolean {
  return applyRunFormat(ast, frameIndex, runText, 'color', color);
}

export function setRunFontSize(
  ast: Ast.Root,
  frameIndex: number,
  runText: string,
  size: FontSize,
): boolean {
  return applyRunFormat(ast, frameIndex, runText, 'size', size);
}

export function toggleRunBold(ast: Ast.Root, frameIndex: number, runText: string): boolean {
  const frame = collectFrames(ast)[frameIndex]?.node;
  if (!frame) return false;
  const run = frameTextRuns(frame).find((r) => r.text === runText.trim());
  if (!run) return false;
  const on = inFormattingGroup(run) && leadingSwitchPresent(run.parent.content, 0, 'bold');
  return setLeadingSwitch(runFormatGroupContent(run), 0, 'bold', on ? null : 'on');
}

export function deleteFrame(ast: Ast.Root, index: number): boolean {
  const ref = collectFrames(ast)[index];
  if (!ref) return false;
  const at = ref.container.indexOf(ref.node);
  if (at < 0) return false;
  ref.container.splice(at, 1);
  return true;
}

export function duplicateFrame(ast: Ast.Root, index: number): boolean {
  const ref = collectFrames(ast)[index];
  if (!ref) return false;
  const at = ref.container.indexOf(ref.node);
  if (at < 0) return false;
  const clone = structuredClone(ref.node);
  ref.container.splice(at + 1, 0, { type: 'parbreak' }, clone);
  return true;
}

/**
 * Map a 1-based source line to the index (document order) of the frame whose
 * `\begin{frame}..\end{frame}` spans it, or `null` if outside any frame. A pure text
 * scan — robust against AST position issues and Beamer overlays (SyncTeX may point at
 * `\end{frame}`, which still falls inside the frame's range). The index matches `listFrames`.
 */
export function frameAtLine(texSource: string, line: number): number | null {
  const lines = texSource.split(/\r?\n/);
  const beginRe = /\\begin\s*\{frame\}/;
  const endRe = /\\end\s*\{frame\}/;
  let frameIndex = -1;
  let openStart = -1;
  let inFrame = false;
  for (let i = 0; i < lines.length; i++) {
    const ln = i + 1;
    const text = lines[i];
    if (!inFrame && beginRe.test(text)) {
      frameIndex++;
      openStart = ln;
      if (endRe.test(text)) {
        if (line === ln) return frameIndex;
      } else {
        inFrame = true;
      }
    } else if (inFrame && endRe.test(text)) {
      if (line >= openStart && line <= ln) return frameIndex;
      inFrame = false;
    }
  }
  return null;
}

export function reorderFrame(ast: Ast.Root, from: number, to: number): boolean {
  const frames = collectFrames(ast);
  const a = frames[from];
  const b = frames[to];
  if (!a || !b || a.container !== b.container || from === to) return false;
  const arr = a.container;
  const fi = arr.indexOf(a.node);
  if (fi < 0) return false;
  arr.splice(fi, 1);
  const ti = arr.indexOf(b.node);
  arr.splice(from < to ? ti + 1 : ti, 0, a.node);
  return true;
}

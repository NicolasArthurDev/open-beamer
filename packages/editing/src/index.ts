import { clampCoord, NIBOX_MACRO, roundCoord } from '@nitex/nitex';
import type * as Ast from '@unified-latex/unified-latex-types';
import { getParser } from '@unified-latex/unified-latex-util-parse';
import { toString as latexToString } from '@unified-latex/unified-latex-util-to-string';
import { visit } from '@unified-latex/unified-latex-util-visit';

// unified-latex only attaches arguments to macros it knows the signature of. Beamer's
// content macros aren't in the default table, so we register the ones we edit. `m` = one
// mandatory argument; NiTeX's \nibox takes four (x, y, w, content).
const parser = getParser({
  macros: {
    frametitle: { signature: 'm' },
    title: { signature: 'm' },
    frame: { signature: 'm' },
    [NIBOX_MACRO]: { signature: 'm m m m' },
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

// ---------------------------------------------------------------------------
// Frame-level editing (Phase 2). Targets are located by frame index in document
// order. Edits mutate the AST and the caller reprints with printTex.
// ---------------------------------------------------------------------------

export type ComponentInfo = { index: number; env: string; label: string };
export type FrameInfo = {
  index: number;
  title: string;
  texts: string[];
  components: ComponentInfo[];
  niboxes: NiboxInfo[];
};

/** Friendly labels for the environments the palette inserts (fallback: the env name). */
const COMPONENT_LABELS: Record<string, string> = {
  itemize: 'Lista',
  enumerate: 'Lista numerada',
  columns: 'Colunas',
  block: 'Bloco',
  center: 'Centralizado',
  quote: 'Citação',
  figure: 'Figura',
  table: 'Tabela',
};

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

/** Top-level environments in a frame's body — the "components" the palette inserts. */
function frameComponents(frame: Ast.Environment): { node: Ast.Environment; at: number }[] {
  const out: { node: Ast.Environment; at: number }[] = [];
  frame.content.forEach((n, at) => {
    if (n.type === 'environment') out.push({ node: n, at });
  });
  return out;
}

function componentInfos(frame: Ast.Environment): ComponentInfo[] {
  return frameComponents(frame).map(({ node }, index) => ({
    index,
    env: node.env,
    label: COMPONENT_LABELS[node.env] ?? node.env,
  }));
}

export function listFrames(ast: Ast.Root): FrameInfo[] {
  return collectFrames(ast).map(({ node }, index) => ({
    index,
    title: titleTarget(node)?.get() ?? '',
    texts: frameTextRuns(node).map((r) => r.text),
    components: componentInfos(node),
    niboxes: niboxInfos(node),
  }));
}

/** Remove the `componentIndex`-th top-level component (environment) from a frame's body. */
export function deleteFrameComponent(
  ast: Ast.Root,
  frameIndex: number,
  componentIndex: number,
): boolean {
  const frame = collectFrames(ast)[frameIndex]?.node;
  if (!frame) return false;
  const ref = frameComponents(frame)[componentIndex];
  if (!ref) return false;
  let start = ref.at;
  let count = 1;
  // Swallow the separating parbreak/whitespace that insertIntoFrame left before it,
  // so deleting doesn't leave a widening blank gap.
  if (start > 0 && isSpacing(frame.content[start - 1])) {
    start -= 1;
    count += 1;
  }
  frame.content.splice(start, count);
  return true;
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
  const replacement = parseTex(value).content;
  // When the run sits at the very start of its container (e.g. right after `\item`),
  // keep a leading space so the new text doesn't glue onto a control word (`\itemEdited`).
  const head: Ast.Node[] = run.start === 0 ? [{ type: 'whitespace' }] : [];
  run.container.splice(run.start, run.end - run.start, ...head, ...replacement);
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

// --- inserting components (paleta) ---------------------------------------

/** Append a LaTeX snippet to the end of a frame's body. */
export function insertIntoFrame(ast: Ast.Root, frameIndex: number, snippetTex: string): boolean {
  const frame = collectFrames(ast)[frameIndex]?.node;
  if (!frame) return false;
  const nodes = parseTex(snippetTex).content;
  if (nodes.length === 0) return false;
  frame.content.push({ type: 'parbreak' }, ...nodes);
  return true;
}

/**
 * Insert a whole-frame snippet. `afterIndex < 0` prepends before the first frame
 * ("novo slide no início"); otherwise inserts right after the frame at `afterIndex`
 * (falling back to appending to the document).
 */
export function addFrame(ast: Ast.Root, snippetTex: string, afterIndex: number): boolean {
  const frameNode = parseTex(snippetTex).content.find(
    (n): n is Ast.Environment => n.type === 'environment' && n.env === 'frame',
  );
  if (!frameNode) return false;

  const frames = collectFrames(ast);

  if (afterIndex < 0 && frames.length > 0) {
    const first = frames[0];
    const at = first.container.indexOf(first.node);
    if (at >= 0) {
      first.container.splice(at, 0, frameNode, { type: 'parbreak' });
      return true;
    }
  }

  const ref = frames[afterIndex];
  if (ref) {
    const at = ref.container.indexOf(ref.node);
    if (at >= 0) {
      ref.container.splice(at + 1, 0, { type: 'parbreak' }, frameNode);
      return true;
    }
  }

  let inserted = false;
  visit(ast, (n) => {
    if (!inserted && n.type === 'environment' && n.env === 'document') {
      n.content.push({ type: 'parbreak' }, frameNode);
      inserted = true;
    }
  });
  return inserted;
}

/** 1-based source line of each `\begin{frame}` in document order (matches `listFrames`). */
export function frameBeginLines(texSource: string): number[] {
  const beginRe = /\\begin\s*\{frame\}/;
  const out: number[] = [];
  texSource.split(/\r?\n/).forEach((line, i) => {
    if (beginRe.test(line)) out.push(i + 1);
  });
  return out;
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

// --- NiTeX positioned boxes (\nibox{x}{y}{w}{content}) -------------------
// Coordinates are 0..100, origin bottom-left, y up; (x,y) = the box's top-left
// corner; w = width as % of the page. See @nitex/nitex.

export type NiboxInfo = { index: number; x: number; y: number; w: number; text: string };

function frameNiboxes(frame: Ast.Environment): Ast.Macro[] {
  const out: Ast.Macro[] = [];
  visit(frame, (node) => {
    if (node.type === 'macro' && node.content === NIBOX_MACRO && (node.args?.length ?? 0) >= 4) {
      out.push(node);
    }
  });
  return out;
}

const argToNumber = (arg: Ast.Argument): number => Number(latexToString(arg.content).trim());

function numberArg(value: number): Ast.Argument {
  return {
    type: 'argument',
    openMark: '{',
    closeMark: '}',
    content: [{ type: 'string', content: String(roundCoord(clampCoord(value))) }],
  };
}

function niboxInfos(frame: Ast.Environment): NiboxInfo[] {
  return frameNiboxes(frame).map((n, index) => {
    const a = n.args as Ast.Argument[];
    return {
      index,
      x: argToNumber(a[0]),
      y: argToNumber(a[1]),
      w: argToNumber(a[2]),
      text: latexToString(a[3].content).trim(),
    };
  });
}

export function listNiboxes(ast: Ast.Root, frameIndex: number): NiboxInfo[] {
  const frame = collectFrames(ast)[frameIndex]?.node;
  return frame ? niboxInfos(frame) : [];
}

/** Append a `\nibox{x}{y}{w}{content}` to a frame's body. */
export function insertNibox(
  ast: Ast.Root,
  frameIndex: number,
  x: number,
  y: number,
  w: number,
  content: string,
): boolean {
  const frame = collectFrames(ast)[frameIndex]?.node;
  if (!frame) return false;
  const macro: Ast.Macro = {
    type: 'macro',
    content: NIBOX_MACRO,
    args: [
      numberArg(x),
      numberArg(y),
      numberArg(w),
      { type: 'argument', openMark: '{', closeMark: '}', content: parseTex(content).content },
    ],
  };
  frame.content.push({ type: 'parbreak' }, macro);
  return true;
}

export function moveNibox(
  ast: Ast.Root,
  frameIndex: number,
  niboxIndex: number,
  x: number,
  y: number,
): boolean {
  const frame = collectFrames(ast)[frameIndex]?.node;
  const node = frame && frameNiboxes(frame)[niboxIndex];
  if (!node?.args) return false;
  node.args[0] = numberArg(x);
  node.args[1] = numberArg(y);
  return true;
}

export function resizeNibox(
  ast: Ast.Root,
  frameIndex: number,
  niboxIndex: number,
  w: number,
): boolean {
  const frame = collectFrames(ast)[frameIndex]?.node;
  const node = frame && frameNiboxes(frame)[niboxIndex];
  if (!node?.args) return false;
  node.args[2] = numberArg(w);
  return true;
}

export function deleteNibox(ast: Ast.Root, frameIndex: number, niboxIndex: number): boolean {
  const frame = collectFrames(ast)[frameIndex]?.node;
  if (!frame) return false;
  const node = frameNiboxes(frame)[niboxIndex];
  if (!node) return false;
  const at = frame.content.indexOf(node);
  if (at < 0) return false;
  let start = at;
  let count = 1;
  if (start > 0 && isSpacing(frame.content[start - 1])) {
    start -= 1;
    count += 1;
  }
  frame.content.splice(start, count);
  return true;
}

// ---------------------------------------------------------------------------
// The shared operation set. Every edit — from the UI, the CLI, or an AI agent —
// is one of these ops applied to the AST. Keeping the type and the dispatcher
// here makes `@nitex-studio/editing` the single source of truth for "what can be
// done to a deck"; the dev server, CLI and (future) MCP server all call applyOp.
// ---------------------------------------------------------------------------

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
  | { kind: 'deleteComponent'; frameIndex: number; componentIndex: number }
  | { kind: 'insertNibox'; frameIndex: number; x: number; y: number; w: number; content: string }
  | { kind: 'moveNibox'; frameIndex: number; niboxIndex: number; x: number; y: number }
  | { kind: 'resizeNibox'; frameIndex: number; niboxIndex: number; w: number }
  | { kind: 'deleteNibox'; frameIndex: number; niboxIndex: number };

/** Apply one edit op to the AST in place. Returns whether anything changed. */
export function applyOp(ast: Ast.Root, op: TexEditOp): boolean {
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
    case 'insertNibox':
      return insertNibox(ast, op.frameIndex, op.x, op.y, op.w, op.content);
    case 'moveNibox':
      return moveNibox(ast, op.frameIndex, op.niboxIndex, op.x, op.y);
    case 'resizeNibox':
      return resizeNibox(ast, op.frameIndex, op.niboxIndex, op.w);
    case 'deleteNibox':
      return deleteNibox(ast, op.frameIndex, op.niboxIndex);
    default:
      return false;
  }
}

/** Apply an op to a `.tex` source string, returning the reprinted source (or null if unchanged). */
export function applyOpToSource(src: string, op: TexEditOp): string | null {
  const ast = parseTex(src);
  if (!applyOp(ast, op)) return null;
  const out = printTex(ast);
  return out === src ? null : out;
}

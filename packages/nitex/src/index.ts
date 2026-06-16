/**
 * NiTeX -- a Cartesian plane for LaTeX. The language layer of NiTeX Studio.
 *
 * Authoring stays plain `.tex`; NiTeX adds a family of positioned components
 * (see `nitex.sty`). Every component is placed at coordinates 0..100 with
 * decimals, origin at the BOTTOM-LEFT of the page, y growing UP, (x,y) = the
 * box top-left corner, w = width as a percentage of the page width.
 */

export const NITEX_STY_FILENAME = 'nitex.sty';

/** The base macro name (kept for back-compat with earlier callers). */
export const NIBOX_MACRO = 'nibox';

/** The NiTeX coordinate plane: 0..100 on both axes (decimals ok). */
export const NITEX_PLANE = { min: 0, max: 100 } as const;

export type NiboxCoords = { x: number; y: number; w: number };

/** Clamp a NiTeX coordinate/length into the 0..100 plane. */
export function clampCoord(v: number): number {
  if (!Number.isFinite(v)) return NITEX_PLANE.min;
  return Math.min(NITEX_PLANE.max, Math.max(NITEX_PLANE.min, v));
}

/** Round a coordinate to NiTeX's authoring precision (3 decimals). */
export function roundCoord(v: number): number {
  return Math.round(v * 1000) / 1000;
}

// --- The ni component family (single source of truth) ----------------------
// Each type maps to a `\ni*` macro whose signature is {x}{y}{w} followed by one
// mandatory argument per field. The editor, the engine, and (later) AI agents
// all read this registry, so adding a component is a single edit here + a macro.

export type NiFieldKind = 'text' | 'multiline' | 'image' | 'math';
export type NiFieldSpec = { name: string; label: string; default: string; kind: NiFieldKind };
export type NiTypeSpec = {
  type: string;
  macro: string;
  label: string;
  fields: NiFieldSpec[];
  defaults: { x: number; y: number; w: number };
};

export const NI_COMPONENTS: NiTypeSpec[] = [
  {
    type: 'box',
    macro: 'nibox',
    label: 'Texto',
    fields: [{ name: 'content', label: 'Texto', default: 'Texto', kind: 'multiline' }],
    defaults: { x: 8, y: 85, w: 40 },
  },
  {
    type: 'bullets',
    macro: 'nibullets',
    label: 'Lista',
    fields: [
      {
        name: 'items',
        label: 'Itens',
        default: '\\item Primeiro \\item Segundo \\item Terceiro',
        kind: 'multiline',
      },
    ],
    defaults: { x: 8, y: 80, w: 45 },
  },
  {
    type: 'block',
    macro: 'niblock',
    label: 'Bloco',
    fields: [
      { name: 'title', label: 'Título', default: 'Título', kind: 'text' },
      { name: 'body', label: 'Conteúdo', default: 'Conteúdo do bloco.', kind: 'multiline' },
    ],
    defaults: { x: 8, y: 70, w: 45 },
  },
  {
    type: 'quote',
    macro: 'niquote',
    label: 'Citação',
    fields: [{ name: 'content', label: 'Texto', default: 'Texto da citação.', kind: 'multiline' }],
    defaults: { x: 8, y: 60, w: 50 },
  },
  {
    type: 'number',
    macro: 'ninumber',
    label: 'Número',
    fields: [
      { name: 'number', label: 'Número', default: '42', kind: 'text' },
      { name: 'caption', label: 'Rótulo', default: 'rótulo', kind: 'text' },
    ],
    defaults: { x: 8, y: 70, w: 30 },
  },
  {
    type: 'image',
    macro: 'niimage',
    label: 'Imagem',
    fields: [{ name: 'path', label: 'Imagem', default: 'Imagem', kind: 'image' }],
    defaults: { x: 55, y: 80, w: 35 },
  },
  {
    type: 'math',
    macro: 'nimath',
    label: 'Equação',
    fields: [{ name: 'content', label: 'Equação', default: 'E = mc^2', kind: 'math' }],
    defaults: { x: 30, y: 55, w: 40 },
  },
];

export const NI_MACRO_NAMES: string[] = NI_COMPONENTS.map((c) => c.macro);

const NI_MACRO_RE = new RegExp(`\\\\(${NI_MACRO_NAMES.join('|')})\\b`);

/** Whether a `.tex` source uses any NiTeX component (so the package must be loaded). */
export function usesNitex(src: string): boolean {
  return NI_MACRO_RE.test(src);
}

/**
 * Source of `nitex.sty`, embedded so consumers (the dev server) can drop it next
 * to a deck's main.tex without resolving a package path. Kept byte-identical to
 * the canonical `nitex.sty` file -- guarded by a test.
 */
export const NITEX_STY_SOURCE = String.raw`\NeedsTeXFormat{LaTeX2e}
\ProvidesPackage{nitex}[2026/06/16 NiTeX -- a Cartesian plane for LaTeX]

\RequirePackage{tikz}
\RequirePackage{graphicx}

% NiTeX accent color (decks may redefine it).
\definecolor{nitexAccent}{HTML}{2563EB}

% ---------------------------------------------------------------------------
% NiTeX coordinate plane
%   x, y, w are numbers in 0..100 (decimals allowed, e.g. 10.5).
%   Origin (0,0) is the BOTTOM-LEFT of the page; y grows UPWARD (Cartesian).
%   (x, y) addresses the box's TOP-LEFT corner.
%   w is the box width as a percentage of \paperwidth.
%
% Every ni component places styled content at (x, y) with width w through the
% shared \nitex@place helper. pgfmath (float) computes #/100*\paper... so that
% dividing first avoids the TeX "Dimension too large" overflow of \dimexpr.
% ---------------------------------------------------------------------------
\newcommand\nitex@place[4]{%
  \begin{tikzpicture}[remember picture, overlay]%
    \pgfmathsetlengthmacro\nitex@x{#1/100*\paperwidth}%
    \pgfmathsetlengthmacro\nitex@y{#2/100*\paperheight}%
    \pgfmathsetlengthmacro\nitex@w{#3/100*\paperwidth}%
    \node[anchor=north west, inner sep=0pt, outer sep=0pt, text width=\nitex@w]
      at ([xshift=\nitex@x, yshift=\nitex@y]current page.south west)
      {#4};%
  \end{tikzpicture}%
}

% \nibox{x}{y}{w}{content} -- a plain text box.
\newcommand\nibox[4]{\nitex@place{#1}{#2}{#3}{#4}}

% \nibullets{x}{y}{w}{items} -- items are \item lines, wrapped in an itemize.
\newcommand\nibullets[4]{\nitex@place{#1}{#2}{#3}{\begin{itemize}#4\end{itemize}}}

% \niblock{x}{y}{w}{title}{body} -- an accented title bar over a body.
\newcommand\niblock[5]{\nitex@place{#1}{#2}{#3}{%
  {\color{nitexAccent}\bfseries #4}\par\vspace{1mm}#5}}

% \niquote{x}{y}{w}{content} -- italic quotation with an accent rule.
\newcommand\niquote[4]{\nitex@place{#1}{#2}{#3}{%
  {\color{nitexAccent}\rule[-0.2ex]{2pt}{1em}}\hspace{2mm}\itshape #4}}

% \ninumber{x}{y}{w}{number}{label} -- a large stat with a small caption.
\newcommand\ninumber[5]{\nitex@place{#1}{#2}{#3}{%
  {\fontsize{34}{38}\selectfont\bfseries\color{nitexAccent}#4}\\[0.5mm]{\small #5}}}

% \niimage{x}{y}{w}{path} -- a placeholder framed box for now (real \includegraphics
% lands with the asset manager). Shows the path/label, or "Imagem" if empty.
\newcommand\niimage[4]{\nitex@place{#1}{#2}{#3}{%
  \fboxsep=0pt\fbox{\parbox[c][2.4cm][c]{\dimexpr\linewidth-2\fboxrule\relax}{\centering\itshape #4}}}}

% \nimath{x}{y}{w}{content} -- display-style math (inline form is node-safe).
\newcommand\nimath[4]{\nitex@place{#1}{#2}{#3}{\[\displaystyle #4\]}}

\endinput
`;

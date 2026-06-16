/**
 * NiTeX — a Cartesian plane for LaTeX. The language layer of NiTeX Studio.
 *
 * Authoring stays plain `.tex`; NiTeX adds the `\nibox{x}{y}{w}{content}` macro
 * (see `nitex.sty`) for positioned boxes. Coordinates are 0..100 with decimals,
 * origin at the BOTTOM-LEFT of the page, y growing UP, (x,y) = the box's
 * TOP-LEFT corner, w = width as a percentage of the page width.
 */

export const NITEX_STY_FILENAME = 'nitex.sty';

/** The NiTeX macro name (registered with the unified-latex parser by consumers). */
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

/**
 * Source of `nitex.sty`, embedded so consumers (the dev server) can drop it next
 * to a deck's main.tex without resolving a package path. Kept byte-identical to
 * the canonical `nitex.sty` file — guarded by a test.
 */
export const NITEX_STY_SOURCE = String.raw`\NeedsTeXFormat{LaTeX2e}
\ProvidesPackage{nitex}[2026/06/15 NiTeX -- a Cartesian plane for LaTeX]

\RequirePackage{tikz}

% ---------------------------------------------------------------------------
% NiTeX coordinate plane
%   x, y, w are numbers in 0..100 (decimals allowed, e.g. 10.5).
%   Origin (0,0) is the BOTTOM-LEFT of the page; y grows UPWARD (Cartesian).
%   (x, y) addresses the box's TOP-LEFT corner.
%   w is the box width as a percentage of \paperwidth.
%
%   \nibox{x}{y}{w}{content}
% ---------------------------------------------------------------------------
% pgfmath (float) computes #/100*\paper... — dividing first avoids the TeX
% "Dimension too large" overflow you get from \dimexpr (e.g. 92\paperheight).
\newcommand\nibox[4]{%
  \begin{tikzpicture}[remember picture, overlay]%
    \pgfmathsetlengthmacro\nitex@x{#1/100*\paperwidth}%
    \pgfmathsetlengthmacro\nitex@y{#2/100*\paperheight}%
    \pgfmathsetlengthmacro\nitex@w{#3/100*\paperwidth}%
    \node[anchor=north west, inner sep=0pt, outer sep=0pt, text width=\nitex@w]
      at ([xshift=\nitex@x, yshift=\nitex@y]current page.south west)
      {#4};%
  \end{tikzpicture}%
}

\endinput
`;

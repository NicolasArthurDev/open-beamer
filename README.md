# NiTeX Studio

A visual, AI first editor for LaTeX presentations. Build slides with a live PDF preview, drag components into place, and never touch the LaTeX unless you want to.

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](#license)
[![Status: early preview](https://img.shields.io/badge/status-early%20preview-orange.svg)](#roadmap)
[![Made with TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6.svg)](https://www.typescriptlang.org/)
[![Engine: LuaLaTeX](https://img.shields.io/badge/engine-LuaLaTeX-008080.svg)](https://www.luatex.org/)
[![PRs welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](#contributing)

NiTeX Studio keeps the `.tex` file as the single source of truth and edits it through a
typed set of operations. The same operations power the visual editor today and the CLI and
AI agents tomorrow, so a human dragging a box and a model writing a deck speak the exact
same language.

```
+-----------+----------------------------+-------------+
|  slides   |                            |  inspector  |
|  [#] [#]  |          preview           |   title     |
|  [#] <-   |        (live PDF)          |   text      |
|  [#]      |                            |   boxes     |
| filmstrip |                            |  x / y / w  |
+-----------+----------------------------+-------------+
```

## Highlights

- Live PDF preview that recompiles on every edit, with a clear "compiling" state.
- Slide navigator: a thumbnail filmstrip, click to jump, drag to reorder.
- Inspector that follows the visible slide: edit titles, text runs, colors, font sizes.
- Component palette: insert bullets, columns, blocks, quotes, and more as clean LaTeX.
- NiTeX positioned boxes you move with the mouse, or by typing exact coordinates.
- Undo and redo across the whole document (Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z).
- Create a new deck from a starter template in one click.
- The `.tex` stays valid LaTeX the entire time. Open it in any editor, commit it to git.

## NiTeX, the language

NiTeX is a small LaTeX dialect that adds a Cartesian plane on top of Beamer. It is not a new
language with its own compiler. It is plain LaTeX with one extra package, so you keep all of
LaTeX's typesetting, math, and ecosystem.

```latex
\usepackage{nitex}

% \nibox{x}{y}{w}{content}
% x, y, w are 0..100 (decimals allowed). Origin (0,0) is the bottom-left
% of the page and y grows upward. (x, y) is the box top-left corner.
% w is the box width as a percent of the page width.
\nibox{10}{80}{40}{\textbf{Drag me}}
\nibox{55}{45}{40}{Positioned by coordinates}
```

Because the position is explicit and machine readable, NiTeX Studio draws a draggable handle
exactly over each box. No coordinate guessing from the rendered PDF. The same coordinate
works whether you drag it with the mouse, type it in the inspector, or have an AI place it.

## Quick start

Requirements: Node 18+, [pnpm](https://pnpm.io/), and a LaTeX installation that provides
`lualatex` (for example [TeX Live](https://www.tug.org/texlive/)).

```bash
git clone https://github.com/NicolasArthurDev/nitex-studio.git
cd nitex-studio
pnpm install

cd apps/demo
pnpm dev
```

Open http://localhost:5173 and pick a deck, or click "Novo documento" to start a new one.

## How it works

Every change is a typed operation applied to the document's unified-latex AST and reprinted
back to `.tex`. The dev server compiles the result with LuaLaTeX, snapshots the PDF, and
streams it to the browser, which renders it with pdf.js. Page to slide mapping uses SyncTeX,
and positioned boxes use the explicit NiTeX coordinates instead.

| Package | Responsibility |
| --- | --- |
| `@nitex/nitex` | The NiTeX language: `nitex.sty` and the coordinate plane helpers. |
| `@nitex-studio/editing` | The `.tex` editing engine: unified-latex AST plus the shared operation set. |
| `@nitex-studio/engine` | Headless LaTeX compilation with LuaLaTeX. |
| `@nitex-studio/core` | The dev server, Vite plugin, the React app, and the CLI. |

## Project layout

```
packages/
  nitex/      the NiTeX language (nitex.sty + helpers)
  editing/    AST operations on .tex (the shared op set)
  engine/     LuaLaTeX compilation
  core/       dev server, Vite plugin, React app, CLI
apps/
  demo/       a sample workspace with example decks
```

## Roadmap

Shipped:

- Slide navigator with real thumbnails, click to navigate, drag to reorder.
- Shared operation layer with undo and redo.
- Component palette and per slide inspector.
- NiTeX positioned boxes with mouse drag, resize, and numeric coordinates.
- New document scaffolding.

Next:

- AI integration: an MCP server and CLI that expose the operation set as agent tools, plus an
  in app assistant.
- Asset manager for real images.
- Theme editor for colors and fonts.
- A second document type: articles.

## Contributing

This is an early stage project and the internals move fast. Issues and pull requests are
welcome. The repo is a pnpm workspace:

```bash
pnpm install        # install everything
pnpm typecheck      # type check all packages
pnpm test           # run unit tests
pnpm check          # lint and format check (Biome)
```

Feature work happens on branches that open pull requests into `dev`, and `dev` is promoted to
`main` through a pull request.

## License

MIT.

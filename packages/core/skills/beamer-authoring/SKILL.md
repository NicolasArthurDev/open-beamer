---
name: beamer-authoring
description: Technical reference for writing or editing open-beamer decks — the file contract (presentations/<id>/main.tex), a portable default look, frame anatomy, layout/density rules, LaTeX writing rules, charts, and a self-review checklist. Consult this whenever you are about to write or modify any file under presentations/<id>/, including from inside the create-beamer workflow or for any ad-hoc deck edit. Triggers on "edit the deck", "fix this slide", "change the layout", "how do decks work here".
---

# Authoring open-beamer decks

This skill is the **technical reference** for everything inside `presentations/<id>/main.tex`.
It does not own a workflow: `create-beamer` owns "draft a new deck" and delegates the *how*
to this skill. Any ad-hoc edit consults this skill before touching the `.tex`.

The dev server compiles each deck with `@open-beamer/engine` (lualatex/xelatex, 2 passes) and
shows the PDF live. Source of truth is the `.tex` — write idiomatic Beamer that a user could
take to Overleaf unchanged.

## Hard rules

- A deck is `presentations/<kebab-case-id>/main.tex` plus an optional `assets/` next to it
  (images, generated charts). Reference assets with relative paths (`assets/chart.pdf`).
- Do **not** touch `package.json`, `open-beamer.config.ts`, or other decks.
- **Portability first.** The default look below compiles on a standard TeX Live with
  **pdflatex or lualatex** — no `fontspec`, no custom fonts. Only reach for `fontspec` +
  `\setmainfont` (custom typography) when the user confirms a full TeX Live with XeLaTeX or
  LuaLaTeX; otherwise the deck won't compile.
- Keep it to **one `main.tex`** (+ `assets/`). Don't split into sibling `.tex` files.

## Starter template (portable default — copy this)

```latex
\documentclass[aspectratio=169]{beamer}
\usepackage{lmodern}            % clean default fonts (no fontspec needed)
\usepackage[T1]{fontenc}
\usepackage[utf8]{inputenc}     % omit on lualatex/xelatex; harmless on pdflatex
\usepackage{booktabs}
\usepackage{tikz}
\usetikzlibrary{calc}

% --- Look: minimal, one accent color, no clutter -------------------------
\definecolor{obAccent}{HTML}{1A365D}
\definecolor{obInk}{HTML}{1A1F2B}
\usecolortheme{default}
\setbeamertemplate{navigation symbols}{}
\setbeamercolor{frametitle}{fg=obAccent}
\setbeamercolor{title}{fg=obAccent}
\setbeamercolor{structure}{fg=obAccent}
\setbeamerfont{frametitle}{series=\bfseries}
\setbeamertemplate{frametitle}{%
  \vspace{4mm}\insertframetitle\par
  {\color{obAccent}\rule{\textwidth}{1pt}}%
}

\title{Deck title}
\subtitle{Optional subtitle}
\author{Author}
\date{2026}

\begin{document}

\begin{frame}[plain]
  \titlepage
\end{frame}

\begin{frame}{Agenda}
  \begin{itemize}
    \item First topic
    \item Second topic
    \item Third topic
  \end{itemize}
\end{frame}

% ... content frames ...

\begin{frame}[plain]
  \centering
  \vfill
  {\Huge\color{obAccent}\textbf{Thank you}}\par\vspace{4mm}
  {\large author@example.com}
  \vfill
\end{frame}

\end{document}
```

## Outline → Beamer mapping

| In the outline | In LaTeX |
|---|---|
| Cover | `\begin{frame}[plain]\titlepage\end{frame}` |
| Section divider | `\section{Title}` + a `[plain]` frame with a big `\Huge` label |
| Content slide | `\begin{frame}{Title}` … `\end{frame}` |
| Bullets | `itemize` / `enumerate` (keep each bullet to one line) |
| Two-column | `\begin{columns}[T,onlytextwidth] \column{0.58\textwidth} … \column{0.38\textwidth} … \end{columns}` |
| Callout / takeaway | `\begin{block}{Label}…\end{block}` or `\alert{...}` for one key phrase |
| Big number / stat | a `[plain]` frame, `\Huge` number + small label, centered |
| Table | `booktabs` (`\toprule`/`\midrule`/`\bottomrule`); header row in `obAccent` |
| Chart | `pgfplots` (see Charts); or `\includegraphics{assets/<file>.pdf}` |
| Absolute accent / overlay | `\begin{tikzpicture}[remember picture,overlay] … \end{tikzpicture}` (forces a 2nd pass — the engine already runs 2) |
| Quote | `\begin{quote}…\end{quote}` + attribution |
| Image | `\includegraphics[width=...]{assets/<file>}` inside a `figure`/`center` |

## Layout & density rules

- **Fill the slide.** The content area should be ≥~70% used. A slide with an empty lower
  half is a defect — merge slides or enrich with data, an example, or a visual.
- **Vary the composition.** Two consecutive content slides never use the same layout.
  Rotate: 60/40 split, 40/60 split, 2×2, full-width table with a side note, chart +
  implications, two-column text with numbered highlights.
- **Cards in moderation.** Three centered boxes is the most overused layout there is — at
  most one such slide per ~4 content slides, and only for genuinely parallel ideas.
- **Grid & margins.** Use `\begin{columns}[T,onlytextwidth]`; column widths sum to ~1.0 with
  even gutters (e.g. 0.58+0.38, or 0.31×3). Nothing glued to the edges.
- **Consistent typography.** Never hand-set `\fontsize` per slide. Let beamer size things;
  the same role (title, body, caption) has the same size across the whole deck.
- **One accent color** for the whole deck (`obAccent`). Don't introduce a second.

## LaTeX writing rules

- Escape `& % $ # _` coming from prose (`\&`, `\%`, `\$`, `\#`, `\_`).
- **No long em-dash** (—) anywhere. Use a comma, colon, parentheses, or a numeric en-dash
  (`--`, e.g. "weeks 1--2"). Grep the `.tex` before compiling.
- Correct spelling and accents in the deck's language.
- Prefer real content over filler. Don't invent data; if a number isn't given, omit it.

## Charts (preference order)

1. **pgfplots / TikZ** — best quality, same fonts as the deck.
   `\usepackage{pgfplots}\pgfplotsset{compat=1.18}`; bars: `ybar, bar width=6pt`.
2. **matplotlib** for heavy/complex data: save a PDF into `assets/`, include with
   `\includegraphics`. Flat style (no 3D, shadows, or gradients).
3. **Hand-drawn TikZ** for simple flow diagrams (rectangular nodes + arrows).

## Self-review before finishing

- [ ] Compiles cleanly (check the dev server's error panel / the compile log).
- [ ] Every content slide is ≥~70% filled; no empty lower halves.
- [ ] No two consecutive slides share a layout.
- [ ] At most one "three cards" slide per ~4 content slides.
- [ ] No em-dash; special characters escaped.
- [ ] One accent color; no manual `\fontsize`.
- [ ] Default look only (no `fontspec`) unless the user confirmed full TeX Live + XeLaTeX/LuaLaTeX.
- [ ] Title + a closing/contact slide present.

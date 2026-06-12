// The feature ladder: each rung adds one risk on top of the previous. The highest rung
// that compiles in-browser tells us how close the WASM (zero-install) path is for real decks.
// Rungs 1-3 are self-contained (free assets). Rung 4 (amclean) needs proprietary local
// assets and is intentionally left for a manual, local-only run — see README.

export const RUNGS = [
  {
    name: '1-plain-beamer',
    input: String.raw`\documentclass[aspectratio=169]{beamer}
\begin{document}
\begin{frame}\frametitle{Plain}Hello beamer.\end{frame}
\end{document}`,
    rerun: false,
  },
  {
    name: '2-fontspec',
    input: String.raw`\documentclass[aspectratio=169]{beamer}
\usepackage{fontspec}
\setmainfont{Latin Modern Roman}
\setsansfont{Latin Modern Sans}
\begin{document}
\begin{frame}\frametitle{Fontspec}Texto via fontspec.\end{frame}
\end{document}`,
    rerun: false,
  },
  {
    name: '3-tikz-overlay-2pass',
    input: String.raw`\documentclass[aspectratio=169]{beamer}
\usepackage{tikz}
\usetikzlibrary{calc}
\definecolor{obAccent}{HTML}{1A365D}
\begin{document}
\begin{frame}\frametitle{Overlay}
\begin{tikzpicture}[remember picture, overlay]
\fill[obAccent] ($(current page.north west)+(0,-1.2cm)$) rectangle ($(current page.north east)+(0,-1.35cm)$);
\end{tikzpicture}
Conteudo com overlay absoluto (forca 2 passadas).
\end{frame}
\end{document}`,
    rerun: true,
  },
];

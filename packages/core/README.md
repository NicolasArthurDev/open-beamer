# @open-beamer/core

Dev server and live PDF preview for [open-beamer](https://github.com/NicolasArthurDev/open-beamer).

Watches `presentations/<id>/main.tex`, compiles each deck to PDF with
[`@open-beamer/engine`](../engine), and serves a web app that renders the PDF
(PDF.js) with page navigation, a fullscreen present mode, hot-reload on save, and
compile-error surfacing.

```bash
open-beamer dev
```

Configured via `open-beamer.config.ts` in the workspace root:

```ts
import type { OpenBeamerConfig } from '@open-beamer/core';

export default {
  presentationsDir: 'presentations', // default
  port: 5173, // default
  engine: 'lualatex', // or 'xelatex'
} satisfies OpenBeamerConfig;
```

# WASM compile spike (non-blocking)

Answers one question for the roadmap: **how far does an in-browser WASM LaTeX engine
compile the open-beamer feature ladder?** This dates the "zero-install" phase. It does not
gate Phase 0 — the local engine (`@open-beamer/engine`) is what the MVP uses.

## Engine choice

`texlyre-busytex` (BusyTeX), **not** raw SwiftLaTeX:

- Actively maintained, **TeX Live 2026**, supports **pdfLaTeX / XeLaTeX / LuaLaTeX**.
- LuaLaTeX in-browser → the engine `amclean` actually targets.
- **Generates SyncTeX** → keeps Phase 3 (click-to-source) viable even on the WASM path.
- npm-installable; raw SwiftLaTeX ships no prebuilt npm engine and is barely maintained.
- ⚠️ **AGPL-3.0** — kept isolated in this folder, never imported by the published packages.
  A bundling/hosting decision is required before the WASM phase ships publicly.

## Run it

```bash
cd spike/wasm
npm install
npm run setup     # downloads ~175MB WASM assets (GitHub Releases) + chromium
npm run ladder    # headless run → writes FINDINGS.md
```

The ladder (`ladder.mjs`):
1. plain beamer
2. beamer + fontspec + Latin Modern
3. beamer + TikZ overlay `remember picture`/`calc`, 2 passes
4. *(manual, local-only)* full `amclean` — needs the proprietary fonts/logos/covers loaded
   as `additionalFiles`; not bundled here. Add them locally to test the worst case.

## Status

Harness is written but **not yet executed** (the 175MB asset download + browser install was
deferred — it's non-blocking and the blocking gates already passed). Run the commands above
on a networked machine to populate `FINDINGS.md`.

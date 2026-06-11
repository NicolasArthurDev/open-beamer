# Fase 0 — Relatório de gate

**Veredito: gates bloqueantes 1 e 2 PASSARAM → seguir para a Fase 1 (local-first).**
O gate 3 (WASM) é informativo e não trava a decisão.

## Gate 1 — compilação local (BLOQUEANTE) ✅

A fixture pública **core** (`packages/engine/fixtures/sample/`) — beamer + TikZ overlay com
`remember picture`/`calc` + 2 passadas — compila a PDF via `lualatex` (`@open-beamer/engine`,
`compile()`). O teste `engine.test.ts` é verde.

Isso prova a parte genuinamente nova/arriscada do pipeline: posicionamento absoluto por
overlay, a 2ª passada que o `remember picture` força, e saída de PDF real — tudo local.

**Ressalva de ambiente (não é falha de arquitetura):** este sandbox tem `lualatex` mas
**não tem `luaotfload`** (pacote `texlive-luatex`) nem `xelatex`, então **fontspec não
carrega fonte nenhuma aqui**. Por isso:
- a fixture core deliberadamente não usa fontspec (compila em qualquer TeX Live);
- existe uma fixture `fontspec/` separada + teste que **roda só onde o luaotfload existir**
  (pulado aqui, com mensagem). Numa TeX Live completa (máquina do usuário / CI) ela cobre o
  caminho fontspec que o `amclean` exige.
- **Ação para Fase 1:** documentar/instalar a TeX Live completa (`texlive-luatex`,
  `texlive-xetex`, `fontspec`, `tikz`, `tcolorbox`, `pgfplots`) no ambiente alvo.

## Gate 2 — edição programática round-trip (BLOQUEANTE) ✅

`@open-beamer/editing` (unified-latex 1.8.4): `parseTex` → `setFrameTitle` + `wrapInColor`
(`\textcolor`) → `printTex` → recompila com sucesso. `editing.test.ts` verde (round-trip
puro + recompilação do `.tex` editado).

Aprendizados de API que orientam a Fase 2:
- O **nome do macro fica em `node.content`** (string), não `node.name`. String node também
  usa `content`. (Ler os tipos reais evitou um erro de implementação.)
- unified-latex só anexa argumentos a macros cujas assinaturas conhece → usamos
  `getParser({ macros: { frametitle: { signature: 'm' }, ... } })`.
- Round-trip preserva a estrutura; pequenas variações de formatação são aceitáveis. Se a
  fidelidade byte-a-byte virar requisito, a alternativa é editar por *splice de posição*
  (usar `node.position` no source) em vez de reimprimir o AST inteiro. **Anotado para a Fase 2.**

## Gate 3 — escada WASM (INFORMATIVO) — EXECUTADO

Engine: **`texlyre-busytex`** (BusyTeX, TeX Live 2026, AGPL-3.0), driver `luahbtex_bibtex8`,
LuaLaTeX no browser, headless via Playwright. Resultado real (`spike/wasm/FINDINGS.md`):

| Degrau | Compilou | SyncTeX |
|---|---|---|
| 1 · plain beamer | ❌ (quirk de init, ver nota) | — |
| 2 · beamer + fontspec + Latin Modern | ✅ (7024 B) | sim |
| 3 · beamer + TikZ overlay `remember picture` + 2 passadas | ✅ (7725 B) | sim |

**Conclusão (surpreendentemente positiva):** o WASM compilou **fontspec + Latin Modern OTF**
e **TikZ overlay absoluto + 2 passadas**, os dois **gerando SyncTeX** — exatamente as features
que o `amclean` exige e que o sandbox local **não** consegue (fontspec quebrado aqui). O
degrau 1 falhou por um quirk intermitente de init do BusyTeX (`kpathsea /bin/busytex`), não
por falta de capacidade (os degraus mais difíceis passam); precisa só de retry em volta do init.

Detalhes operacionais: assets reais = **~480MB** (não 175MB como o README do pacote dizia);
build **combined** (`busytex.wasm` único, não engines separados); catálogos `texlive-*.js`
como `catalogDataPackages`.

**Impacto no roadmap:** o caminho zero-install é **mais viável do que o previsto** (lualatex
+ fontspec + tikz + SyncTeX, tudo em WASM). Mesmo assim, a Fase 1 segue **local-first**; o
WASM vira uma fase mais cedo no roadmap do que se cogitava. Decisão de licença AGPL continua
pendente antes de publicar a fase WASM.

## Notas de ambiente
- `pnpm` instalado em `~/.local/bin` (corepack falhou por falta de permissão de symlink global).
- Engines LaTeX locais: `lualatex` ✅, `pdflatex` ✅, `xelatex` ❌, `luaotfload` ❌.
- Verificação: `pnpm install && pnpm test && pnpm check && pnpm typecheck` — tudo verde
  (4 testes passam, 2 pulados: fontspec e no-engine).

## Recomendação para a Fase 1
1. Garantir TeX Live completa no ambiente alvo (destrava fontspec → valida `amclean`).
2. Construir o dev server: watch `.tex` → `@open-beamer/engine` → servir PDF (PDF.js) + hot reload.
3. Portar o scaffolder do CLI e a skill `/create-beamer` (dobrar o pipeline do `apresentacao-latex-am`).
4. Manter `.tex` como fonte da verdade; `@open-beamer/editing` é a semente do edit-loop da Fase 2.

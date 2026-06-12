# open-beamer — Arquitetura & Plano de MVP Faseado

> Framework de apresentações **LaTeX/Beamer dirigido por IA**, com edição visual pelo
> frontend. O "open-slide para LaTeX": a IA escreve um Beamer de verdade, você edita
> visualmente, e a saída continua sendo `.tex` idiomático que é seu.

## 1. Princípio de arquitetura (a decisão que define tudo)

**O `.tex` é a fonte da verdade** — exatamente como o React é no open-slide. Não há
camada JSON intermediária que vira dono do conteúdo. Isso evita a armadilha de virar
"PowerPoint que exporta LaTeX" (posicionamento absoluto via `textpos`, perda do motor
de layout do Beamer, e o buraco do `raw_tex` onde o editor visual deixa de funcionar).

Consequências:
- Edições (visuais ou da IA) são aplicadas **ao próprio `.tex`** via manipulação de AST
  (`unified-latex`), não via regex e não via round-trip de JSON.
- Design tokens (paleta, fontes, type scale) ficam num **sidecar** (`design.yaml`) que o
  preâmbulo lê. O painel de estilo edita o sidecar e nunca precisa reescrever as
  entranhas do preâmbulo.
- O preview é o **PDF compilado de verdade** (sem aproximação HTML que mente). Feedback
  não é 0ms; é o tempo de recompilar (~1-3s deck inteiro; menos no modo "frame atual").

### Diagrama

```
[ Prompt do usuário / clique no preview ]
                 │
                 ▼
   ┌──────────────────────────┐
   │  Frontend web (PDF.js)    │  preview = PDF real; chrome = sidebar, style panel,
   │                           │  comment widget, present mode
   └──────────────────────────┘
                 │  HTTP (/__edit, /__comments, /__design, /__frames)
                 ▼
   ┌──────────────────────────┐
   │  Dev server (core)        │  watch .tex → compila → serve PDF + app
   └──────────────────────────┘
            │              │
   parse/edita AST     compila
            ▼              ▼
   ┌────────────────┐  ┌─────────────────────────────┐
   │ unified-latex  │  │ Engine LaTeX                 │
   │ (edit-ops)     │  │  • WASM (SwiftLaTeX) default │ → .pdf  (+ .synctex.gz)
   │  .tex ← fonte  │  │  • XeLaTeX local (opt-in)    │
   └────────────────┘  └─────────────────────────────┘
```

## 2. Decisões técnicas

| Tema | Decisão | Porquê |
|---|---|---|
| Fonte da verdade | `.tex` idiomático + `design.yaml` sidecar | Usuário é dono; não perde o poder do Beamer |
| Edição de código | AST via `unified-latex` | Robusto; nada de regex frágil |
| Engine padrão | **SwiftLaTeX (WASM)** | Zero-install ("inicia fácil") |
| Engine opt-in | **XeLaTeX local** (auto-detect) | Pacotes completos, fontspec, velocidade, casa com `amclean` |
| Granularidade de compile | Deck inteiro + modo "frame atual" | Velocidade no loop de edição |
| Inspector (MVP) | Selecionar pela outline + comentar | Adia a peça mais arriscada (SyncTeX) |
| Inspector (depois) | Clique no PDF → SyncTeX → AST | "Sensação" de editor visual real |
| Drag absoluto por pixel | **Fora de escopo** | Mata o motor de layout do Beamer |
| Edição visual | Operações **semânticas** (texto, cor, tamanho, negrito, trocar layout, reordenar) | Honra o Beamer e ainda assim é visual |

## 3. O que reaproveitar do open-slide

Veredito: **não forkar o monorepo inteiro.** O coração (edição de código-fonte) e o
frontend — que são o grosso — precisam ser reescritos, e arrastar as suposições
React/JSX seria lastro. Em vez disso: **começar com o mesmo esqueleto** (layout pnpm +
Turbo + Biome, convenções) e **copiar módulos específicos** como ponto de partida.

| Subsistema do open-slide | Ação | Esforço de port |
|---|---|---|
| CLI / scaffolder (`packages/cli`) | **Copiar**, trocar template | Baixo (~25%) |
| Rotas HTTP (`vite/routes/*`) | **Copiar** quase 1:1 (são file-system, não DOM) | Muito baixo (~10%) |
| `src/files`, `src/locale` | **Copiar** (scan de dir + i18n agnósticos) | Muito baixo (~10%) |
| Modelo de design tokens (`lib/design.ts`) | **Adaptar** (tokens → `\definecolor`/`\setbeamerfont`) | Médio (~45%) |
| Skills de IA (estrutura/workflow) | **Adaptar** conceitos (exemplos viram LaTeX) | Médio (~55%) |
| Present mode (navegação, atalhos) | **Adaptar** lógica; UI nova | Alto (~65%) |
| `editing/edit-ops.ts` (Babel/JSX) | **Reescrever** com unified-latex | 100% (novo) |
| Inspector (React Fiber + DOM overlay) | **Reescrever** (PDF não tem DOM) | 100% (novo) |
| App shell / rotas React | **Reescrever** UI; manter estrutura de router | 100% (novo) |

**O foco é o motor de gerar apresentações, não o `amclean`.** O diferencial do produto é
o pipeline roteiro → avaliar → codar-latex → avaliar-pdf (QA via `pdftoppm`) — IA que
escreve Beamer de verdade e se auto-repara — acoplado ao loop de preview/edição ao vivo.
O `amclean` é apenas **um** tema embutido (e um ótimo case de validação do motor), não o
produto; é trocável e qualquer tema deve funcionar igual.

**Atalho enorme já existente:** o plugin `apresentacao-latex-am` já entrega esse motor
(o pipeline acima). Isso **é** a geração da Fase 1 + a QA loop. Metade do produto já está
validada — falta a camada de preview/edição em cima.

## 4. Pacotes

```
open-beamer/  (monorepo pnpm + turbo + biome)
├─ packages/
│  ├─ cli/        @open-beamer/cli      — `npx @open-beamer/cli init` (port)
│  ├─ core/       @open-beamer/core     — dev server, web app, present mode, CLI
│  ├─ editing/    @open-beamer/editing  — unified-latex: parse + edit-ops + comments
│  └─ engine/     @open-beamer/engine   — abstração de compile (WASM | XeLaTeX local)
├─ apps/
│  ├─ demo/                             — workspace de dogfood
│  └─ web/                              — site/docs
└─ skills (em template do CLI):  /create-beamer, /beamer-authoring,
                                 /apply-comments, /create-theme
```

## 5. Plano faseado

### Fase 0 — Spike de de-risk (antes de construir o framework)
Provar os dois desconhecidos assustadores end-to-end:
1. Compilar um Beamer com **SwiftLaTeX WASM** no browser e renderizar com PDF.js.
   **Confirmar XeLaTeX + fontspec + Arial Nova `.ttf`** (o que o `amclean` exige).
2. Parsear um `.tex` Beamer real com **unified-latex**, fazer 1 round-trip de edição
   (trocar título de frame; trocar uma cor), reimprimir, recompilar — confirmar que é
   estável e o `.tex` continua idiomático.

**Gate:** se o WASM não der conta do `amclean`/XeLaTeX, pivota para "XeLaTeX local
primeiro" (continua ótimo; só muda a história de onboarding). **Esta fase decide isso.**

### Fase 1 — Gerar + Preview (o MVP "funciona")
- Scaffolder do CLI (port).
- Dev server: watch `.tex` → compila → serve PDF no viewer (PDF.js) com hot reload.
- Sidebar com outline (deck/frames) + navegação + present mode (PDF fullscreen).
- Skill `/create-beamer`: do prompt, a IA escreve o projeto `.tex` (dobra o pipeline
  roteiro→codar do plugin atual).
- Surfacing de erro de compilação (parsear o log do LaTeX, mostrar na UI).
- **Resultado:** "descreve um deck → IA escreve Beamer → vê o PDF ao vivo → apresenta."
  Só isso já bate o Overleaf na história de geração-por-IA + apresentação.

### Fase 2 — Loop de edição (o diferencial)
- Engine de edição (`unified-latex`): set-text, set-frame-title, negrito/itálico/cor/
  tamanho na seleção, reordenar/duplicar/deletar frames.
- Rotas HTTP de edição (port).
- Sistema de marcadores `@beamer-comment` + skill `/apply-comments` (port do conceito).
- Inspector v1: selecionar elemento pela outline → comentar ou editar rápido (sem
  clique no PDF ainda).
- Painel de estilo: design tokens (paleta/fontes/type scale) → `design.yaml` → recompila.
- **Resultado:** apresenta → comenta → `/apply-comments` → repete. O loop do open-slide,
  em cima de LaTeX.

### Fase 3 — Clique-pra-fonte (sensação de WYSIWYG completo)
- Ligar **SyncTeX**: compilar com `-synctex=1`, parsear `.synctex.gz`, mapear coords do
  clique no PDF.js → linha:col do fonte → nó do AST.
- Inspector v2: clica no elemento do preview → localiza fonte → comenta/edita inline.
  É o momento "parece editor visual de verdade".
- Overlay otimista para feedback instantâneo (transform CSS na região do PDF enquanto
  recompila por baixo).

### Fase 4 — Polish / ecossistema
- Export (PDF é nativo; + share self-contained).
- Sistema de temas + `/create-theme` + galeria (com `amclean` embutido).
- Gerenciador de assets, fontes.
- Dual-engine (WASM + local) endurecido, cache de pacotes CTAN.
- Presenter mode (2ª tela, notas, timer) — port dos conceitos.

## 6. Riscos & mitigação

| Risco | Mitigação |
|---|---|
| WASM não aguenta XeLaTeX/fontspec do `amclean` | Fase 0 testa cedo; fallback XeLaTeX local |
| Gap de fidelidade (PDF não é 0ms) | Recompile real + modo frame-atual + overlay otimista; sem aproximação HTML |
| LaTeX gerado por IA quebra a compilação | Loop robusto de captura-de-erro + auto-reparo (já existe no `avaliar-pdf`) |
| Conteúdo rico (TikZ/mat. complexa) não é editável visualmente | Posicionar com honestidade: visual p/ polimento, IA/código p/ estrutura |
| SyncTeX↔PDF.js é custom | Isolado na Fase 3; Fases 1-2 não dependem dele |
| Público errado (puristas de Beamer rejeitam WYSIWYG) | Mirar o "refugiado do PowerPoint" que quer saída LaTeX sem a dor |

## 7. Referências
- SwiftLaTeX (WASM XeTeX/pdfTeX): https://github.com/SwiftLaTeX/SwiftLaTeX
- TeXlyre (WASM multi-engine no browser): https://texlyre.github.io/
- unified-latex (AST de LaTeX em TS): https://github.com/siefkenj/unified-latex
- latex-utensils (parser alternativo): https://github.com/tamuratak/latex-utensils
- SyncTeX (forward/inverse search): https://www.gnu.org/software/auctex/manual/auctex/I_002fO-Correlation.html
</content>
</invoke>

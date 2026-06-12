---
name: create-beamer
description: Use this skill when the user wants to create, draft, author, or generate a new Beamer/LaTeX presentation in an open-beamer workspace. Triggers on "make a beamer deck about X", "create a LaTeX presentation", "draft slides for", "new deck", or when the user sends raw content asking it to become a presentation. You only write files under presentations/<id>/. Do NOT use for editing the framework itself.
---

# Create a deck in open-beamer

This skill owns the **workflow** for drafting a new Beamer deck. The technical reference —
file contract, the portable default look, the outline→Beamer mapping, layout/density rules,
and the self-review checklist — lives in the **`beamer-authoring`** skill. Read it before you
write any `.tex`.

A deck is never generated in one shot. The loop is **outline → write → compile → visual QA**,
so each layer is validated before the next. You only write files under `presentations/<id>/`.

## Step 1 — Gather scope (ask before writing)

Use `AskUserQuestion`, skipping anything the user already stated. Lock in:

1. **Type** — talk/lecture, pitch/proposal, report, or teaching material.
2. **Audience** — who watches, and how familiar they are with the topic.
3. **Goal** — what the audience should think or do by the end.
4. **Length** — slide count (brief 5–7, standard 8–12, deep dive 13–20) or speaking time.
5. **Raw content** — the texts, data, or links to build from.
6. **Research?** — if the user authorizes it, scope what to look up (only with real sources;
   never invent data).

If the request is thin ("make me a deck"), ask topic + audience first in a separate call.
The outline's language follows the user's content.

## Step 2 — Research (only when authorized)

Use web search/fetch, cite sources, never fabricate figures. Skip entirely otherwise.

## Step 3 — Pick a deck id

kebab-case, short, descriptive (`rust-intro`, `q2-roadmap`). Check `presentations/` for collisions.

## Step 4 — Write the outline first

Write `presentations/<id>/outline.md` before any `.tex`:

```markdown
# Outline: <title>

- Type / Audience / Goal / Language / Estimated slides

## Slide 1 — <title in sentence case>
- Takeaway: one complete sentence stating the conclusion
- Content: block A (bullets/data/example), block B (...)
- Layout: concrete composition (e.g. "60/40: comparison table left, 2 stats stacked right")
- Source: ... (or omit)

## Slide 2 — ...
```

Apply the density & variety rules from `beamer-authoring`: every content slide has ≥2 blocks
or one substantial visual; no two consecutive slides repeat a layout; takeaways conclude.

## Step 5 — Write `presentations/<id>/main.tex`

Read **`beamer-authoring`** and copy its starter template. Map each outline slide via the
outline→Beamer table. Stay on the portable default look (no `fontspec`) unless the user
confirmed a full TeX Live with XeLaTeX/LuaLaTeX.

## Step 6 — Compile and visual QA

The dev server compiles on save and surfaces errors. If it isn't running, the user starts it
with `pnpm dev`. Fix every compile error (read the log: search for lines starting with `!`).
Then **look at the rendered PDF** and check, per slide: overflow off the frame, collisions,
alignment, contrast, and density (no half-empty slides). Apply fixes to the `.tex` and let it
recompile. Loop until clean — don't hand off a deck you haven't looked at.

## Step 7 — Self-review

Run the checklist in `beamer-authoring` ("Self-review before finishing").

## Step 8 — Hand off

Tell the user:

- The deck id and path (`presentations/<id>/main.tex`).
- That the dev server hot-reloads — open `http://localhost:5173/d/<id>` (or refresh the home).
- If dev isn't running: `pnpm dev` from the workspace root.

Don't start the dev server yourself unless asked.

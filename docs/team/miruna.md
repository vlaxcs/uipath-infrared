# Miruna: brand, design, pitch

Your lane: how Infrared looks and how it is told. The palette, mascot and logo, the design tokens every screen uses, the dashboard screens Robi builds, the product page, the pitch and the video.

Time: `H+0` is the commit that added this file. Feature freeze at `H+8`; the pitch and the video continue after it.

Read first: `docs/prd.md`; `docs/spec.md` sections 2, 4 and 9.

## You own

`design/` (the shared tokens) and `apps/site/`.

## Order

| # | Task | Spec | Size | Done when |
|---|---|---|---|---|
| 1 | Palette, mascot, logo | | M | Vlad approves |
| 2 | Tokens: colours (light and dark), type, spacing, radii as CSS variables in `design/tokens.css` | 4 | S | Robi builds the dashboard on them |
| 3 | Dashboard screens: run view, graph, candidates, approvals | 5 | M | Robi builds from them |
| 4 | Product page: retheme `apps/site` as Infrared and replace the old product's content and assets | 2 | M | nothing from the earlier product remains; only tokens used |
| 5 | Pitch pages in `apps/site`: content from the PRD, screenshots, each rubric criterion covered | 9 | M | a live URL |
| 6 | Video: screen recordings, Rive animations, AI voiceover, the sound library | 9 | L | a finished cut |

## What you hand over

| To | What | By |
|---|---|---|
| Robi | `design/tokens.css` | `H+2` |
| Robi | the dashboard screens | `H+3` |
| Vlad | the product page live | `H+6` |
| Vlad | the pitch pages and the video | `H+10` |

## What you expect

| From | What | By | If late |
|---|---|---|---|
| Vlad | approval on palette, mascot, logo | `H+1` | go ahead with your first proposal |
| Robi | screenshots of every view | `H+8` | screenshots from your own screens |

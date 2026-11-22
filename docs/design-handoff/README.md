# Yutani OS redesign: design handoff

A full visual redesign of Yutani OS (the EVE Online character dashboard), designed page by page with the owner on 22 Nov 2026. This folder is the handoff for implementing it in this repo. It sits beside `docs/design-package/`, which holds the previous (amber console) design that this replaces.

**Brief:** clean, modern, dark, easy to read; a restrained Blade Runner / Prometheus "computer system" feel, kept simple.

## What is in this folder

| File | What it is |
|---|---|
| `README.md` | This file: scope, how to use the package, build order |
| `DESIGN_SYSTEM.md` | Colour, type, spacing, and every reusable component |
| `PAGES.md` | Page-by-page spec for desktop and mobile, with what changed from the current site |
| `DATA_AND_OPEN_ITEMS.md` | New data the build needs, placeholders to replace, and decisions still open |
| `REPO_MAPPING.md` | How each design page maps onto this repo's routes, components and data code |
| `CLAUDE_CODE_PROMPT.md` | A ready-to-paste starting prompt for Claude Code |
| `tokens.css` | Design tokens as CSS custom properties, plus the block and bar primitives |
| `artboards/desktop/*.dc.html` | The seven desktop artboards (source markup, inline styles, sample data) |
| `artboards/mobile/*.dc.html` | The seven mobile artboards (390px wide) |
| `artboards/canvas.json` | Canvas index listing the artboards |

Live design canvas (private to the owner): https://claude.ai/artifact/YJxmX7Z8uE5RDgkszHNWFH

## How to read the artboards

The `.dc.html` files are design-canvas components, not pages you can open directly in a browser. They are still the most precise reference in this package:

- **Markup and styles:** everything inside `<x-dc>` is plain HTML with inline styles. Copy exact values (padding, font sizes, colours) from there; do not round them.
- **`{{holes}}`** are data bindings. `<sc-for list="{{x}}" as="y">` repeats, `<sc-if value="{{x}}">` is a conditional.
- **Logic:** the `<script type="text/x-dc">` block at the bottom holds the sample data and view logic in a `renderVals()` method. It shows how every displayed value is derived (grouping, sorting, limits, percentages).
- **Sample data** is real data from the live site for the character TrilliumONE, captured 22 Nov 2026, except where `DATA_AND_OPEN_ITEMS.md` says otherwise. Wallet figures were replaced with sample values for this public repo.

## Scope

**Pages designed (desktop and mobile):**
1. Overview
2. Skills, with three tabs: Overview (default), Skills, Training
3. Clones
4. Ships (fitted ships and saved fits)
5. Ship detail
6. Assets
7. Wallet (journal and transactions)

**Removed from the navigation by the owner:** Fitting and Combat. See `DATA_AND_OPEN_ITEMS.md` for what that leaves unresolved.

## Suggested build order

1. Read `REPO_MAPPING.md`. Then bring `tokens.css` into `src/app/globals.css`, update `fonts.ts`, and rebuild the shared shell: header, nav, status strip, page container (desktop and mobile nav).
2. Build the shared components from `DESIGN_SYSTEM.md`: level blocks, segmented bar, stat strip, card, collapsible row, tabs, character dropdown, info button with inline panel, tags.
3. Overview, then Skills (three tabs), since Skills exercises most components.
4. Clones, Assets, Wallet.
5. Ships, then Ship detail, which carry the most new calculation work.
6. Replace placeholders and example data per `DATA_AND_OPEN_ITEMS.md`.

## Ground rules for implementation

- Fit the design into the existing stack: Next.js App Router pages under `src/app/`, the single stylesheet `src/app/globals.css`, view models in `src/lib/view/`. Do not introduce a new framework or styling library.
- Keep all existing functionality unless a page spec says it was removed.
- Where the design shows example or estimated data, wire the real calculation or leave it clearly marked; never ship the example values.
- Every colour meaning is also carried by text or a sign, never colour alone. Keep it that way.

# EVE Plasma — design package

## Purpose

This is a standalone, static snapshot of EVE Plasma's nine key screens, built from the app's real
JSX markup and real CSS class names, with no Next.js, no database, and no JavaScript required to
render. It exists so the visual design (the "Midnight" system) can be iterated on in an external
tool — paste a screen into claude.ai or any other design assistant, edit `css/globals.css` and/or
the screen markup, and hand the result back. Because the class names and DOM structure mirror the
real components 1:1, those edits diff cleanly against the committed baseline and port straight back
into `src/app/**` without needing to be "translated."

## The Midnight system

### Design tokens

Every colour in the app is a CSS custom property declared once on `:root` in `globals.css`. Nothing
in the component CSS uses a raw hex value — **tokens only, no inline colours**. If you need a new
colour, add a token and reference it; don't hardcode a hex or rgba() in a rule.

| Token | Value | Role |
|---|---|---|
| `--bg` | `#070d1c` | Page background |
| `--bg-2` | `#0a1326` | Secondary background (unused directly by name in v1, reserved) |
| `--card` | `#0e1830` | Card / panel surface |
| `--raised` | `#13203a` | Raised surface — inputs, pills, hover backgrounds |
| `--border` | `#1d2c4a` | Default border |
| `--border-hi` | `#2c4068` | Emphasised border (hover, focus-adjacent) |
| `--divider` | `#27406a` | Thin structural dividers (avatar rings, header divider) |
| `--hairline` | `#16233e` | Very faint row/section separators |
| `--text` | `#e9f0ff` | Primary text |
| `--text-2` | `#dfe7f5` | Secondary text (reserved; body copy mostly uses `--text`) |
| `--muted` | `#8aa0c6` | De-emphasised text |
| `--faint` | `#76849f` | Lowest-emphasis text (labels, captions, "not synced yet") |
| `--dim` | `#5b6b86` | Dimmest text / inactive indicators |
| `--accent` | `#4d8dff` | Brand accent — links, active nav, primary actions |
| `--accent-2` | `#5eb0ff` | Secondary accent — charge names, meta badges |
| `--pos` | `#34d399` | Positive / success (green) |
| `--neg` | `#f76d7a` | Negative / error / loss (red) |
| `--warn` | `#f2b03d` | Warning (amber) |
| `--aurora` | gradient (`#a5b4fc → #4d8dff → #22d3ee → #5eead4 → #4d8dff → #a5b4fc`) | Animated wordmark gradient |
| `--col` | `1123px` | Max content column width (header bar, main, footer) |

### Fonts

Three families, set as CSS variables and consumed the same way throughout `globals.css`:

- **Inter** (`--font-inter`) — body text, default `font-family` on `<body>`.
- **Poppins**, weights 500/600/700 (`--font-poppins`) — headings, card titles, stat values, page
  titles: anything that reads as a "number" or a heading.
- **Space Grotesk**, weights 500/600/700 (`--font-grotesk`) — the "Plasma" wordmark only.

In the real app these are loaded via `next/font/google` in `src/app/fonts.ts`, which **self-hosts**
the font files at build time (downloaded once, served from the app's own origin, no runtime call to
Google) and exposes them as `--font-inter` / `--font-poppins` / `--font-grotesk` on the `<html>`
element's `className`. This package can't do that without a build step, so `css/fonts.css`
substitutes a Google Fonts CDN `@import` for the same three families/weights and re-declares the
same three custom properties — `globals.css` itself is untouched and doesn't know the difference.

### Spacing & radius conventions

- Cards: `border-radius: 14px`, `padding: 24px`, `background: var(--card)`, `border: 1px solid var(--border)`.
- Smaller controls (inputs, pills, badges, gauges): `border-radius: 6–10px`, or `99px` for fully
  round pills/badges/progress bars.
- Grids (`.card-grid`, `.card-stack`) use `gap: 20px` by default; tighter internal lists
  (`.entry-list`, `.value-list`, `.remap-list`) use `gap: 6–8px`.
- The whole page column is capped at `var(--col)` (1123px) and centred — see `.app-bar-inner`,
  `.app-main`, `.app-footer`.
- Typography sizes are mostly hand-tuned per class rather than a scale (13px body, 16px card
  titles, 18–32px headings) — see the relevant class in the inventory below rather than a single
  type-scale table.

## Screens

| File | Represents (real route) | Key components transcribed |
|---|---|---|
| `screens/overview.html` | `/` | `Shell`, `AppHeader`, `CharacterCard` ×4 |
| `screens/ships.html` | `/ships` | `ShipsPage`, `ShipCard`, `Gauge` |
| `screens/fit-sheet.html` | `/ships/fit/[id]` (a ship's read-only sheet) | `FitSheet`, `Gauge`, `AffectedBy` (one open) |
| `screens/fitting-editor.html` | `/fitting/[id]` | `FitEditor` toolbar, `SlotLayout`, `StatsPanel`, `ItemBrowser` |
| `screens/skills.html` | `/skills` | `SkillSummaryCard`, `QueueTable`, `PlansCard`, `SkillGroups`, `ClonesCard` |
| `screens/skill-plan.html` | `/skills/plans/[id]` | `PlanEditor` toolbar, `PlanTable` (done/queued/planned/prereq/alpha rows), `AttributesPanel` (with a remap suggestion) |
| `screens/combat.html` | `/combat` | `CombatFilters`, stat tiles, monthly bar chart, top lists, `KillmailTable` |
| `screens/killmail.html` | `/combat/[killmailId]` | Killmail detail page: header, victim, fit slots, attackers |
| `screens/settings.html` | `/settings` | `AccountsPanel`, `CharactersPanel`, `TagsPanel`, `StaticDataPanel`, `SyncStatus` |

Every screen shares the same header/footer shell (`AppHeader` + `TopNav` + a static, closed
`CharacterSwitcher` button + `AppFooter` + the mobile `BottomBar`), reproduced verbatim in each
file so the shell can be restyled once and checked for consistency across all nine.

## Component / class inventory

Grouped by area; "source" is the file the class name is drawn from directly.

### Shell (every screen)
| Class | Source |
|---|---|
| `.app-header`, `.app-bar-inner`, `.logo-lockup`, `.logo-text`, `.logo-divider`, `.wordmark` | `src/app/components/AppHeader.tsx` |
| `.top-nav`, `.nav-link` | `src/app/components/TopNav.tsx` |
| `.user-menu`, `.user-avatar`, `.user-name`, `.user-caret`, `.char-avatar` | `src/app/components/CharacterSwitcher.tsx` |
| `.char-group-label`, `.menu-link-item` | `src/app/components/CharacterSwitcher.tsx` (dropdown contents; not rendered open in this package) |
| `.app-main` | `src/app/components/Shell.tsx` |
| `.app-footer`, `.footer-mark`, `.footer-copy` | `src/app/components/AppFooter.tsx` |
| `.bottom-bar`, `.bottom-item` | `src/app/components/BottomBar.tsx` |

### Page chrome (shared across pages)
| Class | Source |
|---|---|
| `.page-title`, `.page-sub` | used by every page (e.g. `src/app/ships/page.tsx`, `src/app/skills/page.tsx`) |
| `.card`, `.card-title`, `.card-grid`, `.card-stack` | `globals.css`, used throughout |
| `.muted`, `.faint`, `.pos`, `.neg`, `.warn-text` | `globals.css` text-tone helpers |
| `.badge` + `.ok` / `.error` / `.needs_reauth` / `.running` / `.bpc` / `.meta` / `.kill` / `.loss` / `.done` / `.queued` / `.planned` / `.prereq-badge` / `.alpha` | badge variants, various view files |
| `.table`, `.num` | shared table styling |
| `.banner` | e.g. `src/app/ships/page.tsx` (skills-not-synced), `src/app/skills/plans/[id]/page.tsx` (account block) |
| `.online-dot` + `.on` | `src/app/components/CharacterCard.tsx` |
| `.sec-high` / `.sec-low` / `.sec-null` | `src/lib/view/format.ts` `secClass()` |
| `.coming-soon` | `src/app/ships/CouldNotCompute.tsx` and others |
| `.show-more` | `src/app/combat/KillmailTable.tsx` |

### Overview / `CharacterCard`
`.card-grid.overview`, `.ov-card`, `.ov-head`, `.ov-portrait`, `.ov-name`, `.ov-corp`, `.ov-pills`,
`.pill`, `.tag-chip` (+ `.on`), `.ov-rows`, `.ov-row` — all `src/app/components/CharacterCard.tsx`.
Note: the current `CharacterCard` markup has **no "last sync" row** — only Wallet, Location, Ship,
Training, Total SP.

### Ships / fit sheet
| Class | Source |
|---|---|
| `.card-grid.ships`, `.ship-card`, `.ship-head`, `.ship-render`, `.ship-name`, `.ship-type`, `.ship-loc`, `.ship-foot`, `.ship-unpriced` | `src/app/ships/ShipCard.tsx` |
| `.gauge-row`, `.gauge-label`, `.gauge` (+ `.over`), `.gauge-fill`, `.gauge-text` | `src/app/ships/Gauge.tsx` |
| `.section-title` | `src/app/ships/page.tsx` |
| `.fit-head`, `.fit-render`, `.bonus-list`, `.bonus-skill` | `src/app/ships/FitSheet.tsx` |
| `.counters`, `.counter` (+ `.over`), `.counter-label` | `src/app/ships/FitSheet.tsx` / `StatsPanel.tsx` |
| `.slot-cols`, `.slot-col`, `.slot-title`, `.module-icon`, `.charge` | `src/app/ships/FitSheet.tsx` |
| `.affected`, `.affected-btn`, `.popover`, `.popover-title`, `.popover-list` | `src/app/ships/AffectedBy.tsx` |
| `.problem-list` | `src/app/ships/FitSheet.tsx` |
| `.entry-list`, `.value-list`, `.value-total` | `src/app/ships/FitSheet.tsx` |

### Fitting editor
| Class | Source |
|---|---|
| `.fit-editor`, `.fit-editor-main`, `.fit-toolbar`, `.fit-name-input`, `.fit-select`, `.fit-btn` (+ `.danger`, `[disabled]`), `.save-state` (+ `.error`) | `src/app/fitting/FitEditor.tsx` |
| `.slot-row` (+ `.selected`, `.empty`, `.over`), `.slot-main`, `.slot-charge`, `.icon-btn` (+ `.danger`), `.qty-input` | `src/app/fitting/SlotLayout.tsx` |
| `.modal-backdrop`, `.modal`, `.eft-text` | `src/app/fitting/FitEditor.tsx` (export modal) |
| `.browser-results`, `.browser-row`, `.browser-crumbs`, `.crumb`, `.check-row` | `src/app/fitting/ItemBrowser.tsx` |
| `.badge.meta` | `src/app/fitting/ItemBrowser.tsx` |
| `.fit-list-row` | `src/app/fitting/FitList.tsx` |

### Skills / skill plan
| Class | Source |
|---|---|
| `.stat-row`, `.stat-label`, `.stat-value` | `src/app/skills/SkillSummaryCard.tsx`, `PlanEditor.tsx` |
| `.attr-grid`, `.attr`, `.attr-label`, `.attr-total`, `.attr-bonus` | `src/app/skills/SkillSummaryCard.tsx`, `AttributesPanel.tsx` |
| `.progress`, `.progress-fill` | `src/app/skills/QueueTable.tsx` |
| `.skill-group`, `.group-toggle`, `.group-sp`, `.level-boxes`, `.level-box` (+ `.trained`, `.active`) | `src/app/skills/SkillGroups.tsx` |
| `.clone-list` | `src/app/skills/ClonesCard.tsx` |
| `.plan-toolbar`, `.plan-editor`, `.plan-editor-main` | `src/app/skills/PlanEditor.tsx` |
| `.plan-table`, `tr.prereq`, `.badge.prereq-badge`, `.badge.alpha`, `.badge.done`, `.badge.queued`, `.badge.planned`, `.plan-actions` | `src/app/skills/PlanTable.tsx` |
| `.remap-list`, `.remap-delta` | `src/app/skills/AttributesPanel.tsx` |
| `.plan-list-row` | `src/app/skills/PlansCard.tsx` |
| `.skill-picker`, `.skill-picker-results`, `.skill-picker-row` | `src/app/skills/PlanEditor.tsx` |

### Combat / killmail
| Class | Source |
|---|---|
| `.combat-filters`, `.combat-tabs`, `.combat-tab` (+ `[data-active]`) | `src/app/combat/CombatFilters.tsx` |
| `.card-grid.stat-tiles`, `.card-grid.top-lists`, `.top-list` | `src/app/combat/page.tsx` |
| `.month-strip`, `.month-col`, `.month-half` (+ `.up`, `.down`), `.month-bar` (+ `.kill`, `.loss`), `.month-label`, `.month-legend` | `src/app/combat/page.tsx` |
| `.badge.kill`, `.badge.loss`, `.km-ship`, `.km-corp` | `src/app/combat/KillmailTable.tsx` |
| `.killmail-table` | `src/app/combat/KillmailTable.tsx` — **unstyled hook**: present in the JSX (`className="table killmail-table"`) but has no rule of its own in `globals.css`; it inherits from `.table`. Left in place for exact markup fidelity. |
| `.km-head`, `.km-head-meta`, `.km-victim`, `.km-slot` | `src/app/combat/[killmailId]/page.tsx` |

### Settings
`.card-grid` (inline `style="grid-template-columns: 1fr 2fr"`), `.char-avatar` (+ `.warn`),
`.tag-chip` (+ `.on`), `.badge.needs_reauth` — all from `src/app/settings/*.tsx`. **Approximation
note:** the real `AccountsPanel`, `CharactersPanel` and `TagsPanel` are built with Mantine
components (`Button`, `TextInput`, `Group`, `NativeSelect`) rather than the hand-rolled Midnight
classes used everywhere else, and Mantine's stylesheet isn't bundled in this static package. The
buttons/inputs in `screens/settings.html` are approximated with plain `<button>`/`<input>` and the
closest Midnight classes (`.fit-btn`, `.filter-input`, `.fit-select`) so the panel is visually
usable to restyle; porting changes back for these three panels means restyling the underlying
Mantine components (via `theme.ts` / Mantine props), not just editing class rules in `globals.css`.

## Icons

The real app uses `@tabler/icons-react` (inline SVG React components) throughout — save, trash,
plus, chevrons, etc. That package isn't available as static markup without a build step, so every
icon in this package is a small hand-drawn placeholder SVG of the same pixel size (14/16/18/20px,
`stroke="currentColor"`) in roughly the right shape. They are not pixel-accurate reproductions of
the real Tabler glyphs — treat them as position/size placeholders, not final icon art.

## The hand-back contract

Edit `css/globals.css` and/or the screens' markup freely. Keep class names stable where possible;
if you rename or restructure, note it in `CHANGES.md`. Hand back the whole folder (or a zip); the
changes will be diffed against the committed baseline and ported into the real components.

## Out of scope

This package is for **visual design only**. The following are not represented and are not what
this package is for:

- Data wiring — every value on every screen is hand-typed static sample data, not live from the
  database, ESI, or the SDE. There is no API, no auth, no session.
- Routing / interactivity — links between screens point at the other static files for navigation
  convenience, but nothing here is a working Next.js route; forms don't submit; buttons don't do
  anything (no JavaScript is loaded).
- The character-switcher dropdown, item-browser search, and other interactive-only states are
  shown once in their default/closed state, not as live widgets.
- Business logic (fitting calculations, skill queue math, killmail parsing, etc.) — the numbers
  shown are illustrative, not computed.

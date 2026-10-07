# What changed between the 2026-09-02 package and this one

The previous package (`reference/previous-package-README.md`, screens in
`reference/screens-2026-09-02/`) was cut at commit `8dd95df`. Forty-odd commits landed between
then and `f6f2589` (2026-10-01), most of them a design refresh carried out on 2026-09-02/03.
Everything below is already built and live at eve.example.com; the screens in `screens/` show it.

## Shell
- **Clones** is a top-nav entry (8 items: Overview, Skills, Clones, Ships, Fitting, Assets, Wallet,
  Combat) with its own page. The mobile bottom bar keeps seven destinations — no Clones tab.
- **Footer** is a lockup: the three-ellipse "atom" mark in accent, then the aurora "Plasma" wordmark.
  The same mark is the favicon (`assets/icon.svg`). The old `footer-mark` image and the
  trademark line are gone.
- Character menu entries switch character / log out via POST forms (no visual change).

## Tokens and primitives
- **Badges and pills are squared**: `border-radius: 5px`, not `99px`. Combat tabs keep the round
  pill shape; the Skills tabs reuse `.combat-tab` with `border-radius: 6px`.
- New pill variants: `.pill.main` (accent fill), `.pill.alt` (accent-2 fill), `.pill.tag` (green
  outline — every tag is the same green), `.pill.hull` (accent tint, a step larger).
- New badge rule `.badge.warn` (amber) in the stylesheet; the sync table still shows a partly-successful job as amber `.warn-text` in the message cell rather than a badge.
- **One progress bar site-wide**: `.progress` / `.gauge` are both 10 px high, radius 3, accent
  fill (red when over), on a `--raised` track. `.progress-wrap` adds a percentage to the right.
- Durations read `5d 13h 20m` (planner style) instead of `3 h 12 m`.
- `[data-desc]` hover: any element with a `data-desc` attribute shows the SDE description as a
  tooltip panel (`--raised`, `--border-hi`, 12 px, pre-line). Used on modules, charges, drones,
  cargo, assets rows, skills.

## Overview
- Cards are **two fixed columns** (one under 860 px), padding 26×28, gap 16.
- Card head: portrait 64 px, name + online dot (only when online — no grey dot any more),
  corporation · alliance, and the **race** on a third line. Account pill (main/alt) and the
  re-authorise badge sit **top-right** (`.ov-head-right`).
- Tag pills under the head, all green.
- Rows are Wallet (whole ISK), Location (sec-coloured + system + `· station`, allowed to wrap),
  Ship (hull pill + group pill only). Training and Total SP moved into a **foot**: skill + time
  remaining over a progress bar with a percentage; Total SP label/value on the right.
- Training progress is measured by SP through the level, not by this queue stint's wall clock.

## Skills
- The page has two **tabs**, Training queue / Trained skills (`.skill-tabs .combat-tab`, squared); plans and clones cards sit below.
- Queue shows **time remaining** per row (not total duration), a live `3d 12h 09m 41s` countdown
  above the table, and advances past entries ESI still lists after they finished.
- Trained skills are a **flat layout**: group heads with a bottom border, then a 240 px grid of
  `.skill-cell` rows (name, SP, level boxes). Level boxes: trained (tinted), active (solid),
  training (blinking).
- Hovering a skill shows its SDE description.

## Ships
- Card head: 84 px render; **hull pill first (accent-tinted), then race and class pills**; the
  pilot's name for the ship under them, smaller and lighter; sec-coloured location.
- A **2×2 stat strip** (DPS, EHP, Speed, Capacitor) above the CPU / powergrid gauges.
- Gauges: label and value on one line, the bar full width beneath.

## Fit sheet
- Same **main + 340 px sidebar** split as the fitting editor.
- Header: render, hull/race/class chips, coloured location; **bonuses moved to the foot**.
- **Ship stats card** (`.ship-stats`): the in-game fitting window's right panel — Capacitor,
  Offense, Defense (resist table, one tinted cell per damage type), Targeting, Navigation, Drones.
  `assets/screenshots/ingame-fitting-window.png` is the reference it was built from.
- Modules: one full-width list per slot kind under a shared column header (name, CPU, PG, state
  pill: active / overload / offline / passive). Split stacks and singleton drones merge; `×1` hidden;
  icons on every bay entry.

## Fitting editor
- Toolbar redesign: hull render, editable fit name (borderless until hover), meta row with pills and
  dividers, actions on the right with the save state.
- Slot rows under a column header; slot section titles carry a count (`.slot-count`, red when over).
- The sidebar has the same Ship stats card as the fit sheet, fed by real fit-performance maths
  (DPS, volley, EHP, capacitor, mobility, targeting); a problems card with a red border.
- Cargo card and fit value block below the slots (`.fit-lower`).

## Assets
- A type icon on every row (bp / bpc variation for blueprints), hover descriptions.

## Settings
- Characters are ordered by account, then by the order they were added (one flat list, no group headings).
- Login log lines name the rejected character (no UI change).

## Not changed
Combat, killmail and wallet are visually as they were on 2026-09-02, apart from the shared
primitives above (squared badges, footer, nav).

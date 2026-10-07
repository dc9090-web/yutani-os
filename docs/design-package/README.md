# Yutani OS (formerly EVE Plasma) — design package

> **2026-10-01 iteration applied — read `CHANGES.md` first.** The screens, `css/globals.css`, `css/fonts.css`,
> `tokens.css`, `_src/` and `previews/*.png` in this folder carry the Yutani OS redesign, and the app implements it
> (stylesheet copied over, `fonts.ts` / `theme.ts` / shell / login updated, `SystemStrip.tsx` and `TrainingOverview.tsx` added).

A snapshot of EVE Plasma's UI **as it is built today** (repo `Plasma/EVE`, commit `f6f2589`,
2026-10-01, live at https://eve.example.com), packaged so it can be loaded into Claude Design and
changed there.

EVE Plasma is a private, self-hosted command centre for a handful of EVE Online characters: an
overview of every character, skills and skill plans, clones, ships with fit sheets, a fitting
editor, assets, wallet, and combat (killmail) history. It is a **Next.js 16 / React 19** app with
one hand-written stylesheet (`css/globals.css`, the "Midnight" system), Mantine only for the
character menu and the settings forms, and Tabler icons. The site sits behind EVE SSO, so only
the login page is reachable without an allow-listed character — everything else in this package
is rebuilt from the source.

## Changes wanted

> Done in this iteration (see CHANGES.md):
> - Rename to **Yutani OS**, Yutani wordmark + katakana sub-mark in header, footer and login
> - Blade Runner / Prometheus console look: amber-on-warm-black tokens, Michroma / Chakra Petch / JetBrains Mono, glass panels with corner brackets, tick rulers, grid field, system status strip
> - Skills: framed trained-skill groups; new four-character Training overview (20 entries each)

## What is in this package

| Path | What it is |
|---|---|
| `screens/*.html` | One self-contained HTML file per screen (14), built from the real JSX with the real class names and the real stylesheet inlined. Open in a browser; no server, fonts load from Google Fonts. |
| `tokens.css` | The `:root` colour tokens and the three font variables, on their own |
| `css/globals.css` | The whole stylesheet, verbatim from `src/app/globals.css` — the thing to edit |
| `css/fonts.css` | Package substitute for the app's self-hosted `next/font` setup (same three families and weights) |
| `previews/*.png` | A rendered image of every screen at 1280 px wide, two at phone width (overview, ships), and the fitting editor both with and without its export modal |
| `assets/yutani/` | Yutani wordmark, katakana sub-mark, full logos and app icon (see CHANGES.md) |
| `assets/icon.svg` | The favicon: the Yutani tray glyph (`assets/yutani/tray-symbolic.svg`, from the `dc9090-web/yutani` repo) filled with the amber accent |
| `assets/eve-mark.svg` | The older footer image, no longer used in the app; kept for reference |
| `assets/screenshots/live-login-2026-10-01.png` | The live login page, as served |
| `assets/screenshots/ingame-fitting-window.png` | The EVE client's fitting window — the reference the Ship stats card was designed from |
| `reference/previous-package-README.md`, `reference/screens-2026-09-02/` | The last package (2026-09-02) and its screens, so the two can be diffed |
| `reference/changes-since-2026-09-02.md` | What changed in the UI between that package and this one |
| `reference/source/` | `globals.css`, `theme.ts` (Mantine theme), `fonts.ts`, `nav.ts` as they are in the repo |
| `_src/` | Sources for `screens/` (`python3 _src/build.py` inlines the CSS); not needed in Claude Design |

### Screens

| File | Route | What it shows |
|---|---|---|
| `login.html` | `/login` | Bare page, no shell: lockup, sign-in card, SSO button, the not-allowed error line |
| `overview.html` | `/` | Four character cards, two-up: online dot, race, main/alt pill, re-authorise badge, tags, location, ship pills, training foot with progress, Total SP |
| `skills.html` | `/skills` | Summary + attributes, Training queue / Trained skills tabs, live countdown, queue with time remaining and SP progress, trained skills flat grid with level boxes, plans card |
| `skill-plan.html` | `/skills/plans/[id]` | Plan editor: toolbar stats, plan table with done / queued / planned / prereq / alpha rows, skill picker open, attributes panel with a remap suggestion |
| `clones.html` | `/clones` | Home station, active implants with bonuses, jump clones |
| `ships.html` | `/ships` | Ship cards: render, hull / race / class pills, name, location, DPS / EHP / speed / capacitor tiles, CPU and powergrid gauges, value; skills-not-synced banner |
| `fit-sheet.html` | `/ships/asset/[itemId]`, `/ships/fit/[fittingId]` | Read-only fit: header chips, Ship stats card (capacitor, offense, defense resist table, targeting, navigation, drones), slot lists with state pills, bays, affected-by popover, problems, bonuses, value |
| `fitting-list.html` | `/fitting` | Saved fits list: toolbar, pick-a-hull card open, fits table |
| `fitting-editor.html` | `/fitting/[id]` | Editor: toolbar, slot rows (selected / empty / over), stats and problems sidebar, item browser, cargo, fit value, EFT export modal open (delete the `.modal-backdrop` element to see the page under it) |
| `assets.html` | `/assets` | Locations with item counts and volume, expandable tree, type icons, bp / bpc badges |
| `wallet.html` | `/wallet` | Balance, journal, transactions, show-more |
| `combat.html` | `/combat` | Filters, stat tiles, monthly kill / loss strip, top lists, killmail table |
| `killmail.html` | `/combat/[id]` | One killmail: header, victim, fitted slots, attackers, open-in-designer |
| `settings.html` | `/settings` | Accounts, characters ordered by account (one needing re-authorisation), tags, static data, sync status with ok / running / error rows and an amber warning message |

Every screen except login carries the same shell (sticky frosted header with the EVE · Plasma
lockup, eight-item nav, character menu button; footer lockup; the seven-item mobile bottom bar
under 760 px), reproduced verbatim so the shell can be restyled once and checked everywhere.

## How to use it in Claude Design

1. Start a project and upload this folder (or `eve-design-package.zip`).
2. Paste the prompt below, with your changes filled in.

```
This is the current UI of EVE Plasma, a Next.js web app with one hand-written stylesheet.
The files in screens/ are the real markup with the real stylesheet inlined; css/globals.css
is that stylesheet on its own and tokens.css holds the tokens. README.md explains the
constraints; reference/ holds the previous package and what changed since. Treat screens/
as the starting point, not as a draft to restyle from scratch.

I want to change:
- <change 1>
- <change 2>

Keep everything else as it is. When we are done, give me: the updated css/globals.css,
the updated screens, and a short CHANGES.md listing every class added, renamed or removed
and every new token, so the result can be diffed against this package and ported back.
```

3. Bring the bundle back to the repo. `globals.css` is copied over `src/app/globals.css`
   directly; markup changes are ported into the matching component (every class in the screens
   is named after its source file in an HTML comment).

## The screens were built from the code, not from screenshots

Each screen mirrors the JSX of its route one to one — same elements, class names, nesting and
strings — and is styled by the unmodified stylesheet, so what you see is what the browser
renders, with these approximations:

- **Sample data.** Names, ISK, systems, fits, skills and dates are placeholder, and the four
  characters are fictional.
- **Fonts.** The app self-hosts Inter, Poppins and Space Grotesk through `next/font`; the package
  loads the same families from Google Fonts instead.
- **Icons.** The app uses Tabler icons as inline React SVGs. The package uses hand-drawn
  placeholders of the same size (`stroke="currentColor"`) with a comment naming the real glyph.
- **Mantine.** The character dropdown, the settings forms (buttons, inputs, selects) and the
  dropdown menu are Mantine components whose stylesheet is not bundled; they are drawn with
  plain elements and the nearest Midnight class and flagged in a comment, so on `settings.html` the tag chips, the Re-authorise / Add character links and the account select look rawer than they do live. Restyling those means
  changing `theme.ts` or component props, not just `globals.css`.
- **Interactive-only states** (open character menu, item-browser typing, hover tooltips) are
  shown once in a fixed state or not at all; `data-desc` tooltips do work on hover.
- Images (portraits, ship renders, type icons) come from `images.evetech.net` live.
- **"Other states" blocks.** `skills.html` and `skill-plan.html` append, under a dashed amber-labelled
  divider, states the live page shows one at a time (the inactive tab, the plan-creation panels,
  save errors, empty tables). The divider and label are package-only CSS, not app classes.

Two things the screens expose that are true of the live app as well, not transcription errors:
the plan names in the Plans card are plain anchors with no rule in `globals.css` (browser-default
link colour), and `.tag-chip` on the settings page has no rule either.

## Constraints a new design has to live within

- **Tokens only.** Every colour is a custom property on `:root`; component rules reference tokens
  (or an alpha of one, as the badges do). A new colour means a new token.
- **One stylesheet, hand-written, flat.** No preprocessor, no CSS modules, no utility framework.
  Class names are stable identifiers shared with the components — rename with care and record it.
- **Dark only.** `forceColorScheme="dark"`; there is no light theme and no theme switch.
- **Type:** Inter for body (13–14 px), Poppins 500/600/700 for headings, titles, values and
  anything numeric, Space Grotesk 600 for the "Plasma" wordmark only. Tabular numerals on
  numbers (`.num`, `.dur`).
- **Layout:** content column capped at `--col` (1123 px), centred, 24 px side padding; cards
  are `--card` on `--border`, radius 14, padding 24; smaller controls radius 6–10; badges and
  pills radius 5 (combat tabs 99). Sidebars (fit sheet, fitting editor, plan editor) are 340 px
  and collapse under 900 px; overview goes single-column under 860 px.
- **Header** is 80 px, sticky, frosted (`backdrop-filter: blur(18px)`), with a
  `view-transition-name`. **Bottom bar** replaces the top nav under 760 px.
- **Shadows and blur** appear only on the header, the login card, popovers and tooltips. Cards
  are flat.
- **Motion:** the aurora wordmark gradient (6 s loop) and the blinking "training" level box, both
  switched off under `prefers-reduced-motion`.
- **Status colours** are fixed in meaning: `--pos` green = ok / kill / high-sec / tag,
  `--neg` red = error / loss / null-sec / over capacity, `--warn` amber = warning / low-sec,
  `--accent` blue = active / links / primary / running, `--accent-2` = charges, meta, alt.
- **No JavaScript in the design.** Tooltips, hover states and tab styling are CSS; anything
  needing script is a component change.

# CHANGES — Yutani OS (design iteration on the 2026-10-01 package)

Diff against the package cut at commit `f6f2589`. **Everything is CSS + shell markup**; no component
logic changed. `css/globals.css` is the file to copy over `src/app/globals.css`; the markup changes are
the five items under "Shell" plus two new blocks on the Skills page. `_src/` was kept in sync and
`screens/` rebuilt the same way `_src/build.py` does (fonts + globals inlined), so they can be diffed.

## Rename

EVE Plasma → **Yutani OS**. Titles read `Page — Yutani OS`. The "EVE | Plasma" lockup, the aurora
`.wordmark`, the atom `.footer-icon` and `assets/icon.svg` are no longer used anywhere.

## Brand assets (new, `assets/yutani/`)

| File | Use |
|---|---|
| `wordmark-white.png` | "YUTANI" wordmark, cropped from the repo's `docs/logo-white.png` — header, footer, login |
| `kana-white.png` | "ユタニ重工" sub-mark, cropped from the same logo — footer, login |
| `logo-white.png`, `logo-dark.png` | Full logos as in the `dc9090-web/yutani` repo |
| `app-icon.svg` | The Yutani app icon from the repo (not used) |
| `tray-symbolic.svg` | The tray glyph from the repo; filled amber it is the favicon (`src/app/icon.svg`) |

## Tokens (`tokens.css`, `:root` in `globals.css`) — amber phosphor on warm black

Every value changed; same names. New names marked ★.

```
--bg #0a0806  --bg-2 #0f0c08  --card #14110b  --raised #1c1811
--border #2d2616  --border-hi #4a3d1f  --divider #3d321a  --hairline #1d1810
--text #f4ecd9  --text-2 #e8dfc8  --muted #b7a37c  --faint #8d7d5e  --dim #6a5d45
--accent #f5a623 (amber)   --accent-2 #5fd3e8 (cyan: OS mark, bullets, charges, EM, links)
--pos #43d9a0  --neg #ff5c6c  --warn #ff7f50
--aurora amber→gold→coral→cyan (only the login wordmark used it; now unused)
★ --accent-rgb 245,166,35   ★ --glow 0 0 12px rgba(accent,.45)   ★ --card-glass rgba(20,17,11,.80)
★ --grid rgba(accent,.035)  ★ --bracket rgba(accent,.5)
★ --ruler  (the three-layer tick-ruler background used on card feet, group heads, footer)
```

Status colours keep their meaning (green ok / red error / warn / accent active). Every hard-coded
`rgba()` of the old hues in the stylesheet was rewritten to the new hues (badge, state-pill, hull pill,
level-box, header/bottom-bar glass, shadows).

## Type (`css/fonts.css`)

Inter / Poppins / Space Grotesk → **Michroma** (labels, nav, buttons, tiny tracked caps), **Chakra Petch**
(titles, names, values, section heads), **JetBrains Mono** (body and every table/readout). New variables
`--font-label`, `--font-display`, `--font-body`; the old `--font-inter / --font-poppins / --font-grotesk`
are aliases to them so no rule needed editing. In the repo: swap the families in `fonts.ts`, point the
three legacy variables at the new ones in `layout.tsx`. Body size 13 px.

## Shell (all screens; `_src/SHELL-TEMPLATE.html`)

1. **Header lockup** → `<img class="logo-img">` (wordmark) + `.logo-divider` + `<span class="logo-os">OS</span>`.
   `.logo-lockup` is now a bordered tab with a 3 px amber left edge. Header 60 px.
2. **Nav** → `.nav-link` as Michroma 9 px caps tabs; active = amber tint + 2 px inset underline + glow.
   `.user-menu` gets a hairline frame. Under 1040 px the user name hides and tabs tighten.
3. ★ **System status strip** (`.sys-strip` > `.sys-item`, `.sys-dot`, `.sys-right`) directly under the header:
   sync state · ESI · SDE build · character count · UTC clock. New component (`SystemStrip.tsx`), fed by the
   settings-page data; hidden under 760 px.
4. **Footer** → `.footer-lockup` (framed, column) with `.footer-wordmark` + `.footer-kana`; tick ruler on top.
5. **Login** → `.login-logo` = `.login-logo-img` (wordmark 220 px) + `.login-wordmark` ("OS", cyan, no
   gradient/animation) + ★`.login-kana`.

## Primitives

- **Panels** (`.card`, `.fit-toolbar`, `.login-card`): radius 0, 1 px border with an amber-lit top edge,
  glass fill (`--card-glass` + `backdrop-filter: blur(8px)` — relaxes the old flat-cards rule), four corner
  brackets drawn as background gradients. `.card-problems` / `.banner` / `.ship-card:hover` border colours as before.
- **Card titles / section titles**: Michroma 10 px caps with a glowing amber half-disc bullet and a fading rule
  (`::before` / `::after`). Sub-section heads (`.slot-section-title`, `.slot-title`, `.stat-section-head`,
  `.group-head`) are Chakra Petch caps.
- **Labels** (`dt`s, `th`s, gauge/stat/attr labels, slot heads, resist heads, month labels): Michroma 9 px, 1.5 px tracking.
- **Page head**: title caps with a 3 px amber bar; `.page-sub` is a cyan-bulleted readout line.
- **Pills / badges / state pills**: radius 1, 10 px caps. **Buttons / tabs** (`.fit-btn`, `.show-more`,
  `.sso-btn`, `.combat-tab`): radius 2, Michroma 9 px caps.
- **Bars** (`.progress`, `.gauge`): 8 px, square, 10 % tick scale on the track, glow on the fill.
- **Rulers**: `.ov-foot`, `.fit-value`, `.stat-bays`, `.app-footer` use `--ruler` instead of a hairline.
- Grid field + radial amber glow on `body` (fixed); `[data-desc]` tooltips are glass too.
- Overview: `.ov-row dt` gets a cyan square bullet; `.ov-sp-val` amber with glow; portrait square.

## Skills page

- **Trained skills groups** (`.skill-group-flat`): each group is a framed block — amber left edge, faint tint,
  Michroma label tab with tick ruler, clear gap between groups (replaces the bottom-border-only head).
- ★ **Training overview** (new card above the tabs; `TrainingOverview.tsx`): `.tq-grid` of one `.tq-card` per
  authorised character — `.tq-head` (portrait, name + online dot, "done in" countdown / Paused / Not synced,
  `.tq-count`), the head skill's `.progress.tq-progress`, then `.tq-list` of up to **20** `.tq-row`s
  (`.tq-n`, `.tq-skill` wrapping, `.tq-time`, level boxes). `.tq-more` links to the full queue when capped;
  `.tq-empty` for an empty queue. 4 columns → 2 under 1000 px → 1 under 560 px. Queue contents beyond the
  original six entries are sample data.

## Not touched

All component logic, routes and data shapes. `previews/*.png` were re-rendered from these screens after the hand-back.
Removed from the design (but left in the stylesheet): `.logo-text`, `.wordmark`, `.footer-icon`.

## 2026-10-07 follow-up: skill plan layout, fictional names

- **Plan editor** (`skill-plan.html`, `PlanEditor.tsx`, `PlanTable.tsx`): the ten-column plan table no longer shares the
  row with the 340 px attributes panel, which squeezed every cell onto three or four lines once the body font became
  monospaced. `.plan-editor` is now a one-column grid; the toolbar carries ★`.plan-head` (panel chrome, same as
  `.fit-toolbar`); the plan card spans the full content width; the skill picker and the attributes panel share a new
  ★`.plan-lower` band (`minmax(0,1fr) 340px`, one column under 900 px). `.plan-editor-main` is gone. In the table,
  numeric columns are `white-space: nowrap`, and the skill's group sits under its name as ★`.plan-group` instead of
  trailing it after a middle dot.
- **Sample data**: the four characters are fictional (Mara Vexley, Jorin Hale, Nyx Calder, Tove Ash) with made-up
  character IDs; `previews/*.png` re-rendered.
- **Fit sheet ranges** (`fit-sheet.html`, `FitSheet.tsx`): a loaded weapon shows its reach on a line under the charge,
  ★`.sheet-mod-range` ("optimal 1.2 km · falloff 5.2 km" for a turret, "range 38.2 km" for a launcher); ammo in the
  cargo hold shows what it would give the first fitted weapon that takes it, ★`.sheet-entry-range` after the quantity.

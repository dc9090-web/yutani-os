# Design system

All values are in `tokens.css`. This file explains how they are used.

## Principles

- **One accent.** Amber (`--yo-accent`) marks what is live or selected: active nav item, MAIN badge, the skill level in training, queued levels, ACTIVE modules, open info buttons. It is not used for decoration.
- **Two status colours.** Teal (`--yo-good`) and coral (`--yo-bad`). Always paired with words or a sign ("Stable" / "Lasts", "+" / "−", "Trained" / "3 missing").
- **Numbers are monospace.** Every figure, unit tag, timer and code uses `--yo-font-mono`. Names and prose use Inter. Headings use Space Grotesk.
- **System flavour is limited to:** the status strip, segmented bars, level blocks, hairline grids, the tracked wordmark, and uppercase micro labels. No glows, corner brackets, grid backgrounds or ruler ticks.
- **Hierarchy by surface, not border weight.** Page `--yo-bg`, cards `--yo-surface`, sunken cells `--yo-surface-sunken`, open rows `--yo-surface-open`.

## Type scale

| Use | Font | Size / weight |
|---|---|---|
| Page title (h1) | Space Grotesk | 32px / 600, letter-spacing -0.01em (26px mobile) |
| Card or section title (h2) | Space Grotesk | 18 to 20px / 600 |
| Group heading (h3) | Inter | 13px / 600, uppercase, letter-spacing 0.04em |
| Body, names | Inter | 13.5px / 400 to 500 |
| Meta, secondary | Inter | 12 to 13px, `--yo-text-muted` |
| Micro label | Inter | 11px / 500, uppercase, letter-spacing 0.1em, `--yo-text-label` |
| Headline figure | JetBrains Mono | 20 to 30px / 500 |
| Table figure | JetBrains Mono | 12.5 to 13px |
| Tag | JetBrains Mono | 10 to 10.5px, letter-spacing 0.1em |

## Shell

- **Header:** wordmark "YUTANI" (Space Grotesk 600, 15px, letter-spacing 0.3em) plus an "OS" chip in amber mono; nav links 13px/500; 60px tall; bottom border `--yo-border`.
- **Nav items:** Overview, Skills, Clones, Ships, Assets, Wallet. Active item: text `--yo-text` and a 2px amber inset underline. Inactive: `--yo-text-muted`.
- **Account button (top right):** shows the user's initials ("DC") only. It is not the character switcher.
- **Status strip:** mono 11px, letter-spacing 0.08em: teal dot + "SYS ONLINE", "ESI OK", "SDE <version>", "<n> CHARACTERS", UTC timestamp right-aligned.
- **Page container:** max-width 1360px, centred, padding 40px 32px 56px, sections 28px apart.
- **Mobile shell (390px):** logo and account button on the first row (56px); the six nav links on a second row that scrolls horizontally, 44px tall; page padding 24px 16px 40px.

## Components

### Level blocks
Five 10px squares, 3px gap, 1px radius, 1px border. Used for skill levels and mastery; a ten-block version shows implant slots.
- Filled: trained level.
- Empty: outlined `--yo-block-empty`.
- Queued: amber outline at 65%.
- Training now: amber outline, 40% amber fill, pulsing (`yo-throb`, 1.6s; disabled under reduced motion).
- Always followed by the level as a mono digit. The blocks sit immediately **left of** the name they describe, never at the far side of the row.

### Segmented bar
4px tall, 6px segments with 2px gaps. Used for training progress, CPU, powergrid, calibration. Fill is `--yo-block-filled` by default, amber for training, coral when over 100%.

### Stat strip
A row of cells divided by 1px hairlines (grid with 1px gap over a `--yo-border` background), radius 8px. Each cell: micro label, mono headline figure, optional one-line note. Two columns on mobile.

### Card
`--yo-surface`, 1px `--yo-border`, radius 8px, padding 20px 24px (16px mobile). Title in Space Grotesk; a header figure may sit right-aligned in mono.

### Collapsible row (Clones, Assets, Ships modules)
A full-width `<button>` row with a chevron that rotates 90° when open. Open rows and their body use `--yo-surface-open`. Several rows can be open at once.

### Tabs (segmented control)
Container `--yo-surface-sunken`, 1px border, radius 8px, 3px padding. Each tab is a 44px-tall button; selected tab gets `--yo-surface-control` and `--yo-text`.

### Character dropdown
Sits directly under the page title on every per-character page. Closed: 44px button with monogram tile, character name, chevron. Open: menu listing each character with MAIN/ALT tag and total SP; current one highlighted. Hidden on the Skills "Overview" tab, which covers all characters and shows "All characters" instead.

### Info button and inline panel
A 28px button with an "i" in a circle, placed straight after a skill or implant name. Grey by default, amber when open. Clicking opens a description panel **inline under the row** (not a floating popover), `--yo-surface-sunken` with a 1px border. One open at a time per list.

### Tags and badges
- MAIN: amber fill, dark text. ALT: outlined, muted text.
- Module state: ACTIVE amber outline, ONLINE grey outline.
- BUY coral outline, SELL teal outline.
- Role chips on Overview: outlined mono uppercase.
- Clone ids ("JC 01") and location flags ("HANGAR"): outlined mono.

### Image and icon tiles
Square tile, `--yo-surface-control` fill, `--yo-border-tile` border, radius 4 to 8px. In the mockups these hold monograms or a generic glyph. **In the build they hold the real EVE images** (character portraits, ship renders, item icons) that the current site already loads.

### Tables
Header row of micro labels; rows separated by `--yo-border-row`; numeric columns right-aligned in mono. On mobile, tables become two- or three-line rows with no header (see `PAGES.md`).

## Accessibility

- Text contrast is at least 4.5:1, including 11px labels.
- Controls are real `<button>`, `<a>`, `<input>` + `<label>` elements. Keep this.
- Icon-only buttons have `aria-label`; block strips have `role="img"` with a text label such as "Level 4 of 5".
- Status never relies on colour alone.

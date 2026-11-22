# Page specifications

Each section lists the layout, behaviour, and what changed from the current live page. Desktop first, then mobile differences. Artboard file names are in brackets.

## 1. Overview (`Main` / `MobileMain`)

- **Summary strip (new):** combined wallet, total skill points, training queues active ("6 of 6"), next skill to complete (time and character). All derived from existing data.
- **Character cards:** three across at desktop width, so six characters fit one screen (the live page shows two large cards per screen).
- **Each card:** portrait, name with MAIN/ALT badge, corporation and race, total SP top right; role chips; a three-cell row for wallet, ship (name and class) and location (security status in teal, system, station); training row with skill name, time remaining, segmented progress bar and percentage.
- **Mobile:** summary strip 2×2; cards single column.

## 2. Skills (`Skills` / `MobileSkills`)

Three tabs in a segmented control beside the title: **Overview** (default), **Skills**, **Training**. "Overview" is the renamed "Multiview" tab.

### Overview tab (all characters)
- One card per character, three across. Header: portrait, name, "Done in <time>", queue length. Then the current skill's progress bar.
- First ten queue entries per character: position, level blocks, target level digit, skill name, time. Footer "+N more in queue".
- Level blocks show levels already trained as filled; the level this entry trains is amber (tinted and pulsing on the active entry, outlined on queued entries).
- An "Edit" button chooses which characters appear (existing feature).
- The live site lists 20 entries per character; the design shows 10.

### Skills tab (one character)
- Character dropdown under the title.
- One scrolling page: every skill group as a full-width panel (name, "N skills · X SP", and "N levels queued" in amber when relevant), skills four across.
- Each skill row: level blocks, level digit, name, info button. Untrained skills are dimmed unless queued.
- Queued levels show as amber outlines; the level in training is tinted and pulses, with a "TRAINING" tag.
- A legend above the list: Trained, Training now, Queued, Untrained, plus total levels in queue.
- Info button opens the skill description inline.
- The old summary panel (total SP, unallocated SP, attributes) was removed at the owner's request.
- A "View" option (Browse by group / All groups) exists in the artboard as a design alternative; **All groups is the chosen layout.**

### Training tab (one character)
- Single panel, max-width 940px: "Training queue", "N skills · all trained in <time>", legend.
- One row per queue entry: position, level blocks, target level digit, skill name, info button, time remaining. The active row adds a "TRAINING" tag and its progress bar.
- A skill queued several times steps up one level per entry.
- The Plans panel was removed at the owner's request.

### Mobile
Same three tabs. Queue cards, skill groups and queue rows go single column.

## 3. Clones (`Clones` / `MobileClones`)

- Character dropdown under the title.
- **Active clone panel:** "ACTIVE" badge, implant count, home station, a ten-block implant slot strip with "n / 10", then implants in two columns. Each implant row: slot number, icon, name, info button, and attribute bonus in teal where it has one.
- **Jump clones:** grouped by station (system name, full station, clone count), station with the most clones first.
- Each clone is a collapsible row: chevron, clone id, clone name (or "Unnamed clone" in grey), slot strip, "n / 10 slots". Expanded: that clone's implants in two columns, sorted by slot, with icons and info buttons. Empty clones say "No implants".
- The live page shows implants as comma-separated paragraphs with no grouping.
- A "cloneLayout" option (List / Cards) exists as a design alternative; **List is the chosen layout.**
- **Mobile:** clone rows wrap to two lines (name, then slot strip); implant lists single column.

## 4. Ships (`Ships` / `MobileShips`)

- Character dropdown under the title. Two tabs with counts: **Fitted ships** and **Saved fits**.
- **One full-width panel per ship, one per line, ordered by hull type** (largest first: Dreadnought, Marauder, Black Ops, Battleship, Command Ship, Battlecruisers, Strategic Cruiser, Heavy Assault Cruiser, Cruiser, Destroyers, Frigates, Corvette, Shuttle; see `classOrder` in the artboard), then by value.
- Each panel, left to right:
  - Identity: ship image, hull type and faction label, hull name (links to Ship detail) with fit name, station.
  - Stats: DPS, EHP, speed with propulsion type, capacitor ("Cap · Stable" or "Cap · Lasts" with the figure in teal or coral).
  - Fitting: CPU and powergrid bars with used / max. Coral when over.
  - Right edge: value, skill status (teal "All skills trained" or coral "N missing skills"), mastery blocks with Roman numeral, "Modules N" button.
- "Modules" opens a strip along the bottom of the panel listing weapons and modules with ammo and range.
- The live page is one scroll of 189 large cards (67 fitted, then 122 saved fits) ordered by value.
- A "shipLayout" option (Panels / Table) exists as a design alternative; **Panels is the chosen layout.**
- **Mobile:** each panel stacks identity, a 2×2 stats grid, fitting bars, then value, skills, mastery and the Modules button.

## 5. Ship detail (`ShipDetail` / `MobileShipDetail`)

- "All ships" back link.
- **Summary panel:** ship image, hull type and faction, hull with fit name, location, mastery level, estimated value, and status flags ("Fit is legal", "All skills trained").
- **Key figures strip (new):** DPS, EHP, speed, capacitor, lock range, align time.
- **Main column, in order:** Modules, Ammunition, Consumables, Cargo and drones, Ship bonuses, Skills.
  - Modules: grouped by rack (High, Mid, Low, Rigs, Subsystems) with slot counts; identical modules merged with a quantity ("5×"); optimal, falloff, ACTIVE/ONLINE tag.
  - Ammunition: round, damage type with colour swatch, DPS, optimal, falloff, range band.
  - Skills (bottom): skills below level 5 that affect the ship, its bonuses, modules and drones, grouped as Ship and bonuses / Modules / Drones. Each row: level blocks, skill name, effect per level, and what it affects. Empty state: "Every skill that affects this ship, its bonuses, modules and drones is at level 5."
- **Side column, in order:** Fitting (CPU, powergrid, calibration, slot / turret / launcher counts), Defense (resist grid by layer with EHP per layer and total), Repairs (passive shield, shield boost, armor repair, hull repair), Capacitor, Offense, Drones, Targeting, Navigation, Estimated value breakdown.
- **Drone selector (in the Drones panel):** a dropdown listing only the drone types in this ship's drone bay. Each type has minus / plus steppers. The maximum for each type is the lowest of: number in bay, remaining bandwidth, and the pilot's drone control limit. Several types can be launched together. Changing the selection recalculates drone DPS, total DPS (key figures and Offense), launched count and bandwidth used.
- The separate "Problems" and "Missing skills" panels became the two status flags in the summary. A ship with real problems or missing skills still needs those details shown; that state is not designed.
- **Mobile:** key figures two columns; module rows fold optimal and falloff into a line under the name; ammunition and cargo rows go to two lines; the side column follows the main column.

## 6. Assets (`Assets` / `MobileAssets`)

- Character dropdown under the title; "Filter by name" search box on the right.
- **Totals strip:** items, locations, largest location.
- **Locations list:** one collapsible row per station with item count and volume, most items first.
- **Open location:** each ship or container is a header (image, name, fit name, summary, flag such as "HANGAR") with its contents in columns: Fitted, Drone bay, Cargo hold. Identical items are merged with a quantity and slot range ("6× … High 1–6"); charges loaded in a module show as a note on the module.
- **Every item row has an icon slot** for the real game icon.
- The filter narrows by location name and by item name; matching locations open automatically.
- The live page lists contents as one flat column with the slot at the far right of each row.
- **Mobile:** location rows are two lines (name, then "41 items" and volume); filter is full width.

## 7. Wallet (`Wallet` / `MobileWallet`)

- Character dropdown under the title; balance on the right in large mono figures.
- Two tabs: **Journal** and **Transactions** (the live page stacks both tables).
- **Journal:** grouped by day with a date header and entry count. Columns: time, type, "With" (the other party), amount (signed; teal in, coral out), running balance. From / To are merged into "With"; market escrow against yourself shows "Own escrow".
- **Transactions:** grouped by day. Columns: time, BUY / SELL tag, item with icon, quantity, unit price, total (signed and coloured), location.
- "Show more" loads further rows, as today.
- **Mobile:** journal rows are two lines (time, type, amount; then who and balance). Transaction rows are three lines (time and item; side, quantity × unit price, total; location). No column headers.

# Data requirements, placeholders and open items

The mockups were built without access to this repo, using only what the live site displays. `REPO_MAPPING.md` records what a first read of the code found for each data need; several items below turn out to exist already (queue target levels, clone names, skill descriptions).

## New data or calculations the build needs

| Feature | Page | What is needed | Status in mockup |
|---|---|---|---|
| Mastery level per ship | Ships, Ship detail | Ship mastery (I to V) from the SDE certificates against the pilot's skills | **Example values** (IV, or III where skills are missing) |
| Skills below level 5 affecting a ship | Ship detail | For the hull, each fitted module, charge and drone: required skills and skills that modify their attributes, filtered to those the pilot has below V; effect text per level; what each one affects | **Example rows**, tagged "EXAMPLE DATA" |
| Drone selector | Ship detail | Per drone type in bay: bandwidth, DPS per drone with the pilot's skills; ship bandwidth; pilot's max active drones | Bandwidth 10 Mbit/s and limit 5 assumed; DPS 20.15 each derived from the live total |
| EHP per layer | Ship detail | Shield, armor and hull EHP separately | **Estimated** from HP and rounded resists (marked "≈") |
| Repairs | Ship detail | Passive shield, shield boost, armor repair, hull repair rates (ideally EHP/s, as EVE Workbench shows) | Passive shield is real (27.0 hp/s); the other three shown as 0 by inference |
| Implant slot number | Clones | Slot (1 to 10) per implant, from the SDE | Derived from implant naming convention |
| Implant effect text | Clones | Implant descriptions from the SDE | **Draft copy** written by hand; replace all 37 |
| Clone names | Clones | The name field on jump clones from ESI | "[CLONE NAME]" placeholder on two clones |
| Queued level per queue entry | Skills | Target level of each training queue entry | Derived by counting entries per skill; use the real `finished_level` |
| Skill descriptions | Skills | Already on the live Skills tab (`data-desc`) | 105 of 317 loaded; the rest show a placeholder string |
| Summary figures | Overview | Combined wallet, total SP, active queues, next completion | Derived from the six cards |

## Placeholders to replace with real assets

- Character portraits (monogram tiles).
- Ship renders (hull initials).
- Module, implant and item icons (generic glyph tiles).
- The current site already loads these images from the EVE image server; keep that behaviour and put them in the reserved tiles.

## Scrubbed for the public repo

This copy is in a public repository, so some real data was replaced with sample values before it was committed:

- Wallet: balance, all journal entries and all market transactions are sample data. Other players appear as "Example Pilot A / B / C". Dates are placeholders.
- Overview: each character's wallet figure and the combined wallet are sample values.
- The live site's address is not given.

Everything else in the artboards (character names, skills and queues, clones and implants, ships and fits, asset locations) is real data as captured. The owner's private design canvas still holds the unscrubbed versions.

## Partial data in the mockups

- Ships: top 20 of 67 fitted ships and top 10 of 122 saved fits.
- Ship detail: only the Loki "Loki - TrilliumONE".
- Assets: all 69 locations listed; only Kubinen VI has contents.
- Wallet: latest 40 of 100 journal entries and 20 of 100 transactions.
- Skills: skill list and training queue are TrilliumONE's; picking another character in the dropdown does not change the data.
- "Show more" and "Show all" buttons are not wired.

## Decisions still open (ask the owner)

1. **"Overview" naming clash:** the main nav has "Overview" and the Skills page has an "Overview" tab.
2. **Attributes and unallocated SP:** removed from the Skills page with the summary panel; no new home yet.
3. **Fitting page removed:** saved fits still appear under Ships › Saved fits, but creating, importing and deleting fits has no place in the design.
4. **Combat page removed:** kills, losses, efficiency, ISK destroyed and lost, and the activity chart are dropped. Confirm the routes and code should go, or just the nav link.
5. **Stats skill profile:** EVE Workbench offers "All skills at level 5"; Yutani uses the pilot's actual skills with no selector. Add one or not?
6. **Seventh character:** the live site reports 7 characters and shows a seventh in the training overview, but the main Overview shows 6. The owner removed that character from the Skills Overview mockup; confirm how the Edit selection should behave.
7. **Long lists:** 144 training rows, 67 ships, 69 asset locations (32 with a single item). Leave long, paginate, or collapse the tail?
8. **Merged rows:** identical modules and identical item stacks are merged into one row with a quantity. Confirm a row per slot or stack is not needed.
9. **Wallet "With" column:** From and To merged into one. Confirm.
10. **Ship problems state:** a fit with fitting problems or missing skills needs a detailed view on Ship detail; not designed.
11. **Hull-type order on Ships:** largest first is the designer's choice; confirm or supply an order.
12. **Mobile Ships table:** only the panel layout exists on mobile.
13. **Mobile navigation:** the app has a bottom bar today; the mobile artboards use a scrolling strip under the logo. Not discussed with the owner.
14. **Skill planner entry point:** the Plans card was removed from the Training tab, which is how plans (`/skills/plans/[id]`) are reached today.
15. **Removed nav items:** Fitting and Combat still exist as routes and code. Confirm whether to keep them reachable some other way, hide them, or delete them.
16. **Pages not redesigned:** login, settings, skill plan editor, fitting list and editor, combat and killmail views, and the empty and error states. See `REPO_MAPPING.md`.
17. **Footer:** the current footer is not in the designs.

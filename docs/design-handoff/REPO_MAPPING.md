# Mapping the design onto this repo

Written after reading the repo at commit `0460a64` (22 Nov 2026). The designs themselves were made from the live site before the repo was available, so this file is where the two meet. Verify each line before relying on it; it comes from reading file names and searching the code, not from running the app.

## Stack, as found

- Next.js 16 (App Router) and React 19, TypeScript, Postgres, Vitest.
- One hand-written stylesheet: `src/app/globals.css` (795 lines). Mantine is used only for the character menu and settings forms; Tabler for icons.
- Fonts in `src/app/fonts.ts`; Mantine theme in `src/app/theme.ts`; nav in `src/config/nav.ts`.
- Own dogma engine in `src/lib/dogma/`, SDE import in `src/lib/sde/`, view models in `src/lib/view/`.
- An earlier design package lives in `docs/design-package/` (the amber console look this redesign replaces). Its `CHANGES.md` describes the convention used last time.

## What this redesign replaces

The current look (Michroma / Chakra Petch, glass panels with corner brackets, tick rulers, grid field) is replaced by the system in `DESIGN_SYSTEM.md`. Unlike the previous iteration, this is **not** a stylesheet swap: most pages change markup and structure as well as CSS.

- **Fonts:** `fonts.ts` moves to Inter, Space Grotesk and JetBrains Mono (JetBrains Mono is already in use).
- **Tokens:** `tokens.css` in this folder uses a `--yo-` prefix so it can sit beside the existing `:root` tokens during migration. Decide whether to keep the prefix or remap onto the existing names (`--bg`, `--card`, `--text`, `--muted` and so on).
- **Wordmark:** the artboards draw "YUTANI" as text. The repo has the real wordmark image (`docs/design-package/assets/yutani/wordmark-white.png`, used in the header today). Keep the real asset.

## Page by page

| Design page | Route | Main files today | Notes |
|---|---|---|---|
| Shell | all | `components/Shell.tsx`, `AppHeader.tsx`, `TopNav.tsx`, `SystemStrip.tsx`, `SysClock.tsx`, `CharacterSwitcher.tsx`, `BottomBar.tsx`, `AppFooter.tsx` | Header account button shows initials only; character switching moves to a dropdown under each page title. Footer is not in the designs. |
| Overview | `/` | `app/page.tsx`, `components/CharacterCard.tsx`, `lib/view/characters.ts` | Adds the summary strip; cards become compact, three across. |
| Skills › Overview tab | `/skills` | `skills/TrainingOverview.tsx`, `MultiviewEditor.tsx`, `lib/view/training-overview.ts` | "Multiview" renamed "Overview" and made the default tab. Ten entries per character instead of twenty. |
| Skills › Skills tab | `/skills` | `skills/TrainedSkills.tsx`, `SkillGroups.tsx`, `SkillTabs.tsx` | Blocks move left of the name; queued levels shown; info button replaces the `data-desc` hover. `SkillSummaryCard.tsx` and `AttributesPanel.tsx` are removed from this page (see open items). |
| Skills › Training tab | `/skills` | `skills/QueueTable.tsx`, `QueueCountdown.tsx`, `PlansCard.tsx` | Plans card removed from this tab (see open items: the skill planner loses its entry point). |
| Clones | `/clones` | `clones/page.tsx`, `skills/ClonesCard.tsx`, `lib/db/character-clones.ts` | Grouped by location, collapsible rows, slot strip, icons, info panels. |
| Ships | `/ships` | `ships/page.tsx`, `ShipCard.tsx`, `Gauge.tsx`, `lib/view/ships.ts`, `lib/ships/load.ts` | Full-width panel per ship, ordered by hull type; Fitted / Saved tabs. |
| Ship detail | `/ships/asset/[itemId]`, `/ships/fit/[fittingId]` | `ships/FitSheet.tsx`, `ShipStats.tsx`, `AffectedBy.tsx`, `lib/view/fit-sheet.ts`, `lib/ships/sheet.ts` | Adds key figures strip, drone selector, Skills panel, mastery, per-layer EHP, Repairs. |
| Assets | `/assets` | `assets/page.tsx`, `AssetsBrowser.tsx`, `lib/view/assets.ts` | Totals strip; contents grouped into Fitted / Drone bay / Cargo hold with merged rows. |
| Wallet | `/wallet` | `wallet/page.tsx`, `WalletTables.tsx`, `lib/view/wallet.ts` | Journal / Transactions tabs, grouped by day, "With" column. |

## Pages in the repo that were not redesigned

These exist in the app and were not covered in the design session. They need the new shell and tokens at minimum:

- `/login` (`login/LoginCard.tsx`)
- `/settings` (accounts, characters, static data, sync status, tags)
- `/skills/plans/[id]` skill plan editor (`PlanEditor.tsx`, `PlanTable.tsx`)
- `/fitting` and `/fitting/[id]` (list and editor). The owner removed Fitting from the nav.
- `/combat` and killmail views. The owner removed Combat from the nav.
- Empty and error states: `NoCharacter.tsx`, `ComingSoon.tsx`, `CouldNotCompute.tsx`, the skills-not-synced banner on Ships, the re-authorise badge on Overview cards.

## Data needs checked against the code

| Design need | Found in repo? | Where / what is missing |
|---|---|---|
| Target level of each queue entry | Yes | `finished_level` is stored (`lib/db/character-skills.ts`, `lib/view/training-overview.ts`). Use it instead of the mockup's counting. |
| Clone names | Yes | `clone.name` is already read in `clones/page.tsx`. |
| Skill descriptions | Yes | Already rendered as `data-desc` in `TrainedSkills.tsx` and `QueueTable.tsx`. |
| Item and module descriptions (implant info panels) | Probably | `data-desc` is also used in `FitSheet.tsx` and the fitting editor, so type descriptions are available. Confirm for implants. |
| Skills that affect a ship | Partly | `lib/dogma/affection.ts` and `ships/AffectedBy.tsx` already compute what affects a fit. The Skills panel needs that filtered to skills below level 5, with effect text per level. |
| Drone bandwidth, drone DPS | Partly | Bandwidth appears in `lib/dogma/perf.ts` and `lib/view/fit-sheet.ts`. The selector needs per-drone DPS and a recalculation for a chosen subset. |
| EHP per layer, repair rates | Partly | EHP and repair figures are handled in `lib/dogma/perf.ts`. Check whether per-layer EHP and the four repair rates are exposed to the view. |
| Implant slot number | Not found | No match for `implantness`. It is a dogma attribute in the SDE; check whether the import already carries it. |
| Ship mastery | Not found | No match for mastery or certificates. Needs the SDE certificates and masteries data imported, then evaluated against character skills. |
| "All skills at level 5" stats profile | Not found | No skill-profile option in the dogma or ships code. Only needed if the owner wants the selector. |

## Mobile

The app already has a mobile bottom bar (`components/BottomBar.tsx`) with seven fixed destinations and short labels; Clones is not in it. The mobile artboards instead use a horizontally scrolling nav strip under the logo with all six remaining items. This was not discussed with the owner. Ask which to use before building the mobile shell.

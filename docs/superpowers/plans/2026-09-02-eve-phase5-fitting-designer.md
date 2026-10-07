# EVE Phase 5 (Fitting Designer) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/fitting` — a real fit editor. Pick a hull, add/remove/replace modules, rigs, subsystems, charges and drones, and watch CPU / powergrid / calibration, slot and hardpoint counters, problems, missing skills and Jita value update **live in the browser** as you edit, computed by the same pure phase-4a engine the server uses. Fits are saved in our own `fits` / `fit_items` tables, can be cloned from an ESI saved fitting or an assembled ship, and imported/exported as EFT text.

**Architecture:** The engine is **isomorphic and runs client-side** (spec §3 — this is the decision, not an option). `src/lib/dogma/**` already has no Node imports; phase 5 adds a wire format (`src/lib/dogma/serialize.ts`) that splits `DogmaData` into a big, day-cacheable **meta** blob (attributes + effects + groups, ~1.25 MB of JSON, served once per SDE build) and small per-id **type** batches, plus a module-level browser store that memoises both. The editor holds a plain `FitDoc` in React state and, on every keystroke, derives `Fit` → `fitStats` → `validateFit` synchronously — microseconds, so there is **no debounce on the maths**. The only debounced things are the 2 s autosave `PUT` and the 250 ms type-search request. Everything that can be pure is pure and unit-tested (`src/lib/fits/{doc,slots,eft,editor-view}.ts`); server components and API routes read Postgres only, exactly as in phases 3b and 4b.

**Tech Stack:** TypeScript 5.9 strict + ESM (local imports carry the `.js` extension), Next.js 16 app router (server components + `"use client"` islands), React 19, Mantine 9 (theme only — layout is the Midnight CSS in `src/app/globals.css`), Tabler icons, Node 24, `pg` 8, Postgres 17, vitest 4 with happy-dom + `@testing-library/react`. **No new dependencies.**

**Spec:** `docs/superpowers/specs/2026-09-01-eve-phase5-fitting-designer-design.md` — this plan implements all of §2–§8. Project-wide architecture decisions come from `docs/superpowers/specs/2026-09-01-eve-foundation-design.md` §2–3.

**Depends on:** Phase 4, fully implemented and committed on `feature/phase4-ships`:
`docs/superpowers/plans/2026-09-02-eve-phase4a-dogma.md` (its final "Interfaces for phase 4b" section is the engine's public surface) and `docs/superpowers/plans/2026-09-02-eve-phase4b-ships.md` (market prices, `/ships`, the fit sheet). Every task below quotes verbatim the signatures it consumes, taken from the code as it stands on that branch.

## Global Constraints

- **TypeScript strict, ESM.** Imports between local TS files carry the `.js` extension. `npm run typecheck` (`tsc --noEmit`) covers `tests/**` too and must stay clean.
- **No new runtime dependencies.** The spec names none, so `package.json`'s `dependencies` block does not change. No date library, no state library, no drag-and-drop library.
- **Pages and API routes read Postgres only — never ESI inline** (foundation §2.1). The one exception the spec grants is `GET /api/market/prices`, which may call **Fuzzwork** (not ESI) synchronously to top up stale rows (spec §6); it is bounded to one chunk of 500 ids.
- **The engine runs in the browser** (spec §3). `src/lib/dogma/**` stays isomorphic: no `node:*` import, no `pg`, no `src/lib/db/**`, no `src/lib/sde/**`. `src/lib/dogma/sde-loader.ts` is the single server-only module and is imported **only** by API routes and server components — never by anything under `src/lib/fits/` that a client component imports.
- **A `"use client"` component must not import** `pg`, `src/lib/db/**`, `src/lib/sde/**`, `src/lib/ships/**`, `src/lib/fits/load.ts` or `src/lib/dogma/sde-loader.js`. `npm run build` is what proves it — run it before the deploy task.
- **All routes are session-guarded by `src/proxy.ts` already.** Its matcher is `["/((?!_next/static|_next/image).*)"]` and only `/login`, `/api/health`, `/auth/*`, `/_next/*` and two static files are public. **Do not add anything from phase 5 to `PUBLIC_EXACT` or `PUBLIC_PREFIXES`** — a fitting API that answers unauthenticated is the whole security model gone.
- **400 on a malformed body or query, 404 on an unknown id** (spec §6). Validation helpers live in `src/lib/api/json.ts`.
- **Midnight tokens only.** Colours come from the CSS variables in `src/app/globals.css`; new styling is a new class in that file. **Never inline a colour.** Reuse the existing classes (`card`, `card-title`, `card-grid`, `card-stack`, `table`, `badge`, `muted`, `faint`, `pos`, `neg`, `num`, `page-title`, `page-sub`, `section-title`, `banner`, `gauge`/`gauge-row`/`gauge-fill`/`over`, `counter`, `slot-col`, `slot-title`, `module-icon`, `entry-list`, `value-list`, `problem-list`, `filter-input`, `show-more`, `tree`, `tree-row`, `tree-toggle`). A width or a length may be inline (`style={{ width: \`${percent}%\` }}` in `Gauge.tsx` is the precedent); a colour may not.
- **Tabler icons** (`@tabler/icons-react`) for any iconography.
- **"Active character" = `readSession()?.activeCharacterId`**, falling back to the first character of `listCharacters()` — that is exactly `pickActive(characters, session?.activeCharacterId ?? null)`.
- **Unknown type ids** are shown as `Unknown type (id)` and excluded from the calculation (spec §7). **Engine exceptions** (`UnknownTypeError`, `DogmaCycleError`, `UnknownAttributeError`) are caught per fit; the editor shows "Could not compute" and the error goes to `console.error`.
- **Fits are never pushed to ESI.** `esi-fittings.write_fittings.v1` is not requested and no route writes to ESI (spec §2 ruling). Export is by text.
- Tests live in `tests/**` mirroring `src/**`. `npm test` = `vitest run` with `fileParallelism: false`; the environment is happy-dom with `tests/setup.ts`. DB tests use `tests/db/helpers.ts` (`resetDb`, `resetSde`) against `eve_test` on the local compose Postgres (`postgres://eve:eve@127.0.0.1:5432/eve_test`; start it with `docker compose -f compose.dev.yml up -d`).
- **No network in tests.** Route and client-store tests inject a fake `fetch`; engine-backed tests read the committed phase-4a snapshot `tests/fixtures/dogma/rifter.json` through `tests/dogma/fixture.ts`.
- **Pristine test output.** A test that exercises a caught-and-logged failure must stub `console.error` (`vi.spyOn(console, "error").mockImplementation(() => {})`) so the run stays clean.
- **Never log tokens; never print `.env`.** No new secret is introduced by this phase.
- Work happens on branch **`feature/phase5-fitting`**, created from `main` after phase 4 merges (Task 1, Step 1). **Every task ends with a commit.** Commit trailer: `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- VM: `ssh daniel@10.5.5.150`, site `https://eve.plasma66.com`, Ansible in `deploy/ansible`, Compose project directory `/opt/eve/src/deploy`.

## Decisions taken once, for the whole plan

These are the places the spec left a choice. They are recorded here so no task re-litigates them; each is repeated in the task that first depends on it.

1. **The engine runs client-side.** Spec §3 says so explicitly, so there is no server "compute this fit" route and no latency/debounce problem for the maths. Delivery is Task 5 (wire format), Task 6 (the two routes) and Task 12 (the browser store).
2. **`src/lib/dogma/serialize.ts` is the *split* wire format, not a duplicate of what exists.** Phase 4a already put `serialiseDogmaData` / `deserialiseDogmaData` / `DogmaDataJson` in `src/lib/dogma/data.ts` (whole-snapshot, used by the fixtures). The spec's `serialize.ts` is created for the meta/types **split** the HTTP layer needs, and re-exports nothing from `data.ts`.
3. **Four symbols are added to the `src/lib/dogma/index.ts` barrel** — `slotOfType`, `hardpointOfType`, `kindOfType`, `defaultStateOfType`. They already exist and are exported from `src/lib/dogma/fit.ts`; the barrel simply did not re-export them because phase 4b never needed them. Phase 5's slot logic does, and a client component must import from the barrel, not from a deep path.
4. **Ship bonuses are read on the server and passed as props.** `getTypeBonuses` needs Postgres, so `/fitting/[id]/page.tsx` reads it and hands `BonusView[]` to `<FitEditor>`. No `/api/sde/bonuses` route.
5. **Price staleness is measured on `market_prices.updated_at` alone.** No new column. A type with no row at all is stale. See Task 8 for the consequence and why it is acceptable.
6. **"All skills V" ids come from `GET /api/sde/types?category=16&limit=1000`** (spec §3). There are 588 category-16 types in the SDE, so one request covers it; the store caches the id list for the page's lifetime.
7. **The EFT round-trip fixture is a *real* Rifter.** The example in spec §5 is a hand-typed sketch: it shows four high-slot entries and two low-slot entries, but the SDE's Rifter (type 587) is **3 high / 3 mid / 4 low / 3 rig / 0 subsystem, 3 turret and 2 launcher hardpoints** (verified against `sde_type_attributes`). The committed fixture in Task 4 uses the real numbers and only types present in `tests/fixtures/dogma/rifter.json`, so `export(import(text)) === text` is actually provable.
8. **Fit list values need no engine run.** A fit's estimated value is the sum of its items' prices; `/fitting` uses `getPrices` + `rollUpValue` and never calls `fitStats`.

## File Structure

| Path | Responsibility |
|---|---|
| `src/lib/fits/doc.ts` | **Pure, isomorphic.** `FitDoc`, `FitItem`, `FitItemState`, state ⇄ `State`, `fitFromDoc`, `docItemsFromBuilt` |
| `db/schema.sql` | **Modified**: the `fits` and `fit_items` tables (spec §2) |
| `src/lib/db/fits.ts` | Repo: `listFits`, `getFit`, `createFit`, `updateFit`, `deleteFit` |
| `src/lib/fits/slots.ts` | **Pure.** Slot totals, the slot grid, add/replace/remove/state/charge/quantity edits, charge compatibility, allowed states |
| `src/lib/fits/eft.ts` | **Pure.** `exportEft`, `tokeniseEft`, `assignEftItems` |
| `src/lib/dogma/serialize.ts` | **Pure.** The meta/types wire split: `serialiseMeta`, `deserialiseMeta`, `serialiseTypes`, `deserialiseTypes`, `dogmaDataFrom` |
| `src/lib/dogma/index.ts` | **Modified**: re-export `slotOfType`, `hardpointOfType`, `kindOfType`, `defaultStateOfType` and the whole of `serialize.js` |
| `src/app/api/dogma/meta/route.ts` | `GET` — the day-cacheable attribute/effect/group blob, `ETag` = SDE build |
| `src/app/api/dogma/types/route.ts` | `GET ?ids=` — up to 200 type ids plus their `requiredSkillN` closure |
| `src/lib/sde/repo.ts` | **Modified**: `browseTypes`, `listMarketGroups`, `getMetaGroups`, `getTypesByNames` |
| `src/app/api/sde/types/route.ts` | `GET ?q=&category=&marketGroup=&limit=` |
| `src/app/api/sde/market-groups/route.ts` | `GET` — the whole market-group tree, day-cacheable |
| `src/lib/db/market-prices.ts` | **Modified**: `stalePriceIds(typeIds, maxAgeHours)` |
| `src/app/api/market/prices/route.ts` | `GET ?ids=` — serve `market_prices`, top up stale ids from Fuzzwork first |
| `src/app/api/characters/[id]/skills/route.ts` | `GET` — `{ skills: [{ skillId, level }], implants: [typeId] }` |
| `src/app/api/fits/route.ts` | `GET` list, `POST` create |
| `src/app/api/fits/[id]/route.ts` | `GET`, `PUT` (items replaced wholesale), `DELETE` |
| `src/lib/fits/clone.ts` | Server: `fitFromEftText`, `fitFromSavedFitting`, `fitFromAssetShip` — the three "make me a new fit" builders |
| `src/app/api/fits/import/route.ts` | `POST { text }` |
| `src/app/api/fits/from-fitting/route.ts` | `POST { characterId, fittingId }` |
| `src/app/api/fits/from-asset/route.ts` | `POST { characterId, itemId }` |
| `src/lib/fits/client-data.ts` | **Browser only, no React.** Memoised `getDogmaMeta`, `ensureTypes`, `dogmaData`, `getSkillContext`, `getPricesFor`, `resetDogmaStore` |
| `src/lib/fits/editor-view.ts` | **Pure.** `editorView(input)` → the whole editor as plain strings and numbers |
| `src/app/fitting/SlotLayout.tsx` | `"use client"` — the slot grid: charge selector, state toggle, remove |
| `src/app/fitting/StatsPanel.tsx` | `"use client"` — gauges, counters, problems, missing skills, value, bonuses |
| `src/app/fitting/ItemBrowser.tsx` | `"use client"` — search + market-group tree + "Fits this hull" + Fit button |
| `src/app/fitting/FitEditor.tsx` | `"use client"` — the state owner: `FitDoc`, derivation, autosave, toolbar, Export EFT modal |
| `src/app/fitting/[id]/page.tsx` | The editor route (server): loads the fit, the hull's bonuses and the character list |
| `src/lib/fits/load.ts` | Server: `loadFittingIndex(characterId)` — local fits, ESI fittings, assembled ships, one `loadDogmaData` |
| `src/app/fitting/FitList.tsx` | `"use client"` — New fit / Import EFT / clone pickers / delete |
| `src/app/fitting/page.tsx` | `/fitting` (server) — replaces the `ComingSoon` stub |
| `src/app/globals.css` | **Modified**: slot-grid, browser, toolbar, modal and empty-slot classes |
| `tests/db/helpers.ts` | **Modified**: `fits` added to the TRUNCATE list |
| `tests/db/schema.test.ts` | **Modified**: `fits` and `fit_items` in the table list |
| `tests/fits/doc.test.ts` | `fitFromDoc`, `docItemsFromBuilt`, state mapping |
| `tests/db/fits.test.ts` | The repo on real Postgres |
| `tests/fits/slots.test.ts` | Slot grid, first-free-slot, replace, over-count, charge compatibility, allowed states |
| `tests/fits/eft.test.ts` | Export, tokenise, assign, the fixture round trip, unknown names |
| `tests/fixtures/fits/rifter.eft` | The committed round-trip fixture |
| `tests/dogma/serialize.test.ts` | Meta/types split round trip against the `rifter` snapshot |
| `tests/api/dogma-routes.test.ts` | The two dogma routes with a mocked loader |
| `tests/api/sde-routes.test.ts` | The two SDE routes with mocked repos |
| `tests/db/sde-browse.test.ts` | `browseTypes`/`listMarketGroups`/`getMetaGroups`/`getTypesByNames` on real Postgres, seeded rows only |
| `tests/api/market-prices-route.test.ts` | Fresh hit, stale top-up, Fuzzwork failure |
| `tests/api/skills-route.test.ts` | The skills route |
| `tests/api/fits-routes.test.ts` | CRUD validation and 404s |
| `tests/api/fits-clone-routes.test.ts` | import / from-fitting / from-asset |
| `tests/fits/clone.test.ts` | The three builders against the `rifter` snapshot |
| `tests/fits/client-data.test.ts` | The store's memoisation and chunking with a fake `fetch` |
| `tests/fits/editor-view.test.ts` | The editor view model against the `rifter` snapshot |
| `tests/db/fits-load.test.ts` | `loadFittingIndex` on real Postgres + the mini SDE |
| `tests/components/slot-layout.test.tsx` | Empty slots, over marker, state toggle, remove |
| `tests/components/stats-panel.test.tsx` | Gauges, problems, missing skills, value |
| `tests/components/item-browser.test.tsx` | Search, result rows, Fit button, charge list |
| `tests/components/fit-editor.test.tsx` | Add a module → CPU gauge and problems change; offline removes its CPU; All-V changes the missing list |
| `tests/components/fit-list.test.tsx` | New fit, import, delete |

---

### Task 1: The fit document (`src/lib/fits/doc.ts`)

Spec §3's `FitDoc` — the thing React state holds and the thing the API stores. It is **pure and
isomorphic**: no `pg`, no `node:*`, safe inside a `"use client"` component. Everything downstream
(slots, EFT, the editor view model, the repo's row shape) is defined in terms of it, so it is built
first.

**Files:**
- Create: `src/lib/fits/doc.ts`, `tests/fits/doc.test.ts`
- Modify: `src/lib/dogma/index.ts` (four re-exports)

**Interfaces:**
- Consumes (phase 4a, verbatim from `src/lib/dogma/`):
```ts
// src/lib/dogma/index.ts (barrel)
enum State { Offline = 1, Online, Active, Overload }
interface Fit { data: DogmaData; ship: Item; character: Item; skills: Map<TypeId, Item>;
                implants: Item[]; modules: Slotted[]; drones: Item[] }
interface FitContext { data: DogmaData; skills: Map<TypeId, number>; implants: TypeId[] }
interface BuiltFit { fit: Fit; cargo: FitEntry[]; drones: FitEntry[]; unfittable: FitEntry[]; unknown: FitEntry[] }
interface FitEntry { typeId: TypeId; quantity: number; flag: string; name: string | null }
type SlotKind = "high" | "mid" | "low" | "rig" | "subsystem";
const DRONE_BAY_FLAG: string                         // "DroneBay"
function createFit(data: DogmaData, ship: Item): Fit
function makeItem(data: DogmaData, typeId: TypeId, over?: { kind?: ItemKind; state?: State }): Item
function makeSkill(data: DogmaData, typeId: TypeId, level: number): Item
function addModule(fit: Fit, item: Item, slot: SlotKind, index: number): Slotted
function attachCharge(module: Item, charge: Item): void
function slotFromFlag(flag: string): { slot: SlotKind; index: number } | null
function clearMemo(fit: Fit): void
class UnknownTypeError extends Error { readonly typeId: TypeId }
// src/lib/dogma/fit.ts — exported there, NOT yet re-exported by the barrel (this task fixes that)
function slotOfType(type: DogmaType): SlotKind | null
function hardpointOfType(type: DogmaType): Hardpoint | null
function kindOfType(type: DogmaType): ItemKind
function defaultStateOfType(data: DogmaData, type: DogmaType, kind: ItemKind): State
```
- Produces:
```ts
// src/lib/fits/doc.ts — pure, isomorphic
export type FitItemState = "offline" | "online" | "active" | "overload";
export const FIT_ITEM_STATES: readonly FitItemState[];      // in that order
export const CARGO_FLAG: string;                            // "Cargo"
export interface FitItem { typeId: number; quantity: number; flag: string; chargeTypeId: number | null; state: FitItemState }
export interface FitDoc { id: number; name: string; description: string; shipTypeId: number;
                          characterId: number | "all-v"; items: FitItem[] }
export interface DocFit { fit: Fit; drones: FitItem[]; cargo: FitItem[]; unknown: FitItem[] }
export function stateValue(state: FitItemState): State;
export function stateName(state: State): FitItemState;
export function flagFor(slot: SlotKind, index: number): string;      // inverse of slotFromFlag
export function fitFromDoc(doc: FitDoc, ctx: FitContext): DocFit;    // throws UnknownTypeError on an unknown hull
export function docItemsFromBuilt(built: BuiltFit): FitItem[];
```

**Decisions recorded here (do not re-litigate them):**
- `characterId` is `number | "all-v"`. The spec's "All skills V" option is a *character selection*,
  not a separate flag, so exactly one field decides whose skills apply. It is stored in the database
  as `NULL` (see Task 2) and read back as `"all-v"`.
- `fitFromDoc` lets `UnknownTypeError` from the **hull** escape — an unknown hull means there is no
  fit at all, and the caller renders "Could not compute" (Global Constraints). An unknown *item*
  is collected into `DocFit.unknown` and excluded, which is spec §7's rule.
- `docItemsFromBuilt` drops `BuiltFit.unfittable` (ESI's `Invalid` flag): those items were never
  fitted, so a clone starts without them. They are listed in the clone's response message instead
  (Task 11).
- The four `fit.ts` symbols are added to the barrel rather than deep-imported. A `"use client"`
  component must import from `src/lib/dogma/index.js` only, because that is the file whose import
  graph we keep provably free of `pg`.

- [ ] **Step 1: Create the branch**

```bash
cd /home/daniel/AI/Plasma/EVE
git checkout main && git pull --ff-only 2>/dev/null || true
git checkout -b feature/phase5-fitting
git log --oneline -1
```
Expected: a new branch off the commit where phase 4 merged. If `main` does not yet contain phase 4,
branch from `feature/phase4-ships` instead and say so in the first commit message.

- [ ] **Step 2: Re-export the four slot helpers from the barrel**

In `src/lib/dogma/index.ts`, extend the existing `export { … } from "./fit.js";` block so it reads:

```ts
export {
  CHARACTER_TYPE_ID, HARDPOINTS, SLOT_KINDS, UnknownTypeError, addModule, attachCharge, createFit,
  defaultStateOfType, effectiveState, fitItems, hardpointOf, hardpointOfType, kindOfType, makeItem,
  makeSkill, requiredSkills, slotOf, slotOfType,
  type Fit, type Hardpoint, type Item, type ItemDomain, type ItemKind, type SlotKind, type Slotted,
} from "./fit.js";
```

- [ ] **Step 3: Write the failing test**

`tests/fits/doc.test.ts`:
```tsx
import { describe, it, expect } from "vitest";
import { fixtureData } from "../dogma/fixture.js";
import { SLOT_KINDS, State, fitStats, slotFromFlag } from "../../src/lib/dogma/index.js";
import {
  CARGO_FLAG, docItemsFromBuilt, fitFromDoc, flagFor, stateName, stateValue,
  type FitDoc, type FitItem,
} from "../../src/lib/fits/doc.js";
import { fitFromAssets } from "../../src/lib/dogma/index.js";
import type { AssetRow } from "../../src/lib/db/character-assets.js";

const data = fixtureData("rifter");
// CPU Management V and Power Grid Management V only — the Rifter's own skill stays untrained.
const ctx = { data, skills: new Map([[3426, 5], [3413, 5]]), implants: [] };

function item(over: Partial<FitItem> & { typeId: number; flag: string }): FitItem {
  return { quantity: 1, chargeTypeId: null, state: "active", ...over };
}

const DOC: FitDoc = {
  id: 1, name: "Cheap Rifter", description: "", shipTypeId: 587, characterId: "all-v",
  items: [
    item({ typeId: 2889, flag: "HiSlot0", chargeTypeId: 12608 }),   // 200mm AutoCannon II + Hail S
    item({ typeId: 2048, flag: "LoSlot0", state: "offline" }),      // Damage Control II, offline
    item({ typeId: 2456, flag: "DroneBay", quantity: 2 }),          // Hobgoblin II ×2
    item({ typeId: 12608, flag: CARGO_FLAG, quantity: 600 }),       // spare Hail S
    item({ typeId: 999999, flag: "HiSlot1" }),                      // not in this SDE build
  ],
};

describe("flagFor", () => {
  it("is the inverse of slotFromFlag for every slot kind", () => {
    for (const slot of SLOT_KINDS) {
      expect(slotFromFlag(flagFor(slot, 3))).toEqual({ slot, index: 3 });
    }
    expect(flagFor("high", 0)).toBe("HiSlot0");
    expect(flagFor("subsystem", 2)).toBe("SubSystemSlot2");
  });
});

describe("state names", () => {
  it("round-trips every state", () => {
    expect(stateName(stateValue("offline"))).toBe("offline");
    expect(stateName(stateValue("online"))).toBe("online");
    expect(stateName(stateValue("active"))).toBe("active");
    expect(stateName(stateValue("overload"))).toBe("overload");
    expect(stateValue("overload")).toBe(State.Overload);
  });
});

describe("fitFromDoc", () => {
  it("places modules, attaches the charge and honours the stored state", () => {
    const built = fitFromDoc(DOC, ctx);
    expect(built.fit.modules.map((m) => [m.slot, m.index, m.item.typeId])).toEqual([
      ["high", 0, 2889],
      ["low", 0, 2048],
    ]);
    expect(built.fit.modules[0].item.charge?.typeId).toBe(12608);
    expect(built.fit.modules[1].item.state).toBe(State.Offline);
  });

  it("fills the drone bay and the cargo hold, and lists unknown types without modelling them", () => {
    const built = fitFromDoc(DOC, ctx);
    expect(built.drones.map((d) => [d.typeId, d.quantity])).toEqual([[2456, 2]]);
    expect(built.cargo.map((c) => [c.typeId, c.quantity])).toEqual([[12608, 600]]);
    expect(built.unknown.map((u) => u.typeId)).toEqual([999999]);
    expect(built.fit.drones.map((d) => d.typeId)).toEqual([2456]);
  });

  it("charges an offline module nothing — the autocannon's 9 tf is the whole CPU bill", () => {
    const stats = fitStats(fitFromDoc(DOC, ctx).fit);
    expect(stats.cpu.used).toBe(9);          // Damage Control II's 30 tf is not charged while offline
    expect(stats.cpu.output).toBe(162.5);    // Rifter, CPU Management V
    expect(stats.slots.low.total).toBe(4);
    expect(stats.slots.high.total).toBe(3);
  });
});

describe("docItemsFromBuilt", () => {
  it("turns a phase-4 BuiltFit into doc items, charge and state included", () => {
    const ship: AssetRow = {
      itemId: 1000, typeId: 587, quantity: 1, locationId: 60003760, locationType: "station",
      locationFlag: "Hangar", isSingleton: true, isBlueprintCopy: false, name: "Scarlet Dart",
    };
    const children: AssetRow[] = [
      { ...ship, itemId: 1001, typeId: 2889, locationId: 1000, locationFlag: "HiSlot0", name: null },
      { ...ship, itemId: 1002, typeId: 12608, quantity: 400, locationId: 1000, locationFlag: "HiSlot0", isSingleton: false, name: null },
      { ...ship, itemId: 1003, typeId: 2456, quantity: 5, locationId: 1000, locationFlag: "DroneBay", isSingleton: false, name: null },
    ];
    expect(docItemsFromBuilt(fitFromAssets(ship, children, ctx))).toEqual([
      { typeId: 2889, quantity: 1, flag: "HiSlot0", chargeTypeId: 12608, state: "active" },
      { typeId: 2456, quantity: 5, flag: "DroneBay", chargeTypeId: null, state: "active" },
    ]);
  });
});
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `npx vitest run tests/fits/doc.test.ts`
Expected: FAIL — `Failed to resolve import "../../src/lib/fits/doc.js"`.

- [ ] **Step 5: Write the implementation**

`src/lib/fits/doc.ts`:
```ts
/**
 * The fit document: what React state holds, what the API stores and what EFT text parses into.
 * Pure and isomorphic — this file and everything it imports must stay safe inside a client
 * component, so nothing here may reach for `pg`, `node:*` or `src/lib/dogma/sde-loader.js`.
 */
import {
  DRONE_BAY_FLAG, State, addModule, attachCharge, clearMemo, createFit, makeItem, makeSkill,
  slotFromFlag, type BuiltFit, type Fit, type FitContext, type SlotKind,
} from "../dogma/index.js";

export type FitItemState = "offline" | "online" | "active" | "overload";
/** Ascending by power draw — the order the state toggle cycles through. */
export const FIT_ITEM_STATES: readonly FitItemState[] = ["offline", "online", "active", "overload"];
/** ESI's fitting-flag vocabulary for the cargo hold (spec §2). */
export const CARGO_FLAG = "Cargo";

export interface FitItem {
  typeId: number;
  quantity: number;
  /** HiSlot0..7 | MedSlot0..7 | LoSlot0..7 | RigSlot0..2 | SubSystemSlot0..3 | DroneBay | Cargo */
  flag: string;
  chargeTypeId: number | null;
  state: FitItemState;
}

export interface FitDoc {
  id: number;
  name: string;
  description: string;
  shipTypeId: number;
  /** Whose skills the numbers use. `"all-v"` is the synthetic every-skill-at-5 pilot (spec §3). */
  characterId: number | "all-v";
  items: FitItem[];
}

/** What a `FitDoc` becomes once the engine has seen it. */
export interface DocFit {
  fit: Fit;
  drones: FitItem[];
  cargo: FitItem[];
  /** Items whose type this `DogmaData` does not know — listed, never modelled (spec §7). */
  unknown: FitItem[];
}

const STATE_VALUES: Record<FitItemState, State> = {
  offline: State.Offline, online: State.Online, active: State.Active, overload: State.Overload,
};

export function stateValue(state: FitItemState): State {
  return STATE_VALUES[state];
}

export function stateName(state: State): FitItemState {
  switch (state) {
    case State.Offline: return "offline";
    case State.Online: return "online";
    case State.Overload: return "overload";
    default: return "active";
  }
}

const SLOT_FLAG_PREFIX: Record<SlotKind, string> = {
  high: "HiSlot", mid: "MedSlot", low: "LoSlot", rig: "RigSlot", subsystem: "SubSystemSlot",
};

/** The inverse of phase 4a's `slotFromFlag`. */
export function flagFor(slot: SlotKind, index: number): string {
  return `${SLOT_FLAG_PREFIX[slot]}${index}`;
}

/**
 * Build the engine's `Fit` from a document. An unknown **hull** throws `UnknownTypeError` — there is
 * no fit to show — while an unknown item is collected and skipped (spec §7).
 */
export function fitFromDoc(doc: FitDoc, ctx: FitContext): DocFit {
  const fit = createFit(ctx.data, makeItem(ctx.data, doc.shipTypeId));
  for (const [typeId, level] of ctx.skills) {
    if (ctx.data.types.has(typeId)) fit.skills.set(typeId, makeSkill(ctx.data, typeId, level));
  }
  for (const typeId of ctx.implants) {
    if (ctx.data.types.has(typeId)) fit.implants.push(makeItem(ctx.data, typeId));
  }

  const out: DocFit = { fit, drones: [], cargo: [], unknown: [] };
  for (const entry of doc.items) {
    if (!ctx.data.types.has(entry.typeId)) { out.unknown.push(entry); continue; }
    const place = slotFromFlag(entry.flag);
    if (place === null) {
      if (entry.flag === DRONE_BAY_FLAG) {
        out.drones.push(entry);
        // One modelled drone per row is enough for the skill requirements; drone damage is out of
        // scope (spec §9), exactly as phase 4a's asset builder does it.
        fit.drones.push(makeItem(ctx.data, entry.typeId));
      } else {
        out.cargo.push(entry);
      }
      continue;
    }
    const item = makeItem(ctx.data, entry.typeId, { state: stateValue(entry.state) });
    if (entry.chargeTypeId !== null) {
      if (ctx.data.types.has(entry.chargeTypeId)) {
        attachCharge(item, makeItem(ctx.data, entry.chargeTypeId));
      } else {
        out.unknown.push({
          typeId: entry.chargeTypeId, quantity: 1, flag: entry.flag, chargeTypeId: null, state: entry.state,
        });
      }
    }
    addModule(fit, item, place.slot, place.index);
  }

  clearMemo(fit);
  return out;
}

/**
 * Clone a phase-4 `BuiltFit` (an assembled ship or a saved ESI fitting) into doc items.
 * `built.unfittable` is deliberately dropped: those items carry ESI's `Invalid` flag and were never
 * fitted, so a clone starts without them.
 */
export function docItemsFromBuilt(built: BuiltFit): FitItem[] {
  const items: FitItem[] = [];
  for (const { item, slot, index } of built.fit.modules) {
    items.push({
      typeId: item.typeId,
      quantity: 1,
      flag: flagFor(slot, index),
      chargeTypeId: item.charge?.typeId ?? null,
      state: stateName(item.state),
    });
  }
  for (const drone of built.drones) {
    items.push({ typeId: drone.typeId, quantity: drone.quantity, flag: DRONE_BAY_FLAG, chargeTypeId: null, state: "active" });
  }
  for (const entry of built.cargo) {
    items.push({ typeId: entry.typeId, quantity: entry.quantity, flag: CARGO_FLAG, chargeTypeId: null, state: "active" });
  }
  return items;
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `npx vitest run tests/fits/doc.test.ts && npm run typecheck`
Expected: 6 tests pass; `tsc --noEmit` clean.

- [ ] **Step 7: Commit**

```bash
git add src/lib/fits/doc.ts src/lib/dogma/index.ts tests/fits/doc.test.ts
git commit -m "$(cat <<'EOM'
feat(fits): the FitDoc model and its engine derivation

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOM
)"
```

---

### Task 2: The `fits` / `fit_items` tables and their repo

Spec §2's schema, verbatim, plus the five repo calls the API routes need. `fit_items` cascades from
`fits`; `fits.character_id` is `ON DELETE SET NULL`, which is exactly the "All skills V" state.

**Files:**
- Create: `src/lib/db/fits.ts`, `tests/db/fits.test.ts`
- Modify: `db/schema.sql` (append), `tests/db/helpers.ts` (TRUNCATE list), `tests/db/schema.test.ts` (table list)

**Interfaces:**
- Consumes (phase 1, verbatim):
```ts
// src/lib/db/client.ts
export function getPool(): Pool
```
plus `FitItem` / `FitItemState` from Task 1:
```ts
export interface FitItem { typeId: number; quantity: number; flag: string; chargeTypeId: number | null; state: FitItemState }
export type FitItemState = "offline" | "online" | "active" | "overload";
```
- Produces:
```ts
// src/lib/db/fits.ts
export interface FitRow {
  id: number; name: string; description: string; shipTypeId: number;
  characterId: number | null; createdAt: Date; updatedAt: Date; items: FitItem[];
}
export interface FitInput { name: string; shipTypeId: number; description?: string;
                            characterId?: number | null; items?: FitItem[] }
export interface FitPatch { name?: string; description?: string; characterId?: number | null; items?: FitItem[] }
export function listFits(): Promise<FitRow[]>;              // newest update first
export function getFit(id: number): Promise<FitRow | null>;
export function createFit(input: FitInput): Promise<FitRow>;
export function updateFit(id: number, patch: FitPatch): Promise<FitRow | null>;
export function deleteFit(id: number): Promise<boolean>;
```

**Decisions recorded here (do not re-litigate them):**
- `character_id` is `bigint` and `pg` hands bigints back as **strings**; the repo converts with
  `Number(...)` exactly once, like every phase-3 repo. `NULL` stays `null` at the repo boundary and
  becomes `"all-v"` only in the view layer (Task 10 maps it).
- `updateFit` replaces `fit_items` **wholesale** inside one transaction (spec §6: "items replaced
  wholesale"). A partial item write is worse than a rejected one.
- `updateFit` with `items` omitted leaves the items alone — that is what a rename does.
- `listFits` returns each fit **with its items**, because the list page prices them (spec §4's
  "value" column). A handful of fits with a dozen items each is two queries, not N+1.
- There is no per-character scoping: fits are Daniel's, the whole site is single-user behind SSO,
  and spec §2 puts `character_id` on the fit only to choose *whose skills* the numbers use.

- [ ] **Step 1: Write the failing test**

`tests/db/fits.test.ts`:
```ts
import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import type { Pool } from "pg";
import { resetDb } from "./helpers.js";
import { closePool } from "../../src/lib/db/client.js";
import { createFit, deleteFit, getFit, listFits, updateFit } from "../../src/lib/db/fits.js";
import type { FitItem } from "../../src/lib/fits/doc.js";

let pool: Pool;
const CID = 90000101;

const GUN: FitItem = { typeId: 2889, quantity: 1, flag: "HiSlot0", chargeTypeId: 12608, state: "active" };
const DC: FitItem = { typeId: 2048, quantity: 1, flag: "LoSlot0", chargeTypeId: null, state: "offline" };
const DRONES: FitItem = { typeId: 2456, quantity: 5, flag: "DroneBay", chargeTypeId: null, state: "active" };

beforeAll(async () => { pool = await resetDb(); });
afterAll(async () => { await closePool(); });
beforeEach(async () => {
  await pool.query("TRUNCATE fits RESTART IDENTITY CASCADE");
  await pool.query("TRUNCATE characters CASCADE");
  await pool.query(
    `INSERT INTO characters (id, name, refresh_token_enc) VALUES ($1, 'Mara Vexley', 'enc')`, [CID]);
});

describe("the fits repo", () => {
  it("creates a fit with its items and reads it back in order", async () => {
    const created = await createFit({
      name: "Cheap Rifter", shipTypeId: 587, description: "brawler", characterId: CID,
      items: [GUN, DC, DRONES],
    });
    expect(created.id).toBeGreaterThan(0);
    expect(created.characterId).toBe(CID);
    const read = await getFit(created.id);
    expect(read?.name).toBe("Cheap Rifter");
    expect(read?.description).toBe("brawler");
    expect(read?.shipTypeId).toBe(587);
    expect(read?.items).toEqual([GUN, DC, DRONES]);
  });

  it("defaults description, character and items", async () => {
    const created = await createFit({ name: "Empty", shipTypeId: 587 });
    expect(created).toMatchObject({ description: "", characterId: null, items: [] });
  });

  it("replaces the items wholesale and bumps updated_at", async () => {
    const created = await createFit({ name: "Cheap Rifter", shipTypeId: 587, items: [GUN, DC] });
    const updated = await updateFit(created.id, { name: "Renamed", items: [DRONES] });
    expect(updated?.name).toBe("Renamed");
    expect(updated?.items).toEqual([DRONES]);
    expect(updated!.updatedAt.getTime()).toBeGreaterThanOrEqual(created.updatedAt.getTime());
  });

  it("leaves the items alone when the patch omits them", async () => {
    const created = await createFit({ name: "Cheap Rifter", shipTypeId: 587, items: [GUN] });
    const renamed = await updateFit(created.id, { name: "Just a rename" });
    expect(renamed?.items).toEqual([GUN]);
  });

  it("stores a null character as the All-V pilot", async () => {
    const created = await createFit({ name: "Theory", shipTypeId: 587, characterId: CID });
    expect((await updateFit(created.id, { characterId: null }))?.characterId).toBeNull();
  });

  it("returns null for an unknown id and false for an unknown delete", async () => {
    expect(await getFit(99999)).toBeNull();
    expect(await updateFit(99999, { name: "nope" })).toBeNull();
    expect(await deleteFit(99999)).toBe(false);
  });

  it("cascades the items when the fit is deleted", async () => {
    const created = await createFit({ name: "Cheap Rifter", shipTypeId: 587, items: [GUN, DC] });
    expect(await deleteFit(created.id)).toBe(true);
    const { rows } = await pool.query("SELECT count(*)::int AS n FROM fit_items");
    expect(rows[0].n).toBe(0);
  });

  it("nulls the character when the character row goes away", async () => {
    const created = await createFit({ name: "Cheap Rifter", shipTypeId: 587, characterId: CID });
    await pool.query("DELETE FROM characters WHERE id = $1", [CID]);
    expect((await getFit(created.id))?.characterId).toBeNull();
  });

  it("lists fits newest-update first", async () => {
    const a = await createFit({ name: "A", shipTypeId: 587 });
    const b = await createFit({ name: "B", shipTypeId: 587 });
    await updateFit(a.id, { name: "A again" });
    expect((await listFits()).map((f) => f.name)).toEqual(["A again", "B"]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
docker compose -f compose.dev.yml up -d
npx vitest run tests/db/fits.test.ts
```
Expected: FAIL — `Failed to resolve import "../../src/lib/db/fits.js"`.

- [ ] **Step 3: Add the tables to `db/schema.sql`**

Append at the end of the file:
```sql
-- ── Phase 5: the fitting designer ───────────────────────────────────────────
-- Our own fits. They are never pushed to ESI (spec §2 ruling); export is by EFT text.
-- character_id chooses WHOSE SKILLS the numbers use; NULL means the "All skills V" pilot, which is
-- also what a deleted character degrades to.
CREATE TABLE IF NOT EXISTS fits (
  id            serial PRIMARY KEY,
  name          text NOT NULL,
  ship_type_id  int NOT NULL,
  description   text NOT NULL DEFAULT '',
  character_id  bigint REFERENCES characters(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- idx is the position in the document, so the editor's order survives a round trip.
CREATE TABLE IF NOT EXISTS fit_items (
  fit_id          int NOT NULL REFERENCES fits(id) ON DELETE CASCADE,
  idx             int NOT NULL,
  type_id         int NOT NULL,
  quantity        int NOT NULL DEFAULT 1,
  flag            text NOT NULL,
  charge_type_id  int,
  state           text NOT NULL DEFAULT 'active' CHECK (state IN ('offline','online','active','overload')),
  PRIMARY KEY (fit_id, idx)
);
CREATE INDEX IF NOT EXISTS fits_updated_idx ON fits (updated_at DESC);
```

- [ ] **Step 4: Add the tables to the test helpers**

In `tests/db/helpers.ts`, add `fits` to the TRUNCATE statement (`fit_items` follows by CASCADE):
```ts
  await pool.query("TRUNCATE sync_runs, esi_cache, characters, accounts, universe_names, structures, market_prices, fits RESTART IDENTITY CASCADE");
```
In `tests/db/schema.test.ts`, add `"fits"` and `"fit_items"` to the expected table list.

- [ ] **Step 5: Write the repo**

`src/lib/db/fits.ts`:
```ts
import { getPool } from "./client.js";
import type { FitItem, FitItemState } from "../fits/doc.js";

export interface FitRow {
  id: number; name: string; description: string; shipTypeId: number;
  characterId: number | null; createdAt: Date; updatedAt: Date; items: FitItem[];
}
export interface FitInput {
  name: string; shipTypeId: number; description?: string; characterId?: number | null; items?: FitItem[];
}
export interface FitPatch {
  name?: string; description?: string; characterId?: number | null; items?: FitItem[];
}

interface HeadRow {
  id: number; name: string; description: string; shipTypeId: number;
  characterId: string | null; createdAt: Date; updatedAt: Date;
}
interface ItemDbRow {
  fitId: number; typeId: number; quantity: number; flag: string;
  chargeTypeId: number | null; state: FitItemState;
}

const HEAD_COLS = `id, name, description, ship_type_id AS "shipTypeId",
  character_id AS "characterId", created_at AS "createdAt", updated_at AS "updatedAt"`;
const ITEM_COLS = `fit_id AS "fitId", type_id AS "typeId", quantity, flag,
  charge_type_id AS "chargeTypeId", state`;

/** bigint columns arrive from pg as strings. */
const head = (r: HeadRow, items: FitItem[]): FitRow => ({
  ...r, characterId: r.characterId === null ? null : Number(r.characterId), items,
});
const item = (r: ItemDbRow): FitItem => ({
  typeId: r.typeId, quantity: r.quantity, flag: r.flag, chargeTypeId: r.chargeTypeId, state: r.state,
});

export async function listFits(): Promise<FitRow[]> {
  const pool = getPool();
  const { rows } = await pool.query<HeadRow>(`SELECT ${HEAD_COLS} FROM fits ORDER BY updated_at DESC, id DESC`);
  if (rows.length === 0) return [];
  const { rows: items } = await pool.query<ItemDbRow>(
    `SELECT ${ITEM_COLS} FROM fit_items WHERE fit_id = ANY($1::int[]) ORDER BY fit_id, idx`,
    [rows.map((r) => r.id)]);
  const byFit = new Map<number, FitItem[]>();
  for (const r of items) {
    const list = byFit.get(r.fitId);
    if (list) list.push(item(r)); else byFit.set(r.fitId, [item(r)]);
  }
  return rows.map((r) => head(r, byFit.get(r.id) ?? []));
}

export async function getFit(id: number): Promise<FitRow | null> {
  const pool = getPool();
  const { rows } = await pool.query<HeadRow>(`SELECT ${HEAD_COLS} FROM fits WHERE id = $1`, [id]);
  if (!rows[0]) return null;
  const { rows: items } = await pool.query<ItemDbRow>(
    `SELECT ${ITEM_COLS} FROM fit_items WHERE fit_id = $1 ORDER BY idx`, [id]);
  return head(rows[0], items.map(item));
}

export async function createFit(input: FitInput): Promise<FitRow> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query<HeadRow>(
      `INSERT INTO fits (name, ship_type_id, description, character_id)
       VALUES ($1, $2, $3, $4) RETURNING ${HEAD_COLS}`,
      [input.name, input.shipTypeId, input.description ?? "",
       input.characterId === undefined || input.characterId === null ? null : String(input.characterId)]);
    const items = input.items ?? [];
    await writeItems(client, rows[0].id, items);
    await client.query("COMMIT");
    return head(rows[0], items);
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

export async function updateFit(id: number, patch: FitPatch): Promise<FitRow | null> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query<HeadRow>(
      `UPDATE fits SET name = COALESCE($2, name), description = COALESCE($3, description),
         character_id = CASE WHEN $4 THEN $5::bigint ELSE character_id END, updated_at = now()
       WHERE id = $1 RETURNING ${HEAD_COLS}`,
      [id, patch.name ?? null, patch.description ?? null,
       "characterId" in patch, patch.characterId == null ? null : String(patch.characterId)]);
    if (!rows[0]) { await client.query("ROLLBACK"); return null; }
    if (patch.items !== undefined) {
      await client.query("DELETE FROM fit_items WHERE fit_id = $1", [id]);
      await writeItems(client, id, patch.items);
    }
    await client.query("COMMIT");
    if (patch.items !== undefined) return head(rows[0], patch.items);
    const { rows: items } = await getPool().query<ItemDbRow>(
      `SELECT ${ITEM_COLS} FROM fit_items WHERE fit_id = $1 ORDER BY idx`, [id]);
    return head(rows[0], items.map(item));
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

export async function deleteFit(id: number): Promise<boolean> {
  const res = await getPool().query("DELETE FROM fits WHERE id = $1", [id]);
  return (res.rowCount ?? 0) > 0;
}

/** One statement for the whole item list — `idx` is the array position, so order is preserved. */
async function writeItems(
  client: { query: (text: string, values: unknown[]) => Promise<unknown> }, fitId: number, items: FitItem[],
): Promise<void> {
  if (items.length === 0) return;
  await client.query(
    `INSERT INTO fit_items (fit_id, idx, type_id, quantity, flag, charge_type_id, state)
     SELECT $1, * FROM unnest($2::int[], $3::int[], $4::int[], $5::text[], $6::int[], $7::text[])`,
    [fitId, items.map((_, i) => i), items.map((i) => i.typeId), items.map((i) => i.quantity),
     items.map((i) => i.flag), items.map((i) => i.chargeTypeId), items.map((i) => i.state)]);
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run tests/db/fits.test.ts tests/db/schema.test.ts && npm run typecheck`
Expected: 9 fits tests plus the schema test pass; `tsc --noEmit` clean.

- [ ] **Step 7: Commit**

```bash
git add db/schema.sql src/lib/db/fits.ts tests/db/fits.test.ts tests/db/helpers.ts tests/db/schema.test.ts
git commit -m "$(cat <<'EOM'
feat(db): fits and fit_items tables with their repo

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOM
)"
```

---

### Task 3: Slot layout and the edit operations (`src/lib/fits/slots.ts`)

Spec §4's left-hand column: rows sized by the hull's slot counts, extras beyond the count marked
`.over`, a state toggle "where the type allows", and a charge list "filtered by `chargeGroup*`
(604, 605, 606, 609, 610) and `chargeSize` (128) ≤ the module's". All of it is pure arithmetic over
a `FitDoc`, so all of it is unit-tested here and the components in Tasks 14–16 stay dumb.

**Files:**
- Create: `src/lib/fits/slots.ts`, `tests/fits/slots.test.ts`

**Interfaces:**
- Consumes (Task 1, plus phase 4a verbatim):
```ts
// src/lib/fits/doc.ts
export interface FitDoc { id: number; name: string; description: string; shipTypeId: number;
                          characterId: number | "all-v"; items: FitItem[] }
export interface FitItem { typeId: number; quantity: number; flag: string; chargeTypeId: number | null; state: FitItemState }
export type FitItemState = "offline" | "online" | "active" | "overload";
export const FIT_ITEM_STATES: readonly FitItemState[];
export const CARGO_FLAG: string;
export function flagFor(slot: SlotKind, index: number): string;
export function stateName(state: State): FitItemState;
// src/lib/dogma/index.ts
const ATTR: { lowSlots: 12; medSlots: 13; hiSlots: 14; rigSlots: 1137; maxSubSystems: 1367; … };
const EFFECT: { online: 16; … };
const CATEGORY: { ship: 6; module: 7; charge: 8; skill: 16; drone: 18; implant: 20; subsystem: 32; fighter: 87 };
const SLOT_KINDS: readonly SlotKind[]                 // ["high","mid","low","rig","subsystem"]
const DRONE_BAY_FLAG: string                          // "DroneBay"
interface DogmaType { id: TypeId; groupId: GroupId; categoryId: number; name: string | null;
                      attrs: Map<AttrId, number>; effects: Map<EffectId, boolean> }
function getAttr(fit: Fit, item: Item, attrId: AttrId): number
function slotFromFlag(flag: string): { slot: SlotKind; index: number } | null
function slotOfType(type: DogmaType): SlotKind | null
function kindOfType(type: DogmaType): ItemKind
function defaultStateOfType(data: DogmaData, type: DogmaType, kind: ItemKind): State
```
- Produces:
```ts
// src/lib/fits/slots.ts — pure, isomorphic
export type SlotTotals = Record<SlotKind, number>;
export interface SlotCell { slot: SlotKind; index: number; item: FitItem | null; over: boolean }
export const CHARGE_GROUP_ATTRS: readonly number[];    // [604, 605, 606, 609, 610]
export const CHARGE_SIZE_ATTR: number;                 // 128
export function slotTotals(fit: Fit): SlotTotals;
export function slotGrid(doc: FitDoc, totals: SlotTotals): Record<SlotKind, SlotCell[]>;
export function firstFreeIndex(doc: FitDoc, slot: SlotKind, totals: SlotTotals): number | null;
export function fitTypeInto(doc: FitDoc, data: DogmaData, typeId: number, totals: SlotTotals,
                            at?: { slot: SlotKind; index: number }): FitDoc;
export function removeSlot(doc: FitDoc, slot: SlotKind, index: number): FitDoc;
export function setSlotState(doc: FitDoc, slot: SlotKind, index: number, state: FitItemState): FitDoc;
export function setSlotCharge(doc: FitDoc, slot: SlotKind, index: number, chargeTypeId: number | null): FitDoc;
export function setEntryQuantity(doc: FitDoc, flag: string, typeId: number, quantity: number): FitDoc;
export function chargeFits(moduleType: DogmaType, chargeType: DogmaType): boolean;
export function allowedStates(data: DogmaData, type: DogmaType): FitItemState[];
```

**Decisions recorded here (do not re-litigate them):**
- **Every edit returns a new `FitDoc`.** React state and undo-by-history both want immutability, and
  a pure function is what makes the whole editor testable without a DOM.
- `slotTotals` reads the hull's slot attributes **through the engine** (`getAttr`), not from the raw
  type, so a fitted subsystem or slot-modifier module changes the grid live. It repeats `fitStats`'s
  "SDE still says 5 subsystems, EVE has 4" correction because the two must agree.
- **Over-fitting is allowed, not blocked.** Spec §4 says extras "are shown with an `.over` marker",
  and `validateFit` already raises a `slot` problem, so the editor lets you do it and tells you.
  `over` is exactly `index >= totals[slot]` — the same comparison `validateFit` makes.
- `chargeFits` requires the module to declare **at least one** `chargeGroup*`; a module with none
  (a Damage Control, a shield extender) takes no charge and its charge selector is not rendered.
  When either side omits `chargeSize` (128) the size test passes — CCP only sets it where it bites.
- `allowedStates` derives the toggle from the type's own effects: `offline` always; the type's own
  `defaultStateOfType` always (otherwise the state a fresh module is created in would not be
  offerable — a rig defaults to **Online** and carries no effect 16); `online` when the type carries
  effect 16; `active` / `overload` when any of its effects has that state. A rig therefore yields
  `["offline", "online"]` and a Damage Control II `["offline", "online"]`, while a 200mm AutoCannon II
  yields all four. The component renders the toggle only when the list has more than one entry.
- A type with no slot marker that the Fit button is pressed on goes to the **drone bay** when
  `kindOfType` says `"drone"` (categories 18 and 87) and to the **cargo hold** otherwise, merging
  by quantity with an existing entry of the same type. That is how you put spare ammo in the hold.

- [ ] **Step 1: Write the failing test**

`tests/fits/slots.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { fixtureData } from "../dogma/fixture.js";
import { createFit, makeItem } from "../../src/lib/dogma/index.js";
import { CARGO_FLAG, type FitDoc, type FitItem } from "../../src/lib/fits/doc.js";
import {
  allowedStates, chargeFits, firstFreeIndex, fitTypeInto, removeSlot, setEntryQuantity,
  setSlotCharge, setSlotState, slotGrid, slotTotals,
} from "../../src/lib/fits/slots.js";

const data = fixtureData("rifter");
const RIFTER = { high: 3, mid: 3, low: 4, rig: 3, subsystem: 0 };

function item(over: Partial<FitItem> & { typeId: number; flag: string }): FitItem {
  return { quantity: 1, chargeTypeId: null, state: "active", ...over };
}
function doc(items: FitItem[]): FitDoc {
  return { id: 1, name: "Cheap Rifter", description: "", shipTypeId: 587, characterId: "all-v", items };
}

describe("slotTotals", () => {
  it("reads the hull's slot counts through the engine", () => {
    const fit = createFit(data, makeItem(data, 587));
    expect(slotTotals(fit)).toEqual(RIFTER);
  });
});

describe("slotGrid", () => {
  it("sizes each row by the hull and leaves the empty cells null", () => {
    const grid = slotGrid(doc([item({ typeId: 2889, flag: "HiSlot0" })]), RIFTER);
    expect(grid.high.map((c) => c.item?.typeId ?? null)).toEqual([2889, null, null]);
    expect(grid.low).toHaveLength(4);
    expect(grid.subsystem).toEqual([]);
    expect(grid.high.every((c) => !c.over)).toBe(true);
  });

  it("extends the row and marks the extras when a module sits past the hull's count", () => {
    const grid = slotGrid(doc([
      item({ typeId: 2889, flag: "HiSlot0" }),
      item({ typeId: 2889, flag: "HiSlot4" }),
    ]), RIFTER);
    expect(grid.high).toHaveLength(5);
    expect(grid.high.map((c) => c.over)).toEqual([false, false, false, true, true]);
    expect(grid.high[4].item?.typeId).toBe(2889);
  });
});

describe("firstFreeIndex", () => {
  it("finds the first gap, and reports a full row as null", () => {
    const one = doc([item({ typeId: 2889, flag: "HiSlot0" })]);
    expect(firstFreeIndex(one, "high", RIFTER)).toBe(1);
    const full = doc([0, 1, 2].map((i) => item({ typeId: 2889, flag: `HiSlot${i}` })));
    expect(firstFreeIndex(full, "high", RIFTER)).toBeNull();
    expect(firstFreeIndex(full, "mid", RIFTER)).toBe(0);
  });
});

describe("fitTypeInto", () => {
  it("puts a module in the first free matching slot with its default state", () => {
    const next = fitTypeInto(doc([item({ typeId: 2889, flag: "HiSlot0" })]), data, 2889, RIFTER);
    expect(next.items.map((i) => [i.flag, i.typeId, i.state])).toEqual([
      ["HiSlot0", 2889, "active"],
      ["HiSlot1", 2889, "active"],
    ]);
  });

  it("replaces the selected slot instead of adding, keeping the document order", () => {
    const before = doc([
      item({ typeId: 2889, flag: "HiSlot0", chargeTypeId: 12608 }),
      item({ typeId: 2048, flag: "LoSlot0" }),
    ]);
    const next = fitTypeInto(before, data, 4256, RIFTER, { slot: "high", index: 0 });
    expect(next.items.map((i) => [i.flag, i.typeId, i.chargeTypeId])).toEqual([
      ["HiSlot0", 4256, null],
      ["LoSlot0", 2048, null],
    ]);
  });

  it("over-fits past the hull's count rather than refusing", () => {
    const full = doc([0, 1, 2].map((i) => item({ typeId: 2889, flag: `HiSlot${i}` })));
    const next = fitTypeInto(full, data, 2889, RIFTER);
    expect(next.items[3].flag).toBe("HiSlot3");
    expect(slotGrid(next, RIFTER).high[3].over).toBe(true);
  });

  it("sends a drone to the drone bay and ammunition to the cargo hold, merging quantities", () => {
    const withDrone = fitTypeInto(doc([]), data, 2456, RIFTER);
    expect(withDrone.items).toEqual([
      { typeId: 2456, quantity: 1, flag: "DroneBay", chargeTypeId: null, state: "active" },
    ]);
    const twoDrones = fitTypeInto(withDrone, data, 2456, RIFTER);
    expect(twoDrones.items[0].quantity).toBe(2);
    const withAmmo = fitTypeInto(twoDrones, data, 12608, RIFTER);
    expect(withAmmo.items[1]).toEqual(
      { typeId: 12608, quantity: 1, flag: CARGO_FLAG, chargeTypeId: null, state: "active" });
  });

  it("ignores a type this SDE build does not know", () => {
    const before = doc([]);
    expect(fitTypeInto(before, data, 999999, RIFTER)).toBe(before);
  });
});

describe("the per-slot edits", () => {
  const before = doc([
    item({ typeId: 2889, flag: "HiSlot0", chargeTypeId: 12608 }),
    item({ typeId: 2048, flag: "LoSlot0" }),
  ]);

  it("removes, restates and recharges exactly one slot", () => {
    expect(removeSlot(before, "high", 0).items.map((i) => i.flag)).toEqual(["LoSlot0"]);
    expect(setSlotState(before, "low", 0, "offline").items[1].state).toBe("offline");
    expect(setSlotCharge(before, "high", 0, 27339).items[0].chargeTypeId).toBe(27339);
    expect(setSlotCharge(before, "high", 0, null).items[0].chargeTypeId).toBeNull();
  });

  it("does not touch the document when the slot is empty", () => {
    expect(removeSlot(before, "mid", 2)).toBe(before);
    expect(setSlotState(before, "mid", 2, "offline")).toBe(before);
  });
});

describe("setEntryQuantity", () => {
  const before = doc([item({ typeId: 2456, flag: "DroneBay", quantity: 5 })]);
  it("changes the quantity and deletes the entry at zero", () => {
    expect(setEntryQuantity(before, "DroneBay", 2456, 3).items[0].quantity).toBe(3);
    expect(setEntryQuantity(before, "DroneBay", 2456, 0).items).toEqual([]);
  });
});

describe("chargeFits", () => {
  const gun = data.types.get(2889)!;          // 200mm AutoCannon II — chargeGroup1 83, chargeGroup2 372
  const hail = data.types.get(12608)!;        // Hail S — group 372, chargeSize 1
  const torpedo = data.types.get(27339)!;     // Caldari Navy Mjolnir Torpedo — group 89
  const extender = data.types.get(380)!;      // Small Shield Extender II — takes no charge at all

  it("accepts a charge whose group the module lists", () => {
    expect(chargeFits(gun, hail)).toBe(true);
  });
  it("rejects a charge from a group the module does not list", () => {
    expect(chargeFits(gun, torpedo)).toBe(false);
  });
  it("rejects everything for a module that declares no charge group", () => {
    expect(chargeFits(extender, hail)).toBe(false);
  });
});

describe("allowedStates", () => {
  it("offers every state the type's own effects support", () => {
    expect(allowedStates(data, data.types.get(2889)!)).toEqual(["offline", "online", "active", "overload"]);
    expect(allowedStates(data, data.types.get(2048)!)).toEqual(["offline", "online"]);
    expect(allowedStates(data, data.types.get(31686)!)).toEqual(["offline", "online"]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/fits/slots.test.ts`
Expected: FAIL — `Failed to resolve import "../../src/lib/fits/slots.js"`.

- [ ] **Step 3: Write the implementation**

`src/lib/fits/slots.ts`:
```ts
/**
 * The slot grid and every edit the editor can make to a fit, as pure functions over a `FitDoc`.
 * Isomorphic — this file runs in the browser.
 */
import {
  ATTR, DRONE_BAY_FLAG, EFFECT, SLOT_KINDS, State, defaultStateOfType, getAttr,
  kindOfType, slotFromFlag, slotOfType,
  type AttrId, type DogmaData, type DogmaType, type Fit, type SlotKind,
} from "../dogma/index.js";
import {
  CARGO_FLAG, FIT_ITEM_STATES, flagFor, stateName,
  type FitDoc, type FitItem, type FitItemState,
} from "./doc.js";

export type SlotTotals = Record<SlotKind, number>;
export interface SlotCell { slot: SlotKind; index: number; item: FitItem | null; over: boolean }

/** chargeGroup1..5 — the groups a module will accept (spec §4). */
export const CHARGE_GROUP_ATTRS: readonly AttrId[] = [604, 605, 606, 609, 610];
/** chargeSize — a Small launcher does not take a Medium missile. */
export const CHARGE_SIZE_ATTR: AttrId = 128;

const SLOT_ATTRS: Record<SlotKind, AttrId> = {
  high: ATTR.hiSlots, mid: ATTR.medSlots, low: ATTR.lowSlots,
  rig: ATTR.rigSlots, subsystem: ATTR.maxSubSystems,
};

/**
 * The hull's slot counts **with fitted modifiers applied** — read through the engine, so a
 * subsystem or a slot-modifier module changes the grid the moment it is fitted. The 5 → 4
 * subsystem correction repeats `fitStats`, deliberately: the grid and the counters must agree.
 */
export function slotTotals(fit: Fit): SlotTotals {
  const out = {} as SlotTotals;
  for (const kind of SLOT_KINDS) {
    let total = Math.floor(getAttr(fit, fit.ship, SLOT_ATTRS[kind]));
    if (kind === "subsystem" && total === 5) total = 4;
    out[kind] = Math.max(0, total);
  }
  return out;
}

/** Every slot of every kind, in index order, with the module in it (or `null`). */
export function slotGrid(doc: FitDoc, totals: SlotTotals): Record<SlotKind, SlotCell[]> {
  const byKind = {} as Record<SlotKind, Map<number, FitItem>>;
  for (const kind of SLOT_KINDS) byKind[kind] = new Map();
  for (const entry of doc.items) {
    const place = slotFromFlag(entry.flag);
    if (place !== null) byKind[place.slot].set(place.index, entry);
  }

  const grid = {} as Record<SlotKind, SlotCell[]>;
  for (const kind of SLOT_KINDS) {
    const used = byKind[kind];
    const highest = used.size === 0 ? -1 : Math.max(...used.keys());
    const length = Math.max(totals[kind], highest + 1);
    grid[kind] = Array.from({ length }, (_, index) => ({
      slot: kind, index, item: used.get(index) ?? null, over: index >= totals[kind],
    }));
  }
  return grid;
}

/** The first empty index inside the hull's own count, or `null` when the row is full. */
export function firstFreeIndex(doc: FitDoc, slot: SlotKind, totals: SlotTotals): number | null {
  const taken = new Set<number>();
  for (const entry of doc.items) {
    const place = slotFromFlag(entry.flag);
    if (place !== null && place.slot === slot) taken.add(place.index);
  }
  for (let index = 0; index < totals[slot]; index += 1) if (!taken.has(index)) return index;
  return null;
}

/**
 * Spec §4's Fit button: "adds to the first free matching slot (or replaces the selected slot)".
 * A full row over-fits at the next index rather than refusing — `slotGrid` marks it `.over` and
 * `validateFit` raises the problem.
 */
export function fitTypeInto(
  doc: FitDoc, data: DogmaData, typeId: number, totals: SlotTotals,
  at?: { slot: SlotKind; index: number },
): FitDoc {
  const type = data.types.get(typeId);
  if (type === undefined) return doc;                       // unknown to this SDE build: no-op
  const slot = slotOfType(type);
  if (slot === null) return addLoose(doc, data, type);

  const chosen = at !== undefined && at.slot === slot ? at.index : firstFreeIndex(doc, slot, totals);
  const index = chosen ?? nextIndex(doc, slot);
  const entry: FitItem = {
    typeId, quantity: 1, flag: flagFor(slot, index), chargeTypeId: null,
    state: stateName(defaultStateOfType(data, type, kindOfType(type))),
  };
  const items = [...doc.items];
  const existing = items.findIndex((i) => i.flag === entry.flag);
  if (existing >= 0) items[existing] = entry; else items.push(entry);
  return { ...doc, items };
}

export function removeSlot(doc: FitDoc, slot: SlotKind, index: number): FitDoc {
  const flag = flagFor(slot, index);
  if (!doc.items.some((i) => i.flag === flag)) return doc;
  return { ...doc, items: doc.items.filter((i) => i.flag !== flag) };
}

export function setSlotState(doc: FitDoc, slot: SlotKind, index: number, state: FitItemState): FitDoc {
  return patchSlot(doc, slot, index, (entry) => ({ ...entry, state }));
}

export function setSlotCharge(
  doc: FitDoc, slot: SlotKind, index: number, chargeTypeId: number | null,
): FitDoc {
  return patchSlot(doc, slot, index, (entry) => ({ ...entry, chargeTypeId }));
}

/** Drone-bay and cargo quantities. A quantity of zero or less removes the entry. */
export function setEntryQuantity(doc: FitDoc, flag: string, typeId: number, quantity: number): FitDoc {
  const items = quantity <= 0
    ? doc.items.filter((i) => !(i.flag === flag && i.typeId === typeId))
    : doc.items.map((i) => (i.flag === flag && i.typeId === typeId ? { ...i, quantity } : i));
  return { ...doc, items };
}

/** Spec §4's charge filter: the module's `chargeGroup*` must list the charge's group, and sizes must fit. */
export function chargeFits(moduleType: DogmaType, chargeType: DogmaType): boolean {
  const groups: number[] = [];
  for (const attrId of CHARGE_GROUP_ATTRS) {
    const value = moduleType.attrs.get(attrId);
    if (value !== undefined) groups.push(Math.round(value));
  }
  if (groups.length === 0) return false;                    // this module takes no charge at all
  if (!groups.includes(chargeType.groupId)) return false;
  const max = moduleType.attrs.get(CHARGE_SIZE_ATTR);
  const size = chargeType.attrs.get(CHARGE_SIZE_ATTR);
  if (max === undefined || size === undefined) return true; // CCP only sets it where it bites
  return size <= max;
}

/** The states this type can actually be put in — a single-entry list means "render no toggle". */
export function allowedStates(data: DogmaData, type: DogmaType): FitItemState[] {
  // The default state must always be offerable: a rig comes up Online but carries no effect 16.
  const supported = new Set<State>([State.Offline, defaultStateOfType(data, type, kindOfType(type))]);
  if (type.effects.has(EFFECT.online)) supported.add(State.Online);
  for (const effectId of type.effects.keys()) {
    const effect = data.effects.get(effectId);
    if (effect === undefined) continue;
    if (effect.state === State.Active || effect.state === State.Overload) supported.add(effect.state);
  }
  return FIT_ITEM_STATES.filter((name) => supported.has(STATE_BY_NAME[name]));
}

const STATE_BY_NAME: Record<FitItemState, State> = {
  offline: State.Offline, online: State.Online, active: State.Active, overload: State.Overload,
};

function patchSlot(
  doc: FitDoc, slot: SlotKind, index: number, patch: (entry: FitItem) => FitItem,
): FitDoc {
  const flag = flagFor(slot, index);
  if (!doc.items.some((i) => i.flag === flag)) return doc;
  return { ...doc, items: doc.items.map((i) => (i.flag === flag ? patch(i) : i)) };
}

function nextIndex(doc: FitDoc, slot: SlotKind): number {
  let highest = -1;
  for (const entry of doc.items) {
    const place = slotFromFlag(entry.flag);
    if (place !== null && place.slot === slot && place.index > highest) highest = place.index;
  }
  return highest + 1;
}

/** A type with no slot marker: a drone goes to the bay, everything else to the cargo hold. */
function addLoose(doc: FitDoc, data: DogmaData, type: DogmaType): FitDoc {
  const flag = kindOfType(type) === "drone" ? DRONE_BAY_FLAG : CARGO_FLAG;
  const existing = doc.items.findIndex((i) => i.flag === flag && i.typeId === type.id);
  if (existing >= 0) {
    const items = [...doc.items];
    items[existing] = { ...items[existing], quantity: items[existing].quantity + 1 };
    return { ...doc, items };
  }
  return {
    ...doc,
    items: [...doc.items, { typeId: type.id, quantity: 1, flag, chargeTypeId: null, state: "active" }],
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/fits/slots.test.ts && npm run typecheck`
Expected: 16 tests pass; `tsc --noEmit` clean.

- [ ] **Step 5: Commit**

```bash
git add src/lib/fits/slots.ts tests/fits/slots.test.ts
git commit -m "$(cat <<'EOM'
feat(fits): slot grid, edit operations, charge compatibility and allowed states

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOM
)"
```

---

### Task 4: EFT text (`src/lib/fits/eft.ts`)

Spec §5. Export writes sections in the order **low, mid, high, rig, subsystem, drones, cargo**,
separated by a blank line, with `[Empty X slot]` for gaps, `, <charge name>` for a loaded charge,
`x N` quantities for drones and cargo, and a `/offline` suffix for offline modules. Import is the
inverse: it tokenises the text with no data at all, then assigns slots from the resolved types'
marker effects, in the order listed, reporting unresolved lines instead of failing.

**Files:**
- Create: `src/lib/fits/eft.ts`, `tests/fits/eft.test.ts`, `tests/fixtures/fits/rifter.eft`

**Interfaces:**
- Consumes (Tasks 1 and 3, plus phase 4a verbatim):
```ts
// src/lib/fits/doc.ts
export interface FitDoc { …; shipTypeId: number; name: string; items: FitItem[] }
export interface FitItem { typeId: number; quantity: number; flag: string; chargeTypeId: number | null; state: FitItemState }
export const CARGO_FLAG: string;
export function flagFor(slot: SlotKind, index: number): string;
export function stateName(state: State): FitItemState;
// src/lib/fits/slots.ts
export type SlotTotals = Record<SlotKind, number>;
export interface SlotCell { slot: SlotKind; index: number; item: FitItem | null; over: boolean }
export function slotGrid(doc: FitDoc, totals: SlotTotals): Record<SlotKind, SlotCell[]>;
// src/lib/dogma/index.ts
const DRONE_BAY_FLAG: string
function slotOfType(type: DogmaType): SlotKind | null
function kindOfType(type: DogmaType): ItemKind
function defaultStateOfType(data: DogmaData, type: DogmaType, kind: ItemKind): State
```
- Produces:
```ts
// src/lib/fits/eft.ts — pure, isomorphic
export interface EftLine { name: string; chargeName: string | null; quantity: number;
                           offline: boolean; empty: SlotKind | null }
export interface EftText { shipName: string; fitName: string; lines: EftLine[] }
export interface EftAssignment { shipTypeId: number; name: string; items: FitItem[]; unresolved: string[] }
export const EFT_SECTIONS: readonly SlotKind[];        // ["low","mid","high","rig","subsystem"]
export function exportEft(doc: FitDoc, data: DogmaData, totals: SlotTotals): string;
export function tokeniseEft(text: string): EftText | null;
export function assignEftItems(parsed: EftText, byName: ReadonlyMap<string, number>,
                               data: DogmaData): EftAssignment | null;
```

**Decisions recorded here (do not re-litigate them):**
- **The committed fixture is a real Rifter.** Spec §5's example is a hand-typed sketch with four
  high-slot lines and two low-slot lines; the SDE's Rifter (type 587) is **3 high / 3 mid / 4 low /
  3 rig / 0 subsystem**. The fixture below uses the real counts and only types that exist in
  `tests/fixtures/dogma/rifter.json`, which is what makes `exportEft(import(text)) === text`
  provable rather than aspirational.
- **Line grammar:** `<module name>[, <charge name>][/offline]` for slots, `<name>[ xN]` for drones
  and cargo. The state suffix goes last, after the charge, and only `offline` is ever written —
  spec §5 names no other suffix, and `online`/`active` are the type's own default.
- **Section separation is `[...lines, ""]` per section, joined by `\n`, then `trimEnd()`.** An
  empty section (a Rifter has no subsystems) therefore contributes exactly one blank line, which is
  why the fixture has two blank lines between the rigs and the drones. Getting this wrong is the
  one way to break the round trip.
- **Sections are informative on import, authoritative on export.** The tokeniser does not care
  which block a line was in (spec §5: "assigns slots by the module's marker effect in the order
  listed"); the only thing a block contributes is the *kind* of an `[Empty X slot]` marker, which
  advances that kind's index counter.
- **`byName` keys are lower-cased type names** — spec §5 asks for exact, case-insensitive matching.
  Resolution itself is the caller's job (Task 11 does it with one SQL statement), so this module
  stays pure and testable.
- A resolved type with no slot marker goes to the drone bay when `kindOfType` says `"drone"` and to
  the cargo hold otherwise — spec §5's "puts unrecognised-slot items into cargo", refined so a
  drone line actually lands in the drone bay.
- **Type names containing a comma would confuse the `, charge` split.** No published EVE type name
  contains ", " today; the parser splits on the *first* occurrence only, so a hypothetical one
  would degrade to an unresolved line rather than a wrong fit.

- [ ] **Step 1: Write the fixture**

`tests/fixtures/fits/rifter.eft` — exactly this, with a single trailing newline:
```
[Rifter, Cheap Rifter]
Damage Control II/offline
Gyrostabilizer II
[Empty Low slot]
[Empty Low slot]

5MN Microwarpdrive II
Faint Epsilon Scoped Warp Scrambler
Small Shield Extender II

200mm AutoCannon II, Hail S
200mm AutoCannon II, Hail S
[Empty High slot]

Small Projectile Collision Accelerator II
[Empty Rig slot]
[Empty Rig slot]


Hobgoblin II x2

Hail S x600
```

- [ ] **Step 2: Write the failing test**

`tests/fits/eft.test.ts`:
```ts
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import { fixtureData } from "../dogma/fixture.js";
import { CATEGORY } from "../../src/lib/dogma/index.js";
import { assignEftItems, exportEft, tokeniseEft } from "../../src/lib/fits/eft.js";
import type { FitDoc } from "../../src/lib/fits/doc.js";

const data = fixtureData("rifter");
const RIFTER = { high: 3, mid: 3, low: 4, rig: 3, subsystem: 0 };

const FIXTURE = readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "fixtures", "fits", "rifter.eft"),
  "utf8",
).replace(/\n$/, "");

/** Every type in the snapshot, keyed by lower-cased name — what the import route builds from SQL. */
const byName = new Map<string, number>();
for (const type of data.types.values()) if (type.name !== null) byName.set(type.name.toLowerCase(), type.id);

describe("tokeniseEft", () => {
  it("reads the header, the charges, the quantities, the offline suffix and the empty markers", () => {
    const parsed = tokeniseEft(FIXTURE)!;
    expect(parsed.shipName).toBe("Rifter");
    expect(parsed.fitName).toBe("Cheap Rifter");
    expect(parsed.lines[0]).toEqual(
      { name: "Damage Control II", chargeName: null, quantity: 1, offline: true, empty: null });
    expect(parsed.lines[2]).toEqual(
      { name: "", chargeName: null, quantity: 1, offline: false, empty: "low" });
    expect(parsed.lines.find((l) => l.chargeName !== null)).toEqual(
      { name: "200mm AutoCannon II", chargeName: "Hail S", quantity: 1, offline: false, empty: null });
    expect(parsed.lines.at(-1)).toEqual(
      { name: "Hail S", chargeName: null, quantity: 600, offline: false, empty: null });
  });

  it("returns null when there is no header line", () => {
    expect(tokeniseEft("Damage Control II\n")).toBeNull();
  });
});

describe("assignEftItems", () => {
  it("assigns slots by marker effect in the order listed, empties included", () => {
    const assigned = assignEftItems(tokeniseEft(FIXTURE)!, byName, data)!;
    expect(assigned.shipTypeId).toBe(587);
    expect(assigned.name).toBe("Cheap Rifter");
    expect(assigned.items.map((i) => [i.flag, i.typeId, i.chargeTypeId, i.state, i.quantity])).toEqual([
      ["LoSlot0", 2048, null, "offline", 1],
      ["LoSlot1", 519, null, "online", 1],
      ["MedSlot0", 440, null, "active", 1],
      ["MedSlot1", 5443, null, "active", 1],
      ["MedSlot2", 380, null, "online", 1],
      ["HiSlot0", 2889, 12608, "active", 1],
      ["HiSlot1", 2889, 12608, "active", 1],
      ["RigSlot0", 31686, null, "online", 1],
      ["DroneBay", 2456, null, "active", 2],
      ["Cargo", 12608, null, "active", 600],
    ]);
    expect(assigned.unresolved).toEqual([]);
  });

  it("reports names this SDE build does not know, and keeps the rest", () => {
    const text = "[Rifter, Typo]\nDamage Control II\nDamage Controll II\n";
    const assigned = assignEftItems(tokeniseEft(text)!, byName, data)!;
    expect(assigned.items.map((i) => i.typeId)).toEqual([2048]);
    expect(assigned.unresolved).toEqual(["Damage Controll II"]);
  });

  it("returns null when the hull itself cannot be resolved", () => {
    expect(assignEftItems(tokeniseEft("[Wormhole, x]\nDamage Control II\n")!, byName, data)).toBeNull();
  });

  it("matches names case-insensitively", () => {
    const assigned = assignEftItems(tokeniseEft("[rifter, lower]\ndamage control ii\n")!, byName, data)!;
    expect(assigned.items.map((i) => [i.flag, i.typeId])).toEqual([["LoSlot0", 2048]]);
  });
});

describe("exportEft", () => {
  const doc = (): FitDoc => {
    const assigned = assignEftItems(tokeniseEft(FIXTURE)!, byName, data)!;
    return {
      id: 7, name: assigned.name, description: "", shipTypeId: assigned.shipTypeId,
      characterId: "all-v", items: assigned.items,
    };
  };

  it("round-trips the fixture exactly", () => {
    expect(exportEft(doc(), data, RIFTER)).toBe(FIXTURE);
  });

  it("names a type this SDE build does not know instead of crashing", () => {
    const broken = { ...doc(), items: [{ typeId: 999999, quantity: 1, flag: "LoSlot0", chargeTypeId: null, state: "active" as const }] };
    expect(exportEft(broken, data, RIFTER)).toContain("Unknown type (999999)");
  });

  it("keeps drones out of the cargo section", () => {
    expect(CATEGORY.drone).toBe(18);
    const text = exportEft(doc(), data, RIFTER);
    expect(text.indexOf("Hobgoblin II x2")).toBeLessThan(text.indexOf("Hail S x600"));
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run tests/fits/eft.test.ts`
Expected: FAIL — `Failed to resolve import "../../src/lib/fits/eft.js"`.

- [ ] **Step 4: Write the implementation**

`src/lib/fits/eft.ts`:
```ts
/**
 * EFT text (spec §5). Pure and isomorphic: the editor exports in the browser, the import route
 * parses on the server, and neither one touches a database from here.
 */
import {
  DRONE_BAY_FLAG, defaultStateOfType, kindOfType, slotFromFlag, slotOfType,
  type DogmaData, type SlotKind,
} from "../dogma/index.js";
import { CARGO_FLAG, flagFor, stateName, type FitDoc, type FitItem } from "./doc.js";
import { slotGrid, type SlotTotals } from "./slots.js";

export interface EftLine {
  name: string;
  chargeName: string | null;
  quantity: number;
  offline: boolean;
  /** Set for an `[Empty X slot]` marker; `name` is empty then. */
  empty: SlotKind | null;
}
export interface EftText { shipName: string; fitName: string; lines: EftLine[] }
export interface EftAssignment {
  shipTypeId: number; name: string; items: FitItem[]; unresolved: string[];
}

/** Spec §5's section order. Drones and cargo follow, in that order. */
export const EFT_SECTIONS: readonly SlotKind[] = ["low", "mid", "high", "rig", "subsystem"];

const SECTION_LABELS: Record<SlotKind, string> = {
  low: "Low", mid: "Med", high: "High", rig: "Rig", subsystem: "Subsystem",
};
const SECTION_BY_LABEL = new Map<string, SlotKind>(
  EFT_SECTIONS.map((slot) => [SECTION_LABELS[slot].toLowerCase(), slot]));

const OFFLINE_SUFFIX = "/offline";
const HEADER = /^\[(.+?), (.+)\]$/;
const EMPTY_MARKER = /^\[Empty (.+) slot\]$/i;
const QUANTITY = / x(\d+)$/;

function typeName(data: DogmaData, typeId: number): string {
  return data.types.get(typeId)?.name ?? `Unknown type (${typeId})`;
}

export function exportEft(doc: FitDoc, data: DogmaData, totals: SlotTotals): string {
  const grid = slotGrid(doc, totals);
  const lines: string[] = [`[${typeName(data, doc.shipTypeId)}, ${doc.name}]`];

  for (const slot of EFT_SECTIONS) {
    for (const cell of grid[slot]) {
      if (cell.item === null) { lines.push(`[Empty ${SECTION_LABELS[slot]} slot]`); continue; }
      const charge = cell.item.chargeTypeId === null ? "" : `, ${typeName(data, cell.item.chargeTypeId)}`;
      const state = cell.item.state === "offline" ? OFFLINE_SUFFIX : "";
      lines.push(`${typeName(data, cell.item.typeId)}${charge}${state}`);
    }
    lines.push("");                       // one blank line closes every section, empty or not
  }

  // Drones first, then everything else that is not in a slot — the same split `fitFromDoc` makes,
  // so a flag we have never seen still exports as cargo instead of vanishing.
  const inBay = (e: FitItem) => e.flag === DRONE_BAY_FLAG;
  const inHold = (e: FitItem) => !inBay(e) && slotFromFlag(e.flag) === null;
  for (const belongs of [inBay, inHold]) {
    for (const entry of doc.items) {
      if (!belongs(entry)) continue;
      lines.push(`${typeName(data, entry.typeId)}${entry.quantity > 1 ? ` x${entry.quantity}` : ""}`);
    }
    lines.push("");
  }

  return lines.join("\n").trimEnd();
}

/** Text → lines, with no static data involved. `null` when there is no `[Ship, Name]` header. */
export function tokeniseEft(text: string): EftText | null {
  const rows = text.split(/\r?\n/);
  let header: RegExpMatchArray | null = null;
  let start = 0;
  for (let i = 0; i < rows.length; i += 1) {
    const trimmed = rows[i].trim();
    if (trimmed === "") continue;
    header = HEADER.exec(trimmed);
    start = i + 1;
    break;
  }
  if (header === null) return null;

  const lines: EftLine[] = [];
  for (const raw of rows.slice(start)) {
    let line = raw.trim();
    if (line === "") continue;

    const empty = EMPTY_MARKER.exec(line);
    if (empty !== null) {
      const slot = SECTION_BY_LABEL.get(empty[1].trim().toLowerCase());
      if (slot !== undefined) {
        lines.push({ name: "", chargeName: null, quantity: 1, offline: false, empty: slot });
      }
      continue;
    }

    let offline = false;
    if (line.toLowerCase().endsWith(OFFLINE_SUFFIX)) {
      offline = true;
      line = line.slice(0, -OFFLINE_SUFFIX.length).trim();
    }

    let quantity = 1;
    const counted = QUANTITY.exec(line);
    if (counted !== null) {
      quantity = Number(counted[1]);
      line = line.slice(0, counted.index).trim();
    }

    const comma = line.indexOf(", ");
    const name = comma === -1 ? line : line.slice(0, comma).trim();
    const chargeName = comma === -1 ? null : line.slice(comma + 2).trim();
    if (name === "") continue;
    lines.push({ name, chargeName, quantity, offline, empty: null });
  }

  return { shipName: header[1].trim(), fitName: header[2].trim(), lines };
}

/**
 * Lines → fit items. Slots come from each type's marker effect, in the order listed; an
 * `[Empty X slot]` marker advances that kind's counter. Unknown names are reported, never fatal.
 */
export function assignEftItems(
  parsed: EftText, byName: ReadonlyMap<string, number>, data: DogmaData,
): EftAssignment | null {
  const shipTypeId = byName.get(parsed.shipName.toLowerCase());
  if (shipTypeId === undefined || !data.types.has(shipTypeId)) return null;

  const next: Record<SlotKind, number> = { high: 0, mid: 0, low: 0, rig: 0, subsystem: 0 };
  const items: FitItem[] = [];
  const unresolved: string[] = [];

  for (const line of parsed.lines) {
    if (line.empty !== null) { next[line.empty] += 1; continue; }

    const typeId = byName.get(line.name.toLowerCase());
    const type = typeId === undefined ? undefined : data.types.get(typeId);
    if (typeId === undefined || type === undefined) { unresolved.push(line.name); continue; }

    let chargeTypeId: number | null = null;
    if (line.chargeName !== null) {
      const resolved = byName.get(line.chargeName.toLowerCase());
      if (resolved === undefined || !data.types.has(resolved)) unresolved.push(line.chargeName);
      else chargeTypeId = resolved;
    }

    const slot = slotOfType(type);
    if (slot === null) {
      const flag = kindOfType(type) === "drone" ? DRONE_BAY_FLAG : CARGO_FLAG;
      items.push({ typeId, quantity: line.quantity, flag, chargeTypeId: null, state: "active" });
      continue;
    }
    const index = next[slot];
    next[slot] += 1;
    items.push({
      typeId, quantity: 1, flag: flagFor(slot, index), chargeTypeId,
      state: line.offline ? "offline" : stateName(defaultStateOfType(data, type, kindOfType(type))),
    });
  }

  return { shipTypeId, name: parsed.fitName, items, unresolved };
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run tests/fits/eft.test.ts && npm run typecheck`
Expected: 9 tests pass, including `round-trips the fixture exactly`; `tsc --noEmit` clean.
If the round trip fails, diff the two strings line by line — the failure is almost always the blank
line an empty section contributes.

- [ ] **Step 6: Commit**

```bash
git add src/lib/fits/eft.ts tests/fits/eft.test.ts tests/fixtures/fits/rifter.eft
git commit -m "$(cat <<'EOM'
feat(fits): EFT export and import with a round-tripping Rifter fixture

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOM
)"
```

---

### Task 5: The dogma wire format (`src/lib/dogma/serialize.ts`)

Spec §3: "`src/lib/dogma/serialize.ts` — `DogmaData` ⇄ JSON (Maps ⇄ arrays), shared by the API
routes and the client." Phase 4a already put a **whole-snapshot** pair (`serialiseDogmaData` /
`deserialiseDogmaData` / `DogmaDataJson`) in `src/lib/dogma/data.ts` for the test fixtures. What the
HTTP layer needs and does not yet have is the **split**: a big meta blob (attributes, effects,
groups — the same bytes for everyone, cacheable for a day) and small per-id type batches.

**Files:**
- Create: `src/lib/dogma/serialize.ts`, `tests/dogma/serialize.test.ts`
- Modify: `src/lib/dogma/index.ts` (re-export the new module)

**Interfaces:**
- Consumes (phase 4a, verbatim from `src/lib/dogma/data.ts`):
```ts
export interface DogmaData { attributes: Map<AttrId, DogmaAttribute>; effects: Map<EffectId, DogmaEffect>;
                             types: Map<TypeId, DogmaType>; groups: Map<GroupId, DogmaGroup> }
export interface DogmaAttributeJson { id: AttrId; name: string | null; defaultValue: number;
  stackable: boolean; highIsGood: boolean; maxAttributeId?: AttrId; minAttributeId?: AttrId }
export interface DogmaEffectJson { id: EffectId; categoryId: number; state: State;
  modifiers: Modifier[]; fittingUsageChanceAttrId?: AttrId }
export interface DogmaTypeJson { id: TypeId; groupId: GroupId; categoryId: number; name: string | null;
  attrs: [AttrId, number][]; effects: [EffectId, boolean][] }
export interface DogmaGroup { id: GroupId; name: string | null; categoryId: number }
```
- Produces:
```ts
// src/lib/dogma/serialize.ts — pure, isomorphic
export interface DogmaMeta { build: number; attributes: Map<AttrId, DogmaAttribute>;
                             effects: Map<EffectId, DogmaEffect>; groups: Map<GroupId, DogmaGroup> }
export interface DogmaMetaJson { build: number; attributes: DogmaAttributeJson[];
                                 effects: DogmaEffectJson[]; groups: DogmaGroup[] }
export interface DogmaTypesJson { build: number; types: DogmaTypeJson[] }
export function serialiseMeta(data: DogmaData, build: number): DogmaMetaJson;
export function deserialiseMeta(json: DogmaMetaJson): DogmaMeta;
export function serialiseTypes(data: DogmaData): DogmaTypeJson[];
export function deserialiseTypes(json: readonly DogmaTypeJson[]): Map<TypeId, DogmaType>;
export function dogmaDataFrom(meta: DogmaMeta, types: Map<TypeId, DogmaType>): DogmaData;
```

**Decisions recorded here (do not re-litigate them):**
- This module **does not re-export or replace** `data.ts`'s whole-snapshot pair. Two functions with
  near-identical names in one directory is how a codebase rots; the split functions get distinct
  names (`serialiseMeta` / `serialiseTypes`) and the whole-snapshot pair keeps its job (fixtures).
- **The SDE build number travels with both payloads.** The meta response uses it as its `ETag`
  (spec §3); the types response carries it in the body so the browser store can throw its type memo
  away the moment CCP's build changes underneath it. Without that, a mid-session SDE re-import would
  mix attribute ids from two builds.
- `dogmaDataFrom` returns a `DogmaData` that **shares** the meta maps rather than copying them. The
  engine only reads them, the client holds exactly one meta, and copying 2,867 attributes and 3,417
  effects on every keystroke would be absurd.
- **Measured payload sizes** (against the SDE build in the dev database, 3,484,357): attributes
  314 kB, effects with their 5,152 modifiers 831 kB, groups 110 kB — **≈1.25 MB of JSON**, served
  once per browser per day and compressed on the wire by Next's default response compression. A
  type batch of 200 is a few tens of kB. This is why the split exists: the per-keystroke traffic
  must not carry the meta.

- [ ] **Step 1: Write the failing test**

`tests/dogma/serialize.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { fixtureData } from "./fixture.js";
import { fitStats } from "../../src/lib/dogma/index.js";
import { buildFit, allSkills } from "./build-fit.js";
import {
  deserialiseMeta, deserialiseTypes, dogmaDataFrom, serialiseMeta, serialiseTypes,
} from "../../src/lib/dogma/serialize.js";

const data = fixtureData("rifter");

/** What actually crosses the wire — JSON, not the objects we happened to build. */
function overTheWire<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

describe("the dogma wire format", () => {
  it("round-trips the meta half through JSON", () => {
    const meta = deserialiseMeta(overTheWire(serialiseMeta(data, 3484357)));
    expect(meta.build).toBe(3484357);
    expect(meta.attributes.size).toBe(data.attributes.size);
    expect(meta.effects.size).toBe(data.effects.size);
    expect(meta.groups.size).toBe(data.groups.size);
    expect(meta.attributes.get(50)).toEqual(data.attributes.get(50));
    expect(meta.effects.get(12)?.modifiers).toEqual(data.effects.get(12)?.modifiers);
  });

  it("round-trips the types half through JSON, Maps and all", () => {
    const types = deserialiseTypes(overTheWire(serialiseTypes(data)));
    expect(types.size).toBe(data.types.size);
    const rifter = types.get(587)!;
    expect(rifter.name).toBe("Rifter");
    expect(rifter.attrs).toBeInstanceOf(Map);
    expect(rifter.attrs.get(48)).toBe(data.types.get(587)!.attrs.get(48));
    expect(rifter.effects).toBeInstanceOf(Map);
  });

  it("reassembles a DogmaData the engine computes identically on", () => {
    const meta = deserialiseMeta(overTheWire(serialiseMeta(data, 3484357)));
    const types = deserialiseTypes(overTheWire(serialiseTypes(data)));
    const rebuilt = dogmaDataFrom(meta, types);

    const before = fitStats(buildFit(data, 587, {
      modules: [[2889, "high", 0], [2048, "low", 0]], skills: allSkills(data, 5),
    }));
    const after = fitStats(buildFit(rebuilt, 587, {
      modules: [[2889, "high", 0], [2048, "low", 0]], skills: allSkills(rebuilt, 5),
    }));
    expect(after.cpu).toEqual(before.cpu);
    expect(after.power).toEqual(before.power);
    expect(after.slots).toEqual(before.slots);
    expect(after.cpu.output).toBe(162.5);
  });

  it("shares the meta maps rather than copying them", () => {
    const meta = deserialiseMeta(serialiseMeta(data, 1));
    const rebuilt = dogmaDataFrom(meta, new Map());
    expect(rebuilt.attributes).toBe(meta.attributes);
    expect(rebuilt.types.size).toBe(0);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/dogma/serialize.test.ts`
Expected: FAIL — `Failed to resolve import "../../src/lib/dogma/serialize.js"`.

- [ ] **Step 3: Write the implementation**

`src/lib/dogma/serialize.ts`:
```ts
/**
 * The wire format the browser engine is fed with (spec §3).
 *
 * `data.ts` already serialises a **whole** `DogmaData` for the committed test fixtures. This module
 * is the *split* the HTTP layer needs: one big meta payload (attributes, effects, groups — identical
 * for every request, cacheable for a day behind the SDE build number) and small per-id type batches.
 * Both halves carry the build number so the client can drop a stale memo after an SDE re-import.
 */
import type {
  AttrId, DogmaAttribute, DogmaAttributeJson, DogmaData, DogmaEffect, DogmaEffectJson, DogmaGroup,
  DogmaType, DogmaTypeJson, EffectId, GroupId, TypeId,
} from "./data.js";

export interface DogmaMeta {
  build: number;
  attributes: Map<AttrId, DogmaAttribute>;
  effects: Map<EffectId, DogmaEffect>;
  groups: Map<GroupId, DogmaGroup>;
}
export interface DogmaMetaJson {
  build: number;
  attributes: DogmaAttributeJson[];
  effects: DogmaEffectJson[];
  groups: DogmaGroup[];
}
export interface DogmaTypesJson { build: number; types: DogmaTypeJson[] }

export function serialiseMeta(data: DogmaData, build: number): DogmaMetaJson {
  return {
    build,
    attributes: [...data.attributes.values()],
    effects: [...data.effects.values()],
    groups: [...data.groups.values()],
  };
}

export function deserialiseMeta(json: DogmaMetaJson): DogmaMeta {
  return {
    build: json.build,
    attributes: new Map(json.attributes.map((a) => [a.id, a])),
    effects: new Map(json.effects.map((e) => [e.id, e])),
    groups: new Map(json.groups.map((g) => [g.id, g])),
  };
}

/** Maps are not JSON-representable; a type's attribute and effect maps travel as entry arrays. */
export function serialiseTypes(data: DogmaData): DogmaTypeJson[] {
  return [...data.types.values()].map((t) => ({
    id: t.id, groupId: t.groupId, categoryId: t.categoryId, name: t.name,
    attrs: [...t.attrs.entries()], effects: [...t.effects.entries()],
  }));
}

export function deserialiseTypes(json: readonly DogmaTypeJson[]): Map<TypeId, DogmaType> {
  return new Map(json.map((t) => [t.id, {
    id: t.id, groupId: t.groupId, categoryId: t.categoryId, name: t.name,
    attrs: new Map(t.attrs), effects: new Map(t.effects),
  }]));
}

/**
 * The engine's view of "everything we have so far". The meta maps are **shared, not copied** — the
 * engine only reads them and the client rebuilds this object on every edit.
 */
export function dogmaDataFrom(meta: DogmaMeta, types: Map<TypeId, DogmaType>): DogmaData {
  return { attributes: meta.attributes, effects: meta.effects, groups: meta.groups, types };
}
```

- [ ] **Step 4: Re-export it from the barrel**

Append to `src/lib/dogma/index.ts`:
```ts
export {
  deserialiseMeta, deserialiseTypes, dogmaDataFrom, serialiseMeta, serialiseTypes,
  type DogmaMeta, type DogmaMetaJson, type DogmaTypesJson,
} from "./serialize.js";
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run tests/dogma/serialize.test.ts && npm run typecheck`
Expected: 4 tests pass; `tsc --noEmit` clean.

- [ ] **Step 6: Commit**

```bash
git add src/lib/dogma/serialize.ts src/lib/dogma/index.ts tests/dogma/serialize.test.ts
git commit -m "$(cat <<'EOM'
feat(dogma): meta/types wire format for the browser engine

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOM
)"
```

---

### Task 6: `GET /api/dogma/meta` and `GET /api/dogma/types`

Spec §3's two routes. `meta` is the whole attribute/effect/group set with `Cache-Control: public,
max-age=86400` and `ETag` = the SDE build number; `types` answers up to 200 ids with the types
themselves **plus the transitive `requiredSkillN` closure** that `loadDogmaData` already adds — the
editor needs those to name a missing skill.

**Files:**
- Create: `src/app/api/dogma/meta/route.ts`, `src/app/api/dogma/types/route.ts`, `tests/api/dogma-routes.test.ts`
- Modify: `src/lib/api/json.ts` (add `parseIdList`), `tests/api/json.test.ts`

**Interfaces:**
- Consumes (phase 2/4a, verbatim):
```ts
// src/lib/dogma/sde-loader.ts  (server only — the one module that touches Postgres)
export async function loadDogmaData(typeIds: TypeId[]): Promise<DogmaData>
// src/lib/sde/repo.ts
export interface SdeMeta { buildNumber: number; releaseDate: Date; importedAt: Date; counts: SdeMetaCounts }
export async function getSdeMeta(): Promise<SdeMeta | null>
// src/lib/dogma/serialize.ts (Task 5)
export function serialiseMeta(data: DogmaData, build: number): DogmaMetaJson;
export function serialiseTypes(data: DogmaData): DogmaTypeJson[];
```
- Produces:
```ts
// src/lib/api/json.ts
export const MAX_IDS = 200;                                                      // the /api/dogma/types ceiling
export function parseIdList(raw: string | null, max: number): number[] | null;   // deduped, order kept
// GET /api/dogma/meta      → DogmaMetaJson              (200) | { error } (503 when the SDE is empty)
// GET /api/dogma/types?ids=1,2,3 → DogmaTypesJson       (200) | { error } (400)
```

**Decisions recorded here (do not re-litigate them):**
- `loadDogmaData([])` is how the meta route gets the base maps: the phase-4a loader loads
  attributes, effects and groups once per process and returns them with an **empty** `types` map for
  an empty request. No new loader entry point is needed.
- **No SDE imported yet → 503, not 200 with an empty body.** An editor fed an empty attribute table
  would throw `UnknownAttributeError` on the first keystroke; a 503 with `{ error: "no static
  data" }` is a diagnosable failure.
- The types route answers `{ build, types }`, not a bare array, so the client can compare the build
  with the meta's and discard a memo poisoned by a mid-session SDE re-import.
- **200 ids per request** is the spec's number. The client (Task 12) chunks; the route rejects more
  with a 400 rather than silently truncating.
- `Cache-Control` on the types route is `public, max-age=86400` as well. The URL varies with the
  ids, so there is no ETag to revalidate against; the build number in the body is the safety net.
- These routes are **not** added to `proxy.ts`'s public list. They are behind the session cookie
  like everything else.

- [ ] **Step 1: Write the failing test**

`tests/api/dogma-routes.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { fixtureData } from "../dogma/fixture.js";

const { loadDogmaData, getSdeMeta } = vi.hoisted(() => ({ loadDogmaData: vi.fn(), getSdeMeta: vi.fn() }));
vi.mock("../../src/lib/dogma/sde-loader.js", () => ({ loadDogmaData }));
vi.mock("../../src/lib/sde/repo.js", () => ({ getSdeMeta }));

const { GET: META } = await import("../../src/app/api/dogma/meta/route.js");
const { GET: TYPES } = await import("../../src/app/api/dogma/types/route.js");

const data = fixtureData("rifter");
const request = (path: string, headers: Record<string, string> = {}) =>
  new NextRequest(`https://eve.plasma66.com${path}`, { headers });

beforeEach(() => {
  vi.resetAllMocks();
  getSdeMeta.mockResolvedValue({
    buildNumber: 3484357, releaseDate: new Date(), importedAt: new Date(),
    counts: { types: 1, dogmaAttributes: 1, dogmaEffects: 1, solarSystems: 1 },
  });
  loadDogmaData.mockResolvedValue(data);
});

describe("GET /api/dogma/meta", () => {
  it("serves the attribute, effect and group maps with a day-long cache and a build ETag", async () => {
    const res = await META(request("/api/dogma/meta"));
    expect(res.status).toBe(200);
    expect(res.headers.get("ETag")).toBe('"sde-3484357"');
    expect(res.headers.get("Cache-Control")).toBe("public, max-age=86400");
    const body = await res.json();
    expect(body.build).toBe(3484357);
    expect(body.attributes).toHaveLength(data.attributes.size);
    expect(body.effects).toHaveLength(data.effects.size);
    expect(body.groups).toHaveLength(data.groups.size);
    expect(body.types).toBeUndefined();
    expect(loadDogmaData).toHaveBeenCalledWith([]);
  });

  it("answers 304 when the client already has this build", async () => {
    const res = await META(request("/api/dogma/meta", { "if-none-match": '"sde-3484357"' }));
    expect(res.status).toBe(304);
    expect(loadDogmaData).not.toHaveBeenCalled();
  });

  it("503s when no SDE has been imported", async () => {
    getSdeMeta.mockResolvedValue(null);
    expect((await META(request("/api/dogma/meta"))).status).toBe(503);
  });
});

describe("GET /api/dogma/types", () => {
  it("returns the requested types and the build number", async () => {
    const res = await TYPES(request("/api/dogma/types?ids=587,2889"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.build).toBe(3484357);
    expect(body.types.map((t: { id: number }) => t.id)).toContain(587);
    expect(loadDogmaData).toHaveBeenCalledWith([587, 2889]);
    // Attribute maps travel as entry arrays.
    const rifter = body.types.find((t: { id: number }) => t.id === 587);
    expect(Array.isArray(rifter.attrs)).toBe(true);
  });

  it("rejects a missing, malformed, empty or oversized id list", async () => {
    expect((await TYPES(request("/api/dogma/types"))).status).toBe(400);
    expect((await TYPES(request("/api/dogma/types?ids="))).status).toBe(400);
    expect((await TYPES(request("/api/dogma/types?ids=587,abc"))).status).toBe(400);
    expect((await TYPES(request("/api/dogma/types?ids=0"))).status).toBe(400);
    const many = Array.from({ length: 201 }, (_, i) => i + 1).join(",");
    expect((await TYPES(request(`/api/dogma/types?ids=${many}`))).status).toBe(400);
    expect(loadDogmaData).not.toHaveBeenCalled();
  });
});
```

Add to `tests/api/json.test.ts`:
```ts
import { parseIdList } from "../../src/lib/api/json.js";

describe("parseIdList", () => {
  it("parses, dedupes and keeps order", () => {
    expect(parseIdList("3, 1 ,3", 10)).toEqual([3, 1]);
  });
  it("rejects nothing, rubbish, non-positives and over-long lists", () => {
    expect(parseIdList(null, 10)).toBeNull();
    expect(parseIdList("", 10)).toBeNull();
    expect(parseIdList("1,x", 10)).toBeNull();
    expect(parseIdList("1,-2", 10)).toBeNull();
    expect(parseIdList("1.5", 10)).toBeNull();
    expect(parseIdList("1,2,3", 2)).toBeNull();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/api/dogma-routes.test.ts tests/api/json.test.ts`
Expected: FAIL — `Failed to resolve import "../../src/app/api/dogma/meta/route.js"` and
`parseIdList is not a function`.

- [ ] **Step 3: Add `parseIdList`**

Append to `src/lib/api/json.ts`:
```ts
/**
 * Spec §3: up to 200 ids per `/api/dogma/types` request. Exported (not a route-local const) so
 * Task 12's browser store can chunk to the same ceiling the route enforces, from a module with no
 * server-only imports.
 */
export const MAX_IDS = 200;

/**
 * A comma-separated id list from a query string. Positive integers only, deduplicated, order kept.
 * `null` means "reject with a 400" — an absent list, an empty one, rubbish or more than `max` ids.
 */
export function parseIdList(raw: string | null, max: number): number[] | null {
  if (raw === null) return null;
  const parts = raw.split(",").map((p) => p.trim()).filter((p) => p !== "");
  if (parts.length === 0 || parts.length > max) return null;
  const seen = new Set<number>();
  for (const part of parts) {
    const id = Number(part);
    if (!Number.isInteger(id) || id <= 0) return null;
    seen.add(id);
  }
  return [...seen];
}
```

- [ ] **Step 4: Write the two routes**

`src/app/api/dogma/meta/route.ts`:
```ts
import { NextResponse, type NextRequest } from "next/server";
import { loadDogmaData } from "../../../../lib/dogma/sde-loader.js";
import { serialiseMeta } from "../../../../lib/dogma/serialize.js";
import { getSdeMeta } from "../../../../lib/sde/repo.js";

/**
 * Spec §3: the attribute/effect/group half of `DogmaData`, ~1.25 MB of JSON, identical for every
 * request. It changes only when the SDE is re-imported, so the build number is the ETag and the
 * browser keeps it for a day.
 */
const CACHE = "public, max-age=86400";

export async function GET(req: NextRequest) {
  const meta = await getSdeMeta();
  if (meta === null) return NextResponse.json({ error: "no static data" }, { status: 503 });

  const etag = `"sde-${meta.buildNumber}"`;
  if (req.headers.get("if-none-match") === etag) {
    return new NextResponse(null, { status: 304, headers: { ETag: etag, "Cache-Control": CACHE } });
  }
  // An empty id list gives the base maps and no types — exactly this payload.
  const data = await loadDogmaData([]);
  return NextResponse.json(serialiseMeta(data, meta.buildNumber), {
    headers: { ETag: etag, "Cache-Control": CACHE },
  });
}
```

`src/app/api/dogma/types/route.ts`:
```ts
import { NextResponse, type NextRequest } from "next/server";
import { MAX_IDS, parseIdList } from "../../../../lib/api/json.js";
import { loadDogmaData } from "../../../../lib/dogma/sde-loader.js";
import { serialiseTypes } from "../../../../lib/dogma/serialize.js";
import { getSdeMeta } from "../../../../lib/sde/repo.js";

export async function GET(req: NextRequest) {
  const ids = parseIdList(req.nextUrl.searchParams.get("ids"), MAX_IDS);
  if (ids === null) return NextResponse.json({ error: "bad request" }, { status: 400 });

  const meta = await getSdeMeta();
  if (meta === null) return NextResponse.json({ error: "no static data" }, { status: 503 });

  // loadDogmaData adds the transitive requiredSkillN closure, which is how the editor can name a
  // missing skill without a second round trip. Unknown ids are simply absent from the answer.
  const data = await loadDogmaData(ids);
  return NextResponse.json(
    { build: meta.buildNumber, types: serialiseTypes(data) },
    { headers: { "Cache-Control": "public, max-age=86400" } });
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run tests/api/dogma-routes.test.ts tests/api/json.test.ts && npm run typecheck`
Expected: 5 route tests and 2 `parseIdList` tests pass; `tsc --noEmit` clean.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/dogma src/lib/api/json.ts tests/api/dogma-routes.test.ts tests/api/json.test.ts
git commit -m "$(cat <<'EOM'
feat(api): dogma meta and type routes for the browser engine

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOM
)"
```

---

### Task 7: Browsing the SDE — `GET /api/sde/types` and `GET /api/sde/market-groups`

Spec §4's right-hand panel: a search box and a market-group tree, with a meta-group badge on every
result. Phase 2's `searchTypes` only filters by one category and has no market-group filter, so this
task adds `browseTypes` beside it and leaves the existing function alone (the Skills page uses it).

**Files:**
- Create: `src/app/api/sde/types/route.ts`, `src/app/api/sde/market-groups/route.ts`, `tests/api/sde-routes.test.ts`, `tests/db/sde-browse.test.ts`
- Modify: `src/lib/sde/repo.ts`

**Interfaces:**
- Consumes (phase 1/2, verbatim):
```ts
// src/lib/db/client.ts
export function getPool(): Pool
// src/lib/api/json.ts (Task 6)
export function parseIdList(raw: string | null, max: number): number[] | null;
```
Existing `sde_*` shapes this task reads (from `src/lib/sde/ddl.ts`):
```
sde_types         id, group_id, name, published, market_group_id, meta_group_id, meta_level, …
sde_groups        id, category_id, name, published, …
sde_market_groups id, parent_id, name, description, has_types, icon_id
sde_meta_groups   id, name, icon_suffix
```
- Produces:
```ts
// src/lib/sde/repo.ts (new exports)
export interface SdeBrowseType { id: number; name: string | null; groupId: number | null;
  categoryId: number | null; marketGroupId: number | null; metaGroupId: number | null; metaLevel: number | null }
export interface BrowseOptions { q?: string; categoryIds?: number[]; marketGroupId?: number; limit?: number }
export function browseTypes(opts: BrowseOptions): Promise<SdeBrowseType[]>;
export interface SdeMarketGroup { id: number; parentId: number | null; name: string | null; hasTypes: boolean | null }
export function listMarketGroups(): Promise<SdeMarketGroup[]>;
export function getMetaGroups(): Promise<Map<number, string>>;
export function getTypesByNames(names: string[]): Promise<Map<string, number>>;   // lower-cased name → id
// GET /api/sde/types?q=&category=7,8,18,32&marketGroup=&limit=50
//   → { types: [{ id, name, groupId, categoryId, marketGroupId, metaGroup, metaLevel }] }
// GET /api/sde/market-groups → { groups: [{ id, parentId, name, hasTypes }] }
```

**Decisions recorded here (do not re-litigate them):**
- `browseTypes` is a **new** function, not a widening of `searchTypes`. `searchTypes(query, {
  categoryId, limit })` is used by the Skills page and its signature stays exactly as it is.
- **`published` only.** Every browse query filters `t.published`, so unpublished test hulls and
  removed modules never appear in the picker.
- `category` accepts a **comma list** so one request can cover spec §4's "categories 7 modules /
  8 charges / 18 drones / 32 subsystems", and the hull picker can ask for `category=6` alone and the
  All-V helper for `category=16`.
- **`limit` defaults to 50 and is capped at 1000.** The 1000 ceiling exists for exactly one caller:
  `category=16&limit=1000` fetches the 588 skill types the "All skills V" option needs (spec §3).
- **A query with no filter at all is a 400.** `SELECT … LIMIT 50` over every published type is a
  meaningless answer that only hides a client bug.
- The market-group tree is served **whole** (2,106 rows, ~90 kB) with `Cache-Control: public,
  max-age=86400`. Paging a tree the client has to assemble anyway would be worse in every way.
- `getTypesByNames` lower-cases on both sides in SQL (`lower(name) = ANY(...)`) so the EFT import
  route (Task 11) resolves a hundred names in one statement, case-insensitively, as spec §5 asks.

- [ ] **Step 1: Write the failing repo test**

New file `tests/db/sde-browse.test.ts`. This does **not** append to `tests/db/sde-repo.test.ts` —
that file's `beforeAll` imports the whole mini-SDE fixture once for the file (groups 55/100, meta
groups 1/2 and market groups 9/574 already exist there, and its `getTypes([587, 519, ...])` fixture
carries a published category-7 type, 519), so appended inserts of those same ids would collide and
`browseTypes({ categoryIds: [7, 18] })` would also pick up 519. This file instead follows the
`resetSde(pool)` + seed-own-rows pattern Task 17's `tests/db/fits-load.test.ts` uses: reset the SDE
tables to empty before each test and insert only the rows each test needs, so the assertions are
scoped to seeded data with no other-fixture interference:
```ts
import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import type { Pool } from "pg";
import { resetDb, resetSde } from "./helpers.js";
import { closePool } from "../../src/lib/db/client.js";
import { browseTypes, listMarketGroups, getMetaGroups, getTypesByNames } from "../../src/lib/sde/repo.js";

let pool: Pool;

beforeAll(async () => { pool = await resetDb(); });
afterAll(async () => { await closePool(); });

beforeEach(async () => { await resetSde(pool); });

describe("browseTypes", () => {
  beforeEach(async () => {
    await pool.query("INSERT INTO sde_groups (id, category_id, name, published) VALUES (55, 7, 'Projectile Weapon', true), (100, 18, 'Light Scout Drone', true)");
    await pool.query(
      `INSERT INTO sde_types (id, group_id, name, published, market_group_id, meta_group_id, meta_level)
       VALUES (2889, 55, '200mm AutoCannon II', true, 574, 2, 5),
              (484, 55, '125mm Gatling AutoCannon I', true, 574, 1, 0),
              (2456, 100, 'Hobgoblin II', true, 837, 2, 5),
              (9999, 55, 'Unpublished Gun', false, 574, 1, 0)`);
    await pool.query("INSERT INTO sde_meta_groups (id, name) VALUES (1, 'Tech I'), (2, 'Tech II')");
    await pool.query("INSERT INTO sde_market_groups (id, parent_id, name, has_types) VALUES (9, NULL, 'Ship Equipment', false), (574, 9, 'Projectile Turrets', true)");
  });

  it("filters by name substring, case-insensitively, published only", async () => {
    const rows = await browseTypes({ q: "autocannon" });
    expect(rows.map((r) => r.id)).toEqual([484, 2889]);          // name-ascending
    expect(rows[1]).toMatchObject({ categoryId: 7, marketGroupId: 574, metaGroupId: 2, metaLevel: 5 });
  });

  it("filters by category list and by market group", async () => {
    expect((await browseTypes({ categoryIds: [18] })).map((r) => r.id)).toEqual([2456]);
    // name-ascending over only the seeded rows: "125mm..." < "200mm..." < "Hobgoblin II"
    expect((await browseTypes({ categoryIds: [7, 18] })).map((r) => r.id)).toEqual([484, 2889, 2456]);
    expect((await browseTypes({ marketGroupId: 574 })).map((r) => r.id)).toEqual([484, 2889]);
  });

  it("honours the limit", async () => {
    expect(await browseTypes({ categoryIds: [7], limit: 1 })).toHaveLength(1);
  });
});

describe("listMarketGroups / getMetaGroups / getTypesByNames", () => {
  beforeEach(async () => {
    await pool.query("INSERT INTO sde_market_groups (id, parent_id, name, has_types) VALUES (9, NULL, 'Ship Equipment', false), (574, 9, 'Projectile Turrets', true)");
    await pool.query("INSERT INTO sde_meta_groups (id, name) VALUES (2, 'Tech II')");
    await pool.query("INSERT INTO sde_groups (id, category_id, name, published) VALUES (55, 7, 'Projectile Weapon', true)");
    await pool.query("INSERT INTO sde_types (id, group_id, name, published) VALUES (2889, 55, '200mm AutoCannon II', true)");
  });

  it("returns the whole tree, the meta-group names and name lookups", async () => {
    expect(await listMarketGroups()).toEqual([
      { id: 9, parentId: null, name: "Ship Equipment", hasTypes: false },
      { id: 574, parentId: 9, name: "Projectile Turrets", hasTypes: true },
    ]);
    expect((await getMetaGroups()).get(2)).toBe("Tech II");
    const byName = await getTypesByNames(["200MM AUTOCANNON II", "Nope"]);
    expect(byName.get("200mm autocannon ii")).toBe(2889);
    expect(byName.has("nope")).toBe(false);
    expect(await getTypesByNames([])).toEqual(new Map());
  });
});
```

- [ ] **Step 2: Write the failing route test**

`tests/api/sde-routes.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { browseTypes, listMarketGroups, getMetaGroups } = vi.hoisted(() => ({
  browseTypes: vi.fn(), listMarketGroups: vi.fn(), getMetaGroups: vi.fn(),
}));
vi.mock("../../src/lib/sde/repo.js", () => ({ browseTypes, listMarketGroups, getMetaGroups }));

const { GET: TYPES } = await import("../../src/app/api/sde/types/route.js");
const { GET: GROUPS } = await import("../../src/app/api/sde/market-groups/route.js");

const request = (path: string) => new NextRequest(`https://eve.plasma66.com${path}`);

beforeEach(() => {
  vi.resetAllMocks();
  browseTypes.mockResolvedValue([
    { id: 2889, name: "200mm AutoCannon II", groupId: 55, categoryId: 7, marketGroupId: 574, metaGroupId: 2, metaLevel: 5 },
  ]);
  getMetaGroups.mockResolvedValue(new Map([[2, "Tech II"]]));
  listMarketGroups.mockResolvedValue([{ id: 9, parentId: null, name: "Ship Equipment", hasTypes: false }]);
});

describe("GET /api/sde/types", () => {
  it("passes the query, the category list and the limit through, and names the meta group", async () => {
    const res = await TYPES(request("/api/sde/types?q=auto&category=7,8,18,32&limit=50"));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      types: [{ id: 2889, name: "200mm AutoCannon II", groupId: 55, categoryId: 7,
                marketGroupId: 574, metaGroup: "Tech II", metaLevel: 5 }],
    });
    expect(browseTypes).toHaveBeenCalledWith({ q: "auto", categoryIds: [7, 8, 18, 32], marketGroupId: undefined, limit: 50 });
  });

  it("accepts a market-group-only query and defaults the limit to 50", async () => {
    await TYPES(request("/api/sde/types?marketGroup=574"));
    expect(browseTypes).toHaveBeenCalledWith({ q: undefined, categoryIds: undefined, marketGroupId: 574, limit: 50 });
  });

  it("rejects an empty filter, a bad category, a bad market group and an oversized limit", async () => {
    expect((await TYPES(request("/api/sde/types"))).status).toBe(400);
    expect((await TYPES(request("/api/sde/types?category=abc"))).status).toBe(400);
    expect((await TYPES(request("/api/sde/types?marketGroup=-1"))).status).toBe(400);
    expect((await TYPES(request("/api/sde/types?q=auto&limit=1001"))).status).toBe(400);
    expect(browseTypes).not.toHaveBeenCalled();
  });
});

describe("GET /api/sde/market-groups", () => {
  it("serves the whole tree with a day-long cache", async () => {
    const res = await GROUPS();
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("public, max-age=86400");
    await expect(res.json()).resolves.toEqual({
      groups: [{ id: 9, parentId: null, name: "Ship Equipment", hasTypes: false }],
    });
  });
});
```

- [ ] **Step 3: Run both tests to verify they fail**

Run: `npx vitest run tests/api/sde-routes.test.ts tests/db/sde-browse.test.ts`
Expected: FAIL — `browseTypes is not a function` and the route imports do not resolve.

- [ ] **Step 4: Add the repo functions**

Append to `src/lib/sde/repo.ts`:
```ts
export interface SdeBrowseType {
  id: number; name: string | null; groupId: number | null; categoryId: number | null;
  marketGroupId: number | null; metaGroupId: number | null; metaLevel: number | null;
}
export interface BrowseOptions { q?: string; categoryIds?: number[]; marketGroupId?: number; limit?: number }
export interface SdeMarketGroup { id: number; parentId: number | null; name: string | null; hasTypes: boolean | null }

/**
 * The fitting designer's item browser (spec §4). Distinct from `searchTypes`, which the Skills page
 * uses and whose signature must not change. Published types only; name-ascending.
 */
export async function browseTypes(opts: BrowseOptions): Promise<SdeBrowseType[]> {
  const { rows } = await getPool().query<SdeBrowseType>(
    `SELECT t.id, t.name, t.group_id AS "groupId", g.category_id AS "categoryId",
            t.market_group_id AS "marketGroupId", t.meta_group_id AS "metaGroupId",
            t.meta_level AS "metaLevel"
     FROM sde_types t LEFT JOIN sde_groups g ON g.id = t.group_id
     WHERE t.published
       AND ($1::text IS NULL OR strpos(lower(t.name), lower($1)) > 0)
       AND ($2::int[] IS NULL OR g.category_id = ANY($2::int[]))
       AND ($3::int IS NULL OR t.market_group_id = $3)
     ORDER BY t.name, t.id
     LIMIT $4`,
    [opts.q ?? null, opts.categoryIds ?? null, opts.marketGroupId ?? null, opts.limit ?? 50]);
  return rows;
}

/** The whole market-group tree — 2,106 rows the client assembles into parents and children. */
export async function listMarketGroups(): Promise<SdeMarketGroup[]> {
  const { rows } = await getPool().query<SdeMarketGroup>(
    `SELECT id, parent_id AS "parentId", name, has_types AS "hasTypes"
     FROM sde_market_groups ORDER BY id`);
  return rows;
}

/** metaGroupId → "Tech II" etc., for the badge on a browser row. */
export async function getMetaGroups(): Promise<Map<number, string>> {
  const { rows } = await getPool().query<{ id: number; name: string | null }>(
    "SELECT id, name FROM sde_meta_groups ORDER BY id");
  return new Map(rows.filter((r) => r.name !== null).map((r) => [r.id, r.name as string]));
}

/** Lower-cased name → type id, for EFT import (spec §5: exact, case-insensitive). */
export async function getTypesByNames(names: string[]): Promise<Map<string, number>> {
  const wanted = [...new Set(names.map((n) => n.trim().toLowerCase()))].filter((n) => n !== "");
  if (wanted.length === 0) return new Map();
  const { rows } = await getPool().query<{ key: string; id: number }>(
    `SELECT lower(name) AS key, id FROM sde_types WHERE lower(name) = ANY($1::text[])`, [wanted]);
  return new Map(rows.map((r) => [r.key, r.id]));
}
```

- [ ] **Step 5: Write the two routes**

`src/app/api/sde/types/route.ts`:
```ts
import { NextResponse, type NextRequest } from "next/server";
import { browseTypes, getMetaGroups } from "../../../../lib/sde/repo.js";

const DEFAULT_LIMIT = 50;
/** category=16&limit=1000 is the "All skills V" id fetch (spec §3); nothing needs more. */
const MAX_LIMIT = 1000;
const MAX_QUERY = 64;

function parsePositive(raw: string | null): number | null | undefined {
  if (raw === null) return undefined;
  const value = Number(raw);
  return Number.isInteger(value) && value > 0 ? value : null;
}

function parseCategories(raw: string | null): number[] | null | undefined {
  if (raw === null) return undefined;
  const parts = raw.split(",").map((p) => p.trim()).filter((p) => p !== "");
  if (parts.length === 0) return null;
  const out: number[] = [];
  for (const part of parts) {
    const id = Number(part);
    if (!Number.isInteger(id) || id <= 0) return null;
    out.push(id);
  }
  return out;
}

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const rawQuery = params.get("q");
  const q = rawQuery === null || rawQuery.trim() === "" ? undefined : rawQuery.trim();
  const categoryIds = parseCategories(params.get("category"));
  const marketGroupId = parsePositive(params.get("marketGroup"));
  const limitRaw = parsePositive(params.get("limit"));
  if (categoryIds === null || marketGroupId === null || limitRaw === null) {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  const limit = limitRaw ?? DEFAULT_LIMIT;
  if (limit > MAX_LIMIT || (q !== undefined && q.length > MAX_QUERY)) {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  // A browse with no filter at all would page the whole SDE: that is a client bug, not a query.
  if (q === undefined && categoryIds === undefined && marketGroupId === undefined) {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  const [types, metaGroups] = await Promise.all([
    browseTypes({ q, categoryIds, marketGroupId, limit }),
    getMetaGroups(),
  ]);
  return NextResponse.json({
    types: types.map((t) => ({
      id: t.id, name: t.name, groupId: t.groupId, categoryId: t.categoryId,
      marketGroupId: t.marketGroupId,
      metaGroup: t.metaGroupId === null ? null : (metaGroups.get(t.metaGroupId) ?? null),
      metaLevel: t.metaLevel,
    })),
  });
}
```

`src/app/api/sde/market-groups/route.ts`:
```ts
import { NextResponse } from "next/server";
import { listMarketGroups } from "../../../../lib/sde/repo.js";

/** The tree changes only when the SDE is re-imported; the client keeps it for a day. */
export async function GET() {
  return NextResponse.json({ groups: await listMarketGroups() }, {
    headers: { "Cache-Control": "public, max-age=86400" },
  });
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run tests/api/sde-routes.test.ts tests/db/sde-browse.test.ts && npm run typecheck`
Expected: 4 route tests and 4 repo tests pass; `tsc --noEmit` clean.

- [ ] **Step 7: Commit**

```bash
git add src/app/api/sde src/lib/sde/repo.ts tests/api/sde-routes.test.ts tests/db/sde-browse.test.ts
git commit -m "$(cat <<'EOM'
feat(api): SDE browse and market-group routes for the item browser

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOM
)"
```

---

### Task 8: `GET /api/market/prices` with a synchronous Fuzzwork top-up

Spec §6: "ids with no row (or older than 24 h) are fetched from Fuzzwork synchronously (chunks
≤ 500) and upserted before responding, so the designer never waits an hour." This is the one place
in the whole app where a request may leave the machine, and it is deliberate.

**Files:**
- Create: `src/app/api/market/prices/route.ts`, `tests/api/market-prices-route.test.ts`
- Modify: `src/lib/db/market-prices.ts` (add `stalePriceIds`), `tests/db/market-prices.test.ts`

**Interfaces:**
- Consumes (phase 4b, verbatim):
```ts
// src/lib/db/market-prices.ts
export interface Price { sell: number | null; buy: number | null; adjusted: number | null }   // from ../view/price.js
export interface JitaPriceRow { typeId: number; sellMin: number | null; buyMax: number | null }
export async function upsertJitaPrices(rows: JitaPriceRow[]): Promise<number>
export async function getPrices(typeIds: number[]): Promise<Map<number, Price>>
// src/lib/market/fuzzwork.ts
export const FUZZWORK_CHUNK = 500;
export async function fetchAggregates(typeIds: number[], fetchImpl?: typeof fetch, userAgent?: string): Promise<JitaPriceRow[]>
// src/lib/api/json.ts (Task 6)
export function parseIdList(raw: string | null, max: number): number[] | null;
```
- Produces:
```ts
// src/lib/db/market-prices.ts
export function stalePriceIds(typeIds: number[], maxAgeHours: number): Promise<number[]>;
// GET /api/market/prices?ids=587,2889
//   → { prices: { "587": { sell: number|null, buy: number|null, adjusted: number|null }, … } }
```

**Decisions recorded here (do not re-litigate them):**
- **Staleness is `updated_at` alone** (Decision 5 in the plan header). No new column: a type with no
  row at all is stale, and a row older than 24 h is stale. The known cost is that a type Fuzzwork
  has no orders for gets its `updated_at` bumped by the top-up anyway (the upsert writes NULLs), so
  it is not refetched for another day — which is the behaviour we want, not a bug.
- **The top-up is capped at one Fuzzwork chunk.** `ids` is limited to 500, which is exactly
  `FUZZWORK_CHUNK`, so at most one outbound request happens per API call. The editor asks for the
  fit's types plus the visible browser page — a few dozen — so this ceiling is never near.
- **A Fuzzwork failure is logged and swallowed.** Fuzzwork is one person's server with no SLA
  (phase 4b established this); the route still answers 200 with whatever `market_prices` holds,
  which is ESI's `adjusted_price` at worst. `priceOf` already falls back to it.
- The response is a **plain object keyed by type id as a string**, not an array of pairs — the
  client turns it straight into a `Map` with `new Map(Object.entries(...).map(...))`.
- The route calls Fuzzwork, **not ESI**. The "pages never call ESI inline" rule is intact.

- [ ] **Step 1: Write the failing repo test**

`tests/db/market-prices.test.ts` currently opens `pool` unbound (`beforeAll(async () => { await
resetDb(); }, 60_000);`) and imports only `getPrices`/`upsertEsiPrices`/`upsertJitaPrices`. This
step's test uses `pool.query` and `stalePriceIds`, so first patch the top of the file:
```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Pool } from "pg";
import { resetDb } from "./helpers.js";
import { closePool } from "../../src/lib/db/client.js";
import { getPrices, upsertEsiPrices, upsertJitaPrices, stalePriceIds } from "../../src/lib/db/market-prices.js";

let pool: Pool;

beforeAll(async () => { pool = await resetDb(); }, 60_000);
afterAll(closePool);
```

Then append to `tests/db/market-prices.test.ts`:
```ts
describe("stalePriceIds", () => {
  it("reports ids with no row and ids older than the age limit", async () => {
    await upsertJitaPrices([{ typeId: 34, sellMin: 4.2, buyMax: 4 }]);
    await pool.query("UPDATE market_prices SET updated_at = now() - interval '30 hours' WHERE type_id = 34");
    await upsertJitaPrices([{ typeId: 35, sellMin: 8, buyMax: 7 }]);

    expect((await stalePriceIds([34, 35, 36], 24)).sort((a, b) => a - b)).toEqual([34, 36]);
    expect(await stalePriceIds([35], 24)).toEqual([]);
    expect(await stalePriceIds([], 24)).toEqual([]);
  });
});
```

- [ ] **Step 2: Write the failing route test**

`tests/api/market-prices-route.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { getPrices, stalePriceIds, upsertJitaPrices, fetchAggregates } = vi.hoisted(() => ({
  getPrices: vi.fn(), stalePriceIds: vi.fn(), upsertJitaPrices: vi.fn(), fetchAggregates: vi.fn(),
}));
vi.mock("../../src/lib/db/market-prices.js", () => ({ getPrices, stalePriceIds, upsertJitaPrices }));
vi.mock("../../src/lib/market/fuzzwork.js", () => ({ fetchAggregates, FUZZWORK_CHUNK: 500 }));

const { GET } = await import("../../src/app/api/market/prices/route.js");
const request = (query: string) => new NextRequest(`https://eve.plasma66.com/api/market/prices${query}`);

beforeEach(() => {
  vi.resetAllMocks();
  stalePriceIds.mockResolvedValue([]);
  getPrices.mockResolvedValue(new Map([[587, { sell: 8_000_000, buy: 7_500_000, adjusted: 7_900_000 }]]));
});

describe("GET /api/market/prices", () => {
  it("serves stored prices as an object keyed by type id", async () => {
    const res = await GET(request("?ids=587"));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      prices: { "587": { sell: 8000000, buy: 7500000, adjusted: 7900000 } },
    });
    expect(fetchAggregates).not.toHaveBeenCalled();
  });

  it("tops stale ids up from Fuzzwork before answering", async () => {
    stalePriceIds.mockResolvedValue([2889]);
    fetchAggregates.mockResolvedValue([{ typeId: 2889, sellMin: 1_500_000, buyMax: 1_400_000 }]);
    const res = await GET(request("?ids=587,2889"));
    expect(res.status).toBe(200);
    expect(stalePriceIds).toHaveBeenCalledWith([587, 2889], 24);
    expect(fetchAggregates).toHaveBeenCalledWith([2889]);
    expect(upsertJitaPrices).toHaveBeenCalledWith([{ typeId: 2889, sellMin: 1500000, buyMax: 1400000 }]);
    // getPrices runs AFTER the upsert, so the answer includes the fresh row.
    expect(getPrices).toHaveBeenCalledWith([587, 2889]);
  });

  it("still answers 200 when Fuzzwork is down", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    stalePriceIds.mockResolvedValue([2889]);
    fetchAggregates.mockRejectedValue(new Error("Fuzzwork 503 for 1 types"));
    const res = await GET(request("?ids=587,2889"));
    expect(res.status).toBe(200);
    expect(upsertJitaPrices).not.toHaveBeenCalled();
    expect(logged).toHaveBeenCalled();
    logged.mockRestore();
  });

  it("rejects a missing, malformed or oversized id list", async () => {
    expect((await GET(request(""))).status).toBe(400);
    expect((await GET(request("?ids=abc"))).status).toBe(400);
    const many = Array.from({ length: 501 }, (_, i) => i + 1).join(",");
    expect((await GET(request(`?ids=${many}`))).status).toBe(400);
    expect(getPrices).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Run both tests to verify they fail**

Run: `npx vitest run tests/api/market-prices-route.test.ts tests/db/market-prices.test.ts`
Expected: FAIL — `stalePriceIds is not a function` and the route import does not resolve.

- [ ] **Step 4: Add `stalePriceIds`**

Append to `src/lib/db/market-prices.ts`:
```ts
/**
 * Which of these types the designer must not trust: no row at all, or a row older than
 * `maxAgeHours`. Spec §6 — the fitting designer tops these up from Fuzzwork before answering
 * rather than waiting for the hourly job.
 */
export async function stalePriceIds(typeIds: number[], maxAgeHours: number): Promise<number[]> {
  const wanted = [...new Set(typeIds)];
  if (wanted.length === 0) return [];
  const { rows } = await getPool().query<{ id: number }>(
    `SELECT w.id FROM unnest($1::int[]) AS w(id)
     LEFT JOIN market_prices p ON p.type_id = w.id
     WHERE p.type_id IS NULL OR p.updated_at < now() - make_interval(hours => $2)`,
    [wanted, maxAgeHours]);
  return rows.map((r) => r.id);
}
```

- [ ] **Step 5: Write the route**

`src/app/api/market/prices/route.ts`:
```ts
import { NextResponse, type NextRequest } from "next/server";
import { parseIdList } from "../../../../lib/api/json.js";
import { getPrices, stalePriceIds, upsertJitaPrices } from "../../../../lib/db/market-prices.js";
import { FUZZWORK_CHUNK, fetchAggregates } from "../../../../lib/market/fuzzwork.js";

/** Spec §6's "chunks ≤ 500" — one outbound Fuzzwork request per API call, at most. */
const MAX_IDS = FUZZWORK_CHUNK;
const MAX_AGE_HOURS = 24;

export async function GET(req: NextRequest) {
  const ids = parseIdList(req.nextUrl.searchParams.get("ids"), MAX_IDS);
  if (ids === null) return NextResponse.json({ error: "bad request" }, { status: 400 });

  const stale = await stalePriceIds(ids, MAX_AGE_HOURS);
  if (stale.length > 0) {
    try {
      const rows = await fetchAggregates(stale);
      if (rows.length > 0) await upsertJitaPrices(rows);
    } catch (e) {
      // Fuzzwork has no SLA (phase 4b, spec §3). Degrade to whatever is stored — at worst ESI's
      // adjusted price, which `priceOf` already falls back to — rather than failing the request.
      console.error("[market] Fuzzwork top-up failed", e);
    }
  }

  const prices = await getPrices(ids);
  return NextResponse.json({ prices: Object.fromEntries(prices) });
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run tests/api/market-prices-route.test.ts tests/db/market-prices.test.ts && npm run typecheck`
Expected: 4 route tests and the repo test pass; `tsc --noEmit` clean; **no stray console output**.

- [ ] **Step 7: Commit**

```bash
git add src/app/api/market src/lib/db/market-prices.ts tests/api/market-prices-route.test.ts tests/db/market-prices.test.ts
git commit -m "$(cat <<'EOM'
feat(api): market price route with a synchronous Fuzzwork top-up

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOM
)"
```

---

### Task 9: `GET /api/characters/[id]/skills`

Spec §3's third fetch: the character's trained skills and active-clone implants, so the browser
engine can build the same `FitContext` the server builds in `loadFitData`.

**Files:**
- Create: `src/app/api/characters/[id]/skills/route.ts`, `tests/api/skills-route.test.ts`

**Interfaces:**
- Consumes (phase 1/3, verbatim):
```ts
// src/lib/db/characters.ts
export async function getCharacter(id: number): Promise<Character | null>
// src/lib/db/character-skills.ts
export interface SkillRow { skillId: number; trainedLevel: number; activeLevel: number; skillpoints: number }
export async function listSkills(characterId: number): Promise<SkillRow[]>
// src/lib/db/character-clones.ts
export async function listImplants(characterId: number): Promise<number[]>
// src/lib/api/json.ts
export function parseId(raw: string): number | null
```
- Produces:
```ts
// GET /api/characters/[id]/skills
//   → { skills: [{ skillId: number, level: number }], implants: number[] }   (200)
//   → { error } (400 bad id) | (404 unknown character)
```

**Decisions recorded here (do not re-litigate them):**
- **Trained level, not active level** — the same rule `src/lib/ships/load.ts` records: the sheet
  answers "can I fly this", and an unplugged clone does not untrain a skill.
- A character with no skills synced yet answers `{ skills: [], implants: [] }` with a 200. The
  editor's banner ("no skills synced") is driven by the empty list, exactly as `/ships` does it.
- The route lives under the existing `/api/characters/[id]/` folder next to `wallet`, so it inherits
  that folder's `Ctx = { params: Promise<{ id: string }> }` convention verbatim.

- [ ] **Step 1: Write the failing test**

`tests/api/skills-route.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { getCharacter, listSkills, listImplants } = vi.hoisted(() => ({
  getCharacter: vi.fn(), listSkills: vi.fn(), listImplants: vi.fn(),
}));
vi.mock("../../src/lib/db/characters.js", () => ({ getCharacter }));
vi.mock("../../src/lib/db/character-skills.js", () => ({ listSkills }));
vi.mock("../../src/lib/db/character-clones.js", () => ({ listImplants }));

const { GET } = await import("../../src/app/api/characters/[id]/skills/route.js");

const CID = 90000101;
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const request = () => new NextRequest(`https://eve.plasma66.com/api/characters/${CID}/skills`);

beforeEach(() => {
  vi.resetAllMocks();
  getCharacter.mockImplementation(async (id: number) => (id === CID ? { id: CID, name: "Mara Vexley" } : null));
  listSkills.mockResolvedValue([
    { skillId: 3426, trainedLevel: 5, activeLevel: 4, skillpoints: 256000 },
    { skillId: 3413, trainedLevel: 4, activeLevel: 4, skillpoints: 45255 },
  ]);
  listImplants.mockResolvedValue([27143]);
});

describe("GET /api/characters/[id]/skills", () => {
  it("returns trained levels and the active clone's implants", async () => {
    const res = await GET(request(), ctx(String(CID)));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      skills: [{ skillId: 3426, level: 5 }, { skillId: 3413, level: 4 }],
      implants: [27143],
    });
  });

  it("answers empty lists for a character with nothing synced", async () => {
    listSkills.mockResolvedValue([]);
    listImplants.mockResolvedValue([]);
    await expect((await GET(request(), ctx(String(CID)))).json())
      .resolves.toEqual({ skills: [], implants: [] });
  });

  it("400s on a bad id and 404s on an unknown character", async () => {
    expect((await GET(request(), ctx("nope"))).status).toBe(400);
    expect((await GET(request(), ctx("12345"))).status).toBe(404);
    expect(listSkills).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/api/skills-route.test.ts`
Expected: FAIL — the route module does not resolve.

- [ ] **Step 3: Write the route**

`src/app/api/characters/[id]/skills/route.ts`:
```ts
import { NextResponse, type NextRequest } from "next/server";
import { parseId } from "../../../../../lib/api/json.js";
import { getCharacter } from "../../../../../lib/db/characters.js";
import { listImplants } from "../../../../../lib/db/character-clones.js";
import { listSkills } from "../../../../../lib/db/character-skills.js";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Spec §3: the skills half of the browser engine's `FitContext`.
 * Trained level, not active level — the same rule `src/lib/ships/load.ts` records: the sheet answers
 * "can I fly this", and an unplugged clone does not untrain a skill.
 */
export async function GET(_req: NextRequest, { params }: Ctx) {
  const id = parseId((await params).id);
  if (id === null) return NextResponse.json({ error: "bad request" }, { status: 400 });
  if ((await getCharacter(id)) === null) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const [skills, implants] = await Promise.all([listSkills(id), listImplants(id)]);
  return NextResponse.json({
    skills: skills.map((s) => ({ skillId: s.skillId, level: s.trainedLevel })),
    implants,
  });
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/api/skills-route.test.ts && npm run typecheck`
Expected: 3 tests pass; `tsc --noEmit` clean.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/characters tests/api/skills-route.test.ts
git commit -m "$(cat <<'EOM'
feat(api): character skills and implants route for the browser engine

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOM
)"
```

---

### Task 10: `/api/fits` and `/api/fits/[id]`

Spec §6's CRUD. Bodies are validated by pure functions in `src/lib/fits/parse.ts`, so the rules are
unit-tested rather than smoke-tested through a route.

**Files:**
- Create: `src/lib/fits/parse.ts`, `src/app/api/fits/route.ts`, `src/app/api/fits/[id]/route.ts`, `tests/api/fits-routes.test.ts`

**Interfaces:**
- Consumes (Tasks 1 and 2, plus phase 4a):
```ts
// src/lib/db/fits.ts
export interface FitRow { id: number; name: string; description: string; shipTypeId: number;
                          characterId: number | null; createdAt: Date; updatedAt: Date; items: FitItem[] }
export function listFits(): Promise<FitRow[]>;
export function getFit(id: number): Promise<FitRow | null>;
export function createFit(input: FitInput): Promise<FitRow>;
export function updateFit(id: number, patch: FitPatch): Promise<FitRow | null>;
export function deleteFit(id: number): Promise<boolean>;
// src/lib/fits/doc.ts
export interface FitItem { typeId: number; quantity: number; flag: string; chargeTypeId: number | null; state: FitItemState }
export const FIT_ITEM_STATES: readonly FitItemState[];
export const CARGO_FLAG: string;
// src/lib/dogma/index.ts
const DRONE_BAY_FLAG: string
function slotFromFlag(flag: string): { slot: SlotKind; index: number } | null
// src/lib/api/json.ts
export function parseId(raw: string): number | null
```
- Produces:
```ts
// src/lib/fits/parse.ts — pure
export const MAX_FIT_ITEMS: number;                  // 200
export const MAX_FIT_NAME: number;                   // 60
export interface FitCreateBody { name: string; description: string; shipTypeId: number;
                                 characterId: number | null; items: FitItem[] }
export interface FitPatchBody { name?: string; description?: string; characterId?: number | null; items?: FitItem[] }
export function parseFitItems(raw: unknown): FitItem[] | null;
export function parseFitCreate(body: unknown): FitCreateBody | null;
export function parseFitPatch(body: unknown): FitPatchBody | null;
// GET    /api/fits        → { fits: FitJson[] }
// POST   /api/fits        { name, shipTypeId, characterId?, description?, items? } → { fit: FitJson } (201)
// GET    /api/fits/[id]   → { fit: FitJson }
// PUT    /api/fits/[id]   { name?, description?, characterId?, items? } → { fit: FitJson }
// DELETE /api/fits/[id]   → 204
// FitJson = FitRow with createdAt/updatedAt as ISO strings (what NextResponse.json already produces)
```

**Decisions recorded here (do not re-litigate them):**
- **Validation is a pure function, not inline `if`s.** `parseFitItems` is the single place that
  knows a flag must be a slot flag, `DroneBay` or `Cargo`, and it is tested directly.
- **`characterId: null` in a `PUT` body is meaningful** — it selects the "All skills V" pilot. So
  `parseFitPatch` distinguishes *absent* (leave alone) from *present and null* (clear), which is
  why `updateFit` takes `"characterId" in patch` rather than a nullish check.
- **A `PUT` with no `items` key renames without touching the fit.** The autosave always sends items;
  the inline name edit does not have to.
- **Limits:** name 1–60 characters after trimming, description ≤ 500, at most 200 items, quantity
  1–1,000,000,000. A Titan fit is ~40 items; 200 is generous and stops a runaway loop from writing a
  million rows.
- The routes do **not** verify that `shipTypeId` is a real hull. The SDE is swapped wholesale by the
  importer and an id that is valid today may not be tomorrow; spec §7 already says an unknown type
  renders as `Unknown type (id)`. Validating here would only move the failure earlier without
  making it rarer.
- `DELETE` answers **204 with no body** on success and 404 when the fit was already gone.

- [ ] **Step 1: Write the failing test**

`tests/api/fits-routes.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { parseFitCreate, parseFitItems, parseFitPatch } from "../../src/lib/fits/parse.js";

const { listFits, getFit, createFit, updateFit, deleteFit } = vi.hoisted(() => ({
  listFits: vi.fn(), getFit: vi.fn(), createFit: vi.fn(), updateFit: vi.fn(), deleteFit: vi.fn(),
}));
vi.mock("../../src/lib/db/fits.js", () => ({ listFits, getFit, createFit, updateFit, deleteFit }));

const { GET: LIST, POST } = await import("../../src/app/api/fits/route.js");
const { GET: ONE, PUT, DELETE } = await import("../../src/app/api/fits/[id]/route.js");

const GUN = { typeId: 2889, quantity: 1, flag: "HiSlot0", chargeTypeId: 12608, state: "active" };
const FIT = {
  id: 1, name: "Cheap Rifter", description: "", shipTypeId: 587, characterId: 90000101,
  createdAt: new Date("2026-09-02T10:00:00Z"), updatedAt: new Date("2026-09-02T10:00:00Z"), items: [GUN],
};
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const post = (body: unknown) =>
  new NextRequest("https://eve.plasma66.com/api/fits", {
    method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" },
  });
const put = (body: unknown) =>
  new NextRequest("https://eve.plasma66.com/api/fits/1", {
    method: "PUT", body: JSON.stringify(body), headers: { "content-type": "application/json" },
  });

beforeEach(() => {
  vi.resetAllMocks();
  listFits.mockResolvedValue([FIT]);
  getFit.mockImplementation(async (id: number) => (id === 1 ? FIT : null));
  createFit.mockResolvedValue(FIT);
  updateFit.mockImplementation(async (id: number) => (id === 1 ? FIT : null));
  deleteFit.mockImplementation(async (id: number) => id === 1);
});

describe("parseFitItems", () => {
  it("accepts slot, drone-bay and cargo flags", () => {
    expect(parseFitItems([
      GUN,
      { typeId: 2456, quantity: 5, flag: "DroneBay", chargeTypeId: null, state: "active" },
      { typeId: 12608, quantity: 600, flag: "Cargo", chargeTypeId: null, state: "active" },
    ])).toHaveLength(3);
  });
  it("defaults quantity, charge and state", () => {
    expect(parseFitItems([{ typeId: 2889, flag: "HiSlot0" }]))
      .toEqual([{ typeId: 2889, quantity: 1, flag: "HiSlot0", chargeTypeId: null, state: "active" }]);
  });
  it("rejects a bad flag, a bad state, a bad type id and a non-array", () => {
    expect(parseFitItems([{ typeId: 2889, flag: "Nonsense" }])).toBeNull();
    expect(parseFitItems([{ typeId: 2889, flag: "HiSlot0", state: "melted" }])).toBeNull();
    expect(parseFitItems([{ typeId: 0, flag: "HiSlot0" }])).toBeNull();
    expect(parseFitItems([{ typeId: 2889, flag: "HiSlot0", quantity: 0 }])).toBeNull();
    expect(parseFitItems("nope")).toBeNull();
    expect(parseFitItems(Array.from({ length: 201 }, () => ({ typeId: 1, flag: "Cargo" })))).toBeNull();
  });
});

describe("parseFitCreate / parseFitPatch", () => {
  it("requires a name and a hull, and defaults the rest", () => {
    expect(parseFitCreate({ name: "  Cheap Rifter ", shipTypeId: 587 }))
      .toEqual({ name: "Cheap Rifter", description: "", shipTypeId: 587, characterId: null, items: [] });
    expect(parseFitCreate({ shipTypeId: 587 })).toBeNull();
    expect(parseFitCreate({ name: "", shipTypeId: 587 })).toBeNull();
    expect(parseFitCreate({ name: "x".repeat(61), shipTypeId: 587 })).toBeNull();
    expect(parseFitCreate({ name: "ok", shipTypeId: "587" })).toBeNull();
  });

  it("tells an absent characterId from an explicit null", () => {
    expect(parseFitPatch({ name: "New" })).toEqual({ name: "New" });
    expect(parseFitPatch({ characterId: null })).toEqual({ characterId: null });
    expect(parseFitPatch({ characterId: 90000101 })).toEqual({ characterId: 90000101 });
    expect(parseFitPatch({ characterId: 0 })).toBeNull();
    expect(parseFitPatch({})).toEqual({});
  });
});

describe("the fits routes", () => {
  it("lists and reads", async () => {
    const list = await LIST();
    expect(list.status).toBe(200);
    expect((await list.json()).fits).toHaveLength(1);
    const one = await ONE(new NextRequest("https://eve.plasma66.com/api/fits/1"), ctx("1"));
    expect((await one.json()).fit.name).toBe("Cheap Rifter");
  });

  it("creates with a 201 and passes the parsed body through", async () => {
    const res = await POST(post({ name: "Cheap Rifter", shipTypeId: 587, characterId: 90000101, items: [GUN] }));
    expect(res.status).toBe(201);
    expect(createFit).toHaveBeenCalledWith({
      name: "Cheap Rifter", description: "", shipTypeId: 587, characterId: 90000101, items: [GUN],
    });
  });

  it("replaces the items wholesale on PUT", async () => {
    const res = await PUT(put({ name: "Renamed", items: [] }), ctx("1"));
    expect(res.status).toBe(200);
    expect(updateFit).toHaveBeenCalledWith(1, { name: "Renamed", items: [] });
  });

  it("deletes with a 204", async () => {
    expect((await DELETE(new NextRequest("https://eve.plasma66.com/api/fits/1"), ctx("1"))).status).toBe(204);
  });

  it("400s on bad ids and bad bodies, 404s on unknown fits", async () => {
    expect((await ONE(new NextRequest("https://eve.plasma66.com/api/fits/x"), ctx("x"))).status).toBe(400);
    expect((await ONE(new NextRequest("https://eve.plasma66.com/api/fits/2"), ctx("2"))).status).toBe(404);
    expect((await POST(post({ shipTypeId: 587 }))).status).toBe(400);
    expect((await PUT(put({ items: "nope" }), ctx("1"))).status).toBe(400);
    expect((await PUT(put({ name: "x" }), ctx("2"))).status).toBe(404);
    expect((await DELETE(new NextRequest("https://eve.plasma66.com/api/fits/2"), ctx("2"))).status).toBe(404);
  });

  it("400s on a body that is not JSON at all", async () => {
    const broken = new NextRequest("https://eve.plasma66.com/api/fits", {
      method: "POST", body: "{", headers: { "content-type": "application/json" },
    });
    expect((await POST(broken)).status).toBe(400);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/api/fits-routes.test.ts`
Expected: FAIL — `Failed to resolve import "../../src/lib/fits/parse.js"`.

- [ ] **Step 3: Write the body parsers**

`src/lib/fits/parse.ts`:
```ts
/**
 * Request-body validation for the fit routes, as pure functions so the rules are unit-tested
 * rather than smoke-tested through a route. `null` always means "answer 400".
 */
import { DRONE_BAY_FLAG, slotFromFlag } from "../dogma/index.js";
import { CARGO_FLAG, FIT_ITEM_STATES, type FitItem, type FitItemState } from "./doc.js";

export const MAX_FIT_ITEMS = 200;
export const MAX_FIT_NAME = 60;
export const MAX_FIT_DESCRIPTION = 500;
const MAX_QUANTITY = 1_000_000_000;

export interface FitCreateBody {
  name: string; description: string; shipTypeId: number; characterId: number | null; items: FitItem[];
}
export interface FitPatchBody {
  name?: string; description?: string; characterId?: number | null; items?: FitItem[];
}

const isPositiveInt = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v) && v > 0;
const field = (body: unknown, key: string): unknown =>
  body !== null && typeof body === "object" ? (body as Record<string, unknown>)[key] : undefined;
const has = (body: unknown, key: string): boolean =>
  body !== null && typeof body === "object" && key in (body as Record<string, unknown>);

function validFlag(flag: unknown): flag is string {
  return typeof flag === "string"
    && (flag === CARGO_FLAG || flag === DRONE_BAY_FLAG || slotFromFlag(flag) !== null);
}

export function parseFitItems(raw: unknown): FitItem[] | null {
  if (!Array.isArray(raw) || raw.length > MAX_FIT_ITEMS) return null;
  const out: FitItem[] = [];
  for (const entry of raw) {
    const typeId = field(entry, "typeId");
    const flag = field(entry, "flag");
    if (!isPositiveInt(typeId) || !validFlag(flag)) return null;

    const rawQuantity = field(entry, "quantity");
    const quantity = rawQuantity === undefined ? 1 : rawQuantity;
    if (!isPositiveInt(quantity) || quantity > MAX_QUANTITY) return null;

    const rawCharge = field(entry, "chargeTypeId");
    const chargeTypeId = rawCharge === undefined || rawCharge === null ? null : rawCharge;
    if (chargeTypeId !== null && !isPositiveInt(chargeTypeId)) return null;

    const rawState = field(entry, "state");
    const state = rawState === undefined ? "active" : rawState;
    if (typeof state !== "string" || !FIT_ITEM_STATES.includes(state as FitItemState)) return null;

    out.push({ typeId, quantity, flag, chargeTypeId, state: state as FitItemState });
  }
  return out;
}

function parseName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const name = raw.trim();
  return name.length >= 1 && name.length <= MAX_FIT_NAME ? name : null;
}

function parseDescription(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  return raw.length <= MAX_FIT_DESCRIPTION ? raw : null;
}

export function parseFitCreate(body: unknown): FitCreateBody | null {
  const name = parseName(field(body, "name"));
  const shipTypeId = field(body, "shipTypeId");
  if (name === null || !isPositiveInt(shipTypeId)) return null;

  const rawDescription = field(body, "description");
  const description = rawDescription === undefined ? "" : parseDescription(rawDescription);
  if (description === null) return null;

  const rawCharacter = field(body, "characterId");
  const characterId = rawCharacter === undefined || rawCharacter === null ? null : rawCharacter;
  if (characterId !== null && !isPositiveInt(characterId)) return null;

  const rawItems = field(body, "items");
  const items = rawItems === undefined ? [] : parseFitItems(rawItems);
  if (items === null) return null;

  return { name, description, shipTypeId, characterId, items };
}

export function parseFitPatch(body: unknown): FitPatchBody | null {
  if (body === null || typeof body !== "object" || Array.isArray(body)) return null;
  const patch: FitPatchBody = {};

  if (has(body, "name")) {
    const name = parseName(field(body, "name"));
    if (name === null) return null;
    patch.name = name;
  }
  if (has(body, "description")) {
    const description = parseDescription(field(body, "description"));
    if (description === null) return null;
    patch.description = description;
  }
  // An explicit null selects the "All skills V" pilot, so absent and null are different answers.
  if (has(body, "characterId")) {
    const raw = field(body, "characterId");
    if (raw !== null && !isPositiveInt(raw)) return null;
    patch.characterId = raw === null ? null : (raw as number);
  }
  if (has(body, "items")) {
    const items = parseFitItems(field(body, "items"));
    if (items === null) return null;
    patch.items = items;
  }
  return patch;
}
```

- [ ] **Step 4: Write the two routes**

`src/app/api/fits/route.ts`:
```ts
import { NextResponse, type NextRequest } from "next/server";
import { createFit, listFits } from "../../../lib/db/fits.js";
import { parseFitCreate } from "../../../lib/fits/parse.js";

export async function GET() {
  return NextResponse.json({ fits: await listFits() });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const input = parseFitCreate(body);
  if (input === null) return NextResponse.json({ error: "bad request" }, { status: 400 });
  return NextResponse.json({ fit: await createFit(input) }, { status: 201 });
}
```

`src/app/api/fits/[id]/route.ts`:
```ts
import { NextResponse, type NextRequest } from "next/server";
import { parseId } from "../../../../lib/api/json.js";
import { deleteFit, getFit, updateFit } from "../../../../lib/db/fits.js";
import { parseFitPatch } from "../../../../lib/fits/parse.js";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  const id = parseId((await params).id);
  if (id === null) return NextResponse.json({ error: "bad request" }, { status: 400 });
  const fit = await getFit(id);
  if (fit === null) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ fit });
}

/** Spec §6: items are replaced wholesale; a patch without `items` leaves them alone. */
export async function PUT(req: NextRequest, { params }: Ctx) {
  const id = parseId((await params).id);
  if (id === null) return NextResponse.json({ error: "bad request" }, { status: 400 });
  const patch = parseFitPatch(await req.json().catch(() => null));
  if (patch === null) return NextResponse.json({ error: "bad request" }, { status: 400 });
  const fit = await updateFit(id, patch);
  if (fit === null) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ fit });
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const id = parseId((await params).id);
  if (id === null) return NextResponse.json({ error: "bad request" }, { status: 400 });
  if (!(await deleteFit(id))) return NextResponse.json({ error: "not found" }, { status: 404 });
  return new NextResponse(null, { status: 204 });
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run tests/api/fits-routes.test.ts && npm run typecheck`
Expected: 11 tests pass; `tsc --noEmit` clean.

- [ ] **Step 6: Commit**

```bash
git add src/lib/fits/parse.ts src/app/api/fits tests/api/fits-routes.test.ts
git commit -m "$(cat <<'EOM'
feat(api): fit CRUD routes with pure body validation

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOM
)"
```

---

### Task 11: Cloning — `/api/fits/import`, `/api/fits/from-fitting`, `/api/fits/from-asset`

Spec §6's three "make me a new fit" routes. All three end in `createFit`, so the work is entirely in
turning a source (EFT text, an ESI saved fitting, an assembled ship) into `FitItem[]`. The last two
reuse phase 4b's `loadFitData` and phase 4a's builders verbatim — no new engine code.

**Files:**
- Create: `src/lib/fits/clone.ts`, `src/app/api/fits/import/route.ts`,
  `src/app/api/fits/from-fitting/route.ts`, `src/app/api/fits/from-asset/route.ts`,
  `tests/api/fits-clone-routes.test.ts`

**Interfaces:**
- Consumes (phase 3/4a/4b and Tasks 1–4, verbatim):
```ts
// src/lib/ships/load.ts
export interface FitData { assets: AssetRow[]; fittings: FittingRow[]; ctx: FitContext; skillsSynced: boolean }
export async function loadFitData(characterId: number): Promise<FitData>
// src/lib/view/ships.ts
export interface ShipGroup { ship: AssetRow; children: AssetRow[] }
export function assembledShips(assets: AssetRow[], data: DogmaData): ShipGroup[]
// src/lib/dogma/index.ts
function fitFromAssets(shipAsset: AssetRow, childAssets: AssetRow[], ctx: FitContext): BuiltFit
function fitFromFitting(fitting: FittingRow, items: FittingItemRow[], ctx: FitContext): BuiltFit
// src/lib/dogma/sde-loader.ts
export async function loadDogmaData(typeIds: TypeId[]): Promise<DogmaData>
// src/lib/db/character-fittings.ts
export interface FittingRow { fittingId: number; name: string; description: string; shipTypeId: number; items: FittingItemRow[] }
// src/lib/db/characters.ts
export async function getCharacter(id: number): Promise<Character | null>
// Tasks 1–4 and 7
export function docItemsFromBuilt(built: BuiltFit): FitItem[];
export function tokeniseEft(text: string): EftText | null;
export function assignEftItems(parsed: EftText, byName: ReadonlyMap<string, number>, data: DogmaData): EftAssignment | null;
export function getTypesByNames(names: string[]): Promise<Map<string, number>>;
export function createFit(input: FitInput): Promise<FitRow>;
```
- Produces:
```ts
// src/lib/fits/clone.ts — server only (it imports sde-loader and the repos)
export type CloneOutcome =
  | { kind: "ok"; fit: FitRow; unresolved: string[] }
  | { kind: "notFound" }
  | { kind: "failed" };
export function fitFromEftText(text: string): Promise<CloneOutcome>;
export function fitFromSavedFitting(characterId: number, fittingId: number): Promise<CloneOutcome>;
export function fitFromAssetShip(characterId: number, itemId: number): Promise<CloneOutcome>;
// POST /api/fits/import        { text }                     → { fit, unresolved } (201)
// POST /api/fits/from-fitting  { characterId, fittingId }   → { fit, unresolved: [] } (201)
// POST /api/fits/from-asset    { characterId, itemId }      → { fit, unresolved: [] } (201)
```

**Decisions recorded here (do not re-litigate them):**
- **`CloneOutcome` is a three-way discriminated union**, mapped by the routes to 201 / 404 /
  400 `{ error: "could not build the fit" }`. "Failed" means we found the source but the engine
  threw (`UnknownTypeError` on the hull, `DogmaCycleError`); it is logged with `console.error` and
  is not a 500, because nothing is broken server-side — the data is.
- **An imported fit gets `characterId: null`** (All skills V). EFT text carries no pilot, and
  guessing one would silently change the numbers. Cloning from a fitting or an asset keeps the
  character it came from, because that fit *is* that pilot's.
- **`unresolved` is reported, never fatal** (spec §5). The route answers 201 with the names it could
  not resolve so the UI can list them under the textarea (spec §7).
- **Import resolves names in one statement.** `getTypesByNames` takes the ship name, every module
  name and every charge name at once; `loadDogmaData` then loads exactly those ids (and their skill
  closure) so `assignEftItems` can read the marker effects.
- **`from-asset` and `from-fitting` go through `loadFitData`**, phase 4b's one-`loadDogmaData`-per-
  request loader, rather than assembling a narrower context. It is memoised process-wide, it already
  contains the skills and implants, and reusing it means the clone's numbers match `/ships` exactly.
- A saved ESI fitting with an empty `name` becomes `Fitting <id>`; an assembled ship with no custom
  name becomes its type name. A `fits.name` is `NOT NULL` and the editor's title must not be blank.

- [ ] **Step 1: Write the failing test**

`tests/api/fits-clone-routes.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { fixtureData } from "../dogma/fixture.js";
import type { AssetRow } from "../../src/lib/db/character-assets.js";

const { loadFitData, loadDogmaData, getTypesByNames, getCharacter, createFit } = vi.hoisted(() => ({
  loadFitData: vi.fn(), loadDogmaData: vi.fn(), getTypesByNames: vi.fn(),
  getCharacter: vi.fn(), createFit: vi.fn(),
}));
vi.mock("../../src/lib/ships/load.js", () => ({ loadFitData }));
vi.mock("../../src/lib/dogma/sde-loader.js", () => ({ loadDogmaData }));
vi.mock("../../src/lib/sde/repo.js", () => ({ getTypesByNames }));
vi.mock("../../src/lib/db/characters.js", () => ({ getCharacter }));
vi.mock("../../src/lib/db/fits.js", () => ({ createFit }));

const { POST: IMPORT } = await import("../../src/app/api/fits/import/route.js");
const { POST: FROM_FITTING } = await import("../../src/app/api/fits/from-fitting/route.js");
const { POST: FROM_ASSET } = await import("../../src/app/api/fits/from-asset/route.js");

const data = fixtureData("rifter");
const CID = 90000101;
const ctx = { data, skills: new Map([[3426, 5]]), implants: [] };

const SHIP: AssetRow = {
  itemId: 1000, typeId: 587, quantity: 1, locationId: 60003760, locationType: "station",
  locationFlag: "Hangar", isSingleton: true, isBlueprintCopy: false, name: "Scarlet Dart",
};
const CHILDREN: AssetRow[] = [
  { ...SHIP, itemId: 1001, typeId: 2889, locationId: 1000, locationFlag: "HiSlot0", name: null },
  { ...SHIP, itemId: 1002, typeId: 12608, quantity: 400, locationId: 1000, locationFlag: "HiSlot0", isSingleton: false, name: null },
];
const FITTING = {
  fittingId: 55, name: "Saved Rifter", description: "from ESI", shipTypeId: 587,
  items: [{ idx: 0, typeId: 2048, quantity: 1, flag: "LoSlot0" }],
};

const byName = new Map<string, number>();
for (const type of data.types.values()) if (type.name !== null) byName.set(type.name.toLowerCase(), type.id);

const post = (path: string, body: unknown) =>
  new NextRequest(`https://eve.plasma66.com/api/fits/${path}`, {
    method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" },
  });

beforeEach(() => {
  vi.resetAllMocks();
  getCharacter.mockImplementation(async (id: number) => (id === CID ? { id: CID, name: "Mara Vexley" } : null));
  loadFitData.mockResolvedValue({ assets: [SHIP, ...CHILDREN], fittings: [FITTING], ctx, skillsSynced: true });
  loadDogmaData.mockResolvedValue(data);
  getTypesByNames.mockImplementation(async (names: string[]) =>
    new Map(names.map((n) => [n.toLowerCase(), byName.get(n.toLowerCase())])
      .filter((pair): pair is [string, number] => pair[1] !== undefined)));
  createFit.mockImplementation(async (input: { name: string; items: unknown[] }) => ({
    id: 1, description: "", characterId: null, shipTypeId: 587,
    createdAt: new Date(), updatedAt: new Date(), ...input,
  }));
});

describe("POST /api/fits/import", () => {
  const TEXT = "[Rifter, Imported]\nDamage Control II/offline\n200mm AutoCannon II, Hail S\nHobgoblin II x2\n";

  it("parses the text, creates an All-V fit and reports nothing unresolved", async () => {
    const res = await IMPORT(post("import", { text: TEXT }));
    expect(res.status).toBe(201);
    expect(createFit).toHaveBeenCalledWith({
      name: "Imported", shipTypeId: 587, characterId: null,
      items: [
        { typeId: 2048, quantity: 1, flag: "LoSlot0", chargeTypeId: null, state: "offline" },
        { typeId: 2889, quantity: 1, flag: "HiSlot0", chargeTypeId: 12608, state: "active" },
        { typeId: 2456, quantity: 2, flag: "DroneBay", chargeTypeId: null, state: "active" },
      ],
    });
    await expect(res.json()).resolves.toMatchObject({ unresolved: [] });
  });

  it("reports names it could not resolve without failing", async () => {
    const res = await IMPORT(post("import", { text: "[Rifter, Typos]\nDamage Controll II\n" }));
    expect(res.status).toBe(201);
    await expect(res.json()).resolves.toMatchObject({ unresolved: ["Damage Controll II"] });
  });

  it("400s on an unparseable text, a missing hull, an empty body and a huge body", async () => {
    expect((await IMPORT(post("import", { text: "just some words\n" }))).status).toBe(400);
    expect((await IMPORT(post("import", { text: "[Nonexistent Hull, x]\n" }))).status).toBe(400);
    expect((await IMPORT(post("import", { text: "" }))).status).toBe(400);
    expect((await IMPORT(post("import", { text: "x".repeat(100_001) }))).status).toBe(400);
    expect((await IMPORT(post("import", {}))).status).toBe(400);
    expect(createFit).not.toHaveBeenCalled();
  });
});

describe("POST /api/fits/from-fitting", () => {
  it("clones the saved fitting, keeping its name, description and character", async () => {
    const res = await FROM_FITTING(post("from-fitting", { characterId: CID, fittingId: 55 }));
    expect(res.status).toBe(201);
    expect(createFit).toHaveBeenCalledWith({
      name: "Saved Rifter", description: "from ESI", shipTypeId: 587, characterId: CID,
      items: [{ typeId: 2048, quantity: 1, flag: "LoSlot0", chargeTypeId: null, state: "online" }],
    });
  });

  it("404s on an unknown character or fitting, 400s on a bad body", async () => {
    expect((await FROM_FITTING(post("from-fitting", { characterId: 12345, fittingId: 55 }))).status).toBe(404);
    expect((await FROM_FITTING(post("from-fitting", { characterId: CID, fittingId: 99 }))).status).toBe(404);
    expect((await FROM_FITTING(post("from-fitting", { characterId: CID }))).status).toBe(400);
  });
});

describe("POST /api/fits/from-asset", () => {
  it("clones the assembled ship, keeping its custom name and its loaded charge", async () => {
    const res = await FROM_ASSET(post("from-asset", { characterId: CID, itemId: 1000 }));
    expect(res.status).toBe(201);
    expect(createFit).toHaveBeenCalledWith({
      name: "Scarlet Dart", description: "", shipTypeId: 587, characterId: CID,
      items: [{ typeId: 2889, quantity: 1, flag: "HiSlot0", chargeTypeId: 12608, state: "active" }],
    });
  });

  it("404s when that item is not an assembled ship of this character", async () => {
    expect((await FROM_ASSET(post("from-asset", { characterId: CID, itemId: 4242 }))).status).toBe(404);
  });

  it("404s when this SDE build no longer knows the hull, so it is not an assembled ship", async () => {
    loadFitData.mockResolvedValue({
      assets: [SHIP, ...CHILDREN], fittings: [],
      // `assembledShips` needs the hull's category from DogmaData; without it there is no ship.
      ctx: { data: { ...data, types: new Map() }, skills: new Map(), implants: [] }, skillsSynced: true,
    });
    expect((await FROM_ASSET(post("from-asset", { characterId: CID, itemId: 1000 }))).status).toBe(404);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/api/fits-clone-routes.test.ts`
Expected: FAIL — the three route modules do not resolve.

- [ ] **Step 3: Write `src/lib/fits/clone.ts`**

```ts
/**
 * The three "make me a new fit" sources (spec §6). Server only: this module reaches for the SDE
 * loader and the repos, so nothing under `src/app/fitting/**` may import it.
 */
import { createFit, type FitRow } from "../db/fits.js";
import { fitFromAssets, fitFromFitting } from "../dogma/index.js";
import { loadDogmaData } from "../dogma/sde-loader.js";
import { getTypesByNames } from "../sde/repo.js";
import { loadFitData } from "../ships/load.js";
import { assembledShips } from "../view/ships.js";
import { docItemsFromBuilt } from "./doc.js";
import { assignEftItems, tokeniseEft } from "./eft.js";

export type CloneOutcome =
  | { kind: "ok"; fit: FitRow; unresolved: string[] }
  | { kind: "notFound" }
  | { kind: "failed" };

/** Spec §5: names resolve against `sde_types`, exact and case-insensitive; unknowns are reported. */
export async function fitFromEftText(text: string): Promise<CloneOutcome> {
  const parsed = tokeniseEft(text);
  if (parsed === null) return { kind: "failed" };

  const names = [parsed.shipName];
  for (const line of parsed.lines) {
    if (line.empty !== null) continue;
    names.push(line.name);
    if (line.chargeName !== null) names.push(line.chargeName);
  }

  const byName = await getTypesByNames(names);
  const data = await loadDogmaData([...new Set(byName.values())]);
  const assigned = assignEftItems(parsed, byName, data);
  if (assigned === null) return { kind: "failed" };       // the hull itself did not resolve

  // EFT text carries no pilot, so an imported fit is All skills V until you pick a character.
  const fit = await createFit({
    name: assigned.name, shipTypeId: assigned.shipTypeId, characterId: null, items: assigned.items,
  });
  return { kind: "ok", fit, unresolved: assigned.unresolved };
}

export async function fitFromSavedFitting(characterId: number, fittingId: number): Promise<CloneOutcome> {
  const loaded = await loadFitData(characterId);
  const fitting = loaded.fittings.find((f) => f.fittingId === fittingId);
  if (fitting === undefined) return { kind: "notFound" };

  try {
    const built = fitFromFitting(fitting, fitting.items, loaded.ctx);
    const fit = await createFit({
      name: fitting.name === "" ? `Fitting ${fittingId}` : fitting.name,
      description: fitting.description,
      shipTypeId: fitting.shipTypeId,
      characterId,
      items: docItemsFromBuilt(built),
    });
    return { kind: "ok", fit, unresolved: [] };
  } catch (e) {
    console.error(`[fits] could not clone fitting ${fittingId}`, e);
    return { kind: "failed" };
  }
}

export async function fitFromAssetShip(characterId: number, itemId: number): Promise<CloneOutcome> {
  const loaded = await loadFitData(characterId);
  const group = assembledShips(loaded.assets, loaded.ctx.data).find((g) => g.ship.itemId === itemId);
  if (group === undefined) return { kind: "notFound" };

  try {
    const built = fitFromAssets(group.ship, group.children, loaded.ctx);
    const typeName = loaded.ctx.data.types.get(group.ship.typeId)?.name;
    const fit = await createFit({
      name: group.ship.name ?? typeName ?? `Ship ${itemId}`,
      description: "",
      shipTypeId: group.ship.typeId,
      characterId,
      items: docItemsFromBuilt(built),
    });
    return { kind: "ok", fit, unresolved: [] };
  } catch (e) {
    console.error(`[fits] could not clone assembled ship ${itemId}`, e);
    return { kind: "failed" };
  }
}
```

- [ ] **Step 4: Write the three routes**

`src/app/api/fits/import/route.ts`:
```ts
import { NextResponse, type NextRequest } from "next/server";
import { fitFromEftText } from "../../../../lib/fits/clone.js";

/** A pasted fit is a few hundred bytes; 100 kB is a runaway paste, not a fit. */
const MAX_TEXT = 100_000;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const text = (body as { text?: unknown } | null)?.text;
  if (typeof text !== "string" || text.trim() === "" || text.length > MAX_TEXT) {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  const outcome = await fitFromEftText(text);
  if (outcome.kind !== "ok") {
    return NextResponse.json({ error: "could not build the fit" }, { status: 400 });
  }
  return NextResponse.json({ fit: outcome.fit, unresolved: outcome.unresolved }, { status: 201 });
}
```

`src/app/api/fits/from-fitting/route.ts`:
```ts
import { NextResponse, type NextRequest } from "next/server";
import { getCharacter } from "../../../../lib/db/characters.js";
import { fitFromSavedFitting } from "../../../../lib/fits/clone.js";

const positive = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v) && v > 0;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const characterId = (body as { characterId?: unknown } | null)?.characterId;
  const fittingId = (body as { fittingId?: unknown } | null)?.fittingId;
  if (!positive(characterId) || !positive(fittingId)) {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  if ((await getCharacter(characterId)) === null) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const outcome = await fitFromSavedFitting(characterId, fittingId);
  if (outcome.kind === "notFound") return NextResponse.json({ error: "not found" }, { status: 404 });
  if (outcome.kind === "failed") {
    return NextResponse.json({ error: "could not build the fit" }, { status: 400 });
  }
  return NextResponse.json({ fit: outcome.fit, unresolved: [] }, { status: 201 });
}
```

`src/app/api/fits/from-asset/route.ts` — identical shape, with `itemId` instead of `fittingId` and
`fitFromAssetShip` instead of `fitFromSavedFitting`:
```ts
import { NextResponse, type NextRequest } from "next/server";
import { getCharacter } from "../../../../lib/db/characters.js";
import { fitFromAssetShip } from "../../../../lib/fits/clone.js";

const positive = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v) && v > 0;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const characterId = (body as { characterId?: unknown } | null)?.characterId;
  const itemId = (body as { itemId?: unknown } | null)?.itemId;
  if (!positive(characterId) || !positive(itemId)) {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  if ((await getCharacter(characterId)) === null) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const outcome = await fitFromAssetShip(characterId, itemId);
  if (outcome.kind === "notFound") return NextResponse.json({ error: "not found" }, { status: 404 });
  if (outcome.kind === "failed") {
    return NextResponse.json({ error: "could not build the fit" }, { status: 400 });
  }
  return NextResponse.json({ fit: outcome.fit, unresolved: [] }, { status: 201 });
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run tests/api/fits-clone-routes.test.ts && npm run typecheck`
Expected: 8 tests pass; `tsc --noEmit` clean; no stray console output.

- [ ] **Step 6: Commit**

```bash
git add src/lib/fits/clone.ts src/app/api/fits tests/api/fits-clone-routes.test.ts
git commit -m "$(cat <<'EOM'
feat(api): import EFT text and clone from a saved fitting or an assembled ship

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOM
)"
```

---

### Task 12: The browser dogma store (`src/lib/fits/client-data.ts`)

Spec §3: "the editor requests only what the fit and the character's skills reference, and memoises
per id in a module-level `Map`." This is that module — no React, just promises and Maps, so it is
testable with a fake `fetch` and shared by every editor instance on the page.

**Files:**
- Create: `src/lib/fits/client-data.ts`, `tests/fits/client-data.test.ts`

**Interfaces:**
- Consumes (Tasks 5–9, verbatim):
```ts
// src/lib/dogma/serialize.ts
export interface DogmaMeta { build: number; attributes: Map<AttrId, DogmaAttribute>;
                             effects: Map<EffectId, DogmaEffect>; groups: Map<GroupId, DogmaGroup> }
export interface DogmaMetaJson { build: number; attributes: DogmaAttributeJson[]; effects: DogmaEffectJson[]; groups: DogmaGroup[] }
export interface DogmaTypesJson { build: number; types: DogmaTypeJson[] }
export function deserialiseMeta(json: DogmaMetaJson): DogmaMeta;
export function deserialiseTypes(json: readonly DogmaTypeJson[]): Map<TypeId, DogmaType>;
export function dogmaDataFrom(meta: DogmaMeta, types: Map<TypeId, DogmaType>): DogmaData;
// src/lib/view/price.ts
export interface Price { sell: number | null; buy: number | null; adjusted: number | null }
// src/lib/api/json.ts (Task 6)
export const MAX_IDS = 200;           // the /api/dogma/types ceiling
// src/lib/market/fuzzwork.ts (phase 4b, verbatim)
export const FUZZWORK_CHUNK = 500;    // the /api/market/prices ceiling (Task 8 sets its own MAX_IDS to this)
// Routes: GET /api/dogma/meta, /api/dogma/types?ids=, /api/sde/types?category=16&limit=1000,
//         /api/characters/[id]/skills, /api/market/prices?ids=
```
- Produces:
```ts
// src/lib/fits/client-data.ts — browser only, no React
export interface SkillContext { skills: Map<number, number>; implants: number[]; synced: boolean }
export const TYPE_CHUNK: number;      // = MAX_IDS (json.ts) — the /api/dogma/types ceiling
export const PRICE_CHUNK: number;     // = FUZZWORK_CHUNK (fuzzwork.ts) — the /api/market/prices ceiling
export function resetDogmaStore(): void;                                   // tests, and an SDE build change
export function getDogmaMeta(fetchImpl?: typeof fetch): Promise<DogmaMeta>;
export function ensureTypes(ids: number[], fetchImpl?: typeof fetch): Promise<void>;
export function dogmaData(): DogmaData;                                    // throws before the meta lands
export function allVSkillIds(fetchImpl?: typeof fetch): Promise<number[]>;
export function skillContext(characterId: number | "all-v", fetchImpl?: typeof fetch): Promise<SkillContext>;
export function pricesFor(ids: number[], fetchImpl?: typeof fetch): Promise<Map<number, Price>>;
```

**Decisions recorded here (do not re-litigate them):**
- **Module-level state, one store per browser tab.** Spec §3 asks for exactly this. `resetDogmaStore`
  exists for the tests and for the one production case that needs it: a `build` mismatch between the
  meta and a types response, which means the SDE was re-imported mid-session.
- **`ensureTypes` never re-requests an id it already has or already knows is missing.** Both a
  `Map` of resolved types and a `Set` of unresolvable ids are kept, because an unknown id would
  otherwise be re-requested on every keystroke.
- **"All skills V" fetches the whole category-16 id list, not just the fit's required skills.** It
  has to: `Advanced Weapon Upgrades` (11207) reduces a turret's powergrid but is **not** a required
  skill of any turret, so it is absent from `loadDogmaData`'s `requiredSkillN` closure. Restricting
  All-V to the closure would silently produce wrong numbers. 588 ids → three type batches, fetched
  once per tab.
- **`skillContext` never throws on a fetch failure**; it returns `{ skills: new Map(), implants: [],
  synced: false }` and the editor shows the "no skills synced" banner. A network blip must not blank
  the editor.
- **In-flight de-duplication:** `getDogmaMeta` and `allVSkillIds` cache the *promise*, not the
  result, so two components mounting at once make one request.
- `fetchImpl` is a parameter with a `fetch` default — the same injection style
  `src/lib/market/fuzzwork.ts` uses, and what keeps these tests off the network.

- [ ] **Step 1: Write the failing test**

`tests/fits/client-data.test.ts`:
```ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import { fixtureData } from "../dogma/fixture.js";
import { serialiseMeta, serialiseTypes } from "../../src/lib/dogma/serialize.js";
import {
  TYPE_CHUNK, allVSkillIds, dogmaData, ensureTypes, getDogmaMeta, pricesFor, resetDogmaStore,
  skillContext,
} from "../../src/lib/fits/client-data.js";

const data = fixtureData("rifter");
const META = serialiseMeta(data, 3484357);
const ALL_TYPES = serialiseTypes(data);

let calls: string[] = [];

function fakeFetch(handler: (url: string) => unknown): typeof fetch {
  return (async (input: RequestInfo | URL) => {
    const url = String(input);
    calls.push(url);
    return { ok: true, status: 200, json: async () => handler(url) } as Response;
  }) as typeof fetch;
}

const server = fakeFetch((url) => {
  if (url.startsWith("/api/dogma/meta")) return META;
  if (url.startsWith("/api/dogma/types")) {
    const ids = new Set((new URL(url, "https://x").searchParams.get("ids") ?? "").split(",").map(Number));
    return { build: 3484357, types: ALL_TYPES.filter((t) => ids.has(t.id)) };
  }
  if (url.startsWith("/api/sde/types")) {
    return { types: ALL_TYPES.filter((t) => t.categoryId === 16).map((t) => ({ id: t.id, name: t.name })) };
  }
  if (url.startsWith("/api/characters/")) {
    return { skills: [{ skillId: 3426, level: 5 }], implants: [27143] };
  }
  if (url.startsWith("/api/market/prices")) {
    return { prices: { "587": { sell: 8000000, buy: null, adjusted: null } } };
  }
  throw new Error(`unexpected url ${url}`);
});

beforeEach(() => { resetDogmaStore(); calls = []; });

describe("the browser dogma store", () => {
  it("fetches the meta once, however many callers ask", async () => {
    const [a, b] = await Promise.all([getDogmaMeta(server), getDogmaMeta(server)]);
    expect(a).toBe(b);
    expect(a.build).toBe(3484357);
    expect(calls.filter((c) => c.startsWith("/api/dogma/meta"))).toHaveLength(1);
  });

  it("memoises types per id and never asks twice", async () => {
    await getDogmaMeta(server);
    await ensureTypes([587, 2889], server);
    await ensureTypes([2889, 2048], server);
    const typeCalls = calls.filter((c) => c.startsWith("/api/dogma/types"));
    expect(typeCalls).toHaveLength(2);
    expect(typeCalls[0]).toContain("ids=587%2C2889");
    expect(typeCalls[1]).toContain("ids=2048");
    expect(dogmaData().types.get(587)?.name).toBe("Rifter");
  });

  it("chunks large id lists", async () => {
    await getDogmaMeta(server);
    await ensureTypes(Array.from({ length: TYPE_CHUNK + 5 }, (_, i) => 100000 + i), server);
    expect(calls.filter((c) => c.startsWith("/api/dogma/types"))).toHaveLength(2);
  });

  it("does not re-request ids the server does not know", async () => {
    await getDogmaMeta(server);
    await ensureTypes([999999], server);
    await ensureTypes([999999], server);
    expect(calls.filter((c) => c.startsWith("/api/dogma/types"))).toHaveLength(1);
  });

  it("throws a clear error if the engine is asked for data before the meta lands", () => {
    expect(() => dogmaData()).toThrow(/meta/i);
  });

  it("builds an All-V context from every skill type, and loads their types", async () => {
    await getDogmaMeta(server);
    const context = await skillContext("all-v", server);
    expect(context.synced).toBe(true);
    expect(context.implants).toEqual([]);
    expect(context.skills.get(11207)).toBe(5);          // Advanced Weapon Upgrades, not a required skill
    expect(dogmaData().types.has(11207)).toBe(true);
    expect((await allVSkillIds(server)).length).toBeGreaterThan(0);
    // The id list is fetched once and reused.
    await skillContext("all-v", server);
    expect(calls.filter((c) => c.startsWith("/api/sde/types"))).toHaveLength(1);
  });

  it("builds a character context from the skills route and loads those types", async () => {
    await getDogmaMeta(server);
    const context = await skillContext(90000101, server);
    expect(context.skills.get(3426)).toBe(5);
    expect(context.implants).toEqual([27143]);
    expect(context.synced).toBe(true);
    expect(dogmaData().types.has(3426)).toBe(true);
  });

  it("degrades to an unsynced empty context when the skills route fails", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    await getDogmaMeta(server);
    const broken = (async () => { throw new Error("offline"); }) as unknown as typeof fetch;
    await expect(skillContext(90000101, broken)).resolves.toEqual({
      skills: new Map(), implants: [], synced: false,
    });
    logged.mockRestore();
  });

  it("fetches prices and hands back a Map", async () => {
    const prices = await pricesFor([587], server);
    expect(prices.get(587)).toEqual({ sell: 8000000, buy: null, adjusted: null });
    expect(await pricesFor([], server)).toEqual(new Map());
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/fits/client-data.test.ts`
Expected: FAIL — `Failed to resolve import "../../src/lib/fits/client-data.js"`.

- [ ] **Step 3: Write the store**

`src/lib/fits/client-data.ts`:
```ts
/**
 * The browser's copy of the dogma data (spec §3). Module-level Maps, one store per tab, shared by
 * every editor on the page. No React here — this is plain promises and Maps so it can be tested
 * with a fake `fetch`.
 */
import {
  deserialiseMeta, deserialiseTypes, dogmaDataFrom,
  type DogmaData, type DogmaMeta, type DogmaMetaJson, type DogmaType, type DogmaTypesJson,
} from "../dogma/index.js";
import { MAX_IDS } from "../api/json.js";
import { FUZZWORK_CHUNK } from "../market/fuzzwork.js";
import type { Price } from "../view/price.js";

export interface SkillContext { skills: Map<number, number>; implants: number[]; synced: boolean }

/** The ceilings the two routes enforce (Tasks 6 and 8), re-exported under the store's own names. */
export const TYPE_CHUNK = MAX_IDS;
export const PRICE_CHUNK = FUZZWORK_CHUNK;
/** EVE's skill category. */
const SKILL_CATEGORY = 16;

let metaPromise: Promise<DogmaMeta> | null = null;
let meta: DogmaMeta | null = null;
let allVPromise: Promise<number[]> | null = null;
const types = new Map<number, DogmaType>();
const unknown = new Set<number>();

/** Drops everything. Used by the tests and when a types response reports a different SDE build. */
export function resetDogmaStore(): void {
  metaPromise = null;
  meta = null;
  allVPromise = null;
  types.clear();
  unknown.clear();
}

async function json<T>(url: string, fetchImpl: typeof fetch): Promise<T> {
  const res = await fetchImpl(url);
  if (!res.ok) throw new Error(`${url} answered ${res.status}`);
  return (await res.json()) as T;
}

/** The ~1.25 MB attribute/effect/group blob. Cached for a day by the browser, forever by this tab. */
export function getDogmaMeta(fetchImpl: typeof fetch = fetch): Promise<DogmaMeta> {
  metaPromise ??= json<DogmaMetaJson>("/api/dogma/meta", fetchImpl)
    .then((body) => { meta = deserialiseMeta(body); return meta; })
    .catch((e: unknown) => { metaPromise = null; throw e; });   // a failure must not poison the tab
  return metaPromise;
}

/** Loads any of these ids we do not already have (or already know the server does not have). */
export async function ensureTypes(ids: number[], fetchImpl: typeof fetch = fetch): Promise<void> {
  const wanted = [...new Set(ids)].filter((id) => !types.has(id) && !unknown.has(id));
  for (let i = 0; i < wanted.length; i += TYPE_CHUNK) {
    const batch = wanted.slice(i, i + TYPE_CHUNK);
    const body = await json<DogmaTypesJson>(
      `/api/dogma/types?ids=${encodeURIComponent(batch.join(","))}`, fetchImpl);
    if (meta !== null && body.build !== meta.build) {
      // The SDE was re-imported under us: every id we hold may be from the old build.
      resetDogmaStore();
      throw new Error("static data changed; reload");
    }
    for (const [id, type] of deserialiseTypes(body.types)) types.set(id, type);
    // Anything we asked for and did not get back does not exist in this build.
    for (const id of batch) if (!types.has(id)) unknown.add(id);
  }
}

/** Everything the store holds right now, as the engine wants it. */
export function dogmaData(): DogmaData {
  if (meta === null) throw new Error("dogma meta has not been loaded yet");
  return dogmaDataFrom(meta, types);
}

/**
 * Every skill type id in the game. All-V needs the *whole* list, not the fit's required-skill
 * closure: Advanced Weapon Upgrades (11207) cuts a turret's powergrid without being a required
 * skill of any turret, so the closure would leave it out and the numbers would be wrong.
 */
export function allVSkillIds(fetchImpl: typeof fetch = fetch): Promise<number[]> {
  allVPromise ??= json<{ types: { id: number }[] }>(
    `/api/sde/types?category=${SKILL_CATEGORY}&limit=1000`, fetchImpl)
    .then((body) => body.types.map((t) => t.id))
    .catch((e: unknown) => { allVPromise = null; throw e; });
  return allVPromise;
}

/** The skills half of the engine's `FitContext`, with the types those skills need already loaded. */
export async function skillContext(
  characterId: number | "all-v", fetchImpl: typeof fetch = fetch,
): Promise<SkillContext> {
  try {
    if (characterId === "all-v") {
      const ids = await allVSkillIds(fetchImpl);
      await ensureTypes(ids, fetchImpl);
      return { skills: new Map(ids.map((id) => [id, 5])), implants: [], synced: true };
    }
    const body = await json<{ skills: { skillId: number; level: number }[]; implants: number[] }>(
      `/api/characters/${characterId}/skills`, fetchImpl);
    await ensureTypes([...body.skills.map((s) => s.skillId), ...body.implants], fetchImpl);
    return {
      skills: new Map(body.skills.map((s) => [s.skillId, s.level])),
      implants: body.implants,
      synced: body.skills.length > 0,
    };
  } catch (e) {
    // A network blip must not blank the editor: fall back to "nothing trained", which is exactly
    // what /ships does when phase 3 has not synced, and let the banner say so.
    console.error("[fitting] could not load the skill context", e);
    return { skills: new Map(), implants: [], synced: false };
  }
}

/** Jita prices for the fit and the visible browser page, in chunks the route accepts. */
export async function pricesFor(
  ids: number[], fetchImpl: typeof fetch = fetch,
): Promise<Map<number, Price>> {
  const wanted = [...new Set(ids)];
  const out = new Map<number, Price>();
  for (let i = 0; i < wanted.length; i += PRICE_CHUNK) {
    const batch = wanted.slice(i, i + PRICE_CHUNK);
    const body = await json<{ prices: Record<string, Price> }>(
      `/api/market/prices?ids=${encodeURIComponent(batch.join(","))}`, fetchImpl);
    for (const [id, price] of Object.entries(body.prices)) out.set(Number(id), price);
  }
  return out;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/fits/client-data.test.ts && npm run typecheck`
Expected: 9 tests pass; `tsc --noEmit` clean; no stray console output.

- [ ] **Step 5: Commit**

```bash
git add src/lib/fits/client-data.ts tests/fits/client-data.test.ts
git commit -m "$(cat <<'EOM'
feat(fits): browser-side dogma, skill and price store

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOM
)"
```

---

### Task 13: The editor view model (`src/lib/fits/editor-view.ts`)

The phase-3b/4b pattern, applied to an interactive page: **every string the editor renders is
computed by a pure function**, so the components hold no logic and the numbers are tested without a
DOM. This is the module the React component calls once per keystroke.

**Files:**
- Create: `src/lib/fits/editor-view.ts`, `tests/fits/editor-view.test.ts`

**Interfaces:**
- Consumes (Tasks 1 and 3, plus phase 4a/4b verbatim):
```ts
// src/lib/fits/doc.ts / slots.ts
export interface DocFit { fit: Fit; drones: FitItem[]; cargo: FitItem[]; unknown: FitItem[] }
export function fitFromDoc(doc: FitDoc, ctx: FitContext): DocFit;
export type SlotTotals = Record<SlotKind, number>;
export interface SlotCell { slot: SlotKind; index: number; item: FitItem | null; over: boolean }
export function slotGrid(doc: FitDoc, totals: SlotTotals): Record<SlotKind, SlotCell[]>;
export function slotTotals(fit: Fit): SlotTotals;
export function allowedStates(data: DogmaData, type: DogmaType): FitItemState[];
// src/lib/dogma/index.ts
const ATTR: { cpu: 50; power: 30; upgradeCost: 1153; … };
const SLOT_KINDS: readonly SlotKind[]; const HARDPOINTS: readonly Hardpoint[];
interface FitStats { cpu: ResourcePool; power: ResourcePool; calibration: ResourcePool;
                     slots: Record<SlotKind, SlotUsage>; hardpoints: Record<Hardpoint, SlotUsage>;
                     modules: ModuleStat[] }
interface ModuleStat { item: Item; slot: SlotKind; index: number; cpu: number; power: number;
                       calibration: number; state: State; charged: boolean }
interface Problem { kind: ProblemKind; item?: Item; detail: string; skill?: MissingSkill }
interface MissingSkill { skillTypeId: TypeId; required: number; have: number }
function fitStats(fit: Fit): FitStats
function validateFit(fit: Fit): Problem[]
function missingSkills(fit: Fit): MissingSkill[]
function explain(fit: Fit, item: Item, attrId: AttrId): AppliedModifier[]
function itemLabel(item: Item): string
// src/lib/view/ships.ts
export interface GaugeView { label: string; unit: string; used: number; output: number;
                             text: string; percent: number; over: boolean }
export function gauge(label: string, unit: string, pool: { used: number; output: number }, digits?: number): GaugeView
// src/lib/view/fit-sheet.ts
export interface ExplainRowView { carrier: string; operator: string; value: string; penalised: boolean }
export interface CounterView { label: string; used: number; total: number; over: boolean }
export interface ProblemView { kind: ProblemKind; label: string; text: string }
export interface MissingSkillView { skillTypeId: number; name: string; have: number; need: number }
export function explainRows(applied: AppliedModifier[]): ExplainRowView[];
export function problemText(p: Problem): string;
// src/lib/view/price.ts
export interface Price { sell: number | null; buy: number | null; adjusted: number | null }
export interface ValuedEntry { typeId: number; quantity: number }
export function priceOf(p: Price | undefined): number | null;
export function rollUpValue(entries: ValuedEntry[], prices: ReadonlyMap<number, Price>): ValueRoll;
export function unpricedNote(unpriced: number): string | null;
export function iskShort(value: number): string;
// src/lib/view/format.ts
export function isk(value: number): string;
```
- Produces:
```ts
// src/lib/fits/editor-view.ts — pure, isomorphic
export interface EditorSlotRow {
  key: string; slot: SlotKind; index: number; over: boolean; typeId: number | null;
  name: string; iconUrl: string | null; charge: { typeId: number; name: string } | null;
  cpu: string; power: string; calibration: string;
  state: FitItemState | null; states: FitItemState[];
  cpuExplain: ExplainRowView[]; powerExplain: ExplainRowView[]; price: string | null;
}
export interface EditorSlotBlock { slot: SlotKind; title: string; used: number; total: number; rows: EditorSlotRow[] }
export interface EditorEntryRow { key: string; typeId: number; flag: string; name: string;
                                  quantity: number; value: string | null }
export interface EditorView {
  gauges: GaugeView[]; counters: CounterView[]; blocks: EditorSlotBlock[];
  problems: ProblemView[]; missing: MissingSkillView[];
  drones: EditorEntryRow[]; cargo: EditorEntryRow[]; unknown: EditorEntryRow[];
  value: { total: string; unpriced: string | null };
}
export type EditorResult =
  | { kind: "ok"; view: EditorView; totals: SlotTotals; built: DocFit }
  | { kind: "error" };
export const STATE_LABELS: Record<FitItemState, string>;
export function typeIconUrl(typeId: number, size?: number): string;
export function fitTypeIds(doc: FitDoc): number[];
export function docValueEntries(built: DocFit): ValuedEntry[];
export function editorView(input: {
  doc: FitDoc; data: DogmaData; built: DocFit; stats: FitStats; problems: Problem[];
  totals: SlotTotals; prices: ReadonlyMap<number, Price>;
}): EditorView;
export function computeEditor(doc: FitDoc, ctx: FitContext, prices: ReadonlyMap<number, Price>): EditorResult;
```

**Decisions recorded here (do not re-litigate them):**
- **`computeEditor` is the single entry point the component calls**, and it is the only place engine
  exceptions are caught. `{ kind: "error" }` renders "Could not compute" — the same treatment
  `/ships` gives a broken fit — and the error goes to `console.error`.
- **The view model reuses phase 4b's `GaugeView`, `CounterView`, `ProblemView`, `MissingSkillView`
  and `ExplainRowView` verbatim.** The editor's gauges and the fit sheet's gauges must not drift,
  and every one of those modules is already isomorphic and safe in a client component.
- **An empty slot is a row, not a gap.** `EditorSlotRow.typeId === null` is the empty cell, with
  `name: "Empty"` and `state: null` — the component maps rows to `<tr>`s without branching on
  array lengths.
- **`missing` is sorted the way `missingSkills` returns it** (ascending by skill type id) and named
  from `DogmaData`; a skill whose type the store has not loaded shows as `Skill <id>` rather than
  disappearing.
- **Per-row `explain` calls are wrapped**, exactly like `fit-sheet.ts`'s `safeExplain`: one module
  whose "affected by" cannot be computed must not take down an editor that otherwise renders.
- `fitTypeIds` returns hull + items + charges, which is precisely what `ensureTypes` must load
  before the engine can run; keeping it here means the component has no id-gathering logic.

- [ ] **Step 1: Write the failing test**

`tests/fits/editor-view.test.ts`:
```ts
import { describe, it, expect, vi } from "vitest";
import { fixtureData } from "../dogma/fixture.js";
import { CATEGORY } from "../../src/lib/dogma/index.js";
import { CARGO_FLAG, type FitDoc, type FitItem } from "../../src/lib/fits/doc.js";
import { computeEditor, fitTypeIds, typeIconUrl } from "../../src/lib/fits/editor-view.js";
import type { Price } from "../../src/lib/view/price.js";

const data = fixtureData("rifter");
const allV = new Map<number, number>();
for (const t of data.types.values()) if (t.categoryId === CATEGORY.skill) allV.set(t.id, 5);

const ctxAllV = { data, skills: allV, implants: [] };
const ctxNone = { data, skills: new Map<number, number>(), implants: [] };
const PRICES = new Map<number, Price>([
  [587, { sell: 8_000_000, buy: null, adjusted: null }],
  [2889, { sell: 1_500_000, buy: null, adjusted: null }],
]);

function item(over: Partial<FitItem> & { typeId: number; flag: string }): FitItem {
  return { quantity: 1, chargeTypeId: null, state: "active", ...over };
}
function doc(items: FitItem[]): FitDoc {
  return { id: 1, name: "Cheap Rifter", description: "", shipTypeId: 587, characterId: "all-v", items };
}

const THREE_GUNS = doc([0, 1, 2].map((i) => item({ typeId: 2889, flag: `HiSlot${i}`, chargeTypeId: 12608 })));

describe("fitTypeIds", () => {
  it("collects the hull, every item and every charge", () => {
    expect(fitTypeIds(THREE_GUNS).sort((a, b) => a - b)).toEqual([587, 2889, 12608]);
  });
});

describe("computeEditor", () => {
  it("builds the gauges, the counters and the slot blocks from real engine numbers", () => {
    const result = computeEditor(THREE_GUNS, ctxAllV, PRICES);
    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;

    expect(result.totals).toEqual({ high: 3, mid: 3, low: 4, rig: 3, subsystem: 0 });
    // 3 × 6.75 tf and 3 × 3.60 MW at all skills V.
    expect(result.view.gauges.map((g) => g.text)).toEqual([
      "20.25 / 162.50 tf", "10.80 / 51.25 MW", "0.00 / 400.00",
    ]);
    expect(result.view.gauges.every((g) => !g.over)).toBe(true);
    expect(result.view.counters).toEqual([
      { label: "High", used: 3, total: 3, over: false },
      { label: "Mid", used: 0, total: 3, over: false },
      { label: "Low", used: 0, total: 4, over: false },
      { label: "Rigs", used: 0, total: 3, over: false },
      { label: "Turrets", used: 3, total: 3, over: false },
      { label: "Launchers", used: 0, total: 2, over: false },
    ]);

    const high = result.view.blocks.find((b) => b.slot === "high")!;
    expect(high.rows.map((r) => r.name)).toEqual(
      ["200mm AutoCannon II", "200mm AutoCannon II", "200mm AutoCannon II"]);
    expect(high.rows[0]).toMatchObject({
      key: "high:0", cpu: "6.75", power: "3.60", state: "active", over: false,
      charge: { typeId: 12608, name: "Hail S" }, iconUrl: typeIconUrl(2889),
    });
    expect(high.rows[0].states).toEqual(["offline", "online", "active", "overload"]);
    expect(high.rows[0].cpuExplain.length).toBeGreaterThan(0);

    // A hull with no subsystems contributes no block at all.
    expect(result.view.blocks.map((b) => b.slot)).toEqual(["high", "mid", "low", "rig"]);
    const low = result.view.blocks.find((b) => b.slot === "low")!;
    expect(low.rows).toHaveLength(4);
    expect(low.rows[0]).toMatchObject({ typeId: null, name: "Empty", state: null, cpu: "—" });
  });

  it("has no problems at all skills V and lists named missing skills at none", () => {
    const good = computeEditor(THREE_GUNS, ctxAllV, PRICES);
    expect(good.kind === "ok" && good.view.problems).toEqual([]);
    expect(good.kind === "ok" && good.view.missing).toEqual([]);

    const bad = computeEditor(THREE_GUNS, ctxNone, PRICES);
    if (bad.kind !== "ok") throw new Error("expected ok");
    expect(bad.view.missing.map((m) => m.name)).toContain("Minmatar Frigate");
    expect(bad.view.missing.find((m) => m.name === "Minmatar Frigate")).toMatchObject({ have: 0, need: 1 });
    expect(bad.view.problems.some((p) => p.kind === "skill")).toBe(true);
  });

  it("marks the over-count slot and raises the slot problem", () => {
    const four = doc([0, 1, 2, 3].map((i) => item({ typeId: 2889, flag: `HiSlot${i}` })));
    const result = computeEditor(four, ctxAllV, PRICES);
    if (result.kind !== "ok") throw new Error("expected ok");
    const high = result.view.blocks.find((b) => b.slot === "high")!;
    expect(high.rows).toHaveLength(4);
    expect(high.rows[3].over).toBe(true);
    expect(result.view.counters[0]).toEqual({ label: "High", used: 4, total: 3, over: true });
    expect(result.view.problems.map((p) => p.kind)).toContain("slot");
  });

  it("charges an offline module nothing", () => {
    const offline = doc([
      item({ typeId: 2889, flag: "HiSlot0" }),
      item({ typeId: 2048, flag: "LoSlot0", state: "offline" }),
    ]);
    const result = computeEditor(offline, ctxAllV, PRICES);
    if (result.kind !== "ok") throw new Error("expected ok");
    expect(result.view.gauges[0].text).toBe("6.75 / 162.50 tf");
    const low = result.view.blocks.find((b) => b.slot === "low")!;
    expect(low.rows[0]).toMatchObject({ name: "Damage Control II", cpu: "0.00", state: "offline" });
  });

  it("lists drones, cargo and unknown types, and rolls the value up", () => {
    const stocked = doc([
      item({ typeId: 2889, flag: "HiSlot0" }),
      item({ typeId: 2456, flag: "DroneBay", quantity: 2 }),
      item({ typeId: 12608, flag: CARGO_FLAG, quantity: 600 }),
      item({ typeId: 999999, flag: "MedSlot0" }),
    ]);
    const result = computeEditor(stocked, ctxAllV, PRICES);
    if (result.kind !== "ok") throw new Error("expected ok");
    expect(result.view.drones).toEqual([
      { key: "DroneBay:2456", typeId: 2456, flag: "DroneBay", name: "Hobgoblin II", quantity: 2, value: null },
    ]);
    expect(result.view.cargo[0]).toMatchObject({ typeId: 12608, name: "Hail S", quantity: 600 });
    expect(result.view.unknown).toEqual([
      { key: "MedSlot0:999999", typeId: 999999, flag: "MedSlot0", name: "Unknown type (999999)", quantity: 1, value: null },
    ]);
    // 8,000,000 (hull) + 1,500,000 (gun); the drones and ammo have no price.
    expect(result.view.value.total).toBe("9.5M ISK");
    expect(result.view.value.unpriced).toContain("2 items");
  });

  it("returns an error result and logs when the engine throws", () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(computeEditor(doc([]), { ...ctxAllV, data: { ...data, types: new Map() } }, PRICES))
      .toEqual({ kind: "error" });
    expect(logged).toHaveBeenCalled();
    logged.mockRestore();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/fits/editor-view.test.ts`
Expected: FAIL — `Failed to resolve import "../../src/lib/fits/editor-view.js"`.

- [ ] **Step 3: Write the view model**

`src/lib/fits/editor-view.ts`:
```ts
/**
 * The whole editor as plain strings and numbers. Pure and isomorphic; the React components in
 * Tasks 14–16 render this and hold no logic of their own — the phase-3b/4b pattern, applied to an
 * interactive page.
 */
import {
  ATTR, HARDPOINTS, SLOT_KINDS, explain, fitStats, itemLabel, missingSkills, round2, validateFit,
  type AttrId, type DogmaData, type Fit, type FitContext, type FitStats, type Hardpoint, type Item,
  type ModuleStat, type Problem, type ProblemKind, type SlotKind,
} from "../dogma/index.js";
import { isk } from "../view/format.js";
import { priceOf, rollUpValue, unpricedNote, iskShort, type Price, type ValuedEntry } from "../view/price.js";
import { gauge, type GaugeView } from "../view/ships.js";
import {
  explainRows, problemText,
  type CounterView, type ExplainRowView, type MissingSkillView, type ProblemView,
} from "../view/fit-sheet.js";
import { fitFromDoc, type DocFit, type FitDoc, type FitItem, type FitItemState } from "./doc.js";
import { allowedStates, slotGrid, slotTotals, type SlotTotals } from "./slots.js";

export interface EditorSlotRow {
  key: string; slot: SlotKind; index: number; over: boolean; typeId: number | null;
  name: string; iconUrl: string | null; charge: { typeId: number; name: string } | null;
  cpu: string; power: string; calibration: string;
  state: FitItemState | null; states: FitItemState[];
  cpuExplain: ExplainRowView[]; powerExplain: ExplainRowView[]; price: string | null;
}
export interface EditorSlotBlock { slot: SlotKind; title: string; used: number; total: number; rows: EditorSlotRow[] }
export interface EditorEntryRow {
  key: string; typeId: number; flag: string; name: string; quantity: number; value: string | null;
}
export interface EditorView {
  gauges: GaugeView[]; counters: CounterView[]; blocks: EditorSlotBlock[];
  problems: ProblemView[]; missing: MissingSkillView[];
  drones: EditorEntryRow[]; cargo: EditorEntryRow[]; unknown: EditorEntryRow[];
  value: { total: string; unpriced: string | null };
}
export type EditorResult =
  | { kind: "ok"; view: EditorView; totals: SlotTotals; built: DocFit }
  | { kind: "error" };

export const STATE_LABELS: Record<FitItemState, string> = {
  offline: "Offline", online: "Online", active: "Active", overload: "Overload",
};
const SLOT_TITLES: Record<SlotKind, string> = {
  high: "High", mid: "Mid", low: "Low", rig: "Rigs", subsystem: "Subsystems",
};
const COUNTER_LABELS: Record<SlotKind, string> = {
  high: "High", mid: "Mid", low: "Low", rig: "Rigs", subsystem: "Subsystems",
};
const HARDPOINT_LABELS: Record<Hardpoint, string> = { turret: "Turrets", launcher: "Launchers" };
const PROBLEM_LABELS: Record<ProblemKind, string> = {
  cpu: "CPU", power: "Powergrid", calibration: "Calibration", slot: "Slots", hardpoint: "Hardpoints",
  rigSize: "Rig size", shipRestriction: "Ship restriction", maxGroupFitted: "Max group fitted", skill: "Skill",
};

export function typeIconUrl(typeId: number, size = 32): string {
  return `https://images.evetech.net/types/${typeId}/icon?size=${size}`;
}

/** Exactly what `ensureTypes` must load before the engine can run on this document. */
export function fitTypeIds(doc: FitDoc): number[] {
  const ids = new Set<number>([doc.shipTypeId]);
  for (const entry of doc.items) {
    ids.add(entry.typeId);
    if (entry.chargeTypeId !== null) ids.add(entry.chargeTypeId);
  }
  return [...ids];
}

/** Hull + fitted modules + their charges + drones + cargo, the same roll-up `/ships` uses. */
export function docValueEntries(built: DocFit): ValuedEntry[] {
  const entries: ValuedEntry[] = [{ typeId: built.fit.ship.typeId, quantity: 1 }];
  for (const slotted of built.fit.modules) {
    entries.push({ typeId: slotted.item.typeId, quantity: 1 });
    if (slotted.item.charge !== undefined) entries.push({ typeId: slotted.item.charge.typeId, quantity: 1 });
  }
  for (const drone of built.drones) entries.push({ typeId: drone.typeId, quantity: drone.quantity });
  for (const entry of built.cargo) entries.push({ typeId: entry.typeId, quantity: entry.quantity });
  return entries;
}

/** One module's "affected by" must never take down an editor that otherwise renders. */
function safeExplain(fit: Fit, item: Item, attrId: AttrId): ExplainRowView[] {
  try {
    return explainRows(explain(fit, item, attrId));
  } catch (e) {
    console.error(`[fitting] could not explain attribute ${attrId} of type ${item.typeId}`, e);
    return [];
  }
}

function typeName(data: DogmaData, typeId: number): string {
  return data.types.get(typeId)?.name ?? `Unknown type (${typeId})`;
}

function entryRow(entry: FitItem, data: DogmaData, prices: ReadonlyMap<number, Price>): EditorEntryRow {
  const unit = priceOf(prices.get(entry.typeId));
  return {
    key: `${entry.flag}:${entry.typeId}`,
    typeId: entry.typeId, flag: entry.flag, name: typeName(data, entry.typeId),
    quantity: entry.quantity, value: unit === null ? null : isk(unit * entry.quantity),
  };
}

export function editorView(input: {
  doc: FitDoc; data: DogmaData; built: DocFit; stats: FitStats; problems: Problem[];
  totals: SlotTotals; prices: ReadonlyMap<number, Price>;
}): EditorView {
  const { doc, data, built, stats, problems, totals, prices } = input;
  const grid = slotGrid(doc, totals);
  const statByKey = new Map<string, ModuleStat>(
    stats.modules.map((m) => [`${m.slot}:${m.index}`, m]));

  const blocks: EditorSlotBlock[] = [];
  for (const slot of SLOT_KINDS) {
    const cells = grid[slot];
    if (cells.length === 0) continue;                    // a Rifter has no subsystem row at all
    blocks.push({
      slot, title: SLOT_TITLES[slot], used: stats.slots[slot].used, total: totals[slot],
      rows: cells.map((cell) => {
        const key = `${slot}:${cell.index}`;
        if (cell.item === null) {
          return {
            key, slot, index: cell.index, over: cell.over, typeId: null, name: "Empty", iconUrl: null,
            charge: null, cpu: "—", power: "—", calibration: "—", state: null, states: [],
            cpuExplain: [], powerExplain: [], price: null,
          };
        }
        const stat = statByKey.get(key);
        const type = data.types.get(cell.item.typeId);
        const unit = priceOf(prices.get(cell.item.typeId));
        return {
          key, slot, index: cell.index, over: cell.over, typeId: cell.item.typeId,
          name: stat === undefined ? typeName(data, cell.item.typeId) : itemLabel(stat.item),
          iconUrl: typeIconUrl(cell.item.typeId),
          charge: cell.item.chargeTypeId === null
            ? null
            : { typeId: cell.item.chargeTypeId, name: typeName(data, cell.item.chargeTypeId) },
          cpu: stat === undefined ? "—" : round2(stat.cpu).toFixed(2),
          power: stat === undefined ? "—" : round2(stat.power).toFixed(2),
          calibration: stat === undefined ? "—" : round2(stat.calibration).toFixed(2),
          state: cell.item.state,
          states: type === undefined ? [] : allowedStates(data, type),
          cpuExplain: stat === undefined ? [] : safeExplain(built.fit, stat.item, ATTR.cpu),
          powerExplain: stat === undefined ? [] : safeExplain(built.fit, stat.item, ATTR.power),
          price: unit === null ? null : isk(unit),
        };
      }),
    });
  }

  const counters: CounterView[] = [
    ...SLOT_KINDS.filter((slot) => totals[slot] > 0 || stats.slots[slot].used > 0).map((slot) => ({
      label: COUNTER_LABELS[slot], used: stats.slots[slot].used, total: totals[slot],
      over: stats.slots[slot].used > totals[slot],
    })),
    ...HARDPOINTS.map((kind) => ({
      label: HARDPOINT_LABELS[kind], used: stats.hardpoints[kind].used,
      total: stats.hardpoints[kind].total, over: stats.hardpoints[kind].used > stats.hardpoints[kind].total,
    })),
  ];

  const roll = rollUpValue(docValueEntries(built), prices);

  return {
    gauges: [
      gauge("CPU", "tf", stats.cpu),
      gauge("Powergrid", "MW", stats.power),
      gauge("Calibration", "", stats.calibration),
    ],
    counters,
    blocks,
    problems: problems.map((p) => ({ kind: p.kind, label: PROBLEM_LABELS[p.kind], text: problemText(p) })),
    missing: missingSkills(built.fit).map((s) => ({
      skillTypeId: s.skillTypeId,
      name: data.types.get(s.skillTypeId)?.name ?? `Skill ${s.skillTypeId}`,
      have: s.have, need: s.required,
    })),
    drones: built.drones.map((d) => entryRow(d, data, prices)),
    cargo: built.cargo.map((c) => entryRow(c, data, prices)),
    unknown: built.unknown.map((u) => entryRow(u, data, prices)),
    value: { total: iskShort(roll.total), unpriced: unpricedNote(roll.unpriced) },
  };
}

/**
 * The single call the editor component makes, once per edit. It is also the only place engine
 * exceptions are caught — `{ kind: "error" }` renders "Could not compute", exactly as `/ships` does.
 */
export function computeEditor(
  doc: FitDoc, ctx: FitContext, prices: ReadonlyMap<number, Price>,
): EditorResult {
  try {
    const built = fitFromDoc(doc, ctx);
    const stats = fitStats(built.fit);
    const problems = validateFit(built.fit);
    const totals = slotTotals(built.fit);
    return {
      kind: "ok", built, totals,
      view: editorView({ doc, data: ctx.data, built, stats, problems, totals, prices }),
    };
  } catch (e) {
    console.error("[fitting] could not compute the fit", e);
    return { kind: "error" };
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/fits/editor-view.test.ts && npm run typecheck`
Expected: 7 tests pass; `tsc --noEmit` clean.
If a gauge string differs, print `stats.cpu` and compare against phase 4a's asserted Rifter numbers
(162.5 tf / 51.25 MW output at CPU Management V and Power Grid Management V) before changing the
expectation — a wrong number here is an engine regression, not a view bug.

- [ ] **Step 5: Commit**

```bash
git add src/lib/fits/editor-view.ts tests/fits/editor-view.test.ts
git commit -m "$(cat <<'EOM'
feat(fits): the editor view model

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOM
)"
```

---

### Task 14: `SlotLayout` and `StatsPanel` (spec §4's left column and stats panel)

Two presentational client components fed entirely by `EditorView`. They own no state and no logic —
every callback goes to the parent, which is the only holder of the `FitDoc`.

**Files:**
- Create: `src/app/fitting/SlotLayout.tsx`, `src/app/fitting/StatsPanel.tsx`,
  `tests/components/slot-layout.test.tsx`, `tests/components/stats-panel.test.tsx`
- Modify: `src/app/globals.css`

**Interfaces:**
- Consumes (Task 13, plus phase 4b components verbatim):
```ts
// src/lib/fits/editor-view.ts
export interface EditorSlotBlock { slot: SlotKind; title: string; used: number; total: number; rows: EditorSlotRow[] }
export interface EditorSlotRow { key: string; slot: SlotKind; index: number; over: boolean; typeId: number | null;
  name: string; iconUrl: string | null; charge: { typeId: number; name: string } | null;
  cpu: string; power: string; calibration: string; state: FitItemState | null; states: FitItemState[];
  cpuExplain: ExplainRowView[]; powerExplain: ExplainRowView[]; price: string | null }
export interface EditorEntryRow { key: string; typeId: number; flag: string; name: string; quantity: number; value: string | null }
export interface EditorView { gauges: GaugeView[]; counters: CounterView[]; blocks: EditorSlotBlock[];
  problems: ProblemView[]; missing: MissingSkillView[]; drones: EditorEntryRow[]; cargo: EditorEntryRow[];
  unknown: EditorEntryRow[]; value: { total: string; unpriced: string | null } }
export const STATE_LABELS: Record<FitItemState, string>;
// src/app/ships/Gauge.tsx     — reused verbatim
export function Gauge({ view }: { view: GaugeView }): JSX.Element
// src/app/ships/AffectedBy.tsx — reused verbatim
export function AffectedBy({ label, value, rows }: { label: string; value: string; rows: ExplainRowView[] }): JSX.Element
// src/lib/view/fit-sheet.ts
export interface BonusView { skill: string | null; level: number | null; text: string }
// src/lib/view/format.ts
export function roman(level: number): string
```
- Produces:
```tsx
export function SlotLayout(props: {
  blocks: EditorSlotBlock[];
  drones: EditorEntryRow[]; cargo: EditorEntryRow[]; unknown: EditorEntryRow[];
  selected: { slot: SlotKind; index: number } | null;
  onSelect: (slot: SlotKind, index: number) => void;
  onRemove: (slot: SlotKind, index: number) => void;
  onState: (slot: SlotKind, index: number, state: FitItemState) => void;
  onClearCharge: (slot: SlotKind, index: number) => void;
  onQuantity: (flag: string, typeId: number, quantity: number) => void;
  onRemoveEntry: (flag: string, typeId: number) => void;
}): JSX.Element;
export function StatsPanel(props: { view: EditorView; bonuses: BonusView[]; skillsSynced: boolean }): JSX.Element;
```

**Decisions recorded here (do not re-litigate them):**
- **The charge *selector* lives in the item browser, not in the slot row.** Spec §4 puts "charges
  list for the selected module filtered by `chargeGroup*`" in the right-hand browser panel, so the
  row's job is to show the loaded charge and offer an "unload" button; selecting the row switches
  the browser into charge mode (Task 15). One list, one place, no duplicated filtering.
- **The row is a `<li>` containing several buttons, not a giant `<button>`.** Nested interactive
  elements are invalid HTML and break keyboard navigation; the name is the selectable button and the
  state `<select>`, unload and remove controls sit beside it.
- **The state control is a `<select>`, and it is omitted when `states.length <= 1`.** A rig or a
  charge has nothing to choose.
- **CPU and powergrid figures reuse `<AffectedBy>` from `/ships`** so the editor's "affected by"
  popover is literally the same component, and `explain` still runs where the engine is — which in
  phase 5 is the browser. That is the one behavioural difference from phase 4b, and it is fine:
  `explainRows` produces plain strings either way.
- **New CSS classes only; no inline colours.** Widths and grid templates live in `globals.css`.

- [ ] **Step 1: Write the failing component tests**

`tests/components/slot-layout.test.tsx`:
```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { fixtureData } from "../dogma/fixture.js";
import { CATEGORY } from "../../src/lib/dogma/index.js";
import { computeEditor } from "../../src/lib/fits/editor-view.js";
import { CARGO_FLAG, type FitDoc } from "../../src/lib/fits/doc.js";
import { SlotLayout } from "../../src/app/fitting/SlotLayout.js";

const data = fixtureData("rifter");
const allV = new Map<number, number>();
for (const t of data.types.values()) if (t.categoryId === CATEGORY.skill) allV.set(t.id, 5);

const DOC: FitDoc = {
  id: 1, name: "Cheap Rifter", description: "", shipTypeId: 587, characterId: "all-v",
  items: [
    { typeId: 2889, quantity: 1, flag: "HiSlot0", chargeTypeId: 12608, state: "active" },
    { typeId: 2048, quantity: 1, flag: "LoSlot0", chargeTypeId: null, state: "online" },
    { typeId: 2456, quantity: 2, flag: "DroneBay", chargeTypeId: null, state: "active" },
    { typeId: 12608, quantity: 600, flag: CARGO_FLAG, chargeTypeId: null, state: "active" },
  ],
};

function renderLayout(over: Partial<Parameters<typeof SlotLayout>[0]> = {}) {
  const result = computeEditor(DOC, { data, skills: allV, implants: [] }, new Map());
  if (result.kind !== "ok") throw new Error("expected ok");
  const props = {
    blocks: result.view.blocks, drones: result.view.drones, cargo: result.view.cargo,
    unknown: result.view.unknown, selected: null,
    onSelect: vi.fn(), onRemove: vi.fn(), onState: vi.fn(),
    onClearCharge: vi.fn(), onQuantity: vi.fn(), onRemoveEntry: vi.fn(), ...over,
  };
  render(<SlotLayout {...props} />);
  return props;
}

describe("SlotLayout", () => {
  it("renders every slot the hull has, empties included, with the loaded charge", () => {
    renderLayout();
    expect(screen.getByText("High")).toBeInTheDocument();
    expect(screen.getAllByText("200mm AutoCannon II")).toHaveLength(1);
    expect(screen.getByText("· Hail S")).toBeInTheDocument();      // the loaded charge, not the cargo row
    // The Rifter has 3 high, 3 mid, 4 low and 3 rig slots; 2 are filled, so 11 read "Empty".
    expect(screen.getAllByText("Empty")).toHaveLength(11);
    expect(screen.queryByText("Subsystems")).toBeNull();
  });

  it("selects a slot, changes its state, unloads its charge and removes it", () => {
    const props = renderLayout();
    fireEvent.click(screen.getByRole("button", { name: /select 200mm AutoCannon II/i }));
    expect(props.onSelect).toHaveBeenCalledWith("high", 0);

    fireEvent.change(screen.getByLabelText("200mm AutoCannon II state"), { target: { value: "offline" } });
    expect(props.onState).toHaveBeenCalledWith("high", 0, "offline");

    fireEvent.click(screen.getByRole("button", { name: "Unload Hail S" }));
    expect(props.onClearCharge).toHaveBeenCalledWith("high", 0);

    fireEvent.click(screen.getByRole("button", { name: "Remove 200mm AutoCannon II" }));
    expect(props.onRemove).toHaveBeenCalledWith("high", 0);
  });

  it("marks the selected slot", () => {
    renderLayout({ selected: { slot: "high", index: 0 } });
    expect(screen.getByRole("button", { name: /select 200mm AutoCannon II/i }))
      .toHaveAttribute("aria-pressed", "true");
  });

  it("renders each module's CPU and powergrid as an affected-by control", () => {
    renderLayout();
    const cpu = screen.getByRole("button", { name: /^CPU 6\.75, affected by/i });
    fireEvent.click(cpu);
    expect(cpu).toHaveAttribute("aria-expanded", "true");
  });

  it("shows the drone bay and the cargo hold with editable quantities", () => {
    const props = renderLayout();
    const drones = screen.getByRole("group", { name: "Drone bay" });
    expect(within(drones).getByText("Hobgoblin II")).toBeInTheDocument();
    fireEvent.change(within(drones).getByLabelText("Hobgoblin II quantity"), { target: { value: "3" } });
    expect(props.onQuantity).toHaveBeenCalledWith("DroneBay", 2456, 3);

    const cargo = screen.getByRole("group", { name: "Cargo" });
    fireEvent.click(within(cargo).getByRole("button", { name: "Remove Hail S" }));
    expect(props.onRemoveEntry).toHaveBeenCalledWith("Cargo", 12608);
  });
});
```

`tests/components/stats-panel.test.tsx`:
```tsx
import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { fixtureData } from "../dogma/fixture.js";
import { computeEditor } from "../../src/lib/fits/editor-view.js";
import type { FitDoc } from "../../src/lib/fits/doc.js";
import { StatsPanel } from "../../src/app/fitting/StatsPanel.js";

const data = fixtureData("rifter");
const DOC: FitDoc = {
  id: 1, name: "Cheap Rifter", description: "", shipTypeId: 587, characterId: 90000101,
  items: [{ typeId: 2889, quantity: 1, flag: "HiSlot0", chargeTypeId: null, state: "active" }],
};
// CPU Management V and Power Grid Management V only: the hull's own skill is missing.
const ctx = { data, skills: new Map([[3426, 5], [3413, 5]]), implants: [] };
// The editor always passes level: null (Decision 12) — the pilot can change without a page load.
const BONUSES = [{ skill: "Minmatar Frigate", level: null, text: "7.5% bonus to Small Projectile Turret damage" }];

function renderPanel(skillsSynced = true) {
  const result = computeEditor(DOC, ctx, new Map());
  if (result.kind !== "ok") throw new Error("expected ok");
  render(<StatsPanel view={result.view} bonuses={BONUSES} skillsSynced={skillsSynced} />);
}

describe("StatsPanel", () => {
  it("shows the three gauges with real numbers and the slot counters", () => {
    renderPanel();
    expect(screen.getByText("9.00 / 162.50 tf")).toBeInTheDocument();
    expect(screen.getByText("4.00 / 51.25 MW")).toBeInTheDocument();
    expect(screen.getByText("0.00 / 400.00")).toBeInTheDocument();
    // "1 / 3" is both the High counter and the Turrets counter.
    expect(screen.getAllByText("1 / 3")).toHaveLength(2);
    expect(screen.getByText("0 / 4")).toBeInTheDocument();          // Low
  });

  it("lists the problems and the missing skills with have → need", () => {
    renderPanel();
    // The only table in the panel is the missing-skill list.
    const missing = screen.getByRole("table");
    expect(within(missing).getByText("Minmatar Frigate")).toBeInTheDocument();
    expect(within(missing).getAllByText("0 → 1").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Skill").length).toBeGreaterThan(0);  // the problem badges
  });

  it("shows the hull bonuses and the estimated value", () => {
    renderPanel();
    expect(screen.getByText("Minmatar Frigate")).toBeInTheDocument();
    expect(screen.getByText("7.5% bonus to Small Projectile Turret damage")).toBeInTheDocument();
    expect(screen.getByText("0 ISK")).toBeInTheDocument();           // no prices were supplied
    expect(screen.getByText("2 items unpriced")).toBeInTheDocument();
  });

  it("warns when no skills are synced", () => {
    renderPanel(false);
    expect(screen.getByText(/No skills synced yet/)).toBeInTheDocument();
  });

});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/components/slot-layout.test.tsx tests/components/stats-panel.test.tsx`
Expected: FAIL — the two component modules do not resolve.

- [ ] **Step 3: Write `SlotLayout`**

`src/app/fitting/SlotLayout.tsx`:
```tsx
"use client";
import { IconTrash, IconX } from "@tabler/icons-react";
import type { SlotKind } from "../../lib/dogma/index.js";
import type { FitItemState } from "../../lib/fits/doc.js";
import { STATE_LABELS, type EditorEntryRow, type EditorSlotBlock } from "../../lib/fits/editor-view.js";
import { AffectedBy } from "../ships/AffectedBy.js";

interface EntryListProps {
  title: string; entries: EditorEntryRow[]; editable: boolean;
  onQuantity: (flag: string, typeId: number, quantity: number) => void;
  onRemoveEntry: (flag: string, typeId: number) => void;
}

function EntryGroup({ title, entries, editable, onQuantity, onRemoveEntry }: EntryListProps) {
  if (entries.length === 0) return null;
  return (
    <div role="group" aria-label={title}>
      <h3 className="slot-title">{title}</h3>
      <ul className="entry-list">
        {entries.map((entry) => (
          <li key={entry.key}>
            <span>{entry.name}</span>
            <span>
              {editable ? (
                <input
                  className="qty-input" type="number" min={1} value={entry.quantity}
                  aria-label={`${entry.name} quantity`}
                  onChange={(e) => onQuantity(entry.flag, entry.typeId, Number(e.target.value))}
                />
              ) : <span className="num muted">×{entry.quantity}</span>}
              <span className="num muted"> {entry.value ?? "—"}</span>
              {editable ? (
                <button
                  type="button" className="icon-btn danger" aria-label={`Remove ${entry.name}`}
                  onClick={() => onRemoveEntry(entry.flag, entry.typeId)}
                ><IconTrash size={14} /></button>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Spec §4's left column: one row per slot the hull has, plus the drone bay and the cargo hold. */
export function SlotLayout({
  blocks, drones, cargo, unknown, selected,
  onSelect, onRemove, onState, onClearCharge, onQuantity, onRemoveEntry,
}: {
  blocks: EditorSlotBlock[];
  drones: EditorEntryRow[]; cargo: EditorEntryRow[]; unknown: EditorEntryRow[];
  selected: { slot: SlotKind; index: number } | null;
  onSelect: (slot: SlotKind, index: number) => void;
  onRemove: (slot: SlotKind, index: number) => void;
  onState: (slot: SlotKind, index: number, state: FitItemState) => void;
  onClearCharge: (slot: SlotKind, index: number) => void;
  onQuantity: (flag: string, typeId: number, quantity: number) => void;
  onRemoveEntry: (flag: string, typeId: number) => void;
}) {
  return (
    <div className="card-stack">
      {blocks.map((block) => (
        <div className="card" key={block.slot}>
          <h2 className="card-title">
            {block.title} <span className="faint">{block.used} / {block.total}</span>
          </h2>
          <ul className="entry-list">
            {block.rows.map((row) => {
              const isSelected = selected !== null && selected.slot === row.slot && selected.index === row.index;
              return (
                <li
                  key={row.key}
                  className={`slot-row${row.typeId === null ? " empty" : ""}${row.over ? " over" : ""}${isSelected ? " selected" : ""}`}
                >
                  <button
                    type="button" className="slot-main" aria-pressed={isSelected}
                    aria-label={`Select ${row.name} in ${block.title} slot ${row.index + 1}`}
                    onClick={() => onSelect(row.slot, row.index)}
                  >
                    {row.iconUrl === null
                      ? <span className="module-icon" aria-hidden="true" />
                      /* eslint-disable-next-line @next/next/no-img-element */
                      : <img className="module-icon" src={row.iconUrl} alt="" />}
                    <span>{row.name}</span>
                    {row.charge === null ? null : <span className="slot-charge"> · {row.charge.name}</span>}
                  </button>
                  <AffectedBy label="CPU" value={row.cpu} rows={row.cpuExplain} />
                  <AffectedBy label="Powergrid" value={row.power} rows={row.powerExplain} />
                  {row.state !== null && row.states.length > 1 ? (
                    <select
                      className="fit-select" value={row.state} aria-label={`${row.name} state`}
                      onChange={(e) => onState(row.slot, row.index, e.target.value as FitItemState)}
                    >
                      {row.states.map((state) => (
                        <option key={state} value={state}>{STATE_LABELS[state]}</option>
                      ))}
                    </select>
                  ) : <span />}
                  {row.charge === null ? <span /> : (
                    <button
                      type="button" className="icon-btn" aria-label={`Unload ${row.charge.name}`}
                      onClick={() => onClearCharge(row.slot, row.index)}
                    ><IconX size={14} /></button>
                  )}
                  {row.typeId === null ? <span /> : (
                    <button
                      type="button" className="icon-btn danger" aria-label={`Remove ${row.name}`}
                      onClick={() => onRemove(row.slot, row.index)}
                    ><IconTrash size={14} /></button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}

      <div className="card">
        <h2 className="card-title">Drone bay &amp; cargo</h2>
        {drones.length === 0 && cargo.length === 0
          ? <p className="faint">Nothing in the drone bay or the cargo hold.</p>
          : null}
        <EntryGroup title="Drone bay" entries={drones} editable
          onQuantity={onQuantity} onRemoveEntry={onRemoveEntry} />
        <EntryGroup title="Cargo" entries={cargo} editable
          onQuantity={onQuantity} onRemoveEntry={onRemoveEntry} />
        {unknown.length === 0 ? null : (
          <>
            <p className="faint">
              The static data does not know these types, so they are excluded from the calculation.
            </p>
            <EntryGroup title="Unknown types" entries={unknown} editable={false}
              onQuantity={onQuantity} onRemoveEntry={onRemoveEntry} />
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Write `StatsPanel`**

`src/app/fitting/StatsPanel.tsx`:
```tsx
"use client";
import { roman } from "../../lib/view/format.js";
import type { BonusView } from "../../lib/view/fit-sheet.js";
import type { EditorView } from "../../lib/fits/editor-view.js";
import { Gauge } from "../ships/Gauge.js";

/** Spec §4's stats panel: gauges, counters, problems, missing skills, value and hull bonuses. */
export function StatsPanel({ view, bonuses, skillsSynced }: {
  view: EditorView; bonuses: BonusView[]; skillsSynced: boolean;
}) {
  return (
    <div className="card-stack">
      {skillsSynced ? null : (
        <p className="card banner">
          No skills synced yet — every skill is treated as level 0, so these numbers are worst case.
        </p>
      )}

      <div className="card">
        <h2 className="card-title">Fitting</h2>
        {view.gauges.map((g) => <Gauge key={g.label} view={g} />)}
        <div className="counters">
          {view.counters.map((counter) => (
            <span key={counter.label} className={`counter${counter.over ? " over" : ""}`}>
              <span className="counter-label">{counter.label}</span>
              <span className="num">{counter.used} / {counter.total}</span>
            </span>
          ))}
        </div>
      </div>

      <div className="card">
        <h2 className="card-title">Problems</h2>
        {view.problems.length === 0 ? <p className="faint">No problems — this fit is legal.</p> : (
          <ul className="problem-list">
            {view.problems.map((problem, index) => (
              <li key={index}><span className="badge error">{problem.label}</span> {problem.text}</li>
            ))}
          </ul>
        )}
      </div>

      <div className="card">
        <h2 className="card-title">Missing skills</h2>
        {view.missing.length === 0 ? <p className="faint">Every skill for this fit is trained.</p> : (
          <table className="table">
            <thead><tr><th>Skill</th><th className="num">Have → need</th></tr></thead>
            <tbody>
              {view.missing.map((skill) => (
                <tr key={skill.skillTypeId}>
                  <td>{skill.name}</td>
                  <td className="num">{skill.have} → {skill.need}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <h2 className="card-title">Estimated value</h2>
        <p className="stat-value">{view.value.total}</p>
        {view.value.unpriced === null ? null : <p className="faint">{view.value.unpriced}</p>}
      </div>

      <div className="card">
        <h2 className="card-title">Ship bonuses</h2>
        {bonuses.length === 0 ? <p className="faint">This hull has no listed bonuses.</p> : (
          <ul className="bonus-list">
            {bonuses.map((bonus, index) => (
              <li key={index}>
                {bonus.skill === null ? null : (
                  <span className="bonus-skill">{bonus.skill} {roman(bonus.level ?? 0)}</span>
                )}
                <span>{bonus.text}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Add the CSS**

Append to `src/app/globals.css`:
```css
/* ---------- phase 5: fitting designer ---------- */
.fit-editor { display: grid; grid-template-columns: minmax(0, 1fr) 340px; gap: 20px; align-items: start; }
.fit-editor-main { display: grid; gap: 20px; }
.fit-toolbar { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; margin-bottom: 18px; }
.fit-name-input { flex: 1 1 220px; padding: 8px 10px; background: var(--raised); border: 1px solid var(--border); border-radius: 8px; color: var(--text); font: inherit; }
.fit-name-input:focus, .fit-select:focus, .qty-input:focus, .eft-text:focus { outline: none; border-color: var(--accent); }
.fit-select { padding: 6px 8px; background: var(--raised); border: 1px solid var(--border); border-radius: 8px; color: var(--text); font: inherit; font-size: 12px; }
.fit-btn { padding: 8px 14px; background: var(--raised); border: 1px solid var(--border-hi); border-radius: 8px; color: var(--text); font: inherit; cursor: pointer; }
.fit-btn:hover { border-color: var(--accent); color: var(--accent); }
.fit-btn.danger:hover { border-color: var(--neg); color: var(--neg); }
.fit-btn[disabled] { opacity: 0.6; cursor: default; }
.save-state { font-size: 12px; color: var(--faint); }
.save-state.error { color: var(--neg); }
.slot-row { display: grid; grid-template-columns: minmax(0, 1fr) 58px 58px auto auto auto; gap: 8px; align-items: center; padding: 4px 0; border-bottom: 1px solid var(--hairline); font-size: 13px; }
.slot-row:last-child { border-bottom: 0; }
.slot-row.selected { background: var(--raised); box-shadow: inset 2px 0 0 var(--accent); }
.slot-row.empty .slot-main { color: var(--faint); }
.slot-row.over .slot-main { color: var(--neg); }
.slot-main { display: flex; align-items: center; gap: 8px; min-width: 0; background: none; border: 0; padding: 4px 6px; color: inherit; font: inherit; text-align: left; cursor: pointer; border-radius: 6px; }
.slot-main:hover { color: var(--accent); }
.slot-charge { font-size: 12px; color: var(--accent-2); }
.icon-btn { background: none; border: 0; padding: 2px; line-height: 0; color: var(--faint); cursor: pointer; }
.icon-btn:hover { color: var(--accent); }
.icon-btn.danger:hover { color: var(--neg); }
.qty-input { width: 76px; padding: 3px 6px; background: var(--raised); border: 1px solid var(--border); border-radius: 6px; color: var(--text); font: inherit; text-align: right; }
.modal-backdrop { position: fixed; inset: 0; z-index: 100; background: rgba(2, 6, 23, 0.72); display: grid; place-items: center; padding: 24px; }
.modal { width: 100%; max-width: 660px; max-height: 80vh; overflow: auto; }
.eft-text { width: 100%; min-height: 260px; padding: 10px; background: var(--raised); border: 1px solid var(--border); border-radius: 8px; color: var(--text); font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; }
.browser-results { list-style: none; margin: 0; padding: 0; display: grid; gap: 2px; max-height: 440px; overflow: auto; }
.browser-row { display: grid; grid-template-columns: 24px minmax(0, 1fr) auto auto; gap: 8px; align-items: center; padding: 3px 6px; border-radius: 6px; font-size: 13px; }
.browser-row:hover { background: var(--raised); }
.browser-crumbs { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; font-size: 12px; margin-bottom: 8px; }
.crumb { background: none; border: 0; padding: 0; color: var(--accent); font: inherit; cursor: pointer; }
.badge.meta { background: rgba(94, 176, 255, 0.14); color: var(--accent-2); }
.fit-list-row { display: grid; grid-template-columns: minmax(0, 1fr) 150px 140px 110px auto; gap: 12px; align-items: center; font-size: 13px; }
.check-row { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--muted); }
@media (max-width: 900px) { .fit-editor { grid-template-columns: 1fr; } }
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run tests/components/slot-layout.test.tsx tests/components/stats-panel.test.tsx && npm run typecheck`
Expected: 5 slot-layout tests and 4 stats-panel tests pass; `tsc --noEmit` clean.

- [ ] **Step 7: Commit**

```bash
git add src/app/fitting/SlotLayout.tsx src/app/fitting/StatsPanel.tsx src/app/globals.css tests/components/slot-layout.test.tsx tests/components/stats-panel.test.tsx
git commit -m "$(cat <<'EOM'
feat(fitting): slot layout and stats panel components

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOM
)"
```

---

### Task 15: `ItemBrowser` — search, market tree, "fits this hull", charges

Spec §4's right-hand panel. It owns its own fetch state (search text, market-group path, results)
because none of that belongs in the `FitDoc`; the only thing it hands back is "fit this type".

**Files:**
- Create: `src/app/fitting/ItemBrowser.tsx`, `tests/components/item-browser.test.tsx`
- Modify: `src/lib/fits/slots.ts` (add `canFitShip`), `src/lib/dogma/index.ts` (two re-exports),
  `tests/fits/slots.test.ts`

**Interfaces:**
- Consumes (Tasks 3, 7, 12, 13):
```ts
// src/lib/fits/slots.ts
export function chargeFits(moduleType: DogmaType, chargeType: DogmaType): boolean;
// src/lib/fits/client-data.ts
export function ensureTypes(ids: number[], fetchImpl?: typeof fetch): Promise<void>;
export function dogmaData(): DogmaData;
// src/lib/fits/editor-view.ts
export function typeIconUrl(typeId: number, size?: number): string;
// src/lib/dogma/data.ts — exported there, this task re-exports them from the barrel
export const CAN_FIT_SHIP_TYPE_ATTRS: readonly AttrId[];   // canFitShipType1..12
export const CAN_FIT_SHIP_GROUP_ATTRS: readonly AttrId[];  // canFitShipGroup01..20
const ATTR: { rigSize: 1547; … };
// Routes: GET /api/sde/types?q=&category=&marketGroup=&limit=, GET /api/sde/market-groups
```
- Produces:
```ts
// src/lib/fits/slots.ts
export function canFitShip(shipType: DogmaType, moduleType: DogmaType): boolean;
// src/app/fitting/ItemBrowser.tsx
export interface BrowseType { id: number; name: string | null; groupId: number | null;
  categoryId: number | null; marketGroupId: number | null; metaGroup: string | null; metaLevel: number | null }
export const FIT_CATEGORIES: readonly number[];      // [7, 8, 18, 32]
export function ItemBrowser(props: {
  shipTypeId: number;
  selected: { slot: SlotKind; index: number; typeId: number } | null;
  onFit: (typeId: number) => void;
  onCharge: (typeId: number) => void;
}): JSX.Element;
```

**Decisions recorded here (do not re-litigate them):**
- **`canFitShip` is an advisory filter, not a second validator.** It reads exactly what
  `validateFit`'s `allowedOnHull` and rig-size checks read — `canFitShipType1..12` **plus
  `fitsToShipType` (1380)**, `canFitShipGroup01..20`, and `rigSize` (1547) compared with strict
  equality, with rigs and subsystems exempt from the hull restriction — but lives in
  `src/lib/fits/slots.ts` rather than inside the engine, and it does **not** replace
  `validateFit`: if you clear the "Fits this hull" checkbox and fit something anyway, the
  `shipRestriction` and `rigSize` problems still appear. Duplicating a read-only predicate is the
  cheaper risk here than reshaping a finished engine module.
- **The browser switches to charge mode when a module with charge groups is selected.** Spec §4 puts
  the charge list here; the mode is derived from the selection, not from a separate control, so
  there is nothing extra to keep in sync.
- **The search is debounced 250 ms**, and the market-group tree is fetched once. The *engine* is
  never debounced — that runs synchronously on every keystroke (spec §3).
- **A result row's price is not fetched.** Spec §4 lists a price on the browser row, but pricing 50
  moving search results would fire a Fuzzwork top-up per keystroke. The row shows name, meta-group
  badge and base CPU/PG from `DogmaData`; **price appears once the item is fitted**, in the slot row
  and the value panel. This is a deliberate, recorded reduction of spec §4.
- Results are limited to the four fitting categories (7 modules, 8 charges, 18 drones, 32
  subsystems) unless the browser is in charge mode, which asks for category 8 alone.

- [ ] **Step 1: Add `canFitShip` with a failing test**

Append to `tests/fits/slots.test.ts`:
```ts
describe("canFitShip", () => {
  const rifter = data.types.get(587)!;
  const gun = data.types.get(2889)!;                 // no restriction at all
  const smallRig = data.types.get(31686)!;           // Small rig, rigSize 1
  const mediumRig = data.types.get(31682)!;          // Medium rig, rigSize 2
  const bombLauncher = data.types.get(4256)!;        // canFitShipGroup01 = 834 (Stealth Bomber)

  it("accepts anything with no restriction", () => {
    expect(canFitShip(rifter, gun)).toBe(true);
  });
  it("rejects a rig whose size the hull does not take", () => {
    expect(canFitShip(rifter, smallRig)).toBe(true);        // both are rigSize 1
    expect(canFitShip(rifter, mediumRig)).toBe(false);      // rigSize 2 on a rigSize 1 hull
  });
  it("rejects a module restricted to other hull groups", () => {
    expect(canFitShip(rifter, bombLauncher)).toBe(false);   // the Rifter's group is 25, not 834
  });
});
```

Append to `src/lib/fits/slots.ts`:
```ts
/**
 * Spec §4's "Fits this hull" filter. Advisory only — `validateFit` remains the authority and still
 * raises `shipRestriction` / `rigSize` if the filter is cleared and the module fitted anyway. It
 * reads exactly what the engine's validator reads: `canFitShipType1..12` plus `fitsToShipType`
 * (1380), `canFitShipGroup01..20`, and `rigSize` (1547) compared with strict equality — and it
 * repeats the validator's exemption of rigs and subsystems from the hull restriction.
 */
export function canFitShip(shipType: DogmaType, moduleType: DogmaType): boolean {
  const slot = slotOfType(moduleType);

  // `validateFit`'s `allowedOnHull`, attribute for attribute — including `fitsToShipType` (1380)
  // beside `canFitShipType1..12`, and its exemption for rigs and subsystems.
  if (slot !== "rig" && slot !== "subsystem") {
    const allowedTypes = new Set<number>();
    const allowedGroups = new Set<number>();
    for (const attrId of [...CAN_FIT_SHIP_TYPE_ATTRS, ATTR.fitsToShipType]) {
      const value = moduleType.attrs.get(attrId);
      if (value !== undefined && value > 0) allowedTypes.add(Math.round(value));
    }
    for (const attrId of CAN_FIT_SHIP_GROUP_ATTRS) {
      const value = moduleType.attrs.get(attrId);
      if (value !== undefined && value > 0) allowedGroups.add(Math.round(value));
    }
    if ((allowedTypes.size > 0 || allowedGroups.size > 0)
        && !allowedTypes.has(shipType.id) && !allowedGroups.has(shipType.groupId)) {
      return false;
    }
  }

  // `validateFit`'s rigSize rule: rigs only, raw attributes, strict equality, skipped when either
  // side lacks the attribute.
  if (slot === "rig") {
    const rigSize = moduleType.attrs.get(ATTR.rigSize);
    const hullRigSize = shipType.attrs.get(ATTR.rigSize);
    if (rigSize === undefined || hullRigSize === undefined) return true;
    return Math.round(rigSize) === Math.round(hullRigSize);
  }
  return true;
}
```
and widen its import from the barrel:
```ts
import {
  ATTR, CAN_FIT_SHIP_GROUP_ATTRS, CAN_FIT_SHIP_TYPE_ATTRS, DRONE_BAY_FLAG, EFFECT, SLOT_KINDS, State,
  defaultStateOfType, getAttr, kindOfType, slotFromFlag, slotOfType,
  type AttrId, type DogmaData, type DogmaType, type Fit, type SlotKind,
} from "../dogma/index.js";
```
Add the two constants to `src/lib/dogma/index.ts`'s `./data.js` export block:
```ts
  CAN_FIT_SHIP_GROUP_ATTRS, CAN_FIT_SHIP_TYPE_ATTRS,
```

Run: `npx vitest run tests/fits/slots.test.ts` — expected: FAIL first (`canFitShip is not a
function`), then PASS with 19 tests.

- [ ] **Step 2: Write the failing component test**

`tests/components/item-browser.test.tsx`:
```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { fixtureData } from "../dogma/fixture.js";
import { serialiseMeta, serialiseTypes } from "../../src/lib/dogma/serialize.js";
import { getDogmaMeta, ensureTypes, resetDogmaStore } from "../../src/lib/fits/client-data.js";
import { ItemBrowser } from "../../src/app/fitting/ItemBrowser.js";

const data = fixtureData("rifter");
const META = serialiseMeta(data, 3484357);
const ALL_TYPES = serialiseTypes(data);

const SEARCH_RESULTS = [
  { id: 2889, name: "200mm AutoCannon II", groupId: 55, categoryId: 7, marketGroupId: 574, metaGroup: "Tech II", metaLevel: 5 },
  { id: 484, name: "125mm Gatling AutoCannon I", groupId: 55, categoryId: 7, marketGroupId: 574, metaGroup: "Tech I", metaLevel: 0 },
];
const RIG_RESULTS = [
  // Small rig: rigSize 1, same as the Rifter. Medium rig: rigSize 2, so it does not fit.
  { id: 31686, name: "Small Projectile Collision Accelerator II", groupId: 777, categoryId: 7, marketGroupId: 1105, metaGroup: "Tech II", metaLevel: 5 },
  { id: 31682, name: "Medium Projectile Collision Accelerator I", groupId: 777, categoryId: 7, marketGroupId: 1105, metaGroup: "Tech I", metaLevel: 0 },
];
const CHARGE_RESULTS = [
  { id: 12608, name: "Hail S", groupId: 372, categoryId: 8, marketGroupId: 859, metaGroup: "Tech II", metaLevel: 5 },
  { id: 27339, name: "Caldari Navy Mjolnir Torpedo", groupId: 89, categoryId: 8, marketGroupId: 860, metaGroup: "Faction", metaLevel: 5 },
];

beforeEach(async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  resetDogmaStore();
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    const body =
      url.startsWith("/api/dogma/meta") ? META
      : url.startsWith("/api/dogma/types") ? { build: 3484357, types: ALL_TYPES }
      : url.startsWith("/api/sde/market-groups") ? { groups: [
          { id: 9, parentId: null, name: "Ship Equipment", hasTypes: false },
          { id: 574, parentId: 9, name: "Projectile Turrets", hasTypes: true },
        ] }
      : url.includes("category=8") ? { types: CHARGE_RESULTS }
      : url.includes("q=collision") ? { types: RIG_RESULTS }
      : { types: SEARCH_RESULTS };
    return { ok: true, status: 200, json: async () => body } as Response;
  }) as typeof fetch;
  await getDogmaMeta();
  await ensureTypes([587, 2889, 484, 12608, 27339, 31682, 31686, 4256]);
});
afterEach(() => { vi.useRealTimers(); });

describe("ItemBrowser", () => {
  it("searches after the debounce and lists results with their meta-group badge", async () => {
    const onFit = vi.fn();
    render(<ItemBrowser shipTypeId={587} selected={null} onFit={onFit} onCharge={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Search items"), { target: { value: "autocannon" } });
    await waitFor(() => expect(screen.getByText("200mm AutoCannon II")).toBeInTheDocument());
    expect(screen.getByText("Tech II")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Fit 200mm AutoCannon II" }));
    expect(onFit).toHaveBeenCalledWith(2889);
  });

  it("hides results that do not fit this hull while the filter is on", async () => {
    render(<ItemBrowser shipTypeId={587} selected={null} onFit={vi.fn()} onCharge={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Search items"), { target: { value: "collision" } });
    // The filter is on by default: the Medium rig does not fit a frigate.
    await waitFor(() =>
      expect(screen.getByText("Small Projectile Collision Accelerator II")).toBeInTheDocument());
    expect(screen.queryByText("Medium Projectile Collision Accelerator I")).toBeNull();

    fireEvent.click(screen.getByLabelText("Fits this hull"));
    await waitFor(() =>
      expect(screen.getByText("Medium Projectile Collision Accelerator I")).toBeInTheDocument());
  });

  it("switches to charges for the selected module and filters by charge group", async () => {
    const onCharge = vi.fn();
    render(
      <ItemBrowser
        shipTypeId={587} selected={{ slot: "high", index: 0, typeId: 2889 }}
        onFit={vi.fn()} onCharge={onCharge}
      />);
    await waitFor(() => expect(screen.getByText("Hail S")).toBeInTheDocument());
    // The torpedo's group is not among the autocannon's chargeGroups, so it is filtered out.
    expect(screen.queryByText("Caldari Navy Mjolnir Torpedo")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Load Hail S" }));
    expect(onCharge).toHaveBeenCalledWith(12608);
  });

  it("walks the market-group tree", async () => {
    render(<ItemBrowser shipTypeId={587} selected={null} onFit={vi.fn()} onCharge={vi.fn()} />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Ship Equipment" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Ship Equipment" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Projectile Turrets" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Projectile Turrets" }));
    await waitFor(() => expect(screen.getByText("200mm AutoCannon II")).toBeInTheDocument());
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run tests/components/item-browser.test.tsx`
Expected: FAIL — `Failed to resolve import "../../src/app/fitting/ItemBrowser.js"`.

- [ ] **Step 4: Write `ItemBrowser`**

`src/app/fitting/ItemBrowser.tsx`:
```tsx
"use client";
import { useEffect, useMemo, useState } from "react";
import { IconChevronRight, IconPlus } from "@tabler/icons-react";
import type { SlotKind } from "../../lib/dogma/index.js";
import { dogmaData, ensureTypes } from "../../lib/fits/client-data.js";
import { canFitShip, chargeFits, CHARGE_GROUP_ATTRS } from "../../lib/fits/slots.js";
import { typeIconUrl } from "../../lib/fits/editor-view.js";

export interface BrowseType {
  id: number; name: string | null; groupId: number | null; categoryId: number | null;
  marketGroupId: number | null; metaGroup: string | null; metaLevel: number | null;
}
interface MarketGroup { id: number; parentId: number | null; name: string | null; hasTypes: boolean | null }

/** Spec §4: modules, charges, drones and subsystems. */
export const FIT_CATEGORIES: readonly number[] = [7, 8, 18, 32];
const CHARGE_CATEGORY = 8;
const SEARCH_DEBOUNCE_MS = 250;
const RESULT_LIMIT = 50;

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} answered ${res.status}`);
  return (await res.json()) as T;
}

export function ItemBrowser({ shipTypeId, selected, onFit, onCharge }: {
  shipTypeId: number;
  selected: { slot: SlotKind; index: number; typeId: number } | null;
  onFit: (typeId: number) => void;
  onCharge: (typeId: number) => void;
}) {
  const [query, setQuery] = useState("");
  const [onlyFitting, setOnlyFitting] = useState(true);
  const [groups, setGroups] = useState<MarketGroup[]>([]);
  const [path, setPath] = useState<MarketGroup[]>([]);
  const [results, setResults] = useState<BrowseType[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Charge mode is derived from the selection — spec §4 puts the charge list in this panel.
  const chargeMode = useMemo(() => {
    if (selected === null) return null;
    const type = dogmaData().types.get(selected.typeId);
    return type !== undefined && hasChargeGroups(type) ? type : null;
  }, [selected]);

  useEffect(() => {
    getJson<{ groups: MarketGroup[] }>("/api/sde/market-groups")
      .then((body) => setGroups(body.groups))
      .catch((e: unknown) => { console.error("[fitting] market groups", e); });
  }, []);

  const marketGroupId = path.length === 0 ? null : path[path.length - 1].id;

  useEffect(() => {
    const trimmed = query.trim();
    if (chargeMode === null && trimmed === "" && marketGroupId === null) { setResults([]); return; }

    let cancelled = false;
    const timer = setTimeout(() => {
      const params = new URLSearchParams();
      if (trimmed !== "") params.set("q", trimmed);
      params.set("category", chargeMode === null ? FIT_CATEGORIES.join(",") : String(CHARGE_CATEGORY));
      if (chargeMode === null && marketGroupId !== null) params.set("marketGroup", String(marketGroupId));
      params.set("limit", String(RESULT_LIMIT));

      getJson<{ types: BrowseType[] }>(`/api/sde/types?${params.toString()}`)
        .then(async (body) => {
          // The engine needs these types to answer "does this fit" and "what does it cost to fit".
          await ensureTypes(body.types.map((t) => t.id));
          if (!cancelled) { setResults(body.types); setError(null); }
        })
        .catch((e: unknown) => {
          console.error("[fitting] search", e);
          if (!cancelled) setError("Could not search the static data.");
        });
    }, SEARCH_DEBOUNCE_MS);

    return () => { cancelled = true; clearTimeout(timer); };
  }, [query, marketGroupId, chargeMode]);

  const data = dogmaData();
  const ship = data.types.get(shipTypeId);
  const shown = results.filter((row) => {
    const type = data.types.get(row.id);
    if (type === undefined) return true;                      // not loaded yet: show it, do not lie
    if (chargeMode !== null) return chargeFits(chargeMode, type);
    if (!onlyFitting || ship === undefined) return true;
    return canFitShip(ship, type);
  });

  const children = groups.filter((g) => g.parentId === marketGroupId);

  return (
    <div className="card">
      <h2 className="card-title">{chargeMode === null ? "Items" : `Charges for ${chargeMode.name}`}</h2>

      <label className="faint" htmlFor="item-search">Search items</label>
      <input
        id="item-search" className="filter-input" type="search" value={query}
        placeholder="Gyrostabilizer, Hail S, Warrior II, …"
        aria-label="Search items"
        onChange={(e) => setQuery(e.target.value)}
      />

      {chargeMode === null ? (
        <>
          <label className="check-row">
            <input type="checkbox" checked={onlyFitting}
              onChange={(e) => setOnlyFitting(e.target.checked)} />
            Fits this hull
          </label>
          <div className="browser-crumbs">
            <button type="button" className="crumb" onClick={() => setPath([])}>Market</button>
            {path.map((group, index) => (
              <span key={group.id}>
                <IconChevronRight size={11} />
                <button type="button" className="crumb" onClick={() => setPath(path.slice(0, index + 1))}>
                  {group.name}
                </button>
              </span>
            ))}
          </div>
          <ul className="browser-results">
            {children.map((group) => (
              <li key={group.id} className="browser-row">
                <IconChevronRight size={12} />
                <button type="button" className="crumb" onClick={() => setPath([...path, group])}>
                  {group.name}
                </button>
                <span /><span />
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {error === null ? null : <p className="faint">{error}</p>}

      <ul className="browser-results">
        {shown.map((row) => (
          <li key={row.id} className="browser-row">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="module-icon" src={typeIconUrl(row.id)} alt="" />
            <span>{row.name}</span>
            {row.metaGroup === null ? <span /> : <span className="badge meta">{row.metaGroup}</span>}
            <button
              type="button" className="icon-btn"
              aria-label={`${chargeMode === null ? "Fit" : "Load"} ${row.name}`}
              onClick={() => (chargeMode === null ? onFit(row.id) : onCharge(row.id))}
            ><IconPlus size={14} /></button>
          </li>
        ))}
      </ul>
      {shown.length === 0 && query.trim() !== ""
        ? <p className="faint">Nothing matches “{query.trim()}”.</p> : null}
    </div>
  );
}

/** A module with no `chargeGroup*` takes no charge, so selecting it must not switch modes. */
function hasChargeGroups(type: { attrs: Map<number, number> }): boolean {
  return CHARGE_GROUP_ATTRS.some((attrId) => type.attrs.get(attrId) !== undefined);
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run tests/components/item-browser.test.tsx tests/fits/slots.test.ts && npm run typecheck`
Expected: 4 browser tests and 17 slot tests pass; `tsc --noEmit` clean.

- [ ] **Step 6: Commit**

```bash
git add src/app/fitting/ItemBrowser.tsx src/lib/fits/slots.ts src/lib/dogma/index.ts tests/components/item-browser.test.tsx tests/fits/slots.test.ts
git commit -m "$(cat <<'EOM'
feat(fitting): the item browser with search, market tree, hull filter and charges

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOM
)"
```

---

### Task 16: `FitEditor` and the `/fitting/[id]` route

The state owner. It holds the `FitDoc`, derives everything from it on every change, autosaves 2 s
after the last edit, and hosts the toolbar and the Export EFT modal. This is the task the spec's
component-test bullet is about.

**Files:**
- Create: `src/app/fitting/FitEditor.tsx`, `src/app/fitting/[id]/page.tsx`, `tests/components/fit-editor.test.tsx`

**Interfaces:**
- Consumes (Tasks 1, 3, 4, 12–15, plus phase 2/4b):
```ts
// src/lib/fits/client-data.ts
export interface SkillContext { skills: Map<number, number>; implants: number[]; synced: boolean }
export function getDogmaMeta(fetchImpl?: typeof fetch): Promise<DogmaMeta>;
export function ensureTypes(ids: number[], fetchImpl?: typeof fetch): Promise<void>;
export function dogmaData(): DogmaData;
export function skillContext(characterId: number | "all-v", fetchImpl?: typeof fetch): Promise<SkillContext>;
export function pricesFor(ids: number[], fetchImpl?: typeof fetch): Promise<Map<number, Price>>;
// src/lib/fits/editor-view.ts
export function computeEditor(doc: FitDoc, ctx: FitContext, prices: ReadonlyMap<number, Price>): EditorResult;
export function fitTypeIds(doc: FitDoc): number[];
// src/lib/fits/slots.ts
export function fitTypeInto(doc, data, typeId, totals, at?): FitDoc;
export function removeSlot(doc, slot, index): FitDoc;
export function setSlotState(doc, slot, index, state): FitDoc;
export function setSlotCharge(doc, slot, index, chargeTypeId): FitDoc;
export function setEntryQuantity(doc, flag, typeId, quantity): FitDoc;
// src/lib/fits/eft.ts
export function exportEft(doc: FitDoc, data: DogmaData, totals: SlotTotals): string;
// src/lib/sde/repo.ts
export async function getTypeBonuses(typeId: number): Promise<SdeTypeBonus[]>
export async function getTypes(ids: number[]): Promise<Map<number, SdeType>>
// src/lib/view/ships.ts
export function bonusLabel(b: { bonus: number | null; bonusText: string | null; unitId: number | null }): string
// src/lib/db/fits.ts, src/lib/db/characters.ts, src/lib/api/json.ts
export function getFit(id: number): Promise<FitRow | null>;
export async function listCharacters(): Promise<Character[]>
export function parseId(raw: string): number | null
```
- Produces:
```tsx
export const AUTOSAVE_MS: number;        // 2000 (spec §4)
export interface FitEditorProps {
  fit: { id: number; name: string; description: string; shipTypeId: number;
         characterId: number | null; items: FitItem[] };
  characters: { id: number; name: string }[];
  bonuses: BonusView[];
}
export function FitEditor(props: FitEditorProps): JSX.Element;
// route: /fitting/[id]
```

**Decisions recorded here (do not re-litigate them):**
- **The maths is never debounced.** Spec §3: a fit is microseconds, so `computeEditor` runs inside a
  `useMemo` on every state change. The only timers in this component are the 2 s autosave and (in
  `ItemBrowser`) the 250 ms search.
- **Autosave compares a JSON payload against the last saved one**, so a no-op edit (typing a
  character and deleting it) does not fire a `PUT`, and a failed save stays "dirty" and retries on
  the next change — spec §7's "API failures show the error and keep the local state".
- **Ship bonuses are rendered without a skill level.** Phase 4b's fit sheet showed the character's
  level beside each bonus, but here the character can change without a page load, so the server
  cannot know it. `BonusView.level` is `null` and `StatsPanel` renders just the skill name.
- **Changing the character re-fetches the skill context only**, not the meta or the types already
  memoised; the store handles that.
- **Clone posts the current document, not the saved one.** You clone what you are looking at.
- **Delete navigates back to `/fitting`** via `router.push`, then `router.refresh()` so the list
  re-renders on the server.
- The route is a **server component** doing three reads (`getFit`, `listCharacters`,
  `getTypeBonuses` + one `getTypes` for the bonus skill names); everything else the editor needs it
  fetches itself from the API routes.

- [ ] **Step 1: Write the failing test**

`tests/components/fit-editor.test.tsx`:
```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { fixtureData } from "../dogma/fixture.js";
import { serialiseMeta, serialiseTypes } from "../../src/lib/dogma/serialize.js";
import { resetDogmaStore } from "../../src/lib/fits/client-data.js";
import { AUTOSAVE_MS, FitEditor } from "../../src/app/fitting/FitEditor.js";
import { CATEGORY } from "../../src/lib/dogma/index.js";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh: vi.fn() }) }));

const data = fixtureData("rifter");
const META = serialiseMeta(data, 3484357);
const ALL_TYPES = serialiseTypes(data);
const SKILL_IDS = ALL_TYPES.filter((t) => t.categoryId === CATEGORY.skill).map((t) => t.id);

let puts: { url: string; body: unknown }[] = [];

const GUN = { typeId: 2889, quantity: 1, flag: "HiSlot0", chargeTypeId: null, state: "active" as const };
const FIT = {
  id: 7, name: "Cheap Rifter", description: "", shipTypeId: 587, characterId: null,
  items: [0, 1, 2].map((i) => ({ ...GUN, flag: `HiSlot${i}` })),
};

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  resetDogmaStore();
  puts = [];
  push.mockClear();
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (init?.method === "PUT" || init?.method === "POST") {
      puts.push({ url, body: JSON.parse(String(init.body)) });
      return { ok: true, status: 200, json: async () => ({ fit: FIT }) } as Response;
    }
    const body =
      url.startsWith("/api/dogma/meta") ? META
      : url.startsWith("/api/dogma/types") ? { build: 3484357, types: ALL_TYPES }
      : url.startsWith("/api/sde/types") && url.includes("category=16")
        ? { types: SKILL_IDS.map((id) => ({ id })) }
      : url.startsWith("/api/sde/market-groups") ? { groups: [] }
      : url.startsWith("/api/market/prices") ? { prices: {} }
      : url.includes("q=damage") ? { types: [{ id: 2048, name: "Damage Control II", groupId: 60, categoryId: 7, marketGroupId: 615, metaGroup: "Tech II", metaLevel: 5 }] }
      : url.includes("q=autocannon") ? { types: [{ id: 2889, name: "200mm AutoCannon II", groupId: 55, categoryId: 7, marketGroupId: 574, metaGroup: "Tech II", metaLevel: 5 }] }
      : { types: [] };
    return { ok: true, status: 200, json: async () => body } as Response;
  }) as typeof fetch;
});
afterEach(() => { vi.useRealTimers(); });

async function renderEditor() {
  render(<FitEditor fit={FIT} characters={[{ id: 90000101, name: "Mara Vexley" }]} bonuses={[]} />);
  // All skills V by default (characterId null), so the first gauge is the all-V number.
  await waitFor(() => expect(screen.getByText("20.25 / 162.50 tf")).toBeInTheDocument());
}

describe("FitEditor", () => {
  it("computes the fit in the browser and shows no problems at All skills V", async () => {
    await renderEditor();
    expect(screen.getByText("10.80 / 51.25 MW")).toBeInTheDocument();
    expect(screen.getByText(/No problems/)).toBeInTheDocument();
  });

  it("adding a module updates the CPU gauge, and taking it offline gives the CPU back", async () => {
    await renderEditor();
    // Damage Control II costs 30 tf at every skill level: 20.25 → 50.25.
    fireEvent.change(screen.getByLabelText("Search items"), { target: { value: "damage" } });
    await waitFor(() => expect(screen.getByText("Damage Control II")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Fit Damage Control II" }));
    await waitFor(() => expect(screen.getByText("50.25 / 162.50 tf")).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText("Damage Control II state"), { target: { value: "offline" } });
    await waitFor(() => expect(screen.getByText("20.25 / 162.50 tf")).toBeInTheDocument());

    // A fourth gun over-fills the three high slots, so the slot problem appears.
    expect(screen.getByText(/No problems/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Search items"), { target: { value: "autocannon" } });
    await waitFor(() => expect(screen.getByText("200mm AutoCannon II")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Fit 200mm AutoCannon II" }));
    await waitFor(() => expect(screen.getByText("Slots")).toBeInTheDocument());
  });

  it("autosaves two seconds after the last edit and says so", async () => {
    await renderEditor();
    fireEvent.change(screen.getByLabelText("Fit name"), { target: { value: "Renamed" } });
    expect(puts).toHaveLength(0);
    await act(async () => { vi.advanceTimersByTime(AUTOSAVE_MS + 10); });
    await waitFor(() => expect(puts).toHaveLength(1));
    expect(puts[0].url).toBe("/api/fits/7");
    expect(puts[0].body).toMatchObject({ name: "Renamed", characterId: null });
    expect(screen.getByText("Saved")).toBeInTheDocument();
  });

  it("switching to a character changes the missing-skill list", async () => {
    await renderEditor();
    globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.startsWith("/api/characters/")) {
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ skills: [], implants: [] }) } as Response);
      }
      if (init?.method === "PUT") return Promise.resolve({ ok: true, status: 200, json: async () => ({}) } as Response);
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ build: 3484357, types: ALL_TYPES, prices: {}, groups: [], attributes: [], effects: [] }) } as Response);
    }) as typeof fetch;

    fireEvent.change(screen.getByLabelText("Pilot"), { target: { value: "90000101" } });
    await waitFor(() => expect(screen.getByText("Minmatar Frigate")).toBeInTheDocument());
    expect(screen.getByText("No skills synced yet — every skill is treated as level 0, so these numbers are worst case."))
      .toBeInTheDocument();
  });

  it("exports the fit as EFT text", async () => {
    await renderEditor();
    fireEvent.click(screen.getByRole("button", { name: "Export EFT" }));
    const box = screen.getByLabelText("EFT text") as HTMLTextAreaElement;
    expect(box.value.startsWith("[Rifter, Cheap Rifter]")).toBe(true);
    expect(box.value).toContain("200mm AutoCannon II");
    expect(box.value).toContain("[Empty Low slot]");
  });

  it("keeps the local state and says so when the save fails", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    await renderEditor();
    globalThis.fetch = (async () => ({ ok: false, status: 500, json: async () => ({}) } as Response)) as typeof fetch;
    fireEvent.change(screen.getByLabelText("Fit name"), { target: { value: "Renamed" } });
    await act(async () => { vi.advanceTimersByTime(AUTOSAVE_MS + 10); });
    await waitFor(() => expect(screen.getByText(/Could not save/)).toBeInTheDocument());
    expect((screen.getByLabelText("Fit name") as HTMLInputElement).value).toBe("Renamed");
    logged.mockRestore();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/components/fit-editor.test.tsx`
Expected: FAIL — `Failed to resolve import "../../src/app/fitting/FitEditor.js"`.

- [ ] **Step 3: Write `FitEditor`**

`src/app/fitting/FitEditor.tsx`:
```tsx
"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { IconCopy, IconFileExport, IconTrash } from "@tabler/icons-react";
import type { SlotKind } from "../../lib/dogma/index.js";
import {
  dogmaData, ensureTypes, getDogmaMeta, pricesFor, skillContext, type SkillContext,
} from "../../lib/fits/client-data.js";
import type { FitDoc, FitItem, FitItemState } from "../../lib/fits/doc.js";
import { computeEditor, fitTypeIds } from "../../lib/fits/editor-view.js";
import { exportEft } from "../../lib/fits/eft.js";
import {
  fitTypeInto, removeSlot, setEntryQuantity, setSlotCharge, setSlotState,
} from "../../lib/fits/slots.js";
import type { BonusView } from "../../lib/view/fit-sheet.js";
import type { Price } from "../../lib/view/price.js";
import { ItemBrowser } from "./ItemBrowser.js";
import { SlotLayout } from "./SlotLayout.js";
import { StatsPanel } from "./StatsPanel.js";

/** Spec §4: "autosaves 2 s after the last change with a 'saved' indicator". */
export const AUTOSAVE_MS = 2000;

export interface FitEditorProps {
  fit: {
    id: number; name: string; description: string; shipTypeId: number;
    characterId: number | null; items: FitItem[];
  };
  characters: { id: number; name: string }[];
  bonuses: BonusView[];
}

interface SavePayload {
  name: string; description: string; characterId: number | null; items: FitItem[];
}

function toPayload(doc: FitDoc): SavePayload {
  return {
    name: doc.name, description: doc.description,
    characterId: doc.characterId === "all-v" ? null : doc.characterId,
    items: doc.items,
  };
}

const SAVE_LABELS = { idle: "", saving: "Saving…", saved: "Saved", error: "Could not save — retrying on the next change" };

export function FitEditor({ fit, characters, bonuses }: FitEditorProps) {
  const router = useRouter();
  const [doc, setDoc] = useState<FitDoc>(() => ({
    id: fit.id, name: fit.name, description: fit.description, shipTypeId: fit.shipTypeId,
    characterId: fit.characterId ?? "all-v", items: fit.items,
  }));
  const [context, setContext] = useState<SkillContext | null>(null);
  const [prices, setPrices] = useState<ReadonlyMap<number, Price>>(new Map());
  const [loads, setLoads] = useState(0);
  const [dataError, setDataError] = useState(false);
  const [selected, setSelected] = useState<{ slot: SlotKind; index: number } | null>(null);
  const [saveState, setSaveState] = useState<keyof typeof SAVE_LABELS>("idle");
  const [showExport, setShowExport] = useState(false);
  // Lazily initialised, once: a plain `useRef(JSON.stringify(toPayload(...)))` would rebuild the
  // payload and re-stringify it on every render just to throw the result away.
  const savedRef = useRef<string | null>(null);
  if (savedRef.current === null) {
    savedRef.current = JSON.stringify(toPayload({
      id: fit.id, name: fit.name, description: fit.description, shipTypeId: fit.shipTypeId,
      characterId: fit.characterId ?? "all-v", items: fit.items,
    }));
  }

  // The ids the document references, as a stable dependency.
  const typeKey = useMemo(() => fitTypeIds(doc).join(","), [doc]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await getDogmaMeta();
      await ensureTypes(typeKey.split(",").map(Number));
      if (!cancelled) setLoads((n) => n + 1);
    })().catch((e: unknown) => {
      console.error("[fitting] could not load the static data", e);
      if (!cancelled) setDataError(true);
    });
    return () => { cancelled = true; };
  }, [typeKey]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await getDogmaMeta();
      const loaded = await skillContext(doc.characterId);
      if (!cancelled) { setContext(loaded); setLoads((n) => n + 1); }
    })().catch((e: unknown) => {
      console.error("[fitting] could not load the skill context", e);
      if (!cancelled) setDataError(true);
    });
    return () => { cancelled = true; };
  }, [doc.characterId]);

  useEffect(() => {
    let cancelled = false;
    pricesFor(typeKey.split(",").map(Number))
      .then((loaded) => { if (!cancelled) setPrices(loaded); })
      .catch((e: unknown) => { console.error("[fitting] could not load prices", e); });
    return () => { cancelled = true; };
  }, [typeKey]);

  const save = useCallback(async (payload: SavePayload) => {
    setSaveState("saving");
    try {
      const res = await fetch(`/api/fits/${fit.id}`, {
        method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`PUT /api/fits/${fit.id} answered ${res.status}`);
      savedRef.current = JSON.stringify(payload);
      setSaveState("saved");
    } catch (e) {
      // Spec §7: the local state is kept and the next change retries.
      console.error("[fitting] could not save the fit", e);
      setSaveState("error");
    }
  }, [fit.id]);

  useEffect(() => {
    const payload = toPayload(doc);
    if (JSON.stringify(payload) === savedRef.current) return;
    const timer = setTimeout(() => { void save(payload); }, AUTOSAVE_MS);
    return () => clearTimeout(timer);
  }, [doc, save]);

  const result = useMemo(() => {
    if (context === null || loads === 0) return null;
    return computeEditor(
      doc, { data: dogmaData(), skills: context.skills, implants: context.implants }, prices);
  }, [doc, context, prices, loads]);

  const totals = result !== null && result.kind === "ok" ? result.totals : null;

  const fitType = useCallback((typeId: number) => {
    if (totals === null) return;
    setDoc((current) => fitTypeInto(current, dogmaData(), typeId, totals, selected ?? undefined));
  }, [totals, selected]);

  const loadCharge = useCallback((typeId: number) => {
    if (selected === null) return;
    setDoc((current) => setSlotCharge(current, selected.slot, selected.index, typeId));
  }, [selected]);

  const clone = async () => {
    const res = await fetch("/api/fits", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...toPayload(doc), name: `${doc.name} copy`, shipTypeId: doc.shipTypeId }),
    });
    if (!res.ok) { setSaveState("error"); return; }
    const body = (await res.json()) as { fit: { id: number } };
    router.push(`/fitting/${body.fit.id}`);
  };

  const remove = async () => {
    const res = await fetch(`/api/fits/${fit.id}`, { method: "DELETE" });
    if (!res.ok) { setSaveState("error"); return; }
    router.push("/fitting");
    router.refresh();
  };

  if (dataError) {
    return (<>
      <h1 className="page-title">{doc.name}</h1>
      <div className="card coming-soon">Could not load the static data — the error was logged.</div>
    </>);
  }
  if (result === null) {
    return (<>
      <h1 className="page-title">{doc.name}</h1>
      <div className="card coming-soon">Loading the static data…</div>
    </>);
  }
  if (result.kind === "error") {
    return (<>
      <h1 className="page-title">{doc.name}</h1>
      <div className="card coming-soon">Could not compute this fit — the error was logged.</div>
    </>);
  }

  const selectedTypeId = result.view.blocks
    .find((b) => b.slot === selected?.slot)?.rows
    .find((r) => r.index === selected?.index)?.typeId ?? null;

  return (
    <>
      <div className="fit-toolbar">
        <input
          className="fit-name-input" value={doc.name} aria-label="Fit name"
          onChange={(e) => setDoc((current) => ({ ...current, name: e.target.value }))}
        />
        <label className="faint" htmlFor="fit-pilot">Pilot</label>
        <select
          id="fit-pilot" className="fit-select" aria-label="Pilot"
          value={doc.characterId === "all-v" ? "all-v" : String(doc.characterId)}
          onChange={(e) => setDoc((current) => ({
            ...current,
            characterId: e.target.value === "all-v" ? "all-v" : Number(e.target.value),
          }))}
        >
          <option value="all-v">All skills V</option>
          {characters.map((c) => <option key={c.id} value={String(c.id)}>{c.name}</option>)}
        </select>
        <button type="button" className="fit-btn" onClick={() => setShowExport(true)}>
          <IconFileExport size={14} /> Export EFT
        </button>
        <button type="button" className="fit-btn" onClick={() => { void clone(); }}>
          <IconCopy size={14} /> Clone
        </button>
        <button type="button" className="fit-btn danger" onClick={() => { void remove(); }}>
          <IconTrash size={14} /> Delete
        </button>
        <span className={`save-state${saveState === "error" ? " error" : ""}`}>{SAVE_LABELS[saveState]}</span>
      </div>

      <div className="fit-editor">
        <div className="fit-editor-main">
          <SlotLayout
            blocks={result.view.blocks}
            drones={result.view.drones} cargo={result.view.cargo} unknown={result.view.unknown}
            selected={selected}
            onSelect={(slot, index) => setSelected({ slot, index })}
            onRemove={(slot, index) => setDoc((c) => removeSlot(c, slot, index))}
            onState={(slot, index, state: FitItemState) => setDoc((c) => setSlotState(c, slot, index, state))}
            onClearCharge={(slot, index) => setDoc((c) => setSlotCharge(c, slot, index, null))}
            onQuantity={(flag, typeId, quantity) => setDoc((c) => setEntryQuantity(c, flag, typeId, quantity))}
            onRemoveEntry={(flag, typeId) => setDoc((c) => setEntryQuantity(c, flag, typeId, 0))}
          />
          <ItemBrowser
            shipTypeId={doc.shipTypeId}
            selected={selected === null || selectedTypeId === null
              ? null
              : { slot: selected.slot, index: selected.index, typeId: selectedTypeId }}
            onFit={fitType}
            onCharge={loadCharge}
          />
        </div>
        <StatsPanel view={result.view} bonuses={bonuses} skillsSynced={context?.synced ?? false} />
      </div>

      {showExport ? (
        <div className="modal-backdrop" role="dialog" aria-label="Export EFT">
          <div className="card modal">
            <h2 className="card-title">Export EFT</h2>
            <textarea
              className="eft-text" aria-label="EFT text" readOnly
              value={exportEft(doc, dogmaData(), result.totals)}
            />
            <div className="fit-toolbar">
              <button
                type="button" className="fit-btn"
                onClick={() => {
                  void navigator.clipboard?.writeText(exportEft(doc, dogmaData(), result.totals));
                }}
              >Copy</button>
              <button type="button" className="fit-btn" onClick={() => setShowExport(false)}>Close</button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
```

- [ ] **Step 4: Write the route**

`src/app/fitting/[id]/page.tsx`:
```tsx
import { notFound } from "next/navigation";
import { parseId } from "../../../lib/api/json.js";
import { listCharacters } from "../../../lib/db/characters.js";
import { getFit } from "../../../lib/db/fits.js";
import { getTypeBonuses, getTypes } from "../../../lib/sde/repo.js";
import { bonusLabel } from "../../../lib/view/ships.js";
import { FitEditor } from "../FitEditor.js";

export default async function FitEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const id = parseId((await params).id);
  if (id === null) notFound();

  const [fit, characters] = await Promise.all([getFit(id), listCharacters()]);
  if (fit === null) notFound();

  // Hull traits, read here because `getTypeBonuses` needs Postgres. The pilot can change without a
  // page load, so no skill level is shown beside a bonus (the fit sheet on /ships does show one).
  const bonuses = await getTypeBonuses(fit.shipTypeId);
  const skillIds = [...new Set(bonuses.map((b) => b.skillTypeId).filter((v): v is number => v !== null))];
  const skillTypes = await getTypes(skillIds);

  return (
    <FitEditor
      fit={{
        id: fit.id, name: fit.name, description: fit.description, shipTypeId: fit.shipTypeId,
        characterId: fit.characterId, items: fit.items,
      }}
      characters={characters.map((c) => ({ id: c.id, name: c.name }))}
      bonuses={bonuses.map((b) => ({
        skill: b.skillTypeId === null ? null : (skillTypes.get(b.skillTypeId)?.name ?? null),
        level: null,
        text: bonusLabel(b),
      }))}
    />
  );
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run tests/components/fit-editor.test.tsx && npm run typecheck`
Expected: 6 tests pass; `tsc --noEmit` clean; no stray console output.

- [ ] **Step 6: Prove no server code reached the client bundle**

```bash
npm run build
```
Expected: `next build` succeeds. A failure mentioning `pg`, `node:fs` or `dns` means a `"use client"`
file imported something under `src/lib/db/**`, `src/lib/sde/**`, `src/lib/ships/**`,
`src/lib/fits/{clone,load}.ts` or `src/lib/dogma/sde-loader.js` — find it and cut the import.

- [ ] **Step 7: Commit**

```bash
git add src/app/fitting/FitEditor.tsx "src/app/fitting/[id]" tests/components/fit-editor.test.tsx
git commit -m "$(cat <<'EOM'
feat(fitting): the fit editor and its route

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOM
)"
```

---

### Task 17: The `/fitting` list page

Spec §4's first screen: saved fits with name, ship, pilot, updated and value, plus **New fit**
(hull picker), **Import EFT**, **From saved fittings**, **From my ships**, and per fit open / clone /
delete. This is the task that turns the nav item live.

**Files:**
- Create: `src/lib/fits/load.ts`, `src/app/fitting/FitList.tsx`, `tests/db/fits-load.test.ts`, `tests/components/fit-list.test.tsx`
- Modify: `src/app/fitting/page.tsx` (replace the `ComingSoon` stub)

**Interfaces:**
- Consumes (phase 2/3/4b and Tasks 2, 12):
```ts
// src/lib/db/character-assets.ts / character-fittings.ts
export async function listAssets(characterId: number): Promise<AssetRow[]>
export async function listFittings(characterId: number): Promise<FittingRow[]>
// src/lib/dogma/sde-loader.ts
export async function loadDogmaData(typeIds: TypeId[]): Promise<DogmaData>
// src/lib/view/ships.ts
export function assembledShips(assets: AssetRow[], data: DogmaData): ShipGroup[]
// src/lib/db/market-prices.ts
export async function getPrices(typeIds: number[]): Promise<Map<number, Price>>
// src/lib/view/price.ts / format.ts
export function rollUpValue(entries: ValuedEntry[], prices: ReadonlyMap<number, Price>): ValueRoll;
export function iskShort(value: number): string;
export function relativeTime(date: Date | null, now?: Date): string;
// src/lib/db/fits.ts (Task 2), src/lib/db/characters.ts, src/lib/auth/session.ts, src/lib/view/characters.ts
export function listFits(): Promise<FitRow[]>;
export async function listCharacters(): Promise<Character[]>
export async function readSession(): Promise<SessionPayload | null>
export function pickActive<T extends { id: number }>(characters: T[], activeId: number | null): T | null
```
- Produces:
```ts
// src/lib/fits/load.ts — server only
export interface FitListRow { id: number; name: string; typeName: string; pilot: string;
                              updated: string; value: string; unpriced: string | null }
export interface CloneSource { id: number; label: string }
export interface FittingIndex { rows: FitListRow[]; fittings: CloneSource[]; ships: CloneSource[] }
export function loadFittingIndex(characterId: number | null, now?: Date): Promise<FittingIndex>;
// src/app/fitting/FitList.tsx — "use client"
export function FitList(props: { index: FittingIndex; characterId: number | null }): JSX.Element;
```

**Decisions recorded here (do not re-litigate them):**
- **The list page runs no engine maths** (Decision 8). A fit's value is the sum of its items' prices,
  so `getPrices` + `rollUpValue` is the whole computation; `loadDogmaData` is called once, purely
  for **type names** and for `assembledShips`'s category check.
- **One `loadDogmaData` per request**, over the union of the local fits' ids and the character's
  asset/fitting ids. `loadFittingIndex` therefore reads the repos itself rather than calling
  `loadFitData` and then loading a second time; the ~8 duplicated lines are cheaper than two loads.
- **`pilot` is a string computed on the server** — the character's name or `"All skills V"`. The
  list is a server component; only the buttons are a client island.
- **No character at all** (nothing synced, no SSO characters) still renders the page: local fits are
  not per-character. The clone pickers are simply empty and say so.
- **Every mutation in `FitList` is a `fetch` + `router.refresh()`**, so the server component re-reads
  Postgres and the list is never stale. Creating or importing navigates straight into the editor.

- [ ] **Step 1: Write the failing loader test**

`tests/db/fits-load.test.ts` (follow `tests/db/ships-load.test.ts` for the mini-SDE fixture setup):
```ts
import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import type { Pool } from "pg";
import { resetDb, resetSde } from "./helpers.js";
import { closePool } from "../../src/lib/db/client.js";
import { resetDogmaCache } from "../../src/lib/dogma/sde-loader.js";
import { createFit } from "../../src/lib/db/fits.js";
import { upsertJitaPrices } from "../../src/lib/db/market-prices.js";
import { loadFittingIndex } from "../../src/lib/fits/load.js";

let pool: Pool;
const CID = 90000101;
const NOW = new Date("2026-09-02T12:00:00Z");

beforeAll(async () => { pool = await resetDb(); });
afterAll(async () => { await closePool(); });

beforeEach(async () => {
  await resetSde(pool);
  resetDogmaCache();
  await pool.query("TRUNCATE fits RESTART IDENTITY CASCADE");
  await pool.query("TRUNCATE characters CASCADE");
  await pool.query("INSERT INTO characters (id, name, refresh_token_enc) VALUES ($1, 'Mara Vexley', 'enc')", [CID]);
  await pool.query("INSERT INTO sde_categories (id, name, published) VALUES (6, 'Ship', true), (7, 'Module', true)");
  await pool.query("INSERT INTO sde_groups (id, category_id, name, published) VALUES (25, 6, 'Frigate', true), (55, 7, 'Projectile Weapon', true)");
  await pool.query("INSERT INTO sde_types (id, group_id, name, published) VALUES (587, 25, 'Rifter', true), (2889, 55, '200mm AutoCannon II', true)");
  await pool.query(
    `INSERT INTO character_assets (character_id, item_id, type_id, quantity, location_id, location_type, location_flag, is_singleton)
     VALUES ($1, 1000, 587, 1, 60003760, 'station', 'Hangar', true)`, [CID]);
  await pool.query(
    `INSERT INTO character_fittings (character_id, fitting_id, name, description, ship_type_id)
     VALUES ($1, 55, 'Saved Rifter', '', 587)`, [CID]);
  await upsertJitaPrices([{ typeId: 587, sellMin: 8_000_000, buyMax: null }]);
});

describe("loadFittingIndex", () => {
  it("lists local fits with their hull, pilot, age and value", async () => {
    await createFit({
      name: "Cheap Rifter", shipTypeId: 587, characterId: CID,
      items: [{ typeId: 2889, quantity: 1, flag: "HiSlot0", chargeTypeId: null, state: "active" }],
    });
    const index = await loadFittingIndex(CID, NOW);
    expect(index.rows).toHaveLength(1);
    expect(index.rows[0]).toMatchObject({
      name: "Cheap Rifter", typeName: "Rifter", pilot: "Mara Vexley", value: "8.0M ISK",
    });
    expect(index.rows[0].unpriced).toBe("1 item unpriced");   // the autocannon has no price row
  });

  it("labels an unassigned fit as All skills V and names an unknown hull", async () => {
    await createFit({ name: "Theory", shipTypeId: 99999 });
    const index = await loadFittingIndex(CID, NOW);
    expect(index.rows[0]).toMatchObject({ pilot: "All skills V", typeName: "Unknown type (99999)" });
  });

  it("offers the character's saved fittings and assembled ships as clone sources", async () => {
    const index = await loadFittingIndex(CID, NOW);
    expect(index.fittings).toEqual([{ id: 55, label: "Saved Rifter" }]);
    expect(index.ships).toEqual([{ id: 1000, label: "Rifter" }]);
  });

  it("works with no character at all", async () => {
    await createFit({ name: "Theory", shipTypeId: 587 });
    const index = await loadFittingIndex(null, NOW);
    expect(index.rows).toHaveLength(1);
    expect(index.fittings).toEqual([]);
    expect(index.ships).toEqual([]);
  });
});
```

- [ ] **Step 2: Write the failing component test**

`tests/components/fit-list.test.tsx`:
```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { FitList } from "../../src/app/fitting/FitList.js";

const push = vi.fn();
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh }) }));

const INDEX = {
  rows: [{ id: 7, name: "Cheap Rifter", typeName: "Rifter", pilot: "Mara Vexley",
           updated: "2 h ago", value: "8.0M ISK", unpriced: null }],
  fittings: [{ id: 55, label: "Saved Rifter" }],
  ships: [{ id: 1000, label: "Scarlet Dart" }],
};

let posts: { url: string; body: unknown }[] = [];
let deletes: string[] = [];

beforeEach(() => {
  posts = []; deletes = []; push.mockClear(); refresh.mockClear();
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (init?.method === "DELETE") { deletes.push(url); return { ok: true, status: 204 } as Response; }
    if (init?.method === "POST") {
      posts.push({ url, body: JSON.parse(String(init.body)) });
      return { ok: true, status: 201, json: async () => ({ fit: { id: 9 }, unresolved: [] }) } as Response;
    }
    return { ok: true, status: 200, json: async () => ({
      types: [{ id: 587, name: "Rifter", groupId: 25, categoryId: 6, marketGroupId: null, metaGroup: null, metaLevel: null }],
    }) } as Response;
  }) as typeof fetch;
});

describe("FitList", () => {
  it("lists the saved fits", () => {
    render(<FitList index={INDEX} characterId={90000101} />);
    expect(screen.getByText("Cheap Rifter")).toBeInTheDocument();
    expect(screen.getByText("8.0M ISK")).toBeInTheDocument();
  });

  it("creates a new fit from a hull search and opens it", async () => {
    render(<FitList index={INDEX} characterId={90000101} />);
    fireEvent.click(screen.getByRole("button", { name: "New fit" }));
    fireEvent.change(screen.getByLabelText("Search hulls"), { target: { value: "rifter" } });
    await waitFor(() => expect(screen.getByRole("button", { name: "New Rifter fit" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "New Rifter fit" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/fitting/9"));
    expect(posts[0]).toMatchObject({ url: "/api/fits", body: { name: "Rifter", shipTypeId: 587, characterId: 90000101 } });
  });

  it("imports EFT text and reports unresolved lines", async () => {
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      posts.push({ url: String(input), body: JSON.parse(String(init?.body)) });
      return { ok: true, status: 201,
        json: async () => ({ fit: { id: 9 }, unresolved: ["Damage Controll II"] }) } as Response;
    }) as typeof fetch;

    render(<FitList index={INDEX} characterId={90000101} />);
    fireEvent.click(screen.getByRole("button", { name: "Import EFT" }));
    fireEvent.change(screen.getByLabelText("EFT text"), { target: { value: "[Rifter, x]\nDamage Controll II\n" } });
    fireEvent.click(screen.getByRole("button", { name: "Import" }));
    await waitFor(() => expect(screen.getByText(/Damage Controll II/)).toBeInTheDocument());
    expect(posts[0].url).toBe("/api/fits/import");
  });

  it("clones from a saved fitting and from an assembled ship", async () => {
    render(<FitList index={INDEX} characterId={90000101} />);
    fireEvent.change(screen.getByLabelText("From saved fittings"), { target: { value: "55" } });
    await waitFor(() => expect(posts[0]).toMatchObject({
      url: "/api/fits/from-fitting", body: { characterId: 90000101, fittingId: 55 } }));

    fireEvent.change(screen.getByLabelText("From my ships"), { target: { value: "1000" } });
    await waitFor(() => expect(posts[1]).toMatchObject({
      url: "/api/fits/from-asset", body: { characterId: 90000101, itemId: 1000 } }));
  });

  it("deletes a fit and refreshes the list", async () => {
    render(<FitList index={INDEX} characterId={90000101} />);
    fireEvent.click(screen.getByRole("button", { name: "Delete Cheap Rifter" }));
    await waitFor(() => expect(deletes).toEqual(["/api/fits/7"]));
    expect(refresh).toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Run both tests to verify they fail**

Run: `npx vitest run tests/db/fits-load.test.ts tests/components/fit-list.test.tsx`
Expected: FAIL — neither `src/lib/fits/load.js` nor `src/app/fitting/FitList.js` resolves.

- [ ] **Step 4: Write `src/lib/fits/load.ts`**

```ts
/**
 * Everything `/fitting` shows, in one `loadDogmaData` call. Server only.
 *
 * No engine maths happens here: a fit's value is the sum of its items' prices, and the static data
 * is needed only for type names and for `assembledShips`'s category check.
 */
import { listAssets } from "../db/character-assets.js";
import { listFittings } from "../db/character-fittings.js";
import { listCharacters } from "../db/characters.js";
import { listFits } from "../db/fits.js";
import { getPrices } from "../db/market-prices.js";
import { loadDogmaData } from "../dogma/sde-loader.js";
import { relativeTime } from "../view/format.js";
import { iskShort, rollUpValue, unpricedNote, type ValuedEntry } from "../view/price.js";
import { assembledShips } from "../view/ships.js";

export interface FitListRow {
  id: number; name: string; typeName: string; pilot: string;
  updated: string; value: string; unpriced: string | null;
}
export interface CloneSource { id: number; label: string }
export interface FittingIndex { rows: FitListRow[]; fittings: CloneSource[]; ships: CloneSource[] }

export const ALL_V_PILOT = "All skills V";

export async function loadFittingIndex(
  characterId: number | null, now: Date = new Date(),
): Promise<FittingIndex> {
  const [fits, characters, assets, fittings] = await Promise.all([
    listFits(),
    listCharacters(),
    characterId === null ? Promise.resolve([]) : listAssets(characterId),
    characterId === null ? Promise.resolve([]) : listFittings(characterId),
  ]);

  const typeIds = new Set<number>();
  for (const fit of fits) {
    typeIds.add(fit.shipTypeId);
    for (const item of fit.items) {
      typeIds.add(item.typeId);
      if (item.chargeTypeId !== null) typeIds.add(item.chargeTypeId);
    }
  }
  for (const asset of assets) typeIds.add(asset.typeId);
  for (const fitting of fittings) typeIds.add(fitting.shipTypeId);

  const data = await loadDogmaData([...typeIds]);
  const prices = await getPrices([...typeIds]);
  const names = new Map(characters.map((c) => [c.id, c.name]));
  const typeName = (id: number) => data.types.get(id)?.name ?? `Unknown type (${id})`;

  const rows: FitListRow[] = fits.map((fit) => {
    const entries: ValuedEntry[] = [{ typeId: fit.shipTypeId, quantity: 1 }];
    for (const item of fit.items) {
      entries.push({ typeId: item.typeId, quantity: item.quantity });
      if (item.chargeTypeId !== null) entries.push({ typeId: item.chargeTypeId, quantity: 1 });
    }
    const roll = rollUpValue(entries, prices);
    return {
      id: fit.id, name: fit.name, typeName: typeName(fit.shipTypeId),
      pilot: fit.characterId === null ? ALL_V_PILOT : (names.get(fit.characterId) ?? ALL_V_PILOT),
      updated: relativeTime(fit.updatedAt, now),
      value: iskShort(roll.total),
      unpriced: unpricedNote(roll.unpriced),
    };
  });

  return {
    rows,
    fittings: fittings.map((f) => ({
      id: f.fittingId, label: f.name === "" ? `Fitting ${f.fittingId}` : f.name,
    })),
    ships: assembledShips(assets, data).map((group) => ({
      id: group.ship.itemId, label: group.ship.name ?? typeName(group.ship.typeId),
    })),
  };
}
```

- [ ] **Step 5: Write `FitList` and the page**

`src/app/fitting/FitList.tsx`:
```tsx
"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { IconPlus, IconTrash, IconUpload } from "@tabler/icons-react";
import type { FittingIndex } from "../../lib/fits/load.js";

interface HullOption { id: number; name: string | null }
const SHIP_CATEGORY = 6;
const SEARCH_DEBOUNCE_MS = 250;

export function FitList({ index, characterId }: { index: FittingIndex; characterId: number | null }) {
  const router = useRouter();
  const [mode, setMode] = useState<"none" | "new" | "import">("none");
  const [hullQuery, setHullQuery] = useState("");
  const [hulls, setHulls] = useState<HullOption[]>([]);
  const [text, setText] = useState("");
  const [unresolved, setUnresolved] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (mode !== "new" || hullQuery.trim() === "") { setHulls([]); return; }
    let cancelled = false;
    const timer = setTimeout(() => {
      fetch(`/api/sde/types?q=${encodeURIComponent(hullQuery.trim())}&category=${SHIP_CATEGORY}&limit=50`)
        .then((res) => res.json() as Promise<{ types: HullOption[] }>)
        .then((body) => { if (!cancelled) setHulls(body.types); })
        .catch((e: unknown) => { console.error("[fitting] hull search", e); });
    }, SEARCH_DEBOUNCE_MS);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [mode, hullQuery]);

  async function post(url: string, body: unknown): Promise<{ fit: { id: number }; unresolved?: string[] } | null> {
    setError(null);
    const res = await fetch(url, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
    });
    if (!res.ok) { setError("That did not work — nothing was created."); return null; }
    return (await res.json()) as { fit: { id: number }; unresolved?: string[] };
  }

  const createFrom = async (hull: HullOption) => {
    const body = await post("/api/fits", {
      name: hull.name ?? `Type ${hull.id}`, shipTypeId: hull.id, characterId,
    });
    if (body !== null) router.push(`/fitting/${body.fit.id}`);
  };

  const importText = async () => {
    const body = await post("/api/fits/import", { text });
    if (body === null) return;
    if (body.unresolved !== undefined && body.unresolved.length > 0) { setUnresolved(body.unresolved); return; }
    router.push(`/fitting/${body.fit.id}`);
  };

  const cloneFrom = async (url: string, key: string, id: number) => {
    if (characterId === null || id === 0) return;
    const body = await post(url, { characterId, [key]: id });
    if (body !== null) router.push(`/fitting/${body.fit.id}`);
  };

  const remove = async (id: number) => {
    const res = await fetch(`/api/fits/${id}`, { method: "DELETE" });
    if (!res.ok) { setError("Could not delete that fit."); return; }
    router.refresh();
  };

  return (
    <>
      <div className="fit-toolbar">
        <button type="button" className="fit-btn" onClick={() => setMode(mode === "new" ? "none" : "new")}>
          <IconPlus size={14} /> New fit
        </button>
        <button type="button" className="fit-btn" onClick={() => setMode(mode === "import" ? "none" : "import")}>
          <IconUpload size={14} /> Import EFT
        </button>
        <select
          className="fit-select" aria-label="From saved fittings" value="0"
          disabled={index.fittings.length === 0}
          onChange={(e) => { void cloneFrom("/api/fits/from-fitting", "fittingId", Number(e.target.value)); }}
        >
          <option value="0">From saved fittings…</option>
          {index.fittings.map((f) => <option key={f.id} value={String(f.id)}>{f.label}</option>)}
        </select>
        <select
          className="fit-select" aria-label="From my ships" value="0"
          disabled={index.ships.length === 0}
          onChange={(e) => { void cloneFrom("/api/fits/from-asset", "itemId", Number(e.target.value)); }}
        >
          <option value="0">From my ships…</option>
          {index.ships.map((s) => <option key={s.id} value={String(s.id)}>{s.label}</option>)}
        </select>
      </div>

      {error === null ? null : <p className="card banner">{error}</p>}

      {mode === "new" ? (
        <div className="card">
          <h2 className="card-title">Pick a hull</h2>
          <label className="faint" htmlFor="hull-search">Search hulls</label>
          <input
            id="hull-search" className="filter-input" type="search" value={hullQuery}
            aria-label="Search hulls" placeholder="Rifter, Vexor, Tengu, …"
            onChange={(e) => setHullQuery(e.target.value)}
          />
          <ul className="browser-results">
            {hulls.map((hull) => (
              <li key={hull.id} className="browser-row">
                <span /><span>{hull.name}</span><span />
                <button
                  type="button" className="icon-btn" aria-label={`New ${hull.name} fit`}
                  onClick={() => { void createFrom(hull); }}
                ><IconPlus size={14} /></button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {mode === "import" ? (
        <div className="card">
          <h2 className="card-title">Import EFT</h2>
          <textarea
            className="eft-text" aria-label="EFT text" value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <div className="fit-toolbar">
            <button type="button" className="fit-btn" onClick={() => { void importText(); }}>Import</button>
          </div>
          {unresolved.length === 0 ? null : (
            <p className="faint">
              Imported, but these lines could not be resolved: {unresolved.join(", ")}
            </p>
          )}
        </div>
      ) : null}

      {index.rows.length === 0 ? <p className="faint">No fits yet — start one with “New fit”.</p> : (
        <div className="card">
          <table className="table">
            <thead>
              <tr><th>Name</th><th>Ship</th><th>Pilot</th><th>Updated</th><th className="num">Value</th><th /></tr>
            </thead>
            <tbody>
              {index.rows.map((row) => (
                <tr key={row.id}>
                  <td><Link href={`/fitting/${row.id}`}>{row.name}</Link></td>
                  <td>{row.typeName}</td>
                  <td className="muted">{row.pilot}</td>
                  <td className="muted">{row.updated}</td>
                  <td className="num">
                    {row.value}
                    {row.unpriced === null ? null : <span className="faint"> · {row.unpriced}</span>}
                  </td>
                  <td>
                    <button
                      type="button" className="icon-btn danger" aria-label={`Delete ${row.name}`}
                      onClick={() => { void remove(row.id); }}
                    ><IconTrash size={14} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
```

`src/app/fitting/page.tsx` (replacing the `ComingSoon` stub):
```tsx
import { readSession } from "../../lib/auth/session.js";
import { listCharacters } from "../../lib/db/characters.js";
import { loadFittingIndex } from "../../lib/fits/load.js";
import { pickActive } from "../../lib/view/characters.js";
import { FitList } from "./FitList.js";

export default async function FittingPage() {
  const [session, characters] = await Promise.all([readSession(), listCharacters()]);
  const character = pickActive(characters, session?.activeCharacterId ?? null);
  const index = await loadFittingIndex(character?.id ?? null);

  return (<>
    <h1 className="page-title">Fitting</h1>
    <p className="page-sub">{character === null ? "No character" : character.name}</p>
    <FitList index={index} characterId={character?.id ?? null} />
  </>);
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run tests/db/fits-load.test.ts tests/components/fit-list.test.tsx && npm run typecheck`
Expected: 4 loader tests and 5 component tests pass; `tsc --noEmit` clean.

- [ ] **Step 7: Run the whole suite and the build**

```bash
npm test && npm run typecheck && npm run build
```
Expected: every test passes with no stray console output; `tsc --noEmit` clean; `next build` succeeds.

- [ ] **Step 8: Commit**

```bash
git add src/lib/fits/load.ts src/app/fitting/FitList.tsx src/app/fitting/page.tsx tests/db/fits-load.test.ts tests/components/fit-list.test.tsx
git commit -m "$(cat <<'EOM'
feat(fitting): the /fitting list page with new, import and clone

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOM
)"
```

---

### Task 18: Deploy phase 5 to the VM and record acceptance

The acceptance for the whole phase. No Ansible or env changes: the existing `eve` role rsyncs the
repo, rebuilds the image, runs `npm run migrate` (which now applies `fits` and `fit_items` from
`db/schema.sql`) and restarts the app and worker. The SDE does **not** need re-importing — phase 5
adds no `sde_*` columns.

**Files:**
- Modify: `deploy/README.md` (a short "Fitting designer" section)

**Interfaces:**
- Consumes: Tasks 1–17, all committed on `feature/phase5-fitting`.
- Produces: `https://eve.plasma66.com/fitting` serving a live editor, and `fits` / `fit_items` rows
  in the production database.

- [ ] **Step 1: Confirm the branch is clean and green**

```bash
cd /home/daniel/AI/Plasma/EVE
git status --short
docker compose -f compose.dev.yml up -d
npm test && npm run typecheck && npm run build
```
Expected: no uncommitted changes; every test passes with pristine output; `tsc --noEmit` clean;
`next build` succeeds. A build failure naming `pg`, `node:fs` or `dns` means a client component
imported server code — fix that before deploying.

- [ ] **Step 2: Document the fitting designer in `deploy/README.md`**

Insert after the "Market prices" section:
```markdown
## Fitting designer

`/fitting` runs the dogma engine **in the browser**. Three routes feed it:

- `GET /api/dogma/meta` — the attribute/effect/group half of `DogmaData`, ~1.25 MB of JSON, with
  `Cache-Control: public, max-age=86400` and `ETag: "sde-<build>"`. A browser revalidates once a
  day and gets a 304 unless the SDE was re-imported.
- `GET /api/dogma/types?ids=` — up to 200 type ids plus their `requiredSkillN` closure, memoised
  per id in the tab.
- `GET /api/market/prices?ids=` — serves `market_prices` and, for ids with no row or a row older
  than 24 h, fetches Jita aggregates from Fuzzwork **synchronously** (one chunk of ≤ 500) before
  answering, so a freshly browsed module is priced immediately instead of waiting for the hourly
  job. A Fuzzwork failure is logged and the stored (ESI) prices are served.

Fits live in our own `fits` / `fit_items` tables and are **never pushed to ESI** — the
`esi-fittings.write_fittings.v1` scope is not requested. Export is EFT text.

Everything is behind the session cookie: `src/proxy.ts` guards every path except `/login`,
`/api/health`, `/auth/*` and `/_next/*`.
```

- [ ] **Step 3: Deploy**

```bash
cd deploy/ansible && script -qc "ansible-playbook site.yml --tags eve" /dev/null
```
Expected: play recap with `failed=0`. The image rebuild takes a few minutes on the VM.
(`script -qc … /dev/null` gives Ansible the TTY it wants; without it the playbook can abort on
non-blocking stdio.)

- [ ] **Step 4: Confirm the containers came back and the site is healthy**

```bash
ssh daniel@10.5.5.150 'docker ps --format "{{.Names}} {{.Status}}"'
curl -sS https://eve.plasma66.com/api/health
```
Expected: `eve-app`, `eve-worker`, `eve-postgres`, `traefik` all `Up`; health returns
`{"ok":true,"db":true}`.

- [ ] **Step 5: Confirm the migration created the two tables**

```bash
ssh daniel@10.5.5.150 "docker exec eve-postgres psql -U eve -d eve -Atc \"
  select table_name from information_schema.tables
  where table_schema='public' and table_name in ('fits','fit_items') order by table_name\""
ssh daniel@10.5.5.150 "docker exec eve-postgres psql -U eve -d eve -Atc \"
  select conname, confdeltype from pg_constraint
  where conrelid in ('fits'::regclass,'fit_items'::regclass) and contype='f'\""
```
Expected: `fit_items` and `fits`; two foreign keys — `fit_items.fit_id → fits` with `c` (cascade)
and `fits.character_id → characters` with `n` (set null). A missing table means `npm run migrate`
did not run; check the eve role's migrate task in the play output.

- [ ] **Step 6: Check the dogma routes over the wire, including the 304**

```bash
curl -sS -o /dev/null -w '%{size_download} %{content_type}\n' https://eve.plasma66.com/api/dogma/meta --cookie "eve_session=$COOKIE"
curl -sSI https://eve.plasma66.com/api/dogma/meta --cookie "eve_session=$COOKIE" | grep -i -E 'etag|cache-control'
curl -sS -o /dev/null -w '%{http_code}\n' https://eve.plasma66.com/api/dogma/meta \
  --cookie "eve_session=$COOKIE" -H 'If-None-Match: "sde-<the ETag value>"'
```
`$COOKIE` is the `eve_session` value from a logged-in browser (DevTools → Application → Cookies).
Expected: a body of roughly **1.2–1.4 MB** of `application/json`; `Cache-Control: public,
max-age=86400` and an `ETag` of the form `"sde-3484357"`; and `304` for the conditional request.
**Do not paste the cookie value into a commit message or a log.**

- [ ] **Step 7: Acceptance — Daniel, in a browser on the tailnet**

Work through this list and record the result of each item.

1. `https://eve.plasma66.com/fitting` loads with the nav item **Fitting** highlighted and no longer
   says "Coming in phase 5". With no fits yet it says "No fits yet — start one with 'New fit'".
2. **Import EFT** → paste the contents of `tests/fixtures/fits/rifter.eft` → the editor opens on a
   Rifter named "Cheap Rifter", with Damage Control II offline in the first low slot, two 200mm
   AutoCannon IIs loaded with Hail S, one small rig, two Hobgoblin IIs in the drone bay and 600
   Hail S in the cargo hold. Nothing is reported unresolved.
3. The stats panel shows CPU, powergrid and calibration gauges with real numbers, the slot and
   hardpoint counters (High 2/3, Mid 3/3, Low 2/4, Rigs 1/3, Turrets 2/3, Launchers 0/2), the
   Problems list, Missing skills as `have → need`, an estimated value and the Rifter's hull bonuses.
4. **Switch the pilot** between "All skills V" and Mara Vexley: the CPU figure and the missing-skill
   list both change, within a second and without a page reload.
5. **Add a module** from the browser (search "Damage Control", press the + button): it lands in the
   first free low slot and the CPU gauge jumps immediately. Set it **offline**: its CPU cost drops
   to 0.00 and the gauge falls back. Over-fill the high slots with a fourth gun: the extra row is
   marked and a **Slots** problem appears.
6. **Charges:** select an autocannon row; the browser switches to "Charges for 200mm AutoCannon II"
   and lists only projectile ammunition (no missiles, no wrong-size charges). Load one; it appears
   beside the module. Unload it with the × button.
7. **"Fits this hull"** is on by default: searching "collision accelerator" shows the Small rig and
   not the Medium one. Clearing the checkbox shows both, and fitting the Medium one raises a
   **Rig size** problem.
8. **Autosave:** rename the fit, wait two seconds, see "Saved", reload the page — the new name and
   every module survive.
9. **Export EFT** → the modal shows text that begins `[Rifter, <name>]`, contains
   `[Empty Low slot]` markers and the `/offline` suffix, and the Copy button puts it on the
   clipboard. Pasting that text back into **Import EFT** produces an identical fit.
10. **From my ships** → pick Mara Vexley's docked ship → a new fit opens. Compare its CPU and
    powergrid **used/output** against `https://eve.plasma66.com/ships/asset/<the same itemId>`:
    they must be **identical to two decimals**. This is the phase-4-vs-phase-5 agreement check and
    the single most important item on this list — the server and the browser are running the same
    engine on the same data, so a mismatch is a serialisation bug.
11. **From saved fittings** → pick an ESI fitting → the same comparison against
    `https://eve.plasma66.com/ships/fit/<fittingId>`.
12. **Delete** a fit from the list; it disappears and does not come back on reload.
13. Open DevTools → Network, reload the editor and confirm `/api/dogma/meta` is served **from the
    disk cache or as a 304**, not re-downloaded, and that editing a module fires **no** request at
    all (the engine is local; only the 2 s autosave `PUT` should appear).

- [ ] **Step 8: Commit the acceptance and merge**

```bash
cd /home/daniel/AI/Plasma/EVE
git add deploy/README.md
git commit -m "$(cat <<'EOM'
Deploy phase 5 (fitting designer) and record acceptance

Acceptance: fits/fit_items created by the migration; /api/dogma/meta served
<n> MB with ETag "sde-<build>" and 304 on revalidation; the EFT fixture
imported into a Rifter with the expected slots, drones and cargo; pilot
switching, module add/offline, over-fitting, charge filtering, the
fits-this-hull filter, autosave, EFT export/round-trip and delete all behaved
as listed. Clone from the docked ship matched /ships/asset/<itemId> exactly:
CPU <x> / <y> tf, powergrid <x> / <y> MW. Editing fires no network request.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOM
)"
git checkout main && git merge --no-ff feature/phase5-fitting
```

---

## Self-review

**1. Spec coverage.**

| Spec | Task |
|---|---|
| §2 `fits` / `fit_items` schema, ESI flag vocabulary, state check constraint | 2 |
| §2 ruling: fits are never pushed to ESI; export is by text | Global Constraints, 4, 18 |
| §3 `src/lib/dogma/**` stays isomorphic; the engine runs in the browser | Global Constraints, 5, 12, 16 |
| §3 `GET /api/dogma/meta` with `Cache-Control: public, max-age=86400` and an SDE-build `ETag` | 6 |
| §3 `GET /api/dogma/types?ids=` for up to 200 ids, memoised per id in a module-level `Map` | 6, 12 |
| §3 `GET /api/characters/[id]/skills` → `{ skills, implants }` | 9 |
| §3 "All skills V" from `GET /api/sde/types?category=16` | 7, 12 |
| §3 `serialize.ts` — `DogmaData` ⇄ JSON, shared by the routes and the client | 5 |
| §3 `FitDoc` in React state → `Fit` → `fitStats` → `validateFit`, synchronously | 1, 13, 16 |
| §4 `/fitting` list: name, ship, character, updated, value | 17 |
| §4 New fit (hull picker restricted to category 6), Import EFT | 17 |
| §4 From saved fittings / From my ships pickers | 11, 17 |
| §4 open / clone / delete per fit | 16, 17 |
| §4 slot layout sized by the hull, `.over` marker, icon, name, charge, CPU/PG, state toggle, remove | 3, 13, 14 |
| §4 drone bay and cargo with quantities | 3, 13, 14 |
| §4 browser: search box, market-group tree, meta-group badge, Fit button | 7, 15 |
| §4 "Fits this hull" filter using the phase-4 ship restriction | 15 |
| §4 charge list filtered by `chargeGroup*` (604, 605, 606, 609, 610) and `chargeSize` (128) | 3, 15 |
| §4 stats panel: three gauges, slots, hardpoints, Problems, Missing skills, Price, Ship bonuses | 13, 14, 16 |
| §4 toolbar: inline name, character selector, Save + 2 s autosave with a "saved" indicator | 16 |
| §4 Export EFT modal with a copy button; Clone; Delete | 16 |
| §4 nav item `Fitting` becomes live | 17 |
| §5 EFT export: section order, `[Empty X slot]`, `, <charge>`, `x N`, `/offline` | 4 |
| §5 EFT import: case-insensitive name resolution, unresolved reported not fatal, slot by marker effect, unrecognised → cargo | 4, 11 |
| §5 round-trip test `export(import(text)) ≡ text` | 4 |
| §6 `GET/POST /api/fits`, `GET/PUT/DELETE /api/fits/[id]` (items replaced wholesale) | 10 |
| §6 `POST /api/fits/import`, `/from-fitting`, `/from-asset` | 11 |
| §6 `GET /api/sde/types`, `/api/sde/market-groups`, `/api/market/prices` | 7, 8 |
| §6 prices: stale/absent ids fetched from Fuzzwork synchronously in chunks ≤ 500 and upserted | 8 |
| §6 all routes session-guarded by `proxy.ts`; 400 on malformed bodies; 404 on unknown ids | Global Constraints, 6–11 |
| §7 unknown type ids → `Unknown type (id)`, excluded from stats | 1, 13, 14 |
| §7 import reports unresolved lines under the textarea | 11, 17 |
| §7 API failures keep the local state and retry on the next change | 16 |
| §8 unit: EFT round trip, empty markers, `x N`, `/offline`, unknown names | 4 |
| §8 unit: slot assignment (first free, replace, over-count), charge compatibility | 3 |
| §8 unit: `serialize.ts` round trip; `FitDoc` → `Fit` derivation | 1, 5 |
| §8 DB: fits/fit_items repo (create, replace items, cascade delete) | 2 |
| §8 API: route handlers with mocked repos (validation, 404s) | 6–11 |
| §8 component: `FitEditor` with a fixture `DogmaData` — CPU gauge, problems, offline, All-V | 16 |
| §8 acceptance on the VM | 18 |
| §9 out of scope (DPS/tank/cap, projected effects, fleet boosts, abyssal, ESI push, other formats, comparison) | not implemented anywhere |

No spec requirement is left without a task.

**2. Placeholder scan.** No "TBD", no "similar to Task N", no "add error handling", no step that
describes without showing. Every code step carries complete code. The deliberately open values are
the acceptance commit message's `<n>` / `<x>` / `<build>` placeholders (Task 18 Step 8), which are
measurements the operator fills in, and `$COOKIE` in Task 18 Step 6, which is a secret the operator
supplies and must not be committed.

**3. Type consistency.** Traced end to end:
`FitItem` / `FitDoc` / `FitItemState` / `CARGO_FLAG` / `flagFor` / `stateName` (1) → the repo's
`FitRow` (2) → `slotGrid` / `fitTypeInto` (3) → `exportEft` / `assignEftItems` (4) →
`parseFitItems` (10) → `docItemsFromBuilt` in the clone builders (11) → `computeEditor` (13) →
`SlotLayout` (14) → `FitEditor` (16).
`DogmaMeta` / `DogmaMetaJson` / `DogmaTypesJson` / `serialiseMeta` / `deserialiseTypes` /
`dogmaDataFrom` (5) → the two routes (6) → the browser store (12) → `dogmaData()` (13, 15, 16).
`SlotTotals` / `slotTotals` / `slotGrid` / `SlotCell` (3) → `exportEft` (4) → `editorView` (13) →
`FitEditor`'s `result.totals` (16).
`EditorView` / `EditorSlotBlock` / `EditorSlotRow` / `EditorEntryRow` / `STATE_LABELS` /
`typeIconUrl` (13) → `SlotLayout`, `StatsPanel` (14) → `ItemBrowser` (15) → `FitEditor` (16).
`CloneOutcome` (11) → the three clone routes (11) → `FitList` (17).
`FittingIndex` / `FitListRow` / `CloneSource` (17) → `FitList` (17) → `/fitting/page.tsx` (17).
`parseIdList` (6) → the dogma types route (6) and the prices route (8).
`stalePriceIds` (8) → the prices route (8) → `pricesFor` (12).
Every phase-4 symbol consumed is quoted verbatim from the code as it stands on
`feature/phase4-ships`, not from the phase-4 plans' prose.

**4. Corrections made while writing this plan** (they matter to the executor):
- The SDE's **Rifter is 3 high / 3 mid / 4 low / 3 rig / 0 subsystem**, with 3 turret and 2 launcher
  hardpoints — not the 4-high, 2-low hull the spec's illustrative EFT block implies. The committed
  fixture and every expected number here use the real values.
- `defaultStateOfType` returns **Online** for a rig (it has no `online` effect but is not offline),
  so `allowedStates` must include the type's default state or the editor could render a state the
  toggle does not offer.
- The phase-4a barrel does **not** re-export `slotOfType`, `hardpointOfType`, `kindOfType`,
  `defaultStateOfType`, `CAN_FIT_SHIP_TYPE_ATTRS` or `CAN_FIT_SHIP_GROUP_ATTRS`. Tasks 1 and 15 add
  those re-exports; without them a client component would have to deep-import `./fit.js`.
- `serialiseDogmaData` / `deserialiseDogmaData` **already exist** in `src/lib/dogma/data.ts`. The
  spec's `serialize.ts` is therefore the meta/types *split*, not a second copy of them.

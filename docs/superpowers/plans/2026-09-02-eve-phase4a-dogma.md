# EVE Phase 4a (Dogma Fitting Engine) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A pure TypeScript dogma engine under `src/lib/dogma/` that reads the phase-2 `sde_*` tables once, models a fit as items with states, calculates every attribute the way EOS does (operator precedence, stacking penalties, skill-level recursion), and turns that into CPU/PG/calibration/slot/hardpoint statistics, a validation problem list and an "affected by" explanation — plus builders that turn phase-3 asset and fitting rows into fits.

**Architecture:** `src/lib/dogma/sde-loader.ts` is the **only** module that touches Postgres; it produces a plain `DogmaData` (four `Map`s) that everything else consumes. `data.ts` holds the ids, enums and SDE→engine mappings; `operators.ts` the normalisation and stacking-penalty kernel; `fit.ts` the item/fit model and the EOS domain table; `effects.ts` decides which effects are running on which carrier; `affection.ts` decides which items a running modifier reaches; `calc.ts` is the memoised recursive calculator; `stats.ts`, `validate.ts` and `build.ts` sit on top. Everything except `sde-loader.ts` is isomorphic so phase 5 can run it in the browser. Tests are hermetic: synthetic `DogmaData` for the algebra, committed JSON snapshots of the real SDE for the ship numbers.

**Tech Stack:** TypeScript 5.9 strict + ESM (local imports carry the `.js` extension), Node 24, `pg` 8, Postgres 17, vitest 4, tsx for CLI scripts. **No new dependencies.**

**Spec:** `docs/superpowers/specs/2026-09-01-eve-phase4-ships-fittings-design.md` — this plan implements **§2 (the whole engine)** and the engine half of **§7** (engine unit tests, fixtures, builder tests). §3 (market prices), §4 (UI), §5 (schema) and the deploy/acceptance work are **phase 4b**; every export phase 4b consumes is listed in the final section.

**Research (formulas, ids, fixtures — every number in this plan comes from here or from the dev database):** `docs/research/dogma-engine.md`, `docs/research/sde-format.md` §3.4/§3.7/§4.

## Global Constraints

- **The engine is pure and isomorphic.** Nothing under `src/lib/dogma/` may import `pg`, `node:*`, or anything from `src/lib/db/**` **as a value** — phase 5 runs this code in the browser. The single exception is `src/lib/dogma/sde-loader.ts`, which is the only I/O module. `build.ts` may use `import type { … }` from `src/lib/db/character-assets.js` / `character-fittings.js` (type-only imports are erased at compile time under `isolatedModules`), never a value import.
- **No `const enum`.** `isolatedModules` is on; use plain `enum` for `Operator` and `State`, string-literal unions everywhere else.
- **Follow EOS, not Pyfa,** everywhere except `maxGroupFitted`, which uses Pyfa's **raw** attribute value (research §7 divergence table; Pyfa's source comment records the in-game justification).
- **Never invent an attribute id, effect id or SDE value.** Every constant in this plan was read out of the dev database (`postgres://eve:eve@127.0.0.1:5432/eve`) or `.superpowers/research/sde-3484357.zip`. If a number is not in this plan, query for it — do not guess.
- **Fixture snapshots are generated from build 3484357.** `scripts/dogma-fixture.ts` reads the dev database; before regenerating, import `.superpowers/research/sde-3484357.zip` so the snapshot matches `tests/fixtures/sde-mini.zip`. Regenerating a snapshot is a test change, exactly like `sde-mini.zip`.
- **`tests/fixtures/sde-mini.zip` is NOT extended by this phase.** Its allow-list (types 587, 519, 3300, 3301, 3302, 3329, 3413, 3426, 34, 52678) already carries everything the loader's DB test needs.
- Imports between local TS files use the `.js` extension. `npm run typecheck` (`tsc --noEmit`) covers `tests/**` too and must stay clean.
- Tests live in `tests/dogma/**` (pure) and `tests/db/**` (Postgres). `npm test` = `vitest run` with `fileParallelism: false`. DB tests use `tests/db/helpers.ts` (`resetDb`, `resetSde`) against `eve_test` on the local compose Postgres (`postgres://eve:eve@127.0.0.1:5432/eve_test`; start it with `docker compose -f compose.dev.yml up -d`).
- **No network and no live database in `tests/dogma/**`.** Those tests read only the committed JSON snapshots and hand-built synthetic data.
- **Floating point.** The fitting numbers (`162.5`, `51.25`, `6.75`, `3.6`, `80.25`, `12.8`, `470`, `610`) are exact in
  IEEE-754 doubles and are asserted with `toBe()` — never weaken one of those to `toBeCloseTo` to make it pass; a
  mismatch means the maths is wrong. The stacking-penalty chain values are **not** exact (research quotes CPython's
  `PENALTY_BASE` = 0.8691199808003974, JavaScript computes 0.8691199808003977), so those are asserted with
  `toBeCloseTo(value, 10)` against the research §3.6 numbers.
- Work happens on branch `feature/phase4-ships`, branched from `main`. **Every task ends with a commit.** Commit trailer: `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- **No UI, no market prices, no schema for `market_prices`.** Those are phase 4b.
- VM: `ssh <user>@<host>`, site `https://eve.example.com`, Ansible in `deploy/ansible`. Nothing is deployed in this phase.

## File Structure

| Path | Responsibility |
|---|---|
| `src/lib/dogma/data.ts` | Ids, enums (`Operator`, `State`), `DogmaData`/`Modifier` shapes, SDE→engine mappings, hand-coded effects 3773/3774, JSON (de)serialisation |
| `src/lib/dogma/operators.ts` | `normalise`, `penalizeValues`, `isPenalizable`, `round2` |
| `src/lib/dogma/sde-loader.ts` | **The only I/O module.** `loadDogmaData(typeIds)` + memoisation, required-skill closure, column→attribute injection, build-time filtering |
| `src/lib/dogma/fit.ts` | `Item`, `Slotted`, `Fit`, the EOS domain table, slot/hardpoint markers, default state |
| `src/lib/dogma/effects.ts` | `effectRuns` (state gate + the three full-compliance rules), `activeModifiers` |
| `src/lib/dogma/affection.ts` | `affects` — which items a running modifier reaches |
| `src/lib/dogma/calc.ts` | `getAttr` (memo + cycle sentinel + cap + 2-dp rounding), `explain`, `clearMemo` |
| `src/lib/dogma/stats.ts` | `fitStats` |
| `src/lib/dogma/validate.ts` | `validateFit` — nine problem kinds, recursive skill prerequisites |
| `src/lib/dogma/build.ts` | `fitFromAssets`, `fitFromFitting`, `FitContext` |
| `src/lib/dogma/index.ts` | Barrel: the phase-4b/phase-5 surface |
| `src/lib/sde/ddl.ts` | **Modified**: `sde_dogma_attributes` gains `max_attribute_id`, `min_attribute_id` |
| `src/lib/sde/tables.ts` | **Modified**: the two new columns are mapped |
| `scripts/dogma-fixture.ts` | `npm run dogma:fixture` → `tests/fixtures/dogma/*.json` (the fixture definitions are the script's contract) |
| `package.json` | **Modified**: adds the `dogma:fixture` script |
| `tests/fixtures/dogma/rifter.json` | Committed snapshot: 53 types (Rifter fitting world + required-skill closure) |
| `tests/fixtures/dogma/tengu.json` | Committed snapshot: 18 types (T3 hull + offensive subsystem + closure) |
| `tests/dogma/fixture.ts` | `fixtureData(name)` — loads and revives a snapshot |
| `tests/dogma/synthetic.ts` | EOS-style `mkAttr` / `mkEffect` / `mkType` builders over an in-memory `DogmaData` |
| `tests/dogma/*.test.ts` | One test file per engine module |
| `tests/db/dogma-loader.test.ts` | Real-Postgres test for `loadDogmaData` |
| `tests/sde/tables.test.ts` | **Modified**: the dogma-attribute mapper assertion gains the two columns |

---

### Task 1: Branch and the dogma data model (`src/lib/dogma/data.ts`)

**Files:**
- Create: `src/lib/dogma/data.ts`, `tests/dogma/data.test.ts`

**Interfaces:**
- Consumes: nothing (this is the root of the engine).
- Produces:
```ts
export type AttrId = number; export type TypeId = number; export type EffectId = number; export type GroupId = number;
export enum Operator { PreAssign = 1, PreMul, PreDiv, ModAdd, ModSub, PostMul, PostMulImmune, PostDiv, PostPercent, PostAssign }
export enum State { Offline = 1, Online, Active, Overload }
export const OPERATOR_ORDER: readonly Operator[];
export type ModifierFunc = "ItemModifier" | "LocationModifier" | "LocationGroupModifier" | "LocationRequiredSkillModifier" | "OwnerRequiredSkillModifier";
export type ModifierDomain = "self" | "character" | "ship" | "other";
export interface Modifier { func: ModifierFunc; domain: ModifierDomain; modifiedAttrId: AttrId; modifyingAttrId: AttrId; operation: Operator; groupId?: GroupId; skillTypeId?: TypeId }
export interface DogmaAttribute { id: AttrId; name: string | null; defaultValue: number; stackable: boolean; highIsGood: boolean; maxAttributeId?: AttrId; minAttributeId?: AttrId }
export interface DogmaEffect { id: EffectId; categoryId: number; state: State; modifiers: Modifier[]; fittingUsageChanceAttrId?: AttrId }
export interface DogmaType { id: TypeId; groupId: GroupId; categoryId: number; name: string | null; attrs: Map<AttrId, number>; effects: Map<EffectId, boolean> }
export interface DogmaGroup { id: GroupId; name: string | null; categoryId: number }
export interface DogmaData { attributes: Map<AttrId, DogmaAttribute>; effects: Map<EffectId, DogmaEffect>; types: Map<TypeId, DogmaType>; groups: Map<GroupId, DogmaGroup> }
export const ATTR: {
  capacitorNeed: 6; mass: 4; powerOutput: 11; lowSlots: 12; medSlots: 13; hiSlots: 14; power: 30;
  capacity: 38; cpuOutput: 48; cpu: 50; launcherSlots: 101; turretSlots: 102; volume: 161; radius: 162;
  skillLevel: 280; upgradeCapacity: 1132; rigSlots: 1137; drawback: 1138; upgradeCost: 1153;
  maxSubSystems: 1367; turretHardPointModifier: 1368; launcherHardPointModifier: 1369;
  hiSlotModifier: 1374; medSlotModifier: 1375; lowSlotModifier: 1376; fitsToShipType: 1380;
  maxGroupFitted: 1544; rigSize: 1547;
};
export const EFFECT: {
  loPower: 11; hiPower: 12; medPower: 13; online: 16; launcherFitted: 40; turretFitted: 42;
  rigSlot: 2663; subSystem: 3772; hardPointModifier: 3773; slotModifier: 3774;
};
export const CATEGORY: { ship: 6; module: 7; charge: 8; skill: 16; drone: 18; implant: 20; subsystem: 32; fighter: 87 };
export const REQUIRED_SKILL_ATTRS: readonly (readonly [AttrId, AttrId])[];
export const CAN_FIT_SHIP_TYPE_ATTRS: readonly AttrId[];
export const CAN_FIT_SHIP_GROUP_ATTRS: readonly AttrId[];
export const PENALTY_IMMUNE_CATEGORY_IDS: ReadonlySet<number>;
export const ROUNDED_ATTR_IDS: ReadonlySet<AttrId>;
export const COLUMN_ATTRS: readonly (readonly [AttrId, "mass" | "capacity" | "volume" | "radius"])[];
export const ONLINE_EFFECT_CATEGORY_ID: number;
export const CUSTOM_EFFECT_MODIFIERS: ReadonlyMap<EffectId, readonly Modifier[]>;
export function operatorFromSde(op: number | null): Operator | null;
export function stateForEffectCategory(categoryId: number | null): State | null;
export function domainFromSde(domain: string | null): ModifierDomain | null;
export interface DogmaAttributeJson { id: AttrId; name: string | null; defaultValue: number; stackable: boolean; highIsGood: boolean; maxAttributeId?: AttrId; minAttributeId?: AttrId }
export interface DogmaEffectJson { id: EffectId; categoryId: number; state: State; modifiers: Modifier[]; fittingUsageChanceAttrId?: AttrId }
export interface DogmaTypeJson { id: TypeId; groupId: GroupId; categoryId: number; name: string | null; attrs: [AttrId, number][]; effects: [EffectId, boolean][] }
export interface DogmaDataJson { attributes: DogmaAttributeJson[]; effects: DogmaEffectJson[]; types: DogmaTypeJson[]; groups: DogmaGroup[] }
export function serialiseDogmaData(data: DogmaData): DogmaDataJson;
export function deserialiseDogmaData(json: DogmaDataJson): DogmaData;
```

**Decisions recorded here (do not re-litigate them):**
- The operator enum has **ten** members. `PostMulImmune = 7` is EOS's own slot (used only by the ancillary armour repairer) and is **never produced by `operatorFromSde`** — it exists so that ascending numeric order equals EOS's precedence order and `PostAssign` is 10 (research §2.3, "copy that trick").
- Effect categories **3 (area)** and **6 (dungeon)** have no state mapping; `stateForEffectCategory` returns `null` and the loader drops those effects (research §2.7).
- Effects **3773** and **3774** carry no `modifierInfo` in the SDE (verified: zero rows in `sde_dogma_effect_modifiers`); their modifiers are hand-coded here and injected by the loader (research §5.4).

- [ ] **Step 1: Create the branch**

```bash
cd /home/daniel/AI/Plasma/EVE
git checkout main && git pull --ff-only
git checkout -b feature/phase4-ships
docker compose -f compose.dev.yml up -d
```
Expected: on `feature/phase4-ships`, the `eve-dev-postgres` container running.

- [ ] **Step 2: Write the failing test**

Create `tests/dogma/data.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import {
  ATTR, CATEGORY, CAN_FIT_SHIP_GROUP_ATTRS, CAN_FIT_SHIP_TYPE_ATTRS, COLUMN_ATTRS, CUSTOM_EFFECT_MODIFIERS,
  EFFECT, ONLINE_EFFECT_CATEGORY_ID, OPERATOR_ORDER, Operator, PENALTY_IMMUNE_CATEGORY_IDS,
  REQUIRED_SKILL_ATTRS, ROUNDED_ATTR_IDS, State, deserialiseDogmaData, domainFromSde, operatorFromSde,
  serialiseDogmaData, stateForEffectCategory, type DogmaData,
} from "../../src/lib/dogma/data.js";

describe("operator enum", () => {
  it("is ordered so that ascending numeric order is precedence order", () => {
    expect(Operator.PreAssign).toBe(1);
    expect(Operator.PostAssign).toBe(10);
    expect([...OPERATOR_ORDER]).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(OPERATOR_ORDER.indexOf(Operator.ModAdd)).toBeLessThan(OPERATOR_ORDER.indexOf(Operator.PostPercent));
  });

  it("maps every SDE operation int that the engine honours", () => {
    expect(operatorFromSde(-1)).toBe(Operator.PreAssign);
    expect(operatorFromSde(0)).toBe(Operator.PreMul);
    expect(operatorFromSde(1)).toBe(Operator.PreDiv);
    expect(operatorFromSde(2)).toBe(Operator.ModAdd);
    expect(operatorFromSde(3)).toBe(Operator.ModSub);
    expect(operatorFromSde(4)).toBe(Operator.PostMul);
    expect(operatorFromSde(5)).toBe(Operator.PostDiv);
    expect(operatorFromSde(6)).toBe(Operator.PostPercent);
    expect(operatorFromSde(7)).toBe(Operator.PostAssign);
  });

  it("drops operation 9 (effect 132's skill-points→level op), unknown ints and null", () => {
    expect(operatorFromSde(9)).toBeNull();
    expect(operatorFromSde(8)).toBeNull();
    expect(operatorFromSde(null)).toBeNull();
  });

  it("never produces PostMulImmune, which is EOS's own slot", () => {
    for (const op of [-1, 0, 1, 2, 3, 4, 5, 6, 7]) expect(operatorFromSde(op)).not.toBe(Operator.PostMulImmune);
  });
});

describe("state", () => {
  it("ascends so `>=` gates effects", () => {
    expect(State.Offline).toBe(1);
    expect(State.Online).toBe(2);
    expect(State.Active).toBe(3);
    expect(State.Overload).toBe(4);
  });

  it("maps effect categories to the state that runs them", () => {
    expect(stateForEffectCategory(0)).toBe(State.Offline);
    expect(stateForEffectCategory(7)).toBe(State.Offline);
    expect(stateForEffectCategory(4)).toBe(State.Online);
    expect(stateForEffectCategory(1)).toBe(State.Active);
    expect(stateForEffectCategory(2)).toBe(State.Active);
    expect(stateForEffectCategory(5)).toBe(State.Overload);
  });

  it("has no mapping for area (3), dungeon (6), unknown or null", () => {
    expect(stateForEffectCategory(3)).toBeNull();
    expect(stateForEffectCategory(6)).toBeNull();
    expect(stateForEffectCategory(99)).toBeNull();
    expect(stateForEffectCategory(null)).toBeNull();
  });
});

describe("domains", () => {
  it("maps the four domains the engine supports", () => {
    expect(domainFromSde(null)).toBe("self");
    expect(domainFromSde("itemID")).toBe("self");
    expect(domainFromSde("charID")).toBe("character");
    expect(domainFromSde("shipID")).toBe("ship");
    expect(domainFromSde("otherID")).toBe("other");
  });

  it("drops projected and structure domains", () => {
    expect(domainFromSde("targetID")).toBeNull();
    expect(domainFromSde("target")).toBeNull();
    expect(domainFromSde("structureID")).toBeNull();
  });
});

describe("constants", () => {
  it("carries the verified fitting attribute ids", () => {
    expect(ATTR.cpu).toBe(50);
    expect(ATTR.power).toBe(30);
    expect(ATTR.cpuOutput).toBe(48);
    expect(ATTR.powerOutput).toBe(11);
    expect(ATTR.upgradeCapacity).toBe(1132);
    expect(ATTR.upgradeCost).toBe(1153);
    expect(ATTR.hiSlots).toBe(14);
    expect(ATTR.medSlots).toBe(13);
    expect(ATTR.lowSlots).toBe(12);
    expect(ATTR.rigSlots).toBe(1137);
    expect(ATTR.maxSubSystems).toBe(1367);
    expect(ATTR.turretSlots).toBe(102);
    expect(ATTR.launcherSlots).toBe(101);
    expect(ATTR.rigSize).toBe(1547);
    expect(ATTR.maxGroupFitted).toBe(1544);
    expect(ATTR.skillLevel).toBe(280);
    expect(ATTR.capacitorNeed).toBe(6);
    expect(ATTR.fitsToShipType).toBe(1380);
  });

  it("carries the verified marker effect ids", () => {
    expect(EFFECT).toEqual({
      loPower: 11, hiPower: 12, medPower: 13, online: 16, launcherFitted: 40, turretFitted: 42,
      rigSlot: 2663, subSystem: 3772, hardPointModifier: 3773, slotModifier: 3774,
    });
  });

  it("lists the six non-contiguous requiredSkill/level attribute pairs", () => {
    expect(REQUIRED_SKILL_ATTRS.map((p) => [...p])).toEqual([
      [182, 277], [183, 278], [184, 279], [1285, 1286], [1289, 1287], [1290, 1288],
    ]);
  });

  it("lists canFitShipType 1..12 and canFitShipGroup 01..20", () => {
    expect([...CAN_FIT_SHIP_TYPE_ATTRS]).toEqual([1302, 1303, 1304, 1305, 1944, 2103, 2463, 2486, 2487, 2488, 2758, 5948]);
    expect([...CAN_FIT_SHIP_GROUP_ATTRS]).toEqual([
      1298, 1299, 1300, 1301, 1872, 1879, 1880, 1881, 2065, 2396,
      2476, 2477, 2478, 2479, 2480, 2481, 2482, 2483, 2484, 2485,
    ]);
  });

  it("exempts ship, charge, skill, implant and subsystem carriers from the stacking penalty", () => {
    expect([...PENALTY_IMMUNE_CATEGORY_IDS].sort((a, b) => a - b)).toEqual([6, 8, 16, 20, 32]);
    expect(CATEGORY.module).toBe(7);
    expect(CATEGORY.drone).toBe(18);
    expect(PENALTY_IMMUNE_CATEGORY_IDS.has(CATEGORY.module)).toBe(false);
    expect(PENALTY_IMMUNE_CATEGORY_IDS.has(CATEGORY.drone)).toBe(false);
  });

  it("rounds exactly the four fitting attributes to 2 dp", () => {
    expect([...ROUNDED_ATTR_IDS].sort((a, b) => a - b)).toEqual([11, 30, 48, 50]);
  });

  it("injects the four sde_types columns as attributes", () => {
    expect(COLUMN_ATTRS.map((p) => [...p])).toEqual([[4, "mass"], [38, "capacity"], [161, "volume"], [162, "radius"]]);
  });

  it("patches the online effect into the online category", () => {
    expect(ONLINE_EFFECT_CATEGORY_ID).toBe(4);
  });
});

describe("hand-coded subsystem effects", () => {
  it("gives 3774 the three slot adds and 3773 the two hardpoint adds", () => {
    expect(CUSTOM_EFFECT_MODIFIERS.get(3774)!.map((m) => ({ ...m }))).toEqual([
      { func: "ItemModifier", domain: "ship", modifiedAttrId: 14, modifyingAttrId: 1374, operation: Operator.ModAdd },
      { func: "ItemModifier", domain: "ship", modifiedAttrId: 13, modifyingAttrId: 1375, operation: Operator.ModAdd },
      { func: "ItemModifier", domain: "ship", modifiedAttrId: 12, modifyingAttrId: 1376, operation: Operator.ModAdd },
    ]);
    expect(CUSTOM_EFFECT_MODIFIERS.get(3773)!.map((m) => ({ ...m }))).toEqual([
      { func: "ItemModifier", domain: "ship", modifiedAttrId: 102, modifyingAttrId: 1368, operation: Operator.ModAdd },
      { func: "ItemModifier", domain: "ship", modifiedAttrId: 101, modifyingAttrId: 1369, operation: Operator.ModAdd },
    ]);
    expect([...CUSTOM_EFFECT_MODIFIERS.keys()].sort((a, b) => a - b)).toEqual([3773, 3774]);
  });
});

describe("json round trip", () => {
  const data: DogmaData = {
    attributes: new Map([
      [50, { id: 50, name: "cpu", defaultValue: 0, stackable: true, highIsGood: false }],
      [37, { id: 37, name: "maxVelocity", defaultValue: 0, stackable: false, highIsGood: true, maxAttributeId: 2033 }],
    ]),
    effects: new Map([
      [397, {
        id: 397, categoryId: 0, state: State.Offline,
        modifiers: [{ func: "ItemModifier", domain: "ship", modifiedAttrId: 48, modifyingAttrId: 424, operation: Operator.PostPercent }],
      }],
      [16, { id: 16, categoryId: 4, state: State.Online, modifiers: [], fittingUsageChanceAttrId: 1234 }],
    ]),
    types: new Map([[587, {
      id: 587, groupId: 25, categoryId: 6, name: "Rifter",
      attrs: new Map([[48, 130], [11, 41]]), effects: new Map([[5779, false], [7248, true]]),
    }]]),
    groups: new Map([[25, { id: 25, name: "Frigate", categoryId: 6 }]]),
  };

  it("survives JSON.stringify → JSON.parse → deserialise unchanged", () => {
    const round = deserialiseDogmaData(JSON.parse(JSON.stringify(serialiseDogmaData(data))));
    expect(round.attributes.get(37)).toEqual(data.attributes.get(37));
    expect(round.attributes.get(50)!.maxAttributeId).toBeUndefined();
    expect(round.effects.get(397)).toEqual(data.effects.get(397));
    expect(round.effects.get(16)!.fittingUsageChanceAttrId).toBe(1234);
    expect(round.types.get(587)!.attrs.get(48)).toBe(130);
    expect(round.types.get(587)!.effects.get(7248)).toBe(true);
    expect(round.groups.get(25)).toEqual({ id: 25, name: "Frigate", categoryId: 6 });
  });

  it("serialises maps as arrays so the snapshot is plain JSON", () => {
    const json = serialiseDogmaData(data);
    expect(Array.isArray(json.types)).toBe(true);
    expect(json.types[0].attrs).toEqual([[48, 130], [11, 41]]);
    expect(json.types[0].effects).toEqual([[5779, false], [7248, true]]);
  });
});
```

- [ ] **Step 3: Run the test and watch it fail**

Run: `npx vitest run tests/dogma/data.test.ts`
Expected: FAIL — `Failed to resolve import "../../src/lib/dogma/data.js"`.

- [ ] **Step 4: Write `src/lib/dogma/data.ts`**

```ts
/**
 * The dogma data model: ids, enums and the SDE→engine mappings.
 *
 * Pure and isomorphic. Nothing under src/lib/dogma may import node: or pg except sde-loader.ts —
 * phase 5 runs this engine in the browser.
 *
 * Every id here was verified against the SDE (docs/research/dogma-engine.md §5.1/§5.2).
 */

export type AttrId = number;
export type TypeId = number;
export type EffectId = number;
export type GroupId = number;

/**
 * Ascending numeric order === operator precedence, copied from EOS (eos/const/eos.py).
 * PostMulImmune is EOS's own slot (the ancillary armour repairer); the SDE never produces it,
 * but keeping it here means PostAssign is 10 and the ordering matches EOS one-for-one.
 */
export enum Operator {
  PreAssign = 1,
  PreMul = 2,
  PreDiv = 3,
  ModAdd = 4,
  ModSub = 5,
  PostMul = 6,
  PostMulImmune = 7,
  PostDiv = 8,
  PostPercent = 9,
  PostAssign = 10,
}

/** Ascending so an item in state X runs every effect whose required state is <= X. */
export enum State {
  Offline = 1,
  Online = 2,
  Active = 3,
  Overload = 4,
}

/** The order the calculator applies operator buckets in. */
export const OPERATOR_ORDER: readonly Operator[] = [
  Operator.PreAssign, Operator.PreMul, Operator.PreDiv, Operator.ModAdd, Operator.ModSub,
  Operator.PostMul, Operator.PostMulImmune, Operator.PostDiv, Operator.PostPercent, Operator.PostAssign,
];

export type ModifierFunc =
  | "ItemModifier"
  | "LocationModifier"
  | "LocationGroupModifier"
  | "LocationRequiredSkillModifier"
  | "OwnerRequiredSkillModifier";

export type ModifierDomain = "self" | "character" | "ship" | "other";

export interface Modifier {
  func: ModifierFunc;
  domain: ModifierDomain;
  modifiedAttrId: AttrId;
  /** The magnitude source, read as the *fully calculated* value on the carrier item. */
  modifyingAttrId: AttrId;
  operation: Operator;
  /** LocationGroupModifier only. */
  groupId?: GroupId;
  /** LocationRequiredSkillModifier / OwnerRequiredSkillModifier only. */
  skillTypeId?: TypeId;
}

export interface DogmaAttribute {
  id: AttrId;
  name: string | null;
  defaultValue: number;
  stackable: boolean;
  highIsGood: boolean;
  maxAttributeId?: AttrId;
  /** Loaded for completeness; the calculator implements only the upper cap (research §2.6). */
  minAttributeId?: AttrId;
}

export interface DogmaEffect {
  id: EffectId;
  categoryId: number;
  state: State;
  modifiers: Modifier[];
  fittingUsageChanceAttrId?: AttrId;
}

export interface DogmaType {
  id: TypeId;
  groupId: GroupId;
  categoryId: number;
  name: string | null;
  attrs: Map<AttrId, number>;
  /** effectId → isDefault */
  effects: Map<EffectId, boolean>;
}

export interface DogmaGroup {
  id: GroupId;
  name: string | null;
  categoryId: number;
}

export interface DogmaData {
  attributes: Map<AttrId, DogmaAttribute>;
  effects: Map<EffectId, DogmaEffect>;
  types: Map<TypeId, DogmaType>;
  groups: Map<GroupId, DogmaGroup>;
}

export const ATTR = {
  capacitorNeed: 6,
  mass: 4,
  powerOutput: 11,
  lowSlots: 12,
  medSlots: 13,
  hiSlots: 14,
  power: 30,
  capacity: 38,
  cpuOutput: 48,
  cpu: 50,
  launcherSlots: 101,
  turretSlots: 102,
  volume: 161,
  radius: 162,
  skillLevel: 280,
  upgradeCapacity: 1132,
  rigSlots: 1137,
  drawback: 1138,
  upgradeCost: 1153,
  maxSubSystems: 1367,
  turretHardPointModifier: 1368,
  launcherHardPointModifier: 1369,
  hiSlotModifier: 1374,
  medSlotModifier: 1375,
  lowSlotModifier: 1376,
  fitsToShipType: 1380,
  maxGroupFitted: 1544,
  rigSize: 1547,
} as const;

export const EFFECT = {
  loPower: 11,
  hiPower: 12,
  medPower: 13,
  online: 16,
  launcherFitted: 40,
  turretFitted: 42,
  rigSlot: 2663,
  subSystem: 3772,
  hardPointModifier: 3773,
  slotModifier: 3774,
} as const;

export const CATEGORY = {
  ship: 6,
  module: 7,
  charge: 8,
  skill: 16,
  drone: 18,
  implant: 20,
  subsystem: 32,
  fighter: 87,
} as const;

/**
 * requiredSkillN → requiredSkillNLevel. There are exactly six, the ids are non-contiguous, and for
 * n = 5/6 the level id is numerically *below* the skill id. Never derive levelId = skillId + 1.
 */
export const REQUIRED_SKILL_ATTRS: readonly (readonly [AttrId, AttrId])[] = [
  [182, 277], [183, 278], [184, 279], [1285, 1286], [1289, 1287], [1290, 1288],
];

/** canFitShipType1..12 (1-digit, unpadded). */
export const CAN_FIT_SHIP_TYPE_ATTRS: readonly AttrId[] =
  [1302, 1303, 1304, 1305, 1944, 2103, 2463, 2486, 2487, 2488, 2758, 5948];

/** canFitShipGroup01..20 (2-digit, zero-padded). */
export const CAN_FIT_SHIP_GROUP_ATTRS: readonly AttrId[] = [
  1298, 1299, 1300, 1301, 1872, 1879, 1880, 1881, 2065, 2396,
  2476, 2477, 2478, 2479, 2480, 2481, 2482, 2483, 2484, 2485,
];

/** Ship, Charge, Skill, Implant (incl. boosters) and Subsystem carriers never penalise. */
export const PENALTY_IMMUNE_CATEGORY_IDS: ReadonlySet<number> = new Set([6, 8, 16, 20, 32]);

/** cpu, power, cpuOutput, powerOutput — the 2-dp rounding is the fitting tolerance. */
export const ROUNDED_ATTR_IDS: ReadonlySet<AttrId> = new Set([
  ATTR.cpu, ATTR.power, ATTR.cpuOutput, ATTR.powerOutput,
]);

/** sde_types columns that must be injected as dogma attributes (research §4.5). */
export const COLUMN_ATTRS: readonly (readonly [AttrId, "mass" | "capacity" | "volume" | "radius"])[] = [
  [ATTR.mass, "mass"], [ATTR.capacity, "capacity"], [ATTR.volume, "volume"], [ATTR.radius, "radius"],
];

/**
 * The SDE files `online` (16) under effectCategoryID 1 (active); the client treats it as online.
 * EVEShipFit patches the category, EOS special-cases the id — we patch, which is the cleaner fix
 * for a fresh implementation (research §7). Without the patch every online-category effect on
 * every module would be permanently suppressed by full-compliance rule 2.
 */
export const ONLINE_EFFECT_CATEGORY_ID = 4;

/**
 * Effects 3773 and 3774 have no modifierInfo in the SDE (verified: zero rows in
 * sde_dogma_effect_modifiers). Both engines hand-code them; these are EOS's exact modifiers
 * (eos/eve_obj/custom/subsystem_slot_bonus/modifier.py, research §5.4).
 */
export const CUSTOM_EFFECT_MODIFIERS: ReadonlyMap<EffectId, readonly Modifier[]> = new Map([
  [EFFECT.slotModifier, [
    { func: "ItemModifier", domain: "ship", modifiedAttrId: ATTR.hiSlots, modifyingAttrId: ATTR.hiSlotModifier, operation: Operator.ModAdd },
    { func: "ItemModifier", domain: "ship", modifiedAttrId: ATTR.medSlots, modifyingAttrId: ATTR.medSlotModifier, operation: Operator.ModAdd },
    { func: "ItemModifier", domain: "ship", modifiedAttrId: ATTR.lowSlots, modifyingAttrId: ATTR.lowSlotModifier, operation: Operator.ModAdd },
  ]],
  [EFFECT.hardPointModifier, [
    { func: "ItemModifier", domain: "ship", modifiedAttrId: ATTR.turretSlots, modifyingAttrId: ATTR.turretHardPointModifier, operation: Operator.ModAdd },
    { func: "ItemModifier", domain: "ship", modifiedAttrId: ATTR.launcherSlots, modifyingAttrId: ATTR.launcherHardPointModifier, operation: Operator.ModAdd },
  ]],
] satisfies [EffectId, Modifier[]][]);

const SDE_OPERATIONS: ReadonlyMap<number, Operator> = new Map([
  [-1, Operator.PreAssign], [0, Operator.PreMul], [1, Operator.PreDiv], [2, Operator.ModAdd],
  [3, Operator.ModSub], [4, Operator.PostMul], [5, Operator.PostDiv], [6, Operator.PostPercent],
  [7, Operator.PostAssign],
]);

/**
 * `9` occurs exactly once (effect 132, skill points → skill level). We seed skillLevel from the
 * character sheet, so it is a no-op for us — dropped, along with anything unrecognised.
 */
export function operatorFromSde(op: number | null): Operator | null {
  if (op === null) return null;
  return SDE_OPERATIONS.get(op) ?? null;
}

const EFFECT_CATEGORY_STATES: ReadonlyMap<number, State> = new Map([
  [0, State.Offline], [7, State.Offline], [4, State.Online],
  [1, State.Active], [2, State.Active], [5, State.Overload],
]);

/** Categories 3 (area) and 6 (dungeon) have no mapping and no guard in EOS — drop those effects. */
export function stateForEffectCategory(categoryId: number | null): State | null {
  if (categoryId === null) return null;
  return EFFECT_CATEGORY_STATES.get(categoryId) ?? null;
}

const SDE_DOMAINS: ReadonlyMap<string, ModifierDomain> = new Map<string, ModifierDomain>([
  ["itemID", "self"], ["charID", "character"], ["shipID", "ship"], ["otherID", "other"],
]);

/** `targetID`/`target` are projected-only and `structureID` has no EOS equivalent — all dropped. */
export function domainFromSde(domain: string | null): ModifierDomain | null {
  if (domain === null) return "self";
  return SDE_DOMAINS.get(domain) ?? null;
}

export interface DogmaAttributeJson {
  id: AttrId; name: string | null; defaultValue: number; stackable: boolean; highIsGood: boolean;
  maxAttributeId?: AttrId; minAttributeId?: AttrId;
}
export interface DogmaEffectJson {
  id: EffectId; categoryId: number; state: State; modifiers: Modifier[]; fittingUsageChanceAttrId?: AttrId;
}
export interface DogmaTypeJson {
  id: TypeId; groupId: GroupId; categoryId: number; name: string | null;
  attrs: [AttrId, number][]; effects: [EffectId, boolean][];
}
export interface DogmaDataJson {
  attributes: DogmaAttributeJson[];
  effects: DogmaEffectJson[];
  types: DogmaTypeJson[];
  groups: DogmaGroup[];
}

/** Maps are not JSON-representable; snapshots store them as entry arrays. */
export function serialiseDogmaData(data: DogmaData): DogmaDataJson {
  return {
    attributes: [...data.attributes.values()],
    effects: [...data.effects.values()],
    types: [...data.types.values()].map((t) => ({
      id: t.id, groupId: t.groupId, categoryId: t.categoryId, name: t.name,
      attrs: [...t.attrs.entries()], effects: [...t.effects.entries()],
    })),
    groups: [...data.groups.values()],
  };
}

export function deserialiseDogmaData(json: DogmaDataJson): DogmaData {
  return {
    attributes: new Map(json.attributes.map((a) => [a.id, a])),
    effects: new Map(json.effects.map((e) => [e.id, e])),
    types: new Map(json.types.map((t) => [t.id, {
      id: t.id, groupId: t.groupId, categoryId: t.categoryId, name: t.name,
      attrs: new Map(t.attrs), effects: new Map(t.effects),
    }])),
    groups: new Map(json.groups.map((g) => [g.id, g])),
  };
}
```

- [ ] **Step 5: Run the test and the type checker**

Run: `npx vitest run tests/dogma/data.test.ts && npm run typecheck`
Expected: PASS (all tests green), typecheck clean.

- [ ] **Step 6: Commit**

```bash
git add src/lib/dogma/data.ts tests/dogma/data.test.ts
git commit -m "feat(dogma): data model, operator/state enums and SDE mappings

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Operator normalisation and the stacking penalty (`src/lib/dogma/operators.ts`)

**Files:**
- Create: `src/lib/dogma/operators.ts`, `tests/dogma/operators.test.ts`

**Interfaces:**
- Consumes: Task 1 `Operator`, `AttrId` from `src/lib/dogma/data.js`.
- Produces:
```ts
export const PENALTY_BASE: number;                              // 1 / exp((1/2.67)^2)
export const PENALIZABLE_OPERATORS: ReadonlySet<Operator>;      // PreMul, PreDiv, PostMul, PostDiv, PostPercent
export function isPenalizable(op: Operator): boolean;
export function normalise(op: Operator, v: number): number | null;   // null = un-appliable (÷0)
export function penalizeValues(modValues: number[]): number;    // reduced multiplier in, reduced multiplier out
export function round2(v: number): number;
```

**The maths (research §3.1–§3.3, §6.4) — reproduce exactly:**

| operator | normalise `v` → | applied by the calculator as |
|---|---|---|
| PreAssign / PostAssign | `v` | replace |
| PreMul / PostMul / PostMulImmune | `v - 1` | `acc *= 1 + n` |
| PreDiv / PostDiv | `1/v - 1`, or `null` when `v === 0` | `acc *= 1 + n` |
| ModAdd | `v` | `acc += n` |
| ModSub | `-v` | `acc += n` |
| PostPercent | `v / 100` | `acc *= 1 + n` |

- [ ] **Step 1: Write the failing test**

Create `tests/dogma/operators.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { Operator } from "../../src/lib/dogma/data.js";
import {
  PENALIZABLE_OPERATORS, PENALTY_BASE, isPenalizable, normalise, penalizeValues, round2,
} from "../../src/lib/dogma/operators.js";

/** How the calculator applies a bucket — mirrored here so the fixtures read like EOS's. */
function applyPercent(base: number, percents: number[], penalised: boolean): number {
  const values = percents.map((p) => normalise(Operator.PostPercent, p)!);
  if (penalised) return base * (1 + penalizeValues(values));
  return values.reduce((acc, n) => acc * (1 + n), base);
}

describe("normalise", () => {
  it("normalises every operator", () => {
    expect(normalise(Operator.PreAssign, 42)).toBe(42);
    expect(normalise(Operator.PostAssign, 42)).toBe(42);
    expect(normalise(Operator.PreMul, 2)).toBe(1);
    expect(normalise(Operator.PostMul, 1.5)).toBe(0.5);
    expect(normalise(Operator.PostMulImmune, 1.5)).toBe(0.5);
    expect(normalise(Operator.PreDiv, 4)).toBe(-0.75);
    expect(normalise(Operator.PostDiv, 2)).toBe(-0.5);
    expect(normalise(Operator.ModAdd, 7)).toBe(7);
    expect(normalise(Operator.ModSub, 7)).toBe(-7);
    expect(normalise(Operator.PostPercent, -25)).toBe(-0.25);
    expect(normalise(Operator.PostPercent, 400)).toBe(4);
  });

  it("returns null rather than Infinity for a division by zero", () => {
    expect(normalise(Operator.PreDiv, 0)).toBeNull();
    expect(normalise(Operator.PostDiv, 0)).toBeNull();
  });
});

describe("penalisable operators", () => {
  it("is exactly the five percentage-style operators", () => {
    expect([...PENALIZABLE_OPERATORS].sort((a, b) => a - b)).toEqual([
      Operator.PreMul, Operator.PreDiv, Operator.PostMul, Operator.PostDiv, Operator.PostPercent,
    ].sort((a, b) => a - b));
    expect(isPenalizable(Operator.PostPercent)).toBe(true);
    expect(isPenalizable(Operator.ModAdd)).toBe(false);
    expect(isPenalizable(Operator.ModSub)).toBe(false);
    expect(isPenalizable(Operator.PreAssign)).toBe(false);
    expect(isPenalizable(Operator.PostAssign)).toBe(false);
    expect(isPenalizable(Operator.PostMulImmune)).toBe(false);
  });
});

describe("penalizeValues", () => {
  it("uses the EVE University penalty curve", () => {
    expect(PENALTY_BASE).toBeCloseTo(0.8691199808003974, 15);
    const s = (i: number) => PENALTY_BASE ** (i * i);
    expect(s(0)).toBe(1);
    expect(s(1)).toBeCloseTo(0.8691199808, 10);
    expect(s(2)).toBeCloseTo(0.5705831435, 10);
    expect(s(3)).toBeCloseTo(0.2829551540, 10);
    expect(s(4)).toBeCloseTo(0.1059926497, 10);
  });

  it("reproduces EOS's five-postPercent fixture", () => {
    // EOS tests/integration/calculator/mod_operator/test_post_percent.py
    expect(applyPercent(100, [20, 50, -90, -25, 400], false)).toBeCloseTo(67.5, 10);
    expect(applyPercent(100, [20, 50, -90, -25, 400], true)).toBeCloseTo(62.549783181488586, 10);
  });

  it("reproduces the +10% ladder (research §3.6)", () => {
    expect(applyPercent(100, [10], true)).toBeCloseTo(110.0, 10);
    expect(applyPercent(100, [10, 10], true)).toBeCloseTo(119.56031978880436, 10);
    expect(applyPercent(100, [10, 10, 10], true)).toBeCloseTo(126.38223009922673, 10);
    expect(applyPercent(100, [10, 10, 10, 10], true)).toBeCloseTo(129.95828043757973, 10);
    expect(applyPercent(100, [10, 10, 10, 10, 10], true)).toBeCloseTo(131.3357426875382, 10);
    expect(applyPercent(100, [20, 10], true)).toBeCloseTo(130.42943976960476, 10);
  });

  it("reproduces the −10% ladder", () => {
    expect(applyPercent(100, [-10], true)).toBeCloseTo(90.0, 10);
    expect(applyPercent(100, [-10, -10], true)).toBeCloseTo(82.17792017279642, 10);
    expect(applyPercent(100, [-10, -10, -10], true)).toBeCloseTo(77.48898657086102, 10);
  });

  it("runs positive and negative as two independent chains, each starting at full strength", () => {
    // 1.1 × 0.9 — both are the first entry of their own chain, so neither is reduced.
    expect(applyPercent(100, [10, -10], true)).toBeCloseTo(99, 10);
  });

  it("sorts strongest first regardless of input order", () => {
    expect(penalizeValues([0.1, 0.5, 0.2])).toBeCloseTo(penalizeValues([0.5, 0.2, 0.1]), 15);
    expect(penalizeValues([-0.1, -0.5])).toBeCloseTo(penalizeValues([-0.5, -0.1]), 15);
  });

  it("puts zero in the positive chain", () => {
    expect(penalizeValues([0])).toBe(0);
    expect(penalizeValues([])).toBe(0);
  });

  it("truncates hard after index 10 — the twelfth modifier is dropped, not merely negligible", () => {
    const eleven = Array<number>(11).fill(0.1);
    const twelve = Array<number>(12).fill(0.1);
    expect(penalizeValues(twelve)).toBe(penalizeValues(eleven));
  });
});

describe("round2", () => {
  it("rounds to two decimal places", () => {
    expect(round2(162.5)).toBe(162.5);
    expect(round2(80.25000000000001)).toBe(80.25);
    expect(round2(250.00000000000003)).toBe(250);
    expect(round2(6.754)).toBe(6.75);
    expect(round2(6.755)).toBe(6.76);
    expect(round2(-1.005)).toBe(-1);
  });
});
```

- [ ] **Step 2: Run the test and watch it fail**

Run: `npx vitest run tests/dogma/operators.test.ts`
Expected: FAIL — `Failed to resolve import "../../src/lib/dogma/operators.js"`.

- [ ] **Step 3: Write `src/lib/dogma/operators.ts`**

```ts
/**
 * Operator normalisation and the stacking-penalty kernel.
 *
 * Three independent implementations (EOS eos/calculator/map.py, Pyfa
 * eos/modifiedAttributeDict.py:426, EVEShipFit src/calculate/pass_3.rs) agree exactly; this is a
 * transliteration of EOS's. See docs/research/dogma-engine.md §3.
 */
import { Operator } from "./data.js";

/** 1 / e^((1/2.67)^2) === e^(-(1/2.67)^2). The n-th modifier is scaled by PENALTY_BASE^(n^2). */
export const PENALTY_BASE = 1 / Math.exp((1 / 2.67) ** 2);

/**
 * Only percentage-style operators penalise. `+1 warp core strength` / `+1000 structure HP` are
 * ModAdd, which is exactly why the wiki says they do not stack-penalise.
 */
export const PENALIZABLE_OPERATORS: ReadonlySet<Operator> = new Set([
  Operator.PreMul, Operator.PreDiv, Operator.PostMul, Operator.PostDiv, Operator.PostPercent,
]);

export function isPenalizable(op: Operator): boolean {
  return PENALIZABLE_OPERATORS.has(op);
}

/**
 * Turn a raw carrier attribute value into the *reduced* form the calculator applies.
 * Returns null when the modifier cannot be applied at all: Python raises ZeroDivisionError where
 * JavaScript would silently produce Infinity, so a divide-by-zero is dropped instead.
 */
export function normalise(op: Operator, v: number): number | null {
  switch (op) {
    case Operator.PreAssign:
    case Operator.PostAssign:
    case Operator.ModAdd:
      return v;
    case Operator.ModSub:
      return -v;
    case Operator.PreMul:
    case Operator.PostMul:
    case Operator.PostMulImmune:
      return v - 1;
    case Operator.PreDiv:
    case Operator.PostDiv:
      return v === 0 ? null : 1 / v - 1;
    case Operator.PostPercent:
      return v / 100;
  }
}

/**
 * Collapse a bucket of penalised reduced multipliers into one.
 * Positive and negative form two independent chains, each sorted strongest-first and indexed from
 * zero, so a fit with three +10% and three −10% modules gets *two* full-strength first modifiers.
 * The twelfth entry of a chain (index 11) is dropped outright.
 */
export function penalizeValues(modValues: number[]): number {
  const positive: number[] = [];
  const negative: number[] = [];
  for (const v of modValues) (v >= 0 ? positive : negative).push(v);
  positive.sort((a, b) => b - a);
  negative.sort((a, b) => a - b);
  let value = 1;
  for (const chain of [positive, negative]) {
    let chainValue = 1;
    for (let i = 0; i < chain.length; i++) {
      if (i > 10) break;
      chainValue *= 1 + chain[i] * PENALTY_BASE ** (i * i);
    }
    value *= chainValue;
  }
  return value - 1;
}

/** The 2-dp rounding EOS applies to cpu/power/cpuOutput/powerOutput — it *is* the fit tolerance. */
export function round2(v: number): number {
  return Math.round(v * 100) / 100;
}
```

- [ ] **Step 4: Run the test and the type checker**

Run: `npx vitest run tests/dogma/operators.test.ts && npm run typecheck`
Expected: PASS, typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add src/lib/dogma/operators.ts tests/dogma/operators.test.ts
git commit -m "feat(dogma): operator normalisation and stacking penalty kernel

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: The SDE loader (`src/lib/dogma/sde-loader.ts`) and the two new attribute columns

**Files:**
- Create: `src/lib/dogma/sde-loader.ts`, `tests/db/dogma-loader.test.ts`
- Modify: `src/lib/sde/ddl.ts` (the `sde_dogma_attributes` body), `src/lib/sde/tables.ts` (the dogma-attribute mapper), `tests/sde/tables.test.ts` (its assertion gains two columns)

**Interfaces:**
- Consumes: Task 1 `data.ts` (all of it); phase-1 `getPool()` from `src/lib/db/client.js`; phase-2 `sde_dogma_attributes`, `sde_dogma_effects`, `sde_dogma_effect_modifiers`, `sde_groups`, `sde_types`, `sde_type_attributes`, `sde_type_effects`.
- Produces:
```ts
export function loadDogmaData(typeIds: TypeId[]): Promise<DogmaData>;
export function resetDogmaCache(): void;      // tests only
```

**Why the DDL changes.** `DogmaAttribute` carries `maxAttributeId`/`minAttributeId` (spec §2.1) and the
calculator caps by `maxAttributeId` (spec §2.3 step 6), but phase 2 never imported those two SDE fields.
Only 29 attributes have `maxAttributeID` and 8 have `minAttributeID`, and none is fitting-related — but
without the columns the cap is unreachable dead code. `sdeDdl()` is `CREATE TABLE IF NOT EXISTS`, so an
existing `public.sde_dogma_attributes` does **not** gain the columns on migrate; the importer builds its
staging schema from scratch and swaps it in, so **the columns appear after the next `npm run sde:import`**.

**What the loader does (spec §2.1, research §2.2/§2.7/§4.5/§7):**
- Attributes, effects (+ their modifiers) and groups are read **once per process** and memoised; types are
  memoised per id. `resetDogmaCache()` exists for tests.
- `loadDogmaData(typeIds)` returns the requested types **plus the transitive closure of their
  `requiredSkillN` attributes**, so `validateFit`'s recursive prerequisite expansion always has the skill
  types it needs. Ids the SDE does not know are skipped silently (spec §6).
- Injects `mass` 4, `capacity` 38, `volume` 161, `radius` 162 from the `sde_types` columns; a value already
  present in `typeDogma` wins.
- Drops: effects whose category has no state (3 area, 6 dungeon); modifiers with domain `targetID`/`target`/
  `structureID`; `EffectStopper` rows; `operation` 9 (and any unrecognised int); modifiers missing either
  attribute id.
- **Patches effect 16 `online` from effectCategoryID 1 to 4.** The SDE files it as *active*; every
  online-category effect on every module depends on `online` running, and full-compliance rule 3 would
  suppress it forever (it is never a type's default effect). EVEShipFit patches the same way.
- Injects `CUSTOM_EFFECT_MODIFIERS` into effects 3773/3774, which have no `modifierInfo` in the SDE.

- [ ] **Step 1: Add the two columns to the DDL**

In `src/lib/sde/ddl.ts`, inside `TABLE_BODIES.sde_dogma_attributes`, replace the last line
`    icon_id           int`
with:
```
    icon_id           int,
    max_attribute_id  int,
    min_attribute_id  int
```

- [ ] **Step 2: Map the two columns in the importer**

In `src/lib/sde/tables.ts`, in the `sde_dogma_attributes` entry, replace the `columns` and `map` bodies with:
```ts
    columns: cols({
      id: "int", name: "text", display_name: "text", description: "text", category_id: "int",
      unit_id: "int", data_type: "int", default_value: "float8", high_is_good: "bool",
      stackable: "bool", published: "bool", display_when_zero: "bool", icon_id: "int",
      max_attribute_id: "int", min_attribute_id: "int",
    }),
    map: (r) => [
      int(r._key), en(r.name), en(r.displayName), en(r.description), int(r.attributeCategoryID),
      int(r.unitID), int(r.dataType), num(r.defaultValue), bool(r.highIsGood),
      bool(r.stackable), bool(r.published), bool(r.displayWhenZero), int(r.iconID),
      int(r.maxAttributeID), int(r.minAttributeID),
    ],
```

- [ ] **Step 3: Update and extend the mapper test**

In `tests/sde/tables.test.ts`, inside `describe("dogma", …)`, replace the attribute-64 test with these three:
```ts
  it("maps attribute 64, whose description is a plain string and whose stackable is false", async () => {
    expect(await row("sde_dogma_attributes", "dogmaAttributes.jsonl", 64)).toEqual([
      64, "damageMultiplier", "Damage Modifier", "Damage multiplier.", 29, 104, 5, 1, true, false, true, false, 1432,
      null, null,
    ]);
  });

  it("maps attribute 37's maxAttributeID (the calculator's upper cap)", async () => {
    expect(await row("sde_dogma_attributes", "dogmaAttributes.jsonl", 37)).toEqual([
      37, "maxVelocity", "Maximum Velocity", "Maximum velocity of ship", 17, null, 4, 0, true, false, true, false,
      1389, 2033, null,
    ]);
  });

  it("maps attribute 20's minAttributeID", async () => {
    expect(await row("sde_dogma_attributes", "dogmaAttributes.jsonl", 20)).toEqual([
      20, "speedFactor", "Maximum Velocity Bonus", "Factor by which topspeed increases.", 28, 124, 5, 1, true, false,
      true, false, 1389, null, 2266,
    ]);
  });
```

- [ ] **Step 4: Write the failing loader test**

Create `tests/db/dogma-loader.test.ts`:
```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Pool } from "pg";
import { resetDb, resetSde } from "./helpers.js";
import { closePool } from "../../src/lib/db/client.js";
import { importSde } from "../../src/lib/sde/import.js";
import { FIXTURE_ZIP } from "../sde/fixture.js";
import { loadDogmaData, resetDogmaCache } from "../../src/lib/dogma/sde-loader.js";
import { ATTR, Operator, State, type DogmaData } from "../../src/lib/dogma/data.js";

let pool: Pool;
let data: DogmaData;

beforeAll(async () => {
  pool = await resetDb();
  await resetSde(pool);
  await importSde(FIXTURE_ZIP, pool);
  resetDogmaCache();
  // 587 Rifter, 519 Gyrostabilizer II, 3426 CPU Management, 3413 Power Grid Management.
  data = await loadDogmaData([587, 519, 3426, 3413]);
}, 120_000);
afterAll(async () => { resetDogmaCache(); await closePool(); });

describe("attributes", () => {
  it("loads every attribute in the build", () => {
    expect(data.attributes.size).toBe(2867);
  });

  it("carries defaultValue, stackable and highIsGood", () => {
    expect(data.attributes.get(ATTR.cpu)).toEqual({ id: 50, name: "cpu", defaultValue: 0, stackable: true, highIsGood: false });
    expect(data.attributes.get(64)).toEqual({ id: 64, name: "damageMultiplier", defaultValue: 1, stackable: false, highIsGood: true });
    expect(data.attributes.get(ATTR.drawback)!.defaultValue).toBe(10);
  });

  it("carries maxAttributeId and minAttributeId where the SDE has them", () => {
    expect(data.attributes.get(37)!.maxAttributeId).toBe(2033);
    expect(data.attributes.get(37)!.minAttributeId).toBeUndefined();
    expect(data.attributes.get(20)!.minAttributeId).toBe(2266);
    expect(data.attributes.get(ATTR.cpu)!.maxAttributeId).toBeUndefined();
  });
});

describe("effects", () => {
  it("loads every effect in the build", () => {
    expect(data.effects.size).toBe(23);
  });

  it("patches the online effect into the online category", () => {
    const online = data.effects.get(16)!;
    expect(online.categoryId).toBe(4);
    expect(online.state).toBe(State.Online);
    expect(online.modifiers).toEqual([]);
  });

  it("maps CPU Management's two effects verbatim", () => {
    expect(data.effects.get(368)).toEqual({
      id: 368, categoryId: 0, state: State.Offline,
      modifiers: [{ func: "ItemModifier", domain: "self", modifiedAttrId: 424, modifyingAttrId: 280, operation: Operator.PreMul }],
    });
    expect(data.effects.get(397)).toEqual({
      id: 397, categoryId: 0, state: State.Offline,
      modifiers: [{ func: "ItemModifier", domain: "ship", modifiedAttrId: 48, modifyingAttrId: 424, operation: Operator.PostPercent }],
    });
  });

  it("keeps groupId on a LocationGroupModifier and skillTypeId on a required-skill modifier", () => {
    expect(data.effects.get(92)!.modifiers).toEqual([
      { func: "LocationGroupModifier", domain: "ship", modifiedAttrId: 64, modifyingAttrId: 64, operation: Operator.PostMul, groupId: 55 },
    ]);
    expect(data.effects.get(7248)!.modifiers).toEqual([
      { func: "LocationRequiredSkillModifier", domain: "ship", modifiedAttrId: 51, modifyingAttrId: 460, operation: Operator.PostPercent, skillTypeId: 3302 },
    ]);
  });

  it("drops operation 9 but keeps the rest of effect 132", () => {
    expect(data.effects.get(132)!.modifiers).toEqual([
      { func: "ItemModifier", domain: "self", modifiedAttrId: 280, modifyingAttrId: 276, operation: Operator.ModAdd },
    ]);
  });

  it("drops targetID/target domains and EffectStopper rows, keeping the effect itself", () => {
    // 5928 warpScrambleTargetMWDBlockActivationForEntity: 2 targetID modifiers, 2 EffectStoppers, 1 more targetID.
    expect(data.effects.get(5928)!.modifiers).toEqual([]);
    expect(data.effects.get(5928)!.state).toBe(State.Active);
  });
});

describe("groups", () => {
  it("loads every group with its category", () => {
    expect(data.groups.size).toBe(1610);
    expect(data.groups.get(25)).toEqual({ id: 25, name: "Frigate", categoryId: 6 });
    expect(data.groups.get(1216)).toEqual({ id: 1216, name: "Engineering", categoryId: 16 });
  });
});

describe("types", () => {
  it("loads the requested types and the required-skill closure, skipping ids this build lacks", () => {
    // 587 pulls in 3329 Minmatar Frigate; 3329's own prerequisite 3327 and 519's 3318 are not in the
    // mini fixture's allow-list, so they are skipped instead of throwing.
    expect([...data.types.keys()].sort((a, b) => a - b)).toEqual([519, 587, 3329, 3413, 3426]);
  });

  it("resolves groupId, categoryId and name", () => {
    const rifter = data.types.get(587)!;
    expect(rifter.groupId).toBe(25);
    expect(rifter.categoryId).toBe(6);
    expect(rifter.name).toBe("Rifter");
    expect(data.types.get(3426)!.categoryId).toBe(16);
  });

  it("carries the Rifter's fitting attributes", () => {
    const attrs = data.types.get(587)!.attrs;
    expect(attrs.get(ATTR.cpuOutput)).toBe(130);
    expect(attrs.get(ATTR.powerOutput)).toBe(41);
    expect(attrs.get(ATTR.hiSlots)).toBe(3);
    expect(attrs.get(ATTR.medSlots)).toBe(3);
    expect(attrs.get(ATTR.lowSlots)).toBe(4);
    expect(attrs.get(ATTR.rigSlots)).toBe(3);
    expect(attrs.get(ATTR.turretSlots)).toBe(3);
    expect(attrs.get(ATTR.launcherSlots)).toBe(2);
    expect(attrs.get(ATTR.upgradeCapacity)).toBe(400);
    expect(attrs.get(ATTR.rigSize)).toBe(1);
  });

  it("injects mass/capacity/volume/radius from the sde_types columns", () => {
    const attrs = data.types.get(587)!.attrs;
    expect(attrs.size).toBe(93);        // 89 typeDogma rows + the four columns
    expect(attrs.get(ATTR.mass)).toBe(1067000);
    expect(attrs.get(ATTR.capacity)).toBe(140);
    expect(attrs.get(ATTR.volume)).toBe(27289);
    expect(attrs.get(ATTR.radius)).toBe(31);
  });

  it("injects only the columns that are populated", () => {
    const skill = data.types.get(3426)!.attrs;
    expect(skill.size).toBe(6);          // 5 typeDogma rows + volume only
    expect(skill.get(ATTR.volume)).toBe(0.01);
    expect(skill.has(ATTR.mass)).toBe(false);
    expect(skill.has(ATTR.capacity)).toBe(false);
    expect(skill.has(ATTR.radius)).toBe(false);
  });

  it("carries the type→effect map with isDefault", () => {
    expect([...data.types.get(587)!.effects.entries()]).toEqual([[5779, false], [7248, false]]);
    expect([...data.types.get(3426)!.effects.entries()].sort((a, b) => a[0] - b[0])).toEqual([[132, true], [368, false], [397, false]]);
    expect([...data.types.get(519)!.effects.keys()].sort((a, b) => a - b)).toEqual([11, 16, 89, 92]);
  });
});

describe("memoisation", () => {
  it("returns the same type object for a repeated request and shares the base maps", async () => {
    const again = await loadDogmaData([587]);
    expect(again.types.get(587)).toBe(data.types.get(587));
    expect(again.attributes).toBe(data.attributes);
    expect(again.effects).toBe(data.effects);
    expect(again.groups).toBe(data.groups);
    expect(again.types.has(519)).toBe(false);
  });
});
```

- [ ] **Step 5: Run the test and watch it fail**

Run: `docker compose -f compose.dev.yml up -d && npx vitest run tests/db/dogma-loader.test.ts`
Expected: FAIL — `Failed to resolve import "../../src/lib/dogma/sde-loader.js"`.

- [ ] **Step 6: Write `src/lib/dogma/sde-loader.ts`**

```ts
/**
 * The engine's only I/O module: builds a plain DogmaData out of the phase-2 sde_* tables.
 *
 * Everything else under src/lib/dogma is isomorphic and takes DogmaData as an argument, so phase 5
 * can run the same engine in the browser against a snapshot fetched over HTTP.
 */
import { getPool } from "../db/client.js";
import {
  COLUMN_ATTRS, CUSTOM_EFFECT_MODIFIERS, EFFECT, ONLINE_EFFECT_CATEGORY_ID, REQUIRED_SKILL_ATTRS,
  domainFromSde, operatorFromSde, stateForEffectCategory,
  type AttrId, type DogmaAttribute, type DogmaData, type DogmaEffect, type DogmaGroup, type DogmaType,
  type EffectId, type GroupId, type Modifier, type ModifierFunc, type TypeId,
} from "./data.js";

interface BaseData {
  attributes: Map<AttrId, DogmaAttribute>;
  effects: Map<EffectId, DogmaEffect>;
  groups: Map<GroupId, DogmaGroup>;
}

interface AttributeRow {
  id: number; name: string | null; default_value: number | null;
  stackable: boolean | null; high_is_good: boolean | null;
  max_attribute_id: number | null; min_attribute_id: number | null;
}
interface EffectRow { id: number; effect_category_id: number | null; fitting_usage_chance_attribute_id: number | null }
interface ModifierRow {
  effect_id: number; domain: string | null; func: string | null;
  modified_attribute_id: number | null; modifying_attribute_id: number | null;
  operation: number | null; skill_type_id: number | null; group_id: number | null;
}
interface GroupRow { id: number; name: string | null; category_id: number | null }
interface TypeRow {
  id: number; group_id: number | null; category_id: number | null; name: string | null;
  mass: number | null; capacity: number | null; volume: number | null; radius: number | null;
}

/** EffectStopper is deliberately absent — those rows suppress other effects and are dropped. */
const MODIFIER_FUNCS: ReadonlySet<string> = new Set<ModifierFunc>([
  "ItemModifier", "LocationModifier", "LocationGroupModifier",
  "LocationRequiredSkillModifier", "OwnerRequiredSkillModifier",
]);

let basePromise: Promise<BaseData> | null = null;
const typeCache = new Map<TypeId, DogmaType>();
const missingTypes = new Set<TypeId>();

/** Tests only: drops the process-wide memo so a fresh import is picked up. */
export function resetDogmaCache(): void {
  basePromise = null;
  typeCache.clear();
  missingTypes.clear();
}

/**
 * The requested types plus the transitive closure of their requiredSkillN attributes; attributes,
 * effects and groups are shared with every other caller in this process.
 */
export async function loadDogmaData(typeIds: TypeId[]): Promise<DogmaData> {
  const base = await loadBase();
  const types = await loadTypes(typeIds);
  return { attributes: base.attributes, effects: base.effects, groups: base.groups, types };
}

function loadBase(): Promise<BaseData> {
  if (!basePromise) {
    basePromise = readBase().catch((e: unknown) => {
      basePromise = null;                 // a failed load must not poison the process
      throw e;
    });
  }
  return basePromise;
}

async function readBase(): Promise<BaseData> {
  const pool = getPool();
  const { rows: attrRows } = await pool.query<AttributeRow>(
    `SELECT id, name, default_value, stackable, high_is_good, max_attribute_id, min_attribute_id
     FROM sde_dogma_attributes`);
  const attributes = new Map<AttrId, DogmaAttribute>();
  for (const r of attrRows) {
    // bool(None) === false: mirror EOS's row.get() semantics rather than inventing a default.
    const attr: DogmaAttribute = {
      id: r.id, name: r.name, defaultValue: r.default_value ?? 0,
      stackable: r.stackable ?? false, highIsGood: r.high_is_good ?? false,
    };
    if (r.max_attribute_id !== null) attr.maxAttributeId = r.max_attribute_id;
    if (r.min_attribute_id !== null) attr.minAttributeId = r.min_attribute_id;
    attributes.set(attr.id, attr);
  }

  const { rows: effectRows } = await pool.query<EffectRow>(
    "SELECT id, effect_category_id, fitting_usage_chance_attribute_id FROM sde_dogma_effects");
  const effects = new Map<EffectId, DogmaEffect>();
  for (const r of effectRows) {
    // The SDE files `online` as effectCategoryID 1 (active); the client treats it as online.
    const categoryId = r.id === EFFECT.online ? ONLINE_EFFECT_CATEGORY_ID : r.effect_category_id;
    const state = stateForEffectCategory(categoryId);
    if (state === null) continue;         // categories 3 (area) and 6 (dungeon) have no state
    const effect: DogmaEffect = { id: r.id, categoryId: categoryId ?? 0, state, modifiers: [] };
    if (r.fitting_usage_chance_attribute_id !== null) {
      effect.fittingUsageChanceAttrId = r.fitting_usage_chance_attribute_id;
    }
    effects.set(effect.id, effect);
  }

  const { rows: modRows } = await pool.query<ModifierRow>(
    `SELECT effect_id, domain, func, modified_attribute_id, modifying_attribute_id,
            operation, skill_type_id, group_id
     FROM sde_dogma_effect_modifiers ORDER BY effect_id, idx`);
  for (const r of modRows) {
    const effect = effects.get(r.effect_id);
    if (!effect) continue;
    const modifier = toModifier(r);
    if (modifier) effect.modifiers.push(modifier);
  }

  // 3773 and 3774 carry no modifierInfo at all; both reference engines hand-code them.
  for (const [effectId, modifiers] of CUSTOM_EFFECT_MODIFIERS) {
    const effect = effects.get(effectId);
    if (effect && effect.modifiers.length === 0) effect.modifiers.push(...modifiers.map((m) => ({ ...m })));
  }

  const { rows: groupRows } = await pool.query<GroupRow>("SELECT id, name, category_id FROM sde_groups");
  const groups = new Map<GroupId, DogmaGroup>(
    groupRows.map((r) => [r.id, { id: r.id, name: r.name, categoryId: r.category_id ?? 0 }]));

  return { attributes, effects, groups };
}

function toModifier(r: ModifierRow): Modifier | null {
  if (r.func === null || !MODIFIER_FUNCS.has(r.func)) return null;     // EffectStopper and anything new
  const domain = domainFromSde(r.domain);
  if (domain === null) return null;                                     // targetID / target / structureID
  const operation = operatorFromSde(r.operation);
  if (operation === null) return null;                                  // operation 9 and unknown ints
  if (r.modified_attribute_id === null || r.modifying_attribute_id === null) return null;
  const modifier: Modifier = {
    func: r.func as ModifierFunc,
    domain,
    modifiedAttrId: r.modified_attribute_id,
    modifyingAttrId: r.modifying_attribute_id,
    operation,
  };
  if (r.group_id !== null) modifier.groupId = r.group_id;
  if (r.skill_type_id !== null) modifier.skillTypeId = r.skill_type_id;
  return modifier;
}

async function loadTypes(requested: TypeId[]): Promise<Map<TypeId, DogmaType>> {
  const resolved = new Map<TypeId, DogmaType>();
  const seen = new Set<TypeId>();
  let frontier: TypeId[] = [];
  for (const id of requested) if (!seen.has(id)) { seen.add(id); frontier.push(id); }

  while (frontier.length > 0) {
    const toFetch = frontier.filter((id) => !typeCache.has(id) && !missingTypes.has(id));
    if (toFetch.length > 0) await readTypes(toFetch);
    const next: TypeId[] = [];
    for (const id of frontier) {
      const type = typeCache.get(id);
      if (!type) continue;              // unknown to this SDE build — the caller renders it as unknown
      resolved.set(id, type);
      for (const skillId of requiredSkillIds(type)) {
        if (seen.has(skillId)) continue;
        seen.add(skillId);
        next.push(skillId);
      }
    }
    frontier = next;
  }
  return resolved;
}

function requiredSkillIds(type: DogmaType): TypeId[] {
  const out: TypeId[] = [];
  for (const [skillAttr] of REQUIRED_SKILL_ATTRS) {
    const value = type.attrs.get(skillAttr);
    if (value === undefined || value <= 0) continue;
    out.push(Math.round(value));        // typeDogma values are always floats
  }
  return out;
}

async function readTypes(ids: TypeId[]): Promise<void> {
  const pool = getPool();
  const { rows: typeRows } = await pool.query<TypeRow>(
    `SELECT t.id, t.group_id, g.category_id, t.name, t.mass, t.capacity, t.volume, t.radius
     FROM sde_types t LEFT JOIN sde_groups g ON g.id = t.group_id
     WHERE t.id = ANY($1::int[])`, [ids]);
  const { rows: attrRows } = await pool.query<{ type_id: number; attribute_id: number; value: number | null }>(
    "SELECT type_id, attribute_id, value FROM sde_type_attributes WHERE type_id = ANY($1::int[])", [ids]);
  const { rows: effectRows } = await pool.query<{ type_id: number; effect_id: number; is_default: boolean | null }>(
    "SELECT type_id, effect_id, is_default FROM sde_type_effects WHERE type_id = ANY($1::int[])", [ids]);

  const built = new Map<TypeId, DogmaType>();
  for (const r of typeRows) {
    built.set(r.id, {
      id: r.id, groupId: r.group_id ?? 0, categoryId: r.category_id ?? 0, name: r.name,
      attrs: new Map<AttrId, number>(), effects: new Map<EffectId, boolean>(),
    });
  }
  for (const r of attrRows) {
    const type = built.get(r.type_id);
    if (type && r.value !== null) type.attrs.set(r.attribute_id, r.value);
  }
  // mass/capacity/volume/radius live on sde_types, not in typeDogma — but a dogma value wins.
  for (const r of typeRows) {
    const type = built.get(r.id);
    if (!type) continue;
    for (const [attrId, column] of COLUMN_ATTRS) {
      const value = r[column];
      if (value !== null && !type.attrs.has(attrId)) type.attrs.set(attrId, value);
    }
  }
  for (const r of effectRows) {
    const type = built.get(r.type_id);
    if (type) type.effects.set(r.effect_id, r.is_default ?? false);
  }
  for (const id of ids) {
    const type = built.get(id);
    if (type) typeCache.set(id, type); else missingTypes.add(id);
  }
}
```

- [ ] **Step 7: Re-import the SDE so the dev database has the new columns**

```bash
cd /home/daniel/AI/Plasma/EVE
npm run sde:import -- --file .superpowers/research/sde-3484357.zip
```
Expected: the import completes and `psql "postgres://eve:eve@127.0.0.1:5432/eve" -c "SELECT count(*) FROM sde_dogma_attributes WHERE max_attribute_id IS NOT NULL"` reports `29`.
(Pinning the dev database to build 3484357 keeps it identical to `tests/fixtures/sde-mini.zip`, which is
what the Task 4 snapshots are generated from.)

- [ ] **Step 8: Run the tests and the type checker**

Run: `npx vitest run tests/db/dogma-loader.test.ts tests/sde/tables.test.ts tests/db/sde-import.test.ts tests/db/sde-repo.test.ts && npm run typecheck`
Expected: PASS. If `tests/db/sde-import.test.ts` asserts a column list anywhere, extend it the same way.

- [ ] **Step 9: Commit**

```bash
git add src/lib/dogma/sde-loader.ts src/lib/sde/ddl.ts src/lib/sde/tables.ts tests/db/dogma-loader.test.ts tests/sde/tables.test.ts
git commit -m "feat(dogma): SDE loader with build-time filtering and required-skill closure

Adds max_attribute_id/min_attribute_id to sde_dogma_attributes so the calculator's
maxAttributeID cap has data to work with.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: The fixture generator and the two committed `DogmaData` snapshots

**Files:**
- Create: `scripts/dogma-fixture.ts`, `tests/fixtures/dogma/rifter.json` (generated, committed), `tests/fixtures/dogma/tengu.json` (generated, committed), `tests/dogma/fixture.ts`, `tests/dogma/fixture.test.ts`
- Modify: `package.json` (one script)

**Interfaces:**
- Consumes: Task 1 `serialiseDogmaData`, `ATTR`, `CAN_FIT_SHIP_TYPE_ATTRS`, `CAN_FIT_SHIP_GROUP_ATTRS`, `REQUIRED_SKILL_ATTRS`; Task 3 `loadDogmaData`; phase-1 `closePool()`.
- Produces:
```ts
// tests/dogma/fixture.ts
export function fixtureData(name: "rifter" | "tengu"): DogmaData;   // deserialised once per process
```

**The fixture definitions are the script's contract** — like phase 2's `sde-fixture.ts` allow-list, they live
in the script and nowhere else. `loadDogmaData` already expands the required-skill closure, so the seed list
stays short; the snapshot then prunes attributes, effects and groups down to what those types can reach.

| Fixture | Seed type ids | Types after closure |
|---|---|---|
| `rifter` | 587, 2889, 2048, 519, 440, 380, 33076, 31686, 31682, 31724, 484, 5443, 12608, 27339, 4256, 12034, 27143, 2456, 626, 3426, 3413, 3318, 11207 | **53** |
| `tengu` | 29984, 45601, 3426, 3413 | **18** |

Seed roles: 587 Rifter (clean hull, no CPU/PG role bonus), 2889 200mm AutoCannon II (turret, requires Gunnery
so Weapon Upgrades reaches it), 2048 Damage Control II (`maxGroupFitted` 1), 519 Gyrostabilizer II (low slot,
requires Weapon Upgrades so it is *not* reached by effect 581), 440 5MN Microwarpdrive II (17 MW, the
powergrid-overflow case), 380 Small Shield Extender II, 33076 Small Ancillary Armor Repairer
(`maxGroupFitted` 1), 31686 Small Projectile Collision Accelerator II (rig, size 1, calibration 300),
31682 Medium Projectile Collision Accelerator I (rig, size 2, calibration 200), 31724 Medium EM Shield
Reinforcer II (rig, size 2, calibration 75 — the rig-size mismatch), 484 125mm Gatling AutoCannon I,
5443 Faint Epsilon Scoped Warp Scrambler, 12608 Hail S (charge, requires Small Autocannon Specialization),
27339 Caldari Navy Mjolnir Torpedo (the `Invalid`-flag item in the phase-3 fittings fixture),
4256 Bomb Launcher II (`canFitShipGroup01` = 834), 12034 Hound (group 834 — the positive ship-restriction
case), 27143 Zainou 'Gypsy' CPU Management EE-601 (implant, `cpuOutputBonus2` 1), 2456 Hobgoblin II (drone),
626 Vexor, plus the four fitting skills.

- [ ] **Step 1: Add the npm script**

In `package.json`, inside `"scripts"`, after `"sde:fixture": "tsx scripts/sde-fixture.ts",` add:
```json
    "dogma:fixture": "tsx scripts/dogma-fixture.ts",
```

- [ ] **Step 2: Write `scripts/dogma-fixture.ts`**

```ts
/**
 * Regenerates tests/fixtures/dogma/*.json from the SDE imported into the dev database.
 *
 *   npm run dogma:fixture                    # every named fixture
 *   npm run dogma:fixture -- rifter          # just that one
 *   npm run dogma:fixture -- scratch 587 519 # an ad-hoc snapshot
 *
 * The snapshots are committed and regenerated only deliberately — every engine test asserts against
 * the values they contain, so a regeneration is a test change. Import
 * `.superpowers/research/sde-3484357.zip` first so the snapshots match tests/fixtures/sde-mini.zip.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mkdir, writeFile } from "node:fs/promises";
import { closePool } from "../src/lib/db/client.js";
import { loadDogmaData } from "../src/lib/dogma/sde-loader.js";
import {
  ATTR, CAN_FIT_SHIP_GROUP_ATTRS, CAN_FIT_SHIP_TYPE_ATTRS, REQUIRED_SKILL_ATTRS, serialiseDogmaData,
  type AttrId, type DogmaAttribute, type DogmaData, type DogmaEffect, type DogmaGroup, type DogmaType,
  type EffectId, type GroupId, type TypeId,
} from "../src/lib/dogma/data.js";

/** The fixture definitions are this script's contract — do not duplicate them in a test. */
const FIXTURES: Record<string, TypeId[]> = {
  rifter: [
    587,    // Rifter
    2889,   // 200mm AutoCannon II
    2048,   // Damage Control II            (maxGroupFitted 1)
    519,    // Gyrostabilizer II
    440,    // 5MN Microwarpdrive II
    380,    // Small Shield Extender II
    33076,  // Small Ancillary Armor Repairer (maxGroupFitted 1)
    31686,  // Small Projectile Collision Accelerator II (rig size 1, calibration 300)
    31682,  // Medium Projectile Collision Accelerator I (rig size 2, calibration 200)
    31724,  // Medium EM Shield Reinforcer II            (rig size 2, calibration 75)
    484,    // 125mm Gatling AutoCannon I
    5443,   // Faint Epsilon Scoped Warp Scrambler
    12608,  // Hail S                       (charge)
    27339,  // Caldari Navy Mjolnir Torpedo (the Invalid-flag fitting item)
    4256,   // Bomb Launcher II             (canFitShipGroup01 834)
    12034,  // Hound                        (group 834)
    27143,  // Zainou 'Gypsy' CPU Management EE-601 (implant)
    2456,   // Hobgoblin II                 (drone)
    626,    // Vexor
    3426, 3413, 3318, 11207,   // CPU Management, Power Grid Management, Weapon Upgrades, Advanced Weapon Upgrades
  ],
  tengu: [
    29984,  // Tengu
    45601,  // Tengu Offensive - Accelerated Ejection Bay (effects 3772/3773/3774)
    3426, 3413,
  ],
};

const DEST_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "tests", "fixtures", "dogma");

/** Attributes the engine reads by name, whether or not any included type carries them. */
const ENGINE_ATTRIBUTE_IDS: readonly AttrId[] = [
  ...Object.values(ATTR),
  ...CAN_FIT_SHIP_TYPE_ATTRS,
  ...CAN_FIT_SHIP_GROUP_ATTRS,
  ...REQUIRED_SKILL_ATTRS.flatMap(([skill, level]) => [skill, level]),
];

function sorted<T>(entries: Map<number, T>): Map<number, T> {
  return new Map([...entries.entries()].sort((a, b) => a[0] - b[0]));
}

/**
 * Keep only what items built from these types can reach: their own attributes, the attributes their
 * effects read and write, the engine's named attributes, and any max/min cap targets of those.
 */
function prune(data: DogmaData): DogmaData {
  const effects = new Map<EffectId, DogmaEffect>();
  const groups = new Map<GroupId, DogmaGroup>();
  const attrIds = new Set<AttrId>(ENGINE_ATTRIBUTE_IDS);
  const types = new Map<TypeId, DogmaType>();

  for (const type of sorted(data.types).values()) {
    types.set(type.id, { ...type, attrs: sorted(type.attrs), effects: sorted(type.effects) });
    const group = data.groups.get(type.groupId);
    if (group) groups.set(group.id, group);
    for (const attrId of type.attrs.keys()) attrIds.add(attrId);
    for (const effectId of type.effects.keys()) {
      const effect = data.effects.get(effectId);
      if (!effect) continue;                 // dropped at load time (effect category 3 or 6)
      effects.set(effect.id, effect);
      if (effect.fittingUsageChanceAttrId !== undefined) attrIds.add(effect.fittingUsageChanceAttrId);
      for (const m of effect.modifiers) {
        attrIds.add(m.modifiedAttrId);
        attrIds.add(m.modifyingAttrId);
      }
    }
  }

  for (let changed = true; changed;) {
    changed = false;
    for (const id of [...attrIds]) {
      const attr = data.attributes.get(id);
      if (!attr) continue;
      for (const target of [attr.maxAttributeId, attr.minAttributeId]) {
        if (target !== undefined && !attrIds.has(target)) { attrIds.add(target); changed = true; }
      }
    }
  }

  const attributes = new Map<AttrId, DogmaAttribute>();
  for (const id of [...attrIds].sort((a, b) => a - b)) {
    const attr = data.attributes.get(id);
    if (attr) attributes.set(id, attr);
  }
  return { attributes, effects: sorted(effects), groups: sorted(groups), types };
}

function jobs(): [string, TypeId[]][] {
  const [name, ...ids] = process.argv.slice(2);
  if (ids.length > 0) return [[name, ids.map(Number)]];
  if (name) {
    const seeds = FIXTURES[name];
    if (!seeds) throw new Error(`unknown fixture ${name}; known: ${Object.keys(FIXTURES).join(", ")}`);
    return [[name, seeds]];
  }
  return Object.entries(FIXTURES);
}

async function main(): Promise<void> {
  await mkdir(DEST_DIR, { recursive: true });
  for (const [name, seeds] of jobs()) {
    const data = prune(await loadDogmaData(seeds));
    const dest = path.join(DEST_DIR, `${name}.json`);
    await writeFile(dest, `${JSON.stringify(serialiseDogmaData(data), null, 1)}\n`);
    console.log(
      `${name}: ${data.types.size} types, ${data.effects.size} effects, ` +
      `${data.attributes.size} attributes, ${data.groups.size} groups → ${dest}`);
  }
  await closePool();
}

main().catch((e: unknown) => { console.error(e); process.exit(1); });
```

- [ ] **Step 3: Generate the snapshots**

```bash
cd /home/daniel/AI/Plasma/EVE
npm run dogma:fixture
```
Expected: `rifter: 53 types, …` and `tengu: 18 types, …`. If either type count differs, **stop** — the dev
database is not on build 3484357; re-run Task 3 Step 7 first.

- [ ] **Step 4: Write the fixture helper**

Create `tests/dogma/fixture.ts` (a helper, not a test file — vitest only collects `*.test.*`):
```ts
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { deserialiseDogmaData, type DogmaData, type DogmaDataJson } from "../../src/lib/dogma/data.js";

export const FIXTURE_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "fixtures", "dogma");

export type FixtureName = "rifter" | "tengu";

const cache = new Map<FixtureName, DogmaData>();

/** A committed DogmaData snapshot, parsed once per process. Treat the result as read-only. */
export function fixtureData(name: FixtureName): DogmaData {
  let data = cache.get(name);
  if (!data) {
    const json = JSON.parse(readFileSync(path.join(FIXTURE_DIR, `${name}.json`), "utf8")) as DogmaDataJson;
    data = deserialiseDogmaData(json);
    cache.set(name, data);
  }
  return data;
}
```

- [ ] **Step 5: Write the fixture test**

Create `tests/dogma/fixture.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { statSync } from "node:fs";
import path from "node:path";
import { FIXTURE_DIR, fixtureData } from "./fixture.js";
import { ATTR, EFFECT, Operator, State } from "../../src/lib/dogma/data.js";

describe("rifter.json", () => {
  const data = fixtureData("rifter");

  it("holds the seed types and their required-skill closure", () => {
    expect(data.types.size).toBe(53);
    for (const id of [587, 2889, 2048, 519, 440, 380, 33076, 31686, 31682, 31724, 484, 5443, 12608,
                      27339, 4256, 12034, 27143, 2456, 626, 3426, 3413, 3318, 11207]) {
      expect(data.types.has(id)).toBe(true);
    }
    // Pulled in transitively: 2889 → 11084 Small Autocannon Specialization → 3312 → 3300 Gunnery.
    for (const id of [11084, 3312, 3302, 3300, 3394, 3392, 3329, 3327, 3411]) {
      expect(data.types.has(id)).toBe(true);
    }
  });

  it("carries the Rifter's hull numbers", () => {
    const rifter = data.types.get(587)!;
    expect(rifter.name).toBe("Rifter");
    expect(rifter.groupId).toBe(25);
    expect(rifter.categoryId).toBe(6);
    expect(rifter.attrs.get(ATTR.cpuOutput)).toBe(130);
    expect(rifter.attrs.get(ATTR.powerOutput)).toBe(41);
    expect(rifter.attrs.get(ATTR.hiSlots)).toBe(3);
    expect(rifter.attrs.get(ATTR.medSlots)).toBe(3);
    expect(rifter.attrs.get(ATTR.lowSlots)).toBe(4);
    expect(rifter.attrs.get(ATTR.rigSlots)).toBe(3);
    expect(rifter.attrs.get(ATTR.turretSlots)).toBe(3);
    expect(rifter.attrs.get(ATTR.launcherSlots)).toBe(2);
    expect(rifter.attrs.get(ATTR.upgradeCapacity)).toBe(400);
    expect(rifter.attrs.get(ATTR.rigSize)).toBe(1);
  });

  it("carries the module numbers the fitting fixtures depend on", () => {
    expect(data.types.get(2889)!.attrs.get(ATTR.cpu)).toBe(9);
    expect(data.types.get(2889)!.attrs.get(ATTR.power)).toBe(4);
    expect(data.types.get(2889)!.groupId).toBe(55);
    expect([...data.types.get(2889)!.effects.keys()]).toContain(EFFECT.turretFitted);
    expect([...data.types.get(2889)!.effects.keys()]).toContain(EFFECT.hiPower);
    expect(data.types.get(2048)!.attrs.get(ATTR.cpu)).toBe(30);
    expect(data.types.get(2048)!.attrs.get(ATTR.power)).toBe(1);
    expect(data.types.get(2048)!.attrs.get(ATTR.maxGroupFitted)).toBe(1);
    expect(data.types.get(519)!.attrs.get(ATTR.cpu)).toBe(30);
    expect(data.types.get(519)!.attrs.get(ATTR.power)).toBe(1);
    expect(data.types.get(440)!.attrs.get(ATTR.power)).toBe(17);
    expect(data.types.get(380)!.attrs.get(ATTR.cpu)).toBe(23);
    expect(data.types.get(5443)!.attrs.get(ATTR.cpu)).toBe(30);
    expect(data.types.get(31686)!.attrs.get(ATTR.upgradeCost)).toBe(300);
    expect(data.types.get(31686)!.attrs.get(ATTR.rigSize)).toBe(1);
    expect(data.types.get(31724)!.attrs.get(ATTR.upgradeCost)).toBe(75);
    expect(data.types.get(31724)!.attrs.get(ATTR.rigSize)).toBe(2);
    expect(data.types.get(4256)!.attrs.get(1298)).toBe(834);   // canFitShipGroup01 = Stealth Bomber
    expect(data.types.get(12034)!.groupId).toBe(834);
  });

  it("carries the fitting skills' bonus attributes", () => {
    expect(data.types.get(3426)!.attrs.get(424)).toBe(5);      // cpuOutputBonus2
    expect(data.types.get(3413)!.attrs.get(313)).toBe(5);      // powerEngineeringOutputBonus
    expect(data.types.get(3318)!.attrs.get(310)).toBe(-5);     // cpuNeedBonus
    expect(data.types.get(11207)!.attrs.get(323)).toBe(-2);    // powerNeedBonus
    expect(data.types.get(27143)!.attrs.get(424)).toBe(1);     // the implant's own +1 %
  });

  it("carries the two-effect skill-scaling pattern", () => {
    expect(data.effects.get(368)!.modifiers).toEqual([
      { func: "ItemModifier", domain: "self", modifiedAttrId: 424, modifyingAttrId: 280, operation: Operator.PreMul },
    ]);
    expect(data.effects.get(397)!.modifiers).toEqual([
      { func: "ItemModifier", domain: "ship", modifiedAttrId: 48, modifyingAttrId: 424, operation: Operator.PostPercent },
    ]);
    expect(data.effects.get(581)!.modifiers).toEqual([
      { func: "LocationRequiredSkillModifier", domain: "ship", modifiedAttrId: 50, modifyingAttrId: 310, operation: Operator.PostPercent, skillTypeId: 3300 },
      { func: "LocationRequiredSkillModifier", domain: "ship", modifiedAttrId: 50, modifyingAttrId: 310, operation: Operator.PostPercent, skillTypeId: 55033 },
    ]);
    expect(data.effects.get(1638)!.modifiers.map((m) => m.skillTypeId)).toEqual([3300, 3319, 55033]);
  });

  it("keeps the online effect patched into the online category", () => {
    expect(data.effects.get(EFFECT.online)!.categoryId).toBe(4);
    expect(data.effects.get(EFFECT.online)!.state).toBe(State.Online);
  });

  it("keeps every attribute the pruned effects read", () => {
    for (const id of [276, 280, 310, 313, 323, 424, 64, ATTR.cpu, ATTR.power, ATTR.cpuOutput, ATTR.powerOutput]) {
      expect(data.attributes.has(id)).toBe(true);
    }
    expect(data.attributes.get(ATTR.cpu)!.stackable).toBe(true);
    expect(data.attributes.get(64)!.stackable).toBe(false);
  });

  it("stays inside the fixture budget", () => {
    expect(statSync(path.join(FIXTURE_DIR, "rifter.json")).size).toBeLessThan(400_000);
  });
});

describe("tengu.json", () => {
  const data = fixtureData("tengu");

  it("holds the hull, the subsystem and their closure", () => {
    expect(data.types.size).toBe(18);
    expect(data.types.has(29984)).toBe(true);
    expect(data.types.has(45601)).toBe(true);
  });

  it("carries the T3 hull's zero slots and five subsystem slots", () => {
    const tengu = data.types.get(29984)!;
    expect(tengu.attrs.get(ATTR.cpuOutput)).toBe(310);
    expect(tengu.attrs.get(ATTR.powerOutput)).toBe(420);
    expect(tengu.attrs.get(ATTR.hiSlots)).toBe(0);
    expect(tengu.attrs.get(ATTR.medSlots)).toBe(0);
    expect(tengu.attrs.get(ATTR.lowSlots)).toBe(0);
    expect(tengu.attrs.get(ATTR.turretSlots)).toBe(0);
    expect(tengu.attrs.get(ATTR.launcherSlots)).toBe(0);
    expect(tengu.attrs.get(ATTR.maxSubSystems)).toBe(5);
  });

  it("carries the subsystem's slot and hardpoint modifier attributes and its three marker effects", () => {
    const sub = data.types.get(45601)!;
    expect(sub.categoryId).toBe(32);
    expect(sub.attrs.get(ATTR.hiSlotModifier)).toBe(7);
    expect(sub.attrs.get(ATTR.medSlotModifier)).toBe(0);
    expect(sub.attrs.get(ATTR.lowSlotModifier)).toBe(0);
    expect(sub.attrs.get(ATTR.turretHardPointModifier)).toBe(0);
    expect(sub.attrs.get(ATTR.launcherHardPointModifier)).toBe(6);
    expect(sub.attrs.get(ATTR.cpuOutput)).toBe(160);
    expect(sub.attrs.get(ATTR.powerOutput)).toBe(190);
    for (const id of [EFFECT.subSystem, EFFECT.hardPointModifier, EFFECT.slotModifier]) {
      expect(sub.effects.has(id)).toBe(true);
    }
  });

  it("baked the hand-coded 3773/3774 modifiers into the snapshot", () => {
    expect(data.effects.get(EFFECT.slotModifier)!.modifiers).toEqual([
      { func: "ItemModifier", domain: "ship", modifiedAttrId: 14, modifyingAttrId: 1374, operation: Operator.ModAdd },
      { func: "ItemModifier", domain: "ship", modifiedAttrId: 13, modifyingAttrId: 1375, operation: Operator.ModAdd },
      { func: "ItemModifier", domain: "ship", modifiedAttrId: 12, modifyingAttrId: 1376, operation: Operator.ModAdd },
    ]);
    expect(data.effects.get(EFFECT.hardPointModifier)!.modifiers).toEqual([
      { func: "ItemModifier", domain: "ship", modifiedAttrId: 102, modifyingAttrId: 1368, operation: Operator.ModAdd },
      { func: "ItemModifier", domain: "ship", modifiedAttrId: 101, modifyingAttrId: 1369, operation: Operator.ModAdd },
    ]);
  });

  it("carries the subsystem's own passive output adds", () => {
    // 3783 cpuOutputAddCpuOutputPassive / 3782 powerOutputAddPassive: ModAdd of the subsystem's own value.
    expect(data.effects.get(3783)!.modifiers).toEqual([
      { func: "ItemModifier", domain: "ship", modifiedAttrId: 48, modifyingAttrId: 48, operation: Operator.ModAdd },
    ]);
    expect(data.effects.get(3782)!.modifiers).toEqual([
      { func: "ItemModifier", domain: "ship", modifiedAttrId: 11, modifyingAttrId: 11, operation: Operator.ModAdd },
    ]);
  });

  it("stays inside the fixture budget", () => {
    expect(statSync(path.join(FIXTURE_DIR, "tengu.json")).size).toBeLessThan(400_000);
  });
});
```

- [ ] **Step 6: Run the test and the type checker**

Run: `npx vitest run tests/dogma/fixture.test.ts && npm run typecheck`
Expected: PASS, typecheck clean.

- [ ] **Step 7: Commit**

```bash
git add scripts/dogma-fixture.ts package.json tests/fixtures/dogma tests/dogma/fixture.ts tests/dogma/fixture.test.ts
git commit -m "test(dogma): DogmaData snapshot generator and the rifter/tengu fixtures

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: The item and fit model (`src/lib/dogma/fit.ts`)

**Files:**
- Create: `src/lib/dogma/fit.ts`, `tests/dogma/synthetic.ts`, `tests/dogma/fit.test.ts`

**Interfaces:**
- Consumes: Task 1 `data.ts`; Task 4 `fixtureData` (tests only).
- Produces:
```ts
export type SlotKind = "high" | "mid" | "low" | "rig" | "subsystem";
export type Hardpoint = "turret" | "launcher";
export type ItemDomain = "ship" | "character" | null;
export type ItemKind = "ship" | "character" | "module" | "rig" | "subsystem" | "charge" | "implant" | "skill" | "drone";
export const SLOT_KINDS: readonly SlotKind[];
export const HARDPOINTS: readonly Hardpoint[];
export const CHARACTER_TYPE_ID: number;                    // 0 — the synthetic character item
export class UnknownTypeError extends Error { readonly typeId: TypeId }
export interface Item {
  kind: ItemKind; typeId: TypeId; categoryId: number; groupId: GroupId; name: string | null;
  state: State; attrs: Map<AttrId, number>; effects: Map<EffectId, boolean>;
  charge?: Item; container?: Item; domain: ItemDomain; ownerModifiable: boolean;
}
export interface Slotted { item: Item; slot: SlotKind; index: number }
export interface Fit {
  data: DogmaData; ship: Item; character: Item;
  skills: Map<TypeId, Item>; implants: Item[]; modules: Slotted[]; drones: Item[];
}
export function slotOfType(type: DogmaType): SlotKind | null;
export function hardpointOfType(type: DogmaType): Hardpoint | null;
export function kindOfType(type: DogmaType): ItemKind;
export function defaultStateOfType(data: DogmaData, type: DogmaType, kind: ItemKind): State;
export function makeItem(data: DogmaData, typeId: TypeId, over?: { kind?: ItemKind; state?: State }): Item;
export function makeCharacter(): Item;
export function makeSkill(data: DogmaData, typeId: TypeId, level: number): Item;
export function attachCharge(module: Item, charge: Item): void;
export function slotOf(item: Item): SlotKind | null;
export function hardpointOf(item: Item): Hardpoint | null;
export function effectiveState(item: Item): State;
export function requiredSkills(item: Item): { skillTypeId: TypeId; level: number }[];
export function createFit(data: DogmaData, ship: Item): Fit;
export function addModule(fit: Fit, item: Item, slot: SlotKind, index: number): Slotted;
export function fitItems(fit: Fit): Item[];
```

**The EOS domain table (research §1.2) — reproduce it exactly:**

| kind | `domain` | `ownerModifiable` |
|---|---|---|
| ship, character | `null` | false |
| module, rig, subsystem | `"ship"` | false |
| charge | `"ship"` | **true** |
| implant, skill | `"character"` | false |
| drone | `null` | **true** |

Consequences: a `LocationModifier` with `domain: shipID` reaches the *modules on* the ship, never the ship
itself; drones are reachable only through `OwnerRequiredSkillModifier`.

**Other rules fixed here:**
- Slot markers, in this iteration order so a rig wins if a type carries two: `rigSlot` 2663 → rig,
  `loPower` 11 → low, `medPower` 13 → mid, `hiPower` 12 → high, `subSystem` 3772 → subsystem.
- Hardpoints: `turretFitted` 42, `launcherFitted` 40.
- A module/rig/subsystem defaults to **Active** when its type carries an effect whose required state is
  Active, or when it has `capacitorNeed` (6); otherwise **Online**. Everything else defaults to **Offline**.
  (Verified: no published category-6 hull carries a non-passive effect, so an Offline ship runs all of its
  own effects.)
- A charge has no state of its own — `effectiveState` returns its container's (EOS `ContainerStateMixin`).
- **`Fit` carries `data`.** Spec §2.2 lists only ship/character/skills/implants/modules/drones, but
  `getAttr(fit, item, attrId)` (spec §2.3) takes no data argument, so the fit has to know its own data set.
  Everything downstream reads `fit.data` rather than taking a second parameter.
- Skills are ordinary items whose attribute 280 `skillLevel` is seeded with the trained level. Nothing else
  is special-cased; the two-effect SDE pattern does the rest.
- The character is a synthetic item (`typeId` 0, category 1). Nothing in phase 4 modifies it, but
  `domain: charID` `ItemModifier`s must have somewhere to land.

- [ ] **Step 1: Write the synthetic-data builders**

Create `tests/dogma/synthetic.ts` (a helper, not a test file):
```ts
import {
  CATEGORY, Operator, State,
  type AttrId, type DogmaAttribute, type DogmaData, type DogmaEffect, type DogmaGroup, type DogmaType,
  type EffectId, type GroupId, type Modifier, type TypeId,
} from "../../src/lib/dogma/data.js";

export interface TypeOver {
  id?: TypeId; groupId?: GroupId; categoryId?: number; name?: string | null;
  attrs?: [AttrId, number][]; effects?: [EffectId, boolean][];
}

export interface World {
  data: DogmaData;
  attr(over?: Partial<DogmaAttribute>): DogmaAttribute;
  effect(over?: Partial<DogmaEffect>): DogmaEffect;
  group(categoryId: number): DogmaGroup;
  type(over?: TypeOver): DogmaType;
}

/** EOS's test harness shape: auto-allocated ids from 1 000 000 over an in-memory DogmaData. */
export function world(): World {
  let next = 1_000_000;
  const data: DogmaData = { attributes: new Map(), effects: new Map(), types: new Map(), groups: new Map() };

  const group = (categoryId: number): DogmaGroup => {
    const g: DogmaGroup = { id: next++, name: null, categoryId };
    data.groups.set(g.id, g);
    return g;
  };

  return {
    data,
    group,
    attr(over: Partial<DogmaAttribute> = {}): DogmaAttribute {
      const a: DogmaAttribute = { id: next++, name: null, defaultValue: 0, stackable: true, highIsGood: true, ...over };
      data.attributes.set(a.id, a);
      return a;
    },
    effect(over: Partial<DogmaEffect> = {}): DogmaEffect {
      const e: DogmaEffect = { id: next++, categoryId: 0, state: State.Offline, modifiers: [], ...over };
      data.effects.set(e.id, e);
      return e;
    },
    type(over: TypeOver = {}): DogmaType {
      const categoryId = over.categoryId ?? CATEGORY.module;
      const groupId = over.groupId ?? group(categoryId).id;
      if (!data.groups.has(groupId)) data.groups.set(groupId, { id: groupId, name: null, categoryId });
      const t: DogmaType = {
        id: over.id ?? next++, groupId, categoryId, name: over.name ?? null,
        attrs: new Map(over.attrs ?? []), effects: new Map(over.effects ?? []),
      };
      data.types.set(t.id, t);
      return t;
    },
  };
}

/** A Modifier with the common defaults filled in. */
export function mod(over: Partial<Modifier> & Pick<Modifier, "modifiedAttrId" | "modifyingAttrId">): Modifier {
  return { func: "ItemModifier", domain: "self", operation: Operator.PostPercent, ...over };
}
```

- [ ] **Step 2: Write the failing test**

Create `tests/dogma/fit.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { ATTR, CATEGORY, EFFECT, State } from "../../src/lib/dogma/data.js";
import {
  CHARACTER_TYPE_ID, HARDPOINTS, SLOT_KINDS, UnknownTypeError, addModule, attachCharge, createFit,
  defaultStateOfType, effectiveState, fitItems, hardpointOf, kindOfType, makeCharacter, makeItem,
  makeSkill, requiredSkills, slotOf,
} from "../../src/lib/dogma/fit.js";
import { fixtureData } from "./fixture.js";
import { world } from "./synthetic.js";

const data = fixtureData("rifter");
const tengu = fixtureData("tengu");

describe("kinds and the EOS domain table", () => {
  it("classifies every fixture type by category", () => {
    expect(kindOfType(data.types.get(587)!)).toBe("ship");
    expect(kindOfType(data.types.get(2889)!)).toBe("module");
    expect(kindOfType(data.types.get(31686)!)).toBe("rig");
    expect(kindOfType(data.types.get(12608)!)).toBe("charge");
    expect(kindOfType(data.types.get(3426)!)).toBe("skill");
    expect(kindOfType(data.types.get(27143)!)).toBe("implant");
    expect(kindOfType(data.types.get(2456)!)).toBe("drone");
    expect(kindOfType(tengu.types.get(45601)!)).toBe("subsystem");
  });

  it("gives each kind the domain and ownerModifiable flag EOS gives it", () => {
    const table: [number, "ship" | "character" | null, boolean][] = [
      [587, null, false],       // Ship
      [2889, "ship", false],    // Module
      [31686, "ship", false],   // Rig
      [12608, "ship", true],    // Charge — owner modifiable
      [27143, "character", false], // Implant
      [3426, "character", false],  // Skill
      [2456, null, true],       // Drone — owner modifiable
    ];
    for (const [typeId, domain, ownerModifiable] of table) {
      const item = makeItem(data, typeId);
      expect([item.typeId, item.domain, item.ownerModifiable]).toEqual([typeId, domain, ownerModifiable]);
    }
    const subsystem = makeItem(tengu, 45601);
    expect([subsystem.domain, subsystem.ownerModifiable]).toEqual(["ship", false]);
    const character = makeCharacter();
    expect([character.typeId, character.domain, character.ownerModifiable]).toEqual([CHARACTER_TYPE_ID, null, false]);
  });

  it("throws on a type this SDE build does not know", () => {
    expect(() => makeItem(data, 999999)).toThrow(UnknownTypeError);
  });
});

describe("slot and hardpoint markers", () => {
  it("reads the marker effects", () => {
    expect(slotOf(makeItem(data, 2889))).toBe("high");
    expect(slotOf(makeItem(data, 5443))).toBe("mid");
    expect(slotOf(makeItem(data, 2048))).toBe("low");
    expect(slotOf(makeItem(data, 31686))).toBe("rig");
    expect(slotOf(makeItem(tengu, 45601))).toBe("subsystem");
    expect(slotOf(makeItem(data, 12608))).toBeNull();
    expect(hardpointOf(makeItem(data, 2889))).toBe("turret");
    expect(hardpointOf(makeItem(data, 2048))).toBeNull();
    expect([...SLOT_KINDS]).toEqual(["high", "mid", "low", "rig", "subsystem"]);
    expect([...HARDPOINTS]).toEqual(["turret", "launcher"]);
  });

  it("lets the rig marker win when a type carries two markers", () => {
    const w = world();
    const type = w.type({ effects: [[EFFECT.loPower, false], [EFFECT.rigSlot, false]] });
    expect(slotOf(makeItem(w.data, type.id))).toBe("rig");
  });
});

describe("default state", () => {
  it("is Active for a type with an active-category effect or a capacitorNeed", () => {
    // 2889 carries effect 34 projectileFired (category 2 → active); 440 has capacitorNeed 40.
    expect(makeItem(data, 2889).state).toBe(State.Active);
    expect(makeItem(data, 440).state).toBe(State.Active);
  });

  it("is Online for a passive or online-only module and for a rig", () => {
    expect(makeItem(data, 2048).state).toBe(State.Online);
    expect(makeItem(data, 519).state).toBe(State.Online);
    expect(makeItem(data, 31686).state).toBe(State.Online);
    expect(makeItem(tengu, 45601).state).toBe(State.Online);
  });

  it("is Offline for the hull, skills, implants and drones", () => {
    expect(makeItem(data, 587).state).toBe(State.Offline);
    expect(makeItem(data, 3426).state).toBe(State.Offline);
    expect(makeItem(data, 27143).state).toBe(State.Offline);
    expect(makeItem(data, 2456).state).toBe(State.Offline);
  });

  it("honours an explicit state and can be asked for a type's default directly", () => {
    expect(makeItem(data, 2889, { state: State.Offline }).state).toBe(State.Offline);
    expect(defaultStateOfType(data, data.types.get(2048)!, "module")).toBe(State.Online);
  });
});

describe("items", () => {
  it("copies the type's attributes so per-item overrides do not leak", () => {
    const a = makeItem(data, 2889);
    const b = makeItem(data, 2889);
    a.attrs.set(ATTR.cpu, 1);
    expect(b.attrs.get(ATTR.cpu)).toBe(9);
    expect(data.types.get(2889)!.attrs.get(ATTR.cpu)).toBe(9);
  });

  it("seeds a skill's attribute 280 with the trained level", () => {
    const skill = makeSkill(data, 3426, 5);
    expect(skill.kind).toBe("skill");
    expect(skill.state).toBe(State.Offline);
    expect(skill.attrs.get(ATTR.skillLevel)).toBe(5);
    expect(makeSkill(data, 3426, 0).attrs.get(ATTR.skillLevel)).toBe(0);
  });

  it("links a charge to its container and makes it inherit the container's state", () => {
    const launcher = makeItem(data, 2889, { state: State.Active });
    const charge = makeItem(data, 12608);
    attachCharge(launcher, charge);
    expect(launcher.charge).toBe(charge);
    expect(charge.container).toBe(launcher);
    expect(effectiveState(charge)).toBe(State.Active);
    launcher.state = State.Offline;
    expect(effectiveState(charge)).toBe(State.Offline);
    expect(effectiveState(launcher)).toBe(State.Offline);
  });

  it("reads the six requiredSkill pairs", () => {
    expect(requiredSkills(makeItem(data, 2889))).toEqual([
      { skillTypeId: 3302, level: 5 }, { skillTypeId: 3300, level: 2 }, { skillTypeId: 11084, level: 1 },
    ]);
    expect(requiredSkills(makeItem(data, 587))).toEqual([{ skillTypeId: 3329, level: 1 }]);
    expect(requiredSkills(makeItem(data, 31686))).toEqual([]);
  });
});

describe("fit", () => {
  it("starts empty around a hull and its synthetic character", () => {
    const fit = createFit(data, makeItem(data, 587));
    expect(fit.data).toBe(data);
    expect(fit.ship.typeId).toBe(587);
    expect(fit.character.typeId).toBe(CHARACTER_TYPE_ID);
    expect(fit.modules).toEqual([]);
    expect(fit.drones).toEqual([]);
    expect(fit.implants).toEqual([]);
    expect(fit.skills.size).toBe(0);
  });

  it("collects every item, charges included, exactly once", () => {
    const fit = createFit(data, makeItem(data, 587));
    const gun = makeItem(data, 2889);
    attachCharge(gun, makeItem(data, 12608));
    addModule(fit, gun, "high", 0);
    addModule(fit, makeItem(data, 2048), "low", 0);
    fit.skills.set(3426, makeSkill(data, 3426, 5));
    fit.implants.push(makeItem(data, 27143));
    fit.drones.push(makeItem(data, 2456));
    const items = fitItems(fit);
    expect(items).toHaveLength(8);           // ship, character, skill, implant, 2 modules, 1 charge, 1 drone
    expect(new Set(items).size).toBe(8);
    expect(items).toContain(fit.ship);
    expect(items).toContain(fit.character);
    expect(items).toContain(gun.charge);
  });

  it("records the slot and index of each module", () => {
    const fit = createFit(data, makeItem(data, 587));
    const slotted = addModule(fit, makeItem(data, 2889), "high", 2);
    expect(slotted).toEqual({ item: fit.modules[0].item, slot: "high", index: 2 });
    expect(fit.modules).toEqual([slotted]);
  });
});
```

- [ ] **Step 3: Run the test and watch it fail**

Run: `npx vitest run tests/dogma/fit.test.ts`
Expected: FAIL — `Failed to resolve import "../../src/lib/dogma/fit.js"`.

- [ ] **Step 4: Write `src/lib/dogma/fit.ts`**

```ts
/**
 * The item and fit model — EOS's `eos/item/*` collapsed into one tagged record.
 *
 * The two properties that drive everything are `domain` and `ownerModifiable`: together they decide
 * which items a LocationModifier / OwnerRequiredSkillModifier can reach (research §1.2).
 */
import {
  ATTR, CATEGORY, EFFECT, REQUIRED_SKILL_ATTRS, State,
  type AttrId, type DogmaData, type DogmaType, type EffectId, type GroupId, type TypeId,
} from "./data.js";

export type SlotKind = "high" | "mid" | "low" | "rig" | "subsystem";
export type Hardpoint = "turret" | "launcher";
export type ItemDomain = "ship" | "character" | null;
export type ItemKind =
  | "ship" | "character" | "module" | "rig" | "subsystem" | "charge" | "implant" | "skill" | "drone";

export const SLOT_KINDS: readonly SlotKind[] = ["high", "mid", "low", "rig", "subsystem"];
export const HARDPOINTS: readonly Hardpoint[] = ["turret", "launcher"];

/** The character is synthetic: the SDE has no "the pilot" type. */
export const CHARACTER_TYPE_ID = 0;
const CHARACTER_CATEGORY_ID = 1;

export class UnknownTypeError extends Error {
  constructor(readonly typeId: TypeId) {
    super(`unknown type ${typeId}`);
    this.name = "UnknownTypeError";
  }
}

export interface Item {
  kind: ItemKind;
  typeId: TypeId;
  categoryId: number;
  groupId: GroupId;
  name: string | null;
  state: State;
  attrs: Map<AttrId, number>;
  /** effectId → isDefault */
  effects: Map<EffectId, boolean>;
  charge?: Item;
  container?: Item;
  domain: ItemDomain;
  ownerModifiable: boolean;
}

export interface Slotted {
  item: Item;
  slot: SlotKind;
  index: number;
}

export interface Fit {
  data: DogmaData;
  ship: Item;
  character: Item;
  skills: Map<TypeId, Item>;
  implants: Item[];
  modules: Slotted[];
  drones: Item[];
}

/** research §1.2 — copied from EOS's per-class `_modifier_domain` / `_owner_modifiable`. */
const DOMAIN_TABLE: Record<ItemKind, { domain: ItemDomain; ownerModifiable: boolean }> = {
  ship: { domain: null, ownerModifiable: false },
  character: { domain: null, ownerModifiable: false },
  module: { domain: "ship", ownerModifiable: false },
  rig: { domain: "ship", ownerModifiable: false },
  subsystem: { domain: "ship", ownerModifiable: false },
  charge: { domain: "ship", ownerModifiable: true },
  implant: { domain: "character", ownerModifiable: false },
  skill: { domain: "character", ownerModifiable: false },
  drone: { domain: null, ownerModifiable: true },
};

/** Iteration order matters — a rig wins if a type carries two markers (Pyfa module.py:863). */
const SLOT_MARKERS: readonly (readonly [EffectId, SlotKind])[] = [
  [EFFECT.rigSlot, "rig"], [EFFECT.loPower, "low"], [EFFECT.medPower, "mid"],
  [EFFECT.hiPower, "high"], [EFFECT.subSystem, "subsystem"],
];

const HARDPOINT_MARKERS: readonly (readonly [EffectId, Hardpoint])[] = [
  [EFFECT.turretFitted, "turret"], [EFFECT.launcherFitted, "launcher"],
];

export function slotOfType(type: DogmaType): SlotKind | null {
  for (const [effectId, slot] of SLOT_MARKERS) if (type.effects.has(effectId)) return slot;
  return null;
}

export function hardpointOfType(type: DogmaType): Hardpoint | null {
  for (const [effectId, hardpoint] of HARDPOINT_MARKERS) if (type.effects.has(effectId)) return hardpoint;
  return null;
}

export function kindOfType(type: DogmaType): ItemKind {
  switch (type.categoryId) {
    case CATEGORY.ship: return "ship";
    case CATEGORY.charge: return "charge";
    case CATEGORY.skill: return "skill";
    case CATEGORY.implant: return "implant";
    case CATEGORY.subsystem: return "subsystem";
    case CATEGORY.drone:
    case CATEGORY.fighter: return "drone";
    default: return slotOfType(type) === "rig" ? "rig" : "module";
  }
}

/**
 * Modules come up Active when they can be activated, otherwise Online. Everything else is Offline —
 * including the hull, which is safe because no published category-6 type carries a non-passive effect.
 */
export function defaultStateOfType(data: DogmaData, type: DogmaType, kind: ItemKind): State {
  if (kind !== "module" && kind !== "rig" && kind !== "subsystem") return State.Offline;
  for (const effectId of type.effects.keys()) {
    const effect = data.effects.get(effectId);
    if (effect && effect.state === State.Active) return State.Active;
  }
  return type.attrs.has(ATTR.capacitorNeed) ? State.Active : State.Online;
}

export function makeItem(
  data: DogmaData, typeId: TypeId, over: { kind?: ItemKind; state?: State } = {},
): Item {
  const type = data.types.get(typeId);
  if (!type) throw new UnknownTypeError(typeId);
  const kind = over.kind ?? kindOfType(type);
  const { domain, ownerModifiable } = DOMAIN_TABLE[kind];
  return {
    kind,
    typeId: type.id,
    categoryId: type.categoryId,
    groupId: type.groupId,
    name: type.name,
    state: over.state ?? defaultStateOfType(data, type, kind),
    attrs: new Map(type.attrs),
    effects: new Map(type.effects),
    domain,
    ownerModifiable,
  };
}

export function makeCharacter(): Item {
  return {
    kind: "character",
    typeId: CHARACTER_TYPE_ID,
    categoryId: CHARACTER_CATEGORY_ID,
    groupId: 0,
    name: null,
    state: State.Offline,
    attrs: new Map<AttrId, number>(),
    effects: new Map<EffectId, boolean>(),
    domain: null,
    ownerModifiable: false,
  };
}

/**
 * A skill is an ordinary item whose attribute 280 is seeded with the trained level. The SDE's
 * two-effect pattern (a preMul of the bonus attribute by 280 on the skill, then a postPercent of the
 * target attribute by the bonus attribute) does the rest with no special casing.
 */
export function makeSkill(data: DogmaData, typeId: TypeId, level: number): Item {
  const skill = makeItem(data, typeId, { kind: "skill", state: State.Offline });
  skill.attrs.set(ATTR.skillLevel, level);
  return skill;
}

export function attachCharge(module: Item, charge: Item): void {
  module.charge = charge;
  charge.container = module;
}

export function slotOf(item: Item): SlotKind | null {
  for (const [effectId, slot] of SLOT_MARKERS) if (item.effects.has(effectId)) return slot;
  return null;
}

export function hardpointOf(item: Item): Hardpoint | null {
  for (const [effectId, hardpoint] of HARDPOINT_MARKERS) if (item.effects.has(effectId)) return hardpoint;
  return null;
}

/** A charge has no state of its own (EOS ContainerStateMixin). */
export function effectiveState(item: Item): State {
  return item.container ? item.container.state : item.state;
}

export function requiredSkills(item: Item): { skillTypeId: TypeId; level: number }[] {
  const out: { skillTypeId: TypeId; level: number }[] = [];
  for (const [skillAttr, levelAttr] of REQUIRED_SKILL_ATTRS) {
    const skill = item.attrs.get(skillAttr);
    if (skill === undefined || skill <= 0) continue;
    out.push({ skillTypeId: Math.round(skill), level: Math.round(item.attrs.get(levelAttr) ?? 0) });
  }
  return out;
}

export function createFit(data: DogmaData, ship: Item): Fit {
  return {
    data, ship, character: makeCharacter(),
    skills: new Map<TypeId, Item>(), implants: [], modules: [], drones: [],
  };
}

export function addModule(fit: Fit, item: Item, slot: SlotKind, index: number): Slotted {
  const slotted: Slotted = { item, slot, index };
  fit.modules.push(slotted);
  return slotted;
}

/** Every item in the fit, each exactly once. Charges follow their module. */
export function fitItems(fit: Fit): Item[] {
  const items: Item[] = [fit.ship, fit.character];
  for (const skill of fit.skills.values()) items.push(skill);
  for (const implant of fit.implants) items.push(implant);
  for (const { item } of fit.modules) {
    items.push(item);
    if (item.charge) items.push(item.charge);
  }
  for (const drone of fit.drones) items.push(drone);
  return items;
}
```

- [ ] **Step 5: Run the test and the type checker**

Run: `npx vitest run tests/dogma/fit.test.ts && npm run typecheck`
Expected: PASS, typecheck clean.

- [ ] **Step 6: Commit**

```bash
git add src/lib/dogma/fit.ts tests/dogma/synthetic.ts tests/dogma/fit.test.ts
git commit -m "feat(dogma): item and fit model with the EOS domain table

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: Effect gating and full compliance (`src/lib/dogma/effects.ts`)

**Files:**
- Create: `src/lib/dogma/effects.ts`, `tests/dogma/effects.test.ts`

**Interfaces:**
- Consumes: Task 1 `EFFECT`, `State`, `DogmaEffect`, `Modifier`; Task 5 `Fit`, `Item`, `effectiveState`, `fitItems`.
- Produces:
```ts
export interface CarriedModifier { carrier: Item; effect: DogmaEffect; modifier: Modifier }
export function effectRuns(item: Item, effect: DogmaEffect, isDefault: boolean): boolean;
export function runningEffects(fit: Fit, item: Item): DogmaEffect[];
export function activeModifiers(fit: Fit): CarriedModifier[];
```

**The gate (spec §2.3 step 2, research §2.7) — the state check plus EOS's three full-compliance rules:**
0. `effectiveState(item) >= effect.state` (a charge uses its container's state).
1. An **offline-state** (passive/system) effect that declares a `fittingUsageChanceAttributeID` is
   suppressed — this is how booster side-effects are off by default.
2. An **online-category** effect requires the item's own `online` effect (id 16) to be present and running.
   `online` itself is exempt, because EOS resolves it first — everything else depends on it.
3. An **active/target-category** effect runs only when it is the type's `isDefault` effect, so a module
   with several active effects fires exactly one.

An effect id the loader dropped (category 3 or 6) is simply skipped.

- [ ] **Step 1: Write the failing test**

Create `tests/dogma/effects.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { EFFECT, State } from "../../src/lib/dogma/data.js";
import { addModule, attachCharge, createFit, makeItem, makeSkill } from "../../src/lib/dogma/fit.js";
import { activeModifiers, effectRuns, runningEffects } from "../../src/lib/dogma/effects.js";
import { fixtureData } from "./fixture.js";
import { mod, world } from "./synthetic.js";

const data = fixtureData("rifter");
const ids = (fit: Parameters<typeof runningEffects>[0], item: Parameters<typeof runningEffects>[1]) =>
  runningEffects(fit, item).map((e) => e.id).sort((a, b) => a - b);

describe("state gating", () => {
  it("runs an active-category default effect only at Active", () => {
    // 2889: 12 hiPower + 42 turretFitted (passive), 16 online, 34 projectileFired (active, isDefault),
    // 263 barrage (active, not default), 253/254 passive, 3025 overload.
    const fit = createFit(data, makeItem(data, 587));
    const gun = makeItem(data, 2889, { state: State.Active });
    addModule(fit, gun, "high", 0);
    expect(ids(fit, gun)).toContain(34);
    gun.state = State.Online;
    expect(ids(fit, gun)).not.toContain(34);
    expect(ids(fit, gun)).toContain(EFFECT.online);
  });

  it("never runs a non-default active effect, even overloaded", () => {
    const fit = createFit(data, makeItem(data, 587));
    const gun = makeItem(data, 2889, { state: State.Overload });
    addModule(fit, gun, "high", 0);
    expect(ids(fit, gun)).not.toContain(263);
  });

  it("runs an overload-category effect only at Overload", () => {
    const fit = createFit(data, makeItem(data, 587));
    const gun = makeItem(data, 2889, { state: State.Active });
    addModule(fit, gun, "high", 0);
    expect(ids(fit, gun)).not.toContain(3025);
    gun.state = State.Overload;
    expect(ids(fit, gun)).toContain(3025);
  });

  it("runs passive markers even offline, but stops the online effect", () => {
    const fit = createFit(data, makeItem(data, 587));
    const gun = makeItem(data, 2889, { state: State.Offline });
    addModule(fit, gun, "high", 0);
    expect(ids(fit, gun)).toContain(EFFECT.turretFitted);
    expect(ids(fit, gun)).not.toContain(EFFECT.online);
  });

  it("runs a rig's passive effects offline", () => {
    const fit = createFit(data, makeItem(data, 587));
    const rig = makeItem(data, 31686, { state: State.Offline });
    addModule(fit, rig, "rig", 0);
    expect(ids(fit, rig)).toContain(EFFECT.rigSlot);
  });
});

describe("full compliance", () => {
  it("requires the online effect for an online-category effect", () => {
    // Gyrostabilizer II's damage/rof effects (89, 92) are category 4 and it does carry `online`.
    const fit = createFit(data, makeItem(data, 587));
    const gyro = makeItem(data, 519, { state: State.Online });
    addModule(fit, gyro, "low", 0);
    expect(ids(fit, gyro)).toEqual([EFFECT.loPower, EFFECT.online, 89, 92].sort((a, b) => a - b));   // loPower is category 0 → runs at any state
    gyro.state = State.Offline;
    expect(ids(fit, gyro)).toEqual([EFFECT.loPower]);
  });

  it("suppresses an online-category effect on a type that has no online effect", () => {
    const w = world();
    const online = w.effect({ categoryId: 4, state: State.Online, modifiers: [mod({ modifiedAttrId: 1, modifyingAttrId: 2 })] });
    const type = w.type({ effects: [[online.id, false]] });
    const fit = createFit(w.data, makeItem(w.data, w.type({ categoryId: 6 }).id));
    const item = makeItem(w.data, type.id, { state: State.Online });
    addModule(fit, item, "low", 0);
    expect(effectRuns(item, online, false)).toBe(false);
  });

  it("suppresses an offline effect that declares a fitting usage chance", () => {
    const w = world();
    const chance = w.attr();
    const side = w.effect({ categoryId: 0, state: State.Offline, fittingUsageChanceAttrId: chance.id });
    const plain = w.effect({ categoryId: 0, state: State.Offline });
    const type = w.type({ categoryId: 20, effects: [[side.id, false], [plain.id, false]] });
    const fit = createFit(w.data, makeItem(w.data, w.type({ categoryId: 6 }).id));
    const implant = makeItem(w.data, type.id);
    fit.implants.push(implant);
    expect(ids(fit, implant)).toEqual([plain.id]);
  });

  it("skips an effect id the loader dropped", () => {
    const w = world();
    const type = w.type({ effects: [[424242, false]] });
    const fit = createFit(w.data, makeItem(w.data, w.type({ categoryId: 6 }).id));
    const item = makeItem(w.data, type.id);
    addModule(fit, item, "low", 0);
    expect(runningEffects(fit, item)).toEqual([]);
  });
});

describe("charges", () => {
  it("gates a charge's effects on its container's state", () => {
    const w = world();
    const onlineMarker = w.effect({ id: EFFECT.online, categoryId: 4, state: State.Online });
    const boost = w.effect({ categoryId: 4, state: State.Online, modifiers: [mod({ modifiedAttrId: 1, modifyingAttrId: 2 })] });
    const chargeType = w.type({ categoryId: 8, effects: [[onlineMarker.id, false], [boost.id, false]] });
    const moduleType = w.type({ effects: [[EFFECT.hiPower, false]] });
    const fit = createFit(w.data, makeItem(w.data, w.type({ categoryId: 6 }).id));
    const module = makeItem(w.data, moduleType.id, { state: State.Online });
    const charge = makeItem(w.data, chargeType.id);
    attachCharge(module, charge);
    addModule(fit, module, "high", 0);
    expect(runningEffects(fit, charge).map((e) => e.id)).toContain(boost.id);
    module.state = State.Offline;
    expect(runningEffects(fit, charge)).toEqual([]);
  });
});

describe("activeModifiers", () => {
  it("collects every running modifier in the fit with its carrier", () => {
    const fit = createFit(data, makeItem(data, 587));
    fit.skills.set(3426, makeSkill(data, 3426, 5));
    const collected = activeModifiers(fit);
    // CPU Management carries 132 (1 surviving modifier), 368 and 397; the Rifter carries 5779 and 7248.
    const byEffect = new Map(collected.map((c) => [c.effect.id, c]));
    expect(byEffect.get(368)!.carrier).toBe(fit.skills.get(3426));
    expect(byEffect.get(397)!.modifier.modifiedAttrId).toBe(48);
    expect(byEffect.get(7248)!.carrier).toBe(fit.ship);
    expect(collected.filter((c) => c.effect.id === 132)).toHaveLength(1);
  });

  it("drops the modifiers of an effect that has stopped running", () => {
    const fit = createFit(data, makeItem(data, 587));
    const gyro = makeItem(data, 519, { state: State.Online });
    addModule(fit, gyro, "low", 0);
    expect(activeModifiers(fit).some((c) => c.effect.id === 92)).toBe(true);
    gyro.state = State.Offline;
    expect(activeModifiers(fit).some((c) => c.effect.id === 92)).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test and watch it fail**

Run: `npx vitest run tests/dogma/effects.test.ts`
Expected: FAIL — `Failed to resolve import "../../src/lib/dogma/effects.js"`.

- [ ] **Step 3: Write `src/lib/dogma/effects.ts`**

```ts
/**
 * Which effects are running on which carrier.
 *
 * The state check alone is not enough: EOS's default "full compliance" mode adds three rules
 * (eos/effect_status.py:106) and all three matter for a fitting window. See research §2.7.
 */
import { EFFECT, State, type DogmaEffect, type Modifier } from "./data.js";
import { effectiveState, fitItems, type Fit, type Item } from "./fit.js";

export interface CarriedModifier {
  carrier: Item;
  effect: DogmaEffect;
  modifier: Modifier;
}

export function effectRuns(item: Item, effect: DogmaEffect, isDefault: boolean): boolean {
  if (effectiveState(item) < effect.state) return false;
  // 1. Offline-state effects with a fitting-usage chance are off by default (booster side effects).
  if (effect.state === State.Offline && effect.fittingUsageChanceAttrId !== undefined) return false;
  // 2. Online-category effects need the carrier's own `online` effect. `online` resolves first, so it
  //    is exempt from its own rule; without this exemption nothing online would ever run.
  if (effect.state === State.Online && effect.id !== EFFECT.online && !item.effects.has(EFFECT.online)) {
    return false;
  }
  // 3. Active/target-category effects run only as the type's default effect, so exactly one fires.
  if (effect.state === State.Active && !isDefault) return false;
  return true;
}

export function runningEffects(fit: Fit, item: Item): DogmaEffect[] {
  const out: DogmaEffect[] = [];
  for (const [effectId, isDefault] of item.effects) {
    const effect = fit.data.effects.get(effectId);
    if (!effect) continue;                    // dropped at load time (effect category 3 or 6)
    if (effectRuns(item, effect, isDefault)) out.push(effect);
  }
  return out;
}

/** Every running (carrier, effect, modifier) triple in the fit. The calculator caches this per pass. */
export function activeModifiers(fit: Fit): CarriedModifier[] {
  const out: CarriedModifier[] = [];
  for (const carrier of fitItems(fit)) {
    for (const effect of runningEffects(fit, carrier)) {
      for (const modifier of effect.modifiers) out.push({ carrier, effect, modifier });
    }
  }
  return out;
}
```

- [ ] **Step 4: Run the test and the type checker**

Run: `npx vitest run tests/dogma/effects.test.ts && npm run typecheck`
Expected: PASS, typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add src/lib/dogma/effects.ts tests/dogma/effects.test.ts
git commit -m "feat(dogma): effect state gating and EOS full-compliance rules

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 7: Affectee resolution (`src/lib/dogma/affection.ts`)

**Files:**
- Create: `src/lib/dogma/affection.ts`, `tests/dogma/affection.test.ts`

**Interfaces:**
- Consumes: Task 1 `ModifierDomain`; Task 5 `Fit`, `Item`, `ItemDomain`, `requiredSkills`; Task 6 `CarriedModifier`.
- Produces:
```ts
export function affects(fit: Fit, carried: CarriedModifier, target: Item): boolean;
export function itemForDomain(fit: Fit, carrier: Item, domain: ModifierDomain): Item | null;
export function absoluteDomain(fit: Fit, carrier: Item, domain: ModifierDomain): ItemDomain;
export function itemRequiresSkill(item: Item, skillTypeId: TypeId): boolean;
```

**The rules (spec §2.3 step 2, research §1.2/§2.2):**
- `ItemModifier` → exactly the one item `itemForDomain` resolves: `self`/`itemID` = the carrier,
  `character` = `fit.character`, `ship` = `fit.ship`, `other` = the module↔charge sibling.
- `LocationModifier` → every item **in** the resolved domain bucket. `self` first resolves to an absolute
  domain: on the ship it becomes `ship`, on the character `character`, on anything else the modifier is
  skipped (EOS `affection.py:607`). `other` has no bucket, so those are skipped too.
  **The ship and the character are in no bucket** — `domain: shipID` reaches the modules *on* the ship,
  never the ship itself.
- `LocationGroupModifier` → the same bucket, filtered to `target.groupId === modifier.groupId`.
- `LocationRequiredSkillModifier` → the same bucket, filtered to targets whose `requiredSkillN` attributes
  name `modifier.skillTypeId`.
- `OwnerRequiredSkillModifier` → **domain-independent**: every `ownerModifiable` item (charges, drones,
  fighters) that requires that skill.

- [ ] **Step 1: Write the failing test**

Create `tests/dogma/affection.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { Operator, State } from "../../src/lib/dogma/data.js";
import { addModule, attachCharge, createFit, makeItem, makeSkill } from "../../src/lib/dogma/fit.js";
import type { CarriedModifier } from "../../src/lib/dogma/effects.js";
import { absoluteDomain, affects, itemForDomain, itemRequiresSkill } from "../../src/lib/dogma/affection.js";
import { fixtureData } from "./fixture.js";
import { mod, world } from "./synthetic.js";

const data = fixtureData("rifter");

/** A Rifter with a gun (+ charge), a rig, a drone, a skill and an implant. */
function harness() {
  const fit = createFit(data, makeItem(data, 587));
  const gun = makeItem(data, 2889, { state: State.Active });
  const charge = makeItem(data, 12608);
  attachCharge(gun, charge);
  addModule(fit, gun, "high", 0);
  const rig = makeItem(data, 31686);
  addModule(fit, rig, "rig", 0);
  const skill = makeSkill(data, 3318, 5);
  fit.skills.set(3318, skill);
  const implant = makeItem(data, 27143);
  fit.implants.push(implant);
  const drone = makeItem(data, 2456);
  fit.drones.push(drone);
  return { fit, gun, charge, rig, skill, implant, drone };
}

const carry = (carrier: ReturnType<typeof makeItem>, modifier: Parameters<typeof mod>[0]): CarriedModifier =>
  ({ carrier, effect: { id: 1, categoryId: 0, state: State.Offline, modifiers: [] }, modifier: mod(modifier) });

describe("itemForDomain", () => {
  it("resolves self, character, ship and other", () => {
    const h = harness();
    expect(itemForDomain(h.fit, h.gun, "self")).toBe(h.gun);
    expect(itemForDomain(h.fit, h.gun, "character")).toBe(h.fit.character);
    expect(itemForDomain(h.fit, h.gun, "ship")).toBe(h.fit.ship);
    expect(itemForDomain(h.fit, h.gun, "other")).toBe(h.charge);
    expect(itemForDomain(h.fit, h.charge, "other")).toBe(h.gun);
    expect(itemForDomain(h.fit, h.rig, "other")).toBeNull();
  });
});

describe("absoluteDomain", () => {
  it("resolves `self` against the carrier and refuses anything but ship or character", () => {
    const h = harness();
    expect(absoluteDomain(h.fit, h.fit.ship, "self")).toBe("ship");
    expect(absoluteDomain(h.fit, h.fit.character, "self")).toBe("character");
    expect(absoluteDomain(h.fit, h.gun, "self")).toBeNull();
    expect(absoluteDomain(h.fit, h.gun, "ship")).toBe("ship");
    expect(absoluteDomain(h.fit, h.gun, "character")).toBe("character");
    expect(absoluteDomain(h.fit, h.gun, "other")).toBeNull();
  });
});

describe("ItemModifier", () => {
  it("hits exactly one item", () => {
    const h = harness();
    const m = carry(h.skill, { func: "ItemModifier", domain: "ship", modifiedAttrId: 48, modifyingAttrId: 310 });
    expect(affects(h.fit, m, h.fit.ship)).toBe(true);
    expect(affects(h.fit, m, h.gun)).toBe(false);
    expect(affects(h.fit, m, h.fit.character)).toBe(false);
  });

  it("with domain self hits only the carrier", () => {
    const h = harness();
    const m = carry(h.skill, { func: "ItemModifier", domain: "self", modifiedAttrId: 310, modifyingAttrId: 280, operation: Operator.PreMul });
    expect(affects(h.fit, m, h.skill)).toBe(true);
    expect(affects(h.fit, m, h.fit.ship)).toBe(false);
  });
});

describe("LocationModifier", () => {
  it("reaches the items on the ship but never the ship or the character", () => {
    const h = harness();
    const m = carry(h.skill, { func: "LocationModifier", domain: "ship", modifiedAttrId: 50, modifyingAttrId: 310 });
    expect(affects(h.fit, m, h.gun)).toBe(true);
    expect(affects(h.fit, m, h.rig)).toBe(true);
    expect(affects(h.fit, m, h.charge)).toBe(true);      // charges are in the ship bucket
    expect(affects(h.fit, m, h.fit.ship)).toBe(false);
    expect(affects(h.fit, m, h.fit.character)).toBe(false);
    expect(affects(h.fit, m, h.implant)).toBe(false);
    expect(affects(h.fit, m, h.drone)).toBe(false);      // drones are in no bucket
  });

  it("reaches implants and skills in the character bucket", () => {
    const h = harness();
    const m = carry(h.fit.character, { func: "LocationModifier", domain: "character", modifiedAttrId: 50, modifyingAttrId: 310 });
    expect(affects(h.fit, m, h.implant)).toBe(true);
    expect(affects(h.fit, m, h.skill)).toBe(true);
    expect(affects(h.fit, m, h.fit.character)).toBe(false);
    expect(affects(h.fit, m, h.gun)).toBe(false);
  });

  it("is skipped when `self` cannot be resolved to a bucket", () => {
    const h = harness();
    const m = carry(h.gun, { func: "LocationModifier", domain: "self", modifiedAttrId: 50, modifyingAttrId: 310 });
    expect(affects(h.fit, m, h.rig)).toBe(false);
    expect(affects(h.fit, m, h.gun)).toBe(false);
  });
});

describe("LocationGroupModifier", () => {
  it("filters the bucket by group", () => {
    const h = harness();
    const m = carry(h.skill, { func: "LocationGroupModifier", domain: "ship", groupId: 55, modifiedAttrId: 64, modifyingAttrId: 64 });
    expect(affects(h.fit, m, h.gun)).toBe(true);        // 200mm AutoCannon II is group 55
    expect(affects(h.fit, m, h.rig)).toBe(false);       // group 777
  });
});

describe("LocationRequiredSkillModifier", () => {
  it("filters the bucket by the affectee's required skills", () => {
    const h = harness();
    // Weapon Upgrades' effect 581: modules on the ship requiring Gunnery (3300).
    const m = carry(h.skill, { func: "LocationRequiredSkillModifier", domain: "ship", skillTypeId: 3300, modifiedAttrId: 50, modifyingAttrId: 310 });
    expect(affects(h.fit, m, h.gun)).toBe(true);        // 2889 requiredSkill2 = 3300
    expect(affects(h.fit, m, h.rig)).toBe(false);       // the rig requires nothing
    expect(affects(h.fit, m, h.fit.ship)).toBe(false);
  });

  it("matches any of the six requiredSkill slots", () => {
    const h = harness();
    for (const [skillTypeId, expected] of [[3302, true], [11084, true], [3319, false]] as const) {
      const m = carry(h.skill, { func: "LocationRequiredSkillModifier", domain: "ship", skillTypeId, modifiedAttrId: 50, modifyingAttrId: 310 });
      expect(affects(h.fit, m, h.gun)).toBe(expected);
    }
  });
});

describe("OwnerRequiredSkillModifier", () => {
  it("reaches owner-modifiable items anywhere in the fit, ignoring the domain", () => {
    const h = harness();
    // Hail S requires 11084; Hobgoblin II requires 24241.
    const toCharge = carry(h.skill, { func: "OwnerRequiredSkillModifier", domain: "character", skillTypeId: 11084, modifiedAttrId: 64, modifyingAttrId: 310 });
    expect(affects(h.fit, toCharge, h.charge)).toBe(true);
    expect(affects(h.fit, toCharge, h.gun)).toBe(false);        // the gun also requires 11084 but is not owner-modifiable
    const toDrone = carry(h.skill, { func: "OwnerRequiredSkillModifier", domain: "character", skillTypeId: 24241, modifiedAttrId: 64, modifyingAttrId: 310 });
    expect(affects(h.fit, toDrone, h.drone)).toBe(true);
    expect(affects(h.fit, toDrone, h.charge)).toBe(false);
  });
});

describe("itemRequiresSkill", () => {
  it("reads the six requiredSkill attributes", () => {
    const w = world();
    const type = w.type({ attrs: [[182, 3300], [277, 5], [1290, 1234], [1288, 2]] });
    const item = makeItem(w.data, type.id);
    expect(itemRequiresSkill(item, 3300)).toBe(true);
    expect(itemRequiresSkill(item, 1234)).toBe(true);
    expect(itemRequiresSkill(item, 9999)).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test and watch it fail**

Run: `npx vitest run tests/dogma/affection.test.ts`
Expected: FAIL — `Failed to resolve import "../../src/lib/dogma/affection.js"`.

- [ ] **Step 3: Write `src/lib/dogma/affection.ts`**

```ts
/**
 * Which items a running modifier reaches (EOS eos/calculator/affection.py).
 *
 * The whole thing hangs off Item.domain / Item.ownerModifiable (research §1.2): a `domain: shipID`
 * location filter sees the modules *on* the ship, never the ship itself, and drones are reachable
 * only through OwnerRequiredSkillModifier.
 */
import { REQUIRED_SKILL_ATTRS, type ModifierDomain, type TypeId } from "./data.js";
import type { CarriedModifier } from "./effects.js";
import type { Fit, Item, ItemDomain } from "./fit.js";

/** The single item an ItemModifier names. */
export function itemForDomain(fit: Fit, carrier: Item, domain: ModifierDomain): Item | null {
  switch (domain) {
    case "self": return carrier;
    case "character": return fit.character;
    case "ship": return fit.ship;
    case "other": return carrier.charge ?? carrier.container ?? null;
  }
}

/**
 * The bucket an en-masse filter iterates. `self` is resolved against the carrier first: on the ship it
 * is `ship`, on the character `character`, on anything else the modifier is unusable and skipped.
 */
export function absoluteDomain(fit: Fit, carrier: Item, domain: ModifierDomain): ItemDomain {
  switch (domain) {
    case "ship": return "ship";
    case "character": return "character";
    case "other": return null;              // EOS has no location bucket for `other`
    case "self":
      if (carrier === fit.ship) return "ship";
      if (carrier === fit.character) return "character";
      return null;
  }
}

export function itemRequiresSkill(item: Item, skillTypeId: TypeId): boolean {
  for (const [skillAttr] of REQUIRED_SKILL_ATTRS) {
    const value = item.attrs.get(skillAttr);
    if (value !== undefined && Math.round(value) === skillTypeId) return true;
  }
  return false;
}

export function affects(fit: Fit, carried: CarriedModifier, target: Item): boolean {
  const { carrier, modifier } = carried;
  switch (modifier.func) {
    case "ItemModifier":
      return itemForDomain(fit, carrier, modifier.domain) === target;
    case "LocationModifier":
      return inBucket(fit, carrier, modifier.domain, target);
    case "LocationGroupModifier":
      return modifier.groupId !== undefined
        && target.groupId === modifier.groupId
        && inBucket(fit, carrier, modifier.domain, target);
    case "LocationRequiredSkillModifier":
      return modifier.skillTypeId !== undefined
        && itemRequiresSkill(target, modifier.skillTypeId)
        && inBucket(fit, carrier, modifier.domain, target);
    case "OwnerRequiredSkillModifier":
      // Domain-independent: every owner-modifiable item requiring the skill (charges, drones, fighters).
      return modifier.skillTypeId !== undefined
        && target.ownerModifiable
        && itemRequiresSkill(target, modifier.skillTypeId);
  }
}

function inBucket(fit: Fit, carrier: Item, domain: ModifierDomain, target: Item): boolean {
  const bucket = absoluteDomain(fit, carrier, domain);
  return bucket !== null && target.domain === bucket;
}
```

- [ ] **Step 4: Run the test and the type checker**

Run: `npx vitest run tests/dogma/affection.test.ts && npm run typecheck`
Expected: PASS, typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add src/lib/dogma/affection.ts tests/dogma/affection.test.ts
git commit -m "feat(dogma): affectee resolution for the five modifier functions

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 8: The calculator (`src/lib/dogma/calc.ts`)

**Files:**
- Create: `src/lib/dogma/calc.ts`, `tests/dogma/calc.test.ts`

**Interfaces:**
- Consumes: Task 1 `OPERATOR_ORDER`, `Operator`, `PENALTY_IMMUNE_CATEGORY_IDS`, `ROUNDED_ATTR_IDS`;
  Task 2 `normalise`, `penalizeValues`, `isPenalizable`, `round2`; Task 5 `Fit`, `Item`; Task 6
  `activeModifiers`, `CarriedModifier`; Task 7 `affects`.
- Produces:
```ts
export class UnknownAttributeError extends Error { readonly attrId: AttrId }
export class DogmaCycleError extends Error { readonly attrId: AttrId }
export interface AppliedModifier {
  carrier: Item; carrierTypeId: TypeId; carrierName: string | null; effectId: EffectId;
  operator: Operator; modifyingAttrId: AttrId; rawValue: number; value: number; penalised: boolean;
}
export function getAttr(fit: Fit, item: Item, attrId: AttrId): number;
export function explain(fit: Fit, item: Item, attrId: AttrId): AppliedModifier[];
export function clearMemo(fit: Fit): void;
```

**The exact order (spec §2.3, EOS `MutableAttrMap.__calculate`):** seed → gather + normalise → decide
penalisation per modifier → collapse each penalised bucket → apply in ascending operator order
(assign replaces with max/min, adds sum, everything else `acc *= 1 + n`) → cap to `maxAttributeId` →
round to 2 dp for attributes 50, 30, 48 and 11.

**Memoisation:** per `(item, attrId)` in a `WeakMap` keyed on the fit, with a `null` placeholder as the
cycle sentinel — the `modifyingAttrId` recursion genuinely can loop. The list of running modifiers is
cached in the same entry. **Any mutation of the fit (a state change, adding a module) requires
`clearMemo(fit)`**; the engine deliberately does not track dependencies, because a whole fit is a few
hundred attributes and recomputing it is microseconds.

- [ ] **Step 1: Write the failing test**

Create `tests/dogma/calc.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { ATTR, CATEGORY, EFFECT, Operator, State } from "../../src/lib/dogma/data.js";
import { addModule, attachCharge, createFit, makeItem } from "../../src/lib/dogma/fit.js";
import { DogmaCycleError, UnknownAttributeError, clearMemo, explain, getAttr } from "../../src/lib/dogma/calc.js";
import { mod, world, type World } from "./synthetic.js";

/** A fit whose hull carries `shipAttrs`. */
function ship(w: World, shipAttrs: [number, number][] = []) {
  const hull = w.type({ categoryId: CATEGORY.ship, attrs: shipAttrs });
  return createFit(w.data, makeItem(w.data, hull.id));
}

describe("seeding", () => {
  it("prefers the item's own attribute, then the attribute default", () => {
    const w = world();
    const withValue = w.attr({ defaultValue: 7 });
    const withoutValue = w.attr({ defaultValue: 3 });
    const fit = ship(w, [[withValue.id, 42]]);
    expect(getAttr(fit, fit.ship, withValue.id)).toBe(42);
    expect(getAttr(fit, fit.ship, withoutValue.id)).toBe(3);
  });

  it("throws when the attribute is not in the data set at all", () => {
    const w = world();
    const fit = ship(w);
    expect(() => getAttr(fit, fit.ship, 987654)).toThrow(UnknownAttributeError);
  });
});

describe("operator order", () => {
  it("applies assign → multiply → add → multiply, matching EOS's all-in fixture", () => {
    const w = world();
    const target = w.attr({ stackable: true, highIsGood: true });
    const sources = [5, 2, 4, 10, 3, 1.5, 2, 100].map((v) => ({ attr: w.attr(), value: v }));
    const ops = [
      Operator.PreAssign, Operator.PreMul, Operator.PreDiv, Operator.ModAdd,
      Operator.ModSub, Operator.PostMul, Operator.PostDiv, Operator.PostPercent,
    ];
    const effect = w.effect({
      categoryId: 0, state: State.Offline,
      modifiers: ops.map((operation, i) => mod({
        func: "ItemModifier", domain: "ship", operation,
        modifiedAttrId: target.id, modifyingAttrId: sources[i].attr.id,
      })),
    });
    const carrierType = w.type({
      categoryId: CATEGORY.skill,
      attrs: sources.map((s) => [s.attr.id, s.value] as [number, number]),
      effects: [[effect.id, false]],
    });
    const fit = ship(w, [[target.id, 7]]);
    fit.skills.set(carrierType.id, makeItem(w.data, carrierType.id));
    // ((5 × 2 ÷ 4) + 10 − 3) × 1.5 ÷ 2 × (1 + 100/100) = 14.25
    expect(getAttr(fit, fit.ship, target.id)).toBe(14.25);
  });

  it("lets a PostAssign discard everything computed before it", () => {
    const w = world();
    const target = w.attr({ stackable: true, highIsGood: true });
    const add = w.attr();
    const assign = w.attr();
    const effect = w.effect({
      modifiers: [
        mod({ func: "ItemModifier", domain: "ship", operation: Operator.ModAdd, modifiedAttrId: target.id, modifyingAttrId: add.id }),
        mod({ func: "ItemModifier", domain: "ship", operation: Operator.PostAssign, modifiedAttrId: target.id, modifyingAttrId: assign.id }),
      ],
    });
    const carrierType = w.type({ categoryId: CATEGORY.skill, attrs: [[add.id, 1000], [assign.id, 99]], effects: [[effect.id, false]] });
    const fit = ship(w, [[target.id, 5]]);
    fit.skills.set(carrierType.id, makeItem(w.data, carrierType.id));
    expect(getAttr(fit, fit.ship, target.id)).toBe(99);
  });

  it("picks the assign winner with max when highIsGood and min otherwise", () => {
    for (const [highIsGood, expected] of [[true, 80], [false, 20]] as const) {
      const w = world();
      const target = w.attr({ stackable: true, highIsGood });
      const low = w.attr();
      const high = w.attr();
      const effect = w.effect({
        modifiers: [
          mod({ func: "ItemModifier", domain: "ship", operation: Operator.PostAssign, modifiedAttrId: target.id, modifyingAttrId: low.id }),
          mod({ func: "ItemModifier", domain: "ship", operation: Operator.PostAssign, modifiedAttrId: target.id, modifyingAttrId: high.id }),
        ],
      });
      const carrierType = w.type({ categoryId: CATEGORY.skill, attrs: [[low.id, 20], [high.id, 80]], effects: [[effect.id, false]] });
      const fit = ship(w, [[target.id, 50]]);
      fit.skills.set(carrierType.id, makeItem(w.data, carrierType.id));
      expect(getAttr(fit, fit.ship, target.id)).toBe(expected);
    }
  });

  it("skips a division by zero instead of producing Infinity", () => {
    const w = world();
    const target = w.attr({ stackable: true });
    const zero = w.attr();
    const effect = w.effect({
      modifiers: [mod({ func: "ItemModifier", domain: "ship", operation: Operator.PostDiv, modifiedAttrId: target.id, modifyingAttrId: zero.id })],
    });
    const carrierType = w.type({ categoryId: CATEGORY.skill, attrs: [[zero.id, 0]], effects: [[effect.id, false]] });
    const fit = ship(w, [[target.id, 40]]);
    fit.skills.set(carrierType.id, makeItem(w.data, carrierType.id));
    expect(getAttr(fit, fit.ship, target.id)).toBe(40);
  });
});

/** Builds a fit whose hull has `base` for a stackable/unstackable attribute, modified by `percents`
 *  carried by one item of category `categoryId`. */
function percentFit(categoryId: number, stackable: boolean, base: number, percents: number[]) {
  const w = world();
  const target = w.attr({ stackable, highIsGood: true });
  const sources = percents.map((p) => ({ attr: w.attr(), value: p }));
  const effect = w.effect({
    modifiers: sources.map((s) => mod({
      func: "ItemModifier", domain: "ship", operation: Operator.PostPercent,
      modifiedAttrId: target.id, modifyingAttrId: s.attr.id,
    })),
  });
  const carrierType = w.type({
    categoryId, effects: [[effect.id, false], [EFFECT.online, false]],
    attrs: sources.map((s) => [s.attr.id, s.value] as [number, number]),
  });
  w.effect({ id: EFFECT.online, categoryId: 4, state: State.Online });
  const fit = ship(w, [[target.id, base]]);
  const carrier = makeItem(w.data, carrierType.id, { state: State.Online });
  switch (categoryId) {
    case CATEGORY.ship: fit.ship.effects.set(effect.id, false); for (const s of sources) fit.ship.attrs.set(s.attr.id, s.value); break;
    case CATEGORY.skill: fit.skills.set(carrierType.id, carrier); break;
    case CATEGORY.implant: fit.implants.push(carrier); break;
    case CATEGORY.charge: {
      const holder = makeItem(w.data, w.type({ effects: [[EFFECT.hiPower, false]] }).id, { state: State.Online });
      attachCharge(holder, carrier);
      addModule(fit, holder, "high", 0);
      break;
    }
    default: addModule(fit, carrier, categoryId === CATEGORY.subsystem ? "subsystem" : "low", 0);
  }
  return { fit, target };
}

describe("stacking penalty", () => {
  it("leaves a stackable attribute alone", () => {
    const { fit, target } = percentFit(CATEGORY.module, true, 100, [20, 50, -90, -25, 400]);
    expect(getAttr(fit, fit.ship, target.id)).toBeCloseTo(67.5, 10);
  });

  it("penalises an unstackable attribute (EOS's postPercent fixture)", () => {
    const { fit, target } = percentFit(CATEGORY.module, false, 100, [20, 50, -90, -25, 400]);
    expect(getAttr(fit, fit.ship, target.id)).toBeCloseTo(62.549783181488586, 10);
  });

  it("gives two +10 % modules 119.56, not 121", () => {
    const { fit, target } = percentFit(CATEGORY.module, false, 100, [10, 10]);
    expect(getAttr(fit, fit.ship, target.id)).toBeCloseTo(119.56031978880436, 10);
  });

  it("exempts ship, charge, skill, implant and subsystem carriers", () => {
    for (const categoryId of [CATEGORY.ship, CATEGORY.charge, CATEGORY.skill, CATEGORY.implant, CATEGORY.subsystem]) {
      const { fit, target } = percentFit(categoryId, false, 100, [50, 100]);
      expect(getAttr(fit, fit.ship, target.id)).toBe(300);
    }
  });

  it("does penalise a module carrier with the same two modifiers", () => {
    const { fit, target } = percentFit(CATEGORY.module, false, 100, [50, 100]);
    expect(getAttr(fit, fit.ship, target.id)).toBeCloseTo(286.91199808003977, 10);
  });

  it("never penalises ModAdd, whatever the carrier", () => {
    const w = world();
    const target = w.attr({ stackable: false, highIsGood: true });
    const source = w.attr();
    const effect = w.effect({
      modifiers: [
        mod({ func: "ItemModifier", domain: "ship", operation: Operator.ModAdd, modifiedAttrId: target.id, modifyingAttrId: source.id }),
        mod({ func: "ItemModifier", domain: "ship", operation: Operator.ModAdd, modifiedAttrId: target.id, modifyingAttrId: source.id }),
      ],
    });
    const carrierType = w.type({ categoryId: CATEGORY.module, attrs: [[source.id, 10]], effects: [[effect.id, false]] });
    const fit = ship(w, [[target.id, 100]]);
    addModule(fit, makeItem(w.data, carrierType.id, { state: State.Online }), "low", 0);
    expect(getAttr(fit, fit.ship, target.id)).toBe(120);
  });
});

describe("skill-level recursion", () => {
  it("resolves the two-effect pattern through the carrier's calculated value", () => {
    const w = world();
    const cpuOutput = w.attr({ id: ATTR.cpuOutput, stackable: true, highIsGood: true });
    const skillLevel = w.attr({ id: ATTR.skillLevel, stackable: true, highIsGood: true });
    const bonus = w.attr({ stackable: true, highIsGood: true });
    const scaler = w.effect({ modifiers: [mod({ func: "ItemModifier", domain: "self", operation: Operator.PreMul, modifiedAttrId: bonus.id, modifyingAttrId: skillLevel.id })] });
    const applier = w.effect({ modifiers: [mod({ func: "ItemModifier", domain: "ship", operation: Operator.PostPercent, modifiedAttrId: cpuOutput.id, modifyingAttrId: bonus.id })] });
    const skillType = w.type({ categoryId: CATEGORY.skill, attrs: [[bonus.id, 5], [skillLevel.id, 0]], effects: [[scaler.id, false], [applier.id, false]] });
    const fit = ship(w, [[cpuOutput.id, 130]]);
    const skill = makeItem(w.data, skillType.id);
    skill.attrs.set(skillLevel.id, 5);
    fit.skills.set(skillType.id, skill);
    expect(getAttr(fit, skill, bonus.id)).toBe(25);
    expect(getAttr(fit, fit.ship, cpuOutput.id)).toBe(162.5);
  });
});

describe("capping and rounding", () => {
  it("caps to maxAttributeId's value on the same item", () => {
    const w = world();
    const cap = w.attr({ stackable: true, highIsGood: true });
    const target = w.attr({ stackable: true, highIsGood: true, maxAttributeId: cap.id });
    const source = w.attr();
    const effect = w.effect({ modifiers: [mod({ func: "ItemModifier", domain: "ship", operation: Operator.PostPercent, modifiedAttrId: target.id, modifyingAttrId: source.id })] });
    const carrierType = w.type({ categoryId: CATEGORY.skill, attrs: [[source.id, 100]], effects: [[effect.id, false]] });
    const fit = ship(w, [[target.id, 100], [cap.id, 150]]);
    fit.skills.set(carrierType.id, makeItem(w.data, carrierType.id));
    expect(getAttr(fit, fit.ship, target.id)).toBe(150);
  });

  it("leaves a value below the cap alone", () => {
    const w = world();
    const cap = w.attr({ stackable: true, highIsGood: true });
    const target = w.attr({ stackable: true, highIsGood: true, maxAttributeId: cap.id });
    const fit = ship(w, [[target.id, 100], [cap.id, 150]]);
    expect(getAttr(fit, fit.ship, target.id)).toBe(100);
  });

  it("rounds cpu, power, cpuOutput and powerOutput to 2 dp and nothing else", () => {
    const w = world();
    const cpu = w.attr({ id: ATTR.cpu, stackable: true, highIsGood: false });
    const other = w.attr({ stackable: true, highIsGood: true });
    const three = w.attr();
    const effect = w.effect({
      modifiers: [
        mod({ func: "ItemModifier", domain: "ship", operation: Operator.PostDiv, modifiedAttrId: cpu.id, modifyingAttrId: three.id }),
        mod({ func: "ItemModifier", domain: "ship", operation: Operator.PostDiv, modifiedAttrId: other.id, modifyingAttrId: three.id }),
      ],
    });
    const carrierType = w.type({ categoryId: CATEGORY.skill, attrs: [[three.id, 3]], effects: [[effect.id, false]] });
    const fit = ship(w, [[cpu.id, 10], [other.id, 10]]);
    fit.skills.set(carrierType.id, makeItem(w.data, carrierType.id));
    expect(getAttr(fit, fit.ship, cpu.id)).toBe(3.33);
    expect(getAttr(fit, fit.ship, other.id)).toBe(3.3333333333333326);
  });
});

describe("memoisation", () => {
  it("recomputes only after clearMemo", () => {
    const w = world();
    const target = w.attr({ stackable: true, highIsGood: true });
    const source = w.attr();
    w.effect({ id: EFFECT.online, categoryId: 4, state: State.Online });
    const boost = w.effect({
      categoryId: 4, state: State.Online,
      modifiers: [mod({ func: "ItemModifier", domain: "ship", operation: Operator.ModAdd, modifiedAttrId: target.id, modifyingAttrId: source.id })],
    });
    const carrierType = w.type({ categoryId: CATEGORY.module, attrs: [[source.id, 10]], effects: [[boost.id, false], [EFFECT.online, false]] });
    const fit = ship(w, [[target.id, 100]]);
    const module = makeItem(w.data, carrierType.id, { state: State.Online });
    addModule(fit, module, "low", 0);
    expect(getAttr(fit, fit.ship, target.id)).toBe(110);
    module.state = State.Offline;
    expect(getAttr(fit, fit.ship, target.id)).toBe(110);   // still memoised
    clearMemo(fit);
    expect(getAttr(fit, fit.ship, target.id)).toBe(100);
  });

  it("detects a cycle instead of recursing for ever", () => {
    const w = world();
    const target = w.attr({ stackable: true, highIsGood: true });
    const effect = w.effect({ modifiers: [mod({ func: "ItemModifier", domain: "self", operation: Operator.ModAdd, modifiedAttrId: target.id, modifyingAttrId: target.id })] });
    const hull = w.type({ categoryId: CATEGORY.ship, attrs: [[target.id, 10]], effects: [[effect.id, false]] });
    const fit = createFit(w.data, makeItem(w.data, hull.id));
    expect(() => getAttr(fit, fit.ship, target.id)).toThrow(DogmaCycleError);
    // The sentinel must be cleared again, so a second call fails the same way rather than returning null.
    expect(() => getAttr(fit, fit.ship, target.id)).toThrow(DogmaCycleError);
  });
});

describe("explain", () => {
  it("returns every applied modifier with its carrier, operator, raw and normalised value", () => {
    const { fit, target } = percentFit(CATEGORY.module, false, 100, [50, 100]);
    const applied = explain(fit, fit.ship, target.id);
    expect(applied).toHaveLength(2);
    expect(applied.map((a) => a.rawValue).sort((a, b) => a - b)).toEqual([50, 100]);
    expect(applied.map((a) => a.value).sort((a, b) => a - b)).toEqual([0.5, 1]);
    expect(applied.every((a) => a.operator === Operator.PostPercent)).toBe(true);
    expect(applied.every((a) => a.penalised)).toBe(true);
    expect(applied.every((a) => a.carrier === fit.modules[0].item)).toBe(true);
  });

  it("marks a penalty-immune carrier's modifiers as unpenalised", () => {
    const { fit, target } = percentFit(CATEGORY.implant, false, 100, [50]);
    expect(explain(fit, fit.ship, target.id).map((a) => a.penalised)).toEqual([false]);
  });

  it("returns an empty list for an unmodified attribute", () => {
    const w = world();
    const target = w.attr({ stackable: true });
    const fit = ship(w, [[target.id, 100]]);
    expect(explain(fit, fit.ship, target.id)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test and watch it fail**

Run: `npx vitest run tests/dogma/calc.test.ts`
Expected: FAIL — `Failed to resolve import "../../src/lib/dogma/calc.js"`.

- [ ] **Step 3: Write `src/lib/dogma/calc.ts`**

```ts
/**
 * The attribute calculator — a transliteration of EOS's MutableAttrMap.__calculate
 * (eos/calculator/map.py:207). See docs/research/dogma-engine.md §2.4 and §6.4.
 */
import {
  OPERATOR_ORDER, Operator, PENALTY_IMMUNE_CATEGORY_IDS, ROUNDED_ATTR_IDS,
  type AttrId, type EffectId, type TypeId,
} from "./data.js";
import { isPenalizable, normalise, penalizeValues, round2 } from "./operators.js";
import { activeModifiers, type CarriedModifier } from "./effects.js";
import { affects } from "./affection.js";
import type { Fit, Item } from "./fit.js";

export class UnknownAttributeError extends Error {
  constructor(readonly attrId: AttrId) {
    super(`unknown attribute ${attrId}`);
    this.name = "UnknownAttributeError";
  }
}

export class DogmaCycleError extends Error {
  constructor(readonly attrId: AttrId) {
    super(`cycle while calculating attribute ${attrId}`);
    this.name = "DogmaCycleError";
  }
}

export interface AppliedModifier {
  carrier: Item;
  carrierTypeId: TypeId;
  carrierName: string | null;
  effectId: EffectId;
  operator: Operator;
  modifyingAttrId: AttrId;
  /** The carrier's fully calculated value of `modifyingAttrId`. */
  rawValue: number;
  /** The normalised (reduced) value the calculator applied. */
  value: number;
  penalised: boolean;
}

interface FitCache {
  /** `null` is the in-progress placeholder EOS uses to spot a cycle. */
  memo: Map<Item, Map<AttrId, number | null>>;
  modifiers: CarriedModifier[] | null;
}

const CACHE = new WeakMap<Fit, FitCache>();

/** Call this after any mutation of the fit — a state change, a module added or removed. */
export function clearMemo(fit: Fit): void {
  CACHE.delete(fit);
}

function cacheFor(fit: Fit): FitCache {
  let cache = CACHE.get(fit);
  if (!cache) {
    cache = { memo: new Map(), modifiers: null };
    CACHE.set(fit, cache);
  }
  return cache;
}

function modifiersFor(fit: Fit): CarriedModifier[] {
  const cache = cacheFor(fit);
  cache.modifiers ??= activeModifiers(fit);
  return cache.modifiers;
}

export function getAttr(fit: Fit, item: Item, attrId: AttrId): number {
  const memo = cacheFor(fit).memo;
  let byAttr = memo.get(item);
  if (!byAttr) {
    byAttr = new Map<AttrId, number | null>();
    memo.set(item, byAttr);
  }
  if (byAttr.has(attrId)) {
    const cached = byAttr.get(attrId) ?? null;
    if (cached === null) throw new DogmaCycleError(attrId);
    return cached;
  }
  byAttr.set(attrId, null);
  try {
    const value = calculate(fit, item, attrId, null);
    byAttr.set(attrId, value);
    return value;
  } catch (e: unknown) {
    byAttr.delete(attrId);          // never leave a placeholder behind
    throw e;
  }
}

/** The modifiers that were applied to `(item, attrId)`, for the "affected by" panel. */
export function explain(fit: Fit, item: Item, attrId: AttrId): AppliedModifier[] {
  const trace: AppliedModifier[] = [];
  calculate(fit, item, attrId, trace);
  return trace;
}

function calculate(fit: Fit, item: Item, attrId: AttrId, trace: AppliedModifier[] | null): number {
  const meta = fit.data.attributes.get(attrId);
  if (!meta) throw new UnknownAttributeError(attrId);

  // 1. seed
  let acc = item.attrs.get(attrId) ?? meta.defaultValue;

  // 2 & 3. gather, normalise, decide penalisation
  const plain = new Map<Operator, number[]>();
  const penalisedBuckets = new Map<Operator, number[]>();
  for (const carried of modifiersFor(fit)) {
    const { carrier, modifier } = carried;
    if (modifier.modifiedAttrId !== attrId) continue;
    if (!affects(fit, carried, item)) continue;
    const rawValue = getAttr(fit, carrier, modifier.modifyingAttrId);   // recurses
    const value = normalise(modifier.operation, rawValue);
    if (value === null) continue;                                        // division by zero
    const penalised = !meta.stackable
      && !PENALTY_IMMUNE_CATEGORY_IDS.has(carrier.categoryId)
      && isPenalizable(modifier.operation);
    push(penalised ? penalisedBuckets : plain, modifier.operation, value);
    trace?.push({
      carrier,
      carrierTypeId: carrier.typeId,
      carrierName: carrier.name,
      effectId: carried.effect.id,
      operator: modifier.operation,
      modifyingAttrId: modifier.modifyingAttrId,
      rawValue,
      value,
      penalised,
    });
  }

  // 4. collapse each penalised bucket into one reduced multiplier
  for (const [operator, values] of penalisedBuckets) push(plain, operator, penalizeValues(values));

  // 5. apply in ascending operator order
  for (const operator of OPERATOR_ORDER) {
    const values = plain.get(operator);
    if (!values || values.length === 0) continue;
    switch (operator) {
      case Operator.PreAssign:
      case Operator.PostAssign:
        acc = meta.highIsGood ? Math.max(...values) : Math.min(...values);
        break;
      case Operator.ModAdd:
      case Operator.ModSub:
        for (const value of values) acc += value;
        break;
      default:
        for (const value of values) acc *= 1 + value;
    }
  }

  // 6. cap (upper only — minAttributeId is deferred, research §2.6)
  if (meta.maxAttributeId !== undefined) acc = Math.min(acc, getAttr(fit, item, meta.maxAttributeId));

  // 7. the 2-dp rounding that makes `used <= output` comparisons behave
  return ROUNDED_ATTR_IDS.has(attrId) ? round2(acc) : acc;
}

function push(into: Map<Operator, number[]>, operator: Operator, value: number): void {
  const values = into.get(operator);
  if (values) values.push(value); else into.set(operator, [value]);
}
```

- [ ] **Step 4: Run the test and the type checker**

Run: `npx vitest run tests/dogma/calc.test.ts && npm run typecheck`
Expected: PASS, typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add src/lib/dogma/calc.ts tests/dogma/calc.test.ts
git commit -m "feat(dogma): memoised attribute calculator with penalties, capping and explain

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 9: Real-SDE calculator fixtures (skills, implants, subsystems, state)

**Files:**
- Create: `tests/dogma/build-fit.ts`, `tests/dogma/calc-sde.test.ts`

**Interfaces:**
- Consumes: Task 4 `fixtureData`; Task 5 `createFit`/`makeItem`/`makeSkill`/`addModule`/`attachCharge`;
  Task 8 `getAttr`/`explain`/`clearMemo`.
- Produces:
```ts
// tests/dogma/build-fit.ts — reused by Tasks 10, 11, 12 and 15
export function allSkills(data: DogmaData, level: number): Map<TypeId, number>;
export function buildFit(data: DogmaData, shipTypeId: TypeId, opts?: {
  modules?: [TypeId, SlotKind, number][];
  charges?: Map<number, TypeId>;      // index into `modules` → charge type id
  skills?: Map<TypeId, number>;
  implants?: TypeId[];
  drones?: TypeId[];
}): Fit;
```

**These are the spec §7 "required assertions" against real SDE data.** Every number below was read out of
the SDE, not recalled: Rifter 587 `cpuOutput` 130 / `powerOutput` 41; CPU Management 3426 carries
`cpuOutputBonus2` 424 = 5 with effects 368 (preMul 424←280) and 397 (postPercent 48←424); Power Grid
Management 3413 carries `powerEngineeringOutputBonus` 313 = 5 with effects 218 and 490; Weapon Upgrades
3318 carries `cpuNeedBonus` 310 = −5 with effects 211 and 581 (skillTypeId 3300); Advanced Weapon Upgrades
11207 carries `powerNeedBonus` 323 = −2 with effects 246 and 1638; 200mm AutoCannon II 2889 has cpu 9,
power 4, `damageMultiplier` 3.465 and requires 3302/3300/11084; Gyrostabilizer II 519 has
`damageMultiplier` 1.1 and requires 3318 (**not** Gunnery, so effect 581 does not reach it); the rig 31686
has `drawback` 10 and effect 2708 (postPercent power ← drawback on group 55); the implant 27143 carries
attribute 424 = 1 and effect 397; the Tengu 29984 has cpuOutput 310 / powerOutput 420 / zero slots, and
subsystem 45601 has cpuOutput 160, powerOutput 190, `hiSlotModifier` 7 and `launcherHardPointModifier` 6.

- [ ] **Step 1: Write the shared fit builder**

Create `tests/dogma/build-fit.ts` (a helper, not a test file):
```ts
import { CATEGORY, type DogmaData, type TypeId } from "../../src/lib/dogma/data.js";
import {
  addModule, attachCharge, createFit, makeItem, makeSkill, type Fit, type SlotKind,
} from "../../src/lib/dogma/fit.js";
import { clearMemo } from "../../src/lib/dogma/calc.js";

/** Every skill type in the snapshot, at the same level — "all skills V" for a fixture. */
export function allSkills(data: DogmaData, level: number): Map<TypeId, number> {
  const out = new Map<TypeId, number>();
  for (const type of data.types.values()) if (type.categoryId === CATEGORY.skill) out.set(type.id, level);
  return out;
}

export interface FitOptions {
  modules?: [TypeId, SlotKind, number][];
  /** index into `modules` → charge type id */
  charges?: Map<number, TypeId>;
  skills?: Map<TypeId, number>;
  implants?: TypeId[];
  drones?: TypeId[];
}

export function buildFit(data: DogmaData, shipTypeId: TypeId, opts: FitOptions = {}): Fit {
  const fit = createFit(data, makeItem(data, shipTypeId));
  for (const [typeId, level] of opts.skills ?? new Map<TypeId, number>()) {
    if (data.types.has(typeId)) fit.skills.set(typeId, makeSkill(data, typeId, level));
  }
  for (const typeId of opts.implants ?? []) fit.implants.push(makeItem(data, typeId));
  for (const typeId of opts.drones ?? []) fit.drones.push(makeItem(data, typeId));
  (opts.modules ?? []).forEach(([typeId, slot, index], i) => {
    const item = makeItem(data, typeId);
    const chargeTypeId = opts.charges?.get(i);
    if (chargeTypeId !== undefined) attachCharge(item, makeItem(data, chargeTypeId));
    addModule(fit, item, slot, index);
  });
  clearMemo(fit);
  return fit;
}
```

- [ ] **Step 2: Write the failing test**

Create `tests/dogma/calc-sde.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { ATTR, Operator, State } from "../../src/lib/dogma/data.js";
import { clearMemo, explain, getAttr } from "../../src/lib/dogma/calc.js";
import { fixtureData } from "./fixture.js";
import { allSkills, buildFit } from "./build-fit.js";

const data = fixtureData("rifter");
const tengu = fixtureData("tengu");
const skills = (pairs: [number, number][]) => new Map<number, number>(pairs);

describe("Rifter CPU and powergrid output", () => {
  it("is 130 tf / 41 MW on a bare hull with no skills", () => {
    const fit = buildFit(data, 587);
    expect(getAttr(fit, fit.ship, ATTR.cpuOutput)).toBe(130);
    expect(getAttr(fit, fit.ship, ATTR.powerOutput)).toBe(41);
  });

  it("is 162.5 tf / 51.25 MW with CPU Management V and Power Grid Management V", () => {
    const fit = buildFit(data, 587, { skills: skills([[3426, 5], [3413, 5]]) });
    expect(getAttr(fit, fit.ship, ATTR.cpuOutput)).toBe(162.5);
    expect(getAttr(fit, fit.ship, ATTR.powerOutput)).toBe(51.25);
  });

  it("scales with the trained level, and the 2-dp rounding cleans up the float", () => {
    // 130 × 1.15 is 149.49999999999999 in IEEE-754; the cpuOutput rounding makes it 149.5.
    const fit = buildFit(data, 587, { skills: skills([[3426, 3]]) });
    expect(getAttr(fit, fit.ship, ATTR.cpuOutput)).toBe(149.5);
    expect(getAttr(fit, fit.ship, ATTR.powerOutput)).toBe(41);
  });

  it("takes a fitting implant through the character domain onto the ship", () => {
    const alone = buildFit(data, 587, { implants: [27143] });
    expect(getAttr(alone, alone.ship, ATTR.cpuOutput)).toBe(131.3);           // 130 × 1.01
    const both = buildFit(data, 587, { implants: [27143], skills: skills([[3426, 5]]) });
    expect(getAttr(both, both.ship, ATTR.cpuOutput)).toBe(164.13);            // 130 × 1.25 × 1.01, rounded
  });

  it("stacks the skill and the implant unpenalised, because cpuOutput is stackable", () => {
    const fit = buildFit(data, 587, { implants: [27143], skills: skills([[3426, 5]]) });
    const applied = explain(fit, fit.ship, ATTR.cpuOutput);
    expect(applied.every((a) => !a.penalised)).toBe(true);
  });
});

describe("Weapon Upgrades and Advanced Weapon Upgrades", () => {
  const gun: [number, "high", number] = [2889, "high", 0];

  it("charges a turret its full CPU and PG at skill 0", () => {
    const fit = buildFit(data, 587, { modules: [gun] });
    expect(getAttr(fit, fit.modules[0].item, ATTR.cpu)).toBe(9);
    expect(getAttr(fit, fit.modules[0].item, ATTR.power)).toBe(4);
  });

  it("takes 25 % off a turret's CPU at Weapon Upgrades V", () => {
    const fit = buildFit(data, 587, { modules: [gun], skills: skills([[3318, 5]]) });
    expect(getAttr(fit, fit.modules[0].item, ATTR.cpu)).toBe(6.75);
    expect(getAttr(fit, fit.modules[0].item, ATTR.power)).toBe(4);
  });

  it("takes 10 % off a turret's powergrid at Advanced Weapon Upgrades V", () => {
    const fit = buildFit(data, 587, { modules: [gun], skills: skills([[11207, 5]]) });
    expect(getAttr(fit, fit.modules[0].item, ATTR.power)).toBe(3.6);
    expect(getAttr(fit, fit.modules[0].item, ATTR.cpu)).toBe(9);
  });

  it("does not reach a module that does not require Gunnery", () => {
    // Gyrostabilizer II requires Weapon Upgrades (3318), not Gunnery (3300), so effect 581 misses it.
    const fit = buildFit(data, 587, { modules: [[519, "low", 0]], skills: skills([[3318, 5], [11207, 5]]) });
    expect(getAttr(fit, fit.modules[0].item, ATTR.cpu)).toBe(30);
    expect(getAttr(fit, fit.modules[0].item, ATTR.power)).toBe(1);
  });
});

describe("group and drawback modifiers", () => {
  it("applies a rig's drawback to the powergrid of every projectile weapon on the ship", () => {
    // Rig 31686 carries effect 2708: postPercent power ← drawback (10) on group 55.
    const fit = buildFit(data, 587, { modules: [[2889, "high", 0], [31686, "rig", 0]] });
    expect(getAttr(fit, fit.modules[0].item, ATTR.power)).toBe(4.4);
  });

  it("penalises a module-sourced damage bonus and stops it when the module goes offline", () => {
    const fit = buildFit(data, 587, { modules: [[2889, "high", 0], [519, "low", 0]] });
    const gun = fit.modules[0].item;
    const gyro = fit.modules[1].item;
    expect(getAttr(fit, gun, 64)).toBeCloseTo(3.8115, 10);     // 3.465 × 1.1
    expect(explain(fit, gun, 64).map((a) => a.penalised)).toEqual([true]);
    gyro.state = State.Offline;
    clearMemo(fit);
    expect(getAttr(fit, gun, 64)).toBe(3.465);
  });
});

describe("T3 subsystems", () => {
  it("adds the subsystem's own CPU and powergrid to the hull", () => {
    const fit = buildFit(tengu, 29984, { modules: [[45601, "subsystem", 0]] });
    expect(getAttr(fit, fit.ship, ATTR.cpuOutput)).toBe(470);    // 310 + 160
    expect(getAttr(fit, fit.ship, ATTR.powerOutput)).toBe(610);  // 420 + 190
  });

  it("adds slots and hardpoints through the hand-coded effects 3774 and 3773", () => {
    const bare = buildFit(tengu, 29984);
    expect(getAttr(bare, bare.ship, ATTR.hiSlots)).toBe(0);
    expect(getAttr(bare, bare.ship, ATTR.launcherSlots)).toBe(0);
    const fit = buildFit(tengu, 29984, { modules: [[45601, "subsystem", 0]] });
    expect(getAttr(fit, fit.ship, ATTR.hiSlots)).toBe(7);         // 0 + hiSlotModifier 7
    expect(getAttr(fit, fit.ship, ATTR.medSlots)).toBe(0);
    expect(getAttr(fit, fit.ship, ATTR.lowSlots)).toBe(0);
    expect(getAttr(fit, fit.ship, ATTR.launcherSlots)).toBe(6);   // 0 + launcherHardPointModifier 6
    expect(getAttr(fit, fit.ship, ATTR.turretSlots)).toBe(0);
    expect(getAttr(fit, fit.ship, ATTR.maxSubSystems)).toBe(5);
  });
});

describe("explain", () => {
  it("lists CPU Management on the ship's cpuOutput", () => {
    const fit = buildFit(data, 587, { skills: allSkills(data, 5) });
    const applied = explain(fit, fit.ship, ATTR.cpuOutput);
    expect(applied).toHaveLength(1);
    expect(applied[0]).toMatchObject({
      carrierTypeId: 3426,
      carrierName: "CPU Management",
      effectId: 397,
      operator: Operator.PostPercent,
      modifyingAttrId: 424,
      rawValue: 25,
      value: 0.25,
      penalised: false,
    });
    expect(applied[0].carrier).toBe(fit.skills.get(3426));
  });

  it("lists Power Grid Management on the ship's powerOutput and nothing on a bare hull", () => {
    const fit = buildFit(data, 587, { skills: allSkills(data, 5) });
    expect(explain(fit, fit.ship, ATTR.powerOutput).map((a) => a.carrierTypeId)).toEqual([3413]);
    const bare = buildFit(data, 587);
    expect(explain(bare, bare.ship, ATTR.cpuOutput)).toEqual([]);
  });

  it("lists Weapon Upgrades on a turret's cpu", () => {
    const fit = buildFit(data, 587, { modules: [[2889, "high", 0]], skills: allSkills(data, 5) });
    const applied = explain(fit, fit.modules[0].item, ATTR.cpu);
    expect(applied.map((a) => [a.carrierTypeId, a.effectId, a.rawValue])).toEqual([[3318, 581, -25]]);
  });
});
```

- [ ] **Step 3: Run the test**

Run: `npx vitest run tests/dogma/calc-sde.test.ts && npm run typecheck`
Expected: PASS. Everything it exercises already exists — this task adds no production code, only the
shared fit builder and the real-data assertions the spec requires. If any assertion fails, the bug is in
Tasks 5–8, not in the fixture; fix the engine, never the number.

- [ ] **Step 4: Commit**

```bash
git add tests/dogma/build-fit.ts tests/dogma/calc-sde.test.ts
git commit -m "test(dogma): real-SDE calculator fixtures for skills, implants and subsystems

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 10: Fit statistics (`src/lib/dogma/stats.ts`)

**Files:**
- Create: `src/lib/dogma/stats.ts`, `tests/dogma/stats.test.ts`

**Interfaces:**
- Consumes: Task 1 `ATTR`, `EFFECT`, `State`; Task 2 `round2`; Task 5 `Fit`, `Item`, `SlotKind`,
  `Hardpoint`, `SLOT_KINDS`, `HARDPOINTS`, `hardpointOf`; Task 8 `getAttr`.
- Produces:
```ts
export interface ResourcePool { used: number; output: number }
export interface SlotUsage { used: number; total: number }
export interface ModuleStat {
  item: Item; slot: SlotKind; index: number;
  cpu: number; power: number; calibration: number; state: State; charged: boolean;
}
export interface FitStats {
  cpu: ResourcePool; power: ResourcePool; calibration: ResourcePool;
  slots: Record<SlotKind, SlotUsage>;
  hardpoints: Record<Hardpoint, SlotUsage>;
  modules: ModuleStat[];
}
export function fitStats(fit: Fit): FitStats;
```

**The rules (spec §2.4, research §5.3/§5.4/§7):**
- **CPU / powergrid are charged** for a module iff `state >= Online` **and** its type carries the `online`
  effect (16). Ruling from the spec: a module with a `cpu` attribute but no `online` effect costs nothing
  (EOS's reading; Pyfa would charge it).
- **Calibration** is `upgradeCost` (1153) summed over rigs **in any state** — a rig's `rigSlot` effect is
  passive, so offlining it does not free calibration.
- Outputs come from the ship's *modified* `cpuOutput` 48, `powerOutput` 11, `upgradeCapacity` 1132.
- Slot totals: 14 high, 13 mid, 12 low, 1137 rig, 1367 subsystem — `Math.floor`ed, and **a `maxSubSystems`
  of 5 is reported as 4** (EVE went from five subsystems to four; the attribute never changed).
- Hardpoint totals come from 102 `turretSlotsLeft` / 101 `launcherSlotsLeft`, which hold the *total*
  despite the names; usage counts fitted turrets/launchers **regardless of state**.
- `ModuleStat.cpu`/`power` are the **charged** amounts, so the rows sum to `cpu.used`/`power.used`;
  `charged` says whether the gate let them through, so the UI can grey an offline module's row instead of
  showing a cost that is not being paid. The used totals are `round2`ed, matching Pyfa's `pgUsed`/`cpuUsed`.

- [ ] **Step 1: Write the failing test**

Create `tests/dogma/stats.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { ATTR, EFFECT, State } from "../../src/lib/dogma/data.js";
import { clearMemo } from "../../src/lib/dogma/calc.js";
import { fitStats } from "../../src/lib/dogma/stats.js";
import { fixtureData } from "./fixture.js";
import { allSkills, buildFit } from "./build-fit.js";

const data = fixtureData("rifter");
const tengu = fixtureData("tengu");

describe("a bare Rifter", () => {
  it("reports zero usage against the hull's outputs", () => {
    const stats = fitStats(buildFit(data, 587));
    expect(stats.cpu).toEqual({ used: 0, output: 130 });
    expect(stats.power).toEqual({ used: 0, output: 41 });
    expect(stats.calibration).toEqual({ used: 0, output: 400 });
    expect(stats.slots).toEqual({
      high: { used: 0, total: 3 }, mid: { used: 0, total: 3 }, low: { used: 0, total: 4 },
      rig: { used: 0, total: 3 }, subsystem: { used: 0, total: 0 },
    });
    expect(stats.hardpoints).toEqual({ turret: { used: 0, total: 3 }, launcher: { used: 0, total: 2 } });
    expect(stats.modules).toEqual([]);
  });
});

describe("resource usage", () => {
  const loadout: [number, "high" | "low", number][] = [
    [2889, "high", 0], [2889, "high", 1], [2889, "high", 2], [2048, "low", 0], [519, "low", 1],
  ];

  it("sums the modified cpu and power of every charged module", () => {
    const stats = fitStats(buildFit(data, 587, { modules: loadout }));
    expect(stats.cpu.used).toBe(87);      // 3 × 9 + 30 + 30
    expect(stats.power.used).toBe(14);    // 3 × 4 + 1 + 1
    expect(stats.slots.high).toEqual({ used: 3, total: 3 });
    expect(stats.slots.low).toEqual({ used: 2, total: 4 });
    expect(stats.hardpoints.turret).toEqual({ used: 3, total: 3 });
  });

  it("uses the skill-modified values and the skill-modified outputs", () => {
    const stats = fitStats(buildFit(data, 587, { modules: loadout, skills: allSkills(data, 5) }));
    expect(stats.cpu).toEqual({ used: 80.25, output: 162.5 });    // 3 × 6.75 + 30 + 30
    expect(stats.power).toEqual({ used: 12.8, output: 51.25 });   // 3 × 3.6 + 1 + 1
  });

  it("charges nothing for an offline module but still lists it", () => {
    const fit = buildFit(data, 587, { modules: loadout });
    fit.modules[3].item.state = State.Offline;     // Damage Control II
    clearMemo(fit);
    const stats = fitStats(fit);
    expect(stats.cpu.used).toBe(57);
    expect(stats.power.used).toBe(13);
    const dcu = stats.modules.find((m) => m.item.typeId === 2048)!;
    expect(dcu).toMatchObject({ cpu: 0, power: 0, state: State.Offline, charged: false });
  });

  it("charges nothing for a module whose type has no online effect", () => {
    const fit = buildFit(data, 587, { modules: [[2048, "low", 0]] });
    fit.modules[0].item.effects.delete(EFFECT.online);
    clearMemo(fit);
    const stats = fitStats(fit);
    expect(stats.cpu.used).toBe(0);
    expect(stats.modules[0].charged).toBe(false);
    // The unmodified attribute is still there — the gate is about charging, not about the value.
    expect(fit.modules[0].item.attrs.get(ATTR.cpu)).toBe(30);
  });

  it("counts a turret's hardpoint even when it is offline", () => {
    const fit = buildFit(data, 587, { modules: [[2889, "high", 0]] });
    fit.modules[0].item.state = State.Offline;
    clearMemo(fit);
    expect(fitStats(fit).hardpoints.turret).toEqual({ used: 1, total: 3 });
  });
});

describe("calibration", () => {
  it("sums upgradeCost over rigs in any state and charges them no cpu or powergrid", () => {
    const fit = buildFit(data, 587, { modules: [[31686, "rig", 0], [31724, "rig", 1]] });
    expect(fitStats(fit).calibration).toEqual({ used: 375, output: 400 });   // 300 + 75
    fit.modules[0].item.state = State.Offline;
    clearMemo(fit);
    const stats = fitStats(fit);
    expect(stats.calibration.used).toBe(375);
    expect(stats.cpu.used).toBe(0);
    expect(stats.modules[0]).toMatchObject({ slot: "rig", index: 0, calibration: 300, cpu: 0, power: 0, charged: false });
  });

  it("reports no calibration for a non-rig module", () => {
    const stats = fitStats(buildFit(data, 587, { modules: [[2048, "low", 0]] }));
    expect(stats.modules[0].calibration).toBe(0);
  });
});

describe("T3 subsystems", () => {
  it("shows a maxSubSystems of 5 as 4 and takes the subsystem's slot and output adds", () => {
    const stats = fitStats(buildFit(tengu, 29984, { modules: [[45601, "subsystem", 0]] }));
    expect(stats.slots.subsystem).toEqual({ used: 1, total: 4 });
    expect(stats.slots.high).toEqual({ used: 0, total: 7 });
    expect(stats.hardpoints.launcher).toEqual({ used: 0, total: 6 });
    expect(stats.cpu.output).toBe(470);
    expect(stats.power.output).toBe(610);
  });
});

describe("module rows", () => {
  it("carries the slot, index, state and modified costs of each module in fit order", () => {
    const fit = buildFit(data, 587, { modules: [[2889, "high", 2], [31686, "rig", 0]], skills: allSkills(data, 5) });
    const stats = fitStats(fit);
    expect(stats.modules.map((m) => [m.item.typeId, m.slot, m.index, m.cpu, m.power, m.calibration, m.charged]))
      .toEqual([
        [2889, "high", 2, 6.75, 3.96, 0, true],   // the rig's drawback adds 10 % to the turret's powergrid
        [31686, "rig", 0, 0, 0, 300, false],
      ]);
    expect(stats.power.used).toBe(3.96);
  });
});
```

- [ ] **Step 2: Run the test and watch it fail**

Run: `npx vitest run tests/dogma/stats.test.ts`
Expected: FAIL — `Failed to resolve import "../../src/lib/dogma/stats.js"`.

- [ ] **Step 3: Write `src/lib/dogma/stats.ts`**

```ts
/**
 * Fitting-window statistics: the three resource gauges, slot and hardpoint counters, and one row per
 * fitted module. See spec §2.4 and research §5.3/§5.4.
 */
import { ATTR, EFFECT, State, type AttrId } from "./data.js";
import { getAttr } from "./calc.js";
import { round2 } from "./operators.js";
import {
  HARDPOINTS, SLOT_KINDS, hardpointOf, type Fit, type Hardpoint, type Item, type SlotKind,
} from "./fit.js";

export interface ResourcePool { used: number; output: number }
export interface SlotUsage { used: number; total: number }

export interface ModuleStat {
  item: Item;
  slot: SlotKind;
  index: number;
  /** The amount actually charged — 0 when the online gate is closed. */
  cpu: number;
  power: number;
  calibration: number;
  state: State;
  charged: boolean;
}

export interface FitStats {
  cpu: ResourcePool;
  power: ResourcePool;
  calibration: ResourcePool;
  slots: Record<SlotKind, SlotUsage>;
  hardpoints: Record<Hardpoint, SlotUsage>;
  modules: ModuleStat[];
}

const SLOT_ATTRS: Record<SlotKind, AttrId> = {
  high: ATTR.hiSlots, mid: ATTR.medSlots, low: ATTR.lowSlots,
  rig: ATTR.rigSlots, subsystem: ATTR.maxSubSystems,
};

const HARDPOINT_ATTRS: Record<Hardpoint, AttrId> = {
  turret: ATTR.turretSlots, launcher: ATTR.launcherSlots,
};

export function fitStats(fit: Fit): FitStats {
  const modules: ModuleStat[] = [];
  let cpuUsed = 0;
  let powerUsed = 0;
  let calibrationUsed = 0;

  for (const { item, slot, index } of fit.modules) {
    // EOS's rule: a module consumes CPU/PG only while its own `online` effect can run.
    const charged = item.state >= State.Online && item.effects.has(EFFECT.online);
    const cpu = charged ? getAttr(fit, item, ATTR.cpu) : 0;
    const power = charged ? getAttr(fit, item, ATTR.power) : 0;
    // Rigs pay calibration in every state, including offline — `rigSlot` is a passive effect.
    const calibration = slot === "rig" ? getAttr(fit, item, ATTR.upgradeCost) : 0;
    cpuUsed += cpu;
    powerUsed += power;
    calibrationUsed += calibration;
    modules.push({ item, slot, index, cpu, power, calibration, state: item.state, charged });
  }

  const slots = {} as Record<SlotKind, SlotUsage>;
  for (const kind of SLOT_KINDS) {
    let total = Math.floor(getAttr(fit, fit.ship, SLOT_ATTRS[kind]));
    // EVE went from five subsystems to four; the SDE attribute was never changed to match.
    if (kind === "subsystem" && total === 5) total = 4;
    slots[kind] = { used: fit.modules.filter((m) => m.slot === kind).length, total };
  }

  const hardpoints = {} as Record<Hardpoint, SlotUsage>;
  for (const kind of HARDPOINTS) {
    hardpoints[kind] = {
      // Regardless of state: an offline turret still occupies its hardpoint.
      used: fit.modules.filter((m) => hardpointOf(m.item) === kind).length,
      total: Math.floor(getAttr(fit, fit.ship, HARDPOINT_ATTRS[kind])),
    };
  }

  return {
    cpu: { used: round2(cpuUsed), output: getAttr(fit, fit.ship, ATTR.cpuOutput) },
    power: { used: round2(powerUsed), output: getAttr(fit, fit.ship, ATTR.powerOutput) },
    calibration: { used: round2(calibrationUsed), output: getAttr(fit, fit.ship, ATTR.upgradeCapacity) },
    slots,
    hardpoints,
    modules,
  };
}
```

- [ ] **Step 4: Run the test and the type checker**

Run: `npx vitest run tests/dogma/stats.test.ts && npm run typecheck`
Expected: PASS, typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add src/lib/dogma/stats.ts tests/dogma/stats.test.ts
git commit -m "feat(dogma): fit statistics for cpu, powergrid, calibration, slots and hardpoints

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 11: Validation part 1 — resources, slots, hardpoints, rig size (`src/lib/dogma/validate.ts`)

**Files:**
- Create: `src/lib/dogma/validate.ts`, `tests/dogma/validate.test.ts`

**Interfaces:**
- Consumes: Task 1 `ATTR`; Task 5 `Fit`, `Item`, `SLOT_KINDS`, `HARDPOINTS`; Task 10 `fitStats`, `FitStats`.
- Produces (the full surface — Task 12 fills in the remaining three kinds):
```ts
export type ProblemKind =
  | "cpu" | "power" | "calibration" | "slot" | "hardpoint"
  | "rigSize" | "shipRestriction" | "maxGroupFitted" | "skill";
export interface MissingSkill { skillTypeId: TypeId; required: number; have: number }
export interface Problem { kind: ProblemKind; item?: Item; detail: string; skill?: MissingSkill }
export function validateFit(fit: Fit): Problem[];
```

**Note on the signature.** Spec §2.4 writes `validateFit(fit, data)`, but `Fit` already carries `data`
(it has to — `getAttr(fit, item, attrId)` takes no data argument), so the second parameter would be a
redundant second source of truth. `validateFit` takes the fit alone.

**Rules for these five kinds (spec §2.4, research §5.5/§5.9):**
- `cpu`, `power`, `calibration`: `used > output`, **no epsilon**. The calculator's 2-dp rounding is the
  tolerance — it is what stops `250.00000000000003 > 250`.
- `slot`: one problem per slot kind whose `used > total`.
- `hardpoint`: one problem per hardpoint kind whose `used > total`.
- `rigSize`: rigs only, comparing the **raw** attribute 1547 on the rig and on the hull, and skipped
  entirely when either side lacks it (EOS's reading; Pyfa's `0 == 0` default is an accident).

Problem order is fixed: cpu, power, calibration, then slots in `SLOT_KINDS` order, then hardpoints in
`HARDPOINTS` order, then one pass over `fit.modules` in fit order (rigSize here; Task 12 adds
shipRestriction and maxGroupFitted to that same pass), then skills.

- [ ] **Step 1: Write the failing test**

Create `tests/dogma/validate.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { ATTR } from "../../src/lib/dogma/data.js";
import { validateFit, type Problem } from "../../src/lib/dogma/validate.js";
import { fixtureData } from "./fixture.js";
import { allSkills, buildFit } from "./build-fit.js";
import type { Fit, SlotKind } from "../../src/lib/dogma/fit.js";

const data = fixtureData("rifter");

/**
 * Every problem except the skill ones. Most fits in this file are built without skills, and the skill
 * checks (added in the next task) have their own block — filtering keeps each test about one rule.
 */
const nonSkill = (fit: Fit): Problem[] => validateFit(fit).filter((p) => p.kind !== "skill");
const kinds = (fit: Fit): string[] => nonSkill(fit).map((p) => p.kind);

describe("cpu", () => {
  it("passes when the modules fit", () => {
    const fit = buildFit(data, 587, { modules: [[2889, "high", 0], [2889, "high", 1], [2889, "high", 2]] });
    expect(nonSkill(fit)).toEqual([]);
  });

  it("fails when the sum exceeds the hull's output", () => {
    // 3 × 9 + 30 + 30 + 30 + 23 + 25 = 165 tf of 130; powergrid stays at 35 MW of 41.
    const modules: [number, SlotKind, number][] = [
      [2889, "high", 0], [2889, "high", 1], [2889, "high", 2],
      [2048, "low", 0], [519, "low", 1],
      [5443, "mid", 0], [380, "mid", 1], [440, "mid", 2],
    ];
    const problems = nonSkill(buildFit(data, 587, { modules }));
    expect(problems.map((p) => p.kind)).toEqual(["cpu"]);
    expect(problems[0].detail).toBe("CPU: 165 tf used of 130 tf");
    expect(problems[0].item).toBeUndefined();
  });

  it("passes the same fit once the fitting skills are trained", () => {
    const modules: [number, SlotKind, number][] = [
      [2889, "high", 0], [2889, "high", 1], [2889, "high", 2], [2048, "low", 0], [519, "low", 1],
    ];
    expect(validateFit(buildFit(data, 587, { modules, skills: allSkills(data, 5) }))).toEqual([]);
  });
});

describe("power", () => {
  it("passes with two microwarpdrives", () => {
    // 2 × 17 = 34 MW of 41, 2 × 25 = 50 tf of 130.
    expect(nonSkill(buildFit(data, 587, { modules: [[440, "mid", 0], [440, "mid", 1]] }))).toEqual([]);
  });

  it("fails when the powergrid is oversubscribed", () => {
    // 3 × 17 = 51 MW of 41; CPU stays at 75 tf of 130.
    const fit = buildFit(data, 587, { modules: [[440, "mid", 0], [440, "mid", 1], [440, "mid", 2]] });
    const problems = nonSkill(fit);
    expect(problems.map((p) => p.kind)).toEqual(["power"]);
    expect(problems[0].detail).toBe("Powergrid: 51 MW used of 41 MW");
  });
});

describe("calibration", () => {
  it("passes with one 300-point rig and fails with two", () => {
    expect(nonSkill(buildFit(data, 587, { modules: [[31686, "rig", 0]] }))).toEqual([]);
    const problems = nonSkill(buildFit(data, 587, { modules: [[31686, "rig", 0], [31686, "rig", 1]] }));
    expect(problems.map((p) => p.kind)).toEqual(["calibration"]);
    expect(problems[0].detail).toBe("Calibration: 600 used of 400");
  });
});

describe("slots", () => {
  it("passes at exactly the slot count and fails one over", () => {
    const three: [number, SlotKind, number][] = [[5443, "mid", 0], [5443, "mid", 1], [5443, "mid", 2]];
    expect(kinds(buildFit(data, 587, { modules: three }))).toEqual([]);
    const problems = nonSkill(buildFit(data, 587, { modules: [...three, [5443, "mid", 3]] }));
    expect(problems.map((p) => p.kind)).toEqual(["slot"]);
    expect(problems[0].detail).toBe("Mid slots: 4 used of 3");
  });

  it("reports a subsystem slot problem on a hull with none", () => {
    const problems = nonSkill(buildFit(data, 587, { modules: [[2048, "subsystem", 0]] }));
    expect(problems.map((p) => p.detail)).toContain("Subsystem slots: 1 used of 0");
  });
});

describe("hardpoints", () => {
  it("fails when a hull runs out of turret hardpoints before high slots", () => {
    // Hound: 5 high slots but only 2 turret hardpoints.
    const fit = buildFit(data, 12034, { modules: [[2889, "high", 0], [2889, "high", 1], [2889, "high", 2]] });
    const problems = nonSkill(fit);
    expect(problems.map((p) => p.kind)).toEqual(["hardpoint"]);
    expect(problems[0].detail).toBe("Turret hardpoints: 3 used of 2");
  });

  it("passes at exactly the hardpoint count", () => {
    expect(nonSkill(buildFit(data, 12034, { modules: [[2889, "high", 0], [2889, "high", 1]] }))).toEqual([]);
  });
});

describe("rig size", () => {
  it("accepts a small rig on a small hull", () => {
    expect(nonSkill(buildFit(data, 587, { modules: [[31686, "rig", 0]] }))).toEqual([]);
  });

  it("rejects a medium rig on a small hull", () => {
    const fit = buildFit(data, 587, { modules: [[31724, "rig", 0]] });
    const problems = nonSkill(fit);
    expect(problems.map((p) => p.kind)).toEqual(["rigSize"]);
    expect(problems[0].item).toBe(fit.modules[0].item);
    expect(problems[0].detail).toBe("Medium EM Shield Reinforcer II is a size-2 rig; this hull takes size 1");
  });

  it("skips the check when either side has no rigSize", () => {
    const fit = buildFit(data, 587, { modules: [[31724, "rig", 0]] });
    fit.ship.attrs.delete(ATTR.rigSize);
    expect(nonSkill(fit)).toEqual([]);
  });

  it("does not apply the check to a non-rig module", () => {
    const fit = buildFit(data, 587, { modules: [[2048, "low", 0]] });
    fit.modules[0].item.attrs.set(ATTR.rigSize, 3);
    expect(nonSkill(fit)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test and watch it fail**

Run: `npx vitest run tests/dogma/validate.test.ts`
Expected: FAIL — `Failed to resolve import "../../src/lib/dogma/validate.js"`.

- [ ] **Step 3: Write `src/lib/dogma/validate.ts`**

```ts
/**
 * Fit validation. EOS's restriction service aggregates per-item errors and raises one ValidationError;
 * we return the same information as a flat, ordered list so a page can render it. Comparison is
 * `used > output` with no epsilon — the calculator's 2-dp rounding is the tolerance (research §5.9).
 */
import { ATTR, type TypeId } from "./data.js";
import { HARDPOINTS, SLOT_KINDS, type Fit, type Hardpoint, type Item, type SlotKind } from "./fit.js";
import { fitStats, type FitStats } from "./stats.js";

export type ProblemKind =
  | "cpu" | "power" | "calibration" | "slot" | "hardpoint"
  | "rigSize" | "shipRestriction" | "maxGroupFitted" | "skill";

export interface MissingSkill {
  skillTypeId: TypeId;
  required: number;
  have: number;
}

export interface Problem {
  kind: ProblemKind;
  /** The offending module, where the problem is about one item. */
  item?: Item;
  detail: string;
  /** Set only when `kind` is "skill". */
  skill?: MissingSkill;
}

const SLOT_LABELS: Record<SlotKind, string> = {
  high: "High", mid: "Mid", low: "Low", rig: "Rig", subsystem: "Subsystem",
};

const HARDPOINT_LABELS: Record<Hardpoint, string> = { turret: "Turret", launcher: "Launcher" };

export function itemLabel(item: Item): string {
  return item.name ?? `type ${item.typeId}`;
}

export function validateFit(fit: Fit): Problem[] {
  const stats = fitStats(fit);
  const problems: Problem[] = [];
  resourceProblems(stats, problems);
  slotProblems(stats, problems);
  hardpointProblems(stats, problems);
  moduleProblems(fit, problems);
  return problems;
}

function resourceProblems(stats: FitStats, out: Problem[]): void {
  if (stats.cpu.used > stats.cpu.output) {
    out.push({ kind: "cpu", detail: `CPU: ${stats.cpu.used} tf used of ${stats.cpu.output} tf` });
  }
  if (stats.power.used > stats.power.output) {
    out.push({ kind: "power", detail: `Powergrid: ${stats.power.used} MW used of ${stats.power.output} MW` });
  }
  if (stats.calibration.used > stats.calibration.output) {
    out.push({
      kind: "calibration",
      detail: `Calibration: ${stats.calibration.used} used of ${stats.calibration.output}`,
    });
  }
}

function slotProblems(stats: FitStats, out: Problem[]): void {
  for (const kind of SLOT_KINDS) {
    const { used, total } = stats.slots[kind];
    if (used > total) {
      out.push({ kind: "slot", detail: `${SLOT_LABELS[kind]} slots: ${used} used of ${total}` });
    }
  }
}

function hardpointProblems(stats: FitStats, out: Problem[]): void {
  for (const kind of HARDPOINTS) {
    const { used, total } = stats.hardpoints[kind];
    if (used > total) {
      out.push({ kind: "hardpoint", detail: `${HARDPOINT_LABELS[kind]} hardpoints: ${used} used of ${total}` });
    }
  }
}

function moduleProblems(fit: Fit, out: Problem[]): void {
  // Raw, unmodified attribute — EOS compares type attributes and skips when either side lacks rigSize.
  const hullRigSize = fit.ship.attrs.get(ATTR.rigSize);
  for (const { item, slot } of fit.modules) {
    if (slot !== "rig") continue;
    const rigSize = item.attrs.get(ATTR.rigSize);
    if (rigSize === undefined || hullRigSize === undefined || rigSize === hullRigSize) continue;
    out.push({
      kind: "rigSize",
      item,
      detail: `${itemLabel(item)} is a size-${rigSize} rig; this hull takes size ${hullRigSize}`,
    });
  }
}
```

- [ ] **Step 4: Run the test and the type checker**

Run: `npx vitest run tests/dogma/validate.test.ts && npm run typecheck`
Expected: PASS, typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add src/lib/dogma/validate.ts tests/dogma/validate.test.ts
git commit -m "feat(dogma): validate cpu, powergrid, calibration, slots, hardpoints and rig size

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 12: Validation part 2 — ship restriction, maxGroupFitted, recursive skills

**Files:**
- Modify: `src/lib/dogma/validate.ts` (extend `moduleProblems`, add `missingSkills`)
- Modify: `tests/dogma/validate.test.ts` (append three `describe` blocks)

**Interfaces:**
- Consumes: Task 1 `CAN_FIT_SHIP_TYPE_ATTRS`, `CAN_FIT_SHIP_GROUP_ATTRS`, `REQUIRED_SKILL_ATTRS`, `ATTR`;
  Task 5 `requiredSkills`.
- Produces (added to `src/lib/dogma/validate.ts`):
```ts
export function missingSkills(fit: Fit): MissingSkill[];   // deduplicated, highest requirement wins, ascending by id
```

**Rules (spec §2.4, research §5.6/§5.7/§5.8):**
- `shipRestriction`: the union of the module's raw `canFitShipType1..12` (1302, 1303, 1304, 1305, 1944,
  2103, 2463, 2486, 2487, 2488, 2758, 5948) **plus** `fitsToShipType` 1380 folded into the *type* set, and
  its raw `canFitShipGroup01..20`. If the union is non-empty the hull's **type** or **group** must appear in
  it. **Rigs and subsystems are exempt** (EOS restricts the check to high/mid/low modules).
- `maxGroupFitted`: **Pyfa's raw attribute value**, deliberately — Pyfa's source comment records FAXes whose
  capacitor boosters read 10 unmodified and 1 modified while the game lets you fit several. One problem per
  offending module when the count of same-`groupId` modules exceeds its raw 1544.
- `skill`: required skills of the hull, of every non-rig module, of their charges and of the drones, with
  **each missing skill's own prerequisites expanded recursively** and the result deduplicated — the highest
  requirement per skill wins. A skill trained to its required level stops the recursion, because its own
  prerequisites are necessarily met. **Rigs are exempt entirely** (both reference engines skip them).

- [ ] **Step 1: Write the failing tests**

Append to `tests/dogma/validate.test.ts`:
```ts
describe("ship restriction", () => {
  it("accepts a bomb launcher on a stealth bomber", () => {
    // Bomb Launcher II carries canFitShipGroup01 = 834; the Hound is group 834.
    const fit = buildFit(data, 12034, { modules: [[4256, "high", 0]], skills: allSkills(data, 5) });
    expect(validateFit(fit)).toEqual([]);
  });

  it("rejects it on a Rifter", () => {
    const fit = buildFit(data, 587, { modules: [[4256, "high", 0]], skills: allSkills(data, 5) });
    const problems = nonSkill(fit);
    expect(problems).toHaveLength(1);
    expect(problems[0].item).toBe(fit.modules[0].item);
    expect(problems[0].detail).toBe("Bomb Launcher II cannot be fitted to Rifter");
  });

  it("accepts a module that names the hull's type id", () => {
    const fit = buildFit(data, 587, { modules: [[2048, "low", 0]] });
    fit.modules[0].item.attrs.set(1302, 587);
    expect(nonSkill(fit)).toEqual([]);
  });

  it("rejects a module that names a different type id", () => {
    const fit = buildFit(data, 587, { modules: [[2048, "low", 0]] });
    fit.modules[0].item.attrs.set(1302, 626);
    expect(nonSkill(fit).map((p) => p.kind)).toEqual(["shipRestriction"]);
  });

  it("folds fitsToShipType into the type set", () => {
    const fit = buildFit(data, 587, { modules: [[2048, "low", 0]] });
    fit.modules[0].item.attrs.set(ATTR.fitsToShipType, 587);
    expect(nonSkill(fit)).toEqual([]);
  });

  it("exempts rigs and subsystems", () => {
    const fit = buildFit(data, 587, { modules: [[31686, "rig", 0]] });
    fit.modules[0].item.attrs.set(1302, 626);
    expect(nonSkill(fit)).toEqual([]);
  });
});

describe("maxGroupFitted", () => {
  it("accepts one Damage Control II", () => {
    expect(nonSkill(buildFit(data, 587, { modules: [[2048, "low", 0]] }))).toEqual([]);
  });

  it("rejects two, flagging both", () => {
    const fit = buildFit(data, 587, { modules: [[2048, "low", 0], [2048, "low", 1]] });
    const problems = validateFit(fit).filter((p) => p.kind === "maxGroupFitted");
    expect(problems).toHaveLength(2);
    expect(problems[0].item).toBe(fit.modules[0].item);
    expect(problems[1].item).toBe(fit.modules[1].item);
    expect(problems[0].detail).toBe("Damage Control II: only 1 of this group can be fitted (2 fitted)");
  });

  it("counts duplicates regardless of state", () => {
    const fit = buildFit(data, 587, { modules: [[33076, "low", 0], [33076, "low", 1]] });
    fit.modules[1].item.state = State.Offline;
    clearMemo(fit);
    expect(validateFit(fit).filter((p) => p.kind === "maxGroupFitted")).toHaveLength(2);
  });

  it("uses the raw value, not the modified one", () => {
    const fit = buildFit(data, 587, { modules: [[2048, "low", 0], [2048, "low", 1]] });
    // Pyfa's ruling: a modified maxGroupFitted is deliberately ignored.
    expect(fit.modules[0].item.attrs.get(ATTR.maxGroupFitted)).toBe(1);
    expect(validateFit(fit).filter((p) => p.kind === "maxGroupFitted")).toHaveLength(2);
  });

  it("says nothing about modules of a different group", () => {
    const fit = buildFit(data, 587, { modules: [[2048, "low", 0], [519, "low", 1]] });
    expect(validateFit(fit).filter((p) => p.kind === "maxGroupFitted")).toEqual([]);
  });
});

describe("skills", () => {
  it("reports nothing when everything is trained to V", () => {
    const fit = buildFit(data, 587, {
      modules: [[2889, "high", 0]], charges: new Map([[0, 12608]]), drones: [2456],
      skills: allSkills(data, 5),
    });
    expect(missingSkills(fit)).toEqual([]);
    expect(validateFit(fit)).toEqual([]);
  });

  it("expands the hull's and the turret's prerequisites recursively at skill 0", () => {
    const fit = buildFit(data, 587, { modules: [[2889, "high", 0]] });
    expect(missingSkills(fit)).toEqual([
      { skillTypeId: 3300, required: 2, have: 0 },    // Gunnery, raised from 1 by the turret's own requirement
      { skillTypeId: 3302, required: 5, have: 0 },    // Small Projectile Turret
      { skillTypeId: 3312, required: 3, have: 0 },    // Motion Prediction, via Small Autocannon Specialization
      { skillTypeId: 3327, required: 1, have: 0 },    // Spaceship Command, via Minmatar Frigate
      { skillTypeId: 3329, required: 1, have: 0 },    // Minmatar Frigate, from the hull
      { skillTypeId: 11084, required: 1, have: 0 },   // Small Autocannon Specialization
    ]);
  });

  it("stops recursing into a skill that is already trained deeply enough", () => {
    const fit = buildFit(data, 587, { modules: [[2889, "high", 0]], skills: allSkills(data, 1) });
    expect(missingSkills(fit)).toEqual([
      { skillTypeId: 3300, required: 2, have: 1 },
      { skillTypeId: 3302, required: 5, have: 1 },
    ]);
  });

  it("checks a charge's own requirements", () => {
    // 125mm Gatling AutoCannon I needs only 3302/3300; Hail S needs Small Autocannon Specialization I.
    const fit = buildFit(data, 587, {
      modules: [[484, "high", 0]], charges: new Map([[0, 12608]]), skills: allSkills(data, 5),
    });
    fit.skills.get(11084)!.attrs.set(ATTR.skillLevel, 0);
    // 11084's own prerequisites (3312 III, 3302 V) are trained, so the recursion stops there.
    expect(missingSkills(fit)).toEqual([{ skillTypeId: 11084, required: 1, have: 0 }]);
  });

  it("checks drones", () => {
    const fit = buildFit(data, 587, { drones: [2456], skills: allSkills(data, 5) });
    fit.skills.get(24241)!.attrs.set(ATTR.skillLevel, 2);   // Light Drone Operation V required
    expect(missingSkills(fit)).toEqual([{ skillTypeId: 24241, required: 5, have: 2 }]);
  });

  it("exempts rigs", () => {
    const fit = buildFit(data, 587, { modules: [[31686, "rig", 0]], skills: allSkills(data, 5) });
    fit.modules[0].item.attrs.set(182, 3300);
    fit.modules[0].item.attrs.set(277, 5);
    fit.skills.get(3300)!.attrs.set(ATTR.skillLevel, 0);
    expect(missingSkills(fit)).toEqual([]);
  });

  it("surfaces each missing skill as its own Problem", () => {
    const fit = buildFit(data, 587, { modules: [[2889, "high", 0]], skills: allSkills(data, 1) });
    const problems = validateFit(fit).filter((p) => p.kind === "skill");
    expect(problems.map((p) => p.skill)).toEqual([
      { skillTypeId: 3300, required: 2, have: 1 },
      { skillTypeId: 3302, required: 5, have: 1 },
    ]);
    expect(problems[0].detail).toBe("Gunnery level 2 required (trained 1)");
    expect(problems[1].detail).toBe("Small Projectile Turret level 5 required (trained 1)");
    expect(problems[0].item).toBeUndefined();
  });
});
```
Also extend the imports at the top of `tests/dogma/validate.test.ts`:
```ts
import { ATTR, State } from "../../src/lib/dogma/data.js";
import { clearMemo } from "../../src/lib/dogma/calc.js";
import { missingSkills, validateFit, type Problem } from "../../src/lib/dogma/validate.js";
```

- [ ] **Step 2: Run the tests and watch them fail**

Run: `npx vitest run tests/dogma/validate.test.ts`
Expected: FAIL — `missingSkills is not a function`, plus the shipRestriction/maxGroupFitted expectations.

- [ ] **Step 3: Extend `src/lib/dogma/validate.ts`**

Replace the file's existing `./data.js` and `./fit.js` import statements with these two (leave the
`./stats.js` import alone):
```ts
import {
  ATTR, CAN_FIT_SHIP_GROUP_ATTRS, CAN_FIT_SHIP_TYPE_ATTRS, REQUIRED_SKILL_ATTRS, type TypeId,
} from "./data.js";
import { HARDPOINTS, SLOT_KINDS, requiredSkills, type Fit, type Hardpoint, type Item, type SlotKind } from "./fit.js";
```

Then replace `moduleProblems` with this version and append the two new functions after it:
```ts
function moduleProblems(fit: Fit, out: Problem[]): void {
  // Raw, unmodified attribute — EOS compares type attributes and skips when either side lacks rigSize.
  const hullRigSize = fit.ship.attrs.get(ATTR.rigSize);
  for (const { item, slot } of fit.modules) {
    if (slot === "rig") {
      const rigSize = item.attrs.get(ATTR.rigSize);
      if (rigSize !== undefined && hullRigSize !== undefined && rigSize !== hullRigSize) {
        out.push({
          kind: "rigSize",
          item,
          detail: `${itemLabel(item)} is a size-${rigSize} rig; this hull takes size ${hullRigSize}`,
        });
      }
    }
    // Rigs and subsystems are exempt from the hull restriction (EOS checks high/mid/low only).
    if (slot !== "rig" && slot !== "subsystem" && !allowedOnHull(fit, item)) {
      out.push({
        kind: "shipRestriction",
        item,
        detail: `${itemLabel(item)} cannot be fitted to ${itemLabel(fit.ship)}`,
      });
    }
    const max = item.attrs.get(ATTR.maxGroupFitted);      // Pyfa's ruling: the raw value
    if (max !== undefined && max > 0) {
      const fitted = fit.modules.filter((m) => m.item.groupId === item.groupId).length;
      if (fitted > max) {
        out.push({
          kind: "maxGroupFitted",
          item,
          detail: `${itemLabel(item)}: only ${max} of this group can be fitted (${fitted} fitted)`,
        });
      }
    }
  }
  for (const missing of missingSkills(fit)) {
    const name = fit.data.types.get(missing.skillTypeId)?.name ?? `skill ${missing.skillTypeId}`;
    out.push({
      kind: "skill",
      skill: missing,
      detail: `${name} level ${missing.required} required (trained ${missing.have})`,
    });
  }
}

/** The union of canFitShipType*/fitsToShipType and canFitShipGroup*; empty means "fits anything". */
function allowedOnHull(fit: Fit, item: Item): boolean {
  const typeIds = new Set<number>();
  const groupIds = new Set<number>();
  for (const attrId of [...CAN_FIT_SHIP_TYPE_ATTRS, ATTR.fitsToShipType]) {
    const value = item.attrs.get(attrId);
    if (value !== undefined && value > 0) typeIds.add(Math.round(value));
  }
  for (const attrId of CAN_FIT_SHIP_GROUP_ATTRS) {
    const value = item.attrs.get(attrId);
    if (value !== undefined && value > 0) groupIds.add(Math.round(value));
  }
  if (typeIds.size === 0 && groupIds.size === 0) return true;
  return typeIds.has(fit.ship.typeId) || groupIds.has(fit.ship.groupId);
}

/**
 * Every unmet skill requirement of the hull, the non-rig modules, their charges and the drones, with each
 * missing skill's own prerequisites expanded recursively and the highest requirement per skill kept.
 */
export function missingSkills(fit: Fit): MissingSkill[] {
  const trained = (skillTypeId: TypeId): number =>
    fit.skills.get(skillTypeId)?.attrs.get(ATTR.skillLevel) ?? 0;
  const worst = new Map<TypeId, MissingSkill>();

  const record = (skillTypeId: TypeId, required: number): void => {
    const have = trained(skillTypeId);
    if (have >= required) return;              // trained deeply enough: its own prerequisites are met too
    const already = worst.get(skillTypeId);
    if (already && already.required >= required) return;
    worst.set(skillTypeId, { skillTypeId, required, have });
    const type = fit.data.types.get(skillTypeId);
    if (!type) return;                         // this SDE build does not know the skill
    for (const [skillAttr, levelAttr] of REQUIRED_SKILL_ATTRS) {
      const child = type.attrs.get(skillAttr);
      if (child === undefined || child <= 0) continue;
      record(Math.round(child), Math.round(type.attrs.get(levelAttr) ?? 0));
    }
  };

  const checked: Item[] = [fit.ship];
  for (const { item, slot } of fit.modules) {
    if (slot === "rig") continue;              // both reference engines exempt rigs entirely
    checked.push(item);
    if (item.charge) checked.push(item.charge);
  }
  checked.push(...fit.drones);
  for (const item of checked) {
    for (const { skillTypeId, level } of requiredSkills(item)) record(skillTypeId, level);
  }
  return [...worst.values()].sort((a, b) => a.skillTypeId - b.skillTypeId);
}
```

- [ ] **Step 4: Run the tests and the type checker**

Run: `npx vitest run tests/dogma/validate.test.ts && npm run typecheck`
Expected: PASS, typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add src/lib/dogma/validate.ts tests/dogma/validate.test.ts
git commit -m "feat(dogma): ship restriction, maxGroupFitted and recursive skill validation

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 13: Fit builder from assets (`src/lib/dogma/build.ts`)

**Files:**
- Create: `src/lib/dogma/build.ts`, `tests/dogma/build-assets.test.ts`

**Interfaces:**
- Consumes: Task 1 `DogmaData`, `TypeId`; Task 5 `createFit`/`makeItem`/`makeSkill`/`addModule`/
  `attachCharge`/`SLOT_KINDS`/`UnknownTypeError`; Task 8 `clearMemo`; phase-3 `AssetRow`
  (**type-only import**).
- Produces:
```ts
export interface FitContext { data: DogmaData; skills: Map<TypeId, number>; implants: TypeId[] }
export interface FitEntry { typeId: TypeId; quantity: number; flag: string; name: string | null }
export interface BuiltFit { fit: Fit; cargo: FitEntry[]; drones: FitEntry[]; unfittable: FitEntry[]; unknown: FitEntry[] }
export const DRONE_BAY_FLAG: string;              // "DroneBay"
export const INVALID_FLAG: string;                // "Invalid"
export function slotFromFlag(flag: string): { slot: SlotKind; index: number } | null;
export function fitFromAssets(shipAsset: AssetRow, childAssets: AssetRow[], ctx: FitContext): BuiltFit;
```
(`fitFromFitting` is added in Task 14 to the same file.)

**Rules (spec §2.5, §6):**
- Flags `HiSlot0..n`, `MedSlot0..n`, `LoSlot0..n`, `RigSlot0..n`, `SubSystemSlot0..n` map to
  high/mid/low/rig/subsystem with the trailing integer as the index. Anything else that is not
  `DroneBay` is **cargo**, not fitted.
- Within one slot flag, the **singleton** asset is the module and any non-singleton asset sharing that
  flag is its charge (at most one charge per module; extras go to cargo).
- Children are matched by `locationId === shipAsset.itemId`; anything else in the input is ignored.
- Modules are emitted in a stable order: by slot kind (`SLOT_KINDS` order) then by index, so two runs of
  the same assets always produce the same fit.
- A type this SDE build does not know is recorded in `unknown` and left out of the calculation (spec §6);
  the charges of an unfitted module fall through to `cargo`. An **unknown hull** throws
  `UnknownTypeError` — the caller renders "Could not compute" for that ship.
- `ctx.skills` becomes `fit.skills` (skill items seeded with attribute 280) and `ctx.implants` becomes
  `fit.implants`; ids the SDE does not know are skipped silently.
- Drones' combat contribution is out of scope (spec §8), so `fit.drones` carries one modelled item per
  drone-bay row while `BuiltFit.drones` keeps the rows with their quantities for display.

- [ ] **Step 1: Write the failing test**

Create `tests/dogma/build-assets.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { ATTR } from "../../src/lib/dogma/data.js";
import { UnknownTypeError } from "../../src/lib/dogma/fit.js";
import { fitFromAssets, slotFromFlag, type FitContext } from "../../src/lib/dogma/build.js";
import { fitStats } from "../../src/lib/dogma/stats.js";
import type { AssetRow } from "../../src/lib/db/character-assets.js";
import { fixtureData } from "./fixture.js";

const data = fixtureData("rifter");

const ctx: FitContext = { data, skills: new Map([[3426, 5], [3413, 5], [3318, 5], [11207, 5]]), implants: [27143] };

function asset(over: Partial<AssetRow> & Pick<AssetRow, "itemId" | "typeId">): AssetRow {
  return {
    quantity: 1, locationId: 1000, locationType: "item", locationFlag: "Cargo",
    isSingleton: true, isBlueprintCopy: false, name: null, ...over,
  };
}

const SHIP = asset({ itemId: 1000, typeId: 587, locationId: 60003760, locationType: "station", locationFlag: "Hangar", name: "Scout One" });

describe("slotFromFlag", () => {
  it("maps every slot flag family with its index", () => {
    expect(slotFromFlag("HiSlot0")).toEqual({ slot: "high", index: 0 });
    expect(slotFromFlag("HiSlot7")).toEqual({ slot: "high", index: 7 });
    expect(slotFromFlag("MedSlot2")).toEqual({ slot: "mid", index: 2 });
    expect(slotFromFlag("LoSlot3")).toEqual({ slot: "low", index: 3 });
    expect(slotFromFlag("RigSlot1")).toEqual({ slot: "rig", index: 1 });
    expect(slotFromFlag("SubSystemSlot4")).toEqual({ slot: "subsystem", index: 4 });
  });

  it("rejects anything else", () => {
    for (const flag of ["Cargo", "DroneBay", "Hangar", "HiSlot", "HiSlotX", "AutoFit", "Invalid", ""]) {
      expect(slotFromFlag(flag)).toBeNull();
    }
  });
});

describe("fitFromAssets", () => {
  const children: AssetRow[] = [
    asset({ itemId: 1006, typeId: 12608, locationFlag: "Cargo", quantity: 1000, isSingleton: false }),
    asset({ itemId: 1001, typeId: 2889, locationFlag: "HiSlot0" }),
    asset({ itemId: 1002, typeId: 12608, locationFlag: "HiSlot0", quantity: 200, isSingleton: false }),
    asset({ itemId: 1008, typeId: 2889, locationFlag: "HiSlot1" }),
    asset({ itemId: 1003, typeId: 2048, locationFlag: "LoSlot0" }),
    asset({ itemId: 1004, typeId: 31686, locationFlag: "RigSlot0" }),
    asset({ itemId: 1005, typeId: 2456, locationFlag: "DroneBay", quantity: 5, isSingleton: false }),
    asset({ itemId: 1007, typeId: 999999, locationFlag: "MedSlot0" }),
    asset({ itemId: 2001, typeId: 2048, locationId: 9999, locationFlag: "LoSlot1" }),
  ];

  it("puts the modules in their slots in a stable order", () => {
    const built = fitFromAssets(SHIP, children, ctx);
    expect(built.fit.modules.map((m) => [m.item.typeId, m.slot, m.index])).toEqual([
      [2889, "high", 0], [2889, "high", 1], [2048, "low", 0], [31686, "rig", 0],
    ]);
  });

  it("hangs a non-singleton item sharing a module's flag under that module", () => {
    const built = fitFromAssets(SHIP, children, ctx);
    expect(built.fit.modules[0].item.charge?.typeId).toBe(12608);
    expect(built.fit.modules[0].item.charge?.container).toBe(built.fit.modules[0].item);
    expect(built.fit.modules[1].item.charge).toBeUndefined();
  });

  it("splits drones, cargo and unknown types out of the fit", () => {
    const built = fitFromAssets(SHIP, children, ctx);
    expect(built.drones).toEqual([{ typeId: 2456, quantity: 5, flag: "DroneBay", name: null }]);
    expect(built.fit.drones.map((d) => d.typeId)).toEqual([2456]);
    expect(built.cargo).toEqual([{ typeId: 12608, quantity: 1000, flag: "Cargo", name: null }]);
    expect(built.unknown).toEqual([{ typeId: 999999, quantity: 1, flag: "MedSlot0", name: null }]);
    expect(built.unfittable).toEqual([]);
  });

  it("ignores assets that live in another container", () => {
    const built = fitFromAssets(SHIP, children, ctx);
    expect(built.fit.modules.some((m) => m.index === 1 && m.slot === "low")).toBe(false);
  });

  it("carries the context's skills and implants into the fit", () => {
    const built = fitFromAssets(SHIP, children, ctx);
    expect([...built.fit.skills.keys()].sort((a, b) => a - b)).toEqual([3318, 3413, 3426, 11207]);
    expect(built.fit.skills.get(3426)!.attrs.get(ATTR.skillLevel)).toBe(5);
    expect(built.fit.implants.map((i) => i.typeId)).toEqual([27143]);
  });

  it("produces a fit the rest of the engine can measure", () => {
    const stats = fitStats(fitFromAssets(SHIP, children, ctx).fit);
    expect(stats.cpu.output).toBe(164.13);       // 130 × 1.25 (CPU Management V) × 1.01 (EE-601)
    expect(stats.cpu.used).toBe(43.5);           // 2 × 6.75 + 30
    expect(stats.calibration.used).toBe(300);
    expect(stats.hardpoints.turret).toEqual({ used: 2, total: 3 });
  });

  it("skips skills and implants this SDE build does not know", () => {
    const built = fitFromAssets(SHIP, [], { data, skills: new Map([[3426, 5], [999999, 5]]), implants: [999999] });
    expect([...built.fit.skills.keys()]).toEqual([3426]);
    expect(built.fit.implants).toEqual([]);
  });

  it("throws when the hull's own type is unknown", () => {
    expect(() => fitFromAssets(asset({ itemId: 1, typeId: 999999 }), [], ctx)).toThrow(UnknownTypeError);
  });

  it("drops the charges of a module it could not build into cargo", () => {
    const built = fitFromAssets(SHIP, [
      asset({ itemId: 3001, typeId: 999999, locationFlag: "HiSlot0" }),
      asset({ itemId: 3002, typeId: 12608, locationFlag: "HiSlot0", quantity: 50, isSingleton: false }),
    ], ctx);
    expect(built.fit.modules).toEqual([]);
    expect(built.unknown.map((e) => e.typeId)).toEqual([999999]);
    expect(built.cargo).toEqual([{ typeId: 12608, quantity: 50, flag: "HiSlot0", name: null }]);
  });

  it("keeps a renamed item's name on its entry", () => {
    const built = fitFromAssets(SHIP, [
      asset({ itemId: 4001, typeId: 12608, locationFlag: "Cargo", quantity: 3, isSingleton: false, name: "spare ammo" }),
    ], ctx);
    expect(built.cargo).toEqual([{ typeId: 12608, quantity: 3, flag: "Cargo", name: "spare ammo" }]);
  });
});
```

- [ ] **Step 2: Run the test and watch it fail**

Run: `npx vitest run tests/dogma/build-assets.test.ts`
Expected: FAIL — `Failed to resolve import "../../src/lib/dogma/build.js"`.

- [ ] **Step 3: Write `src/lib/dogma/build.ts`**

```ts
/**
 * Turning phase-3 rows into fits.
 *
 * The row types are imported with `import type`, which is erased at compile time — this file stays free
 * of any value import from src/lib/db, so the engine remains isomorphic.
 */
import type { AssetRow } from "../db/character-assets.js";
import type { DogmaData, TypeId } from "./data.js";
import {
  SLOT_KINDS, addModule, attachCharge, createFit, makeItem, makeSkill,
  type Fit, type Item, type SlotKind,
} from "./fit.js";
import { clearMemo } from "./calc.js";

export interface FitContext {
  data: DogmaData;
  /** typeId → trained level, from character_skills. */
  skills: Map<TypeId, number>;
  /** the active clone's implants, from character_implants. */
  implants: TypeId[];
}

export interface FitEntry {
  typeId: TypeId;
  quantity: number;
  flag: string;
  name: string | null;
}

export interface BuiltFit {
  fit: Fit;
  cargo: FitEntry[];
  drones: FitEntry[];
  /** Fitting items whose flag is `Invalid` — listed, never modelled. */
  unfittable: FitEntry[];
  /** Items whose type this SDE build does not know (spec §6). */
  unknown: FitEntry[];
}

export const DRONE_BAY_FLAG = "DroneBay";
export const INVALID_FLAG = "Invalid";

const SLOT_FLAG_PREFIXES: readonly (readonly [string, SlotKind])[] = [
  ["HiSlot", "high"], ["MedSlot", "mid"], ["LoSlot", "low"],
  ["RigSlot", "rig"], ["SubSystemSlot", "subsystem"],
];

export function slotFromFlag(flag: string): { slot: SlotKind; index: number } | null {
  for (const [prefix, slot] of SLOT_FLAG_PREFIXES) {
    if (!flag.startsWith(prefix)) continue;
    const rest = flag.slice(prefix.length);
    if (!/^\d+$/.test(rest)) return null;
    return { slot, index: Number(rest) };
  }
  return null;
}

export function fitFromAssets(shipAsset: AssetRow, childAssets: AssetRow[], ctx: FitContext): BuiltFit {
  const built = startFit(ctx, shipAsset.typeId);
  const slotted = new Map<string, { entry: FitEntry; isSingleton: boolean }[]>();

  for (const asset of childAssets) {
    if (asset.locationId !== shipAsset.itemId) continue;      // not inside this ship
    const entry: FitEntry = {
      typeId: asset.typeId, quantity: asset.quantity, flag: asset.locationFlag, name: asset.name,
    };
    if (slotFromFlag(asset.locationFlag)) {
      pushInto(slotted, asset.locationFlag, { entry, isSingleton: asset.isSingleton });
      continue;
    }
    if (asset.locationFlag === DRONE_BAY_FLAG) { addDrone(built, ctx, entry); continue; }
    built.cargo.push(entry);
  }

  for (const flag of orderedFlags(slotted.keys())) {
    const group = slotted.get(flag) ?? [];
    // The singleton is the module; anything non-singleton sharing its flag is a charge.
    const module = group.find((g) => g.isSingleton) ?? group[0];
    const { slot, index } = slotFromFlag(flag)!;
    fitOneModule(built, ctx, module.entry, slot, index, group.filter((g) => g !== module).map((g) => g.entry));
  }

  clearMemo(built.fit);
  return built;
}

function startFit(ctx: FitContext, shipTypeId: TypeId): BuiltFit {
  // An unknown hull is fatal for this fit; the caller renders "Could not compute".
  const fit = createFit(ctx.data, makeItem(ctx.data, shipTypeId));
  for (const [typeId, level] of ctx.skills) {
    if (ctx.data.types.has(typeId)) fit.skills.set(typeId, makeSkill(ctx.data, typeId, level));
  }
  for (const typeId of ctx.implants) {
    if (ctx.data.types.has(typeId)) fit.implants.push(makeItem(ctx.data, typeId));
  }
  return { fit, cargo: [], drones: [], unfittable: [], unknown: [] };
}

function fitOneModule(
  built: BuiltFit, ctx: FitContext, entry: FitEntry, slot: SlotKind, index: number, charges: FitEntry[],
): void {
  const item = tryMakeItem(built, ctx, entry);
  if (!item) {
    built.cargo.push(...charges);        // nothing to hang them on
    return;
  }
  let attached = false;
  for (const chargeEntry of charges) {
    if (attached) { built.cargo.push(chargeEntry); continue; }
    const charge = tryMakeItem(built, ctx, chargeEntry);
    if (!charge) continue;
    attachCharge(item, charge);
    attached = true;
  }
  addModule(built.fit, item, slot, index);
}

function tryMakeItem(built: BuiltFit, ctx: FitContext, entry: FitEntry): Item | null {
  if (!ctx.data.types.has(entry.typeId)) {
    built.unknown.push(entry);
    return null;
  }
  return makeItem(ctx.data, entry.typeId);
}

function addDrone(built: BuiltFit, ctx: FitContext, entry: FitEntry): void {
  built.drones.push(entry);
  // Drones' contribution is out of scope (spec §8); one modelled item per row is enough for skills.
  const item = tryMakeItem(built, ctx, entry);
  if (item) built.fit.drones.push(item);
}

function pushInto<T>(into: Map<string, T[]>, key: string, value: T): void {
  const list = into.get(key);
  if (list) list.push(value); else into.set(key, [value]);
}

/** Stable module order: by slot kind, then by index. */
function orderedFlags(flags: Iterable<string>): string[] {
  return [...flags].sort((a, b) => {
    const left = slotFromFlag(a)!;
    const right = slotFromFlag(b)!;
    const bySlot = SLOT_KINDS.indexOf(left.slot) - SLOT_KINDS.indexOf(right.slot);
    return bySlot !== 0 ? bySlot : left.index - right.index;
  });
}
```

- [ ] **Step 4: Run the test and the type checker**

Run: `npx vitest run tests/dogma/build-assets.test.ts && npm run typecheck`
Expected: PASS, typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add src/lib/dogma/build.ts tests/dogma/build-assets.test.ts
git commit -m "feat(dogma): build a fit from character asset rows

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 14: Fit builder from saved fittings, and the public barrel

**Files:**
- Modify: `src/lib/dogma/build.ts` (add `fitFromFitting`)
- Create: `src/lib/dogma/index.ts`, `tests/dogma/build-fitting.test.ts`

**Interfaces:**
- Consumes: Task 13 `FitContext`, `FitEntry`, `BuiltFit`, `slotFromFlag`, the private helpers in
  `build.ts`; Task 5 `slotOfType`; phase-3 `FittingRow`, `FittingItemRow` (**type-only import**).
- Produces:
```ts
export function fitFromFitting(fitting: FittingRow, items: FittingItemRow[], ctx: FitContext): BuiltFit;
// src/lib/dogma/index.ts re-exports the whole phase-4b surface (listed at the end of this plan)
```

**Rules (spec §2.5):** a saved fitting has no `is_singleton`, so within a slot flag the **module** is the
entry whose type carries that slot's marker effect (11/12/13/2663/3772) and the remaining entries are its
charges. Flag `Invalid` goes to `unfittable` and is never modelled. `DroneBay` goes to drones, everything
else to cargo. `FittingRow` already embeds its items; the spec's three-argument signature is kept so a
caller can pass a filtered list, and normal callers pass `fitting.items`.

- [ ] **Step 1: Write the failing test**

Create `tests/dogma/build-fitting.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { UnknownTypeError } from "../../src/lib/dogma/fit.js";
import { fitFromFitting, type FitContext } from "../../src/lib/dogma/build.js";
import { fitStats } from "../../src/lib/dogma/stats.js";
import { validateFit } from "../../src/lib/dogma/validate.js";
import type { FittingItemRow, FittingRow } from "../../src/lib/db/character-fittings.js";
import { fixtureData } from "./fixture.js";

const data = fixtureData("rifter");
const ctx: FitContext = { data, skills: new Map(), implants: [] };

function fitting(shipTypeId: number, items: [number, number, string][]): FittingRow {
  return {
    fittingId: 4021, name: "Rifter — cheap tackle", description: "", shipTypeId,
    items: items.map(([typeId, quantity, flag], idx): FittingItemRow => ({ idx, typeId, quantity, flag })),
  };
}

describe("fitFromFitting", () => {
  const saved = fitting(587, [
    [484, 1, "HiSlot0"],
    [484, 1, "HiSlot1"],
    [12608, 100, "HiSlot0"],       // ammo loaded into the first gun
    [5443, 1, "MedSlot0"],
    [2048, 1, "LoSlot0"],
    [31686, 1, "RigSlot0"],
    [12608, 400, "Cargo"],
    [2456, 5, "DroneBay"],
    [27339, 1, "Invalid"],
  ]);

  it("places the modules and hangs the ammo under the gun that shares its flag", () => {
    const built = fitFromFitting(saved, saved.items, ctx);
    expect(built.fit.modules.map((m) => [m.item.typeId, m.slot, m.index])).toEqual([
      [484, "high", 0], [484, "high", 1], [5443, "mid", 0], [2048, "low", 0], [31686, "rig", 0],
    ]);
    expect(built.fit.modules[0].item.charge?.typeId).toBe(12608);
    expect(built.fit.modules[1].item.charge).toBeUndefined();
  });

  it("lists the Invalid entry as unfittable rather than modelling it", () => {
    const built = fitFromFitting(saved, saved.items, ctx);
    expect(built.unfittable).toEqual([{ typeId: 27339, quantity: 1, flag: "Invalid", name: null }]);
    expect(built.fit.modules.some((m) => m.item.typeId === 27339)).toBe(false);
  });

  it("splits cargo and drones out", () => {
    const built = fitFromFitting(saved, saved.items, ctx);
    expect(built.cargo).toEqual([{ typeId: 12608, quantity: 400, flag: "Cargo", name: null }]);
    expect(built.drones).toEqual([{ typeId: 2456, quantity: 5, flag: "DroneBay", name: null }]);
    expect(built.fit.drones.map((d) => d.typeId)).toEqual([2456]);
    expect(built.unknown).toEqual([]);
  });

  it("produces a fit the rest of the engine can measure and validate", () => {
    const built = fitFromFitting(saved, saved.items, ctx);
    const stats = fitStats(built.fit);
    expect(stats.cpu).toEqual({ used: 66, output: 130 });    // 3 + 3 + 30 + 30
    expect(stats.power).toEqual({ used: 4, output: 41 });    // 1 + 1 + 1 + 1
    expect(stats.calibration).toEqual({ used: 300, output: 400 });
    const problems = validateFit(built.fit);
    // Nothing but skills: the fit is inside every resource, slot and hardpoint limit.
    expect(new Set(problems.map((p) => p.kind))).toEqual(new Set(["skill"]));
    expect(problems.map((p) => p.skill!.skillTypeId)).toEqual([
      3300, 3302, 3312, 3327, 3329, 3392, 3394, 3426, 3435, 3436, 3449, 11084, 12486, 24241,
    ]);
    expect(problems.map((p) => p.skill!.required)).toEqual([
      2, 5, 3, 1, 1, 1, 4, 3, 1, 5, 2, 1, 1, 5,
    ]);
  });

  it("records a type this SDE build does not know", () => {
    const built = fitFromFitting(fitting(587, [[999999, 1, "LoSlot0"]]), [
      { idx: 0, typeId: 999999, quantity: 1, flag: "LoSlot0" },
    ], ctx);
    expect(built.unknown).toEqual([{ typeId: 999999, quantity: 1, flag: "LoSlot0", name: null }]);
    expect(built.fit.modules).toEqual([]);
  });

  it("throws when the fitting's hull is unknown", () => {
    expect(() => fitFromFitting(fitting(999999, []), [], ctx)).toThrow(UnknownTypeError);
  });

  it("handles a drone-only fitting", () => {
    const vexor = fitting(626, [[2456, 5, "DroneBay"]]);
    const built = fitFromFitting(vexor, vexor.items, ctx);
    expect(built.fit.modules).toEqual([]);
    expect(built.fit.drones.map((d) => d.typeId)).toEqual([2456]);
    expect(fitStats(built.fit).slots.high).toEqual({ used: 0, total: 4 });
  });
});
```

**Where the fourteen skill requirements come from** (no skills trained, rig exempt): the hull needs
Minmatar Frigate I → Spaceship Command I; each 125mm Gatling AutoCannon I needs Small Projectile Turret I
→ Gunnery I; the Hail S loaded in the first gun needs Small Autocannon Specialization I → Motion
Prediction III → Gunnery II and Small Projectile Turret V (which is why 3300 lands at 2 and 3302 at 5);
the warp scrambler needs Propulsion Jamming I → CPU Management III and Navigation II; Damage Control II
needs Hull Upgrades IV → Mechanics I; and the Hobgoblin II in the drone bay needs Light Drone Operation V
→ Drones I, plus Gallente Drone Specialization I → Drones V (which is why 3436 lands at 5).

- [ ] **Step 2: Run the test and watch it fail**

Run: `npx vitest run tests/dogma/build-fitting.test.ts`
Expected: FAIL — `fitFromFitting is not a function`.

- [ ] **Step 3: Add `fitFromFitting` to `src/lib/dogma/build.ts`**

Extend the imports at the top of the file:
```ts
import type { AssetRow } from "../db/character-assets.js";
import type { FittingItemRow, FittingRow } from "../db/character-fittings.js";
import type { DogmaData, TypeId } from "./data.js";
import {
  SLOT_KINDS, addModule, attachCharge, createFit, makeItem, makeSkill, slotOfType,
  type Fit, type Item, type SlotKind,
} from "./fit.js";
import { clearMemo } from "./calc.js";
```

Append this function to the file:
```ts
/**
 * A saved ESI fitting has no `is_singleton`, so the module in a slot is the entry whose *type* carries
 * that slot's marker effect; anything else sharing the flag is its charge.
 */
export function fitFromFitting(fitting: FittingRow, items: FittingItemRow[], ctx: FitContext): BuiltFit {
  const built = startFit(ctx, fitting.shipTypeId);
  const slotted = new Map<string, FitEntry[]>();

  for (const row of items) {
    const entry: FitEntry = { typeId: row.typeId, quantity: row.quantity, flag: row.flag, name: null };
    if (row.flag === INVALID_FLAG) { built.unfittable.push(entry); continue; }
    if (slotFromFlag(row.flag)) { pushInto(slotted, row.flag, entry); continue; }
    if (row.flag === DRONE_BAY_FLAG) { addDrone(built, ctx, entry); continue; }
    built.cargo.push(entry);
  }

  for (const flag of orderedFlags(slotted.keys())) {
    const group = slotted.get(flag) ?? [];
    const module = group.find((entry) => carriesSlotMarker(ctx.data, entry.typeId)) ?? group[0];
    const { slot, index } = slotFromFlag(flag)!;
    fitOneModule(built, ctx, module, slot, index, group.filter((entry) => entry !== module));
  }

  clearMemo(built.fit);
  return built;
}

function carriesSlotMarker(data: DogmaData, typeId: TypeId): boolean {
  const type = data.types.get(typeId);
  return type !== undefined && slotOfType(type) !== null;
}
```

- [ ] **Step 4: Write the public barrel**

Create `src/lib/dogma/index.ts`:
```ts
/**
 * The dogma engine's public surface. Phase 4b (pages) and phase 5 (the fitting designer) import from
 * here; `sde-loader.js` is imported directly by server code only, because it is the one module that
 * touches Postgres.
 */
export {
  ATTR, CATEGORY, EFFECT, Operator, State,
  type AttrId, type DogmaAttribute, type DogmaData, type DogmaDataJson, type DogmaEffect,
  type DogmaGroup, type DogmaType, type EffectId, type GroupId, type Modifier, type ModifierDomain, type ModifierFunc, type TypeId,
  deserialiseDogmaData, serialiseDogmaData,
} from "./data.js";
export { PENALTY_BASE, penalizeValues, round2 } from "./operators.js";
export {
  CHARACTER_TYPE_ID, HARDPOINTS, SLOT_KINDS, UnknownTypeError, addModule, attachCharge, createFit,
  effectiveState, fitItems, hardpointOf, makeItem, makeSkill, requiredSkills, slotOf,
  type Fit, type Hardpoint, type Item, type ItemDomain, type ItemKind, type SlotKind, type Slotted,
} from "./fit.js";
export {
  DogmaCycleError, UnknownAttributeError, clearMemo, explain, getAttr, type AppliedModifier,
} from "./calc.js";
export { fitStats, type FitStats, type ModuleStat, type ResourcePool, type SlotUsage } from "./stats.js";
export {
  itemLabel, missingSkills, validateFit, type MissingSkill, type Problem, type ProblemKind,
} from "./validate.js";
export {
  DRONE_BAY_FLAG, INVALID_FLAG, fitFromAssets, fitFromFitting, slotFromFlag,
  type BuiltFit, type FitContext, type FitEntry,
} from "./build.js";
```

- [ ] **Step 5: Run the tests and the type checker**

Run: `npx vitest run tests/dogma && npm run typecheck`
Expected: PASS across every dogma test file, typecheck clean.

- [ ] **Step 6: Commit**

```bash
git add src/lib/dogma/build.ts src/lib/dogma/index.ts tests/dogma/build-fitting.test.ts
git commit -m "feat(dogma): build a fit from a saved ESI fitting, plus the public barrel

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 15: The end-to-end Rifter fit and full verification

**Files:**
- Create: `tests/dogma/rifter-e2e.test.ts`

**Interfaces:**
- Consumes: Task 13 `fitFromAssets`; Task 9 `allSkills`; Task 10 `fitStats`; Task 12 `validateFit`.
- Produces: nothing — this task adds only the acceptance test for the whole engine.

**⚠ These totals are hand-derived, not verified against Pyfa.** Research §6.7/§8 is explicit: the
`162.5` / `51.25` output figures are independently verified against the EVE University wiki, and every
step of the arithmetic follows directly from the SDE modifiers quoted in Task 9, but **the 80.25 / 12.80
usage figures were never confirmed by running Pyfa or the game client**. Treat this test as pinning the
engine to the SDE's own semantics; if an operator later compares it in-game and it disagrees, the fixture
is what changes, and the divergence table in research §7 is where to look first.

Derivation, for the record:
```
CPU Management V         cpuOutputBonus2   424 = 5.0 × 5 = 25   → cpuOutput   130.0 × 1.25 = 162.5
Power Grid Management V  powerEngOutBonus  313 = 5.0 × 5 = 25   → powerOutput  41.0 × 1.25 =  51.25
Weapon Upgrades V        cpuNeedBonus      310 = −5.0 × 5 = −25 → turret cpu     9.0 × 0.75 =   6.75
Adv. Weapon Upgrades V   powerNeedBonus    323 = −2.0 × 5 = −10 → turret power   4.0 × 0.90 =   3.60
Damage Control II                                                cpu 30.0, power 1.0 (needs Hull Upgrades, untouched)
Gyrostabilizer II                                                cpu 30.0, power 1.0 (needs Weapon Upgrades, not Gunnery — untouched)

cpu   used = 3 × 6.75 + 30 + 30 = 80.25 of 162.5
power used = 3 × 3.60 +  1 +  1 = 12.80 of  51.25
```

- [ ] **Step 1: Write the test**

Create `tests/dogma/rifter-e2e.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { fitFromAssets, type FitContext } from "../../src/lib/dogma/build.js";
import { fitStats } from "../../src/lib/dogma/stats.js";
import { validateFit } from "../../src/lib/dogma/validate.js";
import { explain } from "../../src/lib/dogma/calc.js";
import { ATTR } from "../../src/lib/dogma/data.js";
import type { AssetRow } from "../../src/lib/db/character-assets.js";
import { fixtureData } from "./fixture.js";
import { allSkills } from "./build-fit.js";

const data = fixtureData("rifter");

const SHIP: AssetRow = {
  itemId: 1000, typeId: 587, quantity: 1, locationId: 60003760, locationType: "station",
  locationFlag: "Hangar", isSingleton: true, isBlueprintCopy: false, name: "Scout One",
};

/** Rifter + 3 × 200mm AutoCannon II + Damage Control II + Gyrostabilizer II. */
const CHILDREN: AssetRow[] = ([
  [1001, 2889, "HiSlot0"], [1002, 2889, "HiSlot1"], [1003, 2889, "HiSlot2"],
  [1004, 2048, "LoSlot0"], [1005, 519, "LoSlot1"],
] as [number, number, string][]).map(([itemId, typeId, locationFlag]): AssetRow => ({
  itemId, typeId, quantity: 1, locationId: 1000, locationType: "item",
  locationFlag, isSingleton: true, isBlueprintCopy: false, name: null,
}));

const atLevel = (level: number): FitContext => ({ data, skills: allSkills(data, level), implants: [] });

describe("Rifter with three autocannons, a damage control and a gyrostabilizer", () => {
  it("uses 80.25 tf of 162.5 and 12.80 MW of 51.25 at all skills V", () => {
    const stats = fitStats(fitFromAssets(SHIP, CHILDREN, atLevel(5)).fit);
    expect(stats.cpu).toEqual({ used: 80.25, output: 162.5 });
    expect(stats.power).toEqual({ used: 12.8, output: 51.25 });
  });

  it("charges each module the value the SDE modifiers derive", () => {
    const stats = fitStats(fitFromAssets(SHIP, CHILDREN, atLevel(5)).fit);
    expect(stats.modules.map((m) => [m.item.typeId, m.cpu, m.power])).toEqual([
      [2889, 6.75, 3.6], [2889, 6.75, 3.6], [2889, 6.75, 3.6], [2048, 30, 1], [519, 30, 1],
    ]);
    expect(stats.modules.every((m) => m.charged)).toBe(true);
  });

  it("fills the hull's slots and hardpoints exactly", () => {
    const stats = fitStats(fitFromAssets(SHIP, CHILDREN, atLevel(5)).fit);
    expect(stats.slots).toEqual({
      high: { used: 3, total: 3 }, mid: { used: 0, total: 3 }, low: { used: 2, total: 4 },
      rig: { used: 0, total: 3 }, subsystem: { used: 0, total: 0 },
    });
    expect(stats.hardpoints).toEqual({ turret: { used: 3, total: 3 }, launcher: { used: 0, total: 2 } });
    expect(stats.calibration).toEqual({ used: 0, output: 400 });
  });

  it("reports no problems at all skills V", () => {
    expect(validateFit(fitFromAssets(SHIP, CHILDREN, atLevel(5)).fit)).toEqual([]);
  });

  it("still fits with no skills at all, at the unmodified numbers", () => {
    const built = fitFromAssets(SHIP, CHILDREN, { data, skills: new Map(), implants: [] });
    const stats = fitStats(built.fit);
    expect(stats.cpu).toEqual({ used: 87, output: 130 });     // 3 × 9 + 30 + 30
    expect(stats.power).toEqual({ used: 14, output: 41 });    // 3 × 4 + 1 + 1
    expect(validateFit(built.fit).every((p) => p.kind === "skill")).toBe(true);
  });

  it("explains where the CPU output and the turret's CPU come from", () => {
    const built = fitFromAssets(SHIP, CHILDREN, atLevel(5));
    expect(explain(built.fit, built.fit.ship, ATTR.cpuOutput).map((a) => [a.carrierTypeId, a.effectId]))
      .toEqual([[3426, 397]]);
    expect(explain(built.fit, built.fit.ship, ATTR.powerOutput).map((a) => [a.carrierTypeId, a.effectId]))
      .toEqual([[3413, 490]]);
    expect(explain(built.fit, built.fit.modules[0].item, ATTR.cpu).map((a) => [a.carrierTypeId, a.effectId]))
      .toEqual([[3318, 581]]);
    expect(explain(built.fit, built.fit.modules[0].item, ATTR.power).map((a) => [a.carrierTypeId, a.effectId]))
      .toEqual([[11207, 1638]]);
  });
});
```

- [ ] **Step 2: Run it**

Run: `npx vitest run tests/dogma/rifter-e2e.test.ts`
Expected: PASS.

- [ ] **Step 3: Run the whole suite and the type checker**

```bash
cd /home/daniel/AI/Plasma/EVE
docker compose -f compose.dev.yml up -d
npm test
npm run typecheck
```
Expected: every test green (including the phase-2 SDE tests touched in Task 3) and no type errors.

- [ ] **Step 4: Check the engine really is isomorphic**

```bash
cd /home/daniel/AI/Plasma/EVE
grep -rn "from \"node:\|from \"pg\"\|lib/db/" src/lib/dogma/ | grep -v "sde-loader.ts"
```
Expected: exactly two lines, both `import type` lines in `build.ts` (`character-assets.js` and
`character-fittings.js`). Anything else is a violation of the isomorphism constraint — move it into
`sde-loader.ts` or convert it to a type-only import.

- [ ] **Step 5: Commit**

```bash
git add tests/dogma/rifter-e2e.test.ts
git commit -m "test(dogma): end-to-end Rifter fit against hand-derived CPU/PG totals

The 80.25 tf / 12.80 MW figures are derived from the SDE modifiers, not verified
against the game client (research §8).

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Interfaces for phase 4b

Everything below exists when this plan is finished. Phase 4b (`/ships`, the two fit-sheet routes, market
prices and deploy) consumes it and adds nothing to `src/lib/dogma/`.

### Loading the data — `src/lib/dogma/sde-loader.ts` (server only; the one module that touches Postgres)

```ts
function loadDogmaData(typeIds: TypeId[]): Promise<DogmaData>
function resetDogmaCache(): void        // tests only
```
`loadDogmaData` returns the requested types **plus the transitive closure of their `requiredSkillN`
attributes**, so the recursive missing-skill expansion always has what it needs. Attributes, effects and
groups are loaded once per process and shared between calls; types are memoised per id. Unknown ids are
skipped, not thrown on.

**What a page must pass in:** every hull, module, charge and drone type id it is about to model, **plus
every skill id in `ctx.skills` and every implant id in `ctx.implants`**. For `/ships` that is the distinct
`type_id` set over the character's `character_assets` rows inside the assembled ships, the
`character_fitting_items` rows, `character_fittings.ship_type_id`, `character_skills.skill_id` and
`character_implants.type_id`. One call per request is enough — the maps are process-wide.

### The public barrel — `src/lib/dogma/index.ts` (isomorphic; safe in a client component)

```ts
// ---- data ----------------------------------------------------------------
type AttrId = number; type TypeId = number; type EffectId = number; type GroupId = number;
enum Operator { PreAssign = 1, PreMul, PreDiv, ModAdd, ModSub, PostMul, PostMulImmune, PostDiv, PostPercent, PostAssign }
enum State { Offline = 1, Online, Active, Overload }
type ModifierFunc = "ItemModifier" | "LocationModifier" | "LocationGroupModifier"
                  | "LocationRequiredSkillModifier" | "OwnerRequiredSkillModifier";
type ModifierDomain = "self" | "character" | "ship" | "other";
interface Modifier { func: ModifierFunc; domain: ModifierDomain; modifiedAttrId: AttrId; modifyingAttrId: AttrId; operation: Operator; groupId?: GroupId; skillTypeId?: TypeId }
interface DogmaAttribute { id: AttrId; name: string | null; defaultValue: number; stackable: boolean; highIsGood: boolean; maxAttributeId?: AttrId; minAttributeId?: AttrId }
interface DogmaEffect { id: EffectId; categoryId: number; state: State; modifiers: Modifier[]; fittingUsageChanceAttrId?: AttrId }
interface DogmaType { id: TypeId; groupId: GroupId; categoryId: number; name: string | null; attrs: Map<AttrId, number>; effects: Map<EffectId, boolean> }
interface DogmaGroup { id: GroupId; name: string | null; categoryId: number }
interface DogmaData { attributes: Map<AttrId, DogmaAttribute>; effects: Map<EffectId, DogmaEffect>; types: Map<TypeId, DogmaType>; groups: Map<GroupId, DogmaGroup> }
const ATTR: { capacitorNeed: 6; mass: 4; powerOutput: 11; lowSlots: 12; medSlots: 13; hiSlots: 14;
              power: 30; capacity: 38; cpuOutput: 48; cpu: 50; launcherSlots: 101; turretSlots: 102;
              volume: 161; radius: 162; skillLevel: 280; upgradeCapacity: 1132; rigSlots: 1137;
              drawback: 1138; upgradeCost: 1153; maxSubSystems: 1367; turretHardPointModifier: 1368;
              launcherHardPointModifier: 1369; hiSlotModifier: 1374; medSlotModifier: 1375;
              lowSlotModifier: 1376; fitsToShipType: 1380; maxGroupFitted: 1544; rigSize: 1547 };
const EFFECT: { loPower: 11; hiPower: 12; medPower: 13; online: 16; launcherFitted: 40; turretFitted: 42;
                rigSlot: 2663; subSystem: 3772; hardPointModifier: 3773; slotModifier: 3774 };
const CATEGORY: { ship: 6; module: 7; charge: 8; skill: 16; drone: 18; implant: 20; subsystem: 32; fighter: 87 };
function serialiseDogmaData(data: DogmaData): DogmaDataJson
function deserialiseDogmaData(json: DogmaDataJson): DogmaData      // phase 5: ship a snapshot to the browser

// ---- maths ---------------------------------------------------------------
const PENALTY_BASE: number
function penalizeValues(modValues: number[]): number
function round2(v: number): number

// ---- model ---------------------------------------------------------------
type SlotKind = "high" | "mid" | "low" | "rig" | "subsystem";
type Hardpoint = "turret" | "launcher";
type ItemDomain = "ship" | "character" | null;
type ItemKind = "ship" | "character" | "module" | "rig" | "subsystem" | "charge" | "implant" | "skill" | "drone";
const SLOT_KINDS: readonly SlotKind[]            // ["high","mid","low","rig","subsystem"] — column order
const HARDPOINTS: readonly Hardpoint[]           // ["turret","launcher"]
const CHARACTER_TYPE_ID: number                  // 0
class UnknownTypeError extends Error { readonly typeId: TypeId }
interface Item {
  kind: ItemKind; typeId: TypeId; categoryId: number; groupId: GroupId; name: string | null;
  state: State; attrs: Map<AttrId, number>; effects: Map<EffectId, boolean>;
  charge?: Item; container?: Item; domain: ItemDomain; ownerModifiable: boolean;
}
interface Slotted { item: Item; slot: SlotKind; index: number }
interface Fit { data: DogmaData; ship: Item; character: Item; skills: Map<TypeId, Item>; implants: Item[]; modules: Slotted[]; drones: Item[] }
function createFit(data: DogmaData, ship: Item): Fit
function makeItem(data: DogmaData, typeId: TypeId, over?: { kind?: ItemKind; state?: State }): Item
function makeSkill(data: DogmaData, typeId: TypeId, level: number): Item
function addModule(fit: Fit, item: Item, slot: SlotKind, index: number): Slotted
function attachCharge(module: Item, charge: Item): void
function slotOf(item: Item): SlotKind | null
function hardpointOf(item: Item): Hardpoint | null
function effectiveState(item: Item): State
function requiredSkills(item: Item): { skillTypeId: TypeId; level: number }[]
function fitItems(fit: Fit): Item[]

// ---- calculator ----------------------------------------------------------
class UnknownAttributeError extends Error { readonly attrId: AttrId }
class DogmaCycleError extends Error { readonly attrId: AttrId }
interface AppliedModifier {
  carrier: Item; carrierTypeId: TypeId; carrierName: string | null; effectId: EffectId;
  operator: Operator; modifyingAttrId: AttrId; rawValue: number; value: number; penalised: boolean;
}
function getAttr(fit: Fit, item: Item, attrId: AttrId): number
function explain(fit: Fit, item: Item, attrId: AttrId): AppliedModifier[]     // the "affected by" popover
function clearMemo(fit: Fit): void                                            // after ANY mutation of the fit

// ---- statistics ----------------------------------------------------------
interface ResourcePool { used: number; output: number }
interface SlotUsage { used: number; total: number }
interface ModuleStat { item: Item; slot: SlotKind; index: number; cpu: number; power: number; calibration: number; state: State; charged: boolean }
interface FitStats {
  cpu: ResourcePool; power: ResourcePool; calibration: ResourcePool;
  slots: Record<SlotKind, SlotUsage>; hardpoints: Record<Hardpoint, SlotUsage>; modules: ModuleStat[];
}
function fitStats(fit: Fit): FitStats

// ---- validation ----------------------------------------------------------
type ProblemKind = "cpu" | "power" | "calibration" | "slot" | "hardpoint"
                 | "rigSize" | "shipRestriction" | "maxGroupFitted" | "skill";
interface MissingSkill { skillTypeId: TypeId; required: number; have: number }
interface Problem { kind: ProblemKind; item?: Item; detail: string; skill?: MissingSkill }
function validateFit(fit: Fit): Problem[]            // NB: one argument — Fit already carries `data`
function missingSkills(fit: Fit): MissingSkill[]     // deduplicated, ascending by skillTypeId
function itemLabel(item: Item): string               // `item.name ?? \`type ${item.typeId}\``

// ---- builders ------------------------------------------------------------
interface FitContext { data: DogmaData; skills: Map<TypeId, number>; implants: TypeId[] }
interface FitEntry { typeId: TypeId; quantity: number; flag: string; name: string | null }
interface BuiltFit { fit: Fit; cargo: FitEntry[]; drones: FitEntry[]; unfittable: FitEntry[]; unknown: FitEntry[] }
const DRONE_BAY_FLAG: string                         // "DroneBay"
const INVALID_FLAG: string                           // "Invalid"
function slotFromFlag(flag: string): { slot: SlotKind; index: number } | null
function fitFromAssets(shipAsset: AssetRow, childAssets: AssetRow[], ctx: FitContext): BuiltFit
function fitFromFitting(fitting: FittingRow, items: FittingItemRow[], ctx: FitContext): BuiltFit
```

`AssetRow`, `FittingRow` and `FittingItemRow` are the existing phase-3 row types from
`src/lib/db/character-assets.ts` and `src/lib/db/character-fittings.ts`; the builders take them
structurally, so a page passes `listAssets()` / `listFittings()` output straight through.

### How phase 4b is expected to use this

```ts
const ctx: FitContext = {
  data: await loadDogmaData(typeIds),
  skills: new Map((await listSkills(characterId)).map((s) => [s.skillId, s.trainedLevel])),
  implants: await listImplants(characterId),
};
const built = fitFromAssets(shipAsset, assetsInShip, ctx);
const stats = fitStats(built.fit);
const problems = validateFit(built.fit);
const why = explain(built.fit, built.fit.modules[0].item, ATTR.cpu);
```
- Wrap each fit in a `try`/`catch`: `UnknownTypeError` (unknown hull) and `DogmaCycleError` are the two
  the engine can throw, and spec §6 says the card shows "Could not compute" and the error is logged.
- `built.unknown` is the "Unknown type (id)" list; `built.unfittable` is the fitting's `Invalid` items;
  `built.cargo` and `built.drones` are the "Cargo & drones" lists, with quantities.
- Missing skills come from `problems.filter(p => p.kind === "skill").map(p => p.skill!)` (or
  `missingSkills(fit)` directly); resolve their names with `data.types.get(id)?.name`.
- With phase 3 unsynced, pass `skills: new Map()` — every skill reads as level 0 and the page says so.
- The gauges are `stats.cpu.used / stats.cpu.output` etc.; the `.over` class is exactly
  `used > output`, the same test `validateFit` makes.

### Not built here (phase 4b owns them)

`src/lib/market/**` and the `market_prices` table (spec §3, §5), the `/ships` list page and the two fit
sheet routes (spec §4), the ship-render/icon URLs, the value roll-up, the gauge components and the VM
acceptance run (spec §7's market, component and acceptance bullets).

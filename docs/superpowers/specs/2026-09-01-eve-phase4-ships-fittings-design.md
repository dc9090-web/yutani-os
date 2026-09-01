# EVE Phase 4 — Ships & Fittings Viewer (Dogma engine, market prices)

**Date:** 2026-09-01
**Status:** Approved by delegation (project overview §2; rulings recorded inline)
**Depends on:** Phase 2 (`sde_*`), Phase 3 (`character_assets`, `character_fittings*`, `character_skills`, `character_implants`)
**Research:** `docs/research/dogma-engine.md` (EOS/Pyfa/EVEShipFit comparison; verified IDs, formulas, fixtures)

## 1. Goal

`/ships` shows the active character's **actual fitted ships** (assembled ships in assets, with the modules,
rigs, subsystems and charges physically fitted to them) and their **saved fits** (ESI fittings). A fit sheet
shows every module with its **CPU/PG cost after skills, implants and fitting modules are applied**, the ship's
totals versus output, calibration, slot and hardpoint usage, **missing skills** (with prerequisites), and an
**estimated Jita value**. The maths is a pure TypeScript dogma engine (`src/lib/dogma`) that later phases
extend to DPS/tank without rewriting.

## 2. Dogma engine (`src/lib/dogma/`, pure, no I/O)

Modelled on EOS: a data-driven interpreter of the SDE's `modifierInfo`.

### 2.1 Data (`src/lib/dogma/data.ts`)

```
DogmaData = {
  attributes: Map<attrId, { id, name, defaultValue, stackable, highIsGood, maxAttributeId?, minAttributeId? }>,
  effects:    Map<effectId, { id, categoryId, state, modifiers: Modifier[], fittingUsageChanceAttrId? }>,
  types:      Map<typeId, { id, groupId, categoryId, name, attrs: Map<attrId, number>, effects: Map<effectId, boolean /*isDefault*/> }>,
  groups:     Map<groupId, { id, name, categoryId }>
}
Modifier = { func: 'ItemModifier'|'LocationModifier'|'LocationGroupModifier'|'LocationRequiredSkillModifier'|'OwnerRequiredSkillModifier',
             domain: 'self'|'character'|'ship'|'other', modifiedAttrId, modifyingAttrId, operation: Operator, groupId?, skillTypeId? }
Operator = PreAssign=1, PreMul, PreDiv, ModAdd, ModSub, PostMul, PostDiv, PostPercent, PostAssign   (ascending = precedence)
State    = Offline=1, Online, Active, Overload
```

- `src/lib/dogma/sde-loader.ts` builds `DogmaData` from `sde_dogma_attributes`, `sde_dogma_effects` +
  `sde_dogma_effect_modifiers`, `sde_groups`, and `sde_types` + `sde_type_attributes` + `sde_type_effects`
  for a requested set of type IDs (`loadDogmaData(typeIds)`); attributes/effects/groups are loaded once per
  process and memoised (they are ~10k rows); types are memoised per id. Injects `mass` (4), `capacity` (38),
  `volume` (161), `radius` (162) from `sde_types` columns into `attrs`.
- Build-time filtering: effects with category 3 or 6, modifiers with `domain` `targetID`/`target`/`structureID`,
  and `EffectStopper` rows are dropped; `operation 9` (effect 132) is dropped. SDE operation ints map
  `-1→PreAssign, 0→PreMul, 1→PreDiv, 2→ModAdd, 3→ModSub, 4→PostMul, 5→PostDiv, 6→PostPercent, 7→PostAssign`.
- Effect category → required state: 0,7 → Offline; 4 → Online; 1,2 → Active; 5 → Overload.
- Hand-coded effects (no `modifierInfo` in the SDE): **3774** `slotModifier` = ModAdd of 1374→14, 1375→13,
  1376→12 on the ship; **3773** `hardPointModifierEffect` = ModAdd of 1368→102, 1369→101 on the ship.

### 2.2 Model (`src/lib/dogma/fit.ts`)

`Item = { typeId, categoryId, groupId, state, attrs, effects, charge?: Item, domain: 'ship'|'character'|null, ownerModifiable }`
with the EOS domain table: Ship/Character → `null`; Module/Rig/Subsystem → `'ship'`; Charge → `'ship'`,
ownerModifiable; Implant/Skill → `'character'`; Drone → `null`, ownerModifiable.

`Fit = { ship: Item, character: Item, skills: Map<typeId, Item>, implants: Item[], modules: Slotted[], drones: Item[] }`,
`Slotted = { item: Item, slot: 'high'|'mid'|'low'|'rig'|'subsystem', index: number }`. Slot from marker effects
(11 low, 12 high, 13 mid, 2663 rig, 3772 subsystem; rig wins); hardpoint from 42 turret / 40 launcher.
Skills are Items whose attribute 280 (`skillLevel`) is seeded with the trained level; every skill the
character has is included (the SDE's two-effect pattern scales bonuses through 280 with no special casing).
Module state defaults to Active when the type has an active-category effect (or `capacitorNeed` 6), else Online.

### 2.3 Calculator (`src/lib/dogma/calc.ts`)

`getAttr(fit, item, attrId): number`, memoised per `(item, attrId)` with a cycle sentinel; memo cleared on any
fit mutation. Exact order (EOS `MutableAttrMap.__calculate`):
1. seed = `item.attrs[attrId] ?? attribute.defaultValue` (throw if neither);
2. gather modifiers whose effect is running on their carrier (state gate + full-compliance rules: offline-state
   effects with `fittingUsageChanceAttrId` are suppressed; online-category effects need the carrier's `online`
   effect 16 running; active-category effects run only if `isDefault`) and whose affectee filter reaches
   `item` (domain buckets per the table; `LocationGroupModifier` by `groupId`; `*RequiredSkillModifier` by the
   affectee's `requiredSkillN` attributes 182,183,184,1285,1289,1290);
3. normalise each by operator (`PreMul/PostMul: v-1`, `PreDiv/PostDiv: 1/v-1` (guard 0), `ModAdd: v`,
   `ModSub: -v`, `PostPercent: v/100`, assigns: `v`), where `v = getAttr(fit, carrier, modifyingAttrId)`;
4. penalise iff `!attribute.stackable && carrier.categoryId ∉ {6,8,16,20,32} && op ∈ {PreMul,PreDiv,PostMul,PostDiv,PostPercent}`;
   collapse each penalised bucket with `penalize(values)`: split by sign, sort strongest first, `Π (1 + v·e^{-(i/2.67)²})`
   over `i ≤ 10`, minus 1;
5. apply in operator order: assigns replace with `max` (highIsGood) / `min`; adds sum; multiplies `acc *= 1+n`;
6. cap to `maxAttributeId`'s value on the same item when defined;
7. round to 2 dp iff `attrId ∈ {50, 30, 48, 11}`.
Also exposes `explain(fit, item, attrId)` → the list of applied modifiers (carrier type, operator, value,
penalised) for an "affected by" panel.

### 2.4 Stats and validation (`src/lib/dogma/stats.ts`, `validate.ts`)

`fitStats(fit)` →
```
{ cpu: { used, output }, power: { used, output }, calibration: { used, output },
  slots: { high|mid|low|rig|subsystem: { used, total } }, hardpoints: { turret|launcher: { used, total } },
  modules: [{ item, slot, index, cpu, power, calibration, state }] }
```
- CPU/PG used = Σ over modules with `state ≥ Online` **and** an `online` effect (16) on the type (EOS rule;
  Ruling — a module without effect 16 costs nothing); calibration = Σ `upgradeCost` (1153) over rigs in any state.
- Outputs from the ship's modified `cpuOutput` 48, `powerOutput` 11, `upgradeCapacity` 1132; slots from
  14/13/12/1137/1367 (a `maxSubSystems` of 5 is shown as 4); hardpoints from 102/101 (totals despite the names);
  hardpoints count fitted turrets/launchers regardless of state.

`validateFit(fit, data)` → `Problem[]` with `{ kind, item?, detail }` for: `cpu`, `power`, `calibration`
(`used > output`, no epsilon — the 2-dp rounding is the tolerance), `slot` (per slot kind), `hardpoint`,
`rigSize` (raw 1547 must equal the ship's when both present), `shipRestriction` (union of `canFitShipType*`
1302,1303,1304,1305,1944,2103,2463,2486,2487,2488,2758,5948 + `fitsToShipType` 1380 and `canFitShipGroup*`
1298–1301,1872,1879–1881,2065,2396,2476–2485 — if non-empty the hull's type or group must match; rigs and
subsystems exempt), `maxGroupFitted` (raw 1544 vs count of same-group modules; Ruling — Pyfa's raw-value
reading), `skill` (`{ skillTypeId, required, have }` for ship, modules, charges and drones — rigs exempt — with
each missing skill's own prerequisites expanded recursively, deduplicated).

### 2.5 Fit builders (`src/lib/dogma/build.ts`)

- `fitFromAssets(shipAsset, childAssets, ctx)` — the assembled ship (category 6, `is_singleton`) plus the
  assets whose `location_id = ship.item_id`: singleton items with slot flags are modules (`HiSlot0..7` → high 0..7,
  `MedSlot`, `LoSlot`, `RigSlot`, `SubSystemSlot`); non-singleton items sharing a module's flag are that
  module's charge; `DroneBay` items are drones; everything else (`Cargo`, holds) is listed as cargo, not fitted.
- `fitFromFitting(fitting, items, ctx)` — same from `character_fittings*` (`flag` may be `Invalid` → listed
  under "unfittable", not modelled).
- `ctx = { data: DogmaData, skills: Map<typeId, level>, implants: typeId[] }` from phase-3 tables.
Both return `{ fit, cargo: [...], unfittable: [...] }`.

## 3. Market prices (`src/lib/market/`) — cross-cutting service

Ruling: two sources, one table. `market_prices (type_id int PK, adjusted_price numeric, average_price numeric,
jita_sell_min numeric, jita_buy_max numeric, updated_at)`.
- Global job `market-prices`, every 1 h: (a) `GET /markets/prices` (public, 1 h cache, one request) upserts
  `adjusted_price`/`average_price` for all types; (b) for the **types of interest** — distinct `type_id`s across
  `character_assets`, `character_fitting_items`, `character_fittings.ship_type_id`, `character_wallet_transactions`
  (last 30 days) — fetch `https://market.fuzzwork.co.uk/aggregates/?region=10000002&types=<ids>` in chunks of
  500 with `User-Agent: <ESI_USER_AGENT>`, parse the string-valued `sell.min` / `buy.max` (empty types return
  `"0"` → NULL), upsert `jita_sell_min` / `jita_buy_max`. Fuzzwork failure leaves ESI prices in place and records
  the run as `ok` with a warning in the error column prefixed `warn:`.
- `getPrices(typeIds): Promise<Map<typeId, { sell: number|null; buy: number|null; adjusted: number|null }>>`
  and `priceOf(p) = sell ?? adjusted ?? null` for display.
Cost if wrong: Fuzzwork is third-party; prices degrade to ESI adjusted prices, never to nothing.

## 4. UI

- **`/ships`** — active character. **Fitted ships**: one card per assembled ship in assets (custom name,
  type, location label, CPU/PG mini-gauges, missing-skill count, value), sorted by value desc. **Saved fits**:
  one card per ESI fitting (name, ship type, same gauges/value). Empty states when nothing synced.
- **`/ships/asset/[itemId]`** and **`/ships/fit/[fittingId]`** — the fit sheet (server component; engine runs
  per request): header (ship render `https://images.evetech.net/types/{id}/render?size=128`, name, type, ship
  bonuses from `sde_type_bonuses` with the character's level of each bonus skill shown), slot columns
  (high/mid/low/rig/subsystem) each row: type icon, module name, charge, **CPU tf / PG MW** (modified, 2 dp),
  state; totals panel with three gauges (CPU, PG, calibration — `.gauge` filled by percentage, `.over` class
  above 100 %) and slot/hardpoint counters; **Problems** list from `validateFit`; **Missing skills** tree
  (skill, have → need); **Cargo & drones** lists; **Estimated value** (ship + fitted + cargo + drones at Jita sell,
  with "n items unpriced"). "Affected by" popover per module CPU/PG cell from `explain`.
- Nav item `Ships` already exists; `Fitting` stays "coming soon" until phase 5.

## 5. Data / schema changes

`market_prices` (above). No changes to phase-3 tables.

## 6. Error handling

- Unknown type IDs (SDE older than the character's items) → the item is listed with `Unknown type (id)` and
  excluded from the calculation; the sheet still renders.
- Engine exceptions are caught per fit on `/ships`; that card shows "Could not compute" and the error is logged.
- Missing skills data (phase 3 not synced yet) → engine runs with all skills at 0 and the page says so.

## 7. Testing

- **Engine unit tests (no DB):** `tests/fixtures/dogma/*.json` snapshots of `DogmaData` produced by
  `scripts/dogma-fixture.ts <typeIds…>` from the imported SDE and committed. Required assertions (research
  §3.6, §4.2, §6.7): stacking `penalize` — base 100 with postPercent +20,+50,−90,−25,+400 → 67.5 unpenalised
  and 62.549783181488586 penalised; two +10 % → 119.56031978880436; penalty-immune categories (+50 %, +100 %
  from ship/charge/skill/implant/subsystem carriers) → 300. Rifter bare hull: CPU output 130 / PG 41 at skills 0
  and **162.5 / 51.25** with CPU Management V and Power Grid Management V. Weapon Upgrades V → −25 % CPU on a
  turret; Advanced Weapon Upgrades V → −10 % PG. Subsystem hand-coded slot/hardpoint adds. State gating
  (offline module costs nothing; rig calibration counts offline). Every validation kind with a positive and a
  negative case. `explain` lists the CPU Management modifier on `cpuOutput`.
- **Builders:** `fitFromAssets` (charges under modules, drone bay, cargo, unknown flags) and `fitFromFitting`
  (`Invalid` flag) on hand-written rows.
- **Market:** job with mocked fetch (ESI prices + Fuzzwork chunking, string parsing, `"0"` → NULL, Fuzzwork
  failure → warn); repo upsert on real Postgres.
- **Component:** ship card gauges, fit sheet problems/missing-skills rendering.
- **Acceptance on the VM:** `/ships` lists the character's docked ship; its sheet's CPU/PG totals and outputs
  match the in-game fitting window for that ship (the operator compares); a saved fit renders; values populate
  after the first `market-prices` run.

## 8. Out of scope

Editing fits (phase 5), DPS/tank/capacitor (phase 5+), drones' contribution, projected effects, structures,
attribute capping beyond `maxAttributeId`, abyssal (mutated) modules (`dogma/dynamic` — shown as their base type).

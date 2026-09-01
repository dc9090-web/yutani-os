# EVE Phase 5 — Fitting Designer

**Date:** 2026-09-01
**Status:** Approved by delegation (project overview §2; rulings recorded inline)
**Depends on:** Phase 4 (`src/lib/dogma` engine, `market_prices`, fit sheet components), Phase 2 (`sde_*` lookups)

## 1. Goal

`/fitting` is a fit editor: pick a hull, add/remove/replace modules, rigs, subsystems, charges and drones, and
see **CPU / PG / calibration / slot / hardpoint validation, missing skills and Jita price update live** as you
edit — computed in the browser by the same pure engine phase 4 built. Fits are saved locally (our own table),
can be cloned from an ESI saved fitting or an assembled ship, and imported/exported as EFT text.

## 2. Data model

```
fits        id serial PK, name text NOT NULL, ship_type_id int NOT NULL, description text NOT NULL DEFAULT '',
            character_id bigint REFERENCES characters(id) ON DELETE SET NULL,   -- whose skills the sheet uses
            created_at, updated_at
fit_items   (fit_id int REFERENCES fits ON DELETE CASCADE, idx int) PK, type_id int NOT NULL, quantity int NOT NULL DEFAULT 1,
            flag text NOT NULL,            -- ESI fitting flag vocabulary: HiSlot0..7, MedSlot0..7, LoSlot0..7, RigSlot0..2,
                                           --   SubSystemSlot0..3, DroneBay, Cargo
            charge_type_id int,            -- loaded charge for slot items
            state text NOT NULL DEFAULT 'active' CHECK (state IN ('offline','online','active','overload'))
```

Ruling: fits are **not** pushed to ESI (`esi-fittings.write_fittings.v1` is not requested); export is by text.
Cost if wrong: one more scope and a POST route later.

## 3. Engine in the browser

- `src/lib/dogma/**` stays isomorphic (no Node imports). The client fetches:
  - `GET /api/dogma/meta` → `{ build, attributes, effects, groups }` (the attribute/effect/group parts of
    `DogmaData`, JSON, `Cache-Control: public, max-age=86400`, `ETag` = SDE build number).
  - `GET /api/dogma/types?ids=1,2,3` → the `types` entries (`attrs`, `effects`, `groupId`, `categoryId`,
    `name`) for up to 200 ids; the editor requests only what the fit and the character's skills reference,
    and memoises per id in a module-level `Map`.
  - `GET /api/characters/[id]/skills` → `{ skills: [{ skillId, level }], implants: [typeId] }` (from phase 3
    tables) for the fit's character; an **"All skills V"** option needs no fetch (every category-16 type at 5 —
    the ids come from `GET /api/sde/types?category=16`, cached).
- `src/lib/dogma/serialize.ts` — `DogmaData` ⇄ JSON (Maps ⇄ arrays), shared by the API routes and the client.
- The editor keeps a `FitDoc` in React state (`{ shipTypeId, items: FitItem[], characterId | 'all-v' }`) and derives
  `Fit` → `fitStats` → `validateFit` on every change (synchronous; a fit is microseconds).

## 4. UI

- **`/fitting`** — list of saved fits (name, ship, character, updated, value) with **New fit** (hull picker:
  type search restricted to category 6, grouped by `sde_groups`), **Import EFT** (textarea → parse → new fit),
  and per fit: open, clone, delete. Also **From saved fittings** and **From my ships** pickers that clone an ESI
  fitting or an assembled ship (phase 4 builders) into a local fit.
- **`/fitting/[id]`** — the editor (client component `FitEditor`):
  - Left: **slot layout** — high/mid/low/rig/subsystem rows sized by the hull's slot counts (extra fitted
    modules beyond the count are shown with an `.over` marker); each row: icon, name, charge selector, CPU/PG,
    state toggle (offline/online/active/overload where the type allows), remove. Below: drone bay (type,
    quantity) and cargo (type, quantity).
  - Right: **browser** — search box (`GET /api/sde/types?q=&limit=50`, published, categories 7 modules / 8 charges /
    18 drones / 32 subsystems) and a market-group tree (`GET /api/sde/market-groups` → parents/children;
    `GET /api/sde/types?marketGroup=`), each result: icon, name, meta group badge, CPU/PG (base), price; **Fit**
    button adds to the first free matching slot (or replaces the selected slot); "Fits this hull" filter uses
    the phase-4 ship-restriction check; charges list for the selected module filtered by `chargeGroup*`
    (604, 605, 606, 609, 610) and `chargeSize` (128) ≤ the module's.
  - Bottom/side: **stats panel** (three gauges, slots, hardpoints), **Problems**, **Missing skills** (per the
    character or "All V"), **Price** (per item and total from `GET /api/market/prices?ids=`), **Ship bonuses**.
  - Toolbar: name (inline edit), character selector (skills), Save (`PUT /api/fits/[id]`, also autosaves 2 s
    after the last change with a "saved" indicator), **Export EFT** (modal with copy button), Clone, Delete.
- Nav item `Fitting` becomes live.

## 5. EFT format (`src/lib/fits/eft.ts`, pure)

Export:
```
[Rifter, Cheap Rifter]
Damage Control II
Gyrostabilizer II

1MN Afterburner II
Warp Scrambler II
Small Shield Extender II

200mm AutoCannon II, Republic Fleet EMP S
200mm AutoCannon II, Republic Fleet EMP S
200mm AutoCannon II, Republic Fleet EMP S
[Empty High slot]

Small Projectile Burst Aerator I
Small Core Defense Field Extender I
Small Core Defense Field Extender I


Warrior II x2

Republic Fleet EMP S x600
```
Sections in order low, mid, high, rig, (subsystem), drones, cargo, separated by blank lines; `[Empty X slot]`
for gaps; charges as `, <charge name>`; `x N` quantities for drones/cargo; module state suffix `/offline`
is accepted on import and written for offline modules. Import resolves names via `sde_types` (exact,
case-insensitive; unknown lines are reported, not fatal), assigns slots by the module's marker effect in the
order listed, and puts unrecognised-slot items into cargo. Round-trip test: export(import(text)) ≡ text for the
fixture above.

## 6. API routes

```
GET    /api/fits                      list
POST   /api/fits                      { name, shipTypeId, characterId?, items? }  → fit
GET    /api/fits/[id]                 fit + items
PUT    /api/fits/[id]                 { name?, description?, characterId?, items }  (items replaced wholesale)
DELETE /api/fits/[id]
POST   /api/fits/import               { text }  → new fit (EFT)
POST   /api/fits/from-fitting         { characterId, fittingId }
POST   /api/fits/from-asset           { characterId, itemId }
GET    /api/dogma/meta, /api/dogma/types?ids=, /api/sde/types?q=&category=&marketGroup=&limit=,
       /api/sde/market-groups, /api/market/prices?ids=, /api/characters/[id]/skills
```
`GET /api/market/prices?ids=` serves `market_prices`; ids with no row (or older than 24 h) are fetched from
Fuzzwork synchronously (chunks ≤ 500) and upserted before responding, so the designer never waits an hour.
All routes session-guarded by `proxy.ts`; 400 on malformed bodies; 404 on unknown ids.

## 7. Error handling

Unknown type ids in a saved fit → shown as `Unknown type (id)` and excluded from stats; import reports
unresolved lines under the textarea; API failures show a toast and keep the local state (retry on next change).

## 8. Testing

- **Unit:** EFT parse/serialise (fixture round-trip, `[Empty … slot]`, `x N`, `/offline`, unknown names);
  slot assignment ("first free matching slot", replace, over-count); charge compatibility filter; `serialize.ts`
  round-trip; `FitDoc` → `Fit` derivation.
- **DB:** fits/fit_items repo (create, replace items, cascade delete).
- **API:** route handlers with mocked repos (validation, 404s).
- **Component (happy-dom):** `FitEditor` with a fixture `DogmaData` — adding a module updates the CPU gauge and
  problems; toggling offline removes its CPU; missing-skill list changes with "All V".
- **Acceptance on the VM:** create a Rifter fit from the EFT fixture, see CPU/PG match phase 4's sheet for the
  same modules, save, reload, export, clone from an assembled ship.

## 9. Out of scope

DPS/tank/cap simulation, projected effects, fleet boosts, abyssal modules, pushing fits to ESI, sharing/exporting
to other formats than EFT, fit comparison.

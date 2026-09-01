# EVE Phase 2 — Static Data Export (SDE) Import

**Date:** 2026-09-01
**Status:** Approved by delegation (see project overview §2; rulings recorded inline)
**Depends on:** Phase 1 (Foundation) — `docs/superpowers/specs/2026-09-01-eve-foundation-design.md`

## 1. Goal

Every item, group, category, dogma attribute/effect (with modifier info), market group, ship trait,
and the region/constellation/solar-system/NPC-station map that later phases need is imported from
CCP's official SDE into `sde_*` tables we own, kept current automatically, and readable through a
small typed lookup library. Phases 3–7 never parse SDE files; they query these tables.

## 2. Source format (verified against build 3484357, 2026-08-28)

Research: `docs/research/sde-format.md`.

- **Version pointer:** `GET https://developers.eveonline.com/static-data/tranquility/latest.jsonl`
  → one line `{"_key":"sde","buildNumber":3484357,"releaseDate":"2026-08-28T11:07:12Z"}`. Supports
  `ETag`/`If-None-Match`; cached 5 min server-side.
- **Archive:** `GET https://developers.eveonline.com/static-data/eve-online-static-data-latest-jsonl.zip`
  (302 → `…/tranquility/eve-online-static-data-<build>-jsonl.zip`), ~95 MiB zip, ~552 MiB across
  102 flat `*.jsonl` members. No per-file download. No checksum file.
- **Records:** one JSON object per LF-terminated line; every record has `_key` (integer in every
  file we import); optional fields are **omitted, not null**; localised strings are
  `{de,en,es,fr,ja,ko,ru,zh}` objects; integer-keyed maps are `[{_key,_value}]` lists.
- **Files we import** (member → table): `_sde`, `categories`, `groups`, `types`, `marketGroups`,
  `metaGroups`, `dogmaUnits`, `dogmaAttributeCategories`, `dogmaAttributes`, `dogmaEffects`,
  `typeDogma`, `typeBonus`, `mapRegions`, `mapConstellations`, `mapSolarSystems`, `npcStations`.
- **Gotchas the importer must handle:** `dogmaAttributes.description` is a plain string while
  `dogmaEffects.description` is localised; `typeDogma.dogmaAttributes[].value` is always a JSON
  float; `types` (153 MB) and `typeDogma` (28 MB) must be streamed, never buffered; `npcStations`
  carry no names (station names are resolved from ESI in phase 3 — Ruling); `dogmaEffects.modifierInfo`
  entries are either `{domain, func, modifiedAttributeID, modifyingAttributeID, operation[, skillTypeID|groupID]}`
  or `{domain, func:"EffectStopper", effectID}`.

Ruling: **English only.** Every localised field is stored as its `en` value. Single user, English UI.
Cost if wrong: re-import with extra columns.

Ruling: **Skipped files:** icons/graphics (we use `images.evetech.net/types/{id}/icon`), blueprints,
typeMaterials, masteries, certificates, skillPlans, planets/moons/stargates, everything else. Not on
the roadmap. Cost if wrong: add a table definition and re-import.

## 3. Data model

Ruling: the `sde_*` DDL has **one source**, `src/lib/sde/ddl.ts`, exporting `sdeDdl(schema: string): string[]`
(idempotent `CREATE TABLE IF NOT EXISTS` / `CREATE INDEX IF NOT EXISTS` statements qualified with the given
schema, `sde_meta` only for `public`). `scripts/migrate.ts` applies `db/schema.sql` and then `sdeDdl("public")`;
`db/schema.sql` itself contains no `sde_` tables. The importer uses `sdeDdl("sde_import")` for staging, so
the live and staging shapes cannot drift. Cost if wrong: none — it is a code-organisation choice.

All tables live in `public` with an `sde_` prefix. No foreign keys **from** character/sync tables
**to** `sde_*` tables, and none between `sde_*` tables (Ruling — reference data is swapped wholesale
on import; joins are done at read time; the SDE is internally consistent). Column names are
snake_case of the SDE field names.

```
sde_meta                       id int PK CHECK (id = 1), build_number int, release_date timestamptz,
                               imported_at timestamptz
sde_categories                 id int PK, name text, published bool, icon_id int
sde_groups                     id int PK, category_id int, name text, published bool, icon_id int,
                               anchorable bool, anchored bool, fittable_non_singleton bool, use_base_price bool
sde_types                      id int PK, group_id int, name text, description text, published bool,
                               market_group_id int, meta_group_id int, meta_level int, tech_level int,
                               race_id int, faction_id int, icon_id int, graphic_id int,
                               mass float8, volume float8, packaged_volume float8, capacity float8,
                               radius float8, base_price float8, portion_size int, variation_parent_type_id int
sde_market_groups              id int PK, parent_id int, name text, description text, has_types bool, icon_id int
sde_meta_groups                id int PK, name text, icon_suffix text
sde_dogma_units                id int PK, name text, display_name text, description text
sde_dogma_attribute_categories id int PK, name text, description text
sde_dogma_attributes           id int PK, name text, display_name text, description text,
                               category_id int, unit_id int, data_type int, default_value float8,
                               high_is_good bool, stackable bool, published bool, display_when_zero bool, icon_id int
sde_dogma_effects              id int PK, name text, display_name text, description text,
                               effect_category_id int, is_offensive bool, is_assistance bool, is_warp_safe bool,
                               disallow_auto_repeat bool, published bool,
                               duration_attribute_id int, discharge_attribute_id int, range_attribute_id int,
                               falloff_attribute_id int, tracking_speed_attribute_id int,
                               resistance_attribute_id int, fitting_usage_chance_attribute_id int
sde_dogma_effect_modifiers     effect_id int, idx int, domain text, func text,
                               modified_attribute_id int, modifying_attribute_id int, operation int,
                               skill_type_id int, group_id int, stopped_effect_id int,   PK (effect_id, idx)
sde_type_attributes            type_id int, attribute_id int, value float8,               PK (type_id, attribute_id)
sde_type_effects               type_id int, effect_id int, is_default bool,               PK (type_id, effect_id)
sde_type_bonuses               type_id int, idx int, kind text CHECK (kind IN ('skill','role','misc')),
                               skill_type_id int, importance int, bonus float8, bonus_text text, unit_id int,
                               PK (type_id, idx)
sde_regions                    id int PK, name text
sde_constellations             id int PK, region_id int, name text
sde_solar_systems              id int PK, constellation_id int, region_id int, name text,
                               security_status float8, security_class text
sde_stations                   id int PK, solar_system_id int, type_id int, owner_id int, operation_id int
```

Indexes: `sde_types (group_id)`, `sde_types (market_group_id)`, `sde_types (lower(name))`,
`sde_groups (category_id)`, `sde_type_attributes (attribute_id)`, `sde_solar_systems (region_id)`,
`sde_stations (solar_system_id)`.

`sde_type_bonuses.idx` is the record's ordinal within the type's `typeBonus` row: all `types[*]._value`
entries first (kind `skill`, `skill_type_id` = the list `_key`), then `roleBonuses` (kind `role`),
then `miscBonuses` (kind `misc`), preserving file order.

## 4. Import pipeline (`src/lib/sde/`)

Pure functions with injected I/O so every stage is unit-testable.

- `version.ts` — `fetchLatestBuild(fetchImpl = fetch): Promise<{ buildNumber: number; releaseDate: Date }>`.
  Uses `User-Agent: <ESI_USER_AGENT>` (same string as ESI; CCP asks for identification).
- `download.ts` — `downloadSde(destPath, fetchImpl = fetch): Promise<void>` streams the zip to disk
  (`Response.body` → `fs.createWriteStream`), never buffering it in memory. Throws on non-2xx.
- `jsonl.ts` — `readJsonlMember(zipPath, memberName): AsyncIterable<Record<string, unknown>>`
  using `yauzl` (`lazyEntries`, `openReadStream`) + `node:readline`; skips blank lines; throws if
  the member is missing.
- `tables.ts` — one declarative `SdeTable` per target table: `{ table, member, columns, map(record) => unknown[] | unknown[][] }`
  (`typeDogma`, `dogmaEffects` and `typeBonus` fan out to child rows). `en(v)` picks the English
  string or `null`; absent optional fields become `null`. `typeDogma` values are stored as given (float8).
- `import.ts` — `importSde(zipPath, pool, log): Promise<ImportResult>` where
  `ImportResult = { buildNumber: number; releaseDate: Date; counts: Record<string, number> }`:
  1. Read `_sde.jsonl` for `buildNumber`/`releaseDate`.
  2. `DROP SCHEMA IF EXISTS sde_import CASCADE; CREATE SCHEMA sde_import` and run `sdeDdl("sde_import")`
     there (tables **and** indexes — indexes travel with their table on `SET SCHEMA`; the old tables and
     their identically named indexes are dropped first in the same transaction).
  3. Stream each member and insert in batches of 2 000 rows using `INSERT … SELECT FROM unnest($1::int[], …)`
     (no new dependency; ~1.5 M `sde_type_attributes` rows load in well under a minute).
  4. In **one transaction**: for each table `DROP TABLE IF EXISTS public.<t>`, `ALTER TABLE sde_import.<t> SET SCHEMA public`,
     upsert `public.sde_meta` (`id = 1`), `DROP SCHEMA sde_import`. Readers see the old data until
     commit; no long locks on live tables.
  5. Return counts.
- `repo.ts` — read API used by later phases and the settings card (all `Promise`s, all read the pool
  from `getPool()` like phase-1 repos):
  - `getSdeMeta(): Promise<{ buildNumber; releaseDate; importedAt; counts: { types; dogmaAttributes; dogmaEffects; solarSystems } } | null>`
  - `getType(id): Promise<SdeType | null>`; `getTypes(ids: number[]): Promise<Map<number, SdeType>>`
  - `searchTypes(query, { categoryId?, limit = 20 }): Promise<SdeType[]>` — case-insensitive substring, published only, name-ascending
  - `getTypeAttributes(typeId): Promise<Map<number, number>>` (attributeId → value)
  - `getTypeEffects(typeId): Promise<{ effectId: number; isDefault: boolean }[]>`
  - `getSkillRequirements(typeId): Promise<{ skillTypeId: number; level: number }[]>` from attribute
    pairs (182,277) (183,278) (184,279) (1285,1286) (1289,1287) (1290,1288); values rounded to int
  - `getSolarSystem(id)`, `getStation(id)`, `getRegion(id)` — `null` when unknown
  - `SdeType = { id, groupId, name, description, published, marketGroupId, metaGroupId, metaLevel, techLevel, mass, volume, packagedVolume, capacity, basePrice, iconId, graphicId, raceId, factionId, portionSize, variationParentTypeId }`

## 5. CLI and worker job

- `scripts/sde-import.ts` (`npm run sde:import [-- --file <zip>]`): with `--file` imports that zip;
  without, downloads the latest zip to `os.tmpdir()`, imports, deletes it. Prints the build and counts.
- **Global scheduler jobs.** `SyncJob` gains `scope: "character" | "global"` (phase-1 jobs are
  `"character"`). The `Scheduler` runs global jobs once per interval regardless of characters, with
  `sync_runs.character_id = NULL`; their `run` receives `{ esi }` only. Staggering applies to
  character jobs only.
- `src/worker/jobs/sde-update.ts` — global job `sde-update`, every 6 h: `fetchLatestBuild()`; if
  `sde_meta` is absent or `build_number` differs, download to a temp file, `importSde`, delete the
  temp file, return the number of `sde_types` rows imported; otherwise return 0. Dependencies
  (`fetchLatestBuild`, `download`, `importSde`, `getSdeMeta`) are injected so the job is unit-tested
  with fakes. First worker start on an empty database therefore imports the SDE within one tick.
- Settings **Sync status** table shows `—` in the character column for global runs.

## 6. UI

`/settings` gains a **Static data** card (`src/app/settings/StaticDataPanel.tsx`, server-rendered from
`getSdeMeta()`): SDE build number, release date, imported-at, and counts (types, attributes, effects,
solar systems); when no import has happened yet it shows "Not imported yet — the worker imports the
SDE on its next run." Midnight tokens, no inline colours.

## 7. Deployment

No new services or env. The worker container performs the import (streams to its own filesystem
under `/tmp`, ~100 MB, deleted afterwards; steady-state heap stays small because every stage streams).
Ansible's existing `eve` role redeploys; acceptance runs after deploy.

## 8. Error handling

- Download or parse failure → the job's `sync_runs` row is `error` with the message; nothing is
  swapped (staging schema is dropped at the start of the next attempt); the previous SDE stays live.
- A missing required member (e.g. `types.jsonl`) fails the import before any swap.
- Non-2xx from the version endpoint → job error; no download.

## 9. Testing

- **Fixture:** `tests/fixtures/sde-mini.zip` (≤ 1.5 MB, committed), produced by
  `scripts/sde-fixture.ts <full.zip>` from the real archive: every record of the small members
  (`_sde`, `categories`, `groups`, `metaGroups`, `dogmaUnits`, `dogmaAttributeCategories`,
  `dogmaAttributes`, `marketGroups`, `mapRegions`) and, for the large members, only records whose
  `_key` (or `solarSystemID` for stations) is in a fixed allow-list that must include: types 587
  (Rifter), 519 (Gyrostabilizer II), 3300 (Gunnery), 3301, 3302, 3329 (Minmatar Frigate), 3413,
  3426, 34 (Tritanium), 52678 (station type); their `typeDogma` and `typeBonus` rows; every effect
  referenced by those types plus effects 754, 290, 146, 92, 89, 5928; constellation 20000020
  (Kimotoro) and its solar systems; stations in system 30000142 (Jita). The allow-list lives in the
  script; the fixture is regenerated only deliberately. The full archive used for generation is
  `docs/research/sde-3484357.zip` (git-ignored).
- **Unit (vitest):** `readJsonlMember` streams the fixture; each `SdeTable.map` on verbatim records
  (English pick, absent → null, effect modifiers incl. `EffectStopper`, `typeBonus` fan-out order);
  `fetchLatestBuild` with a mocked fetch; `sde-update` job skip/import/error paths with fakes;
  `getSkillRequirements` rounding.
- **DB (real Postgres, `eve_test`):** `importSde` on the fixture → counts match the fixture; Rifter
  is in group 25 / market group 64 with `mass = 1067000`; attribute 64 has `stackable = false`; effect
  92 has modifier `(shipID, LocationGroupModifier, 64, 64, 4, groupID 55)`; Jita has
  `security_status ≈ 0.9459` in region 10000002; station 60003760 is in Jita; Rifter's
  `getSkillRequirements` = `[{ 3329, 1 }]`; `searchTypes("rift")` finds Rifter; running the import
  twice leaves one row per key and updates `sde_meta.imported_at`; a failing member (fixture zip
  with `types.jsonl` renamed) leaves the previous tables untouched.
- **Scheduler:** a global job runs without characters, records `character_id = NULL`, and respects its
  interval.
- **Component (happy-dom):** `StaticDataPanel` with data and in the empty state.
- **Acceptance on the VM:** after deploy the worker's first tick imports the live SDE; `/settings`
  shows the current build with ~52 900 types; `sync_runs` has an `ok` `sde-update` row; a second
  tick records `ok` with 0 rows (no new build).

## 10. Out of scope

Character data of any kind, the dogma engine (phase 4), market prices, an item browser UI, localisation,
icons/graphics tables, blueprints/industry, planets/moons/stargates.

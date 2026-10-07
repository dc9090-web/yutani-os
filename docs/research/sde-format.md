# EVE Online SDE — format research for the TypeScript importer

Research date: **2026-09-01**. Everything below was verified by actually downloading and
parsing the live artifacts unless explicitly marked **UNVERIFIED**.

Build inspected: **3484357**, released `2026-08-28T11:07:12Z`.

---

## 0. TL;DR for the importer

| Fact | Value |
|---|---|
| Format | JSON Lines (`.jsonl`), one file per table, **flat** (no directories) in the zip |
| Download | `https://developers.eveonline.com/static-data/eve-online-static-data-latest-jsonl.zip` (302 → build-pinned URL) |
| Version poll | `https://developers.eveonline.com/static-data/tranquility/latest.jsonl` (80 bytes, `cache-control: max-age=300`) |
| Zip size | 99,058,538 bytes (~94.5 MiB) |
| Uncompressed | 578,713,918 bytes (~552 MiB) across 102 files |
| Primary key | `_key` on every line, in every file |
| Localised strings | `{de,en,es,fr,ja,ko,ru,zh}` objects |
| Encoding | UTF-8, raw (not `\uXXXX`-escaped), LF line endings, trailing newline present |
| Streaming needed? | Yes for `mapMoons` (224 MB), `types` (153 MB), `missions` (53 MB), `mapPlanets` (51 MB), `typeDogma` (28 MB) |

---

## 1. Download URLs, versioning, change polling

### 1.1 Canonical docs

- **Docs page: <https://developers.eveonline.com/docs/services/static-data/>**
  (note: `https://developers.eveonline.com/docs/services/sde/` — the URL in the task brief and
  still linked from Fuzzwork — **404s**. The path is `static-data`, not `sde`.)
- Source of that docs page (markdown, easy to diff in CI):
  <https://github.com/esi/esi-docs/raw/main/docs/services/static-data/index.md>
- Landing page: <https://developers.eveonline.com/static-data>
- Announcement blog post (2025-09-22):
  <https://developers.eveonline.com/blog/reworking-the-sde-a-fresh-start-for-static-data>

### 1.2 URL scheme

Base = `https://developers.eveonline.com/static-data/` + tenant + `/`. Tenant is `tranquility`.
(Extracted from the site's own JS chunk `app/static-data/layout-*.js`, module `15205`:
`r = "https://developers.eveonline.com/static-data/"`, `a = "tranquility"`.)

```
# Build-pinned archives (verified 206 + Content-Range):
https://developers.eveonline.com/static-data/tranquility/eve-online-static-data-3484357-jsonl.zip   99,058,538 B
https://developers.eveonline.com/static-data/tranquility/eve-online-static-data-3484357-yaml.zip   101,039,549 B

# "latest" shorthands — NOTE: no tenant segment. 302 redirect to the pinned URL above.
https://developers.eveonline.com/static-data/eve-online-static-data-latest-jsonl.zip
https://developers.eveonline.com/static-data/eve-online-static-data-latest-yaml.zip

# Version pointer (poll this):
https://developers.eveonline.com/static-data/tranquility/latest.jsonl

# Per-build change feed:
https://developers.eveonline.com/static-data/tranquility/changes/<build-number>.jsonl

# Schema changelog (YAML, ~11 KB):
https://developers.eveonline.com/static-data/tranquility/schema-changelog.yaml
```

`.../tranquility/eve-online-static-data-latest-jsonl.zip` (with the tenant) returns **403** — the
shorthand only works on the tenant-less path.

There is **no per-table download endpoint**: `.../tranquility/types.jsonl`, `index.jsonl`,
`manifest.jsonl`, `checksum.txt` all return 403. You must take the whole zip.

### 1.3 Version / change detection — recommended poll

`latest.jsonl` is a single line, 80 bytes:

```json
{"_key": "sde", "buildNumber": 3484357, "releaseDate": "2026-08-28T11:07:12Z"}
```

Response headers (verified):

```
content-type: application/jsonlines+json
cache-control: max-age=300
etag: "c57418347a191f5e1e9782f0a8df97d0"
last-modified: Fri, 28 Aug 2026 11:26:32 GMT
access-control-allow-origin: *
```

Docs: *"All resources fully support ETag and Last-Modified headers. Resources will only update when
they actually change. All non-static files are cached for 5 minutes."* So: `If-None-Match` on
`latest.jsonl` every ≥5 min, and only download the zip when `buildNumber` changes.

There is **no MD5/SHA checksum file** for the new SDE. (The *legacy* SDE had one — see §2.4.)
Use the zip's `ETag` + `Content-Length` for integrity, or trust the 302-pinned build URL.

### 1.4 Change feed (`changes/<build>.jsonl`)

Real content of `changes/3484357.jsonl` (verbatim, whole file):

```json
{"_key":"_meta","buildNumber":3484357,"lastBuildNumber":3482594,"releaseDate":"2026-08-28T11:07:12Z"}
{"_key":"militaryCampaignObjectives","added":["7d2f69f3-c168-43d7-a159-b3dae81f0082","f2f8487d-621e-48d4-ac9e-f7a89de6f58b"]}
```

- The `_meta` record carries `lastBuildNumber`, letting you walk the history backwards.
- Every other record is keyed by **file name** (no `.jsonl` suffix) and carries arrays of record
  keys under `added` / `removed` / `changed` / `changedLocalization`, plus the boolean-ish markers
  `fileAdded` / `fileRemoved` / `fileRenamed` / `schemaChanged` (field names taken from the site's
  i18n bundle and its `Change` component).
- **This is the cheap incremental path**: to know whether `types` changed at all, fetch a
  ~200-byte–few-KB file rather than a 94 MB zip. I have not seen a build large enough to confirm
  how big a busy `changed` array gets — **UNVERIFIED** for worst case.

### 1.5 Schema changelog

`schema-changelog.yaml` — YAML, `schemaChangelog:` list, each entry `afterBuildNumber`, `date`,
and `files.changes` / `fields.changes.<file>.<field>: "added field." | ...`. Recent entries:

```yaml
- afterBuildNumber: 3466501
  date: 2026-08-17
  fields:
    changes:
      industryAssemblyLines:
        detailsPerTypeList.[].typeListID: added field.
- afterBuildNumber: 3464040
  date: 2026-08-12
  fields:
    changes:
      types:
        isDynamicType: added field.
        isRepackable: added field.
- afterBuildNumber: 3458726
  date: 2026-08-11
  files:
    changes:
      accountingEntryTypes: added.
      ...
  fields:
    changes:
      types:
        packagedVolume: added field.
```

**Importer implication:** fields are added to `types` fairly often (3 new fields in ~3 months).
Do not use a strict "reject unknown field" parser; log-and-ignore, and watch this file in CI.

---

## 2. File format & inventory

### 2.1 The format itself

- One JSON object per line, `\n`-terminated (LF only, verified no `\r`), file ends with a newline.
- UTF-8, non-ASCII written raw (`"名前"`, not `"名..."`).
- Serialiser emits a space after `:` and `,` (`{"_key": 0, "name": {...}}`) — irrelevant to parsing,
  but means byte sizes are ~10% above minified.
- **Every line has `_key`** (verified over the first 200 lines of all 102 files).
- **`_key` is usually an integer** but is a **string** in 5 files:
  `_sde.jsonl` (`"sde"`), `translationLanguages.jsonl` (`"en"`, `"de"`, …),
  `militaryCampaigns.jsonl`, `militaryCampaignObjectives.jsonl`, `characterTitles.jsonl` (GUIDs).
  → Type your key column as `text` or branch per table; do not assume `int`.
- **Absent ≠ null**: optional fields are simply omitted from the line. E.g. `types.jsonl`:
  `_key/groupID/name/portionSize/published` on all 52,863 records, but `description` on 34,299,
  `basePrice` on 13,933, `isDynamicType` on 89. Your row builder must default, not destructure.
- **Integer-keyed maps become `_key`/`_value` lists.** From the docs:
  *"JSON keys must be strings. When the dataset contains integer keys, these are converted to a list
  format where each entry contains `_key`: the actual key value, `_value`: the value (when the value
  is not an object)."* This nests — see `masteries.jsonl` in §3.10. The YAML variant does **not**
  do this (YAML has native integer keys), which is the only schema difference between the variants.
- Max single line seen: `freelanceJobSchemas.jsonl` 99,387 B (that file is literally one record),
  `missions.jsonl` 88,805 B, `types.jsonl` 64,488 B. A 128 KB line buffer is comfortable;
  `readline`/`node:readline` or a `split2`-style transform is fine — **do not** use a naive
  `readFile().split('\n')` on `mapMoons`/`types`.
- Largest integer key seen anywhere: 40,509,898 (`mapMoons`). Well within `Number.MAX_SAFE_INTEGER`,
  so plain `JSON.parse` is safe — no BigInt handling needed.

### 2.2 Complete file list (build 3484357), by uncompressed size

```
mapMoons.jsonl                    223,976,078   |  militaryCampaigns.jsonl               177,400
types.jsonl                       152,595,776   |  accountingEntryTypes.jsonl            170,535
missions.jsonl                     53,385,302   |  dynamicItemAttributes.jsonl           166,282
mapPlanets.jsonl                   50,930,738   |  ancestries.jsonl                      159,314
typeDogma.jsonl                    27,591,906   |  masteries.jsonl                       151,077
mapAsteroidBelts.jsonl             21,757,913   |  stationOperations.jsonl               140,964
npcCharacters.jsonl                 6,457,218   |  typeLists.jsonl                       126,581
mapSolarSystems.jsonl               5,138,816   |  notificationTypes.jsonl               122,854
blueprints.jsonl                    3,560,150   |  shipTreeGroups.jsonl                  117,201
typeBonus.jsonl                     3,325,667   |  freelanceJobSchemas.jsonl              99,387
mapStargates.jsonl                  2,924,661   |  expertSystems.jsonl                    80,070
typeMaterials.jsonl                 2,255,943   |  bloodlines.jsonl                       74,369
dogmaEffects.jsonl                  2,085,181   |  typeElements.jsonl                     62,348
npcCorporations.jsonl               1,968,810   |  schools.jsonl                          58,788
mapStars.jsonl                      1,871,612   |  corporationRoles.jsonl                 54,038
npcStations.jsonl                   1,843,863   |  archetypes.jsonl                       49,422
marketGroups.jsonl                  1,556,921   |  industryModifierSources.jsonl          42,626
planetResources.jsonl               1,326,093   |  shipTreeElements.jsonl                 38,562
dungeons.jsonl                      1,312,120   |  agentsInSpace.jsonl                    36,884
dogmaAttributes.jsonl               1,288,439   |  controlTowerResources.jsonl            32,268
skins.jsonl                         1,270,886   |  fighterAbilities.jsonl                 31,814
skinLicenses.jsonl                    952,717   |  planetSchematics.jsonl                 31,548
graphics.jsonl                        831,676   |  races.jsonl                            30,398
groups.jsonl                          807,077   |  skinrTierThresholds.jsonl              28,447
militaryCampaignObjectives.jsonl      649,381   |  epicArcs.jsonl                         28,037
certificates.jsonl                    580,815   |  dogmaUnits.jsonl                       26,047
graphicMaterialSets.jsonl             556,153   |  cloneGrades.jsonl                      21,516
mapConstellations.jsonl               482,440   |  shipTreeFactions.jsonl                 20,032
mapRegions.jsonl                      443,651   |  npcCorporationDivisions.jsonl          17,981
icons.jsonl                           441,149   |  fighterAbilitiesByType.jsonl           15,584
skinrComponents.jsonl                 409,250   |  appliedProximityEffects.jsonl          14,327
skillPlans.jsonl                      353,473   |  industryInstallationTypes.jsonl        12,444
landmarks.jsonl                       314,364   |  characterTitles.jsonl                  12,324
industryAssemblyLines.jsonl           314,104   |  categories.jsonl                       11,059
skinMaterials.jsonl                   257,636   |  compressibleTypes.jsonl                 9,091
mapSecondarySuns.jsonl                186,773   |  systemWideEffects.jsonl                 8,750
dbuffCollections.jsonl                182,668   |  characterAttributes.jsonl               6,856
factions.jsonl                        179,335   |  stationServices.jsonl                   6,574
                                                |  sovereigntyUpgrades.jsonl               6,540
                                                |  proximityTrap.jsonl                     5,670
                                                |  metaGroups.jsonl                        5,591
                                                |  contrabandTypes.jsonl                   5,530
                                                |  mercenaryTacticalOperations.jsonl       4,732
                                                |  corporationActivities.jsonl             4,033
                                                |  corporationRoleGroups.jsonl             4,008
                                                |  dogmaAttributeCategories.jsonl          3,227
                                                |  skinrSlots.jsonl                        2,851
                                                |  skinrSlotsToMaterials.jsonl             2,512
                                                |  industryTargetFilters.jsonl             1,388
                                                |  linkWithShip.jsonl                      1,349
                                                |  skinrComponentRarities.jsonl            1,163
                                                |  skinrSlotConfigurations.jsonl           1,067
                                                |  schoolMap.jsonl                           663
                                                |  industryActivities.jsonl                  607
                                                |  skinrComponentPointValues.jsonl           573
                                                |  agentTypes.jsonl                          504
                                                |  skinrSlotNames.jsonl                      327
                                                |  translationLanguages.jsonl                278
                                                |  stationStandingsRestrictions.jsonl        239
                                                |  systemDbuffEmitters.jsonl                 120
                                                |  skinrSlotCategories.jsonl                 118
                                                |  metenoxMoonDrill.jsonl                     99
                                                |  skinrComponentCategories.jsonl             95
                                                |  _sde.jsonl                                 80
```

`_sde.jsonl` (whole file):

```json
{"_key": "sde", "buildNumber": 3484357, "releaseDate": "2026-08-28T11:07:12Z"}
```

→ Read this from inside the zip and store it as your import's provenance row.

### 2.3 The files you asked about

| You asked for | File name in the new SDE | Records |
|---|---|---|
| types | `types.jsonl` | 52,863 |
| groups | `groups.jsonl` | 1,610 |
| categories | `categories.jsonl` | 48 |
| dogmaAttributes | `dogmaAttributes.jsonl` | 2,867 |
| dogmaEffects | `dogmaEffects.jsonl` | 3,417 |
| typeDogma (attrs+effects per type) | `typeDogma.jsonl` | 26,828 |
| marketGroups | `marketGroups.jsonl` | 2,106 |
| metaGroups | `metaGroups.jsonl` | 13 |
| icons | `icons.jsonl` | 4,658 |
| graphics | `graphics.jsonl` | 6,069 |
| skins (skipped) | `skins.jsonl`, `skinLicenses.jsonl`, `skinMaterials.jsonl`, `skinr*.jsonl` (16 files) | — |
| blueprints | `blueprints.jsonl` | 5,082 |
| units (dogma units) | `dogmaUnits.jsonl` | 60 |
| typeMaterials | `typeMaterials.jsonl` | 9,551 |
| **attribute categories** | `dogmaAttributeCategories.jsonl` | 37 |

**Fitting / skill-related, additionally:**

| File | Records | What it is |
|---|---|---|
| `typeBonus.jsonl` | 652 | Ship trait/bonus text (per-skill, role, misc) — split out of `types` in the rework |
| `masteries.jsonl` | 476 | typeID → mastery level → certificate IDs |
| `certificates.jsonl` | 139 | Certificate → required skills at basic/standard/improved/advanced/elite |
| `skillPlans.jsonl` | 40 | Curated career skill plans (`skillRequirements`, `milestones`) |
| `dbuffCollections.jsonl` | 276 | Named buff collections (links/effects) with a *string* `operationName` |
| `dynamicItemAttributes.jsonl` | 413 | Abyssal/mutaplasmid min-max attribute ranges + input→output type mapping |
| `typeLists.jsonl` | 462 | Named include/exclude sets of type/group/category IDs (used by industry filters) |
| `typeElements.jsonl` | 423 | typeID → elementID → value (**purpose UNVERIFIED**; Fuzzwork exposes it verbatim as `typeElements(typeID, elementID, value)`) |
| `compressibleTypes.jsonl` | 212 | oreTypeID → compressedTypeID |
| `fighterAbilities.jsonl` / `fighterAbilitiesByType.jsonl` | 36 / 94 | Fighter ability defs & per-type slot assignment |
| `expertSystems.jsonl` | 55 | Expert System → skills granted, duration, associated ships |
| `linkWithShip.jsonl`, `systemWideEffects.jsonl`, `systemDbuffEmitters.jsonl`, `appliedProximityEffects.jsonl` | small | dbuff application sources |

**There is no `requiredSkills` file.** Skill requirements live in `typeDogma` as attribute pairs:
`182/277` (requiredSkill1 / requiredSkill1Level), `183/278`, `184/279`, `1285/1286`, `1289/1287`,
`1290/1288`. Slot layout likewise: `12` lowSlots, `13` medSlots, `14` hiSlots, `1137` rigSlots,
`101` launcherSlotsLeft, `102` turretSlotsLeft, `1547` rigSize.

### 2.4 What changed vs. the old YAML SDE

The old SDE is **frozen**. `https://eve-static-data-export.s3-eu-west-1.amazonaws.com/tranquility/sde.zip`
still serves 112,170,297 bytes but `Last-Modified: Mon, 07 Jul 2025 13:41:34 GMT` — it has not been
rebuilt since. Its `.../tranquility/checksum` file (MD5 per member) is still readable; `sde.md5` is 403.

Old layout (from that checksum manifest):

```
bsd/     invFlags, invItems, invNames, invPositions, invUniqueNames, staStations           (.yaml)
fsd/     agents, agentsInSpace, ancestries, bloodlines, blueprints, categories, certificates,
         characterAttributes, contrabandTypes, controlTowerResources, corporationActivities,
         dogmaAttributeCategories, dogmaAttributes, dogmaEffects, factions, graphicIDs, groups,
         iconIDs, marketGroups, metaGroups, npcCorporationDivisions, npcCorporations,
         planetResources, planetSchematics, races, researchAgents, skinLicenses, skinMaterials,
         skins, sovereigntyUpgrades, stationOperations, stationServices, tournamentRuleSets,
         translationLanguages, typeDogma, typeMaterials, types                             (.yaml)
universe/{eve,wormhole,abyssal,...}/<region>/<constellation>/<system>/solarsystem.yaml      (951+ files)
```

Concrete deltas (from the CCP blog post + my own diff of the two manifests):

1. **`fsd/` prefix is gone.** `fsd/types.yaml` → `types.jsonl`. Note the brief's `fsd/typeIDs.yaml`
   is *two* generations old — CCP had already renamed `typeIDs`→`types`, `groupIDs`→`groups`,
   `iconIDs`→`icons`, `graphicIDs`→`graphics` in the old SDE before the rework.
2. **`bsd/` folder removed.** *"This data has been integrated into other files where it makes more
   sense."* `staStations` → `npcStations.jsonl`. **`invFlags`, `invNames`, `invUniqueNames`,
   `invItems`, `invPositions` have no direct successor** — if you relied on `invFlags` for slot
   flag names, the new SDE does not carry it (get it from ESI or from Fuzzwork's `invFlags.csv`).
3. **`universe/` tree removed.** Replaced by flat `mapRegions`, `mapConstellations`,
   `mapSolarSystems`, `mapPlanets`, `mapMoons`, `mapAsteroidBelts`, `mapStars`, `mapSecondarySuns`,
   `mapStargates`, `landmarks`. Huge win: no more 5,000-file walk.
4. **`fsd/agents.yaml` + `researchAgents.yaml` folded into `npcCharacters.jsonl`** as an optional
   `agent: {agentTypeID, divisionID, isLocator, level}` sub-object (10,966 of 11,393 records have it).
5. **`tournamentRuleSets` dropped.**
6. **`types` was split**: mastery data → `masteries.jsonl`, trait/bonus text → `typeBonus.jsonl`.
7. **`nameID` → `name`, `descriptionID` → `description`** throughout. The old `{nameID: {en: ...}}`
   wrapper is gone; localised values are the field itself.
8. **New files**: `agentTypes`, `dbuffCollections`, `dogmaUnits`, `dynamicItemAttributes` (and since
   the initial rework: `industry*`, `expertSystems`, `notificationTypes`, `skillPlans`, `schools`,
   `corporationRoles`, `accountingEntryTypes`, `epicArcs`, `missions`, `shipTree*`, `military*`,
   `skinr*` — see `schema-changelog.yaml`).
9. **Dogma expressions are gone.** The old `dgmExpressions`/`preExpression`/`postExpression` route
   is dead; `modifierInfo` is the only modifier representation. (Fuzzwork still emits an
   `dgmExpressions.csv` but it is header-only/empty.)
10. **Some server-only fields dropped**: *"Some fields that weren't exported to the client are no
    longer available in the SDE."* The SDE is now generated purely from client data.
11. **YAML variant is the SAME new schema**, just `.yaml` (102 members, identical base names —
    verified by reading the yaml zip's central directory over a range request). It is not the legacy
    layout. Docs recommend JSON Lines for the big files.

---

## 3. Record schemas — real records, verbatim

All samples below were extracted from `eve-online-static-data-3484357-jsonl.zip`.
Localised fields are always the full 8-language object `{de,en,es,fr,ja,ko,ru,zh}`
(languages enumerated in `translationLanguages.jsonl`; all 8 keys always present when the field
is present — per the community JSON Schema each language is `required` inside the object).

### 3.1 `types.jsonl` — PK `_key` (= typeID), 52,863 rows

```json
{"_key": 587, "basePrice": 400000.0, "capacity": 140.0, "description": {"de": "Die Rifter ist eine sehr mächtige Kampffregatte …", "en": "The Rifter is a very powerful combat frigate and can easily tackle the best frigates out there. It has gone through many radical design phases since its inauguration during the Minmatar Rebellion. The Rifter has a wide variety of offensive capabilities, making it an unpredictable and deadly adversary.", "es": "…", "fr": "…", "ja": "…", "ko": "…", "ru": "…", "zh": "…"}, "factionID": 500002, "graphicID": 46, "groupID": 25, "isRepackable": true, "marketGroupID": 64, "mass": 1067000.0, "metaGroupID": 1, "metaLevel": 0, "name": {"de": "Rifter", "en": "Rifter", "es": "Rifter", "fr": "Rifter", "ja": "リフター", "ko": "리프터", "ru": "Rifter", "zh": "裂谷级"}, "packagedVolume": 2500.0, "portionSize": 1, "published": true, "raceID": 2, "radius": 31.0, "shipTreeGroupID": 8, "soundID": 20078, "techLevel": 1, "volume": 27289.0}
```

Fields and how often they appear (n = 52,863):

| field | type | present | notes |
|---|---|---|---|
| `_key` | int | 52,863 | typeID |
| `groupID` | int | 52,863 | → `groups._key` |
| `name` | **localised** | 52,863 | |
| `portionSize` | int | 52,863 | |
| `published` | bool | 52,863 | |
| `packagedVolume` | float | 46,748 | added 2026-08-11 |
| `volume` | float | 46,748 | |
| `description` | **localised** | 34,299 | contains EVE-HTML (`<a href=showinfo:…>`) |
| `raceID` | int | 23,120 | |
| `iconID` | int | 22,808 | → `icons._key` |
| `mass` | float | 21,228 | |
| `marketGroupID` | int | 19,657 | → `marketGroups._key` |
| `graphicID` | int | 18,721 | → `graphics._key` |
| `radius` | float | 15,599 | |
| `basePrice` | float | 13,933 | |
| `metaGroupID` | int | 13,798 | → `metaGroups._key` |
| `techLevel` | int | 10,075 | added 2026-06-25 |
| `capacity` | float | 10,009 | |
| `metaLevel` | int | 8,204 | |
| `isRepackable` | bool | 6,522 | added 2026-08-12 |
| `soundID` | int | 5,085 | |
| `variationParentTypeID` | int | 4,796 | replaces old `invMetaTypes.parentTypeID` |
| `factionID` | int | 1,376 | |
| `shipTreeGroupID` | int | 934 | added 2026-06-24 |
| `isDynamicType` | bool | 89 | added 2026-08-12; abyssal/mutated base types |

Note there is **no `repackagedVolume`** in the official SDE (see §6.3 for a community source).

### 3.2 `groups.jsonl` — PK `_key` (groupID), 1,610 rows

```json
{"_key": 25, "anchorable": false, "anchored": false, "categoryID": 6, "fittableNonSingleton": false, "name": {"de": "Fregatte", "en": "Frigate", "es": "Fragata", "fr": "Frégate", "ja": "フリゲート", "ko": "프리깃", "ru": "Фрегат", "zh": "护卫舰"}, "published": true, "useBasePrice": false}
```

Always: `_key, anchorable, anchored, categoryID, fittableNonSingleton, name(localised), published, useBasePrice`.
Optional: `iconID` (769/1,610).

### 3.3 `categories.jsonl` — PK `_key` (categoryID), 48 rows

```json
{"_key": 6, "name": {"de": "Schiff", "en": "Ship", "es": "Nave", "fr": "Vaisseau", "ja": "艦船", "ko": "함선", "ru": "Корабль", "zh": "舰船"}, "published": true}
```

Always `_key, name(localised), published`; optional `iconID` (13/48).

### 3.4 `dogmaAttributes.jsonl` — PK `_key` (attributeID), 2,867 rows

```json
{"_key": 9, "attributeCategoryID": 4, "dataType": 4, "defaultValue": 0.0, "description": "The maximum hitpoints of an object.", "displayName": {"de": "HP der Struktur", "en": "Structure Hitpoints", "es": "Vida estructura", "fr": "PV de la structure", "ja": "ストラクチャのヒットポイント", "ko": "내구도", "ru": "Запас прочности корпуса", "zh": "结构值"}, "displayWhenZero": false, "highIsGood": true, "iconID": 67, "name": "hp", "published": true, "stackable": true, "tooltipDescription": {"…8 langs…"}, "tooltipTitle": {"…8 langs…"}, "unitID": 113}
```

```json
{"_key": 64, "attributeCategoryID": 29, "dataType": 5, "defaultValue": 1.0, "description": "Damage multiplier.", "displayName": {"de": "Schadensmodifikator", "en": "Damage Modifier", "es": "Modificador de daño", "fr": "Modificateur de dommages", "ja": "ダメージ修正乗数", "ko": "피해량 보정치", "ru": "Модификатор урона", "zh": "伤害量调整"}, "displayWhenZero": false, "highIsGood": true, "iconID": 1432, "name": "damageMultiplier", "published": true, "stackable": false, "unitID": 104}
```

> ⚠️ **`description` here is a PLAIN ASCII STRING, not a localised map.** `displayName`,
> `tooltipTitle`, `tooltipDescription` *are* localised. This asymmetry is real and is the single
> easiest thing to get wrong. Compare `dogmaEffects.description`, which **is** localised.
> Likewise `name` on attributes/effects/units is a plain internal identifier string, never localised.

| field | type | present (n=2,867) |
|---|---|---|
| `_key`, `dataType`, `defaultValue`, `displayWhenZero`, `highIsGood`, `name`, `published`, `stackable` | int/float/bool/string | 2,867 |
| `attributeCategoryID` | int | 2,680 |
| `description` | **plain string** | 2,635 |
| `iconID` | int | 1,361 |
| `unitID` | int | 1,353 → `dogmaUnits._key` |
| `displayName` | localised | 1,248 |
| `tooltipTitle` / `tooltipDescription` | localised | 73 / 70 |
| `maxAttributeID` / `minAttributeID` | int | 29 / 8 |
| `chargeRechargeTimeID` | int | 6 |

`stackable`: 2,623 true / **244 false**. `stackable: false` is the SDE's marker for
stacking-penalised attributes (see §4.4).

### 3.5 `dogmaAttributeCategories.jsonl` — 37 rows

```json
{"_key": 1, "description": "Fitting capabilities of a ship", "name": "Fitting"}
```

Both `name` and `description` are plain strings.

### 3.6 `dogmaUnits.jsonl` — PK `_key` (unitID), 60 rows *(new file, was `eveUnits` only in Fuzzwork)*

```json
{"_key": 1, "description": {"de": "Meter", "en": "Meter", "es": "Metro.", "fr": "Mètre", "ja": "メートル", "ko": "m", "ru": "метр", "zh": "米"}, "displayName": {"de": "m", "en": "m", "es": "m", "fr": "m", "ja": "m", "ko": "m", "ru": "м", "zh": "m"}, "name": "Length"}
```

```json
{"_key": 109, "description": {"en": "Used for multipliers displayed as %1.1 = +10%0.9 = -10%", "…": "…"}, "displayName": {"en": "%", "…": "…"}, "name": "Modifier Percent"}
```

`name` plain; `displayName` (56/60) and `description` (44/60) localised.

### 3.7 `typeDogma.jsonl` — PK `_key` (typeID), 26,828 rows, 27.6 MB

Exactly three fields: `_key`, `dogmaAttributes`, `dogmaEffects`.

```json
{"_key": 587,
 "dogmaAttributes": [{"attributeID": 3, "value": 0.0}, {"attributeID": 9, "value": 350.0}, {"attributeID": 11, "value": 41.0}, {"attributeID": 12, "value": 4.0}, {"attributeID": 13, "value": 3.0}, {"attributeID": 14, "value": 3.0}, {"attributeID": 101, "value": 2.0}, {"attributeID": 102, "value": 3.0}, {"attributeID": 182, "value": 3329.0}, {"attributeID": 277, "value": 1.0}, {"attributeID": 1137, "value": 3.0}, "…"],
 "dogmaEffects": [{"effectID": 5779, "isDefault": false}, {"effectID": 7248, "isDefault": false}]}
```

- `dogmaAttributes[]` = `{attributeID: int, value: float}` — **`value` is always a JSON float**,
  even for IDs and counts (`182` → `3329.0`). Round/cast on the way into Postgres.
  Legacy `dgmTypeAttributes` had separate `valueInt`/`valueFloat` columns; that split is gone.
- `dogmaEffects[]` = `{effectID: int, isDefault: bool}`.
- Note only 26,828 of 52,863 types have a `typeDogma` row — the rest have no dogma at all.

Suggested Postgres shape: two child tables, `type_dogma_attribute(type_id, attribute_id, value double precision)`
and `type_dogma_effect(type_id, effect_id, is_default boolean)`. ~1.5 M and ~90 K rows respectively
(**UNVERIFIED exact counts** — I did not sum the arrays).

### 3.8 `marketGroups.jsonl` — PK `_key`, 2,106 rows

```json
{"_key": 64, "description": {"de": "Minmatar-Fregatten-Designs.", "en": "Minmatar frigate designs.", "es": "Diseños de fragatas minmatarianas.", "fr": "Modèles de frégates minmatar.", "ja": "ミンマターフリゲート設計図。", "ko": "민마타의 프리깃입니다.", "ru": "Фрегаты разработки Республики Minmatar.", "zh": "米玛塔尔护卫舰设计"}, "hasTypes": true, "iconID": 20968, "name": {"de": "Minmatar", "en": "Minmatar", "es": "Minmatar", "fr": "Minmatar", "ja": "ミンマター", "ko": "민마타", "ru": "Минматарские", "zh": "米玛塔尔"}, "parentGroupID": 5}
```

`_key`, `hasTypes`, `name` (localised) always; `parentGroupID` 2,087 (self-FK, nullable at roots),
`iconID` 2,076, `description` (localised) 1,582.

### 3.9 `metaGroups.jsonl` — PK `_key`, 13 rows

```json
{"_key": 2, "color": {"b": 0.003922, "g": 0.380392, "r": 0.619608}, "iconID": 24150, "iconSuffix": "t2", "name": {"de": "Tech II", "en": "Tech II", "es": "T2", "fr": "Tech II", "ja": "T2", "ko": "테크 II", "ru": "Tech II", "zh": "二级科技"}}
```

`_key`, `name` always; `iconID`/`iconSuffix` 12; `color` `{r,g,b}` floats 10; `description` 3.

### 3.10 `icons.jsonl` (4,658) and `graphics.jsonl` (6,069)

```json
{"_key": 67, "iconFile": "res:/ui/texture/icons/2_64_9.png"}
```

```json
{"_key": 46, "iconFolder": "res:/dx9/model/ship/minmatar/frigate/mf4/icons", "sofFactionName": "minmatarbase", "sofHullName": "mf4_t1", "sofRaceName": "minmatar"}
```

`icons`: only `_key` + `iconFile`, both always present.
`graphics`: `_key` always; everything else optional —
`sofRaceName` 4,322, `sofFactionName` 4,126, `sofHullName` 3,548, `iconFolder` 2,702,
`graphicFile` 2,449, `sofMaterialSetID` 112, `sofLayout` 57. Nothing localised in either file.

### 3.11 `blueprints.jsonl` — PK `_key` (= blueprintTypeID), 5,082 rows

```json
{"_key": 681, "activities": {"copying": {"time": 480}, "manufacturing": {"materials": [{"quantity": 86, "typeID": 38}], "products": [{"quantity": 1, "typeID": 165}], "time": 600}, "research_material": {"time": 210}, "research_time": {"time": 210}}, "blueprintTypeID": 681, "maxProductionLimit": 300}
```

With invention (typeID 683):

```json
"invention": {"materials": [{"quantity": 2, "typeID": 20416}, {"quantity": 2, "typeID": 25887}], "products": [{"probability": 0.3, "quantity": 1, "typeID": 39581}], "skills": [{"level": 1, "typeID": 11442}, {"level": 1, "typeID": 11454}, {"level": 1, "typeID": 21790}], "time": 63900}
```

`_key`, `activities`, `blueprintTypeID`, `maxProductionLimit` on all 5,082 rows (`_key` ==
`blueprintTypeID` — redundant but present). `activities` is an **object keyed by snake_case activity
name** (`manufacturing`, `copying`, `invention`, `reaction`, `research_material`, `research_time`),
each with optional `materials[]`, `products[]` (`products[].probability` for invention),
`skills[]`, and `time` (integer seconds). Nothing localised.

### 3.12 `typeMaterials.jsonl` — PK `_key` (typeID), 9,551 rows

```json
{"_key": 587, "materials": [{"materialTypeID": 34, "quantity": 13333}, {"materialTypeID": 35, "quantity": 3333}, {"materialTypeID": 36, "quantity": 1333}]}
```

`materials` on 9,541; `randomizedMaterials` on 10.

### 3.13 `typeBonus.jsonl` — PK `_key` (typeID), 652 rows (ship traits)

```json
{"_key": 587, "types": [{"_key": 3329, "_value": [{"bonus": 7.5, "bonusText": {"de": "Bonus auf die Feuerrate von <a href=showinfo:3302>kleinen Projektilwaffentürmen</a>", "en": "bonus to <a href=showinfo:3302>Small Projectile Turret</a> rate of fire", "es": "…", "fr": "…", "ja": "…", "ko": "…", "ru": "…", "zh": "…"}, "importance": 1, "unitID": 105}, {"bonus": 10.0, "bonusText": {"en": "bonus to <a href=showinfo:3302>Small Projectile Turret</a> falloff", "…": "…"}, "importance": 2, "unitID": 105}]}]}
```

- `types` (533 rows) is a `_key`/`_value` list: **`_key` is the skill typeID** whose level scales
  the bonus, `_value` is the bonus array.
- `roleBonuses` (490) and `miscBonuses` (74) are plain arrays of the same bonus objects.
- `iconID` on 64.
- `bonusText` is localised and contains EVE-HTML `showinfo:` links. `unitID` → `dogmaUnits`
  (105 = "%"). `importance` is the display order. `bonus` may be absent for text-only traits
  (**UNVERIFIED** — every sample I pulled had it).
- Legacy equivalent: Fuzzwork's flattened `invTraits(traitID, typeID, skillID, bonus, bonusText, unitID)`
  with `skillID = -1` for role bonuses.

### 3.14 `masteries.jsonl` — PK `_key` (typeID), 476 rows — nested `_key`/`_value`

```json
{"_key": 582, "_value": [{"_key": 0, "_value": [96, 139, 85, 87, 94]}, {"_key": 1, "_value": [96, 139, 85, 87, 94]}, {"_key": 2, "_value": [96, 139, 85, 87, 94]}, {"_key": 3, "_value": [96, 139, 85, 87, 94]}, {"_key": 4, "_value": [96, 139, 85, 118, 87, 94]}]}
```

Read as `typeID → { masteryLevel: [certificateID, …] }`. This is the clearest example of the
integer-key→list encoding, and the only file where the **top level itself** is `_key`/`_value`
rather than named fields.

### 3.15 `certificates.jsonl` — PK `_key`, 139 rows

```json
{"_key": 50, "description": {"en": "This certificate represents a level of competence in handling small energy turrets. …", "…": "…"}, "groupID": 255, "name": { "…localised…" }, "skillTypes": [{"_key": 3300, "advanced": 5, "basic": 3, "elite": 5, "improved": 4, "standard": 4}, {"_key": 3303, "advanced": 5, "basic": 1, "elite": 5, "improved": 4, "standard": 3}, "…"], "recommendedFor": [73789, 42685, 33079, "…"]}
```

`skillTypes[]._key` = skill typeID; the five named tiers give required level per mastery tier.

### 3.16 `skillPlans.jsonl` — PK `_key`, 40 rows

```json
{"_key": 4, "careerPathID": 7, "factionID": 500002, "internalName": "Minmatar Soldier of Fortune - Faction Militia",
 "skillRequirements": [{"level": 1, "typeID": 3327}, {"level": 1, "typeID": 3392}, {"level": 1, "typeID": 3426}, "…"],
 "milestones": [{"level": 3, "typeID": 3329}, {"level": 2, "typeID": 3356}, "…"],
 "name": {"…localised…"}, "description": {"…localised…"}}
```

### 3.17 `dynamicItemAttributes.jsonl` — PK `_key` (mutaplasmid typeID), 413 rows

```json
{"_key": 47297, "attributeIDs": [{"_key": 6, "max": 1.4, "min": 0.6}, {"_key": 20, "max": 1.1, "min": 0.9}, {"_key": 30, "max": 1.5, "min": 0.8}, {"_key": 50, "max": 1.5, "min": 0.8}, {"_key": 554, "max": 1.3, "min": 0.7}], "inputOutputMapping": [{"applicableTypes": [5975, 12052, 12076, 14118, 14120, 15751, 15764, 19315, 19321, 19327, 19339, 19345, 19351, 21478, 35659, 35660, 84964, 84965], "resultingType": 47408}]}
```

Note `attributeIDs[]` uses `_key` for the attribute ID alongside sibling `min`/`max` fields — a
*hybrid* of the `_key` encoding, not the `_key`/`_value` pair form. Handle both shapes.

### 3.18 `dbuffCollections.jsonl` — PK `_key`, 276 rows

```json
{"_key": 1, "aggregateMode": "Maximum", "developerDescription": "[PROTOTYPE]Test Multi Buff", "itemModifiers": [{"dogmaAttributeID": 37}, {"dogmaAttributeID": 76}], "locationGroupModifiers": [{"dogmaAttributeID": 20, "groupID": 46}, {"dogmaAttributeID": 105, "groupID": 52}], "locationModifiers": [{"dogmaAttributeID": 68}, {"dogmaAttributeID": 84}], "locationRequiredSkillModifiers": [{"dogmaAttributeID": 6, "skillID": 3427}, {"dogmaAttributeID": 54, "skillID": 3305}], "operationName": "PostMul", "showOutputValueInUI": "ShowNormal"}
```

**Important cross-reference:** `operationName` here is a *string*, and the observed value set is
`{PostPercent: 223, ModAdd: 25, PreAssignment: 15, PostAssignment: 10, PostMul: 3}`. This is the
same operation vocabulary as `modifierInfo.operation`'s integers — see §4.3.

### 3.19 `translationLanguages.jsonl` — 8 rows, **string PK**

```json
{"_key": "ru", "name": "Russian"}
{"_key": "fr", "name": "French"}
{"_key": "en", "name": "English"}
{"_key": "zh", "name": "Chinese"}
{"_key": "de", "name": "German"}
{"_key": "ko", "name": "Korean"}
{"_key": "ja", "name": "Japanese"}
{"_key": "es", "name": "Spanish"}
```

This is the authoritative list of keys inside every localised map.

### 3.20 Odds and ends

```json
// compressibleTypes.jsonl (212) — oreTypeID → compressed variant
{"_key": 18, "compressedTypeID": 62528}

// typeElements.jsonl (423)
{"_key": 582, "elements": [{"_key": 1, "_value": 30}, {"_key": 2, "_value": 25}, {"_key": 3, "_value": 20}]}

// fighterAbilities.jsonl (36)
{"_key": 1, "disallowInHighSec": false, "disallowInLowSec": false, "displayName": {"en": "Attack Turret", "…": "…"}, "iconID": 1386, "targetMode": "itemTargeted"}

// fighterAbilitiesByType.jsonl (94)  — abilitySlot0/1/2
// npcCharacters.jsonl (11,393) — agents live here now
{"_key": 3008416, "agent": {"agentTypeID": 2, "divisionID": 22, "isLocator": false, "level": 1}, "ancestryID": 11, "bloodlineID": 1, "careerID": 14, "ceo": false, "corporationID": 1000002, "gender": false, "locationID": 60000004, "name": {"en": "Antaken Kamola", "…": "…"}, "raceID": 1, "schoolID": 18, "specialityID": 15, "startDate": "2003-05-04 00:32:00", "uniqueName": true}
```

Note `startDate` is a **non-ISO** `"YYYY-MM-DD HH:MM:SS"` string, unlike `releaseDate` in
`_sde.jsonl` which is RFC 3339. Don't assume one date format across the SDE.

---

## 4. Dogma effects & modifiers

### 4.1 `dogmaEffects.jsonl` — PK `_key` (effectID), 3,417 rows

Field presence (n = 3,417):

| always | `_key`, `disallowAutoRepeat`, `effectCategoryID`, `electronicChance`, `isAssistance`, `isOffensive`, `isWarpSafe`, `name`, `propulsionChance`, `published`, `rangeChance` |
|---|---|
| **`modifierInfo`** | 3,200 |
| `guid` | 1,640 (often `""`) |
| `iconID` | 1,268 (often `0`) |
| `description` | 760 — **localised** (unlike `dogmaAttributes.description`) |
| `rangeAttributeID` | 245 |
| `durationAttributeID` | 224 |
| `dischargeAttributeID` | 172 |
| `distribution` | 75 (1..2) |
| `displayName` | 70 — localised |
| `falloffAttributeID` | 51 |
| `resistanceAttributeID` | 39 |
| `npcActivationChanceAttributeID` | 19 |
| `fittingUsageChanceAttributeID` | 12 |
| `npcUsageChanceAttributeID` | 7 |
| `trackingSpeedAttributeID` | 6 |

`effectCategoryID` distribution: `0`: 2,920, `1`: 145, `2`: 120, `4`: 98, `7`: 109, `5`: 20, `6`: 4, `3`: 1.
(0 = passive, 1 = active, 2 = target, 4 = area/online, 5 = system, 6 = overload, 7 = dungeon —
**UNVERIFIED**; the SDE gives no lookup table for this enum.)

**Gone vs. legacy**: `preExpression`, `postExpression`, `sfxName`, `effectCategory` (renamed to
`effectCategoryID`). No expression tree at all.

### 4.2 `modifierInfo` structure

`modifierInfo` is an array (5,152 entries across 3,200 effects). Key presence across those 5,152:

```
domain               5152   (always)
func                 5152   (always)
modifiedAttributeID  5142
modifyingAttributeID 5142
operation            5142
skillTypeID          2522   (present iff func is *RequiredSkillModifier)
groupID               798   (present iff func is LocationGroupModifier)
effectID               10   (present iff func is EffectStopper — replaces the attribute triple)
```

**`domain` enum** (7 values): `shipID` (3,587), `charID` (1,055), `itemID` (221),
`structureID` (177), `otherID` (55), `targetID` (47), `target` (10).

**`func` enum** (6 values):
`ItemModifier` (1,793), `LocationRequiredSkillModifier` (1,609), `OwnerRequiredSkillModifier` (913),
`LocationGroupModifier` (798), `LocationModifier` (29), `EffectStopper` (10).

`EffectStopper` rows are the only ones missing the attribute triple; they carry `effectID` instead:

```json
// effect 5928 "warpScrambleTargetMWDBlockActivationForEntity"
{"domain": "target", "effectID": 6441, "func": "EffectStopper"}
```

→ Model this as a nullable-columns table, or two tables. A single
`dogma_effect_modifier(effect_id, idx, domain, func, modified_attribute_id, modifying_attribute_id,
operation, skill_type_id, group_id, stopped_effect_id)` with nullables is simplest.

### 4.3 `operation` integer enum

Observed values and counts: `6`: 3,767, `0`: 649, `4`: 305, `2`: 213, `7`: 129, `5`: 55, `-1`: 18,
`3`: 5, `9`: 1, absent: 10 (the `EffectStopper` rows). **`1` never occurs.**

The SDE ships no lookup table for these. The mapping below is inferred from (a) the effect *names*,
which encode the operation in words, and (b) `dbuffCollections.operationName`, which uses the same
vocabulary as strings:

| int | name | evidence from this build |
|---|---|---|
| -1 | PreAssignment | `dbuff` has `PreAssignment`; effect 1212 `crystalMiningamountInfo2` assigns |
| 0 | PreMul | effect 146 `damageMultiplierSkillBonus`, 152 `skillBoostDamageMultiplierBonus` |
| 1 | PreDiv | **not present in build 3484357** |
| 2 | ModAdd | effect 21 `shieldCapacityBonusOnline`, 25 `capacitorCapacityBonus`; `dbuff` `ModAdd` |
| 3 | ModSub | effect 1650 `skillSiegeModuleConsumptionQuantityBonus` |
| 4 | PostMul | effect 56 `powerOutputMultiply`, 51 `modifyPowerRechargeRate`; `dbuff` `PostMul` |
| 5 | PostDiv | effect 6010 **`shipModeMaxTargetRangePostDiv`** ← name says it |
| 6 | PostPercent | effect 157 `…**PostPercent**DamageMultiplierLocation…`; `dbuff` `PostPercent` |
| 7 | PostAssignment | effect 2312 `disallowOffensiveActChar`; `dbuff` `PostAssignment` |
| 9 | ??? | **UNVERIFIED.** Exactly one occurrence: effect 132 `skillEffect`, `{domain: itemID, func: ItemModifier, modifiedAttributeID: 280 (skillLevel), modifyingAttributeID: 275 (skillPoints), operation: 9}`. Looks like a special "derive skill level from SP" op. Special-case or ignore it. |

Names for -1/0/2/3/4/7 are strongly corroborated but the *integer↔name* binding for those six comes
from cross-referencing, not from a CCP-published table — treat as high-confidence but not
first-party. 5 and 6 are self-evident from the effect names.

### 4.4 Worked examples (verbatim)

**(a) The exact effect family you asked for — `shipHybridDamageBonusCF` (effectID 754).**
Ship *bonus per skill level*, applied to everything on the ship requiring a given skill:

```json
{"_key": 754, "disallowAutoRepeat": false, "effectCategoryID": 0, "electronicChance": false, "guid": "shipHybridDamageBonusCF", "iconID": 0, "isAssistance": false, "isOffensive": false, "isWarpSafe": false, "modifierInfo": [{"domain": "shipID", "func": "LocationRequiredSkillModifier", "modifiedAttributeID": 64, "modifyingAttributeID": 463, "operation": 6, "skillTypeID": 3301}], "name": "shipHybridDamageBonusCF", "propulsionChance": false, "published": false, "rangeChance": false}
```

Read: *on the ship (`shipID`), for every item requiring skill 3301 (Small Hybrid Turret), take
attribute **463** (`shipBonusCF`, the hull's per-level bonus value) and apply it as a **percentage**
(op 6) to attribute **64** (`damageMultiplier`).* The "per level" scaling is applied by the dogma
engine from the character's level in `skillTypeID`, not stored here.

Whole family present: `shipHybridDamageBonusCF` (754), `CF2` (4941), `CBC2` (5357), `GBC2` (5359),
`GalNavyDestroyer` (11387), `CalNavyDestroyer` (11391).

**(b) A "skillBonusGunnery"-style skill bonus — effectID 290**, the Sharpshooter skill:

```json
{"_key": 290, "disallowAutoRepeat": false, "effectCategoryID": 0, "electronicChance": false, "guid": "", "iconID": 0, "isAssistance": false, "isOffensive": false, "isWarpSafe": false, "modifierInfo": [{"domain": "shipID", "func": "LocationRequiredSkillModifier", "modifiedAttributeID": 54, "modifyingAttributeID": 294, "operation": 6, "skillTypeID": 3300}], "name": "sharpshooterRangeSkillBonusPostPercentMaxRangeLocationShipModulesRequiringGunnery", "propulsionChance": false, "published": false, "rangeChance": false}
```

attr 294 `rangeSkillBonus` → PostPercent → attr 54 `maxRange`, for all ship modules requiring
skill 3300 (Gunnery). Sibling effects in the same family: 287 (Controlled Bursts, capNeed),
289 (Motion Prediction, trackingSpeed), 298 (Surgical Strike, falloff), 414 (Gunnery, speed),
581 (Weapon Upgrades, cpu), 582 (Rapid Firing, rof), 584 (Surgical Strike, damageMultiplier).

And the simplest skill-level form, `damageMultiplierSkillBonus` (146), which is `ItemModifier` on
`itemID` using attr 280 (`skillLevel`) with PreMul:

```json
{"_key": 146, "description": {"en": "Boost of damageMultiplier by PreMul of skillLevel", "de": "Boost des barrageDmgMultiplier mit PreMul des skillLevel.", "…": "…"}, "displayName": {"en": "DamageBonus", "…": "…"}, "effectCategoryID": 0, "guid": "", "iconID": 0, "modifierInfo": [{"domain": "itemID", "func": "ItemModifier", "modifiedAttributeID": 292, "modifyingAttributeID": 280, "operation": 0}], "name": "damageMultiplierSkillBonus", "published": true, "…": "…"}
```

**(c) A stacking-penalised module effect — Gyrostabilizer II (typeID 519).**
Its `typeDogma.dogmaEffects` is `[{11, false}, {16, false}, {89, false}, {92, false}]`
(11 = `loPower` slot marker, 16 = `online`). The two real modifiers:

```json
{"_key": 92, "disallowAutoRepeat": false, "effectCategoryID": 4, "electronicChance": false, "guid": "", "isAssistance": false, "isOffensive": false, "isWarpSafe": false, "modifierInfo": [{"domain": "shipID", "func": "LocationGroupModifier", "groupID": 55, "modifiedAttributeID": 64, "modifyingAttributeID": 64, "operation": 4}], "name": "projectileWeaponDamageMultiply", "propulsionChance": false, "published": false, "rangeChance": false}
```

```json
{"_key": 89, "disallowAutoRepeat": false, "effectCategoryID": 4, "electronicChance": false, "guid": "", "isAssistance": false, "isOffensive": false, "isWarpSafe": false, "modifierInfo": [{"domain": "shipID", "func": "LocationGroupModifier", "groupID": 55, "modifiedAttributeID": 51, "modifyingAttributeID": 204, "operation": 4}], "name": "projectileWeaponSpeedMultiply", "propulsionChance": false, "published": false, "rangeChance": false}
```

Effect 92: on the ship, for every item in **group 55** (Projectile Weapon), multiply (`operation: 4`
= PostMul) the target's attribute **64** by the *module's own* attribute 64 (`damageMultiplier`).
Effect 89 does the same to attr 51 (rate of fire) using attr 204 (`speedMultiplier`).

**Where the stacking penalty comes from:** attribute 64 `damageMultiplier` has **`"stackable": false`**
(see §3.4), and so does attribute 54 `maxRange`. 244 of 2,867 attributes carry `stackable: false`.
The SDE exposes *only* this flag — it does not encode the penalty curve, nor which modifier sources
are exempt. The standard client rule (penalty `exp(-(i/2.67)^2)` applied to the 2nd..nth module-
sourced modifier, with ship-hull/skill/implant bonuses exempt) is **not in the SDE** and is
**UNVERIFIED** here; you will need to encode it in your own dogma engine.

---

## 5. Sizes, counts, streaming

| Metric | Value |
|---|---|
| Zip (jsonl) | **99,058,538 B** (94.5 MiB) |
| Zip (yaml) | 101,039,549 B (96.4 MiB) |
| Uncompressed total | **578,713,918 B** (552 MiB), 102 files |
| types | **52,863** |
| groups / categories | 1,610 / 48 |
| dogmaAttributes | **2,867** (244 with `stackable: false`) |
| dogmaEffects | **3,417** (3,200 with `modifierInfo`; 5,152 modifier rows) |
| typeDogma | 26,828 type rows |
| blueprints | 5,082 |
| typeMaterials | 9,551 |
| marketGroups / metaGroups | 2,106 / 13 |
| icons / graphics | 4,658 / 6,069 |
| dogmaUnits | 60 |

**Streaming is mandatory.** Five files exceed 25 MB uncompressed:
`mapMoons` 224 MB / `types` 153 MB / `missions` 53 MB / `mapPlanets` 51 MB / `typeDogma` 27.6 MB.
`mapMoons` alone will blow a default Node heap if buffered.

Recommended pipeline (Node 24):

```
fetch(zipUrl) → write to disk (don't hold 94 MB in memory)
 → unzip a single member as a stream (yauzl / node:stream + zlib raw-inflate on the local header;
   Node's built-in fflate-style APIs do not stream zip members)
 → readline / split2 → JSON.parse per line → batch of 5–10k
 → pg COPY ... FROM STDIN (pg-copy-streams), not INSERT
```

Notes:
- `JSON.parse` per line on 52,863 type records is fine; the cost is dominated by the 8-language
  description strings. If you only need English, parse then discard — there is no way to ask CCP
  for an English-only export.
- If you only need a subset of tables, you still pay the 94 MB download (no per-file endpoint), but
  you can skip inflating `mapMoons`/`missions`/`mapPlanets` entirely — that's 327 MB of the 552 MB.
- Line lengths are bounded by ~100 KB (largest observed 99,387 B), so a fixed 256 KB line cap is safe.
- Consider `COPY` into staging tables + a transactional swap, keyed off `_sde.jsonl.buildNumber`.

---

## 6. Fallbacks & community resources

### 6.1 Fuzzwork — <https://www.fuzzwork.co.uk/dump/>

Fuzzwork now converts **from CCP's JSONL release** ("A new set is generated automatically whenever
CCP publishes a new SDE") while preserving the **legacy `invTypes` / `dgmTypeAttributes` schema
naming**. As of 2026-08-31 it tracks revision 3484357 (same build).

Stable "latest" URLs (target changes, URL doesn't):

```
https://www.fuzzwork.co.uk/dump/latest-postgres.pgdump              81.6 MB   pg_restore custom format → public schema
https://www.fuzzwork.co.uk/dump/latest-postgresschema.pgdump        81.6 MB   same, into its own named schema
https://www.fuzzwork.co.uk/dump/latest-mysql.sql.gz                 81 MB
https://www.fuzzwork.co.uk/dump/latest-sqlite.db.gz                135.8 MB
https://www.fuzzwork.co.uk/dump/latest-mssql.bak                   208.2 MB

# Change poll — a few bytes each:
https://www.fuzzwork.co.uk/dump/latest-postgres.pgdump.md5sum
# → "cde848023d7b5afcb8f9d426583ecea0  /home/web/fuzzwork/htdocs/dump/latest-postgres.pgdump"
#   (note: the path in the file is Fuzzwork's server-local path, not a URL — parse field 1 only)

# Per-table CSV for the current build:
https://www.fuzzwork.co.uk/dump/latest/csv/<table>.csv

# Build-pinned directories:
https://www.fuzzwork.co.uk/dump/<revision>_<YYYYMMDD>_<HHMMSS>/
# e.g. 3484357_20260831_102140/  3482594_20260827_134507/  3480926_20260826_134500/
```

Fuzzwork's site explicitly recommends: *"Watching for a new build? Poll the `.md5sum` link for the
format you care about instead of the full file."*

**Schema naming** — legacy `invXxx`/`dgmXxx`/`chrXxx`/`mapXxx` prefixes, 178 CSV tables. Verified headers:

```csv
# invTypes.csv  (NOTE: UTF-8 BOM on the first header cell)
"typeID","groupID","typeName","description","mass","volume","capacity","portionSize","raceID","basePrice","published","marketGroupID","iconID","soundID","graphicID","factionID","metaLevel","techLevel","shipTreeGroupID","packagedVolume","isDynamicType","isRepackable"
"0","0","#System","","1.0","0.0","0.0","1","","","0","","","","0","","","","","","",""

# dgmTypeAttributes.csv
"typeID","attributeID","valueInt","valueFloat"
"18","182","","3386.0"

# dgmEffects.csv  (legacy columns retained; preExpression/postExpression now always empty)
"effectID","effectName","effectCategory","preExpression","postExpression","description","guid","iconID","isOffensive","isAssistance","durationAttributeID","trackingSpeedAttributeID","dischargeAttributeID","rangeAttributeID","falloffAttributeID","disallowAutoRepeat","published","displayName","isWarpSafe","rangeChance","electronicChance","propulsionChance","distribution","sfxName","npcUsageChanceAttributeID","npcActivationChanceAttributeID","fittingUsageChanceAttributeID","modifierInfo"

# eveUnits.csv
"unitID","unitName","displayName","description"
"1","Length","m","Meter"

# invTraits.csv   (= typeBonus, flattened; skillID -1 = role bonus)
"traitID","typeID","skillID","bonus","bonusText","unitID"
"1","582","-1","300.0","bonus to <a href=showinfo:3422>Remote Shield Booster</a> falloff","105"

# certMasteries.csv  (= masteries, flattened)
"typeID","masteryLevel","certID"

# shipSkills.csv    (Fuzzwork-derived convenience view, not in the SDE)
"typeID","groupID","skillID","level"

# industryActivityMaterials.csv  (= blueprints.activities.*.materials, flattened)
"typeID","activityID","materialTypeID","quantity"

# trnTranslations.csv  (this is where the non-English strings go)
"tcID","keyID","languageID","text"
```

Other tables you'll care about: `invGroups`, `invCategories`, `invMarketGroups`, `invMetaGroups`,
`invMetaTypes`, `invTypeMaterials`, `invFlags`, `invVolumes`, `invUniqueNames`, `invNames`,
`invItems`, `dgmAttributeTypes`, `dgmAttributeCategories`, `dgmTypeEffects`, `certCerts`,
`certSkills`, `eveIcons`, `eveGraphics`, `industryBlueprints`, `industryActivity*`,
`typeElements`, `typeLists*`, `mapSolarSystems`, `mapDenormalize`, `mapSolarSystemJumps`.
Full listing: <https://www.fuzzwork.co.uk/dump/latest/csv/>

Trade-offs vs. importing the JSONL yourself:
- ✅ `latest-postgresschema.pgdump` is a one-command `pg_restore` into an isolated schema — by far
  the fastest path to a working Postgres 17 database.
- ✅ Keeps the legacy names your existing EVE tooling/SQL probably expects.
- ✅ Adds derived tables the SDE doesn't have (`shipSkills`, `mapDenormalize`, `mapSolarSystemJumps`,
  `invFlags`, `invVolumes`).
- ❌ Flattens localisation into a separate `trnTranslations` table (`invTypes.typeName` is English only).
- ❌ `dgmExpressions.csv` is header-only dead weight.
- ❌ Third-party dependency + a lag of hours-to-days behind CCP (2026-08-28 CCP build appeared
  2026-08-31 on Fuzzwork in this instance — a ~3-day lag).
- ⚠️ CSVs carry a **UTF-8 BOM** on the header line.

### 6.2 CCP's own community-resources doc

<https://developers.eveonline.com/docs/community/> — the SDE docs page points here for
"community-provided schemas and alternative formats". Relevant entries: *Fuzzwork Enterprises SDE
Conversion*, *Garveen's SDE Conversion* (<https://github.com/Garveen>), *SDE REST API*,
*EVE Ref*, *EVE Online SDE Documentation*.

### 6.3 sde.riftforeve.online — the most useful thing I found

<https://sde.riftforeve.online/> (Nohus, repo `Nohus/sde-docs`; unofficial, not CCP).
Per-file **generated schema documentation** for all 102 JSONL files, e.g.
<https://sde.riftforeve.online/schema/dogmaEffects/>, `/schema/types/`, `/schema/typeDogma/`.

Each page gives required/optional per field, value ranges, enum members, **and code snippets in
C#, Go, JSON Schema, Kotlin, PHP, Python and TypeScript** (quicktype-generated). For a TS importer
this is a near-free set of interfaces. Its `dogmaEffects` page independently confirms my
`domain`/`func` enum extraction and the `operation` range (-1..9).

It also publishes an **Enhanced SDE** — the official files plus:
`types.repackagedVolume` (courtesy of Hoboleaks), and `name` added to `mapStars`, `mapPlanets`,
`mapMoons`, `mapAsteroidBelts`, `mapStargates`, `npcStations` (the official files have no names for
these, since `bsd/invNames` was dropped — see §2.4).

```
https://sde.riftforeve.online/assets/eve-online-static-data-latest-enhanced-jsonl.zip
https://sde.riftforeve.online/assets/eve-online-static-data-3484357-enhanced-jsonl.zip
```

⚠️ If you need celestial names, this (or Fuzzwork's `invNames`/`mapDenormalize`) is currently the
only route — CCP's own SDE no longer has them.

### 6.4 EVE Ref

<https://docs.everef.net/datasets/sde.html> — archives every historical SDE build
(`ccp/sde/`), including the pre-2025 `sde-YYYYMMDD-TRANQUILITY.zip` format and an `older/` folder.
Useful for reproducible builds / regression tests against an old build.

### 6.5 Community discussion

The blog post directs Q&A to the EVE Online Discord (<https://eveonline.com/discord>) rather than a
forum thread. I did **not** find a substantive eve-o forums or Tweetfleet thread on the new format —
the discussion appears to have happened on Discord, which I can't read. Treat "known community
gotchas" as **UNVERIFIED beyond what I derived from the data itself**.

---

## 7. Licence & User-Agent

### 7.1 Licence

The SDE is **not** open data. It is "Game Data" under the **CCP Developer License Agreement**
(<https://developers.eveonline.com/license-agreement>), which you accept by downloading:

> *"IF YOU DOWNLOAD, ACCESS, OR OTHERWISE USE ANY OF THE LICENSED MATERIALS, THEN YOU ARE
> ACKNOWLEDGING AND ACCEPTING THE TERMS OF THIS AGREEMENT."*

Grant:

> *"CCP grants Developer a limited, non-exclusive, worldwide, non-transferrable license and right
> during the Term to: (a) use, display, and distribute the Game Data within an Application used for
> the Purpose; (b) use the CCP Tools to access the Game Data solely for the Purpose; and (c) use and
> display the CCP Marks but only as necessary to exercise the rights under Sections (a) and (b), or
> to comply with the proprietary notice obligations under Section 7.1."*

"Purpose" is the binding constraint:

> *"…only where the Application is used solely to enhance Player's enjoyment of EVE and only where
> the Application is offered for **non-commercial and non-profit** use… The Purpose explicitly
> excludes (a) any use of the Licensed Materials or CCP Marks for any Application that is not used
> to support a Player's use of EVE …, and (b) any Application that promotes or provides online
> gambling, betting, raffles, lotteries, sweepstakes, or similar activities."*

Practical implications for this project:
- Redistribution of the SDE data **inside your app** is licensed; standalone redistribution as a
  dataset is not clearly covered — Fuzzwork/EVE Ref do it in practice, but that's tolerance, not a grant.
- **Non-commercial / non-profit only.** If Plasma is or becomes commercial, this is a blocker.
- CCP "has the right to add or remove items from the definition of the Licensed Materials at any time."
- Section 7.1 imposes proprietary-notice obligations — include the standard footer, e.g.
  *"EVE Online and the EVE logo are the registered trademarks of CCP hf. All rights reserved.
  … All artwork, screenshots, characters, vehicles, storylines, world facts or other recognizable
  features of the intellectual property relating to these trademarks are likewise the intellectual
  property of CCP hf."*

### 7.2 User-Agent

There is **no SDE-specific** User-Agent requirement in the static-data docs. CCP's published
guidance is the ESI one (<https://developers.eveonline.com/docs/services/esi/best-practices/>) and
it is worth honouring on SDE fetches too — the S3/CloudFront endpoint served my requests either way,
but identifying yourself is cheap insurance:

> *"All ESI requests **should** contain User Agent information indicating the application making the
> request… The User Agent information you send should contain one or more of the following: An Email
> Address (**Strongly Preferred**); App Name with version (**Strongly Preferred**); A URL to Source
> Code; A Discord Username; An EVE Character."*
>
> *"Not abiding to the information transmitted can lead to your app being **banned**, for various
> time, from accessing the resources."*

Format, narrow→broad, per CCP's own examples:

```
User-Agent: PlasmaSDEImporter/0.1.0 (you@example.com; +https://github.com/<you>/<repo>)
```

Browser contexts should use `X-User-Agent`, or the `user_agent` query parameter if headers are
unavailable. There is no documented rate limit on the static-data host; the only rate guidance is
"all non-static files are cached for 5 minutes", so polling `latest.jsonl` more often than every
5 minutes is pointless.

---

## 8. Things I could not verify

- **`operation` integer→name binding** for -1/0/2/3/4/7 is inferred (§4.3); CCP publishes no table.
  `operation: 1` (PreDiv) does not occur in build 3484357. `operation: 9` appears exactly once and
  its meaning is unknown.
- **`effectCategoryID` enum meanings** (0..7) — no lookup in the SDE.
- **Stacking-penalty rule.** The SDE gives only `dogmaAttributes.stackable`. The penalty curve and
  the exemption rules (ship bonuses / skills / implants exempt) are client behaviour, not data.
- **`typeElements.jsonl` semantics** — structure is clear (`typeID → {elementID: value}`), purpose is not.
- **`_key` type per file beyond the first 200 records.** I sampled 200 records/file for key typing;
  the five string-keyed files are certain, but a file that switches key type mid-stream would have
  escaped me (very unlikely).
- **Worst-case size of `changes/<build>.jsonl`** on a large patch day.
- **Exact row counts for the flattened `typeDogma` children** (I counted parent rows, not array elements).
- **Community gotchas** — discussion moved to Discord; no accessible forum thread found.
- `https://developers.eveonline.com/docs/services/sde/` (the URL in the brief, and the one Fuzzwork
  still links) **404s** — the live path is `/docs/services/static-data/`.

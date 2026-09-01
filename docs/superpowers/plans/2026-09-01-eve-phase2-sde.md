# EVE Phase 2 (SDE Import) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Import CCP's Static Data Export (items, groups, categories, dogma attributes/effects with modifier info, market groups, ship traits, and the region/constellation/solar-system/NPC-station map) into `sde_*` tables the app owns, keep them current from the worker, and expose them through a small typed lookup library.

**Architecture:** `src/lib/sde/` is a pipeline of pure functions with injected I/O: `version.ts` polls the build pointer, `download.ts` streams the ~95 MB zip to disk, `jsonl.ts` streams one zip member as parsed JSON records, `tables.ts` declares one mapper per target table, and `import.ts` loads everything into a `sde_import` staging schema and swaps it into `public` in a single transaction. `repo.ts` is the only read API later phases use. A new global (character-less) scheduler scope lets the worker run `sde-update` every 6 h.

**Tech Stack:** TypeScript 5.9 strict + ESM (local imports carry the `.js` extension), Node 24, `pg` 8, `yauzl` 3 (streaming zip reads), `node:readline`, `node:zlib` (fixture zip writing), Postgres 17, vitest 4 (+ happy-dom for the settings card), Next.js 16 server components, tsx for CLI scripts.

**Spec:** `docs/superpowers/specs/2026-09-01-eve-phase2-sde-design.md`

**Research (source format, verbatim records):** `.superpowers/research/sde-format.md`

## Global Constraints

- **English only.** Every localised SDE field (`{de,en,es,fr,ja,ko,ru,zh}`) is stored as its `en` value; a missing `en` becomes `null`.
- **Absent ≠ null in the source.** Optional SDE fields are *omitted* from the record, never null. Every mapper must default, not destructure.
- **One DDL source:** `src/lib/sde/ddl.ts` exporting `sdeDdl(schema: string): string[]`. `db/schema.sql` contains **no** `sde_` tables. `scripts/migrate.ts` applies `db/schema.sql` then `sdeDdl("public")`. The importer uses `sdeDdl("sde_import")` for staging so live and staging shapes cannot drift. `sde_meta` is emitted **only** for schema `public`.
- **No foreign keys** from character/sync tables to `sde_*` tables, and none between `sde_*` tables. Reference data is swapped wholesale; joins happen at read time.
- Column names are snake_case of the SDE field names. All `sde_*` tables live in `public`.
- **Streaming is mandatory.** `types.jsonl` (153 MB uncompressed) and `typeDogma.jsonl` (28 MB) must never be buffered. Batch inserts are 2 000 rows via `INSERT … SELECT FROM unnest($1::int[], …)`.
- **Skipped SDE files:** icons/graphics, blueprints, typeMaterials, masteries, certificates, skillPlans, planets/moons/stargates, everything not in the 16-member import list.
- **New dependencies: `yauzl` and `@types/yauzl` only.** Nothing else.
- Imports between local TS files use the `.js` extension. `npm run typecheck` (`tsc --noEmit`) covers `tests/**` too and must stay clean.
- Tests live in `tests/**` mirroring `src/**`. `npm test` = `vitest run` with `fileParallelism: false`. DB tests use `tests/db/helpers.ts` (`resetDb`) against `eve_test` on the local compose Postgres (`postgres://eve:eve@127.0.0.1:5432/eve_test`; start it with `docker compose -f compose.dev.yml up -d`).
- Never inline colours in components — use the CSS variables and the existing classes in `src/app/globals.css` (`card`, `card-title`, `table`, `muted`, `faint`, `badge`).
- Work happens on branch `feature/phase2-sde`. **Every task ends with a commit.** Commit trailer: `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- The full real archive `.superpowers/research/sde-3484357.zip` (build 3484357, released 2026-08-28) is git-ignored and is the only input to the fixture generator. `unzip` is not installed; use Node or `python3 -c "import zipfile…"` to inspect it.
- VM: `ssh daniel@10.5.5.150`, site `https://eve.plasma66.com`, Ansible in `deploy/ansible`.

## File Structure

| Path | Responsibility |
|---|---|
| `src/lib/sde/ddl.ts` | The single source of `sde_*` DDL; `sdeDdl(schema)`, `SDE_TABLES` |
| `src/lib/sde/jsonl.ts` | `readJsonlMember(zipPath, member)` — streams one zip member as parsed records |
| `src/lib/sde/tables.ts` | One declarative `SdeTable` per target table + the `en`/`int`/`num`/`bool`/`str` field helpers |
| `src/lib/sde/import.ts` | `importSde(zipPath, pool, log)` — staging schema, batched inserts, transactional swap |
| `src/lib/sde/repo.ts` | Read API for later phases and the settings card |
| `src/lib/sde/version.ts` | `fetchLatestBuild(fetchImpl)` — the build pointer poll |
| `src/lib/sde/download.ts` | `downloadSde(destPath, fetchImpl)` — streams the zip to disk |
| `scripts/lib/zip.ts` | `writeZip(destPath, members)` — minimal deflate zip writer (fixture generation + tests) |
| `scripts/sde-import.ts` | `npm run sde:import [-- --file <zip>]` |
| `scripts/sde-fixture.ts` | `npm run sde:fixture -- <full.zip>` → `tests/fixtures/sde-mini.zip` (allow-list lives here) |
| `scripts/migrate.ts` | Modified: applies `db/schema.sql` then `sdeDdl("public")` |
| `src/worker/scheduler.ts` | Modified: `SyncJob` gains `scope`; global jobs run without characters |
| `src/worker/index.ts` | Modified: registers `sdeUpdateJob` |
| `src/worker/jobs/sde-update.ts` | Global job `sde-update`, every 6 h, dependency-injected |
| `src/app/settings/StaticDataPanel.tsx` | Server-rendered **Static data** card |
| `src/app/settings/page.tsx` | Modified: loads `getSdeMeta()` and renders the card |
| `tests/fixtures/sde-mini.zip` | Committed ~0.86 MB fixture generated from the real archive |
| `tests/sde/fixture.ts` | Shared `FIXTURE_ZIP` path + `fixtureRecord()` helper |
| `tests/sde/{jsonl,tables,fixture,version,download}.test.ts` | Unit tests |
| `tests/db/{sde-import,sde-repo}.test.ts` | Real-Postgres tests |
| `tests/worker/sde-update.test.ts` | Job unit test with fakes |
| `tests/components/static-data-panel.test.tsx` | happy-dom component test |
| `tests/db/helpers.ts` | Modified: adds `resetSde(pool)` |
| `tests/db/schema.test.ts` | Modified: expects the `sde_*` tables |

---

### Task 1: Branch, dependencies, `sde_*` DDL, migrate wiring

**Files:**
- Create: `src/lib/sde/ddl.ts`
- Modify: `package.json` (deps + two scripts), `scripts/migrate.ts`, `tests/db/helpers.ts`, `tests/db/schema.test.ts`

**Interfaces:**
- Consumes: phase-1 `applySchema(pool: Pool): Promise<void>` in `scripts/migrate.ts`, `getPool()`/`closePool()` in `src/lib/db/client.ts`, `resetDb(): Promise<Pool>` in `tests/db/helpers.ts`.
- Produces:
```ts
// src/lib/sde/ddl.ts
export const SDE_TABLES: readonly SdeTableName[]          // 17 data tables, swap order
export type SdeTableName =
  | "sde_categories" | "sde_groups" | "sde_types" | "sde_market_groups" | "sde_meta_groups"
  | "sde_dogma_units" | "sde_dogma_attribute_categories" | "sde_dogma_attributes"
  | "sde_dogma_effects" | "sde_dogma_effect_modifiers" | "sde_type_attributes"
  | "sde_type_effects" | "sde_type_bonuses" | "sde_regions" | "sde_constellations"
  | "sde_solar_systems" | "sde_stations";
export function sdeDdl(schema: string): string[]           // idempotent CREATE TABLE/INDEX IF NOT EXISTS
// tests/db/helpers.ts
export function resetSde(pool: Pool): Promise<void>        // drops sde_import + every sde_ table, recreates them empty
```

- [ ] **Step 1: Create the branch and install the dependencies**

```bash
cd /home/daniel/AI/Plasma/EVE
git checkout -b feature/phase2-sde
npm install yauzl@^3.4.0
npm install -D @types/yauzl@^3.4.0
docker compose -f compose.dev.yml up -d
```
Expected: `package.json` gains `"yauzl": "^3.4.0"` under `dependencies` and `"@types/yauzl": "^3.4.0"` under `devDependencies`; the `eve-dev-postgres` container is running.

- [ ] **Step 2: Add the two npm scripts**

In `package.json`, inside `"scripts"`, after `"migrate": "tsx scripts/migrate.ts",` add:
```json
    "sde:import": "tsx scripts/sde-import.ts",
    "sde:fixture": "tsx scripts/sde-fixture.ts",
```

- [ ] **Step 3: Update the failing schema test**

Replace the first test in `tests/db/schema.test.ts` (`it("is idempotent", …)`) with this, and add the third test. The file becomes:

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { resetDb } from "./helpers.js";
import { applySchema } from "../../scripts/migrate.js";
import { closePool } from "../../src/lib/db/client.js";
import type { Pool } from "pg";

let pool: Pool;
beforeAll(async () => { pool = await resetDb(); }, 60_000);
afterAll(closePool);

describe("schema", () => {
  it("is idempotent and creates the phase-1 and sde tables", async () => {
    await applySchema(pool);
    const { rows } = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY 1");
    expect(rows.map((r) => r.table_name)).toEqual([
      "accounts", "characters", "esi_cache",
      "sde_categories", "sde_constellations", "sde_dogma_attribute_categories", "sde_dogma_attributes",
      "sde_dogma_effect_modifiers", "sde_dogma_effects", "sde_dogma_units", "sde_groups",
      "sde_market_groups", "sde_meta", "sde_meta_groups", "sde_regions", "sde_solar_systems",
      "sde_stations", "sde_type_attributes", "sde_type_bonuses", "sde_type_effects", "sde_types",
      "sync_runs",
    ]);
  });
  it("rejects an unknown token_status", async () => {
    await expect(pool.query("INSERT INTO characters (id, name, refresh_token_enc, token_status) VALUES (1, 'x', 'e', 'bogus')")).rejects.toThrow(/check/i);
  });
  it("constrains sde_meta to a single row and sde_type_bonuses.kind to the three kinds", async () => {
    await expect(pool.query("INSERT INTO sde_meta (id, build_number, release_date) VALUES (2, 1, now())")).rejects.toThrow(/check/i);
    await expect(pool.query("INSERT INTO sde_type_bonuses (type_id, idx, kind) VALUES (1, 0, 'bogus')")).rejects.toThrow(/check/i);
  });
});
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `npx vitest run tests/db/schema.test.ts`
Expected: FAIL — the table list only contains the four phase-1 tables and `sde_meta` does not exist.

- [ ] **Step 5: Write `src/lib/sde/ddl.ts`**

```ts
/**
 * The single source of truth for the sde_* DDL.
 *
 * `scripts/migrate.ts` applies sdeDdl("public"); the importer applies sdeDdl("sde_import") to
 * build a staging copy, so the live and staging shapes cannot drift. `sde_meta` is emitted only
 * for `public` — the staging schema never holds provenance.
 *
 * There are deliberately no foreign keys: reference data is swapped wholesale on import.
 */

export const SDE_TABLES = [
  "sde_categories",
  "sde_groups",
  "sde_types",
  "sde_market_groups",
  "sde_meta_groups",
  "sde_dogma_units",
  "sde_dogma_attribute_categories",
  "sde_dogma_attributes",
  "sde_dogma_effects",
  "sde_dogma_effect_modifiers",
  "sde_type_attributes",
  "sde_type_effects",
  "sde_type_bonuses",
  "sde_regions",
  "sde_constellations",
  "sde_solar_systems",
  "sde_stations",
] as const;

export type SdeTableName = (typeof SDE_TABLES)[number];

const TABLE_BODIES: Record<SdeTableName, string> = {
  sde_categories: `
    id        int PRIMARY KEY,
    name      text,
    published boolean,
    icon_id   int`,
  sde_groups: `
    id                     int PRIMARY KEY,
    category_id            int,
    name                   text,
    published              boolean,
    icon_id                int,
    anchorable             boolean,
    anchored               boolean,
    fittable_non_singleton boolean,
    use_base_price         boolean`,
  sde_types: `
    id                        int PRIMARY KEY,
    group_id                  int,
    name                      text,
    description               text,
    published                 boolean,
    market_group_id           int,
    meta_group_id             int,
    meta_level                int,
    tech_level                int,
    race_id                   int,
    faction_id                int,
    icon_id                   int,
    graphic_id                int,
    mass                      float8,
    volume                    float8,
    packaged_volume           float8,
    capacity                  float8,
    radius                    float8,
    base_price                float8,
    portion_size              int,
    variation_parent_type_id  int`,
  sde_market_groups: `
    id          int PRIMARY KEY,
    parent_id   int,
    name        text,
    description text,
    has_types   boolean,
    icon_id     int`,
  sde_meta_groups: `
    id          int PRIMARY KEY,
    name        text,
    icon_suffix text`,
  sde_dogma_units: `
    id           int PRIMARY KEY,
    name         text,
    display_name text,
    description  text`,
  sde_dogma_attribute_categories: `
    id          int PRIMARY KEY,
    name        text,
    description text`,
  sde_dogma_attributes: `
    id                int PRIMARY KEY,
    name              text,
    display_name      text,
    description       text,
    category_id       int,
    unit_id           int,
    data_type         int,
    default_value     float8,
    high_is_good      boolean,
    stackable         boolean,
    published         boolean,
    display_when_zero boolean,
    icon_id           int`,
  sde_dogma_effects: `
    id                                 int PRIMARY KEY,
    name                               text,
    display_name                       text,
    description                        text,
    effect_category_id                 int,
    is_offensive                       boolean,
    is_assistance                      boolean,
    is_warp_safe                       boolean,
    disallow_auto_repeat               boolean,
    published                          boolean,
    duration_attribute_id              int,
    discharge_attribute_id             int,
    range_attribute_id                 int,
    falloff_attribute_id               int,
    tracking_speed_attribute_id        int,
    resistance_attribute_id            int,
    fitting_usage_chance_attribute_id  int`,
  sde_dogma_effect_modifiers: `
    effect_id              int NOT NULL,
    idx                    int NOT NULL,
    domain                 text,
    func                   text,
    modified_attribute_id  int,
    modifying_attribute_id int,
    operation              int,
    skill_type_id          int,
    group_id               int,
    stopped_effect_id      int,
    PRIMARY KEY (effect_id, idx)`,
  sde_type_attributes: `
    type_id      int NOT NULL,
    attribute_id int NOT NULL,
    value        float8,
    PRIMARY KEY (type_id, attribute_id)`,
  sde_type_effects: `
    type_id    int NOT NULL,
    effect_id  int NOT NULL,
    is_default boolean,
    PRIMARY KEY (type_id, effect_id)`,
  sde_type_bonuses: `
    type_id       int NOT NULL,
    idx           int NOT NULL,
    kind          text CHECK (kind IN ('skill', 'role', 'misc')),
    skill_type_id int,
    importance    int,
    bonus         float8,
    bonus_text    text,
    unit_id       int,
    PRIMARY KEY (type_id, idx)`,
  sde_regions: `
    id   int PRIMARY KEY,
    name text`,
  sde_constellations: `
    id        int PRIMARY KEY,
    region_id int,
    name      text`,
  sde_solar_systems: `
    id               int PRIMARY KEY,
    constellation_id int,
    region_id        int,
    name             text,
    security_status  float8,
    security_class   text`,
  sde_stations: `
    id             int PRIMARY KEY,
    solar_system_id int,
    type_id        int,
    owner_id       int,
    operation_id   int`,
};

const INDEXES: { name: string; table: SdeTableName; expr: string }[] = [
  { name: "sde_types_group_idx", table: "sde_types", expr: "(group_id)" },
  { name: "sde_types_market_group_idx", table: "sde_types", expr: "(market_group_id)" },
  { name: "sde_types_name_lower_idx", table: "sde_types", expr: "(lower(name))" },
  { name: "sde_groups_category_idx", table: "sde_groups", expr: "(category_id)" },
  { name: "sde_type_attributes_attribute_idx", table: "sde_type_attributes", expr: "(attribute_id)" },
  { name: "sde_solar_systems_region_idx", table: "sde_solar_systems", expr: "(region_id)" },
  { name: "sde_stations_system_idx", table: "sde_stations", expr: "(solar_system_id)" },
];

const META_DDL = `CREATE TABLE IF NOT EXISTS public.sde_meta (
    id           int PRIMARY KEY CHECK (id = 1),
    build_number int NOT NULL,
    release_date timestamptz NOT NULL,
    imported_at  timestamptz NOT NULL DEFAULT now()
  )`;

/**
 * Idempotent DDL for the sde_* tables in `schema`. Index names are unqualified because a
 * Postgres index always lives in its table's schema, and they travel with the table on
 * `ALTER TABLE … SET SCHEMA` — which is exactly what the importer's swap relies on.
 */
export function sdeDdl(schema: string): string[] {
  const out: string[] = [];
  if (schema === "public") out.push(META_DDL);
  for (const table of SDE_TABLES) {
    out.push(`CREATE TABLE IF NOT EXISTS ${schema}.${table} (${TABLE_BODIES[table]}\n  )`);
  }
  for (const idx of INDEXES) {
    out.push(`CREATE INDEX IF NOT EXISTS ${idx.name} ON ${schema}.${idx.table} ${idx.expr}`);
  }
  return out;
}
```

- [ ] **Step 6: Wire `scripts/migrate.ts` to apply the SDE DDL**

Replace the whole of `scripts/migrate.ts` with:

```ts
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import type { Pool } from "pg";
import { getPool } from "../src/lib/db/client.js";
import { sdeDdl } from "../src/lib/sde/ddl.js";

const here = path.dirname(fileURLToPath(import.meta.url));
export const schemaPath = path.join(here, "..", "db", "schema.sql");

export async function applySchema(pool: Pool): Promise<void> {
  await pool.query(await readFile(schemaPath, "utf8"));
  for (const stmt of sdeDdl("public")) await pool.query(stmt);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const pool = getPool();
  applySchema(pool)
    .then(() => console.log("schema applied"))
    .catch((e) => { console.error(e); process.exit(1); })
    .finally(() => pool.end());
}
```

- [ ] **Step 7: Add `resetSde` to `tests/db/helpers.ts`**

Replace the whole of `tests/db/helpers.ts` with:

```ts
import type { Pool } from "pg";
import { getPool, closePool } from "../../src/lib/db/client.js";
import { applySchema } from "../../scripts/migrate.js";
import { sdeDdl, SDE_TABLES } from "../../src/lib/sde/ddl.js";

export const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL ?? "postgres://eve:eve@127.0.0.1:5432/eve_test";

/** Points DATABASE_URL at eve_test, applies the schema, truncates every phase-1 table. */
export async function resetDb(): Promise<Pool> {
  await closePool();
  process.env.DATABASE_URL = TEST_DATABASE_URL;
  const pool = getPool();
  await applySchema(pool);
  await pool.query("TRUNCATE sync_runs, esi_cache, characters, accounts RESTART IDENTITY CASCADE");
  return pool;
}

/** Drops the staging schema and every sde_* table, then recreates them empty. */
export async function resetSde(pool: Pool): Promise<void> {
  await pool.query("DROP SCHEMA IF EXISTS sde_import CASCADE");
  for (const table of SDE_TABLES) await pool.query(`DROP TABLE IF EXISTS public.${table} CASCADE`);
  for (const stmt of sdeDdl("public")) await pool.query(stmt);
  await pool.query("DELETE FROM sde_meta");
}
```

- [ ] **Step 8: Run**

Run: `npx vitest run tests/db && npm run typecheck`
Expected: PASS — the schema test lists 22 tables, both CHECK constraints reject, and the phase-1 repo tests still pass.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOM'
Add sde_* DDL as a single source and apply it from migrate

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOM
)"
```

---

### Task 2: Zip writer helper and JSONL member streaming

**Files:**
- Create: `scripts/lib/zip.ts`, `src/lib/sde/jsonl.ts`, `tests/sde/jsonl.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces:
```ts
// scripts/lib/zip.ts
export interface ZipMember { name: string; content: string }
export function writeZip(destPath: string, members: ZipMember[]): Promise<void>   // deflate, method 8

// src/lib/sde/jsonl.ts
export function readJsonlMember(zipPath: string, memberName: string): AsyncGenerator<Record<string, unknown>>
```

**Why a hand-written zip writer:** `yauzl` only *reads* zips, and the spec allows no dependency
beyond `yauzl`. `scripts/sde-fixture.ts` (Task 3) and this task's test both need to *write* one, so
`scripts/lib/zip.ts` emits a minimal, spec-compliant zip using `node:zlib`'s `deflateRawSync`
(compression method 8) plus a CRC-32 table. Verified readable by both `yauzl` and Python's `zipfile`.

- [ ] **Step 1: Write the failing test**

`tests/sde/jsonl.test.ts`:
```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { writeZip } from "../../scripts/lib/zip.js";
import { readJsonlMember } from "../../src/lib/sde/jsonl.js";

let dir: string;
let zipPath: string;

beforeAll(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), "eve-jsonl-"));
  zipPath = path.join(dir, "mini.zip");
  await writeZip(zipPath, [
    { name: "_sde.jsonl", content: '{"_key":"sde","buildNumber":3484357,"releaseDate":"2026-08-28T11:07:12Z"}\n' },
    // blank line in the middle, non-ASCII payload, trailing newline
    { name: "types.jsonl", content: '{"_key":587,"name":{"en":"Rifter","ja":"リフター"}}\n\n{"_key":519,"name":{"en":"Gyrostabilizer II"}}\n' },
    { name: "big.jsonl", content: Array.from({ length: 5000 }, (_, i) => `{"_key":${i}}`).join("\n") + "\n" },
  ]);
});
afterAll(async () => { await rm(dir, { recursive: true, force: true }); });

async function collect(member: string): Promise<Record<string, unknown>[]> {
  const out: Record<string, unknown>[] = [];
  for await (const r of readJsonlMember(zipPath, member)) out.push(r);
  return out;
}

describe("readJsonlMember", () => {
  it("streams parsed records, skipping blank lines", async () => {
    const rows = await collect("types.jsonl");
    expect(rows).toEqual([
      { _key: 587, name: { en: "Rifter", ja: "リフター" } },
      { _key: 519, name: { en: "Gyrostabilizer II" } },
    ]);
  });

  it("reads a member with a string _key", async () => {
    expect(await collect("_sde.jsonl")).toEqual([{ _key: "sde", buildNumber: 3484357, releaseDate: "2026-08-28T11:07:12Z" }]);
  });

  it("streams a large member without buffering it", async () => {
    let n = 0;
    let last = -1;
    for await (const r of readJsonlMember(zipPath, "big.jsonl")) { n++; last = r._key as number; }
    expect(n).toBe(5000);
    expect(last).toBe(4999);
  });

  it("supports early break without leaking the zip handle", async () => {
    const seen: unknown[] = [];
    for await (const r of readJsonlMember(zipPath, "big.jsonl")) { seen.push(r._key); if (seen.length === 3) break; }
    expect(seen).toEqual([0, 1, 2]);
    // a second full read still works, proving the first iteration released its handle
    expect((await collect("types.jsonl")).length).toBe(2);
  });

  it("throws when the member is missing", async () => {
    await expect(collect("nope.jsonl")).rejects.toThrow(/zip member not found: nope\.jsonl/);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/sde/jsonl.test.ts`
Expected: FAIL — `Failed to resolve import "../../scripts/lib/zip.js"`.

- [ ] **Step 3: Write `scripts/lib/zip.ts`**

```ts
import { deflateRawSync } from "node:zlib";
import { writeFile } from "node:fs/promises";

export interface ZipMember { name: string; content: string }

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/**
 * Writes a minimal PKZIP archive (one deflated entry per member, no zip64, no data descriptors).
 * yauzl reads it. We hand-roll it because yauzl is read-only and no zip *writer* dependency is
 * allowed; `deflateRawSync` produces exactly the raw deflate stream compression method 8 wants.
 */
export async function writeZip(destPath: string, members: ZipMember[]): Promise<void> {
  const local: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;

  for (const member of members) {
    const name = Buffer.from(member.name, "utf8");
    const raw = Buffer.from(member.content, "utf8");
    const deflated = deflateRawSync(raw, { level: 9 });
    const crc = crc32(raw);

    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50, 0);   // local file header signature
    header.writeUInt16LE(20, 4);           // version needed to extract (2.0)
    header.writeUInt16LE(0x0800, 6);       // general purpose flag: UTF-8 names
    header.writeUInt16LE(8, 8);            // compression method: deflate
    header.writeUInt16LE(0, 10);           // mod time
    header.writeUInt16LE(0, 12);           // mod date
    header.writeUInt32LE(crc, 14);
    header.writeUInt32LE(deflated.length, 18);
    header.writeUInt32LE(raw.length, 22);
    header.writeUInt16LE(name.length, 26);
    header.writeUInt16LE(0, 28);           // extra field length
    local.push(header, name, deflated);

    const dir = Buffer.alloc(46);
    dir.writeUInt32LE(0x02014b50, 0);      // central directory signature
    dir.writeUInt16LE(20, 4);              // version made by
    dir.writeUInt16LE(20, 6);              // version needed
    dir.writeUInt16LE(0x0800, 8);          // general purpose flag
    dir.writeUInt16LE(8, 10);              // compression method
    dir.writeUInt16LE(0, 12);              // mod time
    dir.writeUInt16LE(0, 14);              // mod date
    dir.writeUInt32LE(crc, 16);
    dir.writeUInt32LE(deflated.length, 20);
    dir.writeUInt32LE(raw.length, 24);
    dir.writeUInt16LE(name.length, 28);
    dir.writeUInt32LE(offset, 42);         // relative offset of local header
    central.push(dir, name);

    offset += header.length + name.length + deflated.length;
  }

  const centralBuf = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);        // end of central directory signature
  end.writeUInt16LE(members.length, 8);
  end.writeUInt16LE(members.length, 10);
  end.writeUInt32LE(centralBuf.length, 12);
  end.writeUInt32LE(offset, 16);

  await writeFile(destPath, Buffer.concat([...local, centralBuf, end]));
}
```

- [ ] **Step 4: Write `src/lib/sde/jsonl.ts`**

```ts
import { openPromise, type Entry, type ZipFile } from "yauzl";
import { createInterface } from "node:readline";

/**
 * Streams one member of a zip as parsed JSON records, one per line.
 *
 * `lazyEntries` means yauzl only reads the central directory entries we ask for, and
 * `openReadStreamPromise` inflates the member on demand — a 153 MB `types.jsonl` costs ~7 MB of
 * heap. Blank lines are skipped (the SDE ends every file with a newline).
 * Throws if the member does not exist, so a truncated archive fails before any data is swapped.
 */
export async function* readJsonlMember(zipPath: string, memberName: string): AsyncGenerator<Record<string, unknown>> {
  const zip = await openPromise(zipPath, { lazyEntries: true, autoClose: false });
  try {
    const entry = await findEntry(zip, memberName, zipPath);
    const stream = await zip.openReadStreamPromise(entry);
    const lines = createInterface({ input: stream, crlfDelay: Infinity });
    try {
      for await (const line of lines) {
        if (line.trim() === "") continue;
        yield JSON.parse(line) as Record<string, unknown>;
      }
    } finally {
      lines.close();
      stream.destroy();
    }
  } finally {
    zip.close();
  }
}

function findEntry(zip: ZipFile, memberName: string, zipPath: string): Promise<Entry> {
  return new Promise((resolve, reject) => {
    const cleanup = (): void => {
      zip.removeListener("entry", onEntry);
      zip.removeListener("end", onEnd);
      zip.removeListener("error", onError);
    };
    const onEntry = (entry: Entry): void => {
      if (entry.fileName === memberName) { cleanup(); resolve(entry); } else { zip.readEntry(); }
    };
    const onEnd = (): void => { cleanup(); reject(new Error(`zip member not found: ${memberName} in ${zipPath}`)); };
    const onError = (err: Error): void => { cleanup(); reject(err); };
    zip.on("entry", onEntry);
    zip.on("end", onEnd);
    zip.on("error", onError);
    zip.readEntry();
  });
}
```

- [ ] **Step 5: Run**

Run: `npx vitest run tests/sde/jsonl.test.ts && npm run typecheck`
Expected: PASS (5 tests), typecheck clean.

- [ ] **Step 6: Sanity-check against the real 95 MB archive**

Run:
```bash
npx tsx -e "import { readJsonlMember } from './src/lib/sde/jsonl.js'; let n = 0; for await (const r of readJsonlMember('.superpowers/research/sde-3484357.zip', 'types.jsonl')) n++; console.log('types', n, 'heapMB', Math.round(process.memoryUsage().heapUsed / 1e6));"
```
Expected: `types 52863 heapMB` under 60 — proof that nothing buffers the member.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOM'
Add streaming JSONL zip-member reader and a minimal zip writer

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOM
)"
```

---

### Task 3: Fixture generator and the committed `tests/fixtures/sde-mini.zip`

**Files:**
- Create: `scripts/sde-fixture.ts`, `tests/fixtures/sde-mini.zip` (generated, committed), `tests/sde/fixture.ts`, `tests/sde/fixture.test.ts`

**Interfaces:**
- Consumes: Task 2 `readJsonlMember(zipPath, memberName)`, `writeZip(destPath, members)`, `ZipMember`.
- Produces:
```ts
// tests/sde/fixture.ts
export const FIXTURE_ZIP: string                                                   // absolute path to tests/fixtures/sde-mini.zip
export function fixtureRecord(member: string, key: number | string): Promise<Record<string, unknown>>
export function fixtureCount(member: string): Promise<number>
```

**The allow-list is the script's contract.** It is written out in full in Step 2 and must not be
guessed at elsewhere: types `587` (Rifter), `519` (Gyrostabilizer II), `3300` (Gunnery), `3301`
(Small Hybrid Turret), `3302` (Small Projectile Turret), `3329` (Minmatar Frigate), `3413` (Power
Grid Management), `3426` (CPU Management), `34` (Tritanium), `52678` (Jita Trade Hub, the station
type); their `typeDogma` and `typeBonus` rows; every effect those types reference **plus** effects
`754, 290, 146, 92, 89, 5928`; constellation `20000020` (Kimotoro) and its seven solar systems;
every station whose `solarSystemID` is `30000142` (Jita). Nine small members are copied whole.

- [ ] **Step 1: Write the failing test**

`tests/sde/fixture.ts` (shared helper, not a test file — vitest only collects `*.test.*`):
```ts
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readJsonlMember } from "../../src/lib/sde/jsonl.js";

export const FIXTURE_ZIP = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "fixtures", "sde-mini.zip");

/** The verbatim record with this `_key` from a fixture member. Throws if it is absent. */
export async function fixtureRecord(member: string, key: number | string): Promise<Record<string, unknown>> {
  for await (const record of readJsonlMember(FIXTURE_ZIP, member)) {
    if (record._key === key) return record;
  }
  throw new Error(`no record ${String(key)} in ${member}`);
}

export async function fixtureCount(member: string): Promise<number> {
  let n = 0;
  for await (const record of readJsonlMember(FIXTURE_ZIP, member)) { void record; n++; }
  return n;
}
```

`tests/sde/fixture.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { stat } from "node:fs/promises";
import { FIXTURE_ZIP, fixtureCount, fixtureRecord } from "./fixture.js";

describe("sde-mini.zip", () => {
  it("stays under the 1.5 MB budget", async () => {
    expect((await stat(FIXTURE_ZIP)).size).toBeLessThan(1_500_000);
  });

  it("holds exactly the allow-listed records", async () => {
    const members = [
      "_sde.jsonl", "categories.jsonl", "groups.jsonl", "metaGroups.jsonl", "dogmaUnits.jsonl",
      "dogmaAttributeCategories.jsonl", "dogmaAttributes.jsonl", "marketGroups.jsonl", "mapRegions.jsonl",
      "types.jsonl", "typeDogma.jsonl", "typeBonus.jsonl", "dogmaEffects.jsonl",
      "mapConstellations.jsonl", "mapSolarSystems.jsonl", "npcStations.jsonl",
    ];
    const counts: Record<string, number> = {};
    for (const m of members) counts[m] = await fixtureCount(m);
    expect(counts).toEqual({
      "_sde.jsonl": 1,
      "categories.jsonl": 48,
      "groups.jsonl": 1610,
      "metaGroups.jsonl": 13,
      "dogmaUnits.jsonl": 60,
      "dogmaAttributeCategories.jsonl": 37,
      "dogmaAttributes.jsonl": 2867,
      "marketGroups.jsonl": 2106,
      "mapRegions.jsonl": 114,
      "types.jsonl": 10,
      "typeDogma.jsonl": 9,          // type 34 (Tritanium) has no dogma row at all
      "typeBonus.jsonl": 1,          // only the Rifter has ship traits
      "dogmaEffects.jsonl": 23,
      "mapConstellations.jsonl": 1,
      "mapSolarSystems.jsonl": 7,
      "npcStations.jsonl": 18,
    });
  }, 30_000);

  it("carries the build pointer and the records the other tests assert on", async () => {
    expect(await fixtureRecord("_sde.jsonl", "sde")).toEqual({
      _key: "sde", buildNumber: 3484357, releaseDate: "2026-08-28T11:07:12Z",
    });
    const rifter = await fixtureRecord("types.jsonl", 587);
    expect(rifter.groupID).toBe(25);
    expect(rifter.marketGroupID).toBe(64);
    expect(rifter.mass).toBe(1067000);
    expect((rifter.name as Record<string, string>).en).toBe("Rifter");
    const jita = await fixtureRecord("mapSolarSystems.jsonl", 30000142);
    expect(jita.securityStatus).toBe(0.945913);
    expect(jita.regionID).toBe(10000002);
    const station = await fixtureRecord("npcStations.jsonl", 60003760);
    expect(station.solarSystemID).toBe(30000142);
    expect(station.typeID).toBe(52678);
  }, 30_000);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/sde/fixture.test.ts`
Expected: FAIL — `ENOENT … tests/fixtures/sde-mini.zip`.

- [ ] **Step 3: Write `scripts/sde-fixture.ts`**

```ts
/**
 * Regenerates tests/fixtures/sde-mini.zip from a full SDE archive.
 *
 *   npm run sde:fixture -- .superpowers/research/sde-3484357.zip
 *
 * The fixture is committed and regenerated only deliberately — every DB and mapper test asserts
 * against the record counts and values it contains, so a regeneration is a test change.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mkdir, stat } from "node:fs/promises";
import { readJsonlMember } from "../src/lib/sde/jsonl.js";
import { writeZip, type ZipMember } from "./lib/zip.js";

/** Copied whole: together these are ~4.1 MB of JSON that deflates to well under the budget. */
const FULL_MEMBERS = [
  "_sde", "categories", "groups", "metaGroups", "dogmaUnits",
  "dogmaAttributeCategories", "dogmaAttributes", "marketGroups", "mapRegions",
];

/** Rifter, Gyrostabilizer II, Gunnery, Small Hybrid Turret, Small Projectile Turret,
 *  Minmatar Frigate, Power Grid Management, CPU Management, Tritanium, Jita Trade Hub. */
const TYPE_IDS = new Set([587, 519, 3300, 3301, 3302, 3329, 3413, 3426, 34, 52678]);

/** Effects kept regardless of whether an allow-listed type references them:
 *  754 shipHybridDamageBonusCF, 290 sharpshooter…, 146 damageMultiplierSkillBonus,
 *  92 projectileWeaponDamageMultiply, 89 projectileWeaponSpeedMultiply,
 *  5928 warpScrambleTargetMWDBlockActivationForEntity (the EffectStopper sample). */
const EXTRA_EFFECT_IDS = [754, 290, 146, 92, 89, 5928];

/** Kimotoro — contains Jita (30000142). */
const CONSTELLATION_IDS = new Set([20000020]);

/** Stations are kept by the system they orbit, not by their own id. */
const STATION_SYSTEM_IDS = new Set([30000142]);

function asArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? (value as Record<string, unknown>[]) : [];
}

async function member(source: string, name: string, keep: (r: Record<string, unknown>) => boolean): Promise<ZipMember> {
  const lines: string[] = [];
  for await (const record of readJsonlMember(source, `${name}.jsonl`)) {
    if (keep(record)) lines.push(JSON.stringify(record));
  }
  console.log(`  ${name}.jsonl: ${lines.length}`);
  return { name: `${name}.jsonl`, content: `${lines.join("\n")}\n` };
}

async function main(): Promise<void> {
  const source = process.argv[2];
  if (!source) throw new Error("usage: npm run sde:fixture -- <eve-online-static-data-<build>-jsonl.zip>");
  const here = path.dirname(fileURLToPath(import.meta.url));
  const dest = path.join(here, "..", "tests", "fixtures", "sde-mini.zip");
  await mkdir(path.dirname(dest), { recursive: true });

  // Pass 1: which effects and solar systems does the allow-list pull in?
  const effectIds = new Set<number>(EXTRA_EFFECT_IDS);
  for await (const record of readJsonlMember(source, "typeDogma.jsonl")) {
    if (!TYPE_IDS.has(record._key as number)) continue;
    for (const e of asArray(record.dogmaEffects)) effectIds.add(e.effectID as number);
  }
  const systemIds = new Set<number>();
  for await (const record of readJsonlMember(source, "mapConstellations.jsonl")) {
    if (!CONSTELLATION_IDS.has(record._key as number)) continue;
    for (const id of (record.solarSystemIDs as number[] | undefined) ?? []) systemIds.add(id);
  }
  console.log(`effects: ${effectIds.size}, solar systems: ${systemIds.size}`);

  // Pass 2: build every member.
  const members: ZipMember[] = [];
  for (const name of FULL_MEMBERS) members.push(await member(source, name, () => true));
  members.push(await member(source, "types", (r) => TYPE_IDS.has(r._key as number)));
  members.push(await member(source, "typeDogma", (r) => TYPE_IDS.has(r._key as number)));
  members.push(await member(source, "typeBonus", (r) => TYPE_IDS.has(r._key as number)));
  members.push(await member(source, "dogmaEffects", (r) => effectIds.has(r._key as number)));
  members.push(await member(source, "mapConstellations", (r) => CONSTELLATION_IDS.has(r._key as number)));
  members.push(await member(source, "mapSolarSystems", (r) => systemIds.has(r._key as number)));
  members.push(await member(source, "npcStations", (r) => STATION_SYSTEM_IDS.has(r.solarSystemID as number)));

  await writeZip(dest, members);
  const { size } = await stat(dest);
  console.log(`wrote ${dest} (${size} bytes)`);
  if (size > 1_500_000) throw new Error(`fixture is ${size} bytes — over the 1.5 MB budget`);
}

main().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 4: Generate the fixture**

Run: `npm run sde:fixture -- .superpowers/research/sde-3484357.zip`
Expected: `effects: 23, solar systems: 7`, the per-member counts from the test above, and
`wrote …/tests/fixtures/sde-mini.zip (≈862000 bytes)`.

- [ ] **Step 5: Run**

Run: `npx vitest run tests/sde && npm run typecheck`
Expected: PASS (all three fixture tests plus Task 2's jsonl tests), typecheck clean.

- [ ] **Step 6: Commit (the zip is binary — make sure it is staged)**

```bash
git add -A && git status --short tests/fixtures
git commit -m "$(cat <<'EOM'
Add SDE fixture generator and the committed sde-mini.zip test fixture

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOM
)"
```
Expected: `git status --short tests/fixtures` shows `A  tests/fixtures/sde-mini.zip` before the commit.

---

### Task 4: Table mappers (`src/lib/sde/tables.ts`)

**Files:**
- Create: `src/lib/sde/tables.ts`, `tests/sde/tables.test.ts`

**Interfaces:**
- Consumes: Task 1 `SdeTableName`; Task 3 `fixtureRecord(member, key)`.
- Produces:
```ts
export type SdePgType = "int" | "text" | "bool" | "float8";
export interface SdeColumn { name: string; type: SdePgType }
export interface SdeTable {
  table: SdeTableName;
  member: string;                                        // zip member base name, no ".jsonl"
  columns: SdeColumn[];
  map(record: Record<string, unknown>): unknown[] | unknown[][];   // one row, or fanned-out rows
}
export const SDE_TABLE_DEFS: readonly SdeTable[]         // 17 defs over 15 members
export function tableDef(table: SdeTableName): SdeTable
export function en(value: unknown): string | null        // localised map → .en, or a plain string
export function int(value: unknown): number | null
export function num(value: unknown): number | null
export function bool(value: unknown): boolean | null
export function str(value: unknown): string | null
```

**Note on the spec's `columns`:** the spec leaves the shape open; this plan makes each column a
`{ name, type }` pair because the importer builds `unnest($1::int[], $2::text[], …)` and needs the
Postgres element type per column. Nothing else about the declaration changes.

- [ ] **Step 1: Write the failing test**

`tests/sde/tables.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { tableDef, en, int, num, bool, str, SDE_TABLE_DEFS } from "../../src/lib/sde/tables.js";
import { fixtureRecord } from "./fixture.js";

/** Maps a fixture record with the named table's mapper and returns the single row. */
async function row(table: Parameters<typeof tableDef>[0], member: string, key: number | string): Promise<unknown[]> {
  const out = tableDef(table).map(await fixtureRecord(member, key));
  return out as unknown[];
}
/** Maps a fixture record with a fan-out mapper and returns every row. */
async function rows(table: Parameters<typeof tableDef>[0], member: string, key: number | string): Promise<unknown[][]> {
  const out = tableDef(table).map(await fixtureRecord(member, key));
  return out as unknown[][];
}

describe("field helpers", () => {
  it("en picks English from a localised map and passes plain strings through", () => {
    expect(en({ de: "Fregatte", en: "Frigate" })).toBe("Frigate");
    expect(en("Damage multiplier.")).toBe("Damage multiplier.");
    expect(en({ de: "Fregatte" })).toBeNull();
    expect(en(undefined)).toBeNull();
  });
  it("int rounds, num keeps, bool and str reject the wrong type", () => {
    expect(int(3329.0)).toBe(3329);
    expect(int(-1)).toBe(-1);
    expect(int(undefined)).toBeNull();
    expect(num(0.945913)).toBe(0.945913);
    expect(num("1")).toBeNull();
    expect(bool(false)).toBe(false);
    expect(bool(undefined)).toBeNull();
    expect(str("B")).toBe("B");
    expect(str(1)).toBeNull();
  });
});

describe("every table def", () => {
  it("covers 17 tables and declares a type for every column", () => {
    expect(SDE_TABLE_DEFS.length).toBe(17);
    expect(new Set(SDE_TABLE_DEFS.map((d) => d.table)).size).toBe(17);
    for (const def of SDE_TABLE_DEFS) {
      expect(def.columns.length).toBeGreaterThan(0);
      for (const c of def.columns) expect(["int", "text", "bool", "float8"]).toContain(c.type);
    }
  });
});

describe("simple mappers", () => {
  it("maps a category, a group and a market group", async () => {
    expect(await row("sde_categories", "categories.jsonl", 6)).toEqual([6, "Ship", true, null]);
    expect(await row("sde_groups", "groups.jsonl", 25)).toEqual([25, 6, "Frigate", true, null, false, false, false, false]);
    expect(await row("sde_market_groups", "marketGroups.jsonl", 64)).toEqual([64, 5, "Minmatar", "Minmatar frigate designs.", true, 20968]);
  });

  it("maps a meta group, a dogma unit and an attribute category", async () => {
    expect(await row("sde_meta_groups", "metaGroups.jsonl", 2)).toEqual([2, "Tech II", "t2"]);
    // dogmaUnits 105 has no `description` — absent must become null, not undefined
    expect(await row("sde_dogma_units", "dogmaUnits.jsonl", 105)).toEqual([105, "Percentage", "%", null]);
    expect(await row("sde_dogma_attribute_categories", "dogmaAttributeCategories.jsonl", 29)).toEqual([29, "Turrets", "NPC Turrets Attributes"]);
  });

  it("maps the map tables", async () => {
    expect(await row("sde_regions", "mapRegions.jsonl", 10000002)).toEqual([10000002, "The Forge"]);
    expect(await row("sde_constellations", "mapConstellations.jsonl", 20000020)).toEqual([20000020, 10000002, "Kimotoro"]);
    expect(await row("sde_solar_systems", "mapSolarSystems.jsonl", 30000142)).toEqual([30000142, 20000020, 10000002, "Jita", 0.945913, "B"]);
    expect(await row("sde_stations", "npcStations.jsonl", 60003760)).toEqual([60003760, 30000142, 52678, 1000035, 14]);
  });
});

describe("sde_types", () => {
  it("maps the Rifter, picking English and keeping every numeric field", async () => {
    const r = await row("sde_types", "types.jsonl", 587);
    expect(r.slice(0, 3)).toEqual([587, 25, "Rifter"]);
    expect(String(r[3])).toMatch(/^The Rifter is a very powerful combat frigate/);
    //          published mktGrp metaGrp metaLvl techLvl race faction icon graphic mass    volume packVol capacity radius basePrice portion varParent
    expect(r.slice(4)).toEqual([true, 64, 1, 0, 1, 2, 500002, null, 46, 1067000, 27289, 2500, 140, 31, 400000, 1, null]);
  });

  it("turns every absent optional field into null (Jita Trade Hub has no description or mass)", async () => {
    expect(await row("sde_types", "types.jsonl", 52678)).toEqual([
      52678, 15, "Jita Trade Hub", null, false, null, null, null, null, 1, null, null, 24488,
      null, 1, 1, null, 100000, 600000, 1, null,
    ]);
  });
});

describe("dogma", () => {
  it("maps attribute 64, whose description is a plain string and whose stackable is false", async () => {
    expect(await row("sde_dogma_attributes", "dogmaAttributes.jsonl", 64)).toEqual([
      64, "damageMultiplier", "Damage Modifier", "Damage multiplier.", 29, 104, 5, 1, true, false, true, false, 1432,
    ]);
  });

  it("maps effect 92 and its single LocationGroupModifier", async () => {
    expect(await row("sde_dogma_effects", "dogmaEffects.jsonl", 92)).toEqual([
      92, "projectileWeaponDamageMultiply", null, null, 4, false, false, false, false, false,
      null, null, null, null, null, null, null,
    ]);
    expect(await rows("sde_dogma_effect_modifiers", "dogmaEffects.jsonl", 92)).toEqual([
      [92, 0, "shipID", "LocationGroupModifier", 64, 64, 4, null, 55, null],
    ]);
  });

  it("maps effect 5928's modifiers including the two EffectStopper entries", async () => {
    expect(await rows("sde_dogma_effect_modifiers", "dogmaEffects.jsonl", 5928)).toEqual([
      [5928, 0, "targetID", "ItemModifier", 104, 105, 2, null, null, null],
      [5928, 1, "targetID", "LocationRequiredSkillModifier", 1349, 1350, 2, 3454, null, null],
      [5928, 2, "target", "EffectStopper", null, null, null, null, null, 6441],
      [5928, 3, "target", "EffectStopper", null, null, null, null, null, 6442],
      [5928, 4, "targetID", "LocationRequiredSkillModifier", 1349, 1350, 2, 4385, null, null],
    ]);
  });

  it("fans typeDogma out into attributes and effects", async () => {
    expect(await rows("sde_type_attributes", "typeDogma.jsonl", 519)).toEqual([
      [519, 9, 40], [519, 30, 1], [519, 50, 30], [519, 64, 1.1], [519, 182, 3318],
      [519, 204, 0.895], [519, 277, 4], [519, 422, 2], [519, 633, 5],
    ]);
    expect(await rows("sde_type_effects", "typeDogma.jsonl", 519)).toEqual([
      [519, 11, false], [519, 16, false], [519, 89, false], [519, 92, false],
    ]);
  });

  it("returns no rows for an effect with no modifierInfo", () => {
    expect(tableDef("sde_dogma_effect_modifiers").map({ _key: 1, name: "x" })).toEqual([]);
  });
});

describe("sde_type_bonuses fan-out order", () => {
  it("maps the Rifter's two skill bonuses in file order", async () => {
    expect(await rows("sde_type_bonuses", "typeBonus.jsonl", 587)).toEqual([
      [587, 0, "skill", 3329, 1, 7.5, "bonus to <a href=showinfo:3302>Small Projectile Turret</a> rate of fire", 105],
      [587, 1, "skill", 3329, 2, 10, "bonus to <a href=showinfo:3302>Small Projectile Turret</a> falloff", 105],
    ]);
  });

  it("emits skill bonuses before role bonuses even when the record lists roleBonuses first", () => {
    // Verbatim typeBonus record for type 91849 (Algos Navy Issue), build 3484357.
    const record = {
      "_key": 91849,
      "roleBonuses": [{ "bonus": 25.0, "bonusText": { "en": "bonus to <a href=showinfo:3436>Drone</a> max velocity" }, "importance": 1, "unitID": 105 }],
      "types": [{ "_key": 33093, "_value": [
        { "bonus": 10.0, "bonusText": { "en": "bonus to <a href=showinfo:3436>Drone</a> hitpoints and damage" }, "importance": 1, "unitID": 105 },
        { "bonus": 10.0, "bonusText": { "en": "bonus to <a href=showinfo:3301>Small Hybrid Turret</a> damage and tracking speed" }, "importance": 2, "unitID": 105 },
        { "bonus": 10.0, "bonusText": { "en": "bonus to <a href=showinfo:3436>Stasis Webifier Drone</a> factor of velocity decrease and hitpoints" }, "importance": 3, "unitID": 105 },
      ] }],
    };
    expect(tableDef("sde_type_bonuses").map(record)).toEqual([
      [91849, 0, "skill", 33093, 1, 10, "bonus to <a href=showinfo:3436>Drone</a> hitpoints and damage", 105],
      [91849, 1, "skill", 33093, 2, 10, "bonus to <a href=showinfo:3301>Small Hybrid Turret</a> damage and tracking speed", 105],
      [91849, 2, "skill", 33093, 3, 10, "bonus to <a href=showinfo:3436>Stasis Webifier Drone</a> factor of velocity decrease and hitpoints", 105],
      [91849, 3, "role", null, 1, 25, "bonus to <a href=showinfo:3436>Drone</a> max velocity", 105],
    ]);
  });

  it("maps a misc bonus with no bonus value and no unit", () => {
    // Verbatim typeBonus record for type 54838 (EDENCOM Cynosural Jammer), localisations elided
    // to the two languages that matter here; `bonus` and `unitID` really are absent.
    const record = {
      "_key": 54838,
      "iconID": 24419,
      "miscBonuses": [{ "bonusText": { "de": "Anziehungsfeldgeneration blockiert", "en": "Cynosural Field Generation Blocked" }, "importance": 1 }],
    };
    expect(tableDef("sde_type_bonuses").map(record)).toEqual([
      [54838, 0, "misc", null, 1, null, "Cynosural Field Generation Blocked", null],
    ]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/sde/tables.test.ts`
Expected: FAIL — `Failed to resolve import "../../src/lib/sde/tables.js"`.

- [ ] **Step 3: Write `src/lib/sde/tables.ts`**

```ts
import type { SdeTableName } from "./ddl.js";

export type SdePgType = "int" | "text" | "bool" | "float8";
export interface SdeColumn { name: string; type: SdePgType }

export interface SdeTable {
  /** Target table, unqualified. */
  table: SdeTableName;
  /** Zip member base name, without the ".jsonl" suffix. */
  member: string;
  /** Column order — `map` must return values in exactly this order. */
  columns: SdeColumn[];
  /** One row for a 1:1 table, or an array of rows for a fan-out table (possibly empty). */
  map(record: Record<string, unknown>): unknown[] | unknown[][];
}

type Rec = Record<string, unknown>;

/**
 * The English value of an SDE field. Localised fields are `{de,en,es,fr,ja,ko,ru,zh}` objects, but
 * `dogmaAttributes.description`, `dogmaAttributeCategories.*`, every `name` on
 * attributes/effects/units, and `metaGroups.iconSuffix` are plain strings — both shapes land here.
 */
export function en(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (value !== null && typeof value === "object") {
    const candidate = (value as Rec).en;
    if (typeof candidate === "string") return candidate;
  }
  return null;
}

/** SDE integers sometimes arrive as JSON floats (`182 → 3329.0`); round them. */
export function int(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? Math.round(value) : null;
}
export function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
export function bool(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}
export function str(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function list(value: unknown): Rec[] {
  return Array.isArray(value) ? (value as Rec[]) : [];
}

function cols(spec: Record<string, SdePgType>): SdeColumn[] {
  return Object.entries(spec).map(([name, type]) => ({ name, type }));
}

export const SDE_TABLE_DEFS: readonly SdeTable[] = [
  {
    table: "sde_categories",
    member: "categories",
    columns: cols({ id: "int", name: "text", published: "bool", icon_id: "int" }),
    map: (r) => [int(r._key), en(r.name), bool(r.published), int(r.iconID)],
  },
  {
    table: "sde_groups",
    member: "groups",
    columns: cols({
      id: "int", category_id: "int", name: "text", published: "bool", icon_id: "int",
      anchorable: "bool", anchored: "bool", fittable_non_singleton: "bool", use_base_price: "bool",
    }),
    map: (r) => [
      int(r._key), int(r.categoryID), en(r.name), bool(r.published), int(r.iconID),
      bool(r.anchorable), bool(r.anchored), bool(r.fittableNonSingleton), bool(r.useBasePrice),
    ],
  },
  {
    table: "sde_types",
    member: "types",
    columns: cols({
      id: "int", group_id: "int", name: "text", description: "text", published: "bool",
      market_group_id: "int", meta_group_id: "int", meta_level: "int", tech_level: "int",
      race_id: "int", faction_id: "int", icon_id: "int", graphic_id: "int",
      mass: "float8", volume: "float8", packaged_volume: "float8", capacity: "float8",
      radius: "float8", base_price: "float8", portion_size: "int", variation_parent_type_id: "int",
    }),
    map: (r) => [
      int(r._key), int(r.groupID), en(r.name), en(r.description), bool(r.published),
      int(r.marketGroupID), int(r.metaGroupID), int(r.metaLevel), int(r.techLevel),
      int(r.raceID), int(r.factionID), int(r.iconID), int(r.graphicID),
      num(r.mass), num(r.volume), num(r.packagedVolume), num(r.capacity),
      num(r.radius), num(r.basePrice), int(r.portionSize), int(r.variationParentTypeID),
    ],
  },
  {
    table: "sde_market_groups",
    member: "marketGroups",
    columns: cols({ id: "int", parent_id: "int", name: "text", description: "text", has_types: "bool", icon_id: "int" }),
    map: (r) => [int(r._key), int(r.parentGroupID), en(r.name), en(r.description), bool(r.hasTypes), int(r.iconID)],
  },
  {
    table: "sde_meta_groups",
    member: "metaGroups",
    columns: cols({ id: "int", name: "text", icon_suffix: "text" }),
    map: (r) => [int(r._key), en(r.name), str(r.iconSuffix)],
  },
  {
    table: "sde_dogma_units",
    member: "dogmaUnits",
    columns: cols({ id: "int", name: "text", display_name: "text", description: "text" }),
    map: (r) => [int(r._key), en(r.name), en(r.displayName), en(r.description)],
  },
  {
    table: "sde_dogma_attribute_categories",
    member: "dogmaAttributeCategories",
    columns: cols({ id: "int", name: "text", description: "text" }),
    map: (r) => [int(r._key), en(r.name), en(r.description)],
  },
  {
    table: "sde_dogma_attributes",
    member: "dogmaAttributes",
    columns: cols({
      id: "int", name: "text", display_name: "text", description: "text", category_id: "int",
      unit_id: "int", data_type: "int", default_value: "float8", high_is_good: "bool",
      stackable: "bool", published: "bool", display_when_zero: "bool", icon_id: "int",
    }),
    map: (r) => [
      int(r._key), en(r.name), en(r.displayName), en(r.description), int(r.attributeCategoryID),
      int(r.unitID), int(r.dataType), num(r.defaultValue), bool(r.highIsGood),
      bool(r.stackable), bool(r.published), bool(r.displayWhenZero), int(r.iconID),
    ],
  },
  {
    table: "sde_dogma_effects",
    member: "dogmaEffects",
    columns: cols({
      id: "int", name: "text", display_name: "text", description: "text", effect_category_id: "int",
      is_offensive: "bool", is_assistance: "bool", is_warp_safe: "bool", disallow_auto_repeat: "bool",
      published: "bool", duration_attribute_id: "int", discharge_attribute_id: "int",
      range_attribute_id: "int", falloff_attribute_id: "int", tracking_speed_attribute_id: "int",
      resistance_attribute_id: "int", fitting_usage_chance_attribute_id: "int",
    }),
    map: (r) => [
      int(r._key), en(r.name), en(r.displayName), en(r.description), int(r.effectCategoryID),
      bool(r.isOffensive), bool(r.isAssistance), bool(r.isWarpSafe), bool(r.disallowAutoRepeat),
      bool(r.published), int(r.durationAttributeID), int(r.dischargeAttributeID),
      int(r.rangeAttributeID), int(r.falloffAttributeID), int(r.trackingSpeedAttributeID),
      int(r.resistanceAttributeID), int(r.fittingUsageChanceAttributeID),
    ],
  },
  {
    table: "sde_dogma_effect_modifiers",
    member: "dogmaEffects",
    columns: cols({
      effect_id: "int", idx: "int", domain: "text", func: "text", modified_attribute_id: "int",
      modifying_attribute_id: "int", operation: "int", skill_type_id: "int", group_id: "int",
      stopped_effect_id: "int",
    }),
    // EffectStopper entries carry `effectID` instead of the attribute triple.
    map: (r) => list(r.modifierInfo).map((m, idx) => [
      int(r._key), idx, str(m.domain), str(m.func), int(m.modifiedAttributeID),
      int(m.modifyingAttributeID), int(m.operation), int(m.skillTypeID), int(m.groupID), int(m.effectID),
    ]),
  },
  {
    table: "sde_type_attributes",
    member: "typeDogma",
    columns: cols({ type_id: "int", attribute_id: "int", value: "float8" }),
    // `value` is always a JSON float in the SDE, even for IDs; stored as given.
    map: (r) => list(r.dogmaAttributes).map((a) => [int(r._key), int(a.attributeID), num(a.value)]),
  },
  {
    table: "sde_type_effects",
    member: "typeDogma",
    columns: cols({ type_id: "int", effect_id: "int", is_default: "bool" }),
    map: (r) => list(r.dogmaEffects).map((e) => [int(r._key), int(e.effectID), bool(e.isDefault)]),
  },
  {
    table: "sde_type_bonuses",
    member: "typeBonus",
    columns: cols({
      type_id: "int", idx: "int", kind: "text", skill_type_id: "int", importance: "int",
      bonus: "float8", bonus_text: "text", unit_id: "int",
    }),
    // idx is the ordinal within the type: every types[*]._value entry first (kind "skill",
    // skill_type_id = the list's _key), then roleBonuses, then miscBonuses, in file order.
    map: (r) => {
      const typeId = int(r._key);
      const out: unknown[][] = [];
      const push = (kind: "skill" | "role" | "misc", skillTypeId: number | null, b: Rec): void => {
        out.push([typeId, out.length, kind, skillTypeId, int(b.importance), num(b.bonus), en(b.bonusText), int(b.unitID)]);
      };
      for (const entry of list(r.types)) {
        const skillTypeId = int(entry._key);
        for (const b of list(entry._value)) push("skill", skillTypeId, b);
      }
      for (const b of list(r.roleBonuses)) push("role", null, b);
      for (const b of list(r.miscBonuses)) push("misc", null, b);
      return out;
    },
  },
  {
    table: "sde_regions",
    member: "mapRegions",
    columns: cols({ id: "int", name: "text" }),
    map: (r) => [int(r._key), en(r.name)],
  },
  {
    table: "sde_constellations",
    member: "mapConstellations",
    columns: cols({ id: "int", region_id: "int", name: "text" }),
    map: (r) => [int(r._key), int(r.regionID), en(r.name)],
  },
  {
    table: "sde_solar_systems",
    member: "mapSolarSystems",
    columns: cols({
      id: "int", constellation_id: "int", region_id: "int", name: "text",
      security_status: "float8", security_class: "text",
    }),
    map: (r) => [
      int(r._key), int(r.constellationID), int(r.regionID), en(r.name),
      num(r.securityStatus), str(r.securityClass),
    ],
  },
  {
    table: "sde_stations",
    member: "npcStations",
    columns: cols({ id: "int", solar_system_id: "int", type_id: "int", owner_id: "int", operation_id: "int" }),
    // npcStations carry no name — station names come from ESI in phase 3.
    map: (r) => [int(r._key), int(r.solarSystemID), int(r.typeID), int(r.ownerID), int(r.operationID)],
  },
];

const BY_NAME = new Map<SdeTableName, SdeTable>(SDE_TABLE_DEFS.map((d) => [d.table, d]));

export function tableDef(table: SdeTableName): SdeTable {
  const def = BY_NAME.get(table);
  if (!def) throw new Error(`no SdeTable definition for ${table}`);
  return def;
}
```

- [ ] **Step 4: Run**

Run: `npx vitest run tests/sde/tables.test.ts && npm run typecheck`
Expected: PASS (13 tests), typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOM'
Add declarative SDE table mappers with English-only field extraction

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOM
)"
```

---

### Task 5: Importer — staging schema, batched inserts, transactional swap

**Files:**
- Create: `src/lib/sde/import.ts`, `tests/db/sde-import.test.ts`

**Interfaces:**
- Consumes: Task 1 `sdeDdl(schema)`, `SDE_TABLES`; Task 2 `readJsonlMember`, `writeZip`; Task 3 `FIXTURE_ZIP`; Task 4 `SDE_TABLE_DEFS`, `SdeTable`; phase-1 `getPool`, `closePool`; Task 1 `resetDb`, `resetSde`.
- Produces:
```ts
export interface ImportResult { buildNumber: number; releaseDate: Date; counts: Record<string, number> }
export function importSde(zipPath: string, pool: Pool, log?: (msg: string) => void): Promise<ImportResult>
export const SDE_STAGING_SCHEMA = "sde_import";
```

- [ ] **Step 1: Write the failing test**

`tests/db/sde-import.test.ts`:
```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { Pool } from "pg";
import { resetDb, resetSde } from "./helpers.js";
import { closePool } from "../../src/lib/db/client.js";
import { importSde } from "../../src/lib/sde/import.js";
import { readJsonlMember } from "../../src/lib/sde/jsonl.js";
import { writeZip, type ZipMember } from "../../scripts/lib/zip.js";
import { FIXTURE_ZIP } from "../sde/fixture.js";

let pool: Pool;
let tmp: string;

const EXPECTED_COUNTS = {
  sde_categories: 48,
  sde_groups: 1610,
  sde_types: 10,
  sde_market_groups: 2106,
  sde_meta_groups: 13,
  sde_dogma_units: 60,
  sde_dogma_attribute_categories: 37,
  sde_dogma_attributes: 2867,
  sde_dogma_effects: 23,
  sde_dogma_effect_modifiers: 26,
  sde_type_attributes: 132,
  sde_type_effects: 25,
  sde_type_bonuses: 2,
  sde_regions: 114,
  sde_constellations: 1,
  sde_solar_systems: 7,
  sde_stations: 18,
};

beforeAll(async () => {
  pool = await resetDb();
  await resetSde(pool);
  tmp = await mkdtemp(path.join(os.tmpdir(), "eve-sde-import-"));
}, 60_000);

afterAll(async () => {
  await rm(tmp, { recursive: true, force: true });
  await closePool();
});

/** Copies the fixture, dropping the named members. */
async function fixtureWithout(dropped: string[], name: string): Promise<string> {
  const members: ZipMember[] = [];
  for (const member of [
    "_sde.jsonl", "categories.jsonl", "groups.jsonl", "metaGroups.jsonl", "dogmaUnits.jsonl",
    "dogmaAttributeCategories.jsonl", "dogmaAttributes.jsonl", "marketGroups.jsonl", "mapRegions.jsonl",
    "types.jsonl", "typeDogma.jsonl", "typeBonus.jsonl", "dogmaEffects.jsonl",
    "mapConstellations.jsonl", "mapSolarSystems.jsonl", "npcStations.jsonl",
  ]) {
    if (dropped.includes(member)) continue;
    const lines: string[] = [];
    for await (const r of readJsonlMember(FIXTURE_ZIP, member)) lines.push(JSON.stringify(r));
    members.push({ name: member, content: `${lines.join("\n")}\n` });
  }
  const dest = path.join(tmp, name);
  await writeZip(dest, members);
  return dest;
}

describe("importSde", () => {
  it("imports the fixture, reports the build and per-table counts", async () => {
    const result = await importSde(FIXTURE_ZIP, pool);
    expect(result.buildNumber).toBe(3484357);
    expect(result.releaseDate.toISOString()).toBe("2026-08-28T11:07:12.000Z");
    expect(result.counts).toEqual(EXPECTED_COUNTS);

    for (const [table, n] of Object.entries(EXPECTED_COUNTS)) {
      const { rows } = await pool.query<{ count: string }>(`SELECT count(*) FROM ${table}`);
      expect([table, Number(rows[0].count)]).toEqual([table, n]);
    }
    const { rows: meta } = await pool.query<{ build_number: number }>("SELECT build_number FROM sde_meta WHERE id = 1");
    expect(meta[0].build_number).toBe(3484357);
    // the staging schema is gone once the swap commits
    const { rows: schemas } = await pool.query("SELECT 1 FROM information_schema.schemata WHERE schema_name = 'sde_import'");
    expect(schemas.length).toBe(0);
  }, 120_000);

  it("lands the values later phases rely on", async () => {
    const { rows: rifter } = await pool.query<{ group_id: number; market_group_id: number; mass: number; name: string }>(
      "SELECT group_id, market_group_id, mass, name FROM sde_types WHERE id = 587");
    expect(rifter[0]).toEqual({ group_id: 25, market_group_id: 64, mass: 1067000, name: "Rifter" });

    const { rows: attr } = await pool.query<{ stackable: boolean; name: string; description: string }>(
      "SELECT stackable, name, description FROM sde_dogma_attributes WHERE id = 64");
    expect(attr[0]).toEqual({ stackable: false, name: "damageMultiplier", description: "Damage multiplier." });

    const { rows: mod } = await pool.query(
      `SELECT domain, func, modified_attribute_id, modifying_attribute_id, operation, group_id, skill_type_id, stopped_effect_id
       FROM sde_dogma_effect_modifiers WHERE effect_id = 92 AND idx = 0`);
    expect(mod[0]).toEqual({
      domain: "shipID", func: "LocationGroupModifier", modified_attribute_id: 64,
      modifying_attribute_id: 64, operation: 4, group_id: 55, skill_type_id: null, stopped_effect_id: null,
    });

    const { rows: stopper } = await pool.query(
      "SELECT domain, func, stopped_effect_id, operation FROM sde_dogma_effect_modifiers WHERE effect_id = 5928 AND idx = 2");
    expect(stopper[0]).toEqual({ domain: "target", func: "EffectStopper", stopped_effect_id: 6441, operation: null });

    const { rows: jita } = await pool.query<{ security_status: number; region_id: number; name: string }>(
      "SELECT security_status, region_id, name FROM sde_solar_systems WHERE id = 30000142");
    expect(jita[0].name).toBe("Jita");
    expect(jita[0].region_id).toBe(10000002);
    expect(jita[0].security_status).toBeCloseTo(0.9459, 4);

    const { rows: station } = await pool.query<{ solar_system_id: number; type_id: number }>(
      "SELECT solar_system_id, type_id FROM sde_stations WHERE id = 60003760");
    expect(station[0]).toEqual({ solar_system_id: 30000142, type_id: 52678 });

    const { rows: bonus } = await pool.query(
      "SELECT idx, kind, skill_type_id, importance, bonus, unit_id FROM sde_type_bonuses WHERE type_id = 587 ORDER BY idx");
    expect(bonus).toEqual([
      { idx: 0, kind: "skill", skill_type_id: 3329, importance: 1, bonus: 7.5, unit_id: 105 },
      { idx: 1, kind: "skill", skill_type_id: 3329, importance: 2, bonus: 10, unit_id: 105 },
    ]);
  }, 60_000);

  it("recreates the indexes on the swapped-in tables", async () => {
    const { rows } = await pool.query<{ indexname: string }>(
      "SELECT indexname FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'sde_types' ORDER BY 1");
    expect(rows.map((r) => r.indexname)).toEqual([
      "sde_types_group_idx", "sde_types_market_group_idx", "sde_types_name_lower_idx", "sde_types_pkey",
    ]);
  });

  it("is repeatable: one row per key, imported_at moves forward", async () => {
    const { rows: before } = await pool.query<{ imported_at: Date }>("SELECT imported_at FROM sde_meta WHERE id = 1");
    await importSde(FIXTURE_ZIP, pool);
    const { rows: types } = await pool.query<{ count: string }>("SELECT count(*) FROM sde_types");
    expect(Number(types[0].count)).toBe(10);
    const { rows: metas } = await pool.query<{ count: string }>("SELECT count(*) FROM sde_meta");
    expect(Number(metas[0].count)).toBe(1);
    const { rows: after } = await pool.query<{ imported_at: Date }>("SELECT imported_at FROM sde_meta WHERE id = 1");
    expect(after[0].imported_at.getTime()).toBeGreaterThan(before[0].imported_at.getTime());
  }, 120_000);

  it("leaves the live tables untouched when a required member is missing", async () => {
    const broken = await fixtureWithout(["types.jsonl"], "no-types.zip");
    await expect(importSde(broken, pool)).rejects.toThrow(/zip member not found: types\.jsonl/);
    const { rows } = await pool.query<{ count: string }>("SELECT count(*) FROM sde_types");
    expect(Number(rows[0].count)).toBe(10);
    const { rows: meta } = await pool.query<{ build_number: number }>("SELECT build_number FROM sde_meta WHERE id = 1");
    expect(meta[0].build_number).toBe(3484357);
  }, 120_000);

  it("fails before touching anything when _sde.jsonl is missing", async () => {
    const broken = await fixtureWithout(["_sde.jsonl"], "no-sde.zip");
    await expect(importSde(broken, pool)).rejects.toThrow(/zip member not found: _sde\.jsonl/);
    const { rows } = await pool.query<{ count: string }>("SELECT count(*) FROM sde_types");
    expect(Number(rows[0].count)).toBe(10);
  }, 60_000);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/db/sde-import.test.ts`
Expected: FAIL — `Failed to resolve import "../../src/lib/sde/import.js"`.

- [ ] **Step 3: Write `src/lib/sde/import.ts`**

```ts
import type { Pool } from "pg";
import { readJsonlMember } from "./jsonl.js";
import { sdeDdl, SDE_TABLES } from "./ddl.js";
import { SDE_TABLE_DEFS, type SdeTable } from "./tables.js";

export const SDE_STAGING_SCHEMA = "sde_import";
const BATCH_ROWS = 2000;

export interface ImportResult {
  buildNumber: number;
  releaseDate: Date;
  counts: Record<string, number>;
}

/**
 * Loads a JSON Lines SDE archive into `public.sde_*`.
 *
 * Everything is staged in the `sde_import` schema first and moved with `ALTER TABLE … SET SCHEMA`
 * inside one transaction, so readers see the previous SDE until the swap commits and no live table
 * is ever locked for long. A failure anywhere before the swap leaves the live tables untouched;
 * the leftover staging schema is dropped at the start of the next attempt.
 */
export async function importSde(zipPath: string, pool: Pool, log: (msg: string) => void = () => {}): Promise<ImportResult> {
  const build = await readBuild(zipPath);
  log(`SDE build ${build.buildNumber} released ${build.releaseDate.toISOString()} — staging`);

  await pool.query(`DROP SCHEMA IF EXISTS ${SDE_STAGING_SCHEMA} CASCADE`);
  await pool.query(`CREATE SCHEMA ${SDE_STAGING_SCHEMA}`);
  for (const stmt of sdeDdl(SDE_STAGING_SCHEMA)) await pool.query(stmt);

  const counts: Record<string, number> = {};
  for (const def of SDE_TABLE_DEFS) counts[def.table] = 0;

  for (const [member, defs] of groupByMember(SDE_TABLE_DEFS)) {
    const batches = new Map<string, unknown[][]>(defs.map((d) => [d.table, []]));
    for await (const record of readJsonlMember(zipPath, `${member}.jsonl`)) {
      for (const def of defs) {
        const batch = batches.get(def.table)!;
        for (const row of toRows(def.map(record))) batch.push(row);
        if (batch.length >= BATCH_ROWS) counts[def.table] += await flush(pool, def, batch);
      }
    }
    for (const def of defs) counts[def.table] += await flush(pool, def, batches.get(def.table)!);
    log(`${member}.jsonl → ${defs.map((d) => `${d.table}=${counts[d.table]}`).join(", ")}`);
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const table of SDE_TABLES) {
      await client.query(`DROP TABLE IF EXISTS public.${table}`);
      await client.query(`ALTER TABLE ${SDE_STAGING_SCHEMA}.${table} SET SCHEMA public`);
    }
    await client.query(
      `INSERT INTO public.sde_meta (id, build_number, release_date, imported_at)
       VALUES (1, $1, $2, now())
       ON CONFLICT (id) DO UPDATE
         SET build_number = EXCLUDED.build_number, release_date = EXCLUDED.release_date, imported_at = now()`,
      [build.buildNumber, build.releaseDate],
    );
    await client.query(`DROP SCHEMA ${SDE_STAGING_SCHEMA} CASCADE`);
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
  log(`swapped ${SDE_TABLES.length} tables into public`);

  return { buildNumber: build.buildNumber, releaseDate: build.releaseDate, counts };
}

async function readBuild(zipPath: string): Promise<{ buildNumber: number; releaseDate: Date }> {
  for await (const record of readJsonlMember(zipPath, "_sde.jsonl")) {
    if (typeof record.buildNumber !== "number" || typeof record.releaseDate !== "string") {
      throw new Error(`_sde.jsonl has an unexpected record: ${JSON.stringify(record)}`);
    }
    return { buildNumber: record.buildNumber, releaseDate: new Date(record.releaseDate) };
  }
  throw new Error("_sde.jsonl is empty");
}

/** Preserves first-appearance order so each member is streamed exactly once. */
function groupByMember(defs: readonly SdeTable[]): Map<string, SdeTable[]> {
  const out = new Map<string, SdeTable[]>();
  for (const def of defs) {
    const existing = out.get(def.member);
    if (existing) existing.push(def);
    else out.set(def.member, [def]);
  }
  return out;
}

function toRows(mapped: unknown[] | unknown[][]): unknown[][] {
  if (mapped.length === 0) return [];
  return Array.isArray(mapped[0]) ? (mapped as unknown[][]) : [mapped as unknown[]];
}

/** Inserts and empties the batch; returns how many rows went in. */
async function flush(pool: Pool, def: SdeTable, rows: unknown[][]): Promise<number> {
  if (rows.length === 0) return 0;
  const columns = def.columns.map((_, i) => rows.map((row) => row[i]));
  await pool.query(insertSql(def), columns);
  const n = rows.length;
  rows.length = 0;
  return n;
}

/** `INSERT INTO sde_import.t (a, b) SELECT * FROM unnest($1::int[], $2::text[])` */
function insertSql(def: SdeTable): string {
  const names = def.columns.map((c) => c.name).join(", ");
  const args = def.columns.map((c, i) => `$${i + 1}::${c.type}[]`).join(", ");
  return `INSERT INTO ${SDE_STAGING_SCHEMA}.${def.table} (${names}) SELECT * FROM unnest(${args})`;
}
```

- [ ] **Step 4: Run**

Run: `npx vitest run tests/db && npm run typecheck`
Expected: PASS — six import tests plus the phase-1 DB tests, typecheck clean. The fixture import
takes a couple of seconds; if the DB is not running, start it with `docker compose -f compose.dev.yml up -d`.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOM'
Add streaming SDE importer with staging schema and transactional swap

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOM
)"
```

---

### Task 6: Read repository (`src/lib/sde/repo.ts`)

**Files:**
- Create: `src/lib/sde/repo.ts`, `tests/db/sde-repo.test.ts`

**Interfaces:**
- Consumes: phase-1 `getPool()` from `src/lib/db/client.js`; Task 5 `importSde` (test setup only).
- Produces:
```ts
export interface SdeType {
  id: number; groupId: number | null; name: string | null; description: string | null; published: boolean | null;
  marketGroupId: number | null; metaGroupId: number | null; metaLevel: number | null; techLevel: number | null;
  mass: number | null; volume: number | null; packagedVolume: number | null; capacity: number | null;
  basePrice: number | null; iconId: number | null; graphicId: number | null; raceId: number | null;
  factionId: number | null; portionSize: number | null; variationParentTypeId: number | null;
}
export interface SdeMetaCounts { types: number; dogmaAttributes: number; dogmaEffects: number; solarSystems: number }
export interface SdeMeta { buildNumber: number; releaseDate: Date; importedAt: Date; counts: SdeMetaCounts }
export interface SdeSolarSystem { id: number; constellationId: number | null; regionId: number | null; name: string | null; securityStatus: number | null; securityClass: string | null }
export interface SdeRegion { id: number; name: string | null }
export interface SdeStation { id: number; solarSystemId: number | null; typeId: number | null; ownerId: number | null; operationId: number | null }
export interface SdeTypeEffect { effectId: number; isDefault: boolean | null }
export interface SdeSkillRequirement { skillTypeId: number; level: number }

export function getSdeMeta(): Promise<SdeMeta | null>
export function getType(id: number): Promise<SdeType | null>
export function getTypes(ids: number[]): Promise<Map<number, SdeType>>
export function searchTypes(query: string, opts?: { categoryId?: number; limit?: number }): Promise<SdeType[]>
export function getTypeAttributes(typeId: number): Promise<Map<number, number>>
export function getTypeEffects(typeId: number): Promise<SdeTypeEffect[]>
export function getSkillRequirements(typeId: number): Promise<SdeSkillRequirement[]>
export function getSolarSystem(id: number): Promise<SdeSolarSystem | null>
export function getRegion(id: number): Promise<SdeRegion | null>
export function getStation(id: number): Promise<SdeStation | null>
```

- [ ] **Step 1: Write the failing test**

`tests/db/sde-repo.test.ts`:
```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Pool } from "pg";
import { resetDb, resetSde } from "./helpers.js";
import { closePool } from "../../src/lib/db/client.js";
import { importSde } from "../../src/lib/sde/import.js";
import { FIXTURE_ZIP } from "../sde/fixture.js";
import {
  getSdeMeta, getType, getTypes, searchTypes, getTypeAttributes, getTypeEffects,
  getSkillRequirements, getSolarSystem, getRegion, getStation,
} from "../../src/lib/sde/repo.js";

let pool: Pool;

beforeAll(async () => {
  pool = await resetDb();
  await resetSde(pool);
  await importSde(FIXTURE_ZIP, pool);
}, 120_000);
afterAll(closePool);

describe("getSdeMeta", () => {
  it("reports the build and the four headline counts", async () => {
    const meta = await getSdeMeta();
    expect(meta).not.toBeNull();
    expect(meta!.buildNumber).toBe(3484357);
    expect(meta!.releaseDate.toISOString()).toBe("2026-08-28T11:07:12.000Z");
    expect(meta!.importedAt).toBeInstanceOf(Date);
    expect(meta!.counts).toEqual({ types: 10, dogmaAttributes: 2867, dogmaEffects: 23, solarSystems: 7 });
  });

  it("returns null before the first import", async () => {
    await resetSde(pool);
    expect(await getSdeMeta()).toBeNull();
    await importSde(FIXTURE_ZIP, pool);   // restore for the rest of the file
  }, 120_000);
});

describe("types", () => {
  it("reads one type with camelCase fields", async () => {
    expect(await getType(587)).toEqual({
      id: 587, groupId: 25, name: "Rifter", description: expect.stringContaining("combat frigate"),
      published: true, marketGroupId: 64, metaGroupId: 1, metaLevel: 0, techLevel: 1,
      mass: 1067000, volume: 27289, packagedVolume: 2500, capacity: 140, basePrice: 400000,
      iconId: null, graphicId: 46, raceId: 2, factionId: 500002, portionSize: 1, variationParentTypeId: null,
    });
    expect(await getType(999999)).toBeNull();
  });

  it("reads many types at once, skipping unknown ids", async () => {
    const map = await getTypes([587, 519, 999999]);
    expect(map.size).toBe(2);
    expect(map.get(519)!.name).toBe("Gyrostabilizer II");
    expect(map.get(587)!.groupId).toBe(25);
    expect(await getTypes([])).toEqual(new Map());
  });

  it("searches case-insensitively, published only, name-ascending", async () => {
    expect((await searchTypes("rift")).map((t) => t.name)).toEqual(["Rifter"]);
    expect((await searchTypes("RIFT")).map((t) => t.name)).toEqual(["Rifter"]);
    expect((await searchTypes("turret")).map((t) => t.name)).toEqual(["Small Hybrid Turret", "Small Projectile Turret"]);
    // "Jita Trade Hub" (52678) is published = false
    expect(await searchTypes("jita")).toEqual([]);
  });

  it("filters a search by category and honours the limit", async () => {
    expect((await searchTypes("t", { categoryId: 6 })).map((t) => t.name)).toEqual(["Rifter"]);
    expect((await searchTypes("management", { categoryId: 16 })).map((t) => t.name)).toEqual(["CPU Management", "Power Grid Management"]);
    expect((await searchTypes("management", { categoryId: 7 }))).toEqual([]);
    expect((await searchTypes("turret", { limit: 1 })).map((t) => t.name)).toEqual(["Small Hybrid Turret"]);
  });
});

describe("dogma", () => {
  it("reads a type's attributes as attributeId → value", async () => {
    const attrs = await getTypeAttributes(519);
    expect(attrs.size).toBe(9);
    expect(attrs.get(64)).toBe(1.1);
    expect(attrs.get(182)).toBe(3318);
    expect(attrs.get(9999)).toBeUndefined();
    expect(await getTypeAttributes(34)).toEqual(new Map());   // Tritanium has no typeDogma row
  });

  it("reads a type's effects", async () => {
    expect(await getTypeEffects(519)).toEqual([
      { effectId: 11, isDefault: false },
      { effectId: 16, isDefault: false },
      { effectId: 89, isDefault: false },
      { effectId: 92, isDefault: false },
    ]);
    expect(await getTypeEffects(34)).toEqual([]);
  });

  it("derives skill requirements from the attribute pairs, rounded to ints", async () => {
    expect(await getSkillRequirements(587)).toEqual([{ skillTypeId: 3329, level: 1 }]);
    expect(await getSkillRequirements(519)).toEqual([{ skillTypeId: 3318, level: 4 }]);
    expect(await getSkillRequirements(34)).toEqual([]);
  });
});

describe("map lookups", () => {
  it("reads a solar system, its region and a station", async () => {
    const jita = await getSolarSystem(30000142);
    expect(jita!.name).toBe("Jita");
    expect(jita!.constellationId).toBe(20000020);
    expect(jita!.regionId).toBe(10000002);
    expect(jita!.securityStatus).toBeCloseTo(0.9459, 4);
    expect(jita!.securityClass).toBe("B");
    expect(await getRegion(10000002)).toEqual({ id: 10000002, name: "The Forge" });
    expect(await getStation(60003760)).toEqual({
      id: 60003760, solarSystemId: 30000142, typeId: 52678, ownerId: 1000035, operationId: 14,
    });
  });

  it("returns null for unknown ids", async () => {
    expect(await getSolarSystem(1)).toBeNull();
    expect(await getRegion(1)).toBeNull();
    expect(await getStation(1)).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/db/sde-repo.test.ts`
Expected: FAIL — `Failed to resolve import "../../src/lib/sde/repo.js"`.

- [ ] **Step 3: Write `src/lib/sde/repo.ts`**

```ts
import { getPool } from "../db/client.js";

export interface SdeType {
  id: number; groupId: number | null; name: string | null; description: string | null; published: boolean | null;
  marketGroupId: number | null; metaGroupId: number | null; metaLevel: number | null; techLevel: number | null;
  mass: number | null; volume: number | null; packagedVolume: number | null; capacity: number | null;
  basePrice: number | null; iconId: number | null; graphicId: number | null; raceId: number | null;
  factionId: number | null; portionSize: number | null; variationParentTypeId: number | null;
}
export interface SdeMetaCounts { types: number; dogmaAttributes: number; dogmaEffects: number; solarSystems: number }
export interface SdeMeta { buildNumber: number; releaseDate: Date; importedAt: Date; counts: SdeMetaCounts }
export interface SdeSolarSystem {
  id: number; constellationId: number | null; regionId: number | null;
  name: string | null; securityStatus: number | null; securityClass: string | null;
}
export interface SdeRegion { id: number; name: string | null }
export interface SdeStation {
  id: number; solarSystemId: number | null; typeId: number | null; ownerId: number | null; operationId: number | null;
}
export interface SdeTypeEffect { effectId: number; isDefault: boolean | null }
export interface SdeSkillRequirement { skillTypeId: number; level: number }

const TYPE_COLS = `id, group_id AS "groupId", name, description, published,
  market_group_id AS "marketGroupId", meta_group_id AS "metaGroupId", meta_level AS "metaLevel",
  tech_level AS "techLevel", mass, volume, packaged_volume AS "packagedVolume", capacity,
  base_price AS "basePrice", icon_id AS "iconId", graphic_id AS "graphicId", race_id AS "raceId",
  faction_id AS "factionId", portion_size AS "portionSize",
  variation_parent_type_id AS "variationParentTypeId"`;

/** requiredSkill / requiredSkillLevel attribute pairs. */
const SKILL_ATTRIBUTE_PAIRS: readonly [number, number][] = [
  [182, 277], [183, 278], [184, 279], [1285, 1286], [1289, 1287], [1290, 1288],
];

export async function getSdeMeta(): Promise<SdeMeta | null> {
  const pool = getPool();
  const { rows } = await pool.query<{ buildNumber: number; releaseDate: Date; importedAt: Date }>(
    `SELECT build_number AS "buildNumber", release_date AS "releaseDate", imported_at AS "importedAt"
     FROM sde_meta WHERE id = 1`);
  if (!rows[0]) return null;
  const { rows: counts } = await pool.query<Record<keyof SdeMetaCounts, string>>(
    `SELECT (SELECT count(*) FROM sde_types)            AS "types",
            (SELECT count(*) FROM sde_dogma_attributes) AS "dogmaAttributes",
            (SELECT count(*) FROM sde_dogma_effects)    AS "dogmaEffects",
            (SELECT count(*) FROM sde_solar_systems)    AS "solarSystems"`);
  return {
    buildNumber: rows[0].buildNumber,
    releaseDate: rows[0].releaseDate,
    importedAt: rows[0].importedAt,
    counts: {
      types: Number(counts[0].types),
      dogmaAttributes: Number(counts[0].dogmaAttributes),
      dogmaEffects: Number(counts[0].dogmaEffects),
      solarSystems: Number(counts[0].solarSystems),
    },
  };
}

export async function getType(id: number): Promise<SdeType | null> {
  const { rows } = await getPool().query<SdeType>(`SELECT ${TYPE_COLS} FROM sde_types WHERE id = $1`, [id]);
  return rows[0] ?? null;
}

export async function getTypes(ids: number[]): Promise<Map<number, SdeType>> {
  if (ids.length === 0) return new Map();
  const { rows } = await getPool().query<SdeType>(
    `SELECT ${TYPE_COLS} FROM sde_types WHERE id = ANY($1::int[])`, [ids]);
  return new Map(rows.map((r) => [r.id, r]));
}

/**
 * Case-insensitive substring search over published types, name-ascending.
 * `strpos` rather than ILIKE so a query containing `%` or `_` is matched literally.
 */
export async function searchTypes(query: string, opts: { categoryId?: number; limit?: number } = {}): Promise<SdeType[]> {
  const { rows } = await getPool().query<SdeType>(
    `SELECT ${TYPE_COLS} FROM sde_types t
     WHERE t.published
       AND strpos(lower(t.name), lower($1)) > 0
       AND ($2::int IS NULL OR t.group_id IN (SELECT id FROM sde_groups WHERE category_id = $2))
     ORDER BY t.name
     LIMIT $3`,
    [query, opts.categoryId ?? null, opts.limit ?? 20]);
  return rows;
}

export async function getTypeAttributes(typeId: number): Promise<Map<number, number>> {
  const { rows } = await getPool().query<{ attribute_id: number; value: number | null }>(
    "SELECT attribute_id, value FROM sde_type_attributes WHERE type_id = $1", [typeId]);
  const out = new Map<number, number>();
  for (const r of rows) if (r.value !== null) out.set(r.attribute_id, r.value);
  return out;
}

export async function getTypeEffects(typeId: number): Promise<SdeTypeEffect[]> {
  const { rows } = await getPool().query<SdeTypeEffect>(
    `SELECT effect_id AS "effectId", is_default AS "isDefault"
     FROM sde_type_effects WHERE type_id = $1 ORDER BY effect_id`, [typeId]);
  return rows;
}

/** Skill requirements live in typeDogma as attribute pairs; the values are floats, so round them. */
export async function getSkillRequirements(typeId: number): Promise<SdeSkillRequirement[]> {
  const attrs = await getTypeAttributes(typeId);
  const out: SdeSkillRequirement[] = [];
  for (const [skillAttr, levelAttr] of SKILL_ATTRIBUTE_PAIRS) {
    const skill = attrs.get(skillAttr);
    const level = attrs.get(levelAttr);
    if (skill === undefined || level === undefined) continue;
    const skillTypeId = Math.round(skill);
    if (skillTypeId <= 0) continue;
    out.push({ skillTypeId, level: Math.round(level) });
  }
  return out;
}

export async function getSolarSystem(id: number): Promise<SdeSolarSystem | null> {
  const { rows } = await getPool().query<SdeSolarSystem>(
    `SELECT id, constellation_id AS "constellationId", region_id AS "regionId", name,
            security_status AS "securityStatus", security_class AS "securityClass"
     FROM sde_solar_systems WHERE id = $1`, [id]);
  return rows[0] ?? null;
}

export async function getRegion(id: number): Promise<SdeRegion | null> {
  const { rows } = await getPool().query<SdeRegion>("SELECT id, name FROM sde_regions WHERE id = $1", [id]);
  return rows[0] ?? null;
}

export async function getStation(id: number): Promise<SdeStation | null> {
  const { rows } = await getPool().query<SdeStation>(
    `SELECT id, solar_system_id AS "solarSystemId", type_id AS "typeId",
            owner_id AS "ownerId", operation_id AS "operationId"
     FROM sde_stations WHERE id = $1`, [id]);
  return rows[0] ?? null;
}
```

- [ ] **Step 4: Run**

Run: `npx vitest run tests/db && npm run typecheck`
Expected: PASS, typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOM'
Add typed SDE read repository for types, dogma and the map

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOM
)"
```

---

### Task 7: Version poll, zip download, and the `sde:import` CLI

**Files:**
- Create: `src/lib/sde/version.ts`, `src/lib/sde/download.ts`, `scripts/sde-import.ts`, `tests/sde/version.test.ts`, `tests/sde/download.test.ts`

**Interfaces:**
- Consumes: Task 5 `importSde(zipPath, pool, log)`; phase-1 `getPool()`.
- Produces:
```ts
// src/lib/sde/version.ts
export const SDE_LATEST_URL = "https://developers.eveonline.com/static-data/tranquility/latest.jsonl";
export interface SdeBuild { buildNumber: number; releaseDate: Date }
export function sdeUserAgent(): string                                   // ESI_USER_AGENT, or a safe default
export function fetchLatestBuild(fetchImpl?: typeof fetch): Promise<SdeBuild>
// src/lib/sde/download.ts
export const SDE_ZIP_URL = "https://developers.eveonline.com/static-data/eve-online-static-data-latest-jsonl.zip";
export function downloadSde(destPath: string, fetchImpl?: typeof fetch): Promise<void>
```

**Resolved ambiguity:** the spec says the version poll sends `User-Agent: <ESI_USER_AGENT>`. Reading
it through `getConfig()` would force every unrelated env var to be set just to poll a public URL, so
`sdeUserAgent()` reads `process.env.ESI_USER_AGENT` directly and falls back to
`"EVE-Plasma (dac9dc@gmail.com)"`. In the worker and the CLI the env var is always present.

- [ ] **Step 1: Write the failing tests**

`tests/sde/version.test.ts`:
```ts
import { describe, it, expect, vi, afterEach } from "vitest";
import { fetchLatestBuild, sdeUserAgent, SDE_LATEST_URL } from "../../src/lib/sde/version.js";

const LATEST_LINE = '{"_key": "sde", "buildNumber": 3484357, "releaseDate": "2026-08-28T11:07:12Z"}\n';

afterEach(() => { delete process.env.ESI_USER_AGENT; });

describe("fetchLatestBuild", () => {
  it("parses the single-line build pointer and identifies itself", async () => {
    process.env.ESI_USER_AGENT = "EVE-Plasma/0.1 (dac9dc@gmail.com)";
    const fetchImpl = vi.fn(async () => new Response(LATEST_LINE, { status: 200 }));
    const build = await fetchLatestBuild(fetchImpl as unknown as typeof fetch);
    expect(build.buildNumber).toBe(3484357);
    expect(build.releaseDate.toISOString()).toBe("2026-08-28T11:07:12.000Z");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(SDE_LATEST_URL);
    expect((init.headers as Record<string, string>)["user-agent"]).toBe("EVE-Plasma/0.1 (dac9dc@gmail.com)");
  });

  it("throws on a non-2xx response", async () => {
    const fetchImpl = vi.fn(async () => new Response("nope", { status: 503, statusText: "Service Unavailable" }));
    await expect(fetchLatestBuild(fetchImpl as unknown as typeof fetch)).rejects.toThrow(/503/);
  });

  it("throws on an empty or unexpected body", async () => {
    const empty = vi.fn(async () => new Response("\n", { status: 200 }));
    await expect(fetchLatestBuild(empty as unknown as typeof fetch)).rejects.toThrow(/empty/i);
    const junk = vi.fn(async () => new Response('{"_key":"sde"}\n', { status: 200 }));
    await expect(fetchLatestBuild(junk as unknown as typeof fetch)).rejects.toThrow(/unexpected/i);
  });

  it("falls back to a default user agent", () => {
    expect(sdeUserAgent()).toBe("EVE-Plasma (dac9dc@gmail.com)");
  });
});
```

`tests/sde/download.test.ts`:
```ts
import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { downloadSde, SDE_ZIP_URL } from "../../src/lib/sde/download.js";

let dir: string;
beforeAll(async () => { dir = await mkdtemp(path.join(os.tmpdir(), "eve-dl-")); });
afterAll(async () => { await rm(dir, { recursive: true, force: true }); });

describe("downloadSde", () => {
  it("streams the response body to disk", async () => {
    const fetchImpl = vi.fn(async () => new Response("PK pretend zip", { status: 200 }));
    const dest = path.join(dir, "sde.zip");
    await downloadSde(dest, fetchImpl as unknown as typeof fetch);
    expect(await readFile(dest, "utf8")).toBe("PK pretend zip");
    expect((fetchImpl.mock.calls[0] as unknown as [string])[0]).toBe(SDE_ZIP_URL);
  });

  it("throws on a non-2xx response", async () => {
    const fetchImpl = vi.fn(async () => new Response("nope", { status: 404, statusText: "Not Found" }));
    await expect(downloadSde(path.join(dir, "x.zip"), fetchImpl as unknown as typeof fetch)).rejects.toThrow(/404/);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/sde/version.test.ts tests/sde/download.test.ts`
Expected: FAIL — both modules are missing.

- [ ] **Step 3: Write `src/lib/sde/version.ts`**

```ts
export const SDE_LATEST_URL = "https://developers.eveonline.com/static-data/tranquility/latest.jsonl";

export interface SdeBuild { buildNumber: number; releaseDate: Date }

/** CCP asks callers to identify themselves; the SDE endpoints reuse the ESI user agent. */
export function sdeUserAgent(): string {
  return process.env.ESI_USER_AGENT ?? "EVE-Plasma (dac9dc@gmail.com)";
}

/**
 * Reads the 80-byte build pointer:
 *   {"_key": "sde", "buildNumber": 3484357, "releaseDate": "2026-08-28T11:07:12Z"}
 * Cached 5 minutes server-side; a non-2xx is an error and must not trigger a download.
 */
export async function fetchLatestBuild(fetchImpl: typeof fetch = fetch): Promise<SdeBuild> {
  const res = await fetchImpl(SDE_LATEST_URL, {
    headers: { "user-agent": sdeUserAgent(), accept: "application/jsonlines+json, application/json" },
  });
  if (!res.ok) throw new Error(`SDE version poll failed: ${res.status} ${res.statusText}`);
  const body = await res.text();
  const line = body.split("\n").map((l) => l.trim()).find((l) => l.length > 0);
  if (!line) throw new Error("SDE version poll returned an empty body");
  const record = JSON.parse(line) as { buildNumber?: unknown; releaseDate?: unknown };
  if (typeof record.buildNumber !== "number" || typeof record.releaseDate !== "string") {
    throw new Error(`SDE version poll returned an unexpected record: ${line}`);
  }
  return { buildNumber: record.buildNumber, releaseDate: new Date(record.releaseDate) };
}
```

- [ ] **Step 4: Write `src/lib/sde/download.ts`**

```ts
import { createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { sdeUserAgent } from "./version.js";

/** No tenant segment on this path — the tenant-qualified "latest" URL returns 403. 302 to the build-pinned zip. */
export const SDE_ZIP_URL = "https://developers.eveonline.com/static-data/eve-online-static-data-latest-jsonl.zip";

/** Streams the ~95 MB archive straight to disk; it is never held in memory. */
export async function downloadSde(destPath: string, fetchImpl: typeof fetch = fetch): Promise<void> {
  const res = await fetchImpl(SDE_ZIP_URL, { headers: { "user-agent": sdeUserAgent() }, redirect: "follow" });
  if (!res.ok) throw new Error(`SDE download failed: ${res.status} ${res.statusText}`);
  if (!res.body) throw new Error("SDE download returned an empty body");
  const source = Readable.fromWeb(res.body as Parameters<typeof Readable.fromWeb>[0]);
  await pipeline(source, createWriteStream(destPath));
}
```

- [ ] **Step 5: Write `scripts/sde-import.ts`**

```ts
/**
 * Imports the SDE into the database in DATABASE_URL.
 *
 *   npm run sde:import                                   # download the latest zip, import, delete it
 *   npm run sde:import -- --file path/to/sde.zip         # import a zip already on disk
 */
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { getPool } from "../src/lib/db/client.js";
import { downloadSde, SDE_ZIP_URL } from "../src/lib/sde/download.js";
import { importSde } from "../src/lib/sde/import.js";

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const flag = argv.indexOf("--file");
  if (flag >= 0 && !argv[flag + 1]) throw new Error("--file needs a path to a jsonl SDE zip");
  let zipPath = flag >= 0 ? argv[flag + 1]! : undefined;

  const pool = getPool();
  let tmpDir: string | undefined;
  try {
    if (!zipPath) {
      tmpDir = await mkdtemp(path.join(os.tmpdir(), "eve-sde-"));
      zipPath = path.join(tmpDir, "sde.zip");
      console.log(`downloading ${SDE_ZIP_URL} to ${zipPath}`);
      await downloadSde(zipPath);
    }
    const result = await importSde(zipPath, pool, (msg) => console.log(msg));
    console.log(`imported SDE build ${result.buildNumber} released ${result.releaseDate.toISOString()}`);
    for (const [table, n] of Object.entries(result.counts)) console.log(`  ${table}: ${n}`);
  } finally {
    if (tmpDir) await rm(tmpDir, { recursive: true, force: true });
    await pool.end();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 6: Run the tests**

Run: `npx vitest run tests/sde && npm run typecheck`
Expected: PASS, typecheck clean.

- [ ] **Step 7: Exercise the CLI against the fixture**

Run:
```bash
DATABASE_URL=postgres://eve:eve@127.0.0.1:5432/eve_test npm run sde:import -- --file tests/fixtures/sde-mini.zip
```
Expected: log lines per member, then `imported SDE build 3484357 released 2026-08-28T11:07:12.000Z`
and the 17 counts ending with `sde_stations: 18`. The process exits 0.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOM'
Add SDE version poll, streaming download and the sde:import CLI

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOM
)"
```

---

### Task 8: Global (character-less) scheduler jobs

**Files:**
- Modify: `src/worker/scheduler.ts` (whole file replaced below), `tests/worker/scheduler.test.ts` (three tests appended; the five existing tests are unchanged and must keep passing)
- `src/worker/index.ts` is **not** touched here — Task 9 registers the job.

**Interfaces:**
- Consumes: phase-1 `EsiClient`, `EsiError` from `src/lib/esi/client.js`, `NeedsReauthError` from `src/lib/esi/tokens.js`, `startRun`/`finishRun` from `src/lib/db/sync-runs.js`.
- Produces:
```ts
export interface JobContext { characterId: number; esi: EsiClient }
export interface GlobalJobContext { esi: EsiClient }
export interface CharacterSyncJob { name: string; scope?: "character"; intervalMs: number; run(ctx: JobContext): Promise<number> }
export interface GlobalSyncJob   { name: string; scope: "global";     intervalMs: number; run(ctx: GlobalJobContext): Promise<number> }
export type SyncJob = CharacterSyncJob | GlobalSyncJob;
export interface SchedulerDeps { /* unchanged from phase 1 */ }
export class Scheduler { constructor(deps: SchedulerDeps); tick(): Promise<number> }
```

**Resolved ambiguity:** the spec says `SyncJob` *gains* `scope: "character" | "global"`. Making it
required would break every phase-1 test that builds a job literal, so `scope` is optional on the
character variant (`scope?: "character"`) and required on the global one — a job with no `scope` is
a character job, which is exactly what the spec means by "phase-1 jobs are `character`".

- [ ] **Step 1: Append the failing tests**

Add these three tests to `tests/worker/scheduler.test.ts`, inside the existing `describe("Scheduler", …)` block, after the last existing test. Nothing else in the file changes.

```ts
  it("runs a global job with no characters at all and records character_id = null", async () => {
    const run = vi.fn(async (ctx: { esi: unknown }) => { expect(Object.keys(ctx)).toEqual(["esi"]); return 7; });
    const { s, runs, finished, advance } = make([{ name: "g", scope: "global", intervalMs: 60_000, run }], []);
    expect(await s.tick()).toBe(1);
    expect(runs).toEqual([{ job: "g", cid: null }]);
    expect(finished).toEqual([{ id: 1, status: "ok", rows: 7 }]);
    advance(30_000); expect(await s.tick()).toBe(0);    // not due yet
    advance(30_000); expect(await s.tick()).toBe(1);    // interval elapsed
    expect(runs).toEqual([{ job: "g", cid: null }, { job: "g", cid: null }]);
  });

  it("runs global jobs without staggering them behind character jobs", async () => {
    const { s, runs } = make([
      { name: "c", intervalMs: 60_000, run: async () => 1 },
      { name: "g", scope: "global", intervalMs: 60_000, run: async () => 2 },
    ]);
    // character 1 is due at t=0, character 2 at t=5s; the global job is never staggered
    expect(await s.tick()).toBe(2);
    expect(runs).toEqual([{ job: "g", cid: null }, { job: "c", cid: 1 }]);
  });

  it("records a global job error without flagging any character for re-authorisation", async () => {
    const markNeedsReauth = vi.fn(async () => {});
    const { s, finished } = make(
      [{ name: "g", scope: "global", intervalMs: 60_000, run: async () => { throw new Error("sde boom"); } }],
      [],
      markNeedsReauth,
    );
    await s.tick();
    expect(finished).toEqual([{ id: 1, status: "error", error: "sde boom" }]);
    expect(markNeedsReauth).not.toHaveBeenCalled();
  });
```

- [ ] **Step 2: Run to verify the new tests fail**

Run: `npx vitest run tests/worker/scheduler.test.ts`
Expected: FAIL — the five phase-1 tests pass; the three new ones fail (the global job is never run, and `scope` is not a known property of `SyncJob`).

- [ ] **Step 3: Replace `src/worker/scheduler.ts`**

```ts
import { EsiClient, EsiError } from "../lib/esi/client.js";
import { NeedsReauthError } from "../lib/esi/tokens.js";
import type { startRun, finishRun } from "../lib/db/sync-runs.js";

export interface JobContext { characterId: number; esi: EsiClient }
export interface GlobalJobContext { esi: EsiClient }

/** A job run once per character. `scope` may be omitted — that is what a character job looks like. */
export interface CharacterSyncJob {
  name: string;
  scope?: "character";
  intervalMs: number;
  run(ctx: JobContext): Promise<number>;
}

/** A job run once per interval regardless of characters; its sync_runs rows have character_id NULL. */
export interface GlobalSyncJob {
  name: string;
  scope: "global";
  intervalMs: number;
  run(ctx: GlobalJobContext): Promise<number>;
}

export type SyncJob = CharacterSyncJob | GlobalSyncJob;

export interface SchedulerDeps {
  jobs: SyncJob[]; esi: EsiClient; listCharacters: () => Promise<{ id: number; tokenStatus: string }[]>;
  startRun: typeof startRun; finishRun: typeof finishRun; now?: () => number; staggerMs?: number; log?: (msg: string) => void;
  markNeedsReauth?: (characterId: number) => Promise<void>;
}

function isGlobal(job: SyncJob): job is GlobalSyncJob {
  return job.scope === "global";
}

export class Scheduler {
  private due = new Map<string, number>();   // `${job}:${cid|global}` → next due time
  private now: () => number; private stagger: number; private log: (m: string) => void;
  constructor(private deps: SchedulerDeps) {
    this.now = deps.now ?? Date.now; this.stagger = deps.staggerMs ?? 5000; this.log = deps.log ?? ((m) => console.log(`[worker] ${m}`));
  }

  async tick(): Promise<number> {
    const chars = (await this.deps.listCharacters()).filter((c) => c.tokenStatus === "ok");
    const globalJobs = this.deps.jobs.filter(isGlobal);
    const characterJobs = this.deps.jobs.filter((j): j is CharacterSyncJob => !isGlobal(j));

    // Stagger only applies to character jobs; a global job is due the moment it is first seen.
    let slot = 0;
    for (const job of characterJobs) {
      for (const c of chars) {
        const key = `${job.name}:${c.id}`;
        if (!this.due.has(key)) this.due.set(key, this.now() + slot * this.stagger);
        slot++;
      }
    }
    for (const job of globalJobs) {
      const key = `${job.name}:global`;
      if (!this.due.has(key)) this.due.set(key, this.now());
    }

    let ran = 0;
    for (const job of globalJobs) {
      const key = `${job.name}:global`;
      if (this.due.get(key)! > this.now()) continue;
      await this.record(job.name, null, () => job.run({ esi: this.deps.esi }));
      this.due.set(key, this.now() + job.intervalMs);
      ran++;
    }
    for (const job of characterJobs) {
      for (const c of chars) {
        const key = `${job.name}:${c.id}`;
        if (this.due.get(key)! > this.now()) continue;
        await this.record(job.name, c.id, () => job.run({ characterId: c.id, esi: this.deps.esi }));
        this.due.set(key, this.now() + job.intervalMs);
        ran++;
      }
    }
    return ran;
  }

  private async record(name: string, characterId: number | null, exec: () => Promise<number>): Promise<void> {
    const who = characterId === null ? "global" : `character=${characterId}`;
    const id = await this.deps.startRun(name, characterId);
    try {
      const rows = await exec();
      await this.deps.finishRun(id, { status: "ok", rows });
      this.log(`${name} ${who} ok rows=${rows}`);
    } catch (e) {
      let error: string;
      if (e instanceof NeedsReauthError) {
        error = e.message;
      } else if (e instanceof EsiError && e.status === 401 && characterId !== null) {
        await this.deps.markNeedsReauth?.(characterId);
        error = "ESI 401 — token rejected; character needs re-authorisation";
      } else {
        error = (e as Error).message ?? String(e);
      }
      await this.deps.finishRun(id, { status: "error", error });
      this.log(`${name} ${who} error: ${error}`);
    }
  }
}
```

- [ ] **Step 4: Run**

Run: `npx vitest run tests/worker && npm run typecheck`
Expected: PASS — all eight scheduler tests plus the phase-1 `character-info` tests, typecheck clean.

- [ ] **Step 5: Run the whole suite to prove nothing regressed**

Run: `npm test`
Expected: PASS, every phase-1 test included.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOM'
Add global job scope to the worker scheduler

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOM
)"
```

---

### Task 9: The `sde-update` worker job

**Files:**
- Create: `src/worker/jobs/sde-update.ts`, `tests/worker/sde-update.test.ts`
- Modify: `src/worker/index.ts`

**Interfaces:**
- Consumes: Task 8 `GlobalSyncJob`; Task 7 `fetchLatestBuild`, `SdeBuild`, `downloadSde`; Task 5 `importSde`, `ImportResult`; Task 6 `getSdeMeta`; phase-1 `getPool`.
- Produces:
```ts
export const SDE_UPDATE_INTERVAL_MS = 6 * 60 * 60 * 1000;
export interface SdeUpdateDeps {
  fetchLatestBuild: () => Promise<SdeBuild>;
  getSdeMeta: () => Promise<{ buildNumber: number } | null>;
  downloadSde: (destPath: string) => Promise<void>;
  importSde: (zipPath: string) => Promise<ImportResult>;
  tmpFile: (buildNumber: number) => string;
  removeFile: (filePath: string) => Promise<void>;
  log?: (msg: string) => void;
}
export function createSdeUpdateJob(deps: SdeUpdateDeps): GlobalSyncJob
export const sdeUpdateJob: GlobalSyncJob        // wired to the real implementations
```

- [ ] **Step 1: Write the failing test**

`tests/worker/sde-update.test.ts`:
```ts
import { describe, it, expect, vi } from "vitest";
import { createSdeUpdateJob, sdeUpdateJob, SDE_UPDATE_INTERVAL_MS, type SdeUpdateDeps } from "../../src/worker/jobs/sde-update.js";
import type { ImportResult } from "../../src/lib/sde/import.js";

const LATEST = { buildNumber: 3484357, releaseDate: new Date("2026-08-28T11:07:12Z") };

function result(buildNumber: number, types: number): ImportResult {
  return { buildNumber, releaseDate: LATEST.releaseDate, counts: { sde_types: types, sde_groups: 1610 } };
}

function deps(over: Partial<SdeUpdateDeps> = {}): { d: SdeUpdateDeps; removed: string[] } {
  const removed: string[] = [];
  const d: SdeUpdateDeps = {
    fetchLatestBuild: vi.fn(async () => LATEST),
    getSdeMeta: vi.fn(async () => null),
    downloadSde: vi.fn(async () => {}),
    importSde: vi.fn(async () => result(3484357, 52863)),
    tmpFile: (buildNumber) => `/tmp/eve-sde-${buildNumber}.zip`,
    removeFile: async (filePath) => { removed.push(filePath); },
    log: () => {},
    ...over,
  };
  return { d, removed };
}

describe("sde-update job", () => {
  it("is a 6-hourly global job", () => {
    expect(sdeUpdateJob.name).toBe("sde-update");
    expect(sdeUpdateJob.scope).toBe("global");
    expect(sdeUpdateJob.intervalMs).toBe(SDE_UPDATE_INTERVAL_MS);
    expect(SDE_UPDATE_INTERVAL_MS).toBe(6 * 60 * 60 * 1000);
  });

  it("imports on an empty database and returns the sde_types row count", async () => {
    const { d, removed } = deps();
    const rows = await createSdeUpdateJob(d).run({ esi: {} as never });
    expect(rows).toBe(52863);
    expect(d.downloadSde).toHaveBeenCalledWith("/tmp/eve-sde-3484357.zip");
    expect(d.importSde).toHaveBeenCalledWith("/tmp/eve-sde-3484357.zip");
    expect(removed).toEqual(["/tmp/eve-sde-3484357.zip"]);
  });

  it("imports when the stored build differs", async () => {
    const { d } = deps({ getSdeMeta: vi.fn(async () => ({ buildNumber: 3482594 })) });
    expect(await createSdeUpdateJob(d).run({ esi: {} as never })).toBe(52863);
    expect(d.downloadSde).toHaveBeenCalledTimes(1);
  });

  it("skips the download entirely when the stored build already matches", async () => {
    const { d, removed } = deps({ getSdeMeta: vi.fn(async () => ({ buildNumber: 3484357 })) });
    expect(await createSdeUpdateJob(d).run({ esi: {} as never })).toBe(0);
    expect(d.downloadSde).not.toHaveBeenCalled();
    expect(d.importSde).not.toHaveBeenCalled();
    expect(removed).toEqual([]);
  });

  it("propagates a version-poll failure without downloading", async () => {
    const { d } = deps({ fetchLatestBuild: vi.fn(async () => { throw new Error("503 Service Unavailable"); }) });
    await expect(createSdeUpdateJob(d).run({ esi: {} as never })).rejects.toThrow(/503/);
    expect(d.downloadSde).not.toHaveBeenCalled();
  });

  it("deletes the temp file even when the download or import fails", async () => {
    const { d: dl, removed: r1 } = deps({ downloadSde: vi.fn(async () => { throw new Error("connection reset"); }) });
    await expect(createSdeUpdateJob(dl).run({ esi: {} as never })).rejects.toThrow(/connection reset/);
    expect(r1).toEqual(["/tmp/eve-sde-3484357.zip"]);

    const { d: imp, removed: r2 } = deps({ importSde: vi.fn(async () => { throw new Error("zip member not found: types.jsonl"); }) });
    await expect(createSdeUpdateJob(imp).run({ esi: {} as never })).rejects.toThrow(/types\.jsonl/);
    expect(r2).toEqual(["/tmp/eve-sde-3484357.zip"]);
  });

  it("returns 0 rather than undefined when the import reports no sde_types count", async () => {
    const { d } = deps({ importSde: vi.fn(async () => ({ buildNumber: 3484357, releaseDate: LATEST.releaseDate, counts: {} })) });
    expect(await createSdeUpdateJob(d).run({ esi: {} as never })).toBe(0);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/worker/sde-update.test.ts`
Expected: FAIL — `Failed to resolve import "../../src/worker/jobs/sde-update.js"`.

- [ ] **Step 3: Write `src/worker/jobs/sde-update.ts`**

```ts
import os from "node:os";
import path from "node:path";
import { rm } from "node:fs/promises";
import type { GlobalSyncJob } from "../scheduler.js";
import { fetchLatestBuild, type SdeBuild } from "../../lib/sde/version.js";
import { downloadSde } from "../../lib/sde/download.js";
import { importSde, type ImportResult } from "../../lib/sde/import.js";
import { getSdeMeta } from "../../lib/sde/repo.js";
import { getPool } from "../../lib/db/client.js";

export const SDE_UPDATE_INTERVAL_MS = 6 * 60 * 60 * 1000;

/** Every side effect is injected so the job is unit-tested with fakes. */
export interface SdeUpdateDeps {
  fetchLatestBuild: () => Promise<SdeBuild>;
  getSdeMeta: () => Promise<{ buildNumber: number } | null>;
  downloadSde: (destPath: string) => Promise<void>;
  importSde: (zipPath: string) => Promise<ImportResult>;
  tmpFile: (buildNumber: number) => string;
  removeFile: (filePath: string) => Promise<void>;
  log?: (msg: string) => void;
}

/**
 * Polls the build pointer and re-imports only when the build number changed. On an empty database
 * `getSdeMeta()` is null, so the worker's first tick imports the SDE. Errors propagate: the
 * scheduler writes them to the job's sync_runs row and the previous SDE stays live.
 */
export function createSdeUpdateJob(deps: SdeUpdateDeps): GlobalSyncJob {
  const log = deps.log ?? ((): void => {});
  return {
    name: "sde-update",
    scope: "global",
    intervalMs: SDE_UPDATE_INTERVAL_MS,
    async run() {
      const latest = await deps.fetchLatestBuild();
      const meta = await deps.getSdeMeta();
      if (meta && meta.buildNumber === latest.buildNumber) {
        log(`sde-update: build ${latest.buildNumber} is already imported`);
        return 0;
      }
      const zipPath = deps.tmpFile(latest.buildNumber);
      log(`sde-update: ${meta ? `build ${meta.buildNumber}` : "no SDE"} to build ${latest.buildNumber}; downloading`);
      try {
        await deps.downloadSde(zipPath);
        const result = await deps.importSde(zipPath);
        log(`sde-update: imported build ${result.buildNumber}`);
        return result.counts.sde_types ?? 0;
      } finally {
        await deps.removeFile(zipPath);
      }
    },
  };
}

export const sdeUpdateJob: GlobalSyncJob = createSdeUpdateJob({
  fetchLatestBuild: () => fetchLatestBuild(),
  getSdeMeta: async () => await getSdeMeta(),
  downloadSde: (destPath) => downloadSde(destPath),
  importSde: (zipPath) => importSde(zipPath, getPool(), (msg) => console.log(`[worker] ${msg}`)),
  tmpFile: (buildNumber) => path.join(os.tmpdir(), `eve-sde-${buildNumber}.zip`),
  removeFile: (filePath) => rm(filePath, { force: true }),
  log: (msg) => console.log(`[worker] ${msg}`),
});
```

- [ ] **Step 4: Register the job in `src/worker/index.ts`**

Replace the whole of `src/worker/index.ts` with:

```ts
import { getConfig } from "../lib/config.js";
import { createEsiClient } from "../lib/esi/index.js";
import { listCharacters, setTokenStatus } from "../lib/db/characters.js";
import { startRun, finishRun } from "../lib/db/sync-runs.js";
import { Scheduler } from "./scheduler.js";
import { characterInfoJob } from "./jobs/character-info.js";
import { sdeUpdateJob } from "./jobs/sde-update.js";

const TICK_MS = 30_000;
getConfig();   // fail fast on missing env
const scheduler = new Scheduler({
  // sde-update first: on a fresh database the first tick imports the SDE.
  jobs: [sdeUpdateJob, characterInfoJob], esi: createEsiClient(), listCharacters, startRun, finishRun,
  markNeedsReauth: (id) => setTokenStatus(id, "needs_reauth"),
});
console.log("[worker] started");
async function loop() {
  try { await scheduler.tick(); } catch (e) { console.error("[worker] tick failed:", e); }
  setTimeout(loop, TICK_MS);
}
void loop();
```

- [ ] **Step 5: Run**

Run: `npx vitest run tests/worker && npm run typecheck`
Expected: PASS (seven `sde-update` tests, eight scheduler tests, the phase-1 `character-info` tests), typecheck clean.

- [ ] **Step 6: Verify the worker imports the SDE end to end, locally**

Run (this downloads ~95 MB and takes a few minutes; Ctrl-C once the counts print):
```bash
docker exec eve-dev-postgres psql -U eve -d eve -Atc "select 1" >/dev/null
DATABASE_URL=postgres://eve:eve@127.0.0.1:5432/eve npm run migrate
npm run worker
```
Expected: `[worker] started`, then `sde-update: no SDE to build <n>; downloading`, per-member log
lines, `swapped 17 tables into public`, and `sde-update global ok rows=52xxx`.
Then confirm and stop:
```bash
docker exec eve-dev-postgres psql -U eve -d eve -Atc "select build_number from sde_meta; select count(*) from sde_types"
```
Expected: the current build number and roughly `52863`.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOM'
Add the sde-update global worker job and register it

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOM
)"
```

---

### Task 10: The **Static data** settings card

**Files:**
- Create: `src/app/settings/StaticDataPanel.tsx`, `tests/components/static-data-panel.test.tsx`
- Modify: `src/app/settings/page.tsx`

**Interfaces:**
- Consumes: Task 6 `getSdeMeta(): Promise<SdeMeta | null>` and the `SdeMeta` type.
- Produces:
```tsx
export function StaticDataPanel({ meta }: { meta: SdeMeta | null }): JSX.Element
```

- [ ] **Step 1: Write the failing test**

`tests/components/static-data-panel.test.tsx`:
```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StaticDataPanel } from "../../src/app/settings/StaticDataPanel.js";

const meta = {
  buildNumber: 3484357,
  releaseDate: new Date("2026-08-28T11:07:12Z"),
  importedAt: new Date("2026-09-01T18:30:00Z"),
  counts: { types: 52863, dogmaAttributes: 2867, dogmaEffects: 3417, solarSystems: 8436 },
};

describe("StaticDataPanel", () => {
  it("shows the build, the dates and the four counts", () => {
    render(<StaticDataPanel meta={meta} />);
    expect(screen.getByText("Static data")).toBeInTheDocument();
    expect(screen.getByText("3484357")).toBeInTheDocument();
    expect(screen.getByText("2026-08-28 11:07")).toBeInTheDocument();
    expect(screen.getByText("2026-09-01 18:30")).toBeInTheDocument();
    expect(screen.getByText("52,863")).toBeInTheDocument();
    expect(screen.getByText("2,867")).toBeInTheDocument();
    expect(screen.getByText("3,417")).toBeInTheDocument();
    expect(screen.getByText("8,436")).toBeInTheDocument();
  });

  it("shows the empty state before the first import", () => {
    render(<StaticDataPanel meta={null} />);
    expect(screen.getByText(/not imported yet/i)).toBeInTheDocument();
    expect(screen.getByText(/the worker imports the SDE on its next run/i)).toBeInTheDocument();
    expect(screen.queryByText("Types")).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/components/static-data-panel.test.tsx`
Expected: FAIL — `Failed to resolve import "../../src/app/settings/StaticDataPanel.js"`.

- [ ] **Step 3: Write `src/app/settings/StaticDataPanel.tsx`**

```tsx
import type { SdeMeta } from "../../lib/sde/repo.js";

/** "2026-08-28 11:07" — matches the SyncStatus table's timestamp format. */
function when(value: Date): string {
  return value.toISOString().replace("T", " ").slice(0, 16);
}

/** Thousands separators without depending on the runtime's ICU locale data. */
function grouped(value: number): string {
  return value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

export function StaticDataPanel({ meta }: { meta: SdeMeta | null }) {
  return (
    <div className="card">
      <h2 className="card-title">Static data</h2>
      {meta === null ? (
        <p className="faint">Not imported yet — the worker imports the SDE on its next run.</p>
      ) : (
        <table className="table">
          <tbody>
            <tr><th>SDE build</th><td>{meta.buildNumber}</td></tr>
            <tr><th>Released</th><td className="muted">{when(meta.releaseDate)}</td></tr>
            <tr><th>Imported</th><td className="muted">{when(meta.importedAt)}</td></tr>
            <tr><th>Types</th><td>{grouped(meta.counts.types)}</td></tr>
            <tr><th>Dogma attributes</th><td>{grouped(meta.counts.dogmaAttributes)}</td></tr>
            <tr><th>Dogma effects</th><td>{grouped(meta.counts.dogmaEffects)}</td></tr>
            <tr><th>Solar systems</th><td>{grouped(meta.counts.solarSystems)}</td></tr>
          </tbody>
        </table>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Render it from `src/app/settings/page.tsx`**

Replace the whole of `src/app/settings/page.tsx` with:

```tsx
import { listAccounts } from "../../lib/db/accounts.js";
import { listCharacters } from "../../lib/db/characters.js";
import { latestRuns } from "../../lib/db/sync-runs.js";
import { getSdeMeta } from "../../lib/sde/repo.js";
import { toCharacterView } from "../../lib/view/characters.js";
import { AccountsPanel } from "./AccountsPanel.js";
import { CharactersPanel } from "./CharactersPanel.js";
import { StaticDataPanel } from "./StaticDataPanel.js";
import { SyncStatus } from "./SyncStatus.js";

export default async function SettingsPage() {
  const [accounts, characters, runs, sdeMeta] = await Promise.all([
    listAccounts(), listCharacters(), latestRuns(), getSdeMeta(),
  ]);
  const names = Object.fromEntries(characters.map((c) => [c.id, c.name]));
  return (<>
    <h1 className="page-title">Settings</h1>
    <p className="page-sub">Accounts, characters, static data and sync status.</p>
    <div className="card-grid" style={{ gridTemplateColumns: "1fr 2fr", marginBottom: 20 }}>
      <AccountsPanel accounts={accounts} />
      <CharactersPanel characters={characters.map(toCharacterView)} accounts={accounts} />
    </div>
    <div style={{ marginBottom: 20 }}>
      <StaticDataPanel meta={sdeMeta} />
    </div>
    <div className="card"><h2 className="card-title">Sync status</h2><SyncStatus runs={runs} names={names} /></div>
  </>);
}
```

The existing `SyncStatus` already renders `—` in the character column for a run whose
`characterId` is `null`, which is exactly what a global `sde-update` row is — no change needed there.

- [ ] **Step 5: Run**

Run: `npm test && npm run typecheck && npm run build`
Expected: PASS across the whole suite, typecheck clean, `next build` succeeds.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOM'
Add the Static data card to the settings page

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOM
)"
```

---

### Task 11: Deploy to the VM and acceptance

**Files:**
- Modify: none. No new services, no new env vars, no Ansible changes — the existing `eve` role
  rsyncs the repo, rebuilds the image (which picks up `yauzl` from `package-lock.json`), runs
  `npm run migrate` (which now also applies `sdeDdl("public")`) and restarts the worker.

**Interfaces:**
- Consumes: Tasks 1–10, all committed on `feature/phase2-sde`.
- Produces: `https://eve.plasma66.com/settings` showing the live SDE build, and an `ok`
  `sde-update` row in `sync_runs`.

- [ ] **Step 1: Confirm the branch is clean and green**

```bash
cd /home/daniel/AI/Plasma/EVE
git status --short
npm test && npm run typecheck && npm run build
```
Expected: no uncommitted changes, all tests pass, typecheck clean, build succeeds.

- [ ] **Step 2: Deploy**

```bash
cd deploy/ansible && script -qc "ansible-playbook site.yml --tags eve" /dev/null
```
Expected: play recap with `failed=0`. The image rebuild takes a few minutes on the VM.
(`script -qc … /dev/null` gives Ansible the TTY it wants; without it the playbook can abort on
non-blocking stdio.)

- [ ] **Step 3: Confirm the containers came back and the worker started the import**

```bash
ssh daniel@10.5.5.150 'docker ps --format "{{.Names}} {{.Status}}"'
ssh daniel@10.5.5.150 'docker logs --tail 50 eve-worker'
curl -sS https://eve.plasma66.com/api/health
```
Expected: `eve-app`, `eve-worker`, `eve-postgres`, `traefik` all `Up`; the worker log shows
`[worker] started` followed by `sde-update: no SDE to build <n>; downloading`; health returns
`{"ok":true,"db":true}`.

- [ ] **Step 4: Wait for the first import to finish**

The worker's first tick downloads ~95 MB and imports ~1.5 M rows, so this takes several minutes.
Poll — **do not use a foreground `sleep`**; re-issue this command roughly once a minute (the
Monitor tool with an until-condition is the tidy way) until it prints a status:

```bash
ssh daniel@10.5.5.150 "docker exec eve-postgres psql -U eve -d eve -Atc \"select status, coalesce(rows::text,'-'), coalesce(error,'') from sync_runs where job = 'sde-update' order by started_at desc limit 1\""
```
Expected eventually: `ok|52xxx|` (a `running` row while it works, and an empty result before the
first tick reaches the database). If it prints `error|...`, read the message and
`ssh daniel@10.5.5.150 'docker logs --tail 100 eve-worker'`.

- [ ] **Step 5: Verify the imported data on the VM**

```bash
ssh daniel@10.5.5.150 'docker exec eve-postgres psql -U eve -d eve -Atc "select build_number, imported_at from sde_meta; select count(*) from sde_types"'
ssh daniel@10.5.5.150 'docker exec eve-postgres psql -U eve -d eve -Atc "select count(*) from sde_type_attributes; select name from sde_types where id = 587; select security_status from sde_solar_systems where id = 30000142"'
```
Expected: one `sde_meta` row with the current build number and a timestamp from the last few
minutes; `sde_types` around **52 900**; `sde_type_attributes` over 1 000 000; `Rifter`; `0.945913`.

- [ ] **Step 6: Verify the skip path (a second run with no new build)**

Restarting the worker clears the scheduler's in-memory due map, so `sde-update` runs again
immediately; because `sde_meta.build_number` now matches the pointer it must return 0 rows without
downloading anything.

```bash
ssh daniel@10.5.5.150 'docker restart eve-worker'
```
Then poll (again, no foreground `sleep` — re-issue until two rows come back):
```bash
ssh daniel@10.5.5.150 "docker exec eve-postgres psql -U eve -d eve -Atc \"select status, coalesce(rows::text,'-') from sync_runs where job = 'sde-update' order by started_at desc limit 2\""
ssh daniel@10.5.5.150 'docker logs --tail 20 eve-worker'
```
Expected: two rows, the newest `ok|0`; the log shows `sde-update: build <n> is already imported`
and `sde-update global ok rows=0`.

- [ ] **Step 7: Verify the UI (Daniel, in a browser on the tailnet)**

1. Open `https://eve.plasma66.com/settings`.
2. The **Static data** card shows the current SDE build number, its release date, an imported-at
   timestamp from the last few minutes, and counts of roughly `52,900` types, `2,867` dogma
   attributes, `3,4xx` dogma effects and `8,4xx` solar systems.
3. The **Sync status** table has an `sde-update` row with a `—` in the Character column, status
   `ok`, and rows `0` (the most recent run).

Record the outcome (pass, or exactly what failed) in this task's commit message.

- [ ] **Step 8: Commit and merge**

```bash
cd /home/daniel/AI/Plasma/EVE
git commit --allow-empty -m "$(cat <<'EOM'
Deploy phase 2 (SDE import) to the VM and record acceptance

Acceptance: worker imported SDE build <n> on its first tick; sde_types <count>;
/settings Static data card shows the build; second run returned ok rows=0.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOM
)"
git checkout main && git merge --no-ff feature/phase2-sde
```

---

## Self-review

**1. Spec coverage**

| Spec section | Where it is implemented |
|---|---|
| §2 source format, version pointer, archive URL | T7 (`version.ts`, `download.ts`) |
| §2 files we import (16 members) | T4 `SDE_TABLE_DEFS` (15 members) + T5 `_sde.jsonl` |
| §2 gotchas: attribute vs effect `description`, float `value`, streaming, unnamed stations, `EffectStopper` | T4 mappers + tests; T2 streaming; T5 |
| §2 ruling English only | T4 `en()` + Global Constraints |
| §2 ruling skipped files | Global Constraints; no def references them |
| §3 ruling single DDL source `sdeDdl(schema)` | T1 |
| §3 every table and column | T1 `TABLE_BODIES` |
| §3 indexes | T1 `INDEXES`, asserted in T5 |
| §3 `sde_type_bonuses.idx` ordering rule | T4 `sde_type_bonuses.map` + two ordering tests |
| §4 `version.ts` | T7 |
| §4 `download.ts` | T7 |
| §4 `jsonl.ts` | T2 |
| §4 `tables.ts` | T4 |
| §4 `import.ts` steps 1–5 | T5 |
| §4 `repo.ts` (all ten functions + `SdeType`) | T6 |
| §5 `scripts/sde-import.ts` | T7 |
| §5 global scheduler jobs | T8 |
| §5 `sde-update` job | T9 |
| §5 settings shows `—` for global runs | T10 step 4 (existing `SyncStatus` already does this; asserted by the phase-1 component test) |
| §6 `StaticDataPanel` incl. empty-state copy | T10 |
| §7 deployment (no new services or env) | T11 |
| §8 error handling: download/parse failure, missing member, non-2xx version | T5 tests 5–6, T7 tests, T9 tests |
| §9 fixture + generator + allow-list | T3 |
| §9 unit tests | T2, T4, T7, T9 |
| §9 DB tests (all nine assertions) | T5, T6 |
| §9 scheduler test | T8 |
| §9 component test | T10 |
| §9 acceptance on the VM | T11 |
| §10 out of scope | nothing in this plan touches character data, the dogma engine, prices, an item browser, localisation, icons, blueprints or planets |

No gaps found.

**2. Placeholder scan**

No "TBD", "similar to Task N", "add error handling", or bare prose where code is required. Every
code step contains the complete file or the complete replacement block. The one place a value is
filled in at execution time is the acceptance commit message in T11 step 8 (`<n>`, `<count>`),
which is a fact only the VM can supply.

**3. Type consistency**

- `SdeTableName` and `SDE_TABLES` (T1) are what `SdeTable.table` (T4), `resetSde` (T1) and the
  importer's swap loop (T5) use; all 17 names match the `TABLE_BODIES` keys.
- `SdeTable` = `{ table, member, columns: { name, type }[], map }` (T4) is consumed unchanged by
  `insertSql`/`flush` in T5.
- `ImportResult` (T5) is what `scripts/sde-import.ts` (T7) prints and what `SdeUpdateDeps.importSde`
  (T9) returns; `counts` is keyed by table name, so `counts.sde_types` in T9 is valid.
- `SdeBuild` (T7) is the return of `fetchLatestBuild` and the type of `SdeUpdateDeps.fetchLatestBuild` (T9).
- `SdeMeta` (T6) is what `getSdeMeta()` returns, what `StaticDataPanel` takes (T10) and what
  `SdeUpdateDeps.getSdeMeta` is structurally compatible with (`{ buildNumber: number } | null`).
- `GlobalSyncJob` (T8) is the declared type of `sdeUpdateJob` and `createSdeUpdateJob`'s return (T9),
  and `SyncJob[]` in `src/worker/index.ts` accepts both variants.
- `readJsonlMember(zipPath, memberName)` (T2) is called with a `.jsonl`-suffixed member everywhere
  (T3, T5, tests); `SdeTable.member` is the *base* name and T5 appends `.jsonl`.
- `writeZip(destPath, members: ZipMember[])` (T2) is used identically by T3's generator and T5's
  broken-fixture helper.

**4. Ambiguities in the spec that this plan resolves**

- `SdeTable.columns` is `{ name, type }[]` rather than plain names — the importer needs a Postgres
  element type per column to build `unnest($1::int[], …)`.
- `SyncJob.scope` is optional on the character variant so that phase-1 job literals and the existing
  scheduler tests keep compiling; a missing `scope` means `"character"`.
- `fetchLatestBuild`/`downloadSde` read `process.env.ESI_USER_AGENT` directly (with a fallback)
  instead of going through `getConfig()`, which would demand unrelated env vars.
- The spec's `readJsonlMember` returns `AsyncIterable`; the implementation is an `AsyncGenerator`,
  which satisfies it and gives callers `break` semantics that close the zip handle.
- A minimal zip **writer** (`scripts/lib/zip.ts`) was added because `yauzl` cannot write and the
  spec allows no other dependency; it is build/test tooling, never shipped in a request path.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { Pool } from "pg";
import { resetDb, resetSde } from "./helpers.js";
import { closePool } from "../../src/lib/db/client.js";
import { importSde, SDE_STAGING_SCHEMA } from "../../src/lib/sde/import.js";
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
  sde_alpha_skills: 175,
  sde_skill_plans: 40,
  sde_races: 11,
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
    "cloneGrades.jsonl", "skillPlans.jsonl", "races.jsonl",
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

  it("rejects an invalid releaseDate in _sde.jsonl before any staging work", async () => {
    // Start from a known-clean slate: an earlier test may have left a failed-load's staging schema
    // behind (it is only dropped at the start of the *next* importSde call), which would make a
    // pre-existing schema look like this test's own staging work.
    await pool.query("DROP SCHEMA IF EXISTS sde_import CASCADE");
    const dest = path.join(tmp, "invalid-date.zip");
    await writeZip(dest, [{ name: "_sde.jsonl", content: '{"_key":"sde","buildNumber":3484357,"releaseDate":"not-a-date"}\n' }]);
    await expect(importSde(dest, pool)).rejects.toThrow(/invalid releaseDate/i);
    const { rows: schemas } = await pool.query("SELECT 1 FROM information_schema.schemata WHERE schema_name = 'sde_import'");
    expect(schemas.length).toBe(0);
    const { rows: types } = await pool.query<{ count: string }>("SELECT count(*) FROM sde_types");
    expect(Number(types[0].count)).toBe(10);
  }, 60_000);

  it("leaves ANALYZE statistics on the swapped-in table", async () => {
    await importSde(FIXTURE_ZIP, pool);
    // pg_stat_user_tables can lag a beat behind the ANALYZE that produced it; pg_stats (which the
    // planner reads from) is populated synchronously by the ANALYZE command itself, so assert there.
    const { rows } = await pool.query<{ count: string }>(
      "SELECT count(*) FROM pg_stats WHERE schemaname = 'public' AND tablename = 'sde_type_attributes'");
    expect(Number(rows[0].count)).toBeGreaterThan(0);
  }, 120_000);

  it("keeps the previous SDE live when the load itself fails partway through", async () => {
    const { rows: before } = await pool.query<{ count: string }>("SELECT count(*) FROM sde_types");
    const { rows: metaBefore } = await pool.query<{ build_number: number; imported_at: Date }>(
      "SELECT build_number, imported_at FROM sde_meta WHERE id = 1");

    let failed = false;
    const failingPool = {
      query: (...args: unknown[]) => {
        const sql = args[0];
        if (!failed && typeof sql === "string" && sql.startsWith(`INSERT INTO ${SDE_STAGING_SCHEMA}.sde_types `)) {
          failed = true;
          return Promise.reject(new Error("simulated mid-load failure"));
        }
        return (pool.query as (...a: unknown[]) => Promise<unknown>)(...args);
      },
      connect: () => pool.connect(),
    } as unknown as Pool;

    await expect(importSde(FIXTURE_ZIP, failingPool)).rejects.toThrow(/simulated mid-load failure/);

    const { rows: after } = await pool.query<{ count: string }>("SELECT count(*) FROM sde_types");
    expect(Number(after[0].count)).toBe(Number(before[0].count));
    const { rows: metaAfter } = await pool.query<{ build_number: number; imported_at: Date }>(
      "SELECT build_number, imported_at FROM sde_meta WHERE id = 1");
    expect(metaAfter[0]).toEqual(metaBefore[0]);

    // a normal import afterwards succeeds — the leftover sde_import schema is dropped at the start
    const result = await importSde(FIXTURE_ZIP, pool);
    expect(result.buildNumber).toBe(3484357);
    const { rows: types } = await pool.query<{ count: string }>("SELECT count(*) FROM sde_types");
    expect(Number(types[0].count)).toBe(10);
  }, 120_000);
});

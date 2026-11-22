import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import type { Pool } from "pg";
import { resetDb, resetSde } from "./helpers.js";
import { closePool } from "../../src/lib/db/client.js";
import { emptySdeTables, getAlphaSkills, getCareerPlan, getMasteryRequirements, getRaces, listCareerPlans, listPlanSkills } from "../../src/lib/sde/repo.js";

let pool: Pool;
beforeAll(async () => { pool = await resetDb(); });
afterAll(async () => { await closePool(); });
beforeEach(async () => { await resetSde(pool); });

describe("getAlphaSkills", () => {
  it("maps skill id to the Alpha cap", async () => {
    await pool.query("INSERT INTO sde_alpha_skills (skill_id, max_level) VALUES (3300, 5), (3327, 3)");
    const alpha = await getAlphaSkills();
    expect(alpha.get(3300)).toBe(5);
    expect(alpha.get(3327)).toBe(3);
    expect(alpha.has(11207)).toBe(false);
  });
});

describe("getRaces", () => {
  it("maps race id to name", async () => {
    await pool.query("INSERT INTO sde_races (id, name) VALUES (1, 'Caldari'), (2, 'Minmatar')");
    const races = await getRaces();
    expect(races.get(1)).toBe("Caldari");
    expect(races.get(2)).toBe("Minmatar");
    expect(races.has(4)).toBe(false);
  });

  it("is empty when the table has no rows", async () => {
    const races = await getRaces();
    expect(races.size).toBe(0);
  });
});

describe("listCareerPlans / getCareerPlan", () => {
  beforeEach(async () => {
    await pool.query(
      `INSERT INTO sde_skill_plans (id, name, description, skills, milestones) VALUES
        (4, 'Minmatar Militia Fighter', 'Fly frigates.',
         '[{"skillId":3327,"level":1},{"skillId":3329,"level":3}]'::jsonb,
         '[{"skillId":3329,"level":3}]'::jsonb),
        (14, 'Manufacturer', 'Build things.', '[]'::jsonb, '[]'::jsonb)`);
  });

  it("lists plans name-ascending with parsed skill arrays", async () => {
    const plans = await listCareerPlans();
    expect(plans.map((p) => p.name)).toEqual(["Manufacturer", "Minmatar Militia Fighter"]);
    expect(plans[1].skills).toEqual([{ skillId: 3327, level: 1 }, { skillId: 3329, level: 3 }]);
    expect(plans[1].milestones).toEqual([{ skillId: 3329, level: 3 }]);
  });

  it("reads one plan and answers null for an unknown id", async () => {
    expect((await getCareerPlan(4))?.name).toBe("Minmatar Militia Fighter");
    expect(await getCareerPlan(999)).toBeNull();
  });
});

describe("listPlanSkills", () => {
  beforeEach(async () => {
    await pool.query(
      `INSERT INTO sde_groups (id, category_id, name, published) VALUES
        (255, 16, 'Gunnery', true), (505, 16, 'Fake Skills', false), (25, 6, 'Frigate', true)`);
    await pool.query(
      `INSERT INTO sde_types (id, group_id, name, published) VALUES
        (3300, 255, 'Gunnery', true), (3318, 255, 'Weapon Upgrades', true),
        (11207, 255, 'Advanced Weapon Upgrades', true),
        (9998, 255, 'Retired Skill', false), (9997, 505, 'Fake Skill', true),
        (587, 25, 'Rifter', true)`);
    // Gunnery: rank 1, perception/willpower, no prerequisites.
    // Weapon Upgrades: rank 2, perception/memory, needs Gunnery II.
    // Advanced Weapon Upgrades: rank 6, perception/willpower, needs Weapon Upgrades IV.
    await pool.query(
      `INSERT INTO sde_type_attributes (type_id, attribute_id, value) VALUES
        (3300, 275, 1), (3300, 180, 167), (3300, 181, 168),
        (3318, 275, 2), (3318, 180, 167), (3318, 181, 166), (3318, 182, 3300), (3318, 277, 2),
        (11207, 275, 6), (11207, 180, 167), (11207, 181, 168), (11207, 182, 3318), (11207, 277, 4),
        (587, 275, 1)`);
  });

  it("returns published skills in published skill groups only, name-ascending", async () => {
    const skills = await listPlanSkills();
    expect(skills.map((s) => s.id)).toEqual([11207, 3300, 3318]);   // by name
    expect(skills.map((s) => s.name)).toEqual(["Advanced Weapon Upgrades", "Gunnery", "Weapon Upgrades"]);
  });

  it("rounds the rank and the attribute ids and collects prerequisites", async () => {
    const skills = await listPlanSkills();
    const awu = skills.find((s) => s.id === 11207)!;
    expect(awu).toMatchObject({ groupId: 255, groupName: "Gunnery", rank: 6, primaryAttr: 167, secondaryAttr: 168 });
    expect(awu.prereqs).toEqual([{ skillId: 3318, level: 4 }]);
    expect(skills.find((s) => s.id === 3300)!.prereqs).toEqual([]);
  });
});

describe("getMasteryRequirements", () => {
  beforeEach(async () => {
    // Hull 587: levels 0–3 name certificate 96; level 4 names 96 and 117. Hull 588: level 0 only.
    await pool.query(`INSERT INTO sde_masteries (type_id, level, certificate_id) VALUES
      (587, 0, 96), (587, 1, 96), (587, 2, 96), (587, 3, 96), (587, 4, 96), (587, 4, 117), (588, 0, 117)`);
    await pool.query(`INSERT INTO sde_certificate_skills (certificate_id, skill_id, basic, standard, improved, advanced, elite) VALUES
      (96, 3413, 1, 3, 4, 5, 5), (96, 3418, 0, 1, 3, 4, 5), (117, 3413, 2, 2, 2, 2, 4), (117, 3300, 1, 1, 1, 1, 3)`);
  });

  it("reads each level at its own tier and leaves out skills the tier does not ask for", async () => {
    const levels = (await getMasteryRequirements([587])).get(587)!;
    expect(levels).toHaveLength(5);
    expect([...levels[0]]).toEqual([[3413, 1]]);                        // basic: 3418 is 0, so not asked
    expect(Object.fromEntries(levels[1])).toEqual({ 3413: 3, 3418: 1 });
    expect(Object.fromEntries(levels[3])).toEqual({ 3413: 5, 3418: 4 });
  });
  it("takes the highest level any certificate asks of a shared skill", async () => {
    const levels = (await getMasteryRequirements([587])).get(587)!;
    expect(Object.fromEntries(levels[4])).toEqual({ 3413: 5, 3418: 5, 3300: 3 });
  });
  it("answers for several hulls at once and omits one with no mastery data", async () => {
    const out = await getMasteryRequirements([587, 588, 999, 587]);
    expect([...out.keys()].sort()).toEqual([587, 588]);
    expect([...out.get(588)![0]]).toEqual(expect.arrayContaining([[3413, 2], [3300, 1]]));
    expect(out.get(588)![1].size).toBe(0);
    expect((await getMasteryRequirements([])).size).toBe(0);
  });
  it("is empty, not an error, before the mastery tables exist", async () => {
    await pool.query("DROP TABLE sde_masteries");
    expect((await getMasteryRequirements([587])).size).toBe(0);
  });
});

describe("emptySdeTables", () => {
  it("names tables with no rows, and ones that are missing", async () => {
    await pool.query("INSERT INTO sde_races (id, name) VALUES (1, 'Caldari')");
    expect(await emptySdeTables(["sde_races", "sde_alpha_skills"])).toEqual(["sde_alpha_skills"]);
    await pool.query("DROP TABLE IF EXISTS sde_masteries");
    expect(await emptySdeTables(["sde_races", "sde_masteries"])).toEqual(["sde_masteries"]);
  });
  it("refuses anything that is not an sde table name", async () => {
    await expect(emptySdeTables(["characters"])).rejects.toThrow(/not an sde table/);
  });
});

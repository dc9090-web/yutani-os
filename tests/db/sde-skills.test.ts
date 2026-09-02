import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import type { Pool } from "pg";
import { resetDb, resetSde } from "./helpers.js";
import { closePool } from "../../src/lib/db/client.js";
import { getAlphaSkills, getCareerPlan, getRaces, listCareerPlans, listPlanSkills } from "../../src/lib/sde/repo.js";

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

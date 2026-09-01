import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import type { Pool } from "pg";
import { resetDb, resetSde } from "./helpers.js";
import { closePool } from "../../src/lib/db/client.js";
import { loadSkillCatalogue } from "../../src/lib/skills/load.js";

let pool: Pool;
beforeAll(async () => { pool = await resetDb(); });
afterAll(async () => { await closePool(); });

beforeEach(async () => {
  await resetSde(pool);
  await pool.query("INSERT INTO sde_groups (id, category_id, name, published) VALUES (255, 16, 'Gunnery', true)");
  await pool.query(
    `INSERT INTO sde_types (id, group_id, name, published) VALUES
      (3300, 255, 'Gunnery', true), (11207, 255, 'Advanced Weapon Upgrades', true)`);
  await pool.query(
    `INSERT INTO sde_type_attributes (type_id, attribute_id, value) VALUES
      (3300, 275, 1), (3300, 180, 167), (3300, 181, 168),
      (11207, 275, 6), (11207, 180, 167), (11207, 181, 168), (11207, 182, 3318), (11207, 277, 4)`);
  await pool.query("INSERT INTO sde_alpha_skills (skill_id, max_level) VALUES (3300, 5)");
});

describe("loadSkillCatalogue", () => {
  it("joins the skill rows to the Alpha caps", async () => {
    const skills = await loadSkillCatalogue();
    expect(skills.map((s) => s.id)).toEqual([11207, 3300]);            // name-ascending
    expect(skills.find((s) => s.id === 3300)).toMatchObject({
      name: "Gunnery", groupName: "Gunnery", rank: 1, primaryAttr: 167, secondaryAttr: 168,
      prereqs: [], alphaMaxLevel: 5,
    });
    expect(skills.find((s) => s.id === 11207)).toMatchObject({
      rank: 6, prereqs: [{ skillId: 3318, level: 4 }], alphaMaxLevel: null,
    });
  });
});

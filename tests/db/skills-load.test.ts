import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import type { Pool } from "pg";
import { resetDb, resetSde } from "./helpers.js";
import { closePool } from "../../src/lib/db/client.js";
import { loadSkillCatalogue, accountTrainingBlock, computePlan, loadPlanContext, DEFAULT_BASE_ATTRIBUTES } from "../../src/lib/skills/load.js";
import { createPlan } from "../../src/lib/db/skill-plans.js";

let pool: Pool;
beforeAll(async () => { pool = await resetDb(); });
afterAll(async () => { await closePool(); });

beforeEach(async () => {
  await resetSde(pool);
  await pool.query("INSERT INTO sde_groups (id, category_id, name, published) VALUES (255, 16, 'Gunnery', true)");
  await pool.query(
    `INSERT INTO sde_types (id, group_id, name, published) VALUES
      (3300, 255, 'Gunnery', true), (11207, 255, 'Advanced Weapon Upgrades', true),
      (3413, 255, 'Power Grid Management', true)`);
  await pool.query(
    `INSERT INTO sde_type_attributes (type_id, attribute_id, value) VALUES
      (3300, 275, 1), (3300, 180, 167), (3300, 181, 168),
      (11207, 275, 6), (11207, 180, 167), (11207, 181, 168), (11207, 182, 3318), (11207, 277, 4),
      (3413, 275, 1), (3413, 180, 165), (3413, 181, 166)`);
  await pool.query("INSERT INTO sde_alpha_skills (skill_id, max_level) VALUES (3300, 5)");
});

describe("loadSkillCatalogue", () => {
  it("joins the skill rows to the Alpha caps", async () => {
    const skills = await loadSkillCatalogue();
    expect(skills.map((s) => s.id)).toEqual([11207, 3300, 3413]);      // name-ascending
    expect(skills.find((s) => s.id === 3300)).toMatchObject({
      name: "Gunnery", groupName: "Gunnery", rank: 1, primaryAttr: 167, secondaryAttr: 168,
      prereqs: [], alphaMaxLevel: 5,
    });
    expect(skills.find((s) => s.id === 11207)).toMatchObject({
      rank: 6, prereqs: [{ skillId: 3318, level: 4 }], alphaMaxLevel: null,
    });
  });
});

describe("loadPlanContext", () => {
  beforeEach(async () => {
    await pool.query("TRUNCATE characters RESTART IDENTITY CASCADE");
    await pool.query(
      `INSERT INTO characters (id, name, refresh_token_enc) VALUES (669539978, 'TrilliumONE', 'enc')`);
  });

  it("falls back to EVE's displayed baseline when nothing is synced", async () => {
    const ctx = await loadPlanContext(669539978);
    expect(ctx.base).toEqual(DEFAULT_BASE_ATTRIBUTES);
    expect(DEFAULT_BASE_ATTRIBUTES).toEqual(
      { charisma: 19, intelligence: 20, memory: 20, perception: 20, willpower: 20 });
    expect(ctx.effective).toEqual(DEFAULT_BASE_ATTRIBUTES);
    expect(ctx.attributesSane).toBe(true);
    expect(ctx.synced).toBe(false);
    expect(ctx.queueEndsAt).toBeNull();
    expect(ctx.trained.size).toBe(0);
  });

  it("adds implant bonuses to the stored base and reads the queue", async () => {
    await pool.query(
      `INSERT INTO character_attributes (character_id, charisma, intelligence, memory, perception, willpower, bonus_remaps)
       VALUES (669539978, 18, 20, 18, 21, 22, 2)`);
    // Ocular Filter - Basic (+3 perception) and Neural Boost - Basic (+3 willpower).
    await pool.query("INSERT INTO character_implants (character_id, type_id) VALUES (669539978, 9899), (669539978, 9942)");
    await pool.query(
      `INSERT INTO sde_type_attributes (type_id, attribute_id, value) VALUES
        (9899, 178, 3), (9899, 331, 1), (9942, 179, 3), (9942, 331, 3)`);
    await pool.query(
      `INSERT INTO character_skills (character_id, skill_id, trained_level, active_level, skillpoints)
       VALUES (669539978, 3300, 2, 2, 3000)`);
    await pool.query(
      `INSERT INTO character_skill_queue
         (character_id, queue_position, skill_id, finished_level, start_date, finish_date, training_start_sp, level_end_sp)
       VALUES (669539978, 0, 3300, 3, '2026-09-01T00:00:00Z', '2026-09-08T00:00:00Z', 1415, 8000),
              (669539978, 1, 3300, 4, '2026-09-08T00:00:00Z', '2026-09-20T00:00:00Z', 8000, 45255)`);

    const ctx = await loadPlanContext(669539978);
    expect(ctx.base).toEqual({ charisma: 18, intelligence: 20, memory: 18, perception: 21, willpower: 22 });
    expect(ctx.implantBonus).toEqual({ charisma: 0, intelligence: 0, memory: 0, perception: 3, willpower: 3 });
    expect(ctx.effective).toEqual({ charisma: 18, intelligence: 20, memory: 18, perception: 24, willpower: 25 });
    expect(ctx.attributesSane).toBe(true);
    expect(ctx.synced).toBe(true);
    expect(ctx.trained.get(3300)).toBe(2);
    expect(ctx.queued.get(3300)).toBe(4);                       // the highest level the queue delivers
    expect(ctx.queueEndsAt?.toISOString()).toBe("2026-09-20T00:00:00.000Z");
    expect(ctx.bonusRemaps).toBe(2);
    expect(ctx.partialSp.get(3300)).toBeGreaterThanOrEqual(3000);
  });

  it("flags attributes that cannot be a legal base", async () => {
    await pool.query(
      `INSERT INTO character_attributes (character_id, charisma, intelligence, memory, perception, willpower)
       VALUES (669539978, 24, 25, 25, 26, 27)`);                 // sums to 127, so implants are baked in
    expect((await loadPlanContext(669539978)).attributesSane).toBe(false);
  });
});

describe("accountTrainingBlock", () => {
  beforeEach(async () => {
    await pool.query("TRUNCATE characters, accounts RESTART IDENTITY CASCADE");
    await pool.query("INSERT INTO accounts (id, name) VALUES (1, 'Account one')");
    await pool.query(
      `INSERT INTO characters (id, name, refresh_token_enc, account_id) VALUES
        (669539978, 'TrilliumONE', 'enc', 1), (95465499, 'Reacher-9', 'enc', 1),
        (11111111, 'Loner', 'enc', NULL)`);
  });

  it("names the account-mate whose queue runs longest into the future", async () => {
    await pool.query(
      `INSERT INTO character_skill_queue (character_id, queue_position, skill_id, finished_level, start_date, finish_date)
       VALUES (95465499, 0, 3300, 5, '2026-09-01T00:00:00Z', '2026-09-30T00:00:00Z'),
              (95465499, 1, 3318, 4, '2026-09-30T00:00:00Z', '2026-10-05T00:00:00Z')`);
    const block = await accountTrainingBlock(669539978, new Date("2026-09-02T00:00:00Z"));
    expect(block).toEqual({ characterId: 95465499, name: "Reacher-9", until: new Date("2026-10-05T00:00:00Z") });
  });

  it("is null when the mate's queue has already finished, and when there is no account", async () => {
    await pool.query(
      `INSERT INTO character_skill_queue (character_id, queue_position, skill_id, finished_level, start_date, finish_date)
       VALUES (95465499, 0, 3300, 5, '2026-08-01T00:00:00Z', '2026-08-10T00:00:00Z')`);
    expect(await accountTrainingBlock(669539978, new Date("2026-09-02T00:00:00Z"))).toBeNull();
    expect(await accountTrainingBlock(11111111, new Date("2026-09-02T00:00:00Z"))).toBeNull();
  });
});

describe("computePlan", () => {
  beforeEach(async () => {
    await pool.query("TRUNCATE characters RESTART IDENTITY CASCADE");
    await pool.query("INSERT INTO characters (id, name, refresh_token_enc) VALUES (669539978, 'TrilliumONE', 'enc')");
    await pool.query(
      `INSERT INTO character_attributes (character_id, charisma, intelligence, memory, perception, willpower)
       VALUES (669539978, 18, 20, 18, 21, 22)`);
  });

  it("expands and prices the plan from now", async () => {
    const plan = await createPlan({ characterId: 669539978, name: "Gunnery", entries: [{ skillId: 3300, level: 3 }] });
    const now = new Date("2026-09-01T00:00:00Z");
    const computed = await computePlan(plan, { now });
    expect(computed.entries.map((e) => [e.skillId, e.level])).toEqual([[3300, 1], [3300, 2], [3300, 3]]);
    // perception 21 + willpower 22/2 = 32 SP/min; 8,000 SP total → 250 min → 15,000,000 ms.
    expect(computed.timeline.totalMs).toBe(15_000_000);
    expect(computed.startAt.toISOString()).toBe("2026-09-01T00:00:00.000Z");
    expect(computed.attributes).toEqual({ charisma: 18, intelligence: 20, memory: 18, perception: 21, willpower: 22 });
  });

  it("applies a remap and can start after the queue", async () => {
    await pool.query(
      `INSERT INTO character_skill_queue (character_id, queue_position, skill_id, finished_level, start_date, finish_date)
       VALUES (669539978, 0, 3413, 5, '2026-09-01T00:00:00Z', '2026-09-05T00:00:00Z')`);
    const plan = await createPlan({ characterId: 669539978, name: "Gunnery", entries: [{ skillId: 3300, level: 5 }] });
    const remap = { charisma: 17, intelligence: 17, memory: 17, perception: 27, willpower: 21 };
    const computed = await computePlan(plan, { now: new Date("2026-09-01T00:00:00Z"), afterQueue: true, remap });
    expect(computed.startAt.toISOString()).toBe("2026-09-05T00:00:00.000Z");
    expect(computed.attributes).toEqual(remap);
    // 256,000 SP at 27 + 21/2 = 37.5 SP/min → 6,826.66… min → 409,600,000 ms.
    expect(computed.timeline.totalMs).toBe(409_600_000);
    expect(computed.timeline.doneAt.toISOString()).toBe("2026-09-09T17:46:40.000Z");
  });
});

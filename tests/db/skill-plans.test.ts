import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import type { Pool } from "pg";
import { resetDb } from "./helpers.js";
import { closePool } from "../../src/lib/db/client.js";
import { createPlan, deletePlan, getPlan, listPlans, updatePlan } from "../../src/lib/db/skill-plans.js";
import type { AttributeSet } from "../../src/lib/skills/attributes.js";

const REMAP: AttributeSet = { charisma: 17, intelligence: 17, memory: 17, perception: 27, willpower: 21 };

let pool: Pool;
beforeAll(async () => { pool = await resetDb(); });
afterAll(async () => { await closePool(); });

beforeEach(async () => {
  await pool.query("TRUNCATE characters RESTART IDENTITY CASCADE");
  await pool.query(
    `INSERT INTO characters (id, name, refresh_token_enc) VALUES
      (669539978, 'TrilliumONE', 'enc'), (95465499, 'Reacher-9', 'enc')`);
});

describe("createPlan / getPlan", () => {
  it("stores the head, the remap and the entries in order", async () => {
    const plan = await createPlan({
      characterId: 669539978, name: "Gunnery", remap: REMAP,
      entries: [{ skillId: 3300, level: 5 }, { skillId: 3318, level: 4, note: "for AWU" }],
    });
    expect(plan).toMatchObject({ characterId: 669539978, name: "Gunnery", remap: REMAP });
    expect(plan.entries).toEqual([
      { position: 0, skillId: 3300, level: 5, note: null },
      { position: 1, skillId: 3318, level: 4, note: "for AWU" },
    ]);
    expect(await getPlan(plan.id)).toEqual(plan);
  });

  it("defaults the remap to null and the entries to empty", async () => {
    const plan = await createPlan({ characterId: 669539978, name: "Empty" });
    expect(plan.remap).toBeNull();
    expect(plan.entries).toEqual([]);
  });

  it("answers null for an unknown id", async () => {
    expect(await getPlan(999999)).toBeNull();
  });
});

describe("listPlans", () => {
  it("returns only that character's plans, newest first", async () => {
    const first = await createPlan({ characterId: 669539978, name: "First", entries: [{ skillId: 3300, level: 1 }] });
    const second = await createPlan({ characterId: 669539978, name: "Second" });
    await createPlan({ characterId: 95465499, name: "Someone else's" });
    const plans = await listPlans(669539978);
    expect(plans.map((p) => p.name)).toEqual(["Second", "First"]);
    expect(plans.find((p) => p.id === first.id)!.entries).toHaveLength(1);
    expect(plans.find((p) => p.id === second.id)!.entries).toEqual([]);
  });
});

describe("updatePlan", () => {
  it("replaces the entries wholesale and touches updated_at", async () => {
    const plan = await createPlan({
      characterId: 669539978, name: "Gunnery", entries: [{ skillId: 3300, level: 5 }],
    });
    const updated = await updatePlan(plan.id, {
      name: "Gunnery and frigates",
      entries: [{ skillId: 3327, level: 1 }, { skillId: 3329, level: 3 }],
    });
    expect(updated!.name).toBe("Gunnery and frigates");
    expect(updated!.entries.map((e) => [e.position, e.skillId, e.level]))
      .toEqual([[0, 3327, 1], [1, 3329, 3]]);
    expect(updated!.updatedAt.getTime()).toBeGreaterThanOrEqual(plan.updatedAt.getTime());
  });

  it("leaves the entries alone when the patch omits them, and clears a remap with null", async () => {
    const plan = await createPlan({
      characterId: 669539978, name: "Gunnery", remap: REMAP, entries: [{ skillId: 3300, level: 5 }],
    });
    const renamed = await updatePlan(plan.id, { name: "Renamed" });
    expect(renamed!.entries).toHaveLength(1);
    expect(renamed!.remap).toEqual(REMAP);
    const cleared = await updatePlan(plan.id, { remap: null });
    expect(cleared!.remap).toBeNull();
    expect(cleared!.entries).toHaveLength(1);
  });

  it("can empty a plan and answers null for an unknown id", async () => {
    const plan = await createPlan({ characterId: 669539978, name: "Gunnery", entries: [{ skillId: 3300, level: 5 }] });
    expect((await updatePlan(plan.id, { entries: [] }))!.entries).toEqual([]);
    expect(await updatePlan(999999, { name: "nope" })).toBeNull();
  });
});

describe("deletePlan and cascades", () => {
  it("deletes a plan and its entries, and reports an unknown id", async () => {
    const plan = await createPlan({ characterId: 669539978, name: "Gunnery", entries: [{ skillId: 3300, level: 5 }] });
    expect(await deletePlan(plan.id)).toBe(true);
    expect(await getPlan(plan.id)).toBeNull();
    const { rows } = await pool.query("SELECT count(*) FROM skill_plan_entries WHERE plan_id = $1", [plan.id]);
    expect(rows[0].count).toBe("0");
    expect(await deletePlan(plan.id)).toBe(false);
  });

  it("dies with its character", async () => {
    const plan = await createPlan({ characterId: 95465499, name: "Doomed", entries: [{ skillId: 3300, level: 1 }] });
    await pool.query("DELETE FROM characters WHERE id = 95465499");
    expect(await getPlan(plan.id)).toBeNull();
  });
});

import type { PoolClient } from "pg";
import { getPool } from "./client.js";

export interface SkillSummary { characterId: number; totalSp: number; unallocatedSp: number | null; updatedAt: Date }
export interface SkillRow { skillId: number; trainedLevel: number; activeLevel: number; skillpoints: number }
export interface SkillQueueRow {
  queuePosition: number; skillId: number; finishedLevel: number;
  startDate: Date | null; finishDate: Date | null;
  levelStartSp: number | null; levelEndSp: number | null; trainingStartSp: number | null;
}
export interface AttributesInput {
  charisma: number; intelligence: number; memory: number; perception: number; willpower: number;
  bonusRemaps: number | null; lastRemapDate: Date | null; accruedRemapCooldownDate: Date | null;
}
export interface AttributesRow extends AttributesInput { characterId: number; updatedAt: Date }

/** A `null` section was not synced this run (the token lacks its scope) — leave the stored rows alone. */
export interface SkillsWrite {
  summary: { totalSp: number; unallocatedSp: number | null } | null;
  skills: SkillRow[] | null;
  queue: SkillQueueRow[] | null;
  attributes: AttributesInput | null;
}

/** bigint columns arrive from pg as strings. */
const num = (v: string | number | null): number | null => (v === null ? null : Number(v));
const bigints = (v: (number | null)[]): (string | null)[] => v.map((n) => (n === null ? null : String(n)));

/** Everything in one transaction: a half-written skill sheet is worse than a stale one. */
export async function replaceSkills(characterId: number, w: SkillsWrite): Promise<number> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    let rows = 0;
    if (w.summary) {
      await client.query(
        `INSERT INTO character_skill_summary (character_id, total_sp, unallocated_sp, updated_at)
         VALUES ($1, $2, $3, now())
         ON CONFLICT (character_id) DO UPDATE SET total_sp = EXCLUDED.total_sp,
           unallocated_sp = EXCLUDED.unallocated_sp, updated_at = now()`,
        [characterId, String(w.summary.totalSp), w.summary.unallocatedSp === null ? null : String(w.summary.unallocatedSp)]);
      rows += 1;
    }
    if (w.skills) {
      await client.query("DELETE FROM character_skills WHERE character_id = $1", [characterId]);
      if (w.skills.length) {
        await client.query(
          `INSERT INTO character_skills (character_id, skill_id, trained_level, active_level, skillpoints)
           SELECT $1, * FROM unnest($2::int[], $3::int[], $4::int[], $5::bigint[])`,
          [characterId, w.skills.map((s) => s.skillId), w.skills.map((s) => s.trainedLevel),
           w.skills.map((s) => s.activeLevel), w.skills.map((s) => String(s.skillpoints))]);
      }
      rows += w.skills.length;
    }
    if (w.queue) {
      await client.query("DELETE FROM character_skill_queue WHERE character_id = $1", [characterId]);
      if (w.queue.length) {
        await client.query(
          `INSERT INTO character_skill_queue (character_id, queue_position, skill_id, finished_level,
             start_date, finish_date, level_start_sp, level_end_sp, training_start_sp)
           SELECT $1, * FROM unnest($2::int[], $3::int[], $4::int[], $5::timestamptz[], $6::timestamptz[],
             $7::bigint[], $8::bigint[], $9::bigint[])`,
          [characterId, w.queue.map((q) => q.queuePosition), w.queue.map((q) => q.skillId),
           w.queue.map((q) => q.finishedLevel), w.queue.map((q) => q.startDate), w.queue.map((q) => q.finishDate),
           bigints(w.queue.map((q) => q.levelStartSp)), bigints(w.queue.map((q) => q.levelEndSp)),
           bigints(w.queue.map((q) => q.trainingStartSp))]);
      }
      rows += w.queue.length;
    }
    if (w.attributes) {
      await writeAttributes(client, characterId, w.attributes);
      rows += 1;
    }
    await client.query("COMMIT");
    return rows;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

async function writeAttributes(client: PoolClient, characterId: number, a: AttributesInput): Promise<void> {
  await client.query(
    `INSERT INTO character_attributes (character_id, charisma, intelligence, memory, perception, willpower,
       bonus_remaps, last_remap_date, accrued_remap_cooldown_date, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, now())
     ON CONFLICT (character_id) DO UPDATE SET charisma = EXCLUDED.charisma, intelligence = EXCLUDED.intelligence,
       memory = EXCLUDED.memory, perception = EXCLUDED.perception, willpower = EXCLUDED.willpower,
       bonus_remaps = EXCLUDED.bonus_remaps, last_remap_date = EXCLUDED.last_remap_date,
       accrued_remap_cooldown_date = EXCLUDED.accrued_remap_cooldown_date, updated_at = now()`,
    [characterId, a.charisma, a.intelligence, a.memory, a.perception, a.willpower,
     a.bonusRemaps, a.lastRemapDate, a.accruedRemapCooldownDate]);
}

export async function getSkillSummary(characterId: number): Promise<SkillSummary | null> {
  const { rows } = await getPool().query<{ characterId: string; totalSp: string; unallocatedSp: string | null; updatedAt: Date }>(
    `SELECT character_id AS "characterId", total_sp AS "totalSp", unallocated_sp AS "unallocatedSp",
            updated_at AS "updatedAt" FROM character_skill_summary WHERE character_id = $1`, [characterId]);
  const r = rows[0];
  return r ? { characterId: Number(r.characterId), totalSp: Number(r.totalSp), unallocatedSp: num(r.unallocatedSp), updatedAt: r.updatedAt } : null;
}

export async function listSkills(characterId: number): Promise<SkillRow[]> {
  const { rows } = await getPool().query<{ skillId: number; trainedLevel: number; activeLevel: number; skillpoints: string }>(
    `SELECT skill_id AS "skillId", trained_level AS "trainedLevel", active_level AS "activeLevel",
            skillpoints FROM character_skills WHERE character_id = $1 ORDER BY skill_id`, [characterId]);
  return rows.map((r) => ({ ...r, skillpoints: Number(r.skillpoints) }));
}

export async function listSkillQueue(characterId: number): Promise<SkillQueueRow[]> {
  const { rows } = await getPool().query<Omit<SkillQueueRow, "levelStartSp" | "levelEndSp" | "trainingStartSp"> &
    { levelStartSp: string | null; levelEndSp: string | null; trainingStartSp: string | null }>(
    `SELECT queue_position AS "queuePosition", skill_id AS "skillId", finished_level AS "finishedLevel",
            start_date AS "startDate", finish_date AS "finishDate", level_start_sp AS "levelStartSp",
            level_end_sp AS "levelEndSp", training_start_sp AS "trainingStartSp"
     FROM character_skill_queue WHERE character_id = $1 ORDER BY queue_position`, [characterId]);
  return rows.map((r) => ({ ...r, levelStartSp: num(r.levelStartSp), levelEndSp: num(r.levelEndSp), trainingStartSp: num(r.trainingStartSp) }));
}

export async function getAttributes(characterId: number): Promise<AttributesRow | null> {
  const { rows } = await getPool().query<Omit<AttributesRow, "characterId"> & { characterId: string }>(
    `SELECT character_id AS "characterId", charisma, intelligence, memory, perception, willpower,
            bonus_remaps AS "bonusRemaps", last_remap_date AS "lastRemapDate",
            accrued_remap_cooldown_date AS "accruedRemapCooldownDate", updated_at AS "updatedAt"
     FROM character_attributes WHERE character_id = $1`, [characterId]);
  return rows[0] ? { ...rows[0], characterId: Number(rows[0].characterId) } : null;
}

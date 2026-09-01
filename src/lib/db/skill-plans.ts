import { getPool } from "./client.js";
import type { PoolClient } from "pg";
import type { AttributeSet } from "../skills/attributes.js";
import type { PlanEntry } from "../skills/expand.js";

export interface PlanEntryRow { position: number; skillId: number; level: number; note: string | null }
export interface PlanRow {
  id: number; characterId: number; name: string; remap: AttributeSet | null;
  createdAt: Date; updatedAt: Date; entries: PlanEntryRow[];
}
export interface PlanInput {
  characterId: number; name: string; remap?: AttributeSet | null; entries?: PlanEntry[];
}
export interface PlanPatch { name?: string; remap?: AttributeSet | null; entries?: PlanEntry[] }

interface HeadRow {
  id: number; characterId: string; name: string; remap: AttributeSet | null;
  createdAt: Date; updatedAt: Date;
}
interface EntryDbRow { planId: number; position: number; skillId: number; level: number; note: string | null }

const HEAD_COLS = `id, character_id AS "characterId", name, remap,
  created_at AS "createdAt", updated_at AS "updatedAt"`;
const ENTRY_COLS = `plan_id AS "planId", position, skill_id AS "skillId", level, note`;

/** bigint columns arrive from pg as strings. */
const head = (r: HeadRow, entries: PlanEntryRow[]): PlanRow => ({
  ...r, characterId: Number(r.characterId), entries,
});
const entry = (r: EntryDbRow): PlanEntryRow => ({
  position: r.position, skillId: r.skillId, level: r.level, note: r.note,
});

export async function listPlans(characterId: number): Promise<PlanRow[]> {
  const pool = getPool();
  const { rows } = await pool.query<HeadRow>(
    `SELECT ${HEAD_COLS} FROM skill_plans WHERE character_id = $1 ORDER BY updated_at DESC, id DESC`,
    [characterId]);
  if (rows.length === 0) return [];
  const { rows: entries } = await pool.query<EntryDbRow>(
    `SELECT ${ENTRY_COLS} FROM skill_plan_entries WHERE plan_id = ANY($1::int[]) ORDER BY plan_id, position`,
    [rows.map((r) => r.id)]);
  const byPlan = new Map<number, PlanEntryRow[]>();
  for (const r of entries) {
    const list = byPlan.get(r.planId);
    if (list) list.push(entry(r)); else byPlan.set(r.planId, [entry(r)]);
  }
  return rows.map((r) => head(r, byPlan.get(r.id) ?? []));
}

export async function getPlan(id: number): Promise<PlanRow | null> {
  const pool = getPool();
  const { rows } = await pool.query<HeadRow>(`SELECT ${HEAD_COLS} FROM skill_plans WHERE id = $1`, [id]);
  if (!rows[0]) return null;
  const { rows: entries } = await pool.query<EntryDbRow>(
    `SELECT ${ENTRY_COLS} FROM skill_plan_entries WHERE plan_id = $1 ORDER BY position`, [id]);
  return head(rows[0], entries.map(entry));
}

export async function createPlan(input: PlanInput): Promise<PlanRow> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query<HeadRow>(
      `INSERT INTO skill_plans (character_id, name, remap) VALUES ($1, $2, $3::jsonb)
       RETURNING ${HEAD_COLS}`,
      [String(input.characterId), input.name,
       input.remap === undefined || input.remap === null ? null : JSON.stringify(input.remap)]);
    const entries = input.entries ?? [];
    await writeEntries(client, rows[0].id, entries);
    await client.query("COMMIT");
    return head(rows[0], entries.map((e, i) => ({
      position: i, skillId: e.skillId, level: e.level, note: e.note ?? null,
    })));
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

export async function updatePlan(id: number, patch: PlanPatch): Promise<PlanRow | null> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    // `$4` says "the patch mentioned remap", so an explicit null clears it while an absent key does not.
    const { rows } = await client.query<HeadRow>(
      `UPDATE skill_plans SET name = COALESCE($2, name),
         remap = CASE WHEN $3 THEN $4::jsonb ELSE remap END, updated_at = now()
       WHERE id = $1 RETURNING ${HEAD_COLS}`,
      [id, patch.name ?? null, "remap" in patch,
       patch.remap === undefined || patch.remap === null ? null : JSON.stringify(patch.remap)]);
    if (!rows[0]) { await client.query("ROLLBACK"); return null; }
    if (patch.entries !== undefined) {
      await client.query("DELETE FROM skill_plan_entries WHERE plan_id = $1", [id]);
      await writeEntries(client, id, patch.entries);
    }
    await client.query("COMMIT");
    if (patch.entries !== undefined) {
      return head(rows[0], patch.entries.map((e, i) => ({
        position: i, skillId: e.skillId, level: e.level, note: e.note ?? null,
      })));
    }
    const { rows: entries } = await getPool().query<EntryDbRow>(
      `SELECT ${ENTRY_COLS} FROM skill_plan_entries WHERE plan_id = $1 ORDER BY position`, [id]);
    return head(rows[0], entries.map(entry));
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

export async function deletePlan(id: number): Promise<boolean> {
  const res = await getPool().query("DELETE FROM skill_plans WHERE id = $1", [id]);
  return (res.rowCount ?? 0) > 0;
}

/** One statement for the whole list — `position` is the array index, so the order is preserved. */
async function writeEntries(
  client: PoolClient, planId: number, entries: PlanEntry[],
): Promise<void> {
  if (entries.length === 0) return;
  await client.query(
    `INSERT INTO skill_plan_entries (plan_id, position, skill_id, level, note)
     SELECT $1, * FROM unnest($2::int[], $3::int[], $4::int[], $5::text[])`,
    [planId, entries.map((_, i) => i), entries.map((e) => e.skillId), entries.map((e) => e.level),
     entries.map((e) => e.note ?? null)]);
}

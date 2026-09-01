import { getPool } from "./client.js";
import type { FitItem, FitItemState } from "../fits/doc.js";

export interface FitRow {
  id: number; name: string; description: string; shipTypeId: number;
  characterId: number | null; createdAt: Date; updatedAt: Date; items: FitItem[];
}
export interface FitInput {
  name: string; shipTypeId: number; description?: string; characterId?: number | null; items?: FitItem[];
}
export interface FitPatch {
  name?: string; description?: string; characterId?: number | null; items?: FitItem[];
}

interface HeadRow {
  id: number; name: string; description: string; shipTypeId: number;
  characterId: string | null; createdAt: Date; updatedAt: Date;
}
interface ItemDbRow {
  fitId: number; typeId: number; quantity: number; flag: string;
  chargeTypeId: number | null; state: FitItemState;
}

const HEAD_COLS = `id, name, description, ship_type_id AS "shipTypeId",
  character_id AS "characterId", created_at AS "createdAt", updated_at AS "updatedAt"`;
const ITEM_COLS = `fit_id AS "fitId", type_id AS "typeId", quantity, flag,
  charge_type_id AS "chargeTypeId", state`;

/** bigint columns arrive from pg as strings. */
const head = (r: HeadRow, items: FitItem[]): FitRow => ({
  ...r, characterId: r.characterId === null ? null : Number(r.characterId), items,
});
const item = (r: ItemDbRow): FitItem => ({
  typeId: r.typeId, quantity: r.quantity, flag: r.flag, chargeTypeId: r.chargeTypeId, state: r.state,
});

export async function listFits(): Promise<FitRow[]> {
  const pool = getPool();
  const { rows } = await pool.query<HeadRow>(`SELECT ${HEAD_COLS} FROM fits ORDER BY updated_at DESC, id DESC`);
  if (rows.length === 0) return [];
  const { rows: items } = await pool.query<ItemDbRow>(
    `SELECT ${ITEM_COLS} FROM fit_items WHERE fit_id = ANY($1::int[]) ORDER BY fit_id, idx`,
    [rows.map((r) => r.id)]);
  const byFit = new Map<number, FitItem[]>();
  for (const r of items) {
    const list = byFit.get(r.fitId);
    if (list) list.push(item(r)); else byFit.set(r.fitId, [item(r)]);
  }
  return rows.map((r) => head(r, byFit.get(r.id) ?? []));
}

export async function getFit(id: number): Promise<FitRow | null> {
  const pool = getPool();
  const { rows } = await pool.query<HeadRow>(`SELECT ${HEAD_COLS} FROM fits WHERE id = $1`, [id]);
  if (!rows[0]) return null;
  const { rows: items } = await pool.query<ItemDbRow>(
    `SELECT ${ITEM_COLS} FROM fit_items WHERE fit_id = $1 ORDER BY idx`, [id]);
  return head(rows[0], items.map(item));
}

export async function createFit(input: FitInput): Promise<FitRow> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query<HeadRow>(
      `INSERT INTO fits (name, ship_type_id, description, character_id)
       VALUES ($1, $2, $3, $4) RETURNING ${HEAD_COLS}`,
      [input.name, input.shipTypeId, input.description ?? "",
       input.characterId === undefined || input.characterId === null ? null : String(input.characterId)]);
    const items = input.items ?? [];
    await writeItems(client, rows[0].id, items);
    await client.query("COMMIT");
    return head(rows[0], items);
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

export async function updateFit(id: number, patch: FitPatch): Promise<FitRow | null> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query<HeadRow>(
      `UPDATE fits SET name = COALESCE($2, name), description = COALESCE($3, description),
         character_id = CASE WHEN $4 THEN $5::bigint ELSE character_id END, updated_at = now()
       WHERE id = $1 RETURNING ${HEAD_COLS}`,
      [id, patch.name ?? null, patch.description ?? null,
       "characterId" in patch, patch.characterId == null ? null : String(patch.characterId)]);
    if (!rows[0]) { await client.query("ROLLBACK"); return null; }
    if (patch.items !== undefined) {
      await client.query("DELETE FROM fit_items WHERE fit_id = $1", [id]);
      await writeItems(client, id, patch.items);
    }
    await client.query("COMMIT");
    if (patch.items !== undefined) return head(rows[0], patch.items);
    const { rows: items } = await getPool().query<ItemDbRow>(
      `SELECT ${ITEM_COLS} FROM fit_items WHERE fit_id = $1 ORDER BY idx`, [id]);
    return head(rows[0], items.map(item));
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

export async function deleteFit(id: number): Promise<boolean> {
  const res = await getPool().query("DELETE FROM fits WHERE id = $1", [id]);
  return (res.rowCount ?? 0) > 0;
}

/** One statement for the whole item list — `idx` is the array position, so order is preserved. */
async function writeItems(
  client: { query: (text: string, values: unknown[]) => Promise<unknown> }, fitId: number, items: FitItem[],
): Promise<void> {
  if (items.length === 0) return;
  await client.query(
    `INSERT INTO fit_items (fit_id, idx, type_id, quantity, flag, charge_type_id, state)
     SELECT $1, * FROM unnest($2::int[], $3::int[], $4::int[], $5::text[], $6::int[], $7::text[])`,
    [fitId, items.map((_, i) => i), items.map((i) => i.typeId), items.map((i) => i.quantity),
     items.map((i) => i.flag), items.map((i) => i.chargeTypeId), items.map((i) => i.state)]);
}

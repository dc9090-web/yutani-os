import { getPool } from "./client.js";

export interface FittingItemRow { idx: number; typeId: number; quantity: number; flag: string }
export interface FittingRow { fittingId: number; name: string; description: string; shipTypeId: number; items: FittingItemRow[] }

/** A character has a few dozen fittings at most, so one statement per fitting is fine. */
export async function replaceFittings(characterId: number, fittings: FittingRow[]): Promise<number> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM character_fitting_items WHERE character_id = $1", [characterId]);
    await client.query("DELETE FROM character_fittings WHERE character_id = $1", [characterId]);
    let rows = 0;
    for (const f of fittings) {
      await client.query(
        `INSERT INTO character_fittings (character_id, fitting_id, name, description, ship_type_id)
         VALUES ($1, $2, $3, $4, $5)`,
        [characterId, String(f.fittingId), f.name, f.description, f.shipTypeId]);
      rows += 1;
      if (f.items.length) {
        await client.query(
          `INSERT INTO character_fitting_items (character_id, fitting_id, idx, type_id, quantity, flag)
           SELECT $1, $2, * FROM unnest($3::int[], $4::int[], $5::int[], $6::text[])`,
          [characterId, String(f.fittingId), f.items.map((i) => i.idx), f.items.map((i) => i.typeId),
           f.items.map((i) => i.quantity), f.items.map((i) => i.flag)]);
        rows += f.items.length;
      }
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

export async function listFittings(characterId: number): Promise<FittingRow[]> {
  const pool = getPool();
  const { rows } = await pool.query<{ fittingId: string; name: string; description: string; shipTypeId: number }>(
    `SELECT fitting_id AS "fittingId", name, description, ship_type_id AS "shipTypeId"
     FROM character_fittings WHERE character_id = $1 ORDER BY fitting_id`, [characterId]);
  const { rows: items } = await pool.query<{ fittingId: string; idx: number; typeId: number; quantity: number; flag: string }>(
    `SELECT fitting_id AS "fittingId", idx, type_id AS "typeId", quantity, flag
     FROM character_fitting_items WHERE character_id = $1 ORDER BY fitting_id, idx`, [characterId]);
  const byFitting = new Map<number, FittingItemRow[]>();
  for (const i of items) {
    const list = byFitting.get(Number(i.fittingId)) ?? [];
    list.push({ idx: i.idx, typeId: i.typeId, quantity: i.quantity, flag: i.flag });
    byFitting.set(Number(i.fittingId), list);
  }
  return rows.map((f) => ({ ...f, fittingId: Number(f.fittingId), items: byFitting.get(Number(f.fittingId)) ?? [] }));
}

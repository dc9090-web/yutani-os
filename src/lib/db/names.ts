import { getPool } from "./client.js";
import { chunk } from "../chunk.js";

export interface UniverseName { id: number; category: string; name: string | null; updatedAt: Date }
export interface StructureRow {
  id: number; name: string | null; solarSystemId: number | null;
  typeId: number | null; ownerId: number | null; forbidden: boolean; updatedAt: Date;
}
export type StructureInput = Omit<StructureRow, "updatedAt">;

const UPSERT_BATCH = 2000;
const num = (v: string | null): number | null => (v === null ? null : Number(v));

export async function getNames(ids: number[]): Promise<UniverseName[]> {
  if (ids.length === 0) return [];
  const { rows } = await getPool().query<{ id: string; category: string; name: string | null; updatedAt: Date }>(
    `SELECT id, category, name, updated_at AS "updatedAt" FROM universe_names WHERE id = ANY($1::bigint[])`,
    [ids.map(String)]);
  return rows.map((r) => ({ ...r, id: Number(r.id) }));
}

export async function getName(id: number): Promise<UniverseName | null> {
  return (await getNames([id]))[0] ?? null;
}

/** Returns the number of rows written. `updated_at` is refreshed so the TTL rules restart. */
export async function putNames(rows: { id: number; category: string; name: string | null }[]): Promise<number> {
  if (rows.length === 0) return 0;
  const pool = getPool();
  for (const batch of chunk(rows, UPSERT_BATCH)) {
    await pool.query(
      `INSERT INTO universe_names (id, category, name, updated_at)
       SELECT *, now() FROM unnest($1::bigint[], $2::text[], $3::text[])
       ON CONFLICT (id) DO UPDATE SET category = EXCLUDED.category, name = EXCLUDED.name, updated_at = now()`,
      [batch.map((r) => String(r.id)), batch.map((r) => r.category), batch.map((r) => r.name)]);
  }
  return rows.length;
}

export async function getStructures(ids: number[]): Promise<StructureRow[]> {
  if (ids.length === 0) return [];
  const { rows } = await getPool().query<{ id: string; name: string | null; solarSystemId: number | null;
    typeId: number | null; ownerId: string | null; forbidden: boolean; updatedAt: Date }>(
    `SELECT id, name, solar_system_id AS "solarSystemId", type_id AS "typeId", owner_id AS "ownerId",
            forbidden, updated_at AS "updatedAt" FROM structures WHERE id = ANY($1::bigint[])`,
    [ids.map(String)]);
  return rows.map((r) => ({ ...r, id: Number(r.id), ownerId: num(r.ownerId) }));
}

export async function getStructure(id: number): Promise<StructureRow | null> {
  return (await getStructures([id]))[0] ?? null;
}

export async function putStructure(row: StructureInput): Promise<void> {
  await getPool().query(
    `INSERT INTO structures (id, name, solar_system_id, type_id, owner_id, forbidden, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, now())
     ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, solar_system_id = EXCLUDED.solar_system_id,
       type_id = EXCLUDED.type_id, owner_id = EXCLUDED.owner_id, forbidden = EXCLUDED.forbidden,
       updated_at = now()`,
    [String(row.id), row.name, row.solarSystemId, row.typeId,
     row.ownerId === null ? null : String(row.ownerId), row.forbidden]);
}

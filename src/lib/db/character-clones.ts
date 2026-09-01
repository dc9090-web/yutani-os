import { getPool } from "./client.js";

export interface CloneHome {
  homeLocationId: number | null; homeLocationType: string | null;
  lastCloneJumpDate: Date | null; lastStationChangeDate: Date | null;
}
export interface JumpCloneRow { jumpCloneId: number; locationId: number | null; locationType: string | null; name: string | null; implants: number[] }
/** `clones` covers /clones (home + jump clones); `implants` covers /implants (active clone). */
export interface ClonesWrite { clones: (CloneHome & { jumpClones: JumpCloneRow[] }) | null; implants: number[] | null }
export interface CloneState extends CloneHome { characterId: number; updatedAt: Date; jumpClones: JumpCloneRow[] }

const num = (v: string | null): number | null => (v === null ? null : Number(v));

export async function replaceClones(characterId: number, w: ClonesWrite): Promise<number> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    let rows = 0;
    if (w.clones) {
      await client.query(
        `INSERT INTO character_clones (character_id, home_location_id, home_location_type,
           last_clone_jump_date, last_station_change_date, updated_at)
         VALUES ($1, $2, $3, $4, $5, now())
         ON CONFLICT (character_id) DO UPDATE SET home_location_id = EXCLUDED.home_location_id,
           home_location_type = EXCLUDED.home_location_type, last_clone_jump_date = EXCLUDED.last_clone_jump_date,
           last_station_change_date = EXCLUDED.last_station_change_date, updated_at = now()`,
        [characterId, w.clones.homeLocationId, w.clones.homeLocationType,
         w.clones.lastCloneJumpDate, w.clones.lastStationChangeDate]);
      await client.query("DELETE FROM character_jump_clones WHERE character_id = $1", [characterId]);
      // A handful of jump clones at most, and each carries its own int[] — insert them one by one.
      for (const c of w.clones.jumpClones) {
        await client.query(
          `INSERT INTO character_jump_clones (character_id, jump_clone_id, location_id, location_type, name, implants)
           VALUES ($1, $2, $3, $4, $5, $6::int[])`,
          [characterId, c.jumpCloneId, c.locationId, c.locationType, c.name, c.implants]);
      }
      rows += 1 + w.clones.jumpClones.length;
    }
    if (w.implants) {
      await client.query("DELETE FROM character_implants WHERE character_id = $1", [characterId]);
      if (w.implants.length) {
        await client.query(
          `INSERT INTO character_implants (character_id, type_id) SELECT $1, * FROM unnest($2::int[])`,
          [characterId, w.implants]);
      }
      rows += w.implants.length;
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

export async function getClones(characterId: number): Promise<CloneState | null> {
  const pool = getPool();
  const { rows } = await pool.query<{ characterId: string; homeLocationId: string | null; homeLocationType: string | null;
    lastCloneJumpDate: Date | null; lastStationChangeDate: Date | null; updatedAt: Date }>(
    `SELECT character_id AS "characterId", home_location_id AS "homeLocationId",
            home_location_type AS "homeLocationType", last_clone_jump_date AS "lastCloneJumpDate",
            last_station_change_date AS "lastStationChangeDate", updated_at AS "updatedAt"
     FROM character_clones WHERE character_id = $1`, [characterId]);
  if (!rows[0]) return null;
  const { rows: jump } = await pool.query<{ jumpCloneId: string; locationId: string | null; locationType: string | null; name: string | null; implants: number[] }>(
    `SELECT jump_clone_id AS "jumpCloneId", location_id AS "locationId", location_type AS "locationType",
            name, implants FROM character_jump_clones WHERE character_id = $1 ORDER BY jump_clone_id`, [characterId]);
  return {
    characterId: Number(rows[0].characterId),
    homeLocationId: num(rows[0].homeLocationId),
    homeLocationType: rows[0].homeLocationType,
    lastCloneJumpDate: rows[0].lastCloneJumpDate,
    lastStationChangeDate: rows[0].lastStationChangeDate,
    updatedAt: rows[0].updatedAt,
    jumpClones: jump.map((c) => ({ ...c, jumpCloneId: Number(c.jumpCloneId), locationId: num(c.locationId) })),
  };
}

export async function listImplants(characterId: number): Promise<number[]> {
  const { rows } = await getPool().query<{ type_id: number }>(
    "SELECT type_id FROM character_implants WHERE character_id = $1 ORDER BY type_id", [characterId]);
  return rows.map((r) => r.type_id);
}

import { getPool } from "./client.js";

export interface LocationInput {
  solarSystemId: number | null; stationId: number | null; structureId: number | null;
  shipItemId: number | null; shipTypeId: number | null; shipName: string | null;
  online: boolean | null; lastLogin: Date | null; lastLogout: Date | null;
}
export interface LocationRow extends LocationInput { characterId: number; updatedAt: Date }

const num = (v: string | null): number | null => (v === null ? null : Number(v));

/**
 * One row per character, overwritten every run. A column whose endpoint was skipped for a missing
 * scope is stored as NULL, which is exactly what the Overview renders as "—".
 */
export async function upsertLocation(characterId: number, loc: LocationInput): Promise<number> {
  await getPool().query(
    `INSERT INTO character_location (character_id, solar_system_id, station_id, structure_id,
       ship_item_id, ship_type_id, ship_name, online, last_login, last_logout, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, now())
     ON CONFLICT (character_id) DO UPDATE SET solar_system_id = EXCLUDED.solar_system_id,
       station_id = EXCLUDED.station_id, structure_id = EXCLUDED.structure_id,
       ship_item_id = EXCLUDED.ship_item_id, ship_type_id = EXCLUDED.ship_type_id,
       ship_name = EXCLUDED.ship_name, online = EXCLUDED.online, last_login = EXCLUDED.last_login,
       last_logout = EXCLUDED.last_logout, updated_at = now()`,
    [characterId, loc.solarSystemId, loc.stationId === null ? null : String(loc.stationId),
     loc.structureId === null ? null : String(loc.structureId),
     loc.shipItemId === null ? null : String(loc.shipItemId), loc.shipTypeId, loc.shipName,
     loc.online, loc.lastLogin, loc.lastLogout]);
  return 1;
}

export async function getLocation(characterId: number): Promise<LocationRow | null> {
  const { rows } = await getPool().query<{ characterId: string; solarSystemId: number | null; stationId: string | null;
    structureId: string | null; shipItemId: string | null; shipTypeId: number | null; shipName: string | null;
    online: boolean | null; lastLogin: Date | null; lastLogout: Date | null; updatedAt: Date }>(
    `SELECT character_id AS "characterId", solar_system_id AS "solarSystemId", station_id AS "stationId",
            structure_id AS "structureId", ship_item_id AS "shipItemId", ship_type_id AS "shipTypeId",
            ship_name AS "shipName", online, last_login AS "lastLogin", last_logout AS "lastLogout",
            updated_at AS "updatedAt"
     FROM character_location WHERE character_id = $1`, [characterId]);
  const r = rows[0];
  if (!r) return null;
  return {
    characterId: Number(r.characterId), solarSystemId: r.solarSystemId, stationId: num(r.stationId),
    structureId: num(r.structureId), shipItemId: num(r.shipItemId), shipTypeId: r.shipTypeId,
    shipName: r.shipName, online: r.online, lastLogin: r.lastLogin, lastLogout: r.lastLogout,
    updatedAt: r.updatedAt,
  };
}

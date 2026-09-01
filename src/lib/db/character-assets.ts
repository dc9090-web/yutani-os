import { getPool } from "./client.js";
import { chunk } from "../chunk.js";

export interface AssetRow {
  itemId: number; typeId: number; quantity: number; locationId: number;
  locationType: string; locationFlag: string; isSingleton: boolean; isBlueprintCopy: boolean; name: string | null;
}

const INSERT_BATCH = 2000;

/** A big industrial character has tens of thousands of assets; insert them in batches, one transaction. */
export async function replaceAssets(characterId: number, assets: AssetRow[]): Promise<number> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM character_assets WHERE character_id = $1", [characterId]);
    for (const batch of chunk(assets, INSERT_BATCH)) {
      await client.query(
        `INSERT INTO character_assets (character_id, item_id, type_id, quantity, location_id,
           location_type, location_flag, is_singleton, is_blueprint_copy, name)
         SELECT $1, * FROM unnest($2::bigint[], $3::int[], $4::bigint[], $5::bigint[], $6::text[],
           $7::text[], $8::bool[], $9::bool[], $10::text[])`,
        [characterId, batch.map((a) => String(a.itemId)), batch.map((a) => a.typeId),
         batch.map((a) => String(a.quantity)), batch.map((a) => String(a.locationId)),
         batch.map((a) => a.locationType), batch.map((a) => a.locationFlag),
         batch.map((a) => a.isSingleton), batch.map((a) => a.isBlueprintCopy), batch.map((a) => a.name)]);
    }
    await client.query("COMMIT");
    return assets.length;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

export async function listAssets(characterId: number): Promise<AssetRow[]> {
  const { rows } = await getPool().query<Omit<AssetRow, "itemId" | "quantity" | "locationId"> &
    { itemId: string; quantity: string; locationId: string }>(
    `SELECT item_id AS "itemId", type_id AS "typeId", quantity, location_id AS "locationId",
            location_type AS "locationType", location_flag AS "locationFlag",
            is_singleton AS "isSingleton", is_blueprint_copy AS "isBlueprintCopy", name
     FROM character_assets WHERE character_id = $1 ORDER BY item_id`, [characterId]);
  return rows.map((r) => ({ ...r, itemId: Number(r.itemId), quantity: Number(r.quantity), locationId: Number(r.locationId) }));
}

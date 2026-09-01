import { getPool } from "../db/client.js";

/** Spec §3: transactions older than this stop being worth a price lookup. */
export const INTEREST_TRANSACTION_DAYS = 30;

/**
 * The types the Jita half of the price job fetches (spec §3): everything the characters own,
 * everything in a saved fit (items *and* hulls) and everything traded recently. One statement —
 * `UNION` deduplicates in Postgres, so nothing is pulled into the process to be sorted by hand.
 * With four characters this is a few thousand ids, i.e. a handful of Fuzzwork requests.
 */
export async function typesOfInterest(): Promise<number[]> {
  const { rows } = await getPool().query<{ typeId: number }>(
    `SELECT type_id AS "typeId" FROM character_assets
     UNION SELECT type_id FROM character_fitting_items
     UNION SELECT ship_type_id FROM character_fittings
     UNION SELECT type_id FROM character_wallet_transactions
       WHERE date > now() - ($1::int * interval '1 day')
     ORDER BY 1`,
    [INTEREST_TRANSACTION_DAYS]);
  return rows.map((r) => r.typeId);
}

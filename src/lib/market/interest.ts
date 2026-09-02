import { getPool } from "../db/client.js";

/** Spec §3: transactions older than this stop being worth a price lookup. */
export const INTEREST_TRANSACTION_DAYS = 30;
/** Spec §4 (phase 7): the killmail window worth valuing — ESI's own 90-day recent window. */
export const INTEREST_KILLMAIL_DAYS = 90;

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
     UNION SELECT i.item_type_id FROM killmail_items i
       JOIN killmails k ON k.killmail_id = i.killmail_id
       WHERE k.killmail_time > now() - ($2::int * interval '1 day')
     UNION SELECT victim_ship_type_id FROM killmails
       WHERE killmail_time > now() - ($2::int * interval '1 day')
         AND victim_ship_type_id IS NOT NULL
     ORDER BY 1`,
    [INTEREST_TRANSACTION_DAYS, INTEREST_KILLMAIL_DAYS]);
  return rows.map((r) => r.typeId);
}

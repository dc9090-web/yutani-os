import { getPool } from "./client.js";
import { chunk } from "../chunk.js";
import type { KillmailValueParts } from "../combat/value.js";

/** One hourly run values this many killmails, newest first. */
export const VALUE_BATCH = 500;

interface Row {
  killmailId: string; shipTypeId: number | null;
  items: { typeId: number; quantity: string }[] | null;
}

/**
 * The killmails still waiting for a price, with each item's destroyed and dropped quantities
 * already added together. `json_agg` keeps this to one query however many items there are; a
 * killmail with no items comes back with `items` NULL, which becomes an empty array.
 *
 * Ordered by `value_checked_at NULLS FIRST, killmail_time DESC` and filtered so a row already
 * examined within the last 24 hours is skipped: without this, a killmail whose type `market-prices`
 * will never fetch (a dropped SDE type, one outside the interest window) sorts to the front of
 * every run forever and starves the batch behind it. `killmail-values` stamps `value_checked_at` on
 * every id it examines this run, priced or not (`touchValueChecked` / `setComputedValues`), so a
 * still-unpriced row only comes back around once a day, and a never-checked row (`NULLS FIRST`)
 * always outranks one that has already been looked at and found wanting.
 */
export async function unvaluedKillmails(limit = VALUE_BATCH): Promise<KillmailValueParts[]> {
  const { rows } = await getPool().query<Row>(
    `SELECT k.killmail_id AS "killmailId", k.victim_ship_type_id AS "shipTypeId",
            (SELECT json_agg(json_build_object(
                      'typeId', i.item_type_id,
                      'quantity', (i.quantity_destroyed + i.quantity_dropped)::text)
                    ORDER BY i.idx)
             FROM killmail_items i WHERE i.killmail_id = k.killmail_id) AS items
     FROM killmails k
     WHERE k.computed_value IS NULL
       AND (k.value_checked_at IS NULL OR k.value_checked_at < now() - interval '24 hours')
     ORDER BY k.value_checked_at NULLS FIRST, k.killmail_time DESC
     LIMIT $1`, [limit]);
  return rows.map((r) => ({
    killmailId: Number(r.killmailId),
    shipTypeId: r.shipTypeId,
    items: (r.items ?? []).map((i) => ({ typeId: i.typeId, quantity: Number(i.quantity) })),
  }));
}

/** Sets the value and stamps `value_checked_at` in the same write — these rows were both examined
 * and successfully priced this run. */
export async function setComputedValues(
  rows: { killmailId: number; value: number }[],
): Promise<number> {
  let written = 0;
  for (const batch of chunk(rows, VALUE_BATCH)) {
    const res = await getPool().query(
      `UPDATE killmails k SET computed_value = v.value, value_checked_at = now()
       FROM (SELECT * FROM unnest($1::bigint[], $2::numeric[]) AS t(killmail_id, value)) v
       WHERE k.killmail_id = v.killmail_id`,
      [batch.map((r) => String(r.killmailId)), batch.map((r) => r.value)]);
    written += res.rowCount ?? 0;
  }
  return written;
}

/**
 * Stamps `value_checked_at` on every killmail this run examined but could **not** price — the
 * starvation guard's other half. Without this, an unpriceable killmail keeps its `value_checked_at`
 * at NULL forever and is re-selected, uselessly, at the front of every single run.
 */
export async function touchValueChecked(killmailIds: number[]): Promise<number> {
  const ids = [...new Set(killmailIds)];
  if (ids.length === 0) return 0;
  const { rowCount } = await getPool().query(
    `UPDATE killmails SET value_checked_at = now() WHERE killmail_id = ANY($1::bigint[])`,
    [ids.map(String)]);
  return rowCount ?? 0;
}

/**
 * Killmail bodies are fetched once and never read again once stored — killmails are immutable
 * (Global Constraints) — so their `esi_cache` rows (`character_id = 0`, path under `/killmails/`)
 * exist purely to dedupe an in-flight retry within the cache TTL and are write-once-never-read
 * after that. The hourly values job prunes them once a week old so `esi_cache` does not grow
 * forever on a table that will hold tens of thousands of killmails.
 */
export async function pruneKillmailCache(): Promise<number> {
  const { rowCount } = await getPool().query(
    `DELETE FROM esi_cache WHERE character_id = 0 AND path LIKE '/killmails/%'
       AND updated_at < now() - interval '7 days'`);
  return rowCount ?? 0;
}

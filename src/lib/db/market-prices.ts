import { getPool } from "./client.js";
import { chunk } from "../chunk.js";
import type { Price } from "../view/price.js";

/** A row of ESI `GET /markets/prices`, already camelCased. */
export interface EsiPriceRow { typeId: number; adjustedPrice: number | null; averagePrice: number | null }
/** A row of Fuzzwork's Jita aggregates. */
export interface JitaPriceRow { typeId: number; sellMin: number | null; buyMax: number | null }

// /markets/prices returns ~15k rows in one response; insert them in batches like the asset repo.
const INSERT_BATCH = 2000;

const num = (v: string | null): number | null => (v === null ? null : Number(v));

/**
 * `ON CONFLICT` aborts an entire statement if the same conflict target (here, `type_id`) appears
 * twice in one INSERT's VALUES — "ON CONFLICT DO UPDATE command cannot affect row a second time".
 * ESI and Fuzzwork responses are not contractually unique, so de-dupe defensively before chunking;
 * last row for a given type wins, matching what a second INSERT of the same id would have done anyway.
 */
function dedupeByTypeId<T extends { typeId: number }>(rows: T[]): T[] {
  return [...new Map(rows.map((r) => [r.typeId, r])).values()];
}

/**
 * Upserts only the two ESI columns, so a Fuzzwork run's values survive untouched (spec §3: a
 * Fuzzwork failure degrades prices to ESI's, never to nothing).
 */
export async function upsertEsiPrices(rows: EsiPriceRow[]): Promise<number> {
  let written = 0;
  for (const batch of chunk(dedupeByTypeId(rows), INSERT_BATCH)) {
    const res = await getPool().query(
      `INSERT INTO market_prices (type_id, adjusted_price, average_price, updated_at)
       SELECT *, now() FROM unnest($1::int[], $2::numeric[], $3::numeric[])
       ON CONFLICT (type_id) DO UPDATE SET adjusted_price = EXCLUDED.adjusted_price,
         average_price = EXCLUDED.average_price, updated_at = now()`,
      [batch.map((r) => r.typeId), batch.map((r) => r.adjustedPrice), batch.map((r) => r.averagePrice)]);
    written += res.rowCount ?? 0;
  }
  return written;
}

/** The mirror image: only the two Jita columns, so the ESI reference values survive. */
export async function upsertJitaPrices(rows: JitaPriceRow[]): Promise<number> {
  let written = 0;
  for (const batch of chunk(dedupeByTypeId(rows), INSERT_BATCH)) {
    const res = await getPool().query(
      `INSERT INTO market_prices (type_id, jita_sell_min, jita_buy_max, updated_at)
       SELECT *, now() FROM unnest($1::int[], $2::numeric[], $3::numeric[])
       ON CONFLICT (type_id) DO UPDATE SET jita_sell_min = EXCLUDED.jita_sell_min,
         jita_buy_max = EXCLUDED.jita_buy_max, updated_at = now()`,
      [batch.map((r) => r.typeId), batch.map((r) => r.sellMin), batch.map((r) => r.buyMax)]);
    written += res.rowCount ?? 0;
  }
  return written;
}

/** One query per page (spec §4). Types with no row at all are simply absent from the map. */
export async function getPrices(typeIds: number[]): Promise<Map<number, Price>> {
  const wanted = [...new Set(typeIds)];
  if (wanted.length === 0) return new Map();
  const { rows } = await getPool().query<{ typeId: number; sell: string | null; buy: string | null; adjusted: string | null }>(
    `SELECT type_id AS "typeId", jita_sell_min AS sell, jita_buy_max AS buy, adjusted_price AS adjusted
     FROM market_prices WHERE type_id = ANY($1::int[])`, [wanted]);
  return new Map(rows.map((r) => [r.typeId, { sell: num(r.sell), buy: num(r.buy), adjusted: num(r.adjusted) }]));
}

/**
 * Which of these types the designer must not trust: no row at all, or a row older than
 * `maxAgeHours`. Spec §6 — the fitting designer tops these up from Fuzzwork before answering
 * rather than waiting for the hourly job.
 */
export async function stalePriceIds(typeIds: number[], maxAgeHours: number): Promise<number[]> {
  const wanted = [...new Set(typeIds)];
  if (wanted.length === 0) return [];
  const { rows } = await getPool().query<{ id: number }>(
    `SELECT w.id FROM unnest($1::int[]) AS w(id)
     LEFT JOIN market_prices p ON p.type_id = w.id
     WHERE p.type_id IS NULL OR p.updated_at < now() - make_interval(hours => $2)`,
    [wanted, maxAgeHours]);
  return rows.map((r) => r.id);
}

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
 * Upserts only the two ESI columns, so a Fuzzwork run's values survive untouched (spec §3: a
 * Fuzzwork failure degrades prices to ESI's, never to nothing).
 */
export async function upsertEsiPrices(rows: EsiPriceRow[]): Promise<number> {
  let written = 0;
  for (const batch of chunk(rows, INSERT_BATCH)) {
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
  for (const batch of chunk(rows, INSERT_BATCH)) {
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

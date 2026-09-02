import { chunk } from "../chunk.js";
import { getConfig } from "../config.js";
import type { JitaPriceRow } from "../db/market-prices.js";
import { FUZZWORK_CHUNK } from "./constants.js";

export { FUZZWORK_CHUNK };

/**
 * Fuzzwork's precalculated market aggregates (research §4). One request replaces ~371 pages of
 * ESI `/markets/{region}/orders`, which is why the spec picks it for "what is this worth".
 * It is one person's server with no SLA, so the caller must tolerate failure.
 */
export const FUZZWORK_AGGREGATES_URL = "https://market.fuzzwork.co.uk/aggregates/";
/** The Forge — the region Jita is in (research §4, verified). */
export const JITA_REGION_ID = 10000002;

interface Side { min?: unknown; max?: unknown }
interface Aggregate { buy?: Side; sell?: Side }

/**
 * Every value is a JSON **string** ("3.85"); a type with no orders comes back as numeric `0`s
 * instead (both shapes verified in research §4). Either way, no price means NULL, not zero.
 */
export function parsePrice(raw: unknown): number | null {
  if (typeof raw !== "string" && typeof raw !== "number") return null;
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : null;
}

/**
 * Jita sell minimum and buy maximum for each requested type, in chunks of `FUZZWORK_CHUNK`.
 * Types missing from a response are skipped, so a short answer never blanks stored prices.
 * Throws on a non-2xx response; the `market-prices` job turns that into a `warn:` run.
 */
export async function fetchAggregates(
  typeIds: number[],
  fetchImpl: typeof fetch = fetch,
  userAgent: string = getConfig().esiUserAgent,
): Promise<JitaPriceRow[]> {
  const out: JitaPriceRow[] = [];
  for (const batch of chunk([...new Set(typeIds)], FUZZWORK_CHUNK)) {
    const url = `${FUZZWORK_AGGREGATES_URL}?region=${JITA_REGION_ID}&types=${batch.join(",")}`;
    const res = await fetchImpl(url, { headers: { Accept: "application/json", "User-Agent": userAgent } });
    if (!res.ok) throw new Error(`Fuzzwork ${res.status} for ${batch.length} types`);
    const body = (await res.json()) as Record<string, Aggregate>;
    for (const typeId of batch) {
      const aggregate = body[String(typeId)];
      if (aggregate === undefined) continue;
      out.push({ typeId, sellMin: parsePrice(aggregate.sell?.min), buyMax: parsePrice(aggregate.buy?.max) });
    }
  }
  return out;
}

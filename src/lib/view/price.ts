/**
 * Pure price helpers. No imports at all, so a client component can use them without dragging `pg`
 * into the bundle; `src/lib/db/market-prices.ts` imports `Price` from here, not the other way round.
 */

/** One type's prices. `null` = that source has no price. */
export interface Price { sell: number | null; buy: number | null; adjusted: number | null }

/**
 * Spec §3: `priceOf(p) = sell ?? adjusted ?? null`. The Jita sell minimum is what an item costs to
 * replace; ESI's adjusted price is the degraded fallback when Fuzzwork has nothing (or is down).
 */
export function priceOf(p: Price | undefined): number | null {
  if (p === undefined) return null;
  return p.sell ?? p.adjusted ?? null;
}

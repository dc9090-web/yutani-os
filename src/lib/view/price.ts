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

/** One line of a value roll-up: a type and how many of it. */
export interface ValuedEntry { typeId: number; quantity: number }
export interface ValueRoll { total: number; unpriced: number }

/**
 * Spec §4's "Estimated value … with n items unpriced". `unpriced` counts **entries**, not units: it
 * tells the reader how many lines of the fit the total is missing, which is the actionable number.
 */
export function rollUpValue(entries: ValuedEntry[], prices: ReadonlyMap<number, Price>): ValueRoll {
  let total = 0;
  let unpriced = 0;
  for (const entry of entries) {
    const unit = priceOf(prices.get(entry.typeId));
    if (unit === null) unpriced += 1;
    else total += unit * entry.quantity;
  }
  return { total, unpriced };
}

export function unpricedNote(unpriced: number): string | null {
  if (unpriced === 0) return null;
  return `${unpriced} item${unpriced === 1 ? "" : "s"} unpriced`;
}

/**
 * Compact ISK for cards and slot rows ("2.45B ISK"). The sheet's value panel uses `isk()` from
 * `format.ts` so the exact figure is always available somewhere on the page.
 */
export function iskShort(value: number): string {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}B ISK`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M ISK`;
  if (value >= 1_000) return `${Math.round(value / 1_000)}k ISK`;
  return `${Math.round(value)} ISK`;
}

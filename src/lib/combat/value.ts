import { priceOf, type Price } from "../view/price.js";

export interface KillmailValueParts {
  killmailId: number; shipTypeId: number | null; items: { typeId: number; quantity: number }[];
}

/**
 * Spec §4: value = victim ship + every item, destroyed and dropped quantities together, priced with
 * `priceOf` (Jita sell minimum, falling back to ESI's adjusted price).
 *
 * `null` means "not valuable yet": a type with no price at all leaves the whole killmail NULL so
 * the hourly job retries it once `market-prices` has fetched that type — which it now will, because
 * `typesOfInterest` includes killmail types. Writing a partial total instead would make spec §4's
 * "the killmail stays NULL until priced" unreachable and would quietly under-report ISK destroyed.
 * A row with quantity 0 contributes nothing and is not allowed to block the killmail.
 */
export function computeKillmailValue(
  parts: KillmailValueParts, prices: ReadonlyMap<number, Price>,
): number | null {
  let total = 0;
  if (parts.shipTypeId !== null) {
    const hull = priceOf(prices.get(parts.shipTypeId));
    if (hull === null) return null;
    total += hull;
  }
  for (const item of parts.items) {
    if (item.quantity <= 0) continue;
    const unit = priceOf(prices.get(item.typeId));
    if (unit === null) return null;
    total += unit * item.quantity;
  }
  return total;
}

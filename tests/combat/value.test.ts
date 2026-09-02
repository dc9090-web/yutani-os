import { describe, it, expect } from "vitest";
import { computeKillmailValue, type KillmailValueParts } from "../../src/lib/combat/value.js";
import type { Price } from "../../src/lib/view/price.js";

const price = (sell: number | null, adjusted: number | null): Price => ({ sell, buy: null, adjusted });

// Rifter hull 587 at the Jita sell minimum; Tritanium 34 at its sell minimum; 2456 has no Jita
// price at all, so priceOf falls back to ESI's adjusted price.
const prices = new Map<number, Price>([
  [587, price(8_000_000, 7_500_000)],
  [34, price(5, 4.5)],
  [2456, price(null, 120_000)],
]);

const parts: KillmailValueParts = {
  killmailId: 1, shipTypeId: 587,
  items: [{ typeId: 34, quantity: 1000 }, { typeId: 2456, quantity: 1 }],
};

describe("computeKillmailValue", () => {
  it("sums the hull and every item at priceOf", () => {
    // 8,000,000 (hull) + 1000 x 5 = 5,000 (Tritanium) + 1 x 120,000 (adjusted) = 8,125,000
    expect(computeKillmailValue(parts, prices)).toBe(8_125_000);
  });
  it("returns null when any type is unpriced, so the killmail is retried next hour", () => {
    const missing = new Map(prices);
    missing.delete(2456);
    expect(computeKillmailValue(parts, missing)).toBeNull();
    const noHull = new Map(prices);
    noHull.delete(587);
    expect(computeKillmailValue(parts, noHull)).toBeNull();
  });
  it("counts a hull with no items, and a killmail with no hull at all", () => {
    expect(computeKillmailValue({ killmailId: 2, shipTypeId: 587, items: [] }, prices)).toBe(8_000_000);
    // 1000 x 5 = 5,000, with nothing for the missing hull.
    expect(computeKillmailValue(
      { killmailId: 3, shipTypeId: null, items: [{ typeId: 34, quantity: 1000 }] }, prices)).toBe(5_000);
  });
  it("ignores a zero-quantity row rather than demanding a price for it", () => {
    const withZero: KillmailValueParts = {
      killmailId: 4, shipTypeId: 587, items: [{ typeId: 99999, quantity: 0 }],
    };
    expect(computeKillmailValue(withZero, prices)).toBe(8_000_000);
  });
});

import { describe, it, expect } from "vitest";
import { priceOf } from "../../src/lib/view/price.js";

describe("priceOf", () => {
  it("prefers the Jita sell price", () => {
    expect(priceOf({ sell: 5, buy: 4, adjusted: 9 })).toBe(5);
  });
  it("falls back to the ESI adjusted price when there is no sell price", () => {
    expect(priceOf({ sell: null, buy: 4, adjusted: 9 })).toBe(9);
  });
  it("is null when neither source has a price, and for an unknown type", () => {
    expect(priceOf({ sell: null, buy: 4, adjusted: null })).toBeNull();
    expect(priceOf(undefined)).toBeNull();
  });
});

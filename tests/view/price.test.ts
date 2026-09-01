import { describe, it, expect } from "vitest";
import { iskShort, priceOf, rollUpValue, unpricedNote } from "../../src/lib/view/price.js";

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

const prices = new Map([
  [34, { sell: 3.85, buy: 3.67, adjusted: 4.2 }],
  [587, { sell: null, buy: null, adjusted: 8_000_000 }],
  [519, { sell: null, buy: 100, adjusted: null }],
]);

describe("rollUpValue", () => {
  it("multiplies each entry by its quantity at priceOf", () => {
    expect(rollUpValue([{ typeId: 34, quantity: 1000 }, { typeId: 587, quantity: 1 }], prices))
      .toEqual({ total: 3850 + 8_000_000, unpriced: 0 });
  });
  it("counts entries with no usable price instead of guessing", () => {
    expect(rollUpValue([{ typeId: 519, quantity: 2 }, { typeId: 999, quantity: 1 }, { typeId: 34, quantity: 1 }], prices))
      .toEqual({ total: 3.85, unpriced: 2 });
  });
  it("is zero for no entries", () => {
    expect(rollUpValue([], prices)).toEqual({ total: 0, unpriced: 0 });
  });
});

describe("unpricedNote", () => {
  it("is null when everything was priced and singular for one", () => {
    expect(unpricedNote(0)).toBeNull();
    expect(unpricedNote(1)).toBe("1 item unpriced");
    expect(unpricedNote(4)).toBe("4 items unpriced");
  });
});

describe("iskShort", () => {
  it("scales to B/M/k and keeps small numbers whole", () => {
    expect(iskShort(2_450_000_000)).toBe("2.45B ISK");
    expect(iskShort(12_340_000)).toBe("12.3M ISK");
    expect(iskShort(91_200)).toBe("91k ISK");
    expect(iskShort(850)).toBe("850 ISK");
    expect(iskShort(0)).toBe("0 ISK");
  });
});

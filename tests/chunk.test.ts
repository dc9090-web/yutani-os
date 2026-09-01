import { describe, it, expect } from "vitest";
import { chunk } from "../src/lib/chunk.js";

describe("chunk", () => {
  it("splits into fixed-size batches with a short tail", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });
  it("returns one batch when everything fits", () => {
    expect(chunk([1, 2], 1000)).toEqual([[1, 2]]);
  });
  it("returns nothing for an empty input", () => {
    expect(chunk([], 1000)).toEqual([]);
  });
  it("throws on a non-positive size rather than looping forever", () => {
    expect(() => chunk([1], 0)).toThrow(/positive/);
  });
});

import { describe, it, expect } from "vitest";
import { parseName, parseAccountId, parseId } from "../../src/lib/api/json.js";
describe("api parsing", () => {
  it("parseName trims and bounds", () => {
    expect(parseName({ name: "  Main " })).toBe("Main");
    expect(parseName({ name: "" })).toBeNull();
    expect(parseName({ name: "x".repeat(41) })).toBeNull();
    expect(parseName(null)).toBeNull();
  });
  it("parseAccountId accepts null, positive ints; rejects others", () => {
    expect(parseAccountId({ accountId: null })).toBeNull();
    expect(parseAccountId({ accountId: 3 })).toBe(3);
    expect(parseAccountId({ accountId: "3" })).toBeUndefined();
    expect(parseAccountId({})).toBeUndefined();
  });
  it("parseId accepts positive integer strings; rejects others", () => {
    expect(parseId("12")).toBe(12);
    expect(parseId("abc")).toBeNull();
    expect(parseId("0")).toBeNull();
    expect(parseId("-3")).toBeNull();
    expect(parseId("1.5")).toBeNull();
  });
});

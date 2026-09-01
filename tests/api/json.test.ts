import { describe, it, expect } from "vitest";
import { parseName, parseAccountId, parseId, parseIdList } from "../../src/lib/api/json.js";
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

describe("parseIdList", () => {
  it("parses, dedupes and keeps order", () => {
    expect(parseIdList("3, 1 ,3", 10)).toEqual([3, 1]);
  });
  it("rejects nothing, rubbish, non-positives and over-long lists", () => {
    expect(parseIdList(null, 10)).toBeNull();
    expect(parseIdList("", 10)).toBeNull();
    expect(parseIdList("1,x", 10)).toBeNull();
    expect(parseIdList("1,-2", 10)).toBeNull();
    expect(parseIdList("1.5", 10)).toBeNull();
    expect(parseIdList("1,2,3", 2)).toBeNull();
  });
});

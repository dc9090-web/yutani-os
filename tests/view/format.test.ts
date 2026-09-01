import { describe, it, expect } from "vitest";
import { grouped, isk, sp, roman, relativeTime, secClass, secText, trainingLabel } from "../../src/lib/view/format.js";

const NOW = new Date("2026-09-01T12:00:00Z");

describe("grouped", () => {
  it("adds thousands separators without touching the fraction or the sign", () => {
    expect(grouped(0)).toBe("0");
    expect(grouped(999)).toBe("999");
    expect(grouped(1000)).toBe("1,000");
    expect(grouped(1234567)).toBe("1,234,567");
    expect(grouped("1234567.89")).toBe("1,234,567.89");
    expect(grouped("-1234.50")).toBe("-1,234.50");
  });
});

describe("isk", () => {
  it("always shows two decimals and the ISK suffix", () => {
    expect(isk(1234567.891)).toBe("1,234,567.89 ISK");
    expect(isk(0)).toBe("0.00 ISK");
    expect(isk(-4500)).toBe("-4,500.00 ISK");
    expect(isk(4.187)).toBe("4.19 ISK");
  });
});

describe("sp", () => {
  it("switches units at a million and at a thousand", () => {
    expect(sp(47382910)).toBe("47.4M SP");
    expect(sp(1000000)).toBe("1.0M SP");
    expect(sp(999999)).toBe("999k SP");     // floored, so it never reads "1000k"
    expect(sp(850000)).toBe("850k SP");
    expect(sp(45255)).toBe("45k SP");
    expect(sp(512)).toBe("512 SP");
    expect(sp(0)).toBe("0 SP");
  });
});

describe("roman", () => {
  it("renders skill levels", () => {
    expect([0, 1, 2, 3, 4, 5].map(roman)).toEqual(["", "I", "II", "III", "IV", "V"]);
    expect(roman(7)).toBe("7");
  });
});

describe("relativeTime", () => {
  it("labels the future", () => {
    expect(relativeTime(new Date("2026-09-01T15:12:00Z"), NOW)).toBe("in 3 h 12 m");
    expect(relativeTime(new Date("2026-09-01T15:00:00Z"), NOW)).toBe("in 3 h");
    expect(relativeTime(new Date("2026-09-01T12:42:00Z"), NOW)).toBe("in 42 m");
    expect(relativeTime(new Date("2026-09-03T12:00:00Z"), NOW)).toBe("in 2 days");
    expect(relativeTime(new Date("2026-09-02T12:00:00Z"), NOW)).toBe("in 1 day");
  });
  it("labels the past", () => {
    expect(relativeTime(new Date("2026-08-30T12:00:00Z"), NOW)).toBe("2 days ago");
    expect(relativeTime(new Date("2026-09-01T08:48:00Z"), NOW)).toBe("3 h 12 m ago");
    expect(relativeTime(new Date("2026-09-01T11:18:00Z"), NOW)).toBe("42 m ago");
  });
  it("collapses the last minute and handles a missing date", () => {
    expect(relativeTime(new Date("2026-09-01T12:00:30Z"), NOW)).toBe("just now");
    expect(relativeTime(new Date("2026-09-01T11:59:31Z"), NOW)).toBe("just now");
    expect(relativeTime(null, NOW)).toBe("never");
  });
});

describe("security", () => {
  it("classifies the way the client rounds — to one decimal", () => {
    expect(secClass(0.9459)).toBe("sec-high");
    expect(secClass(0.5)).toBe("sec-high");
    expect(secClass(0.45)).toBe("sec-high");    // rounds to 0.5
    expect(secClass(0.44)).toBe("sec-low");
    expect(secClass(0.04)).toBe("sec-null");    // rounds to 0.0
    expect(secClass(-0.19)).toBe("sec-null");
    expect(secClass(null)).toBe("sec-null");
  });
  it("renders the number to one decimal", () => {
    expect(secText(0.9459)).toBe("0.9");
    expect(secText(-0.19)).toBe("-0.2");
    expect(secText(null)).toBe("—");
  });
});

describe("trainingLabel", () => {
  it("names the head entry and when it finishes", () => {
    expect(trainingLabel({ skillName: "Caldari Frigate", finishedLevel: 5, finishDate: new Date("2026-09-01T15:12:00Z") }, NOW))
      .toBe("Caldari Frigate V · finishes in 3 h 12 m");
  });
  it("says paused when the queue carries no dates", () => {
    expect(trainingLabel({ skillName: "Gunnery", finishedLevel: 3, finishDate: null }, NOW)).toBe("Gunnery III · paused");
  });
  it("says the queue is empty", () => {
    expect(trainingLabel(null, NOW)).toBe("Queue empty");
  });
});

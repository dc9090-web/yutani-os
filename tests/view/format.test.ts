import { describe, it, expect } from "vitest";
import {
  WARN_PREFIX, countdown, grouped, isWarning, isk, iskWhole, sp, overviewTraining, roman, relativeTime,
  secClass, secText, stamp,
} from "../../src/lib/view/format.js";

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
  it("never renders -0.00 for a tiny negative amount", () => {
    expect(isk(-0.001)).toBe("0.00 ISK");
    expect(isk(-0.005)).toBe("-0.01 ISK"); // (-0.005).toFixed(2) === "-0.01" (binary repr rounds away from zero here)
    expect(isk(-4500)).toBe("-4,500.00 ISK");
  });
});

describe("iskWhole", () => {
  it("groups the value with no decimals and the ISK suffix", () => {
    expect(iskWhole(128450032.1)).toBe("128,450,032 ISK");
    expect(iskWhole(12300)).toBe("12,300 ISK");
    expect(iskWhole(0)).toBe("0 ISK");
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
  it("drops the unit suffix when withUnit is false", () => {
    expect(sp(47382910, false)).toBe("47.4M");
    expect(sp(850000, false)).toBe("850k");
    expect(sp(512, false)).toBe("512");
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

describe("stamp", () => {
  it("renders YYYY-MM-DD HH:MM in UTC", () => {
    expect(stamp(new Date("2026-08-31T18:30:12Z"))).toBe("2026-08-31 18:30");
  });
  it("renders an em dash for a null date", () => {
    expect(stamp(null)).toBe("—");
  });
});

describe("security", () => {
  it("classifies the way the client rounds — to one decimal", () => {
    expect(secClass(0.9459)).toBe("sec-high");
    expect(secClass(0.5)).toBe("sec-high");
    expect(secClass(0.45)).toBe("sec-high");    // rounds to 0.5
    expect(secClass(0.44)).toBe("sec-low");
    expect(secClass(0.04)).toBe("sec-low");     // the game rounds a nonzero sub-0.05 band up to 0.1
    expect(secClass(0.01)).toBe("sec-low");
    expect(secClass(0.0)).toBe("sec-null");     // a true 0.0 is unaffected
    expect(secClass(-0.19)).toBe("sec-null");
    expect(secClass(null)).toBe("sec-null");
  });
  it("renders the number to one decimal", () => {
    expect(secText(0.9459)).toBe("0.9");
    expect(secText(0.04)).toBe("0.1");
    expect(secText(0.01)).toBe("0.1");
    expect(secText(0.0)).toBe("0.0");
    expect(secText(-0.19)).toBe("-0.2");
    expect(secText(null)).toBe("—");
  });
});

describe("overviewTraining", () => {
  it("names the head entry, its remaining time, and the elapsed percent between start and finish", () => {
    expect(overviewTraining({
      skillName: "Caldari Frigate", finishedLevel: 5,
      startDate: new Date("2026-09-01T09:12:00Z"), finishDate: new Date("2026-09-01T15:12:00Z"),
    }, NOW)).toEqual({ active: true, skill: "Caldari Frigate V", time: "3h 12m", percent: 47 });
  });
  it("measures the level by SP, so a level mostly trained before this stint started is not shown as barely begun", () => {
    // TrilliumONE's head: 93% of the level's SP already banked when the queue restarted 1h43m ago.
    expect(overviewTraining({
      skillName: "Caldari Frigate", finishedLevel: 5,
      startDate: new Date("2026-09-30T14:51:47Z"), finishDate: new Date("2026-10-01T10:11:30Z"),
      levelStartSp: 226275, levelEndSp: 1280000, trainingStartSp: 1206938,
    }, new Date("2026-09-30T16:34:31Z"))).toEqual({ active: true, skill: "Caldari Frigate V", time: "17h 37m", percent: 94 });
  });
  it("reports 0% when the head carries no start date", () => {
    expect(overviewTraining({
      skillName: "Caldari Frigate", finishedLevel: 5, startDate: null,
      finishDate: new Date("2026-09-01T15:12:00Z"),
    }, NOW)).toMatchObject({ percent: 0 });
  });
  it("says paused, with 0% progress, when the queue carries no dates at all", () => {
    expect(overviewTraining({ skillName: "Gunnery", finishedLevel: 3, startDate: null, finishDate: null }, NOW))
      .toEqual({ active: true, skill: "Gunnery III", time: "paused", percent: 0 });
  });
  it("says the queue is empty", () => {
    expect(overviewTraining(null, NOW)).toEqual({ active: false, label: "Queue empty" });
  });
  it("reports 100% and a zero duration, not a past-tense time, when the head's finishDate has already passed", () => {
    expect(overviewTraining({
      skillName: "Caldari Frigate", finishedLevel: 5,
      startDate: new Date("2026-09-01T02:48:00Z"), finishDate: new Date("2026-09-01T08:48:00Z"),
    }, NOW)).toEqual({ active: true, skill: "Caldari Frigate V", time: "0m", percent: 100 });
    // Exactly now counts as stale too, not "in 0 m".
    expect(overviewTraining({
      skillName: "Gunnery", finishedLevel: 3, startDate: new Date("2026-09-01T06:00:00Z"), finishDate: NOW,
    }, NOW)).toEqual({ active: true, skill: "Gunnery III", time: "0m", percent: 100 });
  });
});

describe("countdown", () => {
  it("renders days, hours, minutes and seconds, unlike duration() which floors to minutes", () => {
    const ms = ((3 * 24 + 12) * 3600 + 9 * 60 + 41) * 1000;
    expect(countdown(ms)).toBe("3d 12h 9m 41s");
  });

  it("still prints every unit even when a larger one is zero", () => {
    expect(countdown(5000)).toBe("0d 0h 0m 5s");
    expect(countdown(0)).toBe("Queue complete");
  });

  it("reads 'Queue complete' once the target time has passed", () => {
    expect(countdown(-1)).toBe("Queue complete");
    expect(countdown(-60_000)).toBe("Queue complete");
  });
});

describe("isWarning", () => {
  it("recognises the scheduler's warning prefix", () => {
    expect(WARN_PREFIX).toBe("warn: ");
    expect(isWarning("warn: fuzzwork 503")).toBe(true);
  });
  it("treats a real error and a missing message as not-a-warning", () => {
    expect(isWarning("ESI 500 for /markets/prices")).toBe(false);
    expect(isWarning(null)).toBe(false);
  });
});

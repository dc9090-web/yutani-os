import { describe, it, expect } from "vitest";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MAX_SKILL_LEVEL, currentSpInTraining, spBetween, spForLevel, trainingMs } from "../../src/lib/skills/sp.js";

const ALPHA_SET = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "fixtures", "skills", "alpha-set.json");

describe("spForLevel", () => {
  it("matches the published rank-1 table", () => {
    expect([1, 2, 3, 4, 5].map((l) => spForLevel(1, l))).toEqual([250, 1415, 8000, 45255, 256000]);
    expect(MAX_SKILL_LEVEL).toBe(5);
  });

  it("is zero at and below level 0", () => {
    expect(spForLevel(1, 0)).toBe(0);
    expect(spForLevel(8, -1)).toBe(0);
  });

  it("scales linearly with rank and rounds up, not to nearest", () => {
    // 250 * 2 * 2^2.5 = 2828.427… → 2829, and 250 * 16 * 2^2.5 = 22627.417… → 22628.
    expect(spForLevel(2, 2)).toBe(2829);
    expect(spForLevel(16, 2)).toBe(22628);
    expect(spForLevel(2, 5)).toBe(512000);
    expect(spForLevel(6, 4)).toBe(271530);
  });

  it("sums the Alpha skill set to CCP's published 19,669,072 SP", async () => {
    const rows = JSON.parse(await readFile(ALPHA_SET, "utf8")) as [number, number, number][];
    expect(rows).toHaveLength(175);
    const total = rows.reduce((sum, [, rank, cap]) => sum + spForLevel(rank, cap), 0);
    expect(total).toBe(19_669_072);
  });
});

describe("spBetween", () => {
  it("is the increment between two levels", () => {
    expect(spBetween(1, 0, 1)).toBe(250);
    expect(spBetween(1, 1, 2)).toBe(1165);
    expect(spBetween(1, 4, 5)).toBe(210745);
    expect(spBetween(1, 0, 5)).toBe(256000);
  });
  it("is zero when `to` is not above `from`", () => {
    expect(spBetween(1, 3, 3)).toBe(0);
    expect(spBetween(1, 5, 2)).toBe(0);
  });
});

describe("trainingMs", () => {
  it("converts SP to milliseconds at the given rate", () => {
    // 256,000 SP at 32 SP/min = 8,000 min = 480,000,000 ms.
    expect(trainingMs(256_000, 32)).toBe(480_000_000);
    // 250 SP at 32 SP/min = 7.8125 min = 468,750 ms.
    expect(trainingMs(250, 32)).toBe(468_750);
  });
  it("is zero for no SP and for a non-positive rate", () => {
    expect(trainingMs(0, 32)).toBe(0);
    expect(trainingMs(-5, 32)).toBe(0);
    expect(trainingMs(1000, 0)).toBe(0);
  });
});

describe("currentSpInTraining", () => {
  const entry = {
    startDate: new Date("2026-09-01T00:00:00Z"),
    finishDate: new Date("2026-09-08T00:00:00Z"),
    trainingStartSp: 45_255,
    levelEndSp: 256_000,
  };

  it("interpolates from the dates", () => {
    // 210,745 SP over 168 h; at the half-way mark 105,372.5 SP are in, so 45,255 + 105,372.5
    // = 150,627.5, truncated to whole SP.
    expect(currentSpInTraining(entry, new Date("2026-09-04T12:00:00Z"))).toBe(150_627);
  });

  it("clamps to the level's own bounds", () => {
    expect(currentSpInTraining(entry, new Date("2026-08-30T00:00:00Z"))).toBe(45_255);
    expect(currentSpInTraining(entry, new Date("2026-09-30T00:00:00Z"))).toBe(256_000);
  });

  it("returns null for a paused queue and for a zero-length window", () => {
    expect(currentSpInTraining({ ...entry, startDate: null, finishDate: null }, new Date())).toBeNull();
    expect(currentSpInTraining({ ...entry, finishDate: entry.startDate }, new Date())).toBeNull();
    expect(currentSpInTraining({ ...entry, levelEndSp: null }, new Date())).toBeNull();
  });
});

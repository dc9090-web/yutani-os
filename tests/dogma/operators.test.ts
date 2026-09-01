import { describe, it, expect } from "vitest";
import { Operator } from "../../src/lib/dogma/data.js";
import {
  PENALIZABLE_OPERATORS, PENALTY_BASE, isPenalizable, normalise, penalizeValues, round2,
} from "../../src/lib/dogma/operators.js";

/** How the calculator applies a bucket — mirrored here so the fixtures read like EOS's. */
function applyPercent(base: number, percents: number[], penalised: boolean): number {
  const values = percents.map((p) => normalise(Operator.PostPercent, p)!);
  if (penalised) return base * (1 + penalizeValues(values));
  return values.reduce((acc, n) => acc * (1 + n), base);
}

describe("normalise", () => {
  it("normalises every operator", () => {
    expect(normalise(Operator.PreAssign, 42)).toBe(42);
    expect(normalise(Operator.PostAssign, 42)).toBe(42);
    expect(normalise(Operator.PreMul, 2)).toBe(1);
    expect(normalise(Operator.PostMul, 1.5)).toBe(0.5);
    expect(normalise(Operator.PostMulImmune, 1.5)).toBe(0.5);
    expect(normalise(Operator.PreDiv, 4)).toBe(-0.75);
    expect(normalise(Operator.PostDiv, 2)).toBe(-0.5);
    expect(normalise(Operator.ModAdd, 7)).toBe(7);
    expect(normalise(Operator.ModSub, 7)).toBe(-7);
    expect(normalise(Operator.PostPercent, -25)).toBe(-0.25);
    expect(normalise(Operator.PostPercent, 400)).toBe(4);
  });

  it("returns null rather than Infinity for a division by zero", () => {
    expect(normalise(Operator.PreDiv, 0)).toBeNull();
    expect(normalise(Operator.PostDiv, 0)).toBeNull();
  });
});

describe("penalisable operators", () => {
  it("is exactly the five percentage-style operators", () => {
    expect([...PENALIZABLE_OPERATORS].sort((a, b) => a - b)).toEqual([
      Operator.PreMul, Operator.PreDiv, Operator.PostMul, Operator.PostDiv, Operator.PostPercent,
    ].sort((a, b) => a - b));
    expect(isPenalizable(Operator.PostPercent)).toBe(true);
    expect(isPenalizable(Operator.ModAdd)).toBe(false);
    expect(isPenalizable(Operator.ModSub)).toBe(false);
    expect(isPenalizable(Operator.PreAssign)).toBe(false);
    expect(isPenalizable(Operator.PostAssign)).toBe(false);
    expect(isPenalizable(Operator.PostMulImmune)).toBe(false);
  });
});

describe("penalizeValues", () => {
  it("uses the EVE University penalty curve", () => {
    expect(PENALTY_BASE).toBeCloseTo(0.8691199808003974, 15);
    const s = (i: number) => PENALTY_BASE ** (i * i);
    expect(s(0)).toBe(1);
    expect(s(1)).toBeCloseTo(0.8691199808, 10);
    expect(s(2)).toBeCloseTo(0.5705831435, 10);
    expect(s(3)).toBeCloseTo(0.2829551540, 10);
    expect(s(4)).toBeCloseTo(0.1059926497, 10);
  });

  it("reproduces EOS's five-postPercent fixture", () => {
    // EOS tests/integration/calculator/mod_operator/test_post_percent.py
    expect(applyPercent(100, [20, 50, -90, -25, 400], false)).toBeCloseTo(67.5, 10);
    expect(applyPercent(100, [20, 50, -90, -25, 400], true)).toBeCloseTo(62.549783181488586, 10);
  });

  it("reproduces the +10% ladder (research §3.6)", () => {
    expect(applyPercent(100, [10], true)).toBeCloseTo(110.0, 10);
    expect(applyPercent(100, [10, 10], true)).toBeCloseTo(119.56031978880436, 10);
    expect(applyPercent(100, [10, 10, 10], true)).toBeCloseTo(126.38223009922673, 10);
    expect(applyPercent(100, [10, 10, 10, 10], true)).toBeCloseTo(129.95828043757973, 10);
    expect(applyPercent(100, [10, 10, 10, 10, 10], true)).toBeCloseTo(131.3357426875382, 10);
    expect(applyPercent(100, [20, 10], true)).toBeCloseTo(130.42943976960476, 10);
  });

  it("reproduces the −10% ladder", () => {
    expect(applyPercent(100, [-10], true)).toBeCloseTo(90.0, 10);
    expect(applyPercent(100, [-10, -10], true)).toBeCloseTo(82.17792017279642, 10);
    expect(applyPercent(100, [-10, -10, -10], true)).toBeCloseTo(77.48898657086102, 10);
  });

  it("runs positive and negative as two independent chains, each starting at full strength", () => {
    // 1.1 × 0.9 — both are the first entry of their own chain, so neither is reduced.
    expect(applyPercent(100, [10, -10], true)).toBeCloseTo(99, 10);
  });

  it("sorts strongest first regardless of input order", () => {
    expect(penalizeValues([0.1, 0.5, 0.2])).toBeCloseTo(penalizeValues([0.5, 0.2, 0.1]), 15);
    expect(penalizeValues([-0.1, -0.5])).toBeCloseTo(penalizeValues([-0.5, -0.1]), 15);
  });

  it("puts zero in the positive chain", () => {
    expect(penalizeValues([0])).toBe(0);
    expect(penalizeValues([])).toBe(0);
  });

  it("truncates hard after index 10 — the twelfth modifier is dropped, not merely negligible", () => {
    const eleven = Array<number>(11).fill(0.1);
    const twelve = Array<number>(12).fill(0.1);
    expect(penalizeValues(twelve)).toBe(penalizeValues(eleven));
  });
});

describe("round2", () => {
  it("rounds to two decimal places", () => {
    expect(round2(162.5)).toBe(162.5);
    expect(round2(80.25000000000001)).toBe(80.25);
    expect(round2(250.00000000000003)).toBe(250);
    expect(round2(6.754)).toBe(6.75);
    expect(round2(6.755)).toBe(6.76);
    expect(round2(-1.005)).toBe(-1);
  });

  it("rounds an exact tie to the even neighbour (banker's rounding, matching Python's round())", () => {
    expect(round2(28.125)).toBe(28.12);   // 2812.5 → 2812 (even)
    expect(round2(28.135)).toBe(28.14);   // 2813.5 → 2814 (even)
    expect(round2(0.125)).toBe(0.12);     // 12.5 → 12 (even)
    expect(round2(-28.125)).toBe(-28.12); // -2812.5 → -2812 (even)
  });

  it("leaves a non-tie value alone even when its 2dp neighbour is even", () => {
    expect(round2(164.1275)).toBe(164.13);   // 16412.75 is not a tie, ordinary rounding applies
  });
});

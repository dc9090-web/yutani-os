/**
 * Operator normalisation and the stacking-penalty kernel.
 *
 * Three independent implementations (EOS eos/calculator/map.py, Pyfa
 * eos/modifiedAttributeDict.py:426, EVEShipFit src/calculate/pass_3.rs) agree exactly; this is a
 * transliteration of EOS's. See docs/research/dogma-engine.md §3.
 */
import { Operator } from "./data.js";

/** 1 / e^((1/2.67)^2) === e^(-(1/2.67)^2). The n-th modifier is scaled by PENALTY_BASE^(n^2). */
export const PENALTY_BASE = 1 / Math.exp((1 / 2.67) ** 2);

/**
 * Only percentage-style operators penalise. `+1 warp core strength` / `+1000 structure HP` are
 * ModAdd, which is exactly why the wiki says they do not stack-penalise.
 */
export const PENALIZABLE_OPERATORS: ReadonlySet<Operator> = new Set([
  Operator.PreMul, Operator.PreDiv, Operator.PostMul, Operator.PostDiv, Operator.PostPercent,
]);

export function isPenalizable(op: Operator): boolean {
  return PENALIZABLE_OPERATORS.has(op);
}

/**
 * Turn a raw carrier attribute value into the *reduced* form the calculator applies.
 * Returns null when the modifier cannot be applied at all: Python raises ZeroDivisionError where
 * JavaScript would silently produce Infinity, so a divide-by-zero is dropped instead.
 */
export function normalise(op: Operator, v: number): number | null {
  switch (op) {
    case Operator.PreAssign:
    case Operator.PostAssign:
    case Operator.ModAdd:
      return v;
    case Operator.ModSub:
      return -v;
    case Operator.PreMul:
    case Operator.PostMul:
    case Operator.PostMulImmune:
      return v - 1;
    case Operator.PreDiv:
    case Operator.PostDiv:
      return v === 0 ? null : 1 / v - 1;
    case Operator.PostPercent:
      return v / 100;
  }
}

/**
 * Collapse a bucket of penalised reduced multipliers into one.
 * Positive and negative form two independent chains, each sorted strongest-first and indexed from
 * zero, so a fit with three +10% and three −10% modules gets *two* full-strength first modifiers.
 * The twelfth entry of a chain (index 11) is dropped outright.
 */
export function penalizeValues(modValues: number[]): number {
  const positive: number[] = [];
  const negative: number[] = [];
  for (const v of modValues) (v >= 0 ? positive : negative).push(v);
  positive.sort((a, b) => b - a);
  negative.sort((a, b) => a - b);
  let value = 1;
  for (const chain of [positive, negative]) {
    let chainValue = 1;
    for (let i = 0; i < chain.length; i++) {
      if (i > 10) break;
      chainValue *= 1 + chain[i] * PENALTY_BASE ** (i * i);
    }
    value *= chainValue;
  }
  return value - 1;
}

/** The 2-dp rounding EOS applies to cpu/power/cpuOutput/powerOutput — it *is* the fit tolerance. */
export function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

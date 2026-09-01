/**
 * The optimal neural remap: brute force over every legal base distribution, as EVEMon's
 * `Helpers/AttributesOptimizer.cs` does. There are 2,885 of them, so even a 500-entry plan is a
 * couple of million multiplications — fast enough to run on every "optimise" click.
 *
 * Spec §2 asks only for "the distribution minimising total plan time", so there is no maxDuration
 * and no "trained the most skills" tie-break. Ties fall to the first candidate `enumerateBases()`
 * yields, which is deterministic by construction.
 */
import { ZERO_ATTRIBUTES, addAttributes, enumerateBases, type AttributeSet } from "./attributes.js";
import type { SkillCatalogue } from "./catalogue.js";
import type { ExpandedEntry, KnownLevels } from "./expand.js";
import { planDurationMs } from "./timeline.js";

export interface RemapInput {
  entries: readonly ExpandedEntry[];
  catalogue: SkillCatalogue;
  /** The character's current BASE attributes (implants excluded). */
  currentBase: AttributeSet;
  /** Implant bonuses, added on top of every candidate as well as of `currentBase`. */
  implantBonus?: AttributeSet;
  trained: KnownLevels;
  queued: KnownLevels;
  partialSp?: ReadonlyMap<number, number>;
}

export interface RemapResult {
  /** The winning BASE distribution — what the character would set in the remap window. */
  remap: AttributeSet;
  /** Total plan time under the winning remap, in milliseconds. */
  totalMs: number;
  /** Total plan time under `currentBase`, in milliseconds. */
  currentMs: number;
  /** currentMs - totalMs; never negative. */
  savedMs: number;
  /** How many distributions were evaluated — 2,885. */
  candidates: number;
}

export function optimalRemap(input: RemapInput): RemapResult {
  const { entries, catalogue, currentBase, trained, queued, partialSp } = input;
  const implantBonus = input.implantBonus ?? ZERO_ATTRIBUTES;
  const duration = (base: AttributeSet): number => planDurationMs({
    entries, catalogue, attributes: addAttributes(base, implantBonus), trained, queued, partialSp,
  });

  const currentMs = duration(currentBase);
  const bases = enumerateBases();
  let best = bases[0];
  let bestMs = duration(best);
  for (let i = 1; i < bases.length; i++) {
    const ms = duration(bases[i]);
    if (ms < bestMs) { bestMs = ms; best = bases[i]; }
  }

  return {
    remap: best,
    totalMs: bestMs,
    currentMs,
    savedMs: Math.max(0, currentMs - bestMs),
    candidates: bases.length,
  };
}

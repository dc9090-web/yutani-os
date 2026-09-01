/**
 * The attribute calculator — a transliteration of EOS's MutableAttrMap.__calculate
 * (eos/calculator/map.py:207). See docs/research/dogma-engine.md §2.4 and §6.4.
 */
import {
  OPERATOR_ORDER, Operator, PENALTY_IMMUNE_CATEGORY_IDS, ROUNDED_ATTR_IDS,
  type AttrId, type EffectId, type TypeId,
} from "./data.js";
import { isPenalizable, normalise, penalizeValues, round2 } from "./operators.js";
import { activeModifiers, type CarriedModifier } from "./effects.js";
import { affects } from "./affection.js";
import type { Fit, Item } from "./fit.js";

export class UnknownAttributeError extends Error {
  constructor(readonly attrId: AttrId) {
    super(`unknown attribute ${attrId}`);
    this.name = "UnknownAttributeError";
  }
}

export class DogmaCycleError extends Error {
  constructor(readonly attrId: AttrId) {
    super(`cycle while calculating attribute ${attrId}`);
    this.name = "DogmaCycleError";
  }
}

export interface AppliedModifier {
  carrier: Item;
  carrierTypeId: TypeId;
  carrierName: string | null;
  effectId: EffectId;
  operator: Operator;
  modifyingAttrId: AttrId;
  /** The carrier's fully calculated value of `modifyingAttrId`. */
  rawValue: number;
  /** The normalised (reduced) value the calculator applied. */
  value: number;
  penalised: boolean;
}

interface FitCache {
  /** `null` is the in-progress placeholder EOS uses to spot a cycle. */
  memo: Map<Item, Map<AttrId, number | null>>;
  modifiers: CarriedModifier[] | null;
}

const CACHE = new WeakMap<Fit, FitCache>();

/** Call this after any mutation of the fit — a state change, a module added or removed. */
export function clearMemo(fit: Fit): void {
  CACHE.delete(fit);
}

function cacheFor(fit: Fit): FitCache {
  let cache = CACHE.get(fit);
  if (!cache) {
    cache = { memo: new Map(), modifiers: null };
    CACHE.set(fit, cache);
  }
  return cache;
}

function modifiersFor(fit: Fit): CarriedModifier[] {
  const cache = cacheFor(fit);
  cache.modifiers ??= activeModifiers(fit);
  return cache.modifiers;
}

export function getAttr(fit: Fit, item: Item, attrId: AttrId): number {
  const memo = cacheFor(fit).memo;
  let byAttr = memo.get(item);
  if (!byAttr) {
    byAttr = new Map<AttrId, number | null>();
    memo.set(item, byAttr);
  }
  if (byAttr.has(attrId)) {
    const cached = byAttr.get(attrId) ?? null;
    if (cached === null) throw new DogmaCycleError(attrId);
    return cached;
  }
  byAttr.set(attrId, null);
  try {
    const value = calculate(fit, item, attrId, null);
    byAttr.set(attrId, value);
    return value;
  } catch (e: unknown) {
    byAttr.delete(attrId);          // never leave a placeholder behind
    throw e;
  }
}

/** The modifiers that were applied to `(item, attrId)`, for the "affected by" panel. */
export function explain(fit: Fit, item: Item, attrId: AttrId): AppliedModifier[] {
  const trace: AppliedModifier[] = [];
  calculate(fit, item, attrId, trace);
  return trace;
}

function calculate(fit: Fit, item: Item, attrId: AttrId, trace: AppliedModifier[] | null): number {
  const meta = fit.data.attributes.get(attrId);
  if (!meta) throw new UnknownAttributeError(attrId);

  // 1. seed
  let acc = item.attrs.get(attrId) ?? meta.defaultValue;

  // 2 & 3. gather, normalise, decide penalisation
  const plain = new Map<Operator, number[]>();
  const penalisedBuckets = new Map<Operator, number[]>();
  for (const carried of modifiersFor(fit)) {
    const { carrier, modifier } = carried;
    if (modifier.modifiedAttrId !== attrId) continue;
    if (!affects(fit, carried, item)) continue;
    const rawValue = getAttr(fit, carrier, modifier.modifyingAttrId);   // recurses
    const value = normalise(modifier.operation, rawValue);
    if (value === null) continue;                                        // division by zero
    const penalised = !meta.stackable
      && !PENALTY_IMMUNE_CATEGORY_IDS.has(carrier.categoryId)
      && isPenalizable(modifier.operation);
    push(penalised ? penalisedBuckets : plain, modifier.operation, value);
    trace?.push({
      carrier,
      carrierTypeId: carrier.typeId,
      carrierName: carrier.name,
      effectId: carried.effect.id,
      operator: modifier.operation,
      modifyingAttrId: modifier.modifyingAttrId,
      rawValue,
      value,
      penalised,
    });
  }

  // 4. collapse each penalised bucket into one reduced multiplier
  for (const [operator, values] of penalisedBuckets) push(plain, operator, penalizeValues(values));

  // 5. apply in ascending operator order
  for (const operator of OPERATOR_ORDER) {
    const values = plain.get(operator);
    if (!values || values.length === 0) continue;
    switch (operator) {
      case Operator.PreAssign:
      case Operator.PostAssign:
        acc = meta.highIsGood ? Math.max(...values) : Math.min(...values);
        break;
      case Operator.ModAdd:
      case Operator.ModSub:
        for (const value of values) acc += value;
        break;
      default:
        for (const value of values) acc *= 1 + value;
    }
  }

  // 6. cap (upper only — minAttributeId is deferred, research §2.6)
  if (meta.maxAttributeId !== undefined) acc = Math.min(acc, getAttr(fit, item, meta.maxAttributeId));

  // 7. the 2-dp rounding that makes `used <= output` comparisons behave
  return ROUNDED_ATTR_IDS.has(attrId) ? round2(acc) : acc;
}

function push(into: Map<Operator, number[]>, operator: Operator, value: number): void {
  const values = into.get(operator);
  if (values) values.push(value); else into.set(operator, [value]);
}

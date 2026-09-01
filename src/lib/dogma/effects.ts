/**
 * Which effects are running on which carrier.
 *
 * The state check alone is not enough: EOS's default "full compliance" mode adds three rules
 * (eos/effect_status.py:106) and all three matter for a fitting window. See research §2.7.
 */
import { EFFECT, State, type DogmaEffect, type Modifier } from "./data.js";
import { effectiveState, fitItems, type Fit, type Item } from "./fit.js";

export interface CarriedModifier {
  carrier: Item;
  effect: DogmaEffect;
  modifier: Modifier;
}

export function effectRuns(item: Item, effect: DogmaEffect, isDefault: boolean): boolean {
  if (effectiveState(item) < effect.state) return false;
  // 1. Offline-state effects with a fitting-usage chance are off by default (booster side effects).
  if (effect.state === State.Offline && effect.fittingUsageChanceAttrId !== undefined) return false;
  // 2. Online-category effects need the carrier's own `online` effect. `online` resolves first, so it
  //    is exempt from its own rule; without this exemption nothing online would ever run.
  if (effect.state === State.Online && effect.id !== EFFECT.online && !item.effects.has(EFFECT.online)) {
    return false;
  }
  // 3. Active/target-category effects run only as the type's default effect, so exactly one fires.
  if (effect.state === State.Active && !isDefault) return false;
  return true;
}

export function runningEffects(fit: Fit, item: Item): DogmaEffect[] {
  const out: DogmaEffect[] = [];
  for (const [effectId, isDefault] of item.effects) {
    const effect = fit.data.effects.get(effectId);
    if (!effect) continue;                    // dropped at load time (effect category 3 or 6)
    if (effectRuns(item, effect, isDefault)) out.push(effect);
  }
  return out;
}

/** Every running (carrier, effect, modifier) triple in the fit. The calculator caches this per pass. */
export function activeModifiers(fit: Fit): CarriedModifier[] {
  const out: CarriedModifier[] = [];
  for (const carrier of fitItems(fit)) {
    for (const effect of runningEffects(fit, carrier)) {
      for (const modifier of effect.modifiers) out.push({ carrier, effect, modifier });
    }
  }
  return out;
}

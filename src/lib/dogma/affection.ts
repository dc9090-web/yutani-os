/**
 * Which items a running modifier reaches (EOS eos/calculator/affection.py).
 *
 * The whole thing hangs off Item.domain / Item.ownerModifiable (research §1.2): a `domain: shipID`
 * location filter sees the modules *on* the ship, never the ship itself, and drones are reachable
 * only through OwnerRequiredSkillModifier.
 */
import { REQUIRED_SKILL_ATTRS, type ModifierDomain, type TypeId } from "./data.js";
import type { CarriedModifier } from "./effects.js";
import type { Fit, Item, ItemDomain } from "./fit.js";

/** The single item an ItemModifier names. */
export function itemForDomain(fit: Fit, carrier: Item, domain: ModifierDomain): Item | null {
  switch (domain) {
    case "self": return carrier;
    case "character": return fit.character;
    case "ship": return fit.ship;
    case "other": return carrier.charge ?? carrier.container ?? null;
  }
}

/**
 * The bucket an en-masse filter iterates. `self` is resolved against the carrier first: on the ship it
 * is `ship`, on the character `character`, on anything else the modifier is unusable and skipped.
 */
export function absoluteDomain(fit: Fit, carrier: Item, domain: ModifierDomain): ItemDomain {
  switch (domain) {
    case "ship": return "ship";
    case "character": return "character";
    case "other": return null;              // EOS has no location bucket for `other`
    case "self":
      if (carrier === fit.ship) return "ship";
      if (carrier === fit.character) return "character";
      return null;
  }
}

export function itemRequiresSkill(item: Item, skillTypeId: TypeId): boolean {
  for (const [skillAttr] of REQUIRED_SKILL_ATTRS) {
    const value = item.attrs.get(skillAttr);
    if (value !== undefined && Math.round(value) === skillTypeId) return true;
  }
  return false;
}

export function affects(fit: Fit, carried: CarriedModifier, target: Item): boolean {
  const { carrier, modifier } = carried;
  switch (modifier.func) {
    case "ItemModifier":
      return itemForDomain(fit, carrier, modifier.domain) === target;
    case "LocationModifier":
      return inBucket(fit, carrier, modifier.domain, target);
    case "LocationGroupModifier":
      return modifier.groupId !== undefined
        && target.groupId === modifier.groupId
        && inBucket(fit, carrier, modifier.domain, target);
    case "LocationRequiredSkillModifier":
      return modifier.skillTypeId !== undefined
        && itemRequiresSkill(target, modifier.skillTypeId)
        && inBucket(fit, carrier, modifier.domain, target);
    case "OwnerRequiredSkillModifier":
      // Domain-independent: every owner-modifiable item requiring the skill (charges, drones, fighters).
      return modifier.skillTypeId !== undefined
        && target.ownerModifiable
        && itemRequiresSkill(target, modifier.skillTypeId);
  }
}

function inBucket(fit: Fit, carrier: Item, domain: ModifierDomain, target: Item): boolean {
  const bucket = absoluteDomain(fit, carrier, domain);
  return bucket !== null && target.domain === bucket;
}

/**
 * Humanisers for the two open ESI vocabularies the pages show. Both enums grow without a
 * compatibility-date bump (research §8a and §2.8), so neither function may be exhaustive:
 * an unknown location_flag falls back to the raw value and an unknown ref_type to the generic
 * snake_case rule.
 */

/** Slot families that carry a zero-based index EVE displays one-based. */
const NUMBERED: [RegExp, string][] = [
  [/^HiSlot(\d+)$/, "High slot"],
  [/^MedSlot(\d+)$/, "Mid slot"],
  [/^LoSlot(\d+)$/, "Low slot"],
  [/^RigSlot(\d+)$/, "Rig slot"],
  [/^SubSystemSlot(\d+)$/, "Subsystem slot"],
  [/^FighterTube(\d+)$/, "Fighter tube"],
];

const EXACT: Record<string, string> = {
  AssetSafety: "Asset safety",
  AutoFit: "Auto-fit",
  BoosterBay: "Booster bay",
  CapsuleerDeliveries: "Capsuleer deliveries",
  Cargo: "Cargo hold",
  CorporationGoalDeliveries: "Corporation goal deliveries",
  CorpseBay: "Corpse bay",
  Deliveries: "Deliveries",
  DroneBay: "Drone bay",
  ExpeditionHold: "Expedition hold",
  FighterBay: "Fighter bay",
  FleetHangar: "Fleet hangar",
  FrigateEscapeBay: "Frigate escape bay",
  Hangar: "Hangar",
  HangarAll: "Hangar",
  HiddenModifiers: "Hidden modifiers",
  Implant: "Implant",
  InfrastructureHangar: "Infrastructure hangar",
  Locked: "Locked",
  MobileDepotHold: "Mobile depot hold",
  MoonMaterialBay: "Moon material bay",
  QuafeBay: "Quafe bay",
  ShipHangar: "Ship hangar",
  Skill: "Skill",
  StructureDeedBay: "Structure deed bay",
  SubSystemBay: "Subsystem bay",
  Unlocked: "Unlocked",
  Wardrobe: "Wardrobe",
};

/** SpecializedOreHold, SpecializedFuelBay, … — 15 members that all read better without the prefix. */
const SPECIALIZED = /^Specialized([A-Za-z]+)$/;

function splitCamel(value: string): string {
  return value.replace(/([a-z0-9])([A-Z])/g, "$1 $2").toLowerCase();
}

function sentence(value: string): string {
  return value.length === 0 ? value : `${value[0].toUpperCase()}${value.slice(1)}`;
}

/** "HiSlot3" -> "High slot 4"; "Cargo" -> "Cargo hold"; anything unknown -> the raw value. */
export function flagLabel(flag: string): string {
  const exact = EXACT[flag];
  if (exact !== undefined) return exact;
  for (const [pattern, label] of NUMBERED) {
    const match = pattern.exec(flag);
    if (match !== null) return `${label} ${Number(match[1]) + 1}`;
  }
  const specialized = SPECIALIZED.exec(flag);
  if (specialized !== null) return sentence(splitCamel(specialized[1]));
  return flag;
}

/** "market_transaction" -> "Market transaction". Deliberately generic — there are ~180 members. */
export function refTypeLabel(refType: string): string {
  return sentence(refType.replace(/_/g, " "));
}

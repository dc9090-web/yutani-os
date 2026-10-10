/**
 * The fit sheet's Consumables panel: what the hold carries that the ship uses up and that is not
 * ammunition — capacitor booster charges, nanite repair paste, boosters (drugs and accelerators),
 * filaments and command burst charges. Each row says what the item does (`effect`) and how this
 * ship uses it (`use`): the fitted module that loads it and how many go in per load, a booster's
 * slot and duration, a filament's ship cap and spool-up. Scripts and probes are loaded and
 * recovered, not used up, so they are not here.
 */
import { ATTR, chargeFits, type BuiltFit, type DogmaType, type Fit } from "../dogma/index.js";
import { grouped } from "./format.js";
import { dist } from "./ships.js";

export type ConsumableKind = "capBooster" | "paste" | "booster" | "burstCharge" | "filament";

export interface ConsumableRowView {
  key: string; typeId: number; name: string; desc: string | null;
  kind: ConsumableKind;
  /** What it does: "+400 GJ per charge", a booster's bonuses, where a filament goes. */
  effect: string;
  /** How this ship uses it; null when there is nothing to say (no fitted module takes it). */
  use: string | null;
}

const GROUP = {
  capBoosterCharge: 87, nanitePaste: 916, booster: 303,
  jumpFilaments: 4041, triglavianFilaments: 4087, abyssalFilaments: 1979, abyssalProvingFilaments: 4050,
} as const;
const BURST_CHARGE_GROUPS: ReadonlySet<number> = new Set([1769, 1771, 1772, 1773, 1774, 4905]);

const CONSUMABLE_ATTR = {
  capacitorBonus: 67,
  chargedArmorDamageMultiplier: 1886,
  boosterDuration: 330,
  boosterness: 1087,
  boosterEffectChance: 1089,
  abyssalTier: 2761,
  shipJumpCap: 2832,
  spoolupSeconds: 5783,
} as const;

/** How a booster attribute is written: a percentage, a multiplier (1.02 = +2%), attribute points, metres or a bare number. */
type Unit = "pct" | "mult" | "points" | "metres" | "plain";
/** The bonus attributes boosters carry, with the short labels the row uses. Anything not listed is not shown. */
const BOOSTER_BONUS: ReadonlyMap<number, [string, Unit]> = new Map<number, [string, Unit]>([
  [292, ["weapon damage", "pct"]], [213, ["missile damage", "pct"]], [6125, ["missile damage", "pct"]],
  [64, ["turret damage", "mult"]], [293, ["rate of fire", "pct"]], [441, ["rate of fire", "pct"]],
  [548, ["shield boost", "pct"]], [895, ["armor repair", "pct"]],
  [337, ["shield HP", "pct"]], [335, ["armor HP", "pct"]], [1083, ["armor HP", "pct"]], [327, ["hull HP", "pct"]],
  [994, ["EM resistance", "pct"]], [995, ["explosive resistance", "pct"]], [996, ["kinetic resistance", "pct"]], [997, ["thermal resistance", "pct"]],
  [315, ["velocity", "pct"]], [318, ["speed", "pct"]], [151, ["inertia", "pct"]], [624, ["warp speed", "pct"]], [554, ["signature radius", "pct"]],
  [1079, ["capacitor", "pct"]], [314, ["cap recharge time", "pct"]], [317, ["capacitor need", "pct"]],
  [767, ["tracking", "pct"]], [351, ["optimal range", "pct"]], [294, ["optimal range", "pct"]], [349, ["falloff", "pct"]],
  [848, ["explosion radius", "pct"]], [847, ["explosion velocity", "pct"]], [557, ["missile flight time", "pct"]],
  [309, ["targeting range", "pct"]], [566, ["scan resolution", "pct"]],
  [1027, ["gravimetric strength", "pct"]], [1028, ["ladar strength", "pct"]], [1029, ["magnetometric strength", "pct"]], [1030, ["radar strength", "pct"]],
  [459, ["drone control range", "metres"]], [591, ["drone velocity", "pct"]], [3353, ["drone tracking", "pct"]],
  [66, ["module duration", "pct"]], [312, ["duration", "pct"]],
  [434, ["mining yield", "pct"]], [780, ["ice cycle time", "pct"]], [6098, ["mining range", "pct"]],
  [6099, ["mining duration & cap use", "pct"]], [6090, ["mining critical chance", "pct"]], [6053, ["residue chance", "pct"]],
  [846, ["probe strength", "pct"]], [1156, ["scan deviation", "pct"]],
  [1915, ["virus coherence", "plain"]], [6092, ["virus coherence", "plain"]], [1918, ["virus strength", "plain"]],
  [2267, ["cap warfare resistance", "pct"]], [2353, ["weapon disruption resistance", "pct"]],
  [2351, ["sensor dampener resistance", "pct"]], [3422, ["webifier resistance", "pct"]], [3206, ["web range", "metres"]],
  [175, ["Charisma", "points"]], [176, ["Intelligence", "points"]], [177, ["Memory", "points"]], [178, ["Perception", "points"]], [179, ["Willpower", "points"]],
]);
/** The side-effect penalties of the old-style drugs; each one applies with `boosterEffectChance` odds. */
const BOOSTER_PENALTY: ReadonlyMap<number, string> = new Map([
  [1141, "armor HP"], [1142, "armor repair"], [1143, "shield HP"], [616, "shield boost"],
  [1144, "turret optimal"], [1145, "turret tracking"], [1146, "turret falloff"],
  [1147, "explosion velocity"], [1148, "missile velocity"], [1149, "explosion radius"],
  [1150, "capacitor"], [1151, "velocity"],
]);

const signed = (value: number, suffix = ""): string => `${value < 0 ? "−" : "+"}${grouped(Number(Math.abs(value).toFixed(2)))}${suffix}`;

function bonusText(label: string, unit: Unit, value: number): string {
  switch (unit) {
    case "pct": return `${signed(value, "%")} ${label}`;
    case "mult": return `${signed(Math.round((value - 1) * 1000) / 10, "%")} ${label}`;
    case "points": return `${signed(value)} ${label}`;
    case "metres": return `${value < 0 ? "−" : "+"}${dist(Math.abs(value))} ${label}`;
    case "plain": return `${signed(value)} ${label}`;
  }
}

/** "30 min", "2 h", "1 h 30 min" — a booster's duration from its millisecond attribute. */
export function boosterLength(ms: number): string {
  const minutes = Math.round(ms / 60_000);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

/** A booster's bonuses, then its side effects with their odds: "+5% shield boost, +5% armor repair". */
function boosterEffect(type: DogmaType): string {
  const bonuses: string[] = [];
  for (const [attrId, [label, unit]] of BOOSTER_BONUS) {
    const value = type.attrs.get(attrId);
    if (value === undefined || value === 0 || (unit === "mult" && value === 1)) continue;
    bonuses.push(bonusText(label, unit, value));
  }
  const penalties: string[] = [];
  for (const [attrId, label] of BOOSTER_PENALTY) {
    const value = type.attrs.get(attrId);
    if (value === undefined || value === 0) continue;
    penalties.push(`${signed(value, "%")} ${label}`);
  }
  const chance = type.attrs.get(CONSUMABLE_ATTR.boosterEffectChance) ?? 0;
  let text = bonuses.length === 0 ? "No listed bonus" : bonuses.join(", ");
  if (penalties.length > 0) text += ` · ${chance > 0 ? `${Math.round(chance * 100)}% chance each: ` : ""}${penalties.join(", ")}`;
  return text;
}

/** The first fitted module that loads this charge, and how many go in per load. */
function loader(fit: Fit, charge: DogmaType): { type: DogmaType; name: string; perLoad: number; count: number } | null {
  let first: { type: DogmaType; name: string; perLoad: number; count: number } | null = null;
  for (const { item } of fit.modules) {
    const moduleType = fit.data.types.get(item.typeId);
    if (moduleType === undefined || !chargeFits(moduleType, charge)) continue;
    if (first !== null) { first.count += 1; continue; }
    const capacity = moduleType.attrs.get(ATTR.capacity) ?? 0;
    const volume = charge.attrs.get(ATTR.volume) ?? 0;
    // 0.08 / 0.01 is 7.999…: nudge before flooring so the paste count reads 8, as in the client.
    const perLoad = volume > 0 ? Math.floor(capacity / volume + 1e-6) : 0;
    first = { type: moduleType, name: moduleType.name ?? `Type ${moduleType.id}`, perLoad, count: 1 };
  }
  return first;
}

const perLoad = (loaded: { name: string; perLoad: number }): string =>
  loaded.perLoad > 0 ? `${loaded.name}, ${loaded.perLoad} per load` : loaded.name;

function describe(fit: Fit, type: DogmaType): { kind: ConsumableKind; effect: string; use: string | null } | null {
  switch (type.groupId) {
    case GROUP.capBoosterCharge: {
      const loaded = loader(fit, type);
      return {
        kind: "capBooster",
        effect: `+${grouped(type.attrs.get(CONSUMABLE_ATTR.capacitorBonus) ?? 0)} GJ per charge`,
        use: loaded === null ? null : perLoad(loaded),
      };
    }
    case GROUP.nanitePaste: {
      const loaded = loader(fit, type);
      if (loaded === null) return { kind: "paste", effect: "Overheat repair", use: null };
      const multiplier = loaded.type.attrs.get(CONSUMABLE_ATTR.chargedArmorDamageMultiplier);
      return {
        kind: "paste",
        effect: multiplier === undefined ? "Overheat repair" : `×${grouped(multiplier)} armor repair`,
        use: perLoad(loaded),
      };
    }
    case GROUP.booster: {
      const slot = type.attrs.get(CONSUMABLE_ATTR.boosterness);
      const ms = type.attrs.get(CONSUMABLE_ATTR.boosterDuration);
      const parts = [slot === undefined ? null : `Slot ${slot}`, ms === undefined ? null : boosterLength(ms)].filter((p): p is string => p !== null);
      return { kind: "booster", effect: boosterEffect(type), use: parts.length === 0 ? null : parts.join(" · ") };
    }
    case GROUP.jumpFilaments:
    case GROUP.triglavianFilaments:
    case GROUP.abyssalFilaments:
    case GROUP.abyssalProvingFilaments: {
      const tier = type.attrs.get(CONSUMABLE_ATTR.abyssalTier);
      const effect = type.groupId === GROUP.jumpFilaments ? "Jump to a random null-sec system"
        : type.groupId === GROUP.triglavianFilaments ? "Conduit into Pochven"
        : type.groupId === GROUP.abyssalProvingFilaments ? "Abyssal Proving Grounds"
        : `Abyssal Deadspace${tier === undefined ? "" : `, tier ${tier}`}`;
      const cap = type.attrs.get(CONSUMABLE_ATTR.shipJumpCap);
      const spool = type.attrs.get(CONSUMABLE_ATTR.spoolupSeconds);
      const parts = [cap === undefined ? null : `up to ${cap} ship${cap === 1 ? "" : "s"}`, spool === undefined ? null : `${spool} s spool-up`].filter((p): p is string => p !== null);
      return { kind: "filament", effect, use: parts.length === 0 ? null : parts.join(" · ") };
    }
    default: {
      if (!BURST_CHARGE_GROUPS.has(type.groupId)) return null;
      const loaded = loader(fit, type);
      const groupName = fit.data.groups.get(type.groupId)?.name ?? "Command burst";
      return {
        kind: "burstCharge",
        effect: `For ${groupName.replace(/ Charges$/, "")}`,
        use: loaded === null ? null : loaded.count > 1 ? `${loaded.count} × ${loaded.name}` : loaded.name,
      };
    }
  }
}

const KIND_ORDER: Record<ConsumableKind, number> = { capBooster: 0, paste: 1, booster: 2, burstCharge: 3, filament: 4 };

/** One row per consumable type in the hold, cap charges first, then paste, boosters, burst charges and filaments; ties by name. */
export function consumableRows(built: BuiltFit, descriptions: ReadonlyMap<number, string>): ConsumableRowView[] {
  const fit = built.fit;
  const rows: ConsumableRowView[] = [];
  const seen = new Set<number>();
  for (const entry of built.cargo) {
    if (seen.has(entry.typeId)) continue;
    seen.add(entry.typeId);
    const type = fit.data.types.get(entry.typeId);
    if (type === undefined) continue;
    const described = describe(fit, type);
    if (described === null) continue;
    rows.push({
      key: `consumable:${type.id}`, typeId: type.id,
      name: type.name ?? `Unknown type (${type.id})`,
      desc: descriptions.get(type.id) ?? null,
      ...described,
    });
  }
  rows.sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || a.name.localeCompare(b.name));
  return rows;
}

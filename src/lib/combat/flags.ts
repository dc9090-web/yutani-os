/**
 * Killmail item flags are raw SDE `invFlags.flagID` integers — a third vocabulary, unrelated to the
 * asset and fitting string enums (research §8d). The bands are spec §6's ruling: low 11-18, mid
 * 19-26, high 27-34, rigs 92-94, subsystems 125-132, drone bay 87, cargo 5, implants 89, fighter
 * bay 158; anything else is "other". Pure — a client component may import this.
 */
export type KillmailSlot =
  | "high" | "mid" | "low" | "rig" | "subsystem" | "drone" | "cargo" | "implant" | "fighter" | "other";

/** Display order of the fit panel (spec §6): the ship's own slots first, then everything carried. */
export const KILLMAIL_SLOT_ORDER: readonly KillmailSlot[] = [
  "high", "mid", "low", "rig", "subsystem", "drone", "fighter", "implant", "cargo", "other",
];

export const SLOT_TITLES: Record<KillmailSlot, string> = {
  high: "High", mid: "Mid", low: "Low", rig: "Rigs", subsystem: "Subsystems",
  drone: "Drone bay", fighter: "Fighter bay", implant: "Implants", cargo: "Cargo", other: "Other",
};

/** [first flag, last flag, slot, the phase-5 flag prefix or null when a fit cannot hold it]. */
const BANDS: readonly (readonly [number, number, KillmailSlot, string | null])[] = [
  [11, 18, "low", "LoSlot"],
  [19, 26, "mid", "MedSlot"],
  [27, 34, "high", "HiSlot"],
  [92, 94, "rig", "RigSlot"],
  [125, 132, "subsystem", "SubSystemSlot"],
  [5, 5, "cargo", "Cargo"],
  [87, 87, "drone", "DroneBay"],
  [89, 89, "implant", null],
  [158, 158, "fighter", null],
];

export function slotOfFlag(flag: number): KillmailSlot {
  for (const [from, to, slot] of BANDS) if (flag >= from && flag <= to) return slot;
  return "other";
}

/**
 * The phase-5 fitting flag for a numeric killmail flag — `27` is `HiSlot0`, so the built fit lands
 * in the same slot the victim used. `null` means the item was never fitted (an implant, a fighter,
 * an unrecognised flag) and belongs in no fit.
 */
export function fitFlagOfFlag(flag: number): string | null {
  for (const [from, to, , prefix] of BANDS) {
    if (flag < from || flag > to || prefix === null) continue;
    return from === to ? prefix : `${prefix}${flag - from}`;
  }
  return null;
}

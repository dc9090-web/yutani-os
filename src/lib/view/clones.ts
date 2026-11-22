import { implantBonusLabel } from "./skills.js";

/** `implantness` in sde_type_attributes: which of the ten implant slots a type plugs into. */
export const IMPLANT_SLOT_ATTR = 331;
export const IMPLANT_SLOTS = 10;

export interface ImplantView {
  typeId: number;
  name: string;
  /** 1–10 from the SDE; null for a type whose dogma carries no slot. */
  slot: number | null;
  /** "+5 Perception" for an attribute implant; null for a hardwiring. */
  bonus: string | null;
  /** The SDE description, for the info panel; null when the SDE has none. */
  desc: string | null;
}

export interface CloneView {
  implants: ImplantView[];
  /** One flag per slot 1–10: true where an implant sits. */
  slots: boolean[];
  used: number;
}

export interface ImplantSource {
  name: string | null;
  attributes: ReadonlyMap<number, number>;
  desc: string | null;
}

/**
 * One clone's implants (redesign hand-off, PAGES.md §3): sorted by slot, with the ten-slot strip
 * that shows which slots are taken. The slot comes from the SDE's `implantness` attribute, not from
 * the implant's name. An implant with no slot on record sorts last and fills no block — the count
 * still includes it.
 */
export function cloneView(typeIds: readonly number[], types: ReadonlyMap<number, ImplantSource>): CloneView {
  const implants = typeIds.map((typeId): ImplantView => {
    const type = types.get(typeId);
    const raw = type?.attributes.get(IMPLANT_SLOT_ATTR);
    const slot = raw === undefined ? null : Math.round(raw);
    return {
      typeId,
      name: type?.name ?? `Type ${typeId}`,
      slot: slot !== null && slot >= 1 && slot <= IMPLANT_SLOTS ? slot : null,
      bonus: type === undefined ? null : implantBonusLabel(type.attributes),
      desc: type?.desc ?? null,
    };
  }).sort((a, b) => (a.slot ?? IMPLANT_SLOTS + 1) - (b.slot ?? IMPLANT_SLOTS + 1) || a.name.localeCompare(b.name));
  const taken = new Set(implants.map((i) => i.slot));
  return {
    implants,
    slots: Array.from({ length: IMPLANT_SLOTS }, (_, index) => taken.has(index + 1)),
    used: implants.length,
  };
}

export interface JumpCloneView extends CloneView {
  jumpCloneId: number;
  /** "JC 01" — the clone's place in the character's list, which is ordered by jump clone id. */
  code: string;
  /** The name the pilot gave the clone in game; null when unnamed. */
  name: string | null;
}

export interface CloneLocationView {
  key: string;
  /** The solar system, when the place resolves to one; otherwise the place's own label. */
  title: string;
  /** The full station or structure name; null when `title` already says everything there is. */
  station: string | null;
  clones: JumpCloneView[];
}

export interface JumpCloneSource { jumpCloneId: number; locationId: number | null; name: string | null; implants: readonly number[] }
export interface ClonePlace { name: string; systemName: string | null }

/**
 * Jump clones grouped by where they are, the place with the most clones first (ties keep the order
 * the clones arrive in). Clones whose location ESI did not give are grouped under "Unknown location".
 */
export function cloneLocations(
  clones: readonly JumpCloneSource[],
  places: ReadonlyMap<number, ClonePlace>,
  types: ReadonlyMap<number, ImplantSource>,
): CloneLocationView[] {
  const byKey = new Map<string, CloneLocationView>();
  clones.forEach((clone, index) => {
    const place = clone.locationId === null ? undefined : places.get(clone.locationId);
    const key = clone.locationId === null || place === undefined ? "unknown" : String(clone.locationId);
    let location = byKey.get(key);
    if (location === undefined) {
      location = place === undefined
        ? { key, title: "Unknown location", station: null, clones: [] }
        : { key, title: place.systemName ?? place.name, station: place.systemName === null ? null : place.name, clones: [] };
      byKey.set(key, location);
    }
    location.clones.push({
      ...cloneView(clone.implants, types),
      jumpCloneId: clone.jumpCloneId,
      code: `JC ${String(index + 1).padStart(2, "0")}`,
      name: clone.name === null || clone.name.trim() === "" ? null : clone.name,
    });
  });
  return [...byKey.values()].sort((a, b) => b.clones.length - a.clones.length);
}

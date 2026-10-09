/**
 * Pure view helpers for the Ships pages. No I/O, no React — every function here is unit-tested and
 * the components stay dumb (the phase-3b pattern).
 */
import type { AssetRow } from "../db/character-assets.js";
import type { FittingRow } from "../db/character-fittings.js";
import {
  CATEGORY, fitFromAssets, fitFromFitting, fitStats, validateFit,
  type BuiltFit, type DogmaData, type FitContext, type FitStats, type Problem,
  assumeCargoAmmo, fitPerformance, hardpointOf, weaponRange,
  type AssumedAmmo, type ChargeRangeHint, type Fit, type FitPerformance, type WeaponRange,
} from "../dogma/index.js";
import { iskShort, rollUpValue, unpricedNote, type Price, type ValuedEntry } from "./price.js";
import { clock, grouped } from "./format.js";

/** A weapon range: metres under a kilometre, otherwise one decimal of km — the fitting window's convention. */
export const dist = (metres: number): string => metres < 1000 ? `${Math.round(metres)} m` : `${grouped((metres / 1000).toFixed(1))} km`;

/**
 * "optimal 1.2 km · falloff 5.2 km" for a turret, "range 38.2 km" for a missile. A falloff of a
 * metre or less is the SDE default on a weapon that has none (a mining laser), so it is left off.
 */
export function rangeText(range: WeaponRange | null): string | null {
  if (range === null) return null;
  if (range.kind === "missile") return `range ${dist(range.range)}`;
  return range.falloff > 1 ? `optimal ${dist(range.optimal)} · falloff ${dist(range.falloff)}` : `optimal ${dist(range.optimal)}`;
}

/** "+60%" / "−50%" for a range multiplier. */
export const pct = (multiplier: number): string => `${multiplier > 1 ? "+" : "−"}${Math.round(Math.abs(multiplier - 1) * 100)}%`;

/**
 * For ammo nothing fitted can load: a missile's own flight range, or what a turret charge does to
 * the range of whatever gun takes it, "optimal −50% · falloff −25%".
 */
export function hintText(hint: ChargeRangeHint | null): string | null {
  if (hint === null) return null;
  if (hint.kind === "missile") return `range ${dist(hint.range)}`;
  const parts: string[] = [];
  if (hint.optimal !== 1) parts.push(`optimal ${pct(hint.optimal)}`);
  if (hint.falloff !== 1) parts.push(`falloff ${pct(hint.falloff)}`);
  return parts.join(" · ");
}

/** One line of a ship card's weapons list: identical weapon + charge pairs are counted together. */
export interface ShipWeaponView { key: string; name: string; count: number; charge: string | null; range: string | null }

/** The fit's turrets and launchers in slot order, grouped by weapon type and loaded charge. */
export function shipWeapons(fit: Fit): ShipWeaponView[] {
  const out = new Map<string, ShipWeaponView>();
  for (const { item } of fit.modules) {
    if (hardpointOf(item) === null) continue;
    const chargeId = item.charge?.typeId ?? null;
    const key = `${item.typeId}:${chargeId ?? ""}`;
    const seen = out.get(key);
    if (seen !== undefined) { seen.count += 1; continue; }
    out.set(key, {
      key,
      name: fit.data.types.get(item.typeId)?.name ?? `Unknown type (${item.typeId})`,
      count: 1,
      charge: chargeId === null ? null : fit.data.types.get(chargeId)?.name ?? `Unknown type (${chargeId})`,
      range: rangeText(weaponRange(fit, item)),
    });
  }
  return [...out.values()];
}

/** dogmaUnits 105 Percentage, 109 Modifier Percent, 127 Absolute Percent all display as "%". */
const PERCENT_UNIT_IDS: ReadonlySet<number> = new Set([105, 109, 127]);

/** The SDE's bonus text carries `<a href=showinfo:3302>…</a>` anchors; the page shows plain text. */
export function stripBonusMarkup(text: string): string {
  return text.replace(/<[^>]*>/g, "");
}

/** "7.5% bonus to Small Projectile Turret rate of fire" — value first, then the stripped text. */
export function bonusLabel(b: { bonus: number | null; bonusText: string | null; unitId: number | null }): string {
  const text = stripBonusMarkup(b.bonusText ?? "").trim();
  if (b.bonus === null) return text;
  const value = `${b.bonus}${b.unitId !== null && PERCENT_UNIT_IDS.has(b.unitId) ? "%" : ""}`;
  return text === "" ? value : `${value} ${text}`;
}

/** A resource bar: CPU, powergrid or calibration. `over` drives the `.over` CSS class (spec §4). */
export interface GaugeView {
  label: string; unit: string; used: number; output: number;
  text: string; percent: number; over: boolean;
}

/**
 * `percent` is clamped to 100 so the bar never overflows its track; `over` is the honest
 * `used > output` test — the same one `validateFit` makes, with no epsilon, because the engine
 * already rounded CPU and powergrid to two decimals. A blank `unit` (calibration) would otherwise
 * leave a trailing space in `text`; trim it so the two forms both read cleanly.
 */
export function gauge(
  label: string, unit: string, pool: { used: number; output: number }, digits = 2,
): GaugeView {
  const raw = pool.output > 0 ? (pool.used / pool.output) * 100 : pool.used > 0 ? 100 : 0;
  return {
    label, unit, used: pool.used, output: pool.output,
    text: `${pool.used.toFixed(digits)} / ${pool.output.toFixed(digits)} ${unit}`.trimEnd(),
    percent: Math.round(Math.min(100, raw) * 10) / 10,
    over: pool.used > pool.output,
  };
}

/** An assembled hull and the asset rows sitting directly inside it. */
export interface ShipGroup { ship: AssetRow; children: AssetRow[] }

/**
 * Spec §4's "fitted ships": every assembled (singleton) asset whose type is in category 6, together
 * with the rows whose `location_id` is that ship's `item_id` — which is where ESI puts fitted
 * modules, their charges, the drone bay and the cargo hold alike (phase 4a's builder sorts them out).
 *
 * A hull whose type the SDE does not know cannot be recognised as a ship and gets no card; spec §6's
 * `Unknown type (id)` rule is about the *contents* of a known ship (`BuiltFit.unknown`). A ship
 * inside another ship gets its own group as well as a line in its parent's cargo — both are true.
 */
export function assembledShips(assets: AssetRow[], data: DogmaData): ShipGroup[] {
  const byLocation = new Map<number, AssetRow[]>();
  for (const asset of assets) {
    const bucket = byLocation.get(asset.locationId);
    if (bucket === undefined) byLocation.set(asset.locationId, [asset]);
    else bucket.push(asset);
  }
  return assets
    .filter((a) => a.isSingleton && data.types.get(a.typeId)?.categoryId === CATEGORY.ship)
    .map((ship) => ({ ship, children: byLocation.get(ship.itemId) ?? [] }));
}

/**
 * Where the card says the ship is. A `location_type` of "item" means the parent is another of the
 * character's items (a ship maintenance bay, a container), and `locationLabels` must never be asked
 * about an item id — so that case is answered from the asset rows instead.
 */
export function shipLocationLabel(
  ship: AssetRow,
  places: ReadonlyMap<number, { name: string }>,
  byItemId: ReadonlyMap<number, AssetRow>,
  data: DogmaData,
): string {
  if (ship.locationType !== "item") {
    return places.get(ship.locationId)?.name ?? `Unknown location (${ship.locationId})`;
  }
  const parent = byItemId.get(ship.locationId);
  if (parent === undefined) return `Container ${ship.locationId}`;
  return parent.name ?? data.types.get(parent.typeId)?.name ?? `Container ${ship.locationId}`;
}

/** One labelled bucket of `fitValueGroups`'s walk — `/ships`'s flat total and the fit sheet's five
 *  per-group value lines are two views onto the same five buckets. */
export interface FitValueGroup { label: string; entries: ValuedEntry[] }

/**
 * Spec §4's estimated value, walked once: ship, fitted modules, their charges, drones, cargo. A
 * loaded charge counts as **one** unit — the engine models it as a single item with no stack size;
 * ammunition in the cargo hold is counted at its real quantity. `fitValueEntries` (the flat total)
 * and the fit sheet's per-group value lines both read this same walk, so the two can never drift
 * apart (a pinned equal-totals test guards it).
 */
export function fitValueGroups(built: BuiltFit): FitValueGroup[] {
  const moduleEntries: ValuedEntry[] = [];
  const chargeEntries: ValuedEntry[] = [];
  for (const slotted of built.fit.modules) {
    moduleEntries.push({ typeId: slotted.item.typeId, quantity: 1 });
    if (slotted.item.charge !== undefined) chargeEntries.push({ typeId: slotted.item.charge.typeId, quantity: 1 });
  }
  return [
    { label: "Hull", entries: [{ typeId: built.fit.ship.typeId, quantity: 1 }] },
    { label: "Modules & rigs", entries: moduleEntries },
    { label: "Charges", entries: chargeEntries },
    { label: "Drones", entries: built.drones.map((d) => ({ typeId: d.typeId, quantity: d.quantity })) },
    { label: "Cargo", entries: built.cargo.map((c) => ({ typeId: c.typeId, quantity: c.quantity })) },
  ];
}

/** The flat entry list `/ships`'s single running total prices — see `fitValueGroups`. */
export function fitValueEntries(built: BuiltFit): ValuedEntry[] {
  return fitValueGroups(built).flatMap((g) => g.entries);
}

/** One card in the `/ships` grid. Everything is a string or a number — no engine objects. */
/** The card's headline numbers — the fitting window's four you glance at first. `capOk` colours the
 *  capacitor tile: green stable, amber draining, null when the engine can't say. */
export interface ShipCardStats {
  dps: string; ehp: string; velocity: string; cap: string; capOk: boolean | null;
  /** "MWD" / "AB" when `velocity` is the running-propulsion figure; null when it is the cold one. */
  propKind: "MWD" | "AB" | null;
}

const DASH = "—";
export function shipCardStats(perf: FitPerformance): ShipCardStats {
  const cap = perf.capStable;
  return {
    dps: perf.dps === null ? DASH : grouped(perf.dps.toFixed(1)),
    ehp: perf.ehp === null ? DASH : grouped(Math.round(perf.ehp)),
    velocity: perf.propulsion !== null ? `${grouped(Math.round(perf.propulsion.velocity))} m/s`
      : perf.maxVelocity === null ? DASH : `${grouped(Math.round(perf.maxVelocity))} m/s`,
    cap: cap === null ? DASH : cap.stable ? `Stable ${Math.round(cap.level * 100)}%` : `Lasts ${clock(cap.lastsSeconds)}`,
    capOk: cap === null ? null : cap.stable,
    propKind: perf.propulsion === null ? null : perf.propulsion.kind === "Microwarpdrive" ? "MWD" : "AB",
  };
}

export interface ShipCardView {
  key: string; href: string; name: string | null; typeId: number; typeName: string;
  groupName: string | null; raceName: string | null; location: string;
  stats: ShipCardStats | null;
  cpu: GaugeView | null; power: GaugeView | null; missingSkills: number;
  /** Turrets and launchers with their charge and reach; empty when the fit has none. */
  weapons: ShipWeaponView[];
  value: string | null; valueRaw: number; unpriced: string | null; error: string | null;
}

export function toShipCard(input: {
  key: string; href: string; name: string | null; typeId: number; typeName: string;
  groupName: string | null; raceName: string | null; location: string;
  stats: FitStats; problems: Problem[]; entries: ValuedEntry[]; prices: ReadonlyMap<number, Price>;
  /** `fitPerformance(built.fit)`; absent → no stat strip on the card. */
  perf?: FitPerformance;
  weapons?: ShipWeaponView[];
}): ShipCardView {
  const roll = rollUpValue(input.entries, input.prices);
  return {
    key: input.key, href: input.href, name: input.name, typeId: input.typeId,
    typeName: input.typeName, groupName: input.groupName, raceName: input.raceName, location: input.location,
    stats: input.perf === undefined ? null : shipCardStats(input.perf),
    cpu: gauge("CPU", "tf", input.stats.cpu),
    power: gauge("Powergrid", "MW", input.stats.power),
    missingSkills: input.problems.filter((p) => p.kind === "skill").length,
    weapons: input.weapons ?? [],
    value: iskShort(roll.total), valueRaw: roll.total, unpriced: unpricedNote(roll.unpriced), error: null,
  };
}

/**
 * Spec §6: an engine exception is caught per fit and the card says so. `valueRaw` is -1 so these
 * sort below a genuinely worthless fit rather than mixing in with the zero-value ones.
 */
export function errorShipCard(input: {
  key: string; href: string; name: string | null; typeId: number; typeName: string;
  groupName: string | null; raceName: string | null; location: string;
}): ShipCardView {
  return {
    ...input, stats: null, cpu: null, power: null, missingSkills: 0, weapons: [],
    value: null, valueRaw: -1, unpriced: null, error: "Could not compute",
  };
}

/** The hull's group name ("Frigate", "Strategic Cruiser", …), or null when the type is unknown. */
function groupNameFor(typeId: number, data: DogmaData): string | null {
  const groupId = data.types.get(typeId)?.groupId;
  return groupId === undefined ? null : data.groups.get(groupId)?.name ?? null;
}

/** Spec §4: value descending. Ties break on type name then key so the order is never Map-dependent. */
export function sortShipCards(cards: ShipCardView[]): ShipCardView[] {
  return [...cards].sort((a, b) =>
    b.valueRaw - a.valueRaw || a.typeName.localeCompare(b.typeName) || a.key.localeCompare(b.key));
}

/** A saved fit is not anywhere, so its card's location line says what it is instead. */
export const SAVED_FIT_LOCATION = "Saved fit";

export interface ComputedFit { built: BuiltFit; stats: FitStats; problems: Problem[]; assumedAmmo: AssumedAmmo[] }

/**
 * Spec §6: engine exceptions are caught per fit and logged, and the card says "Could not compute".
 * The build *and* the maths are inside the try — `fitStats` and `validateFit` both call `getAttr`,
 * so a cycle or an unknown attribute surfaces after a perfectly successful build.
 */
export function computeFit(build: () => BuiltFit, what: string): ComputedFit | null {
  try {
    const built = build();
    // Before the maths: an unloaded gun shoots the best ammo in the hold (dogma/ammo.ts).
    const assumedAmmo = assumeCargoAmmo(built);
    return { built, stats: fitStats(built.fit), problems: validateFit(built.fit), assumedAmmo };
  } catch (e) {
    console.error(`[ships] could not compute ${what}`, e);
    return null;
  }
}

/** Spec §4's "Fitted ships" grid, value descending. `raceNames` is the hull typeId -> race name
 *  join the page does once via `getTypes`/`getRaces` — `DogmaData` carries no race data. */
export function assetShipCards(
  groups: ShipGroup[],
  ctx: FitContext,
  places: ReadonlyMap<number, { name: string }>,
  byItemId: ReadonlyMap<number, AssetRow>,
  prices: ReadonlyMap<number, Price>,
  raceNames: ReadonlyMap<number, string>,
): ShipCardView[] {
  return sortShipCards(groups.map((group) => {
    const base = {
      key: `asset:${group.ship.itemId}`,
      href: `/ships/asset/${group.ship.itemId}`,
      name: group.ship.name,
      typeId: group.ship.typeId,
      typeName: ctx.data.types.get(group.ship.typeId)?.name ?? `Unknown type (${group.ship.typeId})`,
      groupName: groupNameFor(group.ship.typeId, ctx.data),
      raceName: raceNames.get(group.ship.typeId) ?? null,
      location: shipLocationLabel(group.ship, places, byItemId, ctx.data),
    };
    const computed = computeFit(() => fitFromAssets(group.ship, group.children, ctx), base.key);
    if (computed === null) return errorShipCard(base);
    return toShipCard({
      ...base, stats: computed.stats, problems: computed.problems,
      entries: fitValueEntries(computed.built), prices, perf: fitPerformance(computed.built.fit),
      weapons: shipWeapons(computed.built.fit),
    });
  }));
}

/** Spec §4's "Saved fits" grid — the same card, built from `character_fittings*`. */
export function savedFitCards(
  fittings: FittingRow[], ctx: FitContext, prices: ReadonlyMap<number, Price>,
  raceNames: ReadonlyMap<number, string>,
): ShipCardView[] {
  return sortShipCards(fittings.map((fitting) => {
    const base = {
      key: `fit:${fitting.fittingId}`,
      href: `/ships/fit/${fitting.fittingId}`,
      name: fitting.name,
      typeId: fitting.shipTypeId,
      typeName: ctx.data.types.get(fitting.shipTypeId)?.name ?? `Unknown type (${fitting.shipTypeId})`,
      groupName: groupNameFor(fitting.shipTypeId, ctx.data),
      raceName: raceNames.get(fitting.shipTypeId) ?? null,
      location: SAVED_FIT_LOCATION,
    };
    const computed = computeFit(() => fitFromFitting(fitting, fitting.items, ctx), base.key);
    if (computed === null) return errorShipCard(base);
    return toShipCard({
      ...base, stats: computed.stats, problems: computed.problems,
      entries: fitValueEntries(computed.built), prices, perf: fitPerformance(computed.built.fit),
      weapons: shipWeapons(computed.built.fit),
    });
  }));
}

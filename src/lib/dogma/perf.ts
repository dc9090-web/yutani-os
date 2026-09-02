/**
 * Engine performance maths: damage output, omni tank, mobility, capacitor and targeting — the
 * numbers the fitting editor's "Ship stats" card shows. Phase 4a of the engine deferred these so
 * that "later phases add DPS/tank without rewriting" (research §1); this is that phase.
 *
 * Pure, and layered strictly on top of the calculator: every number is read through `getAttr`, so
 * skills, rigs, subsystems, implants and module states are already folded in. Nothing here reads a
 * raw `item.attrs` value except to ask whether the type carries the attribute at all.
 *
 * Every attribute id below was verified by *name* against the committed SDE snapshots' attribute
 * maps (tests/fixtures/dogma/*.json → `sde_dogma_attributes`); tests/dogma/perf.test.ts asserts the
 * name of each one so a snapshot regeneration that moves an id fails loudly.
 */
import { ATTR, State, type AttrId } from "./data.js";
import { getAttr } from "./calc.js";
import { hardpointOf, type Fit, type Item } from "./fit.js";

/** Attribute ids beyond the fitting set already in `ATTR` (data.ts). Verified by name — see above. */
export const PERF_ATTR = {
  hp: 9,                      // structure hit points
  maxVelocity: 37,
  speed: 51,                  // cycle time, ms — the weapon/drone rate of fire
  rechargeRate: 55,           // capacitor recharge time, ms
  damageMultiplier: 64,
  agility: 70,
  duration: 73,               // cycle time, ms — used by modules that have no `speed`
  maxTargetRange: 76,
  emDamage: 114,
  explosiveDamage: 116,
  kineticDamage: 117,
  thermalDamage: 118,
  maxLockedTargets: 192,
  shieldCapacity: 263,
  armorHP: 265,
  armorEmDamageResonance: 267,
  armorExplosiveDamageResonance: 268,
  armorKineticDamageResonance: 269,
  armorThermalDamageResonance: 270,
  shieldEmDamageResonance: 271,
  shieldExplosiveDamageResonance: 272,
  shieldKineticDamageResonance: 273,
  shieldThermalDamageResonance: 274,
  capacitorCapacity: 482,
  signatureRadius: 552,
  scanResolution: 564,
  /** The *structure* resonances. The hull layer uses the unprefixed family, not `hull*DamageResonance`
   *  (974-977) — those are the Damage Control's own bonus attributes, which the SDE's effect 2302
   *  applies *to* 109/110/111/113 (verified in the rifter snapshot). */
  emDamageResonance: 113,
  explosiveDamageResonance: 111,
  kineticDamageResonance: 109,
  thermalDamageResonance: 110,
} as const;

/** The four damage types, in the order EVE lists them. */
const DAMAGE_ATTRS: readonly AttrId[] = [
  PERF_ATTR.emDamage, PERF_ATTR.thermalDamage, PERF_ATTR.kineticDamage, PERF_ATTR.explosiveDamage,
];

interface Layer {
  hp: AttrId;
  /** em, thermal, kinetic, explosive. */
  resonances: readonly [AttrId, AttrId, AttrId, AttrId];
}

const LAYERS: readonly Layer[] = [
  {
    hp: PERF_ATTR.shieldCapacity,
    resonances: [
      PERF_ATTR.shieldEmDamageResonance, PERF_ATTR.shieldThermalDamageResonance,
      PERF_ATTR.shieldKineticDamageResonance, PERF_ATTR.shieldExplosiveDamageResonance,
    ],
  },
  {
    hp: PERF_ATTR.armorHP,
    resonances: [
      PERF_ATTR.armorEmDamageResonance, PERF_ATTR.armorThermalDamageResonance,
      PERF_ATTR.armorKineticDamageResonance, PERF_ATTR.armorExplosiveDamageResonance,
    ],
  },
  {
    hp: PERF_ATTR.hp,
    resonances: [
      PERF_ATTR.emDamageResonance, PERF_ATTR.thermalDamageResonance,
      PERF_ATTR.kineticDamageResonance, PERF_ATTR.explosiveDamageResonance,
    ],
  },
];

/**
 * `level` is a *fraction* of the capacitor, 0..1 — multiply by 100 to display it the way the client
 * does ("cap stable at 43.7 %").
 */
export type CapStability =
  | { stable: true; level: number }
  | { stable: false; lastsSeconds: number };

export interface FitPerformance {
  /** Turrets + launchers + drones, damage per second. `null` when nothing on the fit deals damage. */
  dps: number | null;
  /** One full volley (alpha) — the same weapons, without the cycle division. */
  volley: number | null;
  /** Shield + armour + structure, each divided by its mean resonance (an omni damage profile). */
  ehp: number | null;
  /** m/s, with the propulsion module in whatever state it is fitted at. */
  maxVelocity: number | null;
  /** Seconds to reach 75 % of top speed — the align time. */
  alignTime: number | null;
  /** GJ. */
  capacitorCapacity: number | null;
  /** Seconds. */
  capRechargeTime: number | null;
  capStable: CapStability | null;
  maxTargets: number | null;
  maxTargetRange: number | null;
  scanResolution: number | null;
  signatureRadius: number | null;
}

/**
 * Every performance number for `fit`, all of them modified values.
 *
 * A field is `null` — never `NaN` or `Infinity` — whenever the inputs it needs are absent: the
 * attribute is missing from this `DogmaData`, the hull's type does not carry it, or a divisor is
 * zero. Callers render `null` as "—".
 */
export function fitPerformance(fit: Fit): FitPerformance {
  const damage = weaponDamage(fit);
  const capacity = shipAttr(fit, PERF_ATTR.capacitorCapacity);
  const rechargeMs = shipAttr(fit, PERF_ATTR.rechargeRate);
  const rechargeTime = rechargeMs !== null && rechargeMs > 0 ? rechargeMs / 1000 : null;

  return {
    dps: damage?.dps ?? null,
    volley: damage?.volley ?? null,
    ehp: effectiveHp(fit),
    maxVelocity: shipAttr(fit, PERF_ATTR.maxVelocity),
    alignTime: alignTime(fit),
    capacitorCapacity: capacity,
    capRechargeTime: rechargeTime,
    capStable: capStability(fit, capacity, rechargeTime),
    maxTargets: maxTargets(fit),
    maxTargetRange: shipAttr(fit, PERF_ATTR.maxTargetRange),
    scanResolution: shipAttr(fit, PERF_ATTR.scanResolution),
    signatureRadius: shipAttr(fit, PERF_ATTR.signatureRadius),
  };
}

/**
 * Damage per second and per volley.
 *
 * A weapon counts only when its module is Active (or Overloaded) — an offline or merely online
 * turret is not shooting — and only when it occupies a turret or launcher hardpoint and holds a
 * charge. Bomb launchers are therefore excluded: their SDE type carries neither hardpoint marker
 * effect (verified in the rifter snapshot), and bombs are not part of a fit's sustained DPS anyway.
 *
 * Turret and launcher share one formula. For a turret the charge supplies the four damage figures
 * and the gun supplies `damageMultiplier`; for a launcher the missile supplies the damage and the
 * launcher usually has no multiplier at all — `damageMultiplier` defaults to 1 in the SDE, so the
 * same expression covers both, and any launcher that *does* carry one (or has one applied to it)
 * is picked up for free. Missile *skill* bonuses do not need a special case either: charges are
 * `ownerModifiable`, so an OwnerRequiredSkillModifier reaches the missile's damage attributes and
 * `getAttr` on the charge already returns the boosted value.
 *
 * Drones are counted in every state. `makeItem` gives a drone the default state Offline (it is not
 * a module) and nothing in the engine ever promotes one, so gating on Active would report zero drone
 * damage for every fit the app can currently build. Recorded deviation: a drone sitting in the bay
 * still contributes here.
 */
function weaponDamage(fit: Fit): { dps: number; volley: number } | null {
  let dps = 0;
  let volley = 0;
  let armed = false;

  for (const { item } of fit.modules) {
    if (item.state < State.Active) continue;
    if (hardpointOf(item) === null) continue;
    const charge = item.charge;
    if (!charge) continue;
    const perShot = sumDamage(fit, charge) * attrOr(fit, item, PERF_ATTR.damageMultiplier, 1);
    const cycle = cycleSeconds(fit, item);
    if (perShot <= 0 || cycle === null) continue;
    armed = true;
    volley += perShot;
    dps += perShot / cycle;
  }

  for (const drone of fit.drones) {
    const perShot = sumDamage(fit, drone) * attrOr(fit, drone, PERF_ATTR.damageMultiplier, 1);
    const cycle = cycleSeconds(fit, drone);
    if (perShot <= 0 || cycle === null) continue;
    armed = true;
    volley += perShot;
    dps += perShot / cycle;
  }

  return armed ? { dps, volley } : null;
}

/**
 * Effective hit points against an omni damage profile (25 % of each type).
 *
 * Per layer: `hp / mean(resonance_em, _thermal, _kinetic, _explosive)` — the damage-weighted mean
 * resonance of an even profile is the plain mean, and dividing the raw pool by it is exactly what
 * Pyfa's `DamagePattern.effectivify` does. A layer with no hit points contributes nothing; a
 * resonance the data set does not define is read as 1 (no resistance), the SDE's own default.
 *
 * `null` only when the hull has no layer at all.
 */
function effectiveHp(fit: Fit): number | null {
  let total = 0;
  let found = false;

  for (const layer of LAYERS) {
    const hp = shipAttr(fit, layer.hp);
    if (hp === null || hp <= 0) continue;
    let sum = 0;
    for (const resonance of layer.resonances) sum += attrOr(fit, fit.ship, resonance, 1);
    const mean = sum / layer.resonances.length;
    if (mean <= 0) continue;                     // a 100 % resist would be an infinite pool
    found = true;
    total += hp / mean;
  }

  return found ? total : null;
}

/**
 * Seconds to align: a ship reaches 75 % of top speed — the warp threshold — after
 * `-ln(1 - 0.75) x inertia`, and its inertia in seconds is `mass x agility / 1e6` (mass is in kg,
 * `agility` is the inertia modifier). Hence `ln(4) x mass x agility / 1e6`.
 */
function alignTime(fit: Fit): number | null {
  const mass = shipAttr(fit, ATTR.mass);
  const agility = shipAttr(fit, PERF_ATTR.agility);
  if (mass === null || agility === null || mass <= 0 || agility <= 0) return null;
  return -Math.log(0.25) * mass * agility / 1_000_000;
}

/**
 * Capacitor stability under the fit's steady-state drain.
 *
 * EVE recharges a capacitor along `C(t) = Cmax (1 + (sqrt(C0/Cmax) - 1) e^(-5t/T))^2`, T being
 * `rechargeRate`. Differentiating, with `f = C/Cmax`:
 *
 *     dC/dt = Cmax (10/T) (sqrt(f) - f)                                                    (1)
 *
 * which peaks where `d/df (sqrt f - f) = 0`, i.e. `f = 1/4`, at `Cmax (10/T) (1/2 - 1/4)` =
 * `2.5 Cmax / T` — the familiar peak recharge rate, and the same expression Pyfa uses.
 *
 * Against a constant drain U the cap settles wherever recharge equals U. Writing `u = sqrt(f)` and
 * `k = U T / (10 Cmax)`, equation (1) gives `u - u^2 = k`, so `u = (1 +/- sqrt(1 - 4k)) / 2`. The
 * upper root is the stable equilibrium (start at f = 1 and drain down to it; the lower root is only
 * reachable from below and runs away), so `level = ((1 + sqrt(1 - 4k)) / 2)^2`. U = 0 gives k = 0
 * and level 1; U at exactly the peak gives k = 1/4 and level 1/4, the two endpoints.
 *
 * Above the peak the cap always empties. Time to empty, from `2u du/dt = a(u - u^2) - b` with
 * `a = 10/T` and `b = U/Cmax`:
 *
 *     t = INT[0..1] 2u du / (a u^2 - a u + b)
 *       = (1/a)[ln(a u^2 - a u + b)](0..1) + INT[0..1] du / (a u^2 - a u + b)
 *
 * The log term vanishes (both limits equal b), and the remaining integral has a negative
 * discriminant exactly when U exceeds the peak, giving the closed form
 *
 *     lastsSeconds = (4/D) arctan(a/D),   D = sqrt(a (4b - a))
 *
 * — no time-step simulation, and no step size to justify. It models a smooth constant drain rather
 * than EVE's discrete per-cycle draw, and it ignores cap boosters and any other injection, so it is
 * an estimate; tests/dogma/perf.test.ts checks it against a numerically integrated drain.
 */
function capStability(fit: Fit, capacity: number | null, rechargeTime: number | null): CapStability | null {
  if (capacity === null || rechargeTime === null || capacity <= 0 || rechargeTime <= 0) return null;
  const usage = capacitorUsage(fit);
  const peak = 2.5 * capacity / rechargeTime;
  if (usage <= 0) return { stable: true, level: 1 };
  if (usage <= peak) {
    const k = usage * rechargeTime / (10 * capacity);
    const u = (1 + Math.sqrt(Math.max(0, 1 - 4 * k))) / 2;
    return { stable: true, level: u * u };
  }
  const a = 10 / rechargeTime;
  const b = usage / capacity;
  const d = Math.sqrt(a * (4 * b - a));
  return { stable: false, lastsSeconds: 4 / d * Math.atan(a / d) };
}

/** GJ per second drawn by every active module that needs capacitor. */
function capacitorUsage(fit: Fit): number {
  let usage = 0;
  for (const { item } of fit.modules) {
    if (item.state < State.Active) continue;
    const need = attrOr(fit, item, ATTR.capacitorNeed, 0);
    const cycle = cycleSeconds(fit, item);
    if (need <= 0 || cycle === null) continue;
    usage += need / cycle;
  }
  return usage;
}

/**
 * The pilot's own `maxLockedTargets` caps the hull's, but only once the character has one: our
 * character item is synthetic and starts at the attribute's default of 0, so a fit with no targeting
 * skills would otherwise lock nothing at all. Zero means "unknown", not "none".
 */
function maxTargets(fit: Fit): number | null {
  const ship = shipAttr(fit, PERF_ATTR.maxLockedTargets);
  if (ship === null) return null;
  const character = attrOr(fit, fit.character, PERF_ATTR.maxLockedTargets, 0);
  return Math.floor(character > 0 ? Math.min(ship, character) : ship);
}

/** The four damage attributes of a charge or a drone, summed as its modified values. */
function sumDamage(fit: Fit, item: Item): number {
  let total = 0;
  for (const attrId of DAMAGE_ATTRS) total += attrOr(fit, item, attrId, 0);
  return total;
}

/**
 * Cycle time in seconds. The SDE spells it `speed` on weapons and drones and `duration` on
 * everything else; a few types carry both. `null` when neither is usable, which keeps every
 * `x / cycle` below away from a zero divisor.
 */
function cycleSeconds(fit: Fit, item: Item): number | null {
  const ms = attrOr(fit, item, PERF_ATTR.speed, 0) || attrOr(fit, item, PERF_ATTR.duration, 0);
  return ms > 0 ? ms / 1000 : null;
}

/** A hull stat: `null` unless the data set defines the attribute *and* the hull's type carries it. */
function shipAttr(fit: Fit, attrId: AttrId): number | null {
  if (!fit.data.attributes.has(attrId) || !fit.ship.attrs.has(attrId)) return null;
  return getAttr(fit, fit.ship, attrId);
}

/**
 * The modified value, or `fallback` when this `DogmaData` does not define the attribute at all —
 * the snapshots carry only the attributes their types need, and `getAttr` throws on the rest.
 * An attribute the *item* does not carry is fine: that is what `defaultValue` is for.
 */
function attrOr(fit: Fit, item: Item, attrId: AttrId, fallback: number): number {
  return fit.data.attributes.has(attrId) ? getAttr(fit, item, attrId) : fallback;
}

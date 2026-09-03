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
  shieldRechargeRate: 479,    // shield recharge time, ms
  signatureRadius: 552,
  scanResolution: 564,
  scanRadarStrength: 208,
  scanLadarStrength: 209,
  scanMagnetometricStrength: 210,
  scanGravimetricStrength: 211,
  droneCapacity: 283,         // drone bay, m³
  droneBandwidth: 1271,       // Mbit/s the hull can control
  droneBandwidthUsed: 1272,   // Mbit/s one drone takes
  warpSpeedMultiplier: 600,   // AU/s = baseWarpSpeed x warpSpeedMultiplier
  baseWarpSpeed: 1281,
  speedFactor: 20,            // a propulsion module's velocity bonus, %
  speedBoostFactor: 567,      // its thrust
  massAddition: 796,          // the mass it adds while running
  signatureRadiusBonus: 554,  // a microwarpdrive's signature bloom, %
  /** The *structure* resonances. The hull layer uses the unprefixed family, not `hull*DamageResonance`
   *  (974-977) — those are the Damage Control's own bonus attributes, which the SDE's effect 2302
   *  applies *to* 109/110/111/113 (verified in the rifter snapshot). Hulls carry an innate 0.67
   *  here: every ship resists 33 % of structure damage before any module, which is why a Damage
   *  Control's 0.6 lands at 0.6 x 0.67 = 0.402 — the familiar ~60 % structure resistance. */
  emDamageResonance: 113,
  explosiveDamageResonance: 111,
  kineticDamageResonance: 109,
  thermalDamageResonance: 110,
} as const;

/**
 * Character-only attributes the committed snapshots do not carry (they hold only what their *types*
 * need, and the character is synthetic). Read through `attrOr`, so a data set without them yields
 * `null` rather than a throw.
 */
export const CHARACTER_ATTR = {
  droneControlDistance: 458,  // metres
} as const;

/**
 * The two propulsion effects. Neither carries `modifierInfo` in the SDE — EOS and Pyfa hard-code the
 * maths, and so does `propulsion()` below. Verified by name against the full SDE
 * (moduleBonusMicrowarpdrive / moduleBonusAfterburner).
 */
export const PROP_EFFECT = { microwarpdrive: 6730, afterburner: 6731 } as const;

/** The four sensor types and the attribute that carries each one's strength. */
const SENSOR_ATTRS: readonly (readonly [string, AttrId])[] = [
  ["Radar", PERF_ATTR.scanRadarStrength], ["Ladar", PERF_ATTR.scanLadarStrength],
  ["Magnetometric", PERF_ATTR.scanMagnetometricStrength], ["Gravimetric", PERF_ATTR.scanGravimetricStrength],
];

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

/** One tank layer: raw hit points, its four resistances (em, thermal, kinetic, explosive — as
 *  fractions, 0.57 for "57 %"), and the layer's own omni effective hit points. */
export interface LayerPerformance { hp: number; resists: readonly [number, number, number, number]; ehp: number }

/** What a running afterburner or microwarpdrive does to the hull. */
export interface Propulsion {
  kind: "Afterburner" | "Microwarpdrive";
  /** m/s with the module running. */
  velocity: number;
  /** Seconds to align, with the module's `massAddition` on the hull. */
  alignTime: number | null;
  /** Metres, after a microwarpdrive's signature bloom; an afterburner leaves it unchanged. */
  signatureRadius: number | null;
}

export interface FitPerformance {
  /**
   * Turrets + launchers + drones, damage per second. `null` when nothing on the fit deals damage.
   *
   * Cycle time only — reloads are not modelled, so a weapon that has to stop and reload (a launcher
   * emptying its magazine, an ancillary repairer) reads slightly optimistic against Pyfa's
   * reload-aware sustained figure. Pyfa's *un*-reloaded number is the one this matches.
   */
  dps: number | null;
  /** One full volley (alpha) — the same weapons, without the cycle division. */
  volley: number | null;
  /** The turret + launcher share of `dps`, and the drone share. Each `null` when that source is silent. */
  weaponDps: number | null;
  droneDps: number | null;
  /** Shield + armour + structure, each divided by its mean resonance (an omni damage profile). */
  ehp: number | null;
  /** The three layers behind `ehp`; a layer the hull lacks (or with no hit points) is `null`. */
  shield: LayerPerformance | null;
  armor: LayerPerformance | null;
  hull: LayerPerformance | null;
  /** Seconds for the shield to recharge from empty, and its peak passive recharge in hp/s
   *  (2.5 x capacity / time, the same curve as the capacitor). */
  shieldRechargeTime: number | null;
  shieldRechargeRate: number | null;
  /**
   * m/s — the hull's modified `maxVelocity`, cold.
   *
   * A fitted microwarpdrive or afterburner does **not** raise it: their speed bonus is effect
   * 6730/6731, which carries no `modifierInfo` in the SDE, so it never reaches `getAttr`. The
   * running-module figure is `propulsion`, computed the way Pyfa hard-codes it. `alignTime` is cold
   * likewise; `propulsion.alignTime` carries the `massAddition`. What a running MWD *does* change
   * here is `capacitorCapacity`, through ordinary SDE modifiers.
   */
  maxVelocity: number | null;
  /** The first active afterburner or microwarpdrive, and the hull with it running; `null` without one. */
  propulsion: Propulsion | null;
  /** Seconds to reach 75 % of top speed — the align time. */
  alignTime: number | null;
  /** GJ. */
  capacitorCapacity: number | null;
  /** Seconds. */
  capRechargeTime: number | null;
  capStable: CapStability | null;
  /** GJ/s: what the fit's active modules draw, the capacitor's peak recharge, and their difference
   *  (positive when the cap gains). `capDelta` is what the client shows as "Δ". */
  capUsage: number | null;
  capPeakRecharge: number | null;
  capDelta: number | null;
  maxTargets: number | null;
  maxTargetRange: number | null;
  scanResolution: number | null;
  signatureRadius: number | null;
  /** The hull's strongest sensor and its strength in points. */
  sensorStrength: { kind: string; points: number } | null;
  /** kg, and the inertia modifier (`agility`). */
  mass: number | null;
  inertia: number | null;
  /** AU/s. */
  warpSpeed: number | null;
  /** Mbit/s the hull can control; m³ of drone bay; metres of control range (a character attribute
   *  the snapshots lack, so usually `null` in tests). */
  droneBandwidth: number | null;
  droneBay: number | null;
  droneControlRange: number | null;
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

  const layers = LAYERS.map((layer) => layerPerformance(fit, layer));
  const ehpLayers = layers.filter((l): l is LayerPerformance => l !== null);
  const usage = capacity === null || rechargeTime === null ? null : capacitorUsage(fit);
  const peak = capacity !== null && rechargeTime !== null && capacity > 0 && rechargeTime > 0
    ? 2.5 * capacity / rechargeTime : null;
  const shieldMs = shipAttr(fit, PERF_ATTR.shieldRechargeRate);
  const shieldTime = shieldMs !== null && shieldMs > 0 ? shieldMs / 1000 : null;
  const shieldCap = shipAttr(fit, PERF_ATTR.shieldCapacity);
  const baseWarp = shipAttr(fit, PERF_ATTR.baseWarpSpeed);
  const warpMult = shipAttr(fit, PERF_ATTR.warpSpeedMultiplier);
  const droneRange = fit.data.attributes.has(CHARACTER_ATTR.droneControlDistance)
    ? getAttr(fit, fit.character, CHARACTER_ATTR.droneControlDistance) : null;

  return {
    dps: damage?.dps ?? null,
    volley: damage?.volley ?? null,
    weaponDps: damage === null || damage.weaponDps <= 0 ? null : damage.weaponDps,
    droneDps: damage === null || damage.droneDps <= 0 ? null : damage.droneDps,
    ehp: ehpLayers.length === 0 ? null : ehpLayers.reduce((sum, l) => sum + l.ehp, 0),
    shield: layers[0], armor: layers[1], hull: layers[2],
    shieldRechargeTime: shieldTime,
    shieldRechargeRate: shieldTime !== null && shieldCap !== null && shieldCap > 0 ? 2.5 * shieldCap / shieldTime : null,
    maxVelocity: shipAttr(fit, PERF_ATTR.maxVelocity),
    propulsion: propulsion(fit),
    alignTime: alignTime(fit),
    capacitorCapacity: capacity,
    capRechargeTime: rechargeTime,
    capStable: capStability(fit, capacity, rechargeTime),
    capUsage: usage,
    capPeakRecharge: peak,
    capDelta: usage === null || peak === null ? null : peak - usage,
    maxTargets: maxTargets(fit),
    maxTargetRange: shipAttr(fit, PERF_ATTR.maxTargetRange),
    scanResolution: shipAttr(fit, PERF_ATTR.scanResolution),
    signatureRadius: shipAttr(fit, PERF_ATTR.signatureRadius),
    sensorStrength: sensorStrength(fit),
    mass: shipAttr(fit, ATTR.mass),
    inertia: shipAttr(fit, PERF_ATTR.agility),
    warpSpeed: baseWarp === null || warpMult === null ? null : baseWarp * warpMult,
    droneBandwidth: shipAttr(fit, PERF_ATTR.droneBandwidth),
    droneBay: shipAttr(fit, PERF_ATTR.droneCapacity),
    droneControlRange: droneRange !== null && droneRange > 0 ? droneRange : null,
  };
}

/**
 * A running afterburner or microwarpdrive — Pyfa's `moduleBonusAfterburner` / `...Microwarpdrive`:
 * the hull's mass grows by the module's `massAddition`, then `maxVelocity` is boosted by
 * `speedFactor x speedBoostFactor / mass` percent; a microwarpdrive also blooms the signature by
 * its `signatureRadiusBonus` percent. All four module attributes are read modified, so Acceleration
 * Control (which raises `speedFactor`) and the rest of the skill chain count. Only a module in the
 * Active state runs; the first one found wins, which is what the client does with two fitted.
 */
function propulsion(fit: Fit): Propulsion | null {
  const velocity = shipAttr(fit, PERF_ATTR.maxVelocity);
  const mass = shipAttr(fit, ATTR.mass);
  if (velocity === null || mass === null || mass <= 0) return null;
  for (const { item } of fit.modules) {
    if (item.state < State.Active) continue;
    const kind = item.effects.has(PROP_EFFECT.microwarpdrive) ? "Microwarpdrive"
      : item.effects.has(PROP_EFFECT.afterburner) ? "Afterburner" : null;
    if (kind === null) continue;
    const total = mass + attrOr(fit, item, PERF_ATTR.massAddition, 0);
    const boost = attrOr(fit, item, PERF_ATTR.speedFactor, 0) * attrOr(fit, item, PERF_ATTR.speedBoostFactor, 0) / total;
    const agility = shipAttr(fit, PERF_ATTR.agility);
    const sig = shipAttr(fit, PERF_ATTR.signatureRadius);
    const bloom = kind === "Microwarpdrive" ? attrOr(fit, item, PERF_ATTR.signatureRadiusBonus, 0) : 0;
    return {
      kind,
      velocity: velocity * (1 + boost / 100),
      alignTime: agility === null || agility <= 0 ? null : -Math.log(0.25) * total * agility / 1_000_000,
      signatureRadius: sig === null ? null : sig * (1 + bloom / 100),
    };
  }
  return null;
}

/** The strongest of the four sensor types; `null` when the hull carries none (or all read 0). */
function sensorStrength(fit: Fit): { kind: string; points: number } | null {
  let best: { kind: string; points: number } | null = null;
  for (const [kind, attrId] of SENSOR_ATTRS) {
    const points = shipAttr(fit, attrId);
    if (points !== null && points > 0 && (best === null || points > best.points)) best = { kind, points };
  }
  return best;
}

/**
 * One tank layer against an omni damage profile (25 % of each type): the raw pool, the four
 * resistances as `1 - resonance`, and the pool divided by the mean resonance — the damage-weighted
 * mean of an even profile is the plain mean, which is exactly what Pyfa's `DamagePattern.effectivify`
 * does. A resonance the data set does not define reads as 1 (no resistance), the SDE's default; the
 * structure layer still starts at the hull's innate 0.67. `null` when the hull has no such layer or
 * it has no hit points, and the sum of the non-null layers is `ehp`.
 */
function layerPerformance(fit: Fit, layer: Layer): LayerPerformance | null {
  const hp = shipAttr(fit, layer.hp);
  if (hp === null || hp <= 0) return null;
  const resonances = layer.resonances.map((r) => attrOr(fit, fit.ship, r, 1)) as [number, number, number, number];
  const mean = resonances.reduce((sum, r) => sum + r, 0) / resonances.length;
  if (mean <= 0) return null;
  return { hp, resists: resonances.map((r) => 1 - r) as [number, number, number, number], ehp: hp / mean };
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
function weaponDamage(fit: Fit): { dps: number; volley: number; weaponDps: number; droneDps: number } | null {
  let dps = 0;
  let volley = 0;
  let weaponDps = 0;
  let droneDps = 0;
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
    weaponDps += perShot / cycle;
  }

  for (const drone of fit.drones) {
    const perShot = sumDamage(fit, drone) * attrOr(fit, drone, PERF_ATTR.damageMultiplier, 1);
    const cycle = cycleSeconds(fit, drone);
    if (perShot <= 0 || cycle === null) continue;
    armed = true;
    volley += perShot;
    dps += perShot / cycle;
    droneDps += perShot / cycle;
  }

  return armed ? { dps, volley, weaponDps, droneDps } : null;
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
 * — no time-step simulation, and no step size to justify. `4b - a > 0` is `U` past the peak, so the
 * one discriminant both picks the branch and supplies `D`; see the comment in the body.
 *
 * It models a smooth constant drain rather than EVE's discrete per-cycle draw, and it ignores cap
 * boosters and any other injection, so it is an estimate; tests/dogma/perf.test.ts checks it
 * against a numerically integrated drain.
 */
function capStability(fit: Fit, capacity: number | null, rechargeTime: number | null): CapStability | null {
  if (capacity === null || rechargeTime === null || capacity <= 0 || rechargeTime <= 0) return null;
  const usage = capacitorUsage(fit);
  if (usage <= 0) return { stable: true, level: 1 };
  const a = 10 / rechargeTime;
  const b = usage / capacity;
  // `disc` is the discriminant of a u^2 - a u + b, and it decides the branch *and* feeds both
  // formulas. Testing `usage <= 2.5 * capacity / rechargeTime` instead would be the same comparison
  // spelled a second way, and the two round differently: at a tie the unstable branch takes
  // sqrt(0) = 0 and reports an infinite `lastsSeconds` (capacity 168, rechargeRate 125 000, 33.6 GJ
  // per 10 s cycle is one such fit — it is pinned in the tests).
  const disc = a * (4 * b - a);
  if (!(disc > 0)) {
    // Stable. With k = b/a, 1 - 4k = -disc/a^2, so the upper root (1 + sqrt(1 - 4k)) / 2 is
    // (1 + sqrt(-disc)/a) / 2 — the same quantity, never rounded a second time. b > 0 keeps it
    // under 1, and disc = 0 (drain exactly at the peak) gives level 1/4.
    const u = (1 + Math.sqrt(-disc) / a) / 2;
    return { stable: true, level: u * u };
  }
  const d = Math.sqrt(disc);
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

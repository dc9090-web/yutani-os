/**
 * Formula tests for the performance maths, on synthetic fixtures: every attribute is chosen here, so
 * every pinned number is a two-line hand derivation rather than an appeal to the SDE. The ids and
 * names of the attributes themselves are checked against the committed snapshots in perf-e2e.test.ts.
 */
import { describe, it, expect } from "vitest";
import { ATTR, CATEGORY, EFFECT, State, type AttrId, type TypeId } from "../../src/lib/dogma/data.js";
import { clearMemo } from "../../src/lib/dogma/calc.js";
import { PERF_ATTR, PROP_EFFECT, fitPerformance, weaponRange, weaponRangeWith, type CapStability } from "../../src/lib/dogma/perf.js";
import { world } from "./synthetic.js";
import { buildFit } from "./build-fit.js";

/**
 * id, name, defaultValue, stackable, highIsGood — copied verbatim from the rifter snapshot's
 * attribute map. The `maxAttributeId` caps on 37 and 76 are dropped: they only add attributes to
 * declare and cap nothing at these magnitudes.
 */
const PERF_ATTRS: readonly (readonly [AttrId, string, number, boolean, boolean])[] = [
  [4, "mass", 0, false, true],
  [6, "capacitorNeed", 0, true, false],
  [9, "hp", 0, true, true],
  [37, "maxVelocity", 0, false, true],
  [51, "speed", 0, false, false],
  [55, "rechargeRate", 0, true, false],
  [64, "damageMultiplier", 1, false, true],
  [70, "agility", 0, false, false],
  [73, "duration", 0, true, false],
  [76, "maxTargetRange", 0, false, true],
  [54, "maxRange", 0, false, true],
  [158, "falloff", 1, false, true],
  [281, "explosionDelay", 0, false, true],
  [109, "kineticDamageResonance", 1, false, false],
  [110, "thermalDamageResonance", 1, false, false],
  [111, "explosiveDamageResonance", 1, false, false],
  [113, "emDamageResonance", 1, false, false],
  [114, "emDamage", 0, true, true],
  [116, "explosiveDamage", 0, true, true],
  [117, "kineticDamage", 0, true, true],
  [118, "thermalDamage", 0, true, true],
  [192, "maxLockedTargets", 0, true, true],
  [263, "shieldCapacity", 0, true, true],
  [265, "armorHP", 0, true, true],
  [267, "armorEmDamageResonance", 1, false, false],
  [268, "armorExplosiveDamageResonance", 1, false, false],
  [269, "armorKineticDamageResonance", 1, false, false],
  [270, "armorThermalDamageResonance", 1, false, false],
  [271, "shieldEmDamageResonance", 1, false, false],
  [272, "shieldExplosiveDamageResonance", 1, false, false],
  [273, "shieldKineticDamageResonance", 1, false, false],
  [274, "shieldThermalDamageResonance", 1, false, false],
  [482, "capacitorCapacity", 0, true, true],
  [552, "signatureRadius", 100, false, false],
  [564, "scanResolution", 0, false, true],
  [479, "shieldRechargeRate", 0, true, false],
  [208, "scanRadarStrength", 0, false, true],
  [209, "scanLadarStrength", 0, false, true],
  [210, "scanMagnetometricStrength", 0, false, true],
  [211, "scanGravimetricStrength", 0, false, true],
  [283, "droneCapacity", 0, true, true],
  [1271, "droneBandwidth", 0, true, true],
  [1272, "droneBandwidthUsed", 0, true, true],
  [600, "warpSpeedMultiplier", 3, false, true],
  [1281, "baseWarpSpeed", 0, true, true],
  [20, "speedFactor", 1, false, true],
  [567, "speedBoostFactor", 0, true, true],
  [796, "massAddition", 0, true, false],
  [554, "signatureRadiusBonus", 0, true, false],
];

type Attrs = readonly (readonly [AttrId, number])[];

/**
 * A world carrying every attribute perf.ts reads, minus `omit`, plus the two hardpoint marker
 * effects and one active "fires at a target" effect — the SDE shape, where the marker is passive and
 * a separate active effect is what makes a weapon default to State.Active.
 */
function bench(omit: readonly AttrId[] = []) {
  const w = world();
  for (const [id, name, defaultValue, stackable, highIsGood] of PERF_ATTRS) {
    if (!omit.includes(id)) w.attr({ id, name, defaultValue, stackable, highIsGood });
  }
  w.effect({ id: EFFECT.turretFitted, categoryId: 0, state: State.Offline });
  w.effect({ id: EFFECT.launcherFitted, categoryId: 0, state: State.Offline });
  const fires = w.effect({ categoryId: 2, state: State.Active }).id;
  // The two propulsion effects, as the SDE has them: active-category, no modifiers.
  w.effect({ id: PROP_EFFECT.afterburner, categoryId: 1, state: State.Active });
  w.effect({ id: PROP_EFFECT.microwarpdrive, categoryId: 1, state: State.Active });

  const make = (categoryId: number, attrs: Attrs, effects: [number, boolean][] = []): TypeId =>
    w.type({ categoryId, attrs: attrs.map(([a, v]) => [a, v]), effects }).id;

  return {
    data: w.data,
    hull: (attrs: Attrs) => make(CATEGORY.ship, attrs),
    /** A turret: hardpoint marker + an active effect, so `makeItem` gives it State.Active. */
    turret: (attrs: Attrs) => make(CATEGORY.module, attrs, [[EFFECT.turretFitted, false], [fires, true]]),
    launcher: (attrs: Attrs) => make(CATEGORY.module, attrs, [[EFFECT.launcherFitted, false], [fires, true]]),
    /** An active module with no hardpoint — a repairer, say. */
    active: (attrs: Attrs) => make(CATEGORY.module, attrs, [[fires, true]]),
    /** An afterburner or microwarpdrive: its propulsion effect is the default (active) one. */
    prop: (kind: "afterburner" | "microwarpdrive", attrs: Attrs) => make(CATEGORY.module, attrs, [[PROP_EFFECT[kind], true]]),
    charge: (attrs: Attrs) => make(CATEGORY.charge, attrs),
    drone: (attrs: Attrs) => make(CATEGORY.drone, attrs),
  };
}

/** The smallest hull that answers every non-damage question, with round numbers throughout. */
const HULL: Attrs = [
  [PERF_ATTR.shieldCapacity, 800],
  // mean(1.0, 0.5, 0.25, 0.25) = 0.5  →  800 / 0.5 = 1600
  [PERF_ATTR.shieldEmDamageResonance, 1],
  [PERF_ATTR.shieldThermalDamageResonance, 0.5],
  [PERF_ATTR.shieldKineticDamageResonance, 0.25],
  [PERF_ATTR.shieldExplosiveDamageResonance, 0.25],
  [PERF_ATTR.armorHP, 600],
  // mean(0.9, 0.7, 0.5, 0.3) = 0.6  →  600 / 0.6 = 1000
  [PERF_ATTR.armorEmDamageResonance, 0.9],
  [PERF_ATTR.armorThermalDamageResonance, 0.7],
  [PERF_ATTR.armorKineticDamageResonance, 0.5],
  [PERF_ATTR.armorExplosiveDamageResonance, 0.3],
  // No structure resonances at all: each reads as the SDE default 1  →  500 / 1 = 500
  [PERF_ATTR.hp, 500],
  [ATTR.mass, 2_000_000],
  [PERF_ATTR.agility, 5],
  [PERF_ATTR.maxVelocity, 320],
  [PERF_ATTR.capacitorCapacity, 1000],
  [PERF_ATTR.rechargeRate, 200_000],
  [PERF_ATTR.maxLockedTargets, 7],
  [PERF_ATTR.maxTargetRange, 45_000],
  [PERF_ATTR.scanResolution, 480],
  [PERF_ATTR.signatureRadius, 38],
  [PERF_ATTR.shieldRechargeRate, 1_000_000],   // 1000 s  →  peak 2.5 x 800 / 1000 = 2 hp/s
  [PERF_ATTR.scanLadarStrength, 8],
  [PERF_ATTR.scanRadarStrength, 3],
  [PERF_ATTR.droneBandwidth, 25],
  [PERF_ATTR.droneCapacity, 40],
  [PERF_ATTR.warpSpeedMultiplier, 5],
  [PERF_ATTR.baseWarpSpeed, 1],
];

/** 10 em + 20 thermal + 30 kinetic + 40 explosive = 100 damage a shot, before any multiplier. */
const SHELL: Attrs = [
  [PERF_ATTR.emDamage, 10], [PERF_ATTR.thermalDamage, 20],
  [PERF_ATTR.kineticDamage, 30], [PERF_ATTR.explosiveDamage, 40],
];

describe("damage", () => {
  it("multiplies the charge's four damage attributes by the turret's damageMultiplier", () => {
    const b = bench();
    // 100 damage × 2 = 200 a shot; a 5 s cycle → 40 dps. Two turrets → 400 volley, 80 dps.
    const gun = b.turret([[PERF_ATTR.damageMultiplier, 2], [PERF_ATTR.speed, 5000]]);
    const fit = buildFit(b.data, b.hull(HULL), {
      modules: [[gun, "high", 0], [gun, "high", 1]],
      charges: new Map([[0, b.charge(SHELL)], [1, b.charge(SHELL)]]),
    });
    const perf = fitPerformance(fit);
    expect(perf.volley).toBe(400);
    expect(perf.dps).toBe(80);
  });

  it("counts a launcher with no damageMultiplier at the SDE default of 1", () => {
    const b = bench();
    // 100 × 1 = 100 a shot; a 4 s cycle → 25 dps.
    const tube = b.launcher([[PERF_ATTR.speed, 4000]]);
    const fit = buildFit(b.data, b.hull(HULL), {
      modules: [[tube, "high", 0]], charges: new Map([[0, b.charge(SHELL)]]),
    });
    expect(fitPerformance(fit)).toMatchObject({ volley: 100, dps: 25 });
  });

  it("falls back to a multiplier of 1 when the data set has no damageMultiplier attribute at all", () => {
    // The tengu snapshot is exactly this shape: it carries `speed` and `kineticDamage` but not 64.
    const b = bench([PERF_ATTR.damageMultiplier]);
    const gun = b.turret([[PERF_ATTR.speed, 5000]]);
    const fit = buildFit(b.data, b.hull(HULL), {
      modules: [[gun, "high", 0]], charges: new Map([[0, b.charge(SHELL)]]),
    });
    expect(fitPerformance(fit)).toMatchObject({ volley: 100, dps: 20 });   // 100 / 5 s
  });

  it("ignores a weapon that is not active, and one with no charge", () => {
    const b = bench();
    const gun = b.turret([[PERF_ATTR.damageMultiplier, 2], [PERF_ATTR.speed, 5000]]);
    const fit = buildFit(b.data, b.hull(HULL), {
      modules: [[gun, "high", 0], [gun, "high", 1], [gun, "high", 2]],
      charges: new Map([[0, b.charge(SHELL)], [1, b.charge(SHELL)]]),   // index 2 is unloaded
    });
    fit.modules[1].item.state = State.Online;
    clearMemo(fit);
    // Only the one loaded, active turret is left: 200 a shot over 5 s.
    expect(fitPerformance(fit)).toMatchObject({ volley: 200, dps: 40 });
  });

  it("ignores a damaging module that occupies no hardpoint", () => {
    const b = bench();
    const bomb = b.active([[PERF_ATTR.damageMultiplier, 2], [PERF_ATTR.speed, 5000]]);
    const fit = buildFit(b.data, b.hull(HULL), {
      modules: [[bomb, "high", 0]], charges: new Map([[0, b.charge(SHELL)]]),
    });
    expect(fitPerformance(fit)).toMatchObject({ volley: null, dps: null });
  });

  it("counts drones in every state, damage attributes and multiplier taken from the drone itself", () => {
    const b = bench();
    // 25 thermal × 4 = 100 a shot; a 2.5 s cycle → 40 dps each. Two drones → 200 volley, 80 dps.
    const light = b.drone([
      [PERF_ATTR.thermalDamage, 25], [PERF_ATTR.damageMultiplier, 4], [PERF_ATTR.speed, 2500],
    ]);
    const fit = buildFit(b.data, b.hull(HULL), { drones: [light, light] });
    expect(fit.drones.every((d) => d.state === State.Offline)).toBe(true);
    expect(fitPerformance(fit)).toMatchObject({ volley: 200, dps: 80 });
  });

  it("reports null rather than zero when nothing on the fit deals damage", () => {
    const b = bench();
    expect(fitPerformance(buildFit(b.data, b.hull(HULL)))).toMatchObject({ dps: null, volley: null });
  });

  it("guards a zero rate of fire instead of dividing by it", () => {
    const b = bench();
    const jammed = b.turret([[PERF_ATTR.damageMultiplier, 2]]);      // neither speed nor duration
    const fit = buildFit(b.data, b.hull(HULL), {
      modules: [[jammed, "high", 0]], charges: new Map([[0, b.charge(SHELL)]]),
    });
    expect(fitPerformance(fit)).toMatchObject({ dps: null, volley: null });
  });
});

describe("weapon range", () => {
  it("reads a turret's optimal and falloff off the module, where the ammo effects land", () => {
    const b = bench();
    const gun = b.turret([[PERF_ATTR.maxRange, 1200], [PERF_ATTR.falloff, 5160]]);
    const fit = buildFit(b.data, b.hull(HULL), { modules: [[gun, "high", 0]], charges: new Map([[0, b.charge(SHELL)]]) });
    expect(weaponRange(fit, fit.modules[0].item)).toEqual({ kind: "turret", optimal: 1200, falloff: 5160 });
  });

  it("flies a missile for explosionDelay milliseconds at maxVelocity", () => {
    const b = bench();
    const missile = b.charge([...SHELL, [PERF_ATTR.maxVelocity, 1800], [PERF_ATTR.explosionDelay, 7200]]);
    const fit = buildFit(b.data, b.hull(HULL), { modules: [[b.launcher([]), "high", 0]], charges: new Map([[0, missile]]) });
    expect(weaponRange(fit, fit.modules[0].item)).toEqual({ kind: "missile", range: 12_960 });   // 1800 x 7.2 s
  });

  it("is null for an empty launcher, a module with no hardpoint, and a turret with no range figures", () => {
    const b = bench();
    const fit = buildFit(b.data, b.hull(HULL), {
      modules: [[b.launcher([]), "high", 0], [b.active([]), "mid", 0], [b.turret([]), "high", 1]],
    });
    expect(fit.modules.map(({ item }) => weaponRange(fit, item))).toEqual([null, null, null]);
  });

  it("answers for another charge without leaving it loaded", () => {
    const b = bench();
    const launcher = b.launcher([]);
    const slow = b.charge([...SHELL, [PERF_ATTR.maxVelocity, 1000], [PERF_ATTR.explosionDelay, 5000]]);
    const fast = b.charge([...SHELL, [PERF_ATTR.maxVelocity, 2000], [PERF_ATTR.explosionDelay, 5000]]);
    const fit = buildFit(b.data, b.hull(HULL), { modules: [[launcher, "high", 0]], charges: new Map([[0, slow]]) });
    const item = fit.modules[0].item;
    expect(weaponRangeWith(fit, item, fast)).toEqual({ kind: "missile", range: 10_000 });
    expect(item.charge?.typeId).toBe(slow);
    expect(weaponRange(fit, item)).toEqual({ kind: "missile", range: 5_000 });
    const empty = buildFit(b.data, b.hull(HULL), { modules: [[launcher, "high", 0]] });
    expect(weaponRangeWith(empty, empty.modules[0].item, fast)).toEqual({ kind: "missile", range: 10_000 });
    expect(empty.modules[0].item.charge).toBeUndefined();
  });
});

describe("effective hit points", () => {
  it("divides each layer by the mean of its four resonances and sums the three", () => {
    const b = bench();
    // 800/0.5 + 600/0.6 + 500/1 = 1600 + 1000 + 500
    expect(fitPerformance(buildFit(b.data, b.hull(HULL))).ehp).toBe(3100);
  });

  it("skips a layer the hull has no hit points in", () => {
    const b = bench();
    const noShield = HULL.filter(([a]) => a !== PERF_ATTR.shieldCapacity);
    expect(fitPerformance(buildFit(b.data, b.hull(noShield))).ehp).toBe(1500);   // 1000 + 500
  });

  it("is null for a hull with no layers at all", () => {
    const b = bench();
    expect(fitPerformance(buildFit(b.data, b.hull([[ATTR.mass, 1]]))).ehp).toBeNull();
  });
});

describe("mobility", () => {
  it("takes max velocity straight from the hull's modified attribute", () => {
    const b = bench();
    expect(fitPerformance(buildFit(b.data, b.hull(HULL))).maxVelocity).toBe(320);
  });

  it("aligns in ln(4) × mass × agility / 1e6 seconds", () => {
    const b = bench();
    // ln(4) × 2 000 000 × 5 / 1e6 = 10 ln 4 = 13.862943611198906
    expect(fitPerformance(buildFit(b.data, b.hull(HULL))).alignTime).toBeCloseTo(13.862943611198906, 12);
  });

  it("has no align time without an agility figure", () => {
    const b = bench();
    const noAgility = HULL.filter(([a]) => a !== PERF_ATTR.agility);
    expect(fitPerformance(buildFit(b.data, b.hull(noAgility))).alignTime).toBeNull();
  });
});

describe("capacitor", () => {
  // capacity 1000 GJ, recharge 200 000 ms = 200 s  →  peak = 2.5 × 1000 / 200 = 12.5 GJ/s.
  const PEAK = 12.5;

  it("reports the capacity and the recharge time in seconds", () => {
    const b = bench();
    expect(fitPerformance(buildFit(b.data, b.hull(HULL)))).toMatchObject({
      capacitorCapacity: 1000, capRechargeTime: 200, capStable: { stable: true, level: 1 },
    });
  });

  it("settles at the higher root of u² - u + k = 0 under a sustainable drain", () => {
    const b = bench();
    // 45 GJ every 10 s = 4.5 GJ/s, comfortably under the 12.5 GJ/s peak.
    // k = U·T / (10·C) = 4.5 × 200 / 10 000 = 0.09
    // u = (1 + √(1 − 0.36)) / 2 = (1 + 0.8) / 2 = 0.9  →  level = 0.81
    const prop = b.active([[ATTR.capacitorNeed, 45], [PERF_ATTR.duration, 10_000]]);
    const fit = buildFit(b.data, b.hull(HULL), { modules: [[prop, "mid", 0]] });
    expect(stableLevel(fitPerformance(fit).capStable)).toBeCloseTo(0.81, 12);
  });

  it("empties in (4/D)·arctan(a/D) seconds once the drain passes the peak", () => {
    const b = bench();
    // 250 GJ every 10 s = 25 GJ/s = 2 × peak.
    // a = 10/T = 0.05, b = U/C = 0.025, D = √(a(4b − a)) = √(0.05 × 0.05) = 0.05 = a,
    // so t = (4/a)·arctan(1) = (4/0.05)(π/4) = 20π = 62.83185307179586 s.
    const drain = b.active([[ATTR.capacitorNeed, 250], [PERF_ATTR.duration, 10_000]]);
    const fit = buildFit(b.data, b.hull(HULL), { modules: [[drain, "mid", 0]] });
    const cap = fitPerformance(fit).capStable!;
    expect(cap.stable).toBe(false);
    expect((cap as { lastsSeconds: number }).lastsSeconds).toBeCloseTo(20 * Math.PI, 10);
    // …and the closed form agrees with integrating the recharge curve down from a full capacitor.
    expect((cap as { lastsSeconds: number }).lastsSeconds).toBeCloseTo(drainSeconds(1000, 200, 25), 2);
  });

  it("is stable at exactly a quarter capacitor when the drain equals the peak", () => {
    const b = bench();
    const drain = b.active([[ATTR.capacitorNeed, PEAK * 10], [PERF_ATTR.duration, 10_000]]);
    const fit = buildFit(b.data, b.hull(HULL), { modules: [[drain, "mid", 0]] });
    // k = 12.5 × 200 / 10 000 = 0.25  →  u = 1/2  →  level = 1/4, the peak-recharge point itself.
    expect(fitPerformance(fit).capStable).toEqual({ stable: true, level: 0.25 });
  });

  it("stays on the stable branch when the drain ties the peak in floating point", () => {
    const b = bench();
    // A tie the two spellings of the same comparison disagree about: capacity 168 GJ, T = 125 s,
    // 33.6 GJ per 10 s cycle.
    //   peak  = 2.5 × 168 / 125 = 3.36        usage = 33.6 / 10 = 3.36
    // but `usage > peak` is *true* by one ulp, while a = 10/125 = 0.08, b = 3.36/168 = 0.02 give
    // 4b − a = 0 exactly. Deciding the branch on `usage <= peak` and then taking √(a(4b − a)) sends
    // the unstable formula a D of 0 and returns lastsSeconds: Infinity. One discriminant for both
    // lands it here instead, at the peak-recharge fraction.
    const hull = HULL.map(([a, v]) => [a, a === PERF_ATTR.capacitorCapacity ? 168
      : a === PERF_ATTR.rechargeRate ? 125_000 : v] as const);
    const drain = b.active([[ATTR.capacitorNeed, 33.6], [PERF_ATTR.duration, 10_000]]);
    const fit = buildFit(b.data, b.hull(hull), { modules: [[drain, "mid", 0]] });
    expect(fitPerformance(fit).capStable).toEqual({ stable: true, level: 0.25 });
  });

  it("charges nothing for a module that is merely online", () => {
    const b = bench();
    const drain = b.active([[ATTR.capacitorNeed, 250], [PERF_ATTR.duration, 10_000]]);
    const fit = buildFit(b.data, b.hull(HULL), { modules: [[drain, "mid", 0]] });
    fit.modules[0].item.state = State.Online;
    clearMemo(fit);
    expect(fitPerformance(fit).capStable).toEqual({ stable: true, level: 1 });
  });

  it("reads a cycle from `speed` when the module has no `duration`", () => {
    const b = bench();
    const drain = b.active([[ATTR.capacitorNeed, 45], [PERF_ATTR.speed, 10_000]]);
    const fit = buildFit(b.data, b.hull(HULL), { modules: [[drain, "mid", 0]] });
    expect(stableLevel(fitPerformance(fit).capStable)).toBeCloseTo(0.81, 12);
  });

  it("ignores a capacitor cost with no cycle to spread it over", () => {
    const b = bench();
    const drain = b.active([[ATTR.capacitorNeed, 250]]);
    const fit = buildFit(b.data, b.hull(HULL), { modules: [[drain, "mid", 0]] });
    expect(fitPerformance(fit).capStable).toEqual({ stable: true, level: 1 });
  });

  it("has no stability answer when the recharge time is zero", () => {
    const b = bench();
    const stalled = HULL.map(([a, v]) => [a, a === PERF_ATTR.rechargeRate ? 0 : v] as const);
    const perf = fitPerformance(buildFit(b.data, b.hull(stalled)));
    expect(perf.capRechargeTime).toBeNull();
    expect(perf.capStable).toBeNull();
    expect(perf.capacitorCapacity).toBe(1000);
  });
});

describe("targeting", () => {
  it("reports the hull's figures as they stand", () => {
    const b = bench();
    expect(fitPerformance(buildFit(b.data, b.hull(HULL)))).toMatchObject({
      maxTargets: 7, maxTargetRange: 45_000, scanResolution: 480, signatureRadius: 38,
    });
  });

  it("caps max targets at the pilot's own once the character has a figure", () => {
    const b = bench();
    const fit = buildFit(b.data, b.hull(HULL));
    fit.character.attrs.set(PERF_ATTR.maxLockedTargets, 5);
    clearMemo(fit);
    expect(fitPerformance(fit).maxTargets).toBe(5);
  });

  it("keeps the hull's figure when the pilot has no targeting skills at all", () => {
    const b = bench();
    const fit = buildFit(b.data, b.hull(HULL));
    expect(fit.character.attrs.has(PERF_ATTR.maxLockedTargets)).toBe(false);
    expect(fitPerformance(fit).maxTargets).toBe(7);
  });
});

describe("a hull that carries nothing", () => {
  it("answers null everywhere rather than NaN or Infinity", () => {
    const b = bench();
    const perf = fitPerformance(buildFit(b.data, b.hull([])));
    expect(perf).toEqual({
      dps: null, volley: null, weaponDps: null, droneDps: null,
      ehp: null, shield: null, armor: null, hull: null, shieldRechargeTime: null, shieldRechargeRate: null,
      maxVelocity: null, propulsion: null, alignTime: null,
      capacitorCapacity: null, capRechargeTime: null, capStable: null, capUsage: null, capPeakRecharge: null, capDelta: null,
      maxTargets: null, maxTargetRange: null, scanResolution: null, signatureRadius: null, sensorStrength: null,
      mass: null, inertia: null, warpSpeed: null, droneBandwidth: null, droneBay: null, droneControlRange: null,
    });
  });
});

describe("the fitting-window stats", () => {
  it("reports each tank layer's pool, resistances and omni ehp", () => {
    const b = bench();
    const perf = fitPerformance(buildFit(b.data, b.hull(HULL)));
    const pct = (layer: { resists: readonly number[] } | null) => layer!.resists.map((r) => Math.round(r * 100));
    expect(perf.shield).toMatchObject({ hp: 800, ehp: 1600 });
    expect(pct(perf.shield)).toEqual([0, 50, 75, 75]);
    expect(perf.armor!.hp).toBe(600);
    expect(perf.armor!.ehp).toBeCloseTo(1000, 9);
    expect(pct(perf.armor)).toEqual([10, 30, 50, 70]);
    expect(perf.hull).toEqual({ hp: 500, resists: [0, 0, 0, 0], ehp: 500 });
    expect(perf.ehp).toBeCloseTo(3100, 9);
    expect(perf.shieldRechargeTime).toBe(1000);
    expect(perf.shieldRechargeRate).toBe(2);
  });

  it("splits dps between weapons and drones", () => {
    const b = bench();
    // Turret: 100 x 2 / 5 s = 40 dps. Drone: 100 / 4 s = 25 dps.
    const gun = b.turret([[PERF_ATTR.damageMultiplier, 2], [PERF_ATTR.speed, 5000]]);
    const drone = b.drone([...SHELL, [PERF_ATTR.speed, 4000]]);
    const fit = buildFit(b.data, b.hull(HULL), {
      modules: [[gun, "high", 0]], charges: new Map([[0, b.charge(SHELL)]]), drones: [drone],
    });
    expect(fitPerformance(fit)).toMatchObject({ dps: 65, weaponDps: 40, droneDps: 25 });
    // Weapons only: the drone share is null, not 0.
    expect(fitPerformance(buildFit(b.data, b.hull(HULL), {
      modules: [[gun, "high", 0]], charges: new Map([[0, b.charge(SHELL)]]),
    }))).toMatchObject({ weaponDps: 40, droneDps: null });
  });

  it("reports the capacitor's peak recharge, the fit's draw and their difference", () => {
    const b = bench();
    // Peak: 2.5 x 1000 GJ / 200 s = 12.5 GJ/s. An active module drawing 50 GJ every 10 s: 5 GJ/s.
    const idle = fitPerformance(buildFit(b.data, b.hull(HULL)));
    expect(idle).toMatchObject({ capPeakRecharge: 12.5, capUsage: 0, capDelta: 12.5 });
    const rep = b.active([[ATTR.capacitorNeed, 50], [PERF_ATTR.duration, 10_000]]);
    const busy = fitPerformance(buildFit(b.data, b.hull(HULL), { modules: [[rep, "mid", 0]] }));
    expect(busy).toMatchObject({ capPeakRecharge: 12.5, capUsage: 5, capDelta: 7.5 });
  });

  it("runs an afterburner the way Pyfa does: mass + massAddition, then speedFactor x thrust / mass percent", () => {
    const b = bench();
    // 135 x 1,500,000 / (2,000,000 + 500,000) = 81 %  →  320 x 1.81 = 579.2 m/s.
    // Align with the heavier hull: ln 4 x 2,500,000 x 5 / 1e6 = 6.931 s (cold: 5.545 s).
    const ab = b.prop("afterburner", [[PERF_ATTR.speedFactor, 135], [PERF_ATTR.speedBoostFactor, 1_500_000], [PERF_ATTR.massAddition, 500_000]]);
    const perf = fitPerformance(buildFit(b.data, b.hull(HULL), { modules: [[ab, "mid", 0]] }));
    expect(perf.maxVelocity).toBe(320);                       // the cold figure is untouched
    expect(perf.propulsion?.kind).toBe("Afterburner");
    expect(perf.propulsion?.velocity).toBeCloseTo(579.2, 9);
    expect(perf.propulsion?.alignTime).toBeCloseTo(Math.log(4) * 2_500_000 * 5 / 1e6, 9);
    expect(perf.propulsion?.signatureRadius).toBe(38);        // an afterburner does not bloom
    expect(perf.alignTime).toBeCloseTo(Math.log(4) * 2_000_000 * 5 / 1e6, 9);
  });

  it("blooms the signature for a microwarpdrive and ignores a propulsion module that is not active", () => {
    const b = bench();
    const mwd = b.prop("microwarpdrive", [[PERF_ATTR.speedFactor, 500], [PERF_ATTR.speedBoostFactor, 1_500_000], [PERF_ATTR.massAddition, 500_000], [PERF_ATTR.signatureRadiusBonus, 500]]);
    const fit = buildFit(b.data, b.hull(HULL), { modules: [[mwd, "mid", 0]] });
    // 500 x 1.5e6 / 2.5e6 = 300 %  →  320 x 4 = 1280 m/s; signature 38 x 6 = 228 m.
    expect(fitPerformance(fit).propulsion).toMatchObject({ kind: "Microwarpdrive", velocity: 1280, signatureRadius: 228 });
    fit.modules[0].item.state = State.Online;
    clearMemo(fit);
    expect(fitPerformance(fit).propulsion).toBeNull();
    expect(fitPerformance(buildFit(b.data, b.hull(HULL))).propulsion).toBeNull();
  });

  it("names the strongest sensor, and reads mass, inertia, warp speed and the drone limits", () => {
    const b = bench();
    const perf = fitPerformance(buildFit(b.data, b.hull(HULL)));
    expect(perf.sensorStrength).toEqual({ kind: "Ladar", points: 8 });   // 8 ladar beats 3 radar
    expect(perf).toMatchObject({ mass: 2_000_000, inertia: 5, warpSpeed: 5, droneBandwidth: 25, droneBay: 40 });
    // droneControlDistance is a character attribute the bench (like the snapshots) does not define.
    expect(perf.droneControlRange).toBeNull();
  });
});

/** The stable capacitor level, having first insisted the fit is stable at all. */
function stableLevel(cap: CapStability | null): number {
  expect(cap).toMatchObject({ stable: true });
  return (cap as { stable: true; level: number }).level;
}

/**
 * Euler integration of dC/dt = C_max·(10/T)·(√f − f) − U from a full capacitor — the same ODE the
 * closed form in perf.ts solves, integrated the dumb way as an independent check.
 */
function drainSeconds(capacity: number, rechargeTime: number, usage: number, step = 0.001): number {
  let cap = capacity;
  for (let t = 0; t < 100_000; t += step) {
    const f = cap / capacity;
    cap += (capacity * (10 / rechargeTime) * (Math.sqrt(f) - f) - usage) * step;
    if (cap <= 0) return t + step;
  }
  return Infinity;
}

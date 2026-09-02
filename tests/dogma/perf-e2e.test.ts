/**
 * The performance maths against the committed SDE snapshots.
 *
 * ⚠ Hand-derived from the snapshots, not verified against Pyfa or the client — the same caveat as
 * rifter-e2e.test.ts (research §8). Every derivation is written out beside the number it pins, and
 * every input is a value the snapshot actually contains, so a disagreement with the game is a
 * disagreement about *mechanics*, not arithmetic. One is already known and called out below: a fit
 * with no ship-class skill trained receives its hull's role bonus unscaled.
 */
import { describe, it, expect } from "vitest";
import { ATTR, State } from "../../src/lib/dogma/data.js";
import { clearMemo, explain } from "../../src/lib/dogma/calc.js";
import { PERF_ATTR, fitPerformance } from "../../src/lib/dogma/index.js";
import { fixtureData } from "./fixture.js";
import { allSkills, buildFit } from "./build-fit.js";

const data = fixtureData("rifter");
const tengu = fixtureData("tengu");

const RIFTER = 587;
const AUTOCANNON = 2889;      // 200mm AutoCannon II
const HAIL = 12608;           // Hail S
const HOBGOBLIN = 2456;       // Hobgoblin II
const MWD = 440;              // 5MN Microwarpdrive II

/** Three 200mm AutoCannon II, each loaded with Hail S. */
const GUNS = {
  modules: [[AUTOCANNON, "high", 0], [AUTOCANNON, "high", 1], [AUTOCANNON, "high", 2]] as [number, "high", number][],
  charges: new Map([[0, HAIL], [1, HAIL], [2, HAIL]]),
};

describe("the attribute ids the module reads", () => {
  it("are named in the snapshot exactly as PERF_ATTR spells them", () => {
    // Every key of PERF_ATTR is the sde_dogma_attributes name of the id it holds. If a snapshot
    // regeneration ever moves an id, this fails before any pinned number does.
    for (const [name, id] of Object.entries(PERF_ATTR)) {
      expect([name, data.attributes.get(id)?.name]).toEqual([name, name]);
    }
    expect(data.attributes.get(ATTR.mass)?.name).toBe("mass");
    expect(data.attributes.get(ATTR.capacitorNeed)?.name).toBe("capacitorNeed");
  });

  it("takes the structure layer from the unprefixed resonances, which is where the SDE points", () => {
    // Damage Control II's effect 2302 modifies 109/110/111/113 using its own hull*DamageResonance
    // (974-977) as the magnitude — so 109-113 are the ship's structure resistances, and 974-977 are
    // the module's bonus attributes, not a layer.
    const dcu = buildFit(data, RIFTER, { modules: [[2048, "low", 0]] });
    const carriers = explain(dcu, dcu.ship, PERF_ATTR.emDamageResonance);
    expect(carriers.map((a) => [a.carrierTypeId, a.modifyingAttrId])).toEqual([[2048, 974]]);
  });
});

describe("a bare Rifter", () => {
  const perf = fitPerformance(buildFit(data, RIFTER));

  it("has no damage output at all", () => {
    expect(perf.dps).toBeNull();
    expect(perf.volley).toBeNull();
  });

  it("tanks 1 809.74 effective hit points against an omni profile", () => {
    // shield    450 / mean(1, 0.8, 0.6, 0.5)      = 450 / 0.725 =  620.6896551724138
    // armour    450 / mean(0.4, 0.65, 0.75, 0.9)  = 450 / 0.675 =  666.6666666666666
    // structure 350 / mean(0.67, 0.67, 0.67, 0.67)= 350 / 0.67  =  522.3880597014925
    //                                                    total  = 1809.744381540573
    // The 0.67 structure resonances are correct, not an import artefact: every hull innately
    // resists 33 % of structure damage. It is what makes a Damage Control's 0.6 hull resonance land
    // at 0.6 × 0.67 = 0.402 — the ~60 % structure resistance everyone quotes. Both snapshots agree,
    // and DCU II carries exactly 0.6 in 974-977.
    expect(perf.ehp).toBeCloseTo(1809.744381540573, 9);
  });

  it("flies at 365 m/s and aligns in 4.73 s", () => {
    // ln(4) × 1 067 000 kg × 3.2 / 1e6 = 1.3862943611198906 × 3.4144 = 4.733363466607755
    expect(perf.maxVelocity).toBe(365);
    expect(perf.alignTime).toBeCloseTo(4.733363466607755, 9);
  });

  it("has a 250 GJ capacitor that recharges in 125 s and is stable at full with nothing running", () => {
    expect(perf.capacitorCapacity).toBe(250);       // capacitorCapacity 482
    expect(perf.capRechargeTime).toBe(125);         // rechargeRate 55 = 125 000 ms
    expect(perf.capStable).toEqual({ stable: true, level: 1 });
  });

  it("locks four targets out to 22.5 km", () => {
    // The character carries no maxLockedTargets — no Targeting skill is in the snapshot — so the
    // hull's own 4 stands rather than being min()'d down to zero.
    expect(perf).toMatchObject({
      maxTargets: 4, maxTargetRange: 22500, scanResolution: 660, signatureRadius: 35,
    });
  });
});

describe("a Rifter with three 200mm AutoCannon II loaded with Hail S", () => {
  it("volleys 183.99 and sustains 53.04 dps with no skills trained", () => {
    const perf = fitPerformance(buildFit(data, RIFTER, GUNS));
    // Hail S: 13.9 explosive + 3.8 kinetic = 17.7 raw damage a shot, no em and no thermal.
    // 200mm AutoCannon II: damageMultiplier 3.465, unmodified — nothing in this fit touches it.
    //   per shot = 17.7 × 3.465 = 61.3305, and three guns volley 183.9915.
    // Cycle: base speed 3750 ms, less 7.5 % from the Rifter's own effect 7248 — the hull's role
    //   bonus reads shipBonusMF (-7.5) directly, and with no Minmatar Frigate skill fitted there is
    //   no skill level to scale it by, so one level's worth applies. 3750 × 0.925 = 3468.75 ms.
    //   dps = 183.9915 / 3.46875 = 53.04259459459459
    expect(perf.volley).toBeCloseTo(183.9915, 9);
    expect(perf.dps).toBeCloseTo(53.04259459459459, 9);
  });

  it("volleys 252.99 and sustains 119.94 dps at all skills V", () => {
    const perf = fitPerformance(buildFit(data, RIFTER, { ...GUNS, skills: allSkills(data, 5) }));
    // damageMultiplier 3.465 × 1.25 (Small Projectile Turret V, +5 %/level)
    //                        × 1.10 (Small Autocannon Specialization V, +2 %/level) = 4.764375
    //   per shot = 17.7 × 4.764375 = 84.3294375, three guns volley 252.9883125.
    // Cycle: 3750 × (1 − 0.075 × 5) (the role bonus, now scaled by Minmatar Frigate V)
    //             × (1 − 0.02 × 5)  (Gunnery V) = 3750 × 0.625 × 0.9 = 2109.375 ms.
    //   Neither is stacking-penalised: `speed` is non-stackable, but ships and skills are
    //   penalty-immune carriers (PENALTY_IMMUNE_CATEGORY_IDS).
    //   dps = 252.9883125 / 2.109375 = 119.9352
    expect(perf.volley).toBeCloseTo(252.9883125, 9);
    expect(perf.dps).toBeCloseTo(119.9352, 9);
  });

  it("counts only the guns that are active", () => {
    const fit = buildFit(data, RIFTER, GUNS);
    fit.modules[2].item.state = State.Online;
    clearMemo(fit);
    // Two thirds of the three-gun volley: 2 × 61.3305 = 122.661
    expect(fitPerformance(fit).volley).toBeCloseTo(122.661, 9);
  });

  it("tanks 2 107.01 EHP at all skills V", () => {
    const perf = fitPerformance(buildFit(data, RIFTER, { ...GUNS, skills: allSkills(data, 5) }));
    // shield    450   / 0.725 =  620.6896551724138   (no shield HP skill is in the snapshot)
    // armour    562.5 / 0.675 =  833.3333333333333   (Hull Upgrades V, +5 %/level on armorHP 450)
    // structure 437.5 / 0.67  =  652.9850746268657   (Mechanics V,     +5 %/level on hp 350)
    //                   total = 2107.0080631326127
    expect(perf.ehp).toBeCloseTo(2107.0080631326127, 9);
    expect(perf.maxVelocity).toBe(456.25);                    // 365 × 1.25, Navigation V
    expect(perf.alignTime).toBeCloseTo(4.260027119946979, 9); // agility 3.2 × 0.9, Spaceship Command V
  });
});

describe("drones", () => {
  it("counts every Hobgoblin II in the bay, whatever state it is in", () => {
    const fit = buildFit(data, RIFTER, { drones: [HOBGOBLIN, HOBGOBLIN] });
    expect(fit.drones.every((d) => d.state === State.Offline)).toBe(true);
    // 20 thermal × damageMultiplier 1.92 = 38.4 a shot, over a 4 000 ms cycle → 9.6 dps each.
    expect(fitPerformance(fit)).toMatchObject({ volley: 76.8, dps: 19.2 });
  });
});

describe("a Rifter with a 5MN Microwarpdrive II running", () => {
  const fit = buildFit(data, RIFTER, { modules: [[MWD, "mid", 0]] });
  const perf = fitPerformance(fit);

  it("loses a fifth of its capacitor to the module's own online effect", () => {
    expect(fit.modules[0].item.state).toBe(State.Active);
    // Effect 58 multiplies capacitorCapacity by capacitorCapacityMultiplier 0.8: 250 → 200 GJ.
    expect(perf.capacitorCapacity).toBe(200);
  });

  it("sits exactly on the peak recharge point", () => {
    // Drain: capacitorNeed 40 over duration 10 000 ms = 4 GJ/s.
    // Peak:  2.5 × 200 / 125 = 4 GJ/s — the two are equal, so the cap is stable at the peak
    //        recharge fraction itself, 25 %.
    expect(perf.capStable).toEqual({ stable: true, level: 0.25 });
  });

  it("does not move the speed figure — the engine has no microwarpdrive effect", () => {
    // Effect 6730 (moduleBonusMicrowarpdrive) carries no modifierInfo in the SDE; EOS and Pyfa
    // hard-code the speedFactor/massAddition maths and this engine does not implement it yet.
    // Recorded here so the day it lands, this test fails and says so.
    expect(perf.maxVelocity).toBe(365);
    expect(perf.alignTime).toBeCloseTo(4.733363466607755, 9);
  });
});

describe("a bare Tengu, from a snapshot that carries only some of the damage attributes", () => {
  const perf = fitPerformance(buildFit(tengu, 29984));

  it("answers every question it can and never throws on the ones it cannot", () => {
    expect(tengu.attributes.has(PERF_ATTR.damageMultiplier)).toBe(false);
    expect(tengu.attributes.has(PERF_ATTR.emDamage)).toBe(false);
    expect(perf.dps).toBeNull();
    // shield    2600 / mean(1, 0.4, 0.45, 0.5)          = 2600 / 0.5875   = 4425.531914893617
    // armour    2100 / mean(0.5, 0.275, 0.5625, 0.9)    = 2100 / 0.559375 = 3754.1899441340784
    // structure 1700 / 0.67                                               = 2537.3134328358208
    //                                                              total  = 10717.035291863516
    expect(perf.ehp).toBeCloseTo(10717.035291863516, 8);
    // ln(4) × 14 400 000 × 0.52 / 1e6 = 1.3862943611198906 × 7.488
    expect(perf.alignTime).toBeCloseTo(10.38057217606574, 9);
    expect(perf).toMatchObject({
      maxVelocity: 170, capacitorCapacity: 1400, capRechargeTime: 350,
      maxTargets: 6, maxTargetRange: 75000, scanResolution: 210, signatureRadius: 180,
    });
  });
});

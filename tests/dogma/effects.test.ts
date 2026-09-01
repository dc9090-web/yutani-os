import { describe, it, expect } from "vitest";
import { EFFECT, State } from "../../src/lib/dogma/data.js";
import { addModule, attachCharge, createFit, makeItem, makeSkill } from "../../src/lib/dogma/fit.js";
import { activeModifiers, effectRuns, runningEffects } from "../../src/lib/dogma/effects.js";
import { fixtureData } from "./fixture.js";
import { mod, world } from "./synthetic.js";

const data = fixtureData("rifter");
const ids = (fit: Parameters<typeof runningEffects>[0], item: Parameters<typeof runningEffects>[1]) =>
  runningEffects(fit, item).map((e) => e.id).sort((a, b) => a - b);

describe("state gating", () => {
  it("runs an active-category default effect only at Active", () => {
    // 2889: 12 hiPower + 42 turretFitted (passive), 16 online, 34 projectileFired (active, isDefault),
    // 263 barrage (active, not default), 253/254 passive, 3025 overload.
    const fit = createFit(data, makeItem(data, 587));
    const gun = makeItem(data, 2889, { state: State.Active });
    addModule(fit, gun, "high", 0);
    expect(ids(fit, gun)).toContain(34);
    gun.state = State.Online;
    expect(ids(fit, gun)).not.toContain(34);
    expect(ids(fit, gun)).toContain(EFFECT.online);
  });

  it("never runs a non-default active effect, even overloaded", () => {
    const fit = createFit(data, makeItem(data, 587));
    const gun = makeItem(data, 2889, { state: State.Overload });
    addModule(fit, gun, "high", 0);
    expect(ids(fit, gun)).not.toContain(263);
  });

  it("runs an overload-category effect only at Overload", () => {
    const fit = createFit(data, makeItem(data, 587));
    const gun = makeItem(data, 2889, { state: State.Active });
    addModule(fit, gun, "high", 0);
    expect(ids(fit, gun)).not.toContain(3025);
    gun.state = State.Overload;
    expect(ids(fit, gun)).toContain(3025);
  });

  it("runs passive markers even offline, but stops the online effect", () => {
    const fit = createFit(data, makeItem(data, 587));
    const gun = makeItem(data, 2889, { state: State.Offline });
    addModule(fit, gun, "high", 0);
    expect(ids(fit, gun)).toContain(EFFECT.turretFitted);
    expect(ids(fit, gun)).not.toContain(EFFECT.online);
  });

  it("runs a rig's passive effects offline", () => {
    const fit = createFit(data, makeItem(data, 587));
    const rig = makeItem(data, 31686, { state: State.Offline });
    addModule(fit, rig, "rig", 0);
    expect(ids(fit, rig)).toContain(EFFECT.rigSlot);
  });
});

describe("full compliance", () => {
  it("requires the online effect for an online-category effect", () => {
    // Gyrostabilizer II's damage/rof effects (89, 92) are category 4 and it does carry `online`.
    const fit = createFit(data, makeItem(data, 587));
    const gyro = makeItem(data, 519, { state: State.Online });
    addModule(fit, gyro, "low", 0);
    expect(ids(fit, gyro)).toEqual([EFFECT.loPower, EFFECT.online, 89, 92].sort((a, b) => a - b));   // loPower is category 0 → runs at any state
    gyro.state = State.Offline;
    expect(ids(fit, gyro)).toEqual([EFFECT.loPower]);
  });

  it("suppresses an online-category effect on a type that has no online effect", () => {
    const w = world();
    const online = w.effect({ categoryId: 4, state: State.Online, modifiers: [mod({ modifiedAttrId: 1, modifyingAttrId: 2 })] });
    const type = w.type({ effects: [[online.id, false]] });
    const fit = createFit(w.data, makeItem(w.data, w.type({ categoryId: 6 }).id));
    const item = makeItem(w.data, type.id, { state: State.Online });
    addModule(fit, item, "low", 0);
    expect(effectRuns(item, online, false)).toBe(false);
  });

  it("suppresses an offline effect that declares a fitting usage chance", () => {
    const w = world();
    const chance = w.attr();
    const side = w.effect({ categoryId: 0, state: State.Offline, fittingUsageChanceAttrId: chance.id });
    const plain = w.effect({ categoryId: 0, state: State.Offline });
    const type = w.type({ categoryId: 20, effects: [[side.id, false], [plain.id, false]] });
    const fit = createFit(w.data, makeItem(w.data, w.type({ categoryId: 6 }).id));
    const implant = makeItem(w.data, type.id);
    fit.implants.push(implant);
    expect(ids(fit, implant)).toEqual([plain.id]);
  });

  it("skips an effect id the loader dropped", () => {
    const w = world();
    const type = w.type({ effects: [[424242, false]] });
    const fit = createFit(w.data, makeItem(w.data, w.type({ categoryId: 6 }).id));
    const item = makeItem(w.data, type.id);
    addModule(fit, item, "low", 0);
    expect(runningEffects(fit, item)).toEqual([]);
  });
});

describe("charges", () => {
  it("gates a charge's effects on its container's state", () => {
    const w = world();
    const onlineMarker = w.effect({ id: EFFECT.online, categoryId: 4, state: State.Online });
    const boost = w.effect({ categoryId: 4, state: State.Online, modifiers: [mod({ modifiedAttrId: 1, modifyingAttrId: 2 })] });
    const chargeType = w.type({ categoryId: 8, effects: [[onlineMarker.id, false], [boost.id, false]] });
    const moduleType = w.type({ effects: [[EFFECT.hiPower, false]] });
    const fit = createFit(w.data, makeItem(w.data, w.type({ categoryId: 6 }).id));
    const module = makeItem(w.data, moduleType.id, { state: State.Online });
    const charge = makeItem(w.data, chargeType.id);
    attachCharge(module, charge);
    addModule(fit, module, "high", 0);
    expect(runningEffects(fit, charge).map((e) => e.id)).toContain(boost.id);
    module.state = State.Offline;
    expect(runningEffects(fit, charge)).toEqual([]);
  });
});

describe("activeModifiers", () => {
  it("collects every running modifier in the fit with its carrier", () => {
    const fit = createFit(data, makeItem(data, 587));
    fit.skills.set(3426, makeSkill(data, 3426, 5));
    const collected = activeModifiers(fit);
    // CPU Management carries 368 and 397; the Rifter carries 5779 and 7248. 132 (skillEffect) is
    // dropped at load time, so it never shows up here even though CPU Management carries it.
    const byEffect = new Map(collected.map((c) => [c.effect.id, c]));
    expect(byEffect.get(368)!.carrier).toBe(fit.skills.get(3426));
    expect(byEffect.get(397)!.modifier.modifiedAttrId).toBe(48);
    expect(byEffect.get(7248)!.carrier).toBe(fit.ship);
    expect(collected.filter((c) => c.effect.id === 132)).toHaveLength(0);
  });

  it("drops the modifiers of an effect that has stopped running", () => {
    const fit = createFit(data, makeItem(data, 587));
    const gyro = makeItem(data, 519, { state: State.Online });
    addModule(fit, gyro, "low", 0);
    expect(activeModifiers(fit).some((c) => c.effect.id === 92)).toBe(true);
    gyro.state = State.Offline;
    expect(activeModifiers(fit).some((c) => c.effect.id === 92)).toBe(false);
  });
});

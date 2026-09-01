import { describe, it, expect } from "vitest";
import { ATTR, CATEGORY, EFFECT, Operator, State } from "../../src/lib/dogma/data.js";
import { addModule, attachCharge, createFit, makeItem } from "../../src/lib/dogma/fit.js";
import { DogmaCycleError, UnknownAttributeError, clearMemo, explain, getAttr } from "../../src/lib/dogma/calc.js";
import { mod, world, type World } from "./synthetic.js";

/** A fit whose hull carries `shipAttrs`. */
function ship(w: World, shipAttrs: [number, number][] = []) {
  const hull = w.type({ categoryId: CATEGORY.ship, attrs: shipAttrs });
  return createFit(w.data, makeItem(w.data, hull.id));
}

describe("seeding", () => {
  it("prefers the item's own attribute, then the attribute default", () => {
    const w = world();
    const withValue = w.attr({ defaultValue: 7 });
    const withoutValue = w.attr({ defaultValue: 3 });
    const fit = ship(w, [[withValue.id, 42]]);
    expect(getAttr(fit, fit.ship, withValue.id)).toBe(42);
    expect(getAttr(fit, fit.ship, withoutValue.id)).toBe(3);
  });

  it("throws when the attribute is not in the data set at all", () => {
    const w = world();
    const fit = ship(w);
    expect(() => getAttr(fit, fit.ship, 987654)).toThrow(UnknownAttributeError);
  });
});

describe("operator order", () => {
  it("applies assign → multiply → add → multiply, matching EOS's all-in fixture", () => {
    const w = world();
    const target = w.attr({ stackable: true, highIsGood: true });
    const sources = [5, 2, 4, 10, 3, 1.5, 2, 100].map((v) => ({ attr: w.attr(), value: v }));
    const ops = [
      Operator.PreAssign, Operator.PreMul, Operator.PreDiv, Operator.ModAdd,
      Operator.ModSub, Operator.PostMul, Operator.PostDiv, Operator.PostPercent,
    ];
    const effect = w.effect({
      categoryId: 0, state: State.Offline,
      modifiers: ops.map((operation, i) => mod({
        func: "ItemModifier", domain: "ship", operation,
        modifiedAttrId: target.id, modifyingAttrId: sources[i].attr.id,
      })),
    });
    const carrierType = w.type({
      categoryId: CATEGORY.skill,
      attrs: sources.map((s) => [s.attr.id, s.value] as [number, number]),
      effects: [[effect.id, false]],
    });
    const fit = ship(w, [[target.id, 7]]);
    fit.skills.set(carrierType.id, makeItem(w.data, carrierType.id));
    // ((5 × 2 ÷ 4) + 10 − 3) × 1.5 ÷ 2 × (1 + 100/100) = 14.25
    expect(getAttr(fit, fit.ship, target.id)).toBe(14.25);
  });

  it("lets a PostAssign discard everything computed before it", () => {
    const w = world();
    const target = w.attr({ stackable: true, highIsGood: true });
    const add = w.attr();
    const assign = w.attr();
    const effect = w.effect({
      modifiers: [
        mod({ func: "ItemModifier", domain: "ship", operation: Operator.ModAdd, modifiedAttrId: target.id, modifyingAttrId: add.id }),
        mod({ func: "ItemModifier", domain: "ship", operation: Operator.PostAssign, modifiedAttrId: target.id, modifyingAttrId: assign.id }),
      ],
    });
    const carrierType = w.type({ categoryId: CATEGORY.skill, attrs: [[add.id, 1000], [assign.id, 99]], effects: [[effect.id, false]] });
    const fit = ship(w, [[target.id, 5]]);
    fit.skills.set(carrierType.id, makeItem(w.data, carrierType.id));
    expect(getAttr(fit, fit.ship, target.id)).toBe(99);
  });

  it("picks the assign winner with max when highIsGood and min otherwise", () => {
    for (const [highIsGood, expected] of [[true, 80], [false, 20]] as const) {
      const w = world();
      const target = w.attr({ stackable: true, highIsGood });
      const low = w.attr();
      const high = w.attr();
      const effect = w.effect({
        modifiers: [
          mod({ func: "ItemModifier", domain: "ship", operation: Operator.PostAssign, modifiedAttrId: target.id, modifyingAttrId: low.id }),
          mod({ func: "ItemModifier", domain: "ship", operation: Operator.PostAssign, modifiedAttrId: target.id, modifyingAttrId: high.id }),
        ],
      });
      const carrierType = w.type({ categoryId: CATEGORY.skill, attrs: [[low.id, 20], [high.id, 80]], effects: [[effect.id, false]] });
      const fit = ship(w, [[target.id, 50]]);
      fit.skills.set(carrierType.id, makeItem(w.data, carrierType.id));
      expect(getAttr(fit, fit.ship, target.id)).toBe(expected);
    }
  });

  it("skips a division by zero instead of producing Infinity", () => {
    const w = world();
    const target = w.attr({ stackable: true });
    const zero = w.attr();
    const effect = w.effect({
      modifiers: [mod({ func: "ItemModifier", domain: "ship", operation: Operator.PostDiv, modifiedAttrId: target.id, modifyingAttrId: zero.id })],
    });
    const carrierType = w.type({ categoryId: CATEGORY.skill, attrs: [[zero.id, 0]], effects: [[effect.id, false]] });
    const fit = ship(w, [[target.id, 40]]);
    fit.skills.set(carrierType.id, makeItem(w.data, carrierType.id));
    expect(getAttr(fit, fit.ship, target.id)).toBe(40);
  });
});

/** Builds a fit whose hull has `base` for a stackable/unstackable attribute, modified by `percents`
 *  carried by one item of category `categoryId`. */
function percentFit(categoryId: number, stackable: boolean, base: number, percents: number[]) {
  const w = world();
  const target = w.attr({ stackable, highIsGood: true });
  const sources = percents.map((p) => ({ attr: w.attr(), value: p }));
  const effect = w.effect({
    modifiers: sources.map((s) => mod({
      func: "ItemModifier", domain: "ship", operation: Operator.PostPercent,
      modifiedAttrId: target.id, modifyingAttrId: s.attr.id,
    })),
  });
  const carrierType = w.type({
    categoryId, effects: [[effect.id, false], [EFFECT.online, false]],
    attrs: sources.map((s) => [s.attr.id, s.value] as [number, number]),
  });
  w.effect({ id: EFFECT.online, categoryId: 4, state: State.Online });
  const fit = ship(w, [[target.id, base]]);
  const carrier = makeItem(w.data, carrierType.id, { state: State.Online });
  switch (categoryId) {
    case CATEGORY.ship: fit.ship.effects.set(effect.id, false); for (const s of sources) fit.ship.attrs.set(s.attr.id, s.value); break;
    case CATEGORY.skill: fit.skills.set(carrierType.id, carrier); break;
    case CATEGORY.implant: fit.implants.push(carrier); break;
    case CATEGORY.charge: {
      const holder = makeItem(w.data, w.type({ effects: [[EFFECT.hiPower, false]] }).id, { state: State.Online });
      attachCharge(holder, carrier);
      addModule(fit, holder, "high", 0);
      break;
    }
    default: addModule(fit, carrier, categoryId === CATEGORY.subsystem ? "subsystem" : "low", 0);
  }
  return { fit, target };
}

describe("stacking penalty", () => {
  it("leaves a stackable attribute alone", () => {
    const { fit, target } = percentFit(CATEGORY.module, true, 100, [20, 50, -90, -25, 400]);
    expect(getAttr(fit, fit.ship, target.id)).toBeCloseTo(67.5, 10);
  });

  it("penalises an unstackable attribute (EOS's postPercent fixture)", () => {
    const { fit, target } = percentFit(CATEGORY.module, false, 100, [20, 50, -90, -25, 400]);
    expect(getAttr(fit, fit.ship, target.id)).toBeCloseTo(62.549783181488586, 10);
  });

  it("gives two +10 % modules 119.56, not 121", () => {
    const { fit, target } = percentFit(CATEGORY.module, false, 100, [10, 10]);
    expect(getAttr(fit, fit.ship, target.id)).toBeCloseTo(119.56031978880436, 10);
  });

  it("exempts ship, charge, skill, implant and subsystem carriers", () => {
    for (const categoryId of [CATEGORY.ship, CATEGORY.charge, CATEGORY.skill, CATEGORY.implant, CATEGORY.subsystem]) {
      const { fit, target } = percentFit(categoryId, false, 100, [50, 100]);
      expect(getAttr(fit, fit.ship, target.id)).toBe(300);
    }
  });

  it("does penalise a module carrier with the same two modifiers", () => {
    const { fit, target } = percentFit(CATEGORY.module, false, 100, [50, 100]);
    expect(getAttr(fit, fit.ship, target.id)).toBeCloseTo(286.91199808003977, 10);
  });

  it("never penalises ModAdd, whatever the carrier", () => {
    const w = world();
    const target = w.attr({ stackable: false, highIsGood: true });
    const source = w.attr();
    const effect = w.effect({
      modifiers: [
        mod({ func: "ItemModifier", domain: "ship", operation: Operator.ModAdd, modifiedAttrId: target.id, modifyingAttrId: source.id }),
        mod({ func: "ItemModifier", domain: "ship", operation: Operator.ModAdd, modifiedAttrId: target.id, modifyingAttrId: source.id }),
      ],
    });
    const carrierType = w.type({ categoryId: CATEGORY.module, attrs: [[source.id, 10]], effects: [[effect.id, false]] });
    const fit = ship(w, [[target.id, 100]]);
    addModule(fit, makeItem(w.data, carrierType.id, { state: State.Online }), "low", 0);
    expect(getAttr(fit, fit.ship, target.id)).toBe(120);
  });
});

describe("skill-level recursion", () => {
  it("resolves the two-effect pattern through the carrier's calculated value", () => {
    const w = world();
    const cpuOutput = w.attr({ id: ATTR.cpuOutput, stackable: true, highIsGood: true });
    const skillLevel = w.attr({ id: ATTR.skillLevel, stackable: true, highIsGood: true });
    const bonus = w.attr({ stackable: true, highIsGood: true });
    const scaler = w.effect({ modifiers: [mod({ func: "ItemModifier", domain: "self", operation: Operator.PreMul, modifiedAttrId: bonus.id, modifyingAttrId: skillLevel.id })] });
    const applier = w.effect({ modifiers: [mod({ func: "ItemModifier", domain: "ship", operation: Operator.PostPercent, modifiedAttrId: cpuOutput.id, modifyingAttrId: bonus.id })] });
    const skillType = w.type({ categoryId: CATEGORY.skill, attrs: [[bonus.id, 5], [skillLevel.id, 0]], effects: [[scaler.id, false], [applier.id, false]] });
    const fit = ship(w, [[cpuOutput.id, 130]]);
    const skill = makeItem(w.data, skillType.id);
    skill.attrs.set(skillLevel.id, 5);
    fit.skills.set(skillType.id, skill);
    expect(getAttr(fit, skill, bonus.id)).toBe(25);
    expect(getAttr(fit, fit.ship, cpuOutput.id)).toBe(162.5);
  });
});

describe("capping and rounding", () => {
  it("caps to maxAttributeId's value on the same item", () => {
    const w = world();
    const cap = w.attr({ stackable: true, highIsGood: true });
    const target = w.attr({ stackable: true, highIsGood: true, maxAttributeId: cap.id });
    const source = w.attr();
    const effect = w.effect({ modifiers: [mod({ func: "ItemModifier", domain: "ship", operation: Operator.PostPercent, modifiedAttrId: target.id, modifyingAttrId: source.id })] });
    const carrierType = w.type({ categoryId: CATEGORY.skill, attrs: [[source.id, 100]], effects: [[effect.id, false]] });
    const fit = ship(w, [[target.id, 100], [cap.id, 150]]);
    fit.skills.set(carrierType.id, makeItem(w.data, carrierType.id));
    expect(getAttr(fit, fit.ship, target.id)).toBe(150);
  });

  it("leaves a value below the cap alone", () => {
    const w = world();
    const cap = w.attr({ stackable: true, highIsGood: true });
    const target = w.attr({ stackable: true, highIsGood: true, maxAttributeId: cap.id });
    const fit = ship(w, [[target.id, 100], [cap.id, 150]]);
    expect(getAttr(fit, fit.ship, target.id)).toBe(100);
  });

  it("rounds cpu, power, cpuOutput and powerOutput to 2 dp and nothing else", () => {
    const w = world();
    const cpu = w.attr({ id: ATTR.cpu, stackable: true, highIsGood: false });
    const other = w.attr({ stackable: true, highIsGood: true });
    const three = w.attr();
    const effect = w.effect({
      modifiers: [
        mod({ func: "ItemModifier", domain: "ship", operation: Operator.PostDiv, modifiedAttrId: cpu.id, modifyingAttrId: three.id }),
        mod({ func: "ItemModifier", domain: "ship", operation: Operator.PostDiv, modifiedAttrId: other.id, modifyingAttrId: three.id }),
      ],
    });
    const carrierType = w.type({ categoryId: CATEGORY.skill, attrs: [[three.id, 3]], effects: [[effect.id, false]] });
    const fit = ship(w, [[cpu.id, 10], [other.id, 10]]);
    fit.skills.set(carrierType.id, makeItem(w.data, carrierType.id));
    expect(getAttr(fit, fit.ship, cpu.id)).toBe(3.33);
    expect(getAttr(fit, fit.ship, other.id)).toBe(3.3333333333333326);
  });
});

describe("memoisation", () => {
  it("recomputes only after clearMemo", () => {
    const w = world();
    const target = w.attr({ stackable: true, highIsGood: true });
    const source = w.attr();
    w.effect({ id: EFFECT.online, categoryId: 4, state: State.Online });
    const boost = w.effect({
      categoryId: 4, state: State.Online,
      modifiers: [mod({ func: "ItemModifier", domain: "ship", operation: Operator.ModAdd, modifiedAttrId: target.id, modifyingAttrId: source.id })],
    });
    const carrierType = w.type({ categoryId: CATEGORY.module, attrs: [[source.id, 10]], effects: [[boost.id, false], [EFFECT.online, false]] });
    const fit = ship(w, [[target.id, 100]]);
    const module = makeItem(w.data, carrierType.id, { state: State.Online });
    addModule(fit, module, "low", 0);
    expect(getAttr(fit, fit.ship, target.id)).toBe(110);
    module.state = State.Offline;
    expect(getAttr(fit, fit.ship, target.id)).toBe(110);   // still memoised
    clearMemo(fit);
    expect(getAttr(fit, fit.ship, target.id)).toBe(100);
  });

  it("detects a cycle instead of recursing for ever", () => {
    const w = world();
    const target = w.attr({ stackable: true, highIsGood: true });
    const effect = w.effect({ modifiers: [mod({ func: "ItemModifier", domain: "self", operation: Operator.ModAdd, modifiedAttrId: target.id, modifyingAttrId: target.id })] });
    const hull = w.type({ categoryId: CATEGORY.ship, attrs: [[target.id, 10]], effects: [[effect.id, false]] });
    const fit = createFit(w.data, makeItem(w.data, hull.id));
    expect(() => getAttr(fit, fit.ship, target.id)).toThrow(DogmaCycleError);
    // The sentinel must be cleared again, so a second call fails the same way rather than returning null.
    expect(() => getAttr(fit, fit.ship, target.id)).toThrow(DogmaCycleError);
  });
});

describe("explain", () => {
  it("returns every applied modifier with its carrier, operator, raw and normalised value", () => {
    const { fit, target } = percentFit(CATEGORY.module, false, 100, [50, 100]);
    const applied = explain(fit, fit.ship, target.id);
    expect(applied).toHaveLength(2);
    expect(applied.map((a) => a.rawValue).sort((a, b) => a - b)).toEqual([50, 100]);
    expect(applied.map((a) => a.value).sort((a, b) => a - b)).toEqual([0.5, 1]);
    expect(applied.every((a) => a.operator === Operator.PostPercent)).toBe(true);
    expect(applied.every((a) => a.penalised)).toBe(true);
    expect(applied.every((a) => a.carrier === fit.modules[0].item)).toBe(true);
  });

  it("marks a penalty-immune carrier's modifiers as unpenalised", () => {
    const { fit, target } = percentFit(CATEGORY.implant, false, 100, [50]);
    expect(explain(fit, fit.ship, target.id).map((a) => a.penalised)).toEqual([false]);
  });

  it("returns an empty list for an unmodified attribute", () => {
    const w = world();
    const target = w.attr({ stackable: true });
    const fit = ship(w, [[target.id, 100]]);
    expect(explain(fit, fit.ship, target.id)).toEqual([]);
  });
});

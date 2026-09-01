import { describe, it, expect } from "vitest";
import { fixtureData } from "./fixture.js";
import { fitStats } from "../../src/lib/dogma/index.js";
import { buildFit, allSkills } from "./build-fit.js";
import {
  deserialiseMeta, deserialiseTypes, dogmaDataFrom, serialiseMeta, serialiseTypes,
} from "../../src/lib/dogma/serialize.js";

const data = fixtureData("rifter");

/** What actually crosses the wire — JSON, not the objects we happened to build. */
function overTheWire<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

describe("the dogma wire format", () => {
  it("round-trips the meta half through JSON", () => {
    const meta = deserialiseMeta(overTheWire(serialiseMeta(data, 3484357)));
    expect(meta.build).toBe(3484357);
    expect(meta.attributes.size).toBe(data.attributes.size);
    expect(meta.effects.size).toBe(data.effects.size);
    expect(meta.groups.size).toBe(data.groups.size);
    expect(meta.attributes.get(50)).toEqual(data.attributes.get(50));
    expect(meta.effects.get(12)?.modifiers).toEqual(data.effects.get(12)?.modifiers);
  });

  it("round-trips the types half through JSON, Maps and all", () => {
    const types = deserialiseTypes(overTheWire(serialiseTypes(data)));
    expect(types.size).toBe(data.types.size);
    const rifter = types.get(587)!;
    expect(rifter.name).toBe("Rifter");
    expect(rifter.attrs).toBeInstanceOf(Map);
    expect(rifter.attrs.get(48)).toBe(data.types.get(587)!.attrs.get(48));
    expect(rifter.effects).toBeInstanceOf(Map);
  });

  it("reassembles a DogmaData the engine computes identically on", () => {
    const meta = deserialiseMeta(overTheWire(serialiseMeta(data, 3484357)));
    const types = deserialiseTypes(overTheWire(serialiseTypes(data)));
    const rebuilt = dogmaDataFrom(meta, types);

    const before = fitStats(buildFit(data, 587, {
      modules: [[2889, "high", 0], [2048, "low", 0]], skills: allSkills(data, 5),
    }));
    const after = fitStats(buildFit(rebuilt, 587, {
      modules: [[2889, "high", 0], [2048, "low", 0]], skills: allSkills(rebuilt, 5),
    }));
    expect(after.cpu).toEqual(before.cpu);
    expect(after.power).toEqual(before.power);
    expect(after.slots).toEqual(before.slots);
    expect(after.cpu.output).toBe(162.5);
  });

  it("shares the meta maps rather than copying them", () => {
    const meta = deserialiseMeta(serialiseMeta(data, 1));
    const rebuilt = dogmaDataFrom(meta, new Map());
    expect(rebuilt.attributes).toBe(meta.attributes);
    expect(rebuilt.types.size).toBe(0);
  });
});

import { describe, it, expect } from "vitest";
import {
  KILLMAIL_SLOT_ORDER, SLOT_TITLES, fitFlagOfFlag, slotOfFlag,
} from "../../src/lib/combat/flags.js";

describe("slotOfFlag", () => {
  it("maps every band from spec §6 including both boundaries", () => {
    expect([11, 14, 18].map(slotOfFlag)).toEqual(["low", "low", "low"]);
    expect([19, 22, 26].map(slotOfFlag)).toEqual(["mid", "mid", "mid"]);
    expect([27, 30, 34].map(slotOfFlag)).toEqual(["high", "high", "high"]);
    expect([92, 93, 94].map(slotOfFlag)).toEqual(["rig", "rig", "rig"]);
    expect([125, 128, 132].map(slotOfFlag)).toEqual(["subsystem", "subsystem", "subsystem"]);
    expect(slotOfFlag(87)).toBe("drone");
    expect(slotOfFlag(5)).toBe("cargo");
    expect(slotOfFlag(89)).toBe("implant");
    expect(slotOfFlag(158)).toBe("fighter");
  });
  it("calls anything outside those bands other", () => {
    expect([0, 4, 10, 35, 91, 95, 124, 133, 999].map(slotOfFlag)).toEqual(
      ["other", "other", "other", "other", "other", "other", "other", "other", "other"]);
  });
  it("names every slot it can return, in display order", () => {
    expect(KILLMAIL_SLOT_ORDER).toEqual(
      ["high", "mid", "low", "rig", "subsystem", "drone", "fighter", "implant", "cargo", "other"]);
    for (const slot of KILLMAIL_SLOT_ORDER) expect(SLOT_TITLES[slot]).toBeTruthy();
    expect(SLOT_TITLES.subsystem).toBe("Subsystems");
  });
});

describe("fitFlagOfFlag", () => {
  it("turns a numeric flag into the phase-5 fitting flag with the right index", () => {
    expect(fitFlagOfFlag(27)).toBe("HiSlot0");
    expect(fitFlagOfFlag(34)).toBe("HiSlot7");
    expect(fitFlagOfFlag(19)).toBe("MedSlot0");
    expect(fitFlagOfFlag(26)).toBe("MedSlot7");
    expect(fitFlagOfFlag(11)).toBe("LoSlot0");
    expect(fitFlagOfFlag(18)).toBe("LoSlot7");
    expect(fitFlagOfFlag(92)).toBe("RigSlot0");
    expect(fitFlagOfFlag(94)).toBe("RigSlot2");
    expect(fitFlagOfFlag(125)).toBe("SubSystemSlot0");
    expect(fitFlagOfFlag(132)).toBe("SubSystemSlot7");
    expect(fitFlagOfFlag(87)).toBe("DroneBay");
    expect(fitFlagOfFlag(5)).toBe("Cargo");
  });
  it("returns null for anything a fit cannot hold", () => {
    for (const flag of [0, 89, 158, 999]) expect(fitFlagOfFlag(flag)).toBeNull();
  });
});

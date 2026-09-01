import { describe, it, expect } from "vitest";
import { flagLabel, refTypeLabel } from "../../src/lib/view/enums.js";

describe("flagLabel", () => {
  it("renumbers the slot flags from one", () => {
    expect(flagLabel("HiSlot0")).toBe("High slot 1");
    expect(flagLabel("HiSlot3")).toBe("High slot 4");
    expect(flagLabel("MedSlot7")).toBe("Mid slot 8");
    expect(flagLabel("LoSlot0")).toBe("Low slot 1");
    expect(flagLabel("RigSlot2")).toBe("Rig slot 3");
    expect(flagLabel("SubSystemSlot1")).toBe("Subsystem slot 2");
    expect(flagLabel("FighterTube0")).toBe("Fighter tube 1");
  });
  it("names the well-known holds", () => {
    expect(flagLabel("Cargo")).toBe("Cargo hold");
    expect(flagLabel("Hangar")).toBe("Hangar");
    expect(flagLabel("HangarAll")).toBe("Hangar");
    expect(flagLabel("DroneBay")).toBe("Drone bay");
    expect(flagLabel("FleetHangar")).toBe("Fleet hangar");
    expect(flagLabel("AssetSafety")).toBe("Asset safety");
    expect(flagLabel("Implant")).toBe("Implant");
  });
  it("makes the Specialized* holds readable", () => {
    expect(flagLabel("SpecializedOreHold")).toBe("Ore hold");
    expect(flagLabel("SpecializedLargeShipHold")).toBe("Large ship hold");
    expect(flagLabel("SpecializedPlanetaryCommoditiesHold")).toBe("Planetary commodities hold");
    expect(flagLabel("SpecializedFuelBay")).toBe("Fuel bay");
  });
  it("returns the raw value for a member CCP added after this was written", () => {
    // location_flag grows without a compatibility-date bump (research §8a).
    expect(flagLabel("BrandNewHold2027")).toBe("BrandNewHold2027");
    expect(flagLabel("")).toBe("");
  });
});

describe("refTypeLabel", () => {
  it("turns snake_case into a sentence", () => {
    expect(refTypeLabel("market_transaction")).toBe("Market transaction");
    expect(refTypeLabel("player_donation")).toBe("Player donation");
    expect(refTypeLabel("corporation_account_withdrawal")).toBe("Corporation account withdrawal");
    expect(refTypeLabel("bounty_prizes")).toBe("Bounty prizes");
  });
  it("survives a ref_type nobody has seen before", () => {
    expect(refTypeLabel("brand_new_ref_type_2027")).toBe("Brand new ref type 2027");
    expect(refTypeLabel("")).toBe("");
  });
});

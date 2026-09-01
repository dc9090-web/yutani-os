import { describe, it, expect } from "vitest";
import { classifyLocation, unknownStructureLabel } from "../../src/lib/names/ranges.js";

describe("classifyLocation", () => {
  it("maps the ESI id ranges", () => {
    expect(classifyLocation(30000142)).toBe("system");
    expect(classifyLocation(39999999)).toBe("system");
    expect(classifyLocation(60003760)).toBe("station");
    expect(classifyLocation(69999999)).toBe("station");
    expect(classifyLocation(1035466617946)).toBe("structure");
    expect(classifyLocation(1000000000000)).toBe("structure");
  });
  it("calls anything outside those ranges unknown", () => {
    expect(classifyLocation(29999999)).toBe("unknown");
    expect(classifyLocation(40000000)).toBe("unknown");
    expect(classifyLocation(70000000)).toBe("unknown");
    expect(classifyLocation(0)).toBe("unknown");
  });
  it("has no upper bound on the structure range", () => {
    expect(classifyLocation(1023456789012)).toBe("structure");
  });
});

describe("unknownStructureLabel", () => {
  it("shows the full id the way the UI shows it", () => {
    expect(unknownStructureLabel(1035466617946)).toBe("Unknown structure (1035466617946)");
  });
});

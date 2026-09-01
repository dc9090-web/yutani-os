import { describe, it, expect } from "vitest";
import { NAV_ITEMS, isNavActive } from "../src/config/nav.js";

describe("nav", () => {
  it("has the seven fixed destinations in order", () => {
    expect(NAV_ITEMS.map((i) => i.key)).toEqual(["overview", "skills", "ships", "fitting", "assets", "wallet", "combat"]);
  });
  it("overview is active only on /", () => {
    const overview = NAV_ITEMS[0];
    expect(isNavActive(overview, "/")).toBe(true);
    expect(isNavActive(overview, "/ships")).toBe(false);
  });
  it("section items are active on their prefix", () => {
    const ships = NAV_ITEMS.find((i) => i.key === "ships")!;
    expect(isNavActive(ships, "/ships")).toBe(true);
    expect(isNavActive(ships, "/ships/123")).toBe(true);
    expect(isNavActive(ships, "/skills")).toBe(false);
  });
});

import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { fixtureData } from "../dogma/fixture.js";
import { computeEditor } from "../../src/lib/fits/editor-view.js";
import type { FitDoc } from "../../src/lib/fits/doc.js";
import { StatsPanel } from "../../src/app/fitting/StatsPanel.js";

const data = fixtureData("rifter");
const DOC: FitDoc = {
  id: 1, name: "Cheap Rifter", description: "", shipTypeId: 587, characterId: 669539978,
  items: [{ typeId: 2889, quantity: 1, flag: "HiSlot0", chargeTypeId: null, state: "active" }],
};
// CPU Management V and Power Grid Management V only: the hull's own skill is missing.
const ctx = { data, skills: new Map([[3426, 5], [3413, 5]]), implants: [] };
// The editor always passes level: null (Decision 12) — the pilot can change without a page load.
const BONUSES = [{ skill: "Minmatar Frigate", level: null, text: "7.5% bonus to Small Projectile Turret damage" }];

function renderPanel(skillsSynced = true) {
  const result = computeEditor(DOC, ctx, new Map());
  if (result.kind !== "ok") throw new Error("expected ok");
  render(<StatsPanel view={result.view} bonuses={BONUSES} skillsSynced={skillsSynced} />);
}

describe("StatsPanel", () => {
  it("shows the three gauges with real numbers and the slot counters", () => {
    renderPanel();
    expect(screen.getByText("9.00 / 162.50 tf")).toBeInTheDocument();
    expect(screen.getByText("4.00 / 51.25 MW")).toBeInTheDocument();
    expect(screen.getByText("0.00 / 400.00")).toBeInTheDocument();
    // "1 / 3" is both the High counter and the Turrets counter.
    expect(screen.getAllByText("1 / 3")).toHaveLength(2);
    expect(screen.getByText("0 / 4")).toBeInTheDocument();          // Low
  });

  it("lists the problems and the missing skills with have → need", () => {
    renderPanel();
    // The only table in the panel is the missing-skill list.
    const missing = screen.getByRole("table");
    expect(within(missing).getByText("Minmatar Frigate")).toBeInTheDocument();
    expect(within(missing).getAllByText("0 → 1").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Skill").length).toBeGreaterThan(0);  // the problem badges
  });

  it("shows the hull bonuses and the estimated value", () => {
    renderPanel();
    // "Minmatar Frigate" is also the Rifter's own missing-skill row, so scope to the bonus card —
    // the same within(...) pattern the missing-skills test above uses.
    const bonuses = screen.getByText("Ship bonuses").closest(".card") as HTMLElement;
    expect(within(bonuses).getByText("Minmatar Frigate")).toBeInTheDocument();
    expect(within(bonuses).getByText("7.5% bonus to Small Projectile Turret damage")).toBeInTheDocument();
    expect(screen.getByText("0 ISK")).toBeInTheDocument();           // no prices were supplied
    expect(screen.getByText("2 items unpriced")).toBeInTheDocument();
  });

  it("warns when no skills are synced", () => {
    renderPanel(false);
    expect(screen.getByText(/No skills synced yet/)).toBeInTheDocument();
  });

});

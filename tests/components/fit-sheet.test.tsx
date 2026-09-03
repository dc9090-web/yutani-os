import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { FitSheet } from "../../src/app/ships/FitSheet.js";
import { CouldNotCompute } from "../../src/app/ships/CouldNotCompute.js";
import type { FitSheetView } from "../../src/lib/view/fit-sheet.js";

const view: FitSheetView = {
  title: "Scarlet Dart", subtitle: "Jita IV - Moon 4 - Caldari Navy Assembly Plant",
  typeId: 587, typeName: "Rifter", renderUrl: "https://images.evetech.net/types/587/render?size=128",
  skillsSynced: true,
  bonuses: [{ skill: "Minmatar Frigate", level: 4, text: "7.5% bonus to Small Projectile Turret rate of fire" }],
  gauges: [
    { label: "CPU", unit: "tf", used: 121.5, output: 162.5, text: "121.50 / 162.50 tf", percent: 74.8, over: false },
    { label: "Powergrid", unit: "MW", used: 60, output: 51.25, text: "60.00 / 51.25 MW", percent: 100, over: true },
    { label: "Calibration", unit: "", used: 0, output: 400, text: "0 / 400 ", percent: 0, over: false },
  ],
  slots: [
    {
      slot: "high", title: "High", used: 1, total: 4,
      rows: [{
        key: "high:0", name: "200mm AutoCannon II", typeId: 2889, charge: "Hail S",
        desc: "The 200mm is a powerful autocannon.", chargeDesc: "Hail is an attempt to combine penetration with versatility.",
        cpu: "6.75", power: "12.80", state: "Active",
        cpuExplain: [{ carrier: "Weapon Upgrades", operator: "%", value: "-25", penalised: false }],
        powerExplain: [],
      }],
    },
    { slot: "mid", title: "Mid", used: 0, total: 3, rows: [] },
    { slot: "low", title: "Low", used: 0, total: 3, rows: [] },
    { slot: "rig", title: "Rigs", used: 0, total: 3, rows: [] },
    { slot: "subsystem", title: "Subsystems", used: 0, total: 0, rows: [] },
  ],
  counters: [
    { label: "High", used: 1, total: 4, over: false },
    { label: "Turrets", used: 5, total: 3, over: true },
  ],
  problems: [
    { kind: "power", label: "Powergrid", text: "8.75 MW over the ship's output" },
    { kind: "skill", label: "Skill", text: "200mm AutoCannon II — Small Autocannon Specialization I required" },
  ],
  missing: [{ skillTypeId: 3329, name: "Minmatar Frigate", have: 0, need: 1 }],
  cargo: [{ key: "Cargo:12608:0", name: "Hail S", quantity: 1000, value: "100,000.00 ISK", desc: "Hail is an attempt to combine penetration with versatility." }],
  drones: [{ key: "DroneBay:2456:0", name: "Hobgoblin II", quantity: 5, value: null, desc: null }],
  unfittable: [],
  unknown: [{ key: "HiSlot1:99999:0", name: "Unknown type (99999)", quantity: 1, value: null, desc: null }],
  value: {
    total: "13,100,100.00 ISK",
    lines: [{ label: "Hull", value: "8,000,000.00 ISK" }, { label: "Cargo", value: "100,000.00 ISK" }],
    unpriced: "1 item unpriced",
  },
};

describe("FitSheet", () => {
  it("renders the header, the render image and the hull bonuses with the character's level", () => {
    const { container } = render(<FitSheet view={view} />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Scarlet Dart");
    expect(screen.getByText(/Caldari Navy Assembly Plant/)).toBeInTheDocument();
    expect(container.querySelector("img")).toHaveAttribute("src", "https://images.evetech.net/types/587/render?size=128");
    expect(screen.getByText(/Minmatar Frigate IV/)).toBeInTheDocument();
    expect(screen.getByText(/7.5% bonus to Small Projectile Turret rate of fire/)).toBeInTheDocument();
  });

  it("draws three gauges and marks the over-budget one", () => {
    const { container } = render(<FitSheet view={view} />);
    const gauges = container.querySelectorAll(".gauge");
    expect(gauges).toHaveLength(3);
    expect(gauges[1]).toHaveClass("over");
    expect(screen.getByText("121.50 / 162.50 tf")).toBeInTheDocument();
  });

  it("lists the module with its charge, both resource figures and its state", () => {
    render(<FitSheet view={view} />);
    expect(screen.getByText("200mm AutoCannon II")).toBeInTheDocument();
    expect(screen.getByText("Hail S")).toBeInTheDocument();         // the charge under its turret
    expect(screen.getByText("12.80")).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
    // The CPU cell has modifiers, so it is a popover button; powergrid has none, so it is plain text.
    fireEvent.click(screen.getByRole("button", { name: /CPU 6.75/ }));
    expect(screen.getByText("Weapon Upgrades")).toBeInTheDocument();
  });

  it("puts each item's description on the name as hover text, and none when the SDE has none", () => {
    const { container } = render(<FitSheet view={view} />);
    expect(container.querySelector(".sheet-mod")).toHaveAttribute("data-desc", "The 200mm is a powerful autocannon.");
    expect(container.querySelector(".sheet-mod-charge")).toHaveAttribute("data-desc", "Hail is an attempt to combine penetration with versatility.");
    expect(screen.getByText("Hail S ×1000")).toHaveAttribute("data-desc");
    expect(screen.getByText("Hobgoblin II ×5")).not.toHaveAttribute("data-desc");
  });

  it("shows the slot and hardpoint counters, flagging the over-full one", () => {
    const { container } = render(<FitSheet view={view} />);
    expect(container.querySelectorAll(".counter-label")[0]?.textContent).toBe("High");   // scoped: the slot column title also starts with "High"
    expect(screen.getByText("5 / 3")).toBeInTheDocument();
    expect(container.querySelectorAll(".counter.over")).toHaveLength(1);
  });

  it("lists problems and missing skills as have → need", () => {
    render(<FitSheet view={view} />);
    expect(screen.getByText("8.75 MW over the ship's output")).toBeInTheDocument();
    expect(screen.getByText(/Small Autocannon Specialization I required/)).toBeInTheDocument();
    expect(screen.getByText("Minmatar Frigate")).toBeInTheDocument();
    expect(screen.getByText("0 → 1")).toBeInTheDocument();
  });

  it("lists cargo, drones, unknown types and the estimated value", () => {
    render(<FitSheet view={view} />);
    expect(screen.getByText("Hail S ×1000")).toBeInTheDocument();
    expect(screen.getByText("Hobgoblin II ×5")).toBeInTheDocument();
    expect(screen.getByText("Unknown type (99999) ×1")).toBeInTheDocument();
    expect(screen.getByText("13,100,100.00 ISK")).toBeInTheDocument();
    expect(screen.getByText("1 item unpriced")).toBeInTheDocument();
  });

  it("says so when no problems, no missing skills and no skills synced", () => {
    render(<FitSheet view={{
      ...view, skillsSynced: false, problems: [], missing: [], cargo: [], drones: [], unknown: [],
    }} />);
    expect(screen.getByText(/No skills synced yet/)).toBeInTheDocument();
    expect(screen.getByText("No problems — this fit is legal.")).toBeInTheDocument();
    expect(screen.getByText("Every skill for this fit is trained.")).toBeInTheDocument();
    expect(screen.getByText("Nothing in the cargo hold or drone bay.")).toBeInTheDocument();
  });
});

describe("CouldNotCompute", () => {
  it("names the fit and offers a way back", () => {
    render(<CouldNotCompute title="Scarlet Dart" />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Scarlet Dart");
    expect(screen.getByText(/Could not compute/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Ships/ })).toHaveAttribute("href", "/ships");
  });
});

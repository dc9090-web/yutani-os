import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { FitSheet } from "../../src/app/ships/FitSheet.js";
import { CouldNotCompute } from "../../src/app/ships/CouldNotCompute.js";
import type { FitSheetView } from "../../src/lib/view/fit-sheet.js";

const view: FitSheetView = {
  title: "Scarlet Dart", subtitle: "Jita IV - Moon 4 - Caldari Navy Assembly Plant",
  typeId: 587, typeName: "Rifter", renderUrl: "https://images.evetech.net/types/587/render?size=128",
  skillsSynced: true,
  stats: {
    capacitor: { title: "Capacitor", headline: "Stable 68%", ok: true, rows: [{ label: "Capacity", value: "1,687 GJ / 4m 3s" }, { label: "Δ", value: "+0.1 GJ/s (0.3%)" }] },
    offense: { title: "Offense", headline: "863.2 dps", rows: [{ label: "Weapons", value: "797.1 dps" }, { label: "Volley", value: "1,349 HP" }] },
    defense: {
      title: "Defense", headline: "37,445 ehp", recharge: "28.0 hp/s", rows: [],
      layers: [
        { layer: "Shield", hp: "12,000 hp", note: "1,050 s", resists: [57, 48, 48, 57] },
        { layer: "Armor", hp: "3,125 hp", note: null, resists: [83, 59, 37, 24] },
        { layer: "Hull", hp: "2,500 hp", note: null, resists: [60, 60, 60, 60] },
      ],
    },
    targeting: { title: "Targeting", headline: "40.6 km", rows: [{ label: "Sensor strength", value: "20.4 points (Ladar)" }, { label: "Max targets", value: "6×" }] },
    navigation: { title: "Navigation", headline: "289.1 m/s", rows: [{ label: "Mass", value: "13,800.0 t" }, { label: "Align time", value: "5.23 s" }] },
    drones: { title: "Drones", headline: "62.2 dps", rows: [{ label: "Bandwidth", value: "20 / 20 Mbit/s" }, { label: "In bay", value: "2 drones" }] },
    bays: [{ label: "Cargo hold", value: "166.5 / 450 m³" }, { label: "Drone bay", value: "40 / 40 m³" }],
  },
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
  cargo: [{ key: "Cargo:12608:0", typeId: 12608, name: "Hail S", quantity: 1000, value: "100,000.00 ISK", desc: "Hail is an attempt to combine penetration with versatility." }],
  drones: [{ key: "DroneBay:2456:0", typeId: 2456, name: "Hobgoblin II", quantity: 5, value: null, desc: null }],
  unfittable: [],
  unknown: [{ key: "HiSlot1:99999:0", typeId: 99999, name: "Unknown type (99999)", quantity: 1, value: null, desc: null }],
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
    const { container } = render(<FitSheet view={view} />);
    expect(screen.getByText("200mm AutoCannon II")).toBeInTheDocument();
    expect(container.querySelector(".sheet-mod-charge")).toHaveTextContent("Hail S");   // the charge under its turret
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
    expect(screen.getByText("Hail S", { selector: ".sheet-entry-name" }).closest(".sheet-entry")).toHaveAttribute("data-desc");
    expect(screen.getByText("Hobgoblin II").closest(".sheet-entry")).not.toHaveAttribute("data-desc");
  });

  it("renders the ship stats panel: section headlines, rows, the resist table and the bays", () => {
    const { container } = render(<FitSheet view={view} />);
    expect(screen.getByText("Stable 68%")).toHaveClass("badge", "ok");
    expect(screen.getByText("863.2 dps")).toBeInTheDocument();
    expect(screen.getByText("37,445 ehp")).toBeInTheDocument();
    expect(screen.getByText("28.0 hp/s")).toBeInTheDocument();
    const cells = container.querySelectorAll(".resist-cell");
    expect(cells).toHaveLength(12);
    expect(cells[0]).toHaveClass("em");
    expect(cells[0].querySelector(".resist-fill")).toHaveStyle({ width: "57%" });
    expect(cells[0].textContent).toBe("57%");
    expect(screen.getByText("12,000 hp")).toBeInTheDocument();
    expect(screen.getByText("1,050 s")).toBeInTheDocument();
    expect(screen.getByText("20.4 points (Ladar)")).toBeInTheDocument();
    expect(screen.getByText("166.5 / 450 m³")).toBeInTheDocument();
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

  it("lists cargo, drones, unknown types and the estimated value, with icons and counts", () => {
    const { container } = render(<FitSheet view={view} />);
    const cargo = screen.getByText("Hail S", { selector: ".sheet-entry-name" }).closest(".sheet-entry")!;
    expect(cargo.querySelector("img")).toHaveAttribute("src", "https://images.evetech.net/types/12608/icon?size=32");
    expect(cargo).toHaveTextContent("Hail S×1000");
    expect(screen.getByText("Hobgoblin II").closest(".sheet-entry")).toHaveTextContent("×5");
    // A single item is just its name, and a type the SDE lacks gets no icon.
    const unknown = screen.getByText("Unknown type (99999)").closest(".sheet-entry")!;
    expect(unknown).not.toHaveTextContent("×");
    expect(unknown.querySelector("img")).toBeNull();
    expect(container.querySelectorAll(".sheet-entry img")).toHaveLength(2);
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

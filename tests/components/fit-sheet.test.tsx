import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { FitSheet } from "../../src/app/ships/FitSheet.js";
import { CouldNotCompute } from "../../src/app/ships/CouldNotCompute.js";
import type { FitSheetView } from "../../src/lib/view/fit-sheet.js";

const view: FitSheetView = {
  title: "Scarlet Dart",
  ship: { typeName: "Rifter", groupName: "Frigate", raceName: "Minmatar" },
  location: { system: { name: "Jita", sec: "0.9", secClass: "sec-high" }, place: "Jita IV - Moon 4 - Caldari Navy Assembly Plant", note: "in Small Standard Container" },
  typeId: 587, typeName: "Rifter", renderUrl: "https://images.evetech.net/types/587/render?size=128",
  skillsSynced: true,
  stats: {
    capacitor: { title: "Capacitor", headline: "Stable 68%", ok: true, rows: [{ label: "Capacity", value: "1,687 GJ / 4m 3s" }, { label: "Δ", value: "+0.1 GJ/s (0.3%)" }] },
    offense: { title: "Offense", headline: "863.2 dps", note: "1 weapon loaded with the best ammo in cargo", rows: [{ label: "Weapons", value: "797.1 dps" }, { label: "Volley", value: "1,349 HP" }] },
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
        key: "high:0", name: "200mm AutoCannon II", typeId: 2889, charge: "Hail S", chargeTypeId: 12608,
        desc: "The 200mm is a powerful autocannon.", chargeDesc: "Hail is an attempt to combine penetration with versatility.", chargeAssumed: true,
        range: { optimal: "600 m", falloff: "4.3 km" },
        state: "Active",
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
  ammo: [{ key: "ammo:12608", typeId: 12608, name: "Hail S", desc: "Hail is an attempt to combine penetration with versatility.", quantity: 1000, loadedIn: 1, range: { optimal: "600 m", falloff: "4.3 km" }, band: { label: "Short", level: 1, beyond: false, desc: "Reaches 4.9 km of this ship's 22.5 km lock range" }, order: 4857 }],
  cargo: [{ key: "Cargo:34:1", typeId: 34, name: "Tritanium", nickname: null, quantity: 5000, desc: null }],
  drones: [{ key: "DroneBay:2456:0", typeId: 2456, name: "Hobgoblin II", nickname: null, quantity: 5, desc: null }],
  unfittable: [],
  unknown: [{ key: "HiSlot1:99999:0", typeId: 99999, name: "Unknown type (99999)", nickname: null, quantity: 1, desc: null }],
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

  it("heads the sheet with the hull/race/class chips and the coloured location, bonuses at the foot", () => {
    const { container } = render(<FitSheet view={view} />);
    const head = container.querySelector(".fit-sheet-head")!;
    expect(head.querySelector(".pill.hull")).toHaveTextContent("Rifter");
    expect(head.querySelectorAll(".pill")).toHaveLength(3);
    const loc = head.querySelector(".fit-head-loc")!;
    expect(loc.querySelector(".sec-high")).toHaveTextContent("0.9");
    expect(loc).toHaveTextContent("0.9 Jita · Jita IV - Moon 4 - Caldari Navy Assembly Plant · in Small Standard Container");
    const cards = container.querySelectorAll(".fit-sheet > .card");
    expect(cards[cards.length - 1]).toHaveClass("fit-sheet-foot");
    expect(cards[cards.length - 1]).toHaveTextContent("Ship bonuses");
    expect(cards[cards.length - 1]).toHaveTextContent("Minmatar Frigate IV");
  });

  it("shows a saved fit's location as just the note", () => {
    const { container } = render(<FitSheet view={{ ...view, location: { system: null, place: null, note: "Saved fit" } }} />);
    expect(container.querySelector(".fit-head-loc")).toHaveTextContent(/^Saved fit$/);
  });

  it("draws three gauges and marks the over-budget one", () => {
    const { container } = render(<FitSheet view={view} />);
    const gauges = container.querySelectorAll(".gauge");
    expect(gauges).toHaveLength(3);
    expect(gauges[1]).toHaveClass("over");
    expect(screen.getByText("121.50 / 162.50 tf")).toBeInTheDocument();
  });

  it("lists the module with its charge, its optimal and falloff cells and its state, without CPU or PG", () => {
    const { container } = render(<FitSheet view={view} />);
    expect(screen.getByText("200mm AutoCannon II")).toBeInTheDocument();
    expect(container.querySelector(".sheet-mod-charge")).toHaveTextContent(/^Hail S$/);   // the charge under its turret; app-loaded is not flagged inline (the Offense note says so)
    expect(container.querySelector(".sheet-slot-head")).toHaveTextContent("ModuleOptimalFalloffState");
    // The ammo's own thumbnail sits in the icon column under the module's.
    expect(container.querySelector(".sheet-mod .charge-icon")).toHaveAttribute("src", "https://images.evetech.net/types/12608/icon?size=32");
    const cells = container.querySelectorAll(".sheet-slot-row .sheet-range");
    expect([...cells].map((c) => c.textContent)).toEqual(["600 m", "4.3 km"]);
    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /CPU/ })).toBeNull();
  });

  it("marks ammo that out-ranges the ship's lock with a glyph, still labelled Long", () => {
    const beyond = { ...view, ammo: [{ ...view.ammo[0], band: { label: "Long" as const, level: 3 as const, beyond: true, desc: "Reaches 45.0 km of this ship's 30.0 km lock range — further than it can target" } }] };
    const { container } = render(<FitSheet view={beyond} />);
    const pill = container.querySelector(".range-pill")!;
    expect(pill).toHaveClass("level-3");
    expect(pill).toHaveTextContent(/^Long$/);
    expect(pill.querySelector(".range-pill-beyond")).toHaveAttribute("aria-label", "Further than this ship can lock");
  });

  it("lists every round in an Ammunition panel above the hold: columns, loaded tag, range pill", () => {
    const { container } = render(<FitSheet view={view} />);
    expect([...container.querySelectorAll(".fit-sheet-main .card-title")].map((h) => h.textContent)).toEqual(["Modules", "Ammunition", "Cargo & drones"]);
    expect(container.querySelector(".ammo-head")).toHaveTextContent("RoundHoldOptimalFalloffRange");
    const row = container.querySelector(".ammo-list li")!;
    expect(row.querySelector(".sheet-entry-name")).toHaveTextContent("Hail S");
    expect(row.querySelector(".ammo-qty")).toHaveTextContent("1,000");   // the hold count, as a pill in its own column
    expect(row.querySelector(".sheet-entry-qty")).toBeNull();
    expect([...row.querySelectorAll(".sheet-range")].map((c) => c.textContent)).toEqual(["600 m", "4.3 km"]);
    const pill = row.querySelector(".range-pill")!;
    expect(pill).toHaveClass("level-1");
    expect(pill).toHaveTextContent("Short");
    expect(pill).toHaveAttribute("data-desc", "Reaches 4.9 km of this ship's 22.5 km lock range");
    expect(pill.querySelector(".range-pill-beyond")).toBeNull();
    // The hold itself lists only what is not ammunition, as plain rows.
    const lists = container.querySelectorAll(".sheet-entries");
    expect(lists[0]).toHaveTextContent("Hobgoblin II");
    expect(lists[1]).toHaveTextContent("Tritanium");
    expect(container.querySelectorAll(".sheet-entries .sheet-range")).toHaveLength(0);
    expect(container.querySelectorAll(".range-pill")).toHaveLength(1);
  });

  it("shows a dash in the Hold column for a round that is only loaded in the weapons", () => {
    const { container } = render(<FitSheet view={{ ...view, ammo: [{ ...view.ammo[0], quantity: 0, loadedIn: 4 }] }} />);
    const qty = container.querySelector(".ammo-list li .ammo-qty")!;
    expect(qty).toHaveTextContent("—");
    expect(qty).toHaveClass("none");
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
    expect(screen.getByText("1 weapon loaded with the best ammo in cargo")).toHaveClass("stat-note");
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
    expect(cargo).toHaveTextContent("Hail S");
    expect(cargo.closest("li")!.querySelector(".ammo-qty")).toHaveTextContent("1,000");   // the hold count lives in its own column
    expect(screen.getByText("Hobgoblin II").closest(".sheet-entry")).toHaveTextContent("×5");
    // A single item is just its name, and a type the SDE lacks gets no icon.
    const unknown = screen.getByText("Unknown type (99999)").closest(".sheet-entry")!;
    expect(unknown).not.toHaveTextContent("×");
    expect(unknown.querySelector("img")).toBeNull();
    expect(container.querySelectorAll(".sheet-entry img")).toHaveLength(3);   // Hail S, Tritanium, Hobgoblin; the unknown type has none
    expect(screen.getByText("13,100,100.00 ISK")).toBeInTheDocument();
    expect(screen.getByText("1 item unpriced")).toBeInTheDocument();
  });

  it("says so when no problems, no missing skills and no skills synced", () => {
    render(<FitSheet view={{
      ...view, skillsSynced: false, problems: [], missing: [], ammo: [], cargo: [], drones: [], unknown: [],
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

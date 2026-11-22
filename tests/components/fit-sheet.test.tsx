import { describe, it, expect } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
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
        { layer: "Shield", hp: "12,000 hp", note: "1,050 s", resists: [57, 48, 48, 57], ehp: "23,612" },
        { layer: "Armor", hp: "3,125 hp", note: null, resists: [83, 59, 37, 24], ehp: "6,291" },
        { layer: "Hull", hp: "2,500 hp", note: null, resists: [60, 60, 60, 60], ehp: "6,250" },
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
        quantity: 3, key: "high:0", name: "200mm AutoCannon II", typeId: 2889, charge: "Hail S", chargeTypeId: 12608,
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
  ammo: [{ key: "ammo:12608", typeId: 12608, name: "Hail S", desc: "Hail is an attempt to combine penetration with versatility.", loadedIn: 1, dps: "21.7", dpsDesc: "21.7 dps from 1 × 200mm AutoCannon II loaded with it", range: { optimal: "600 m", falloff: "4.3 km" }, band: { label: "Short", level: 1, beyond: false, desc: "Reaches 4.9 km of this ship's 22.5 km lock range" }, damage: { types: [{ kind: "explosive", label: "Explosive", share: 0.7 }, { kind: "kinetic", label: "Kinetic", share: 0.3 }], desc: "Explosive 70% · Kinetic 30% of 17.7 base damage per shot" }, order: 4857 }],
  consumables: [
    { key: "consumable:32006", typeId: 32006, name: "Navy Cap Booster 400", desc: "Provides a quick injection of power into your capacitor.", kind: "capBooster", effect: "+400 GJ per charge", use: "Small Capacitor Booster II, 1 per load" },
    { key: "consumable:28668", typeId: 28668, name: "Nanite Repair Paste", desc: null, kind: "paste", effect: "Overheat repair", use: null },
  ],
  cargo: [
    { key: "Cargo:12608:0", typeId: 12608, name: "Hail S", nickname: null, quantity: 1000, desc: "Hail is an attempt to combine penetration with versatility.", value: "100,000.00 ISK" },
    { key: "Cargo:34:1", typeId: 34, name: "Tritanium", nickname: null, quantity: 5000, desc: null, value: "25,000.00 ISK" },
  ],
  drones: [{ key: "DroneBay:2456:0", typeId: 2456, name: "Hobgoblin II", nickname: null, quantity: 5, desc: null, value: null }],
  unfittable: [],
  unknown: [{ key: "HiSlot1:99999:0", typeId: 99999, name: "Unknown type (99999)", nickname: null, quantity: 1, desc: null, value: null }],
  value: {
    total: "13,100,100.00 ISK",
    lines: [{ label: "Hull", value: "8,000,000.00 ISK" }, { label: "Cargo", value: "100,000.00 ISK" }],
    totalShort: "13.1M ISK",
    unpriced: "1 item unpriced",
  },
  mastery: 4,
  key: {
    ehp: { value: "37,445", unit: null, note: "Shield recharge 28.0 hp/s", tone: null },
    speed: { value: "1,765", unit: "m/s", note: "With MWD · 289.1 m/s without", tone: null },
    capacitor: { value: "Stable 68%", unit: null, note: "+0.1 GJ/s", tone: "good" },
    lock: { value: "40.6", unit: "km", note: "6 targets · 300 mm scan res", tone: null },
    align: { value: "5.23", unit: "s", note: "7.12 s with MWD on", tone: null },
  },
  repairs: [
    { label: "Passive shield", value: "28.0", idle: false }, { label: "Shield boost", value: "119.2", idle: false },
    { label: "Armor repair", value: "0", idle: true }, { label: "Hull repair", value: "0", idle: true },
  ],
  droneControl: {
    types: [
      // As the engine hands them over: hardest-hitting type first.
      { typeId: 2185, name: "Hammerhead II", inBay: 3, bandwidth: 10, dpsEach: 30, volleyEach: 90 },
      { typeId: 2456, name: "Hobgoblin II", inBay: 5, bandwidth: 5, dpsEach: 20, volleyEach: 40 },
    ],
    bandwidth: 25, maxActive: 5, launched: { 2185: 2, 2456: 1 }, controlRange: "60.0 km", bay: "40 / 40 m³",
  },
  weapons: { dps: 500, volley: 1000 },
  skillGaps: [
    { name: "Ship and bonuses", skills: [{ skillTypeId: 3329, name: "Minmatar Frigate", level: 4, effect: "7.5% bonus to Small Projectile Turret rate of fire, per level", affects: "Rifter hull" }] },
    { name: "Modules", skills: [
      { skillTypeId: 3300, name: "Gunnery", level: 3, effect: "2% bonus to all turrets' rate of fire per skill level.", affects: "3× 200mm AutoCannon II" },
      { skillTypeId: 3311, name: "Motion Prediction", level: 4, effect: null, affects: "3× 200mm AutoCannon II" },
    ] },
  ],
};
const legal: FitSheetView = { ...view, problems: [], missing: [], gauges: view.gauges.map((g) => ({ ...g, over: false })) };
const panel = (name: string) => screen.getByRole("region", { name });


describe("FitSheet", () => {
  it("heads the page with a way back, the hull, the fit name, the location and the render", () => {
    const { container } = render(<FitSheet view={view} />);
    expect(screen.getByRole("link", { name: "All ships" })).toHaveAttribute("href", "/ships");
    const summary = panel("Ship summary");
    expect(within(summary).getByText("Frigate · Minmatar")).toBeInTheDocument();
    expect(within(summary).getByRole("heading", { level: 1 })).toHaveTextContent("RifterScarlet Dart");
    expect(within(summary).getByText("0.9")).toHaveClass("sec-high");
    expect(summary).toHaveTextContent("0.9 Jita · Jita IV - Moon 4 - Caldari Navy Assembly Plant · in Small Standard Container");
    expect(container.querySelector("img.sd-render")?.getAttribute("src")).toBe(view.renderUrl);
  });

  it("shows mastery, the estimated value and the two status flags", () => {
    const { rerender } = render(<FitSheet view={legal} />);
    const summary = panel("Ship summary");
    expect(within(summary).getByRole("img", { name: "Mastery level 4 of 5" })).toBeInTheDocument();
    expect(within(summary).getByText("IV of V")).toBeInTheDocument();
    expect(within(summary).getByText("Estimated value").nextElementSibling).toHaveTextContent("13.1M ISK");
    expect(within(summary).getByText("Fit is legal").closest(".sd-flag")).toHaveClass("yo-good");
    expect(within(summary).getByText("All skills trained").closest(".sd-flag")).toHaveClass("yo-good");
    rerender(<FitSheet view={{ ...view, mastery: null }} />);
    expect(within(panel("Ship summary")).getByText("2 problems").closest(".sd-flag")).toHaveClass("yo-bad");
    expect(within(panel("Ship summary")).getByText("1 missing skill").closest(".sd-flag")).toHaveClass("yo-bad");
    expect(screen.queryByRole("img", { name: /Mastery level/ })).toBeNull();
  });

  it("shows a saved fit's location as just the note, and does not repeat a name that is the hull's", () => {
    render(<FitSheet view={{ ...view, title: "Rifter", location: { system: null, place: null, note: "Saved fit" } }} />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(/^Rifter$/);
    expect(panel("Ship summary")).toHaveTextContent("Saved fit");
  });

  it("gives the six key figures, DPS split into weapons and the launched drones", () => {
    render(<FitSheet view={view} />);
    const keys = panel("Key figures");
    const cell = (label: string) => within(keys).getByText(label).parentElement!;
    expect(cell("DPS")).toHaveTextContent("DPS580.0500.0 weapons · 80.0 drones");   // 500 + 2×30 + 1×20
    expect(cell("EHP")).toHaveTextContent("EHP37,445Shield recharge 28.0 hp/s");
    expect(cell("Speed")).toHaveTextContent("Speed1,765 m/sWith MWD · 289.1 m/s without");
    expect(cell("Capacitor")).toHaveTextContent("CapacitorStable 68%+0.1 GJ/s");
    expect(within(keys).getByText("Stable 68%")).toHaveClass("yo-good");
    expect(cell("Lock range")).toHaveTextContent("Lock range40.6 km6 targets · 300 mm scan res");
    expect(cell("Align time")).toHaveTextContent("Align time5.23 s7.12 s with MWD on");
  });

  it("lists modules by rack with slot counts, merged quantity, charge, range and state", () => {
    render(<FitSheet view={view} />);
    const modules = panel("Modules");
    expect(within(modules).getByRole("heading", { name: "High" }).nextElementSibling).toHaveTextContent("1 / 4");
    const row = within(modules).getByText("200mm AutoCannon II").closest("li")!;
    expect(row).toHaveTextContent("3×200mm AutoCannon IIHail S · best in cargo600 m4.3 kmACTIVE");
    expect(within(row).getByText("ACTIVE")).toHaveClass("yo-tag", "is-accent");
    expect(row.querySelector("img")?.getAttribute("src")).toBe("https://images.evetech.net/types/2889/icon?size=64");
    expect(within(modules).getAllByText("3 empty slots")).toHaveLength(4);   // High, Mid, Low and Rigs each have three free
    // A rack the hull does not have is left out.
    expect(within(modules).queryByRole("heading", { name: "Subsystems" })).toBeNull();
    expect(within(modules).getByRole("heading", { name: "Rigs" })).toBeInTheDocument();
  });

  it("lists ammunition with its damage type, DPS, reach and range band", () => {
    render(<FitSheet view={view} />);
    const ammo = panel("Ammunition");
    expect(within(ammo).getByText("1 weapon loaded with the best ammo in cargo")).toBeInTheDocument();
    const row = within(ammo).getByText("Hail S").closest("li")!;
    expect(row).toHaveTextContent("21.7");
    expect(row).toHaveTextContent("600 m");
    expect(row).toHaveTextContent("4.3 km");
    expect(row).toHaveTextContent("SHORT");
    expect(row.querySelectorAll(".sd-swatch").length).toBeGreaterThan(0);
    expect(within(row).getByText("21.7")).toHaveAttribute("data-desc", "21.7 dps from 1 × 200mm AutoCannon II loaded with it");
  });

  it("marks ammo that out-ranges the ship's lock, and dashes a round nothing fitted fires", () => {
    const beyond = { ...view.ammo[0], band: { label: "Long" as const, level: 3 as const, beyond: true, desc: "Reaches past the lock range" } };
    const { rerender } = render(<FitSheet view={{ ...view, ammo: [beyond] }} />);
    expect(within(panel("Ammunition")).getByLabelText("Further than this ship can lock")).toBeInTheDocument();
    expect(within(panel("Ammunition")).getByText(/LONG/)).toBeInTheDocument();
    rerender(<FitSheet view={{ ...view, ammo: [{ ...view.ammo[0], dps: null, dpsDesc: null, range: null, band: null }] }} />);
    expect(within(panel("Ammunition")).getByText("Hail S").closest("li")).toHaveTextContent("———");
  });

  it("lists consumables with what each does and how the ship uses it", () => {
    render(<FitSheet view={view} />);
    const consumables = panel("Consumables");
    expect(within(consumables).getByText("Navy Cap Booster 400").closest("li")).toHaveTextContent("Navy Cap Booster 400+400 GJ per chargeSmall Capacitor Booster II, 1 per load");
    expect(within(consumables).getByText("Nanite Repair Paste").closest("li")).toHaveTextContent("Nanite Repair PasteOverheat repair—");
  });

  it("lists the drone bay and cargo hold with how full they are, quantities and values, then unknown types", () => {
    render(<FitSheet view={view} />);
    const hold = panel("Cargo and drones");
    expect(within(hold).getByRole("heading", { name: "Drone bay" }).nextElementSibling).toHaveTextContent("40 / 40 m³");
    expect(within(hold).getByRole("heading", { name: "Cargo hold" }).nextElementSibling).toHaveTextContent("166.5 / 450 m³");
    expect(within(hold).getByText("Hail S").closest("li")).toHaveTextContent("Hail S×1,000100,000.00 ISK");
    expect(within(hold).getByText("Hobgoblin II").closest("li")).toHaveTextContent("Hobgoblin II×5—");
    expect(within(hold).getByRole("heading", { name: "Unknown types" })).toBeInTheDocument();
    expect(within(hold).getByText(/excluded from the calculation/)).toBeInTheDocument();
    expect(within(hold).queryByRole("heading", { name: "Not fitted" })).toBeNull();
  });

  it("puts each item's description on its name as hover text, and none when the SDE has none", () => {
    render(<FitSheet view={view} />);
    expect(within(panel("Modules")).getByText("200mm AutoCannon II")).toHaveAttribute("data-desc", "The 200mm is a powerful autocannon.");
    expect(within(panel("Cargo and drones")).getByText("Tritanium")).not.toHaveAttribute("data-desc");
  });

  it("lists the hull's bonuses with the pilot's level in each skill", () => {
    render(<FitSheet view={{ ...view, bonuses: [...view.bonuses, { skill: null, level: null, text: "50% bonus to scan probe strength" }] }} />);
    const bonuses = panel("Ship bonuses");
    expect(within(bonuses).getByText("Minmatar Frigate IV").nextElementSibling).toHaveTextContent("7.5% bonus to Small Projectile Turret rate of fire");
    expect(within(bonuses).getByText("Role bonus").nextElementSibling).toHaveTextContent("50% bonus to scan probe strength");
  });

  it("lists the skills that could still improve the ship, grouped, with level blocks, effect and what they affect", () => {
    render(<FitSheet view={view} />);
    const skills = panel("Skills");
    expect(within(skills).getByText("3 skills could still improve this ship")).toBeInTheDocument();
    expect(within(skills).getAllByRole("heading", { level: 3 }).map((h) => h.textContent)).toEqual(["Ship and bonuses", "Modules"]);
    const gunnery = within(skills).getByText("Gunnery").closest("li")!;
    expect(within(gunnery).getByRole("img", { name: "Level 3 of 5" })).toBeInTheDocument();
    expect(gunnery).toHaveTextContent("2% bonus to all turrets' rate of fire per skill level.");
    expect(gunnery).toHaveTextContent("Affects3× 200mm AutoCannon II");
    expect(within(skills).getByText("Minmatar Frigate").closest("li")).toHaveTextContent("Rifter hull");
  });

  it("says so when every relevant skill is at level 5, and when skills have not synced", () => {
    const { rerender } = render(<FitSheet view={{ ...view, skillGaps: [] }} />);
    expect(within(panel("Skills")).getByText("Every skill that affects this ship, its bonuses, modules and drones is at level 5.")).toHaveClass("yo-good");
    rerender(<FitSheet view={{ ...view, skillGaps: [], skillsSynced: false }} />);
    expect(within(panel("Skills")).getByText(/have not synced yet/)).toBeInTheDocument();
    expect(screen.getByText(/No skills synced yet/)).toHaveClass("yo-banner");
  });

  it("draws the fitting bars, coral and in words when over, and the slot counters", () => {
    render(<FitSheet view={view} />);
    const fitting = panel("Fitting");
    expect(within(fitting).getByRole("img", { name: "CPU 75% used" }).className).toBe("yo-bar");
    expect(within(fitting).getByRole("img", { name: "Powergrid 100% used, over" }).className).toBe("yo-bar is-bad");
    expect(within(fitting).getByText("60.00 / 51.25 MW · over")).toHaveClass("yo-bad");
    expect(within(fitting).getByText("0 / 400")).toBeInTheDocument();
    expect(within(fitting).getByText("High").closest(".sd-counter")).not.toHaveClass("is-over");
    expect(within(fitting).getByText("Turrets").closest(".sd-counter")).toHaveClass("is-over");
  });

  it("shows resists by layer with each layer's EHP and the total", () => {
    render(<FitSheet view={view} />);
    const defense = panel("Defense");
    const rows = within(defense).getAllByRole("row");
    expect(rows[0]).toHaveTextContent("EMThermKinExpEHP");
    expect(rows[1]).toHaveTextContent("Shield12,000 hp1,050 s recharge57%48%48%57%23,612");
    expect(rows[2]).toHaveTextContent("Armor3,125 hp83%59%37%24%6,291");
    expect(within(defense).getByText("Total")).toHaveTextContent("Total37,445 EHP");
  });

  it("shows the four repair rates, greying the ones the fit does not have", () => {
    render(<FitSheet view={view} />);
    const repairs = panel("Repairs");
    expect(within(repairs).getByText("Shield boost").nextElementSibling).toHaveTextContent("119.2 hp/s");
    expect(within(repairs).getByText("Shield boost").nextElementSibling).not.toHaveClass("is-idle");
    expect(within(repairs).getByText("Armor repair").nextElementSibling).toHaveClass("is-idle");
  });

  it("shows capacitor, targeting, navigation and the value breakdown as label and value rows", () => {
    render(<FitSheet view={view} />);
    expect(within(panel("Capacitor")).getByText("Stable 68%")).toHaveClass("yo-good");
    expect(panel("Capacitor")).toHaveTextContent("Capacity1,687 GJ / 4m 3s");
    expect(panel("Targeting")).toHaveTextContent("40.6 km");
    expect(panel("Navigation")).toHaveTextContent("Align time5.23 s");
    const value = panel("Estimated value");
    expect(value).toHaveTextContent("Hull8,000,000.00 ISK");
    expect(within(value).getByText("Total").closest(".sd-row")).toHaveClass("is-total");
    expect(value).toHaveTextContent("Total13,100,100.00 ISK");
    expect(within(value).getByText("1 item unpriced")).toBeInTheDocument();
  });

  it("details problems and missing skills only when there are some", () => {
    const { rerender } = render(<FitSheet view={view} />);
    expect(within(panel("Problems")).getByText("8.75 MW over the ship's output")).toBeInTheDocument();
    expect(within(panel("Problems")).getByText("Powergrid")).toHaveClass("yo-tag", "is-bad");
    const missing = panel("Missing skills");
    expect(within(missing).getByText("Minmatar Frigate").closest("li")).toHaveTextContent("Minmatar Frigate0 → 1");
    expect(within(missing).getByRole("img", { name: "Level 0 of 5, needs level 1" })).toBeInTheDocument();
    rerender(<FitSheet view={legal} />);
    expect(screen.queryByRole("region", { name: "Problems" })).toBeNull();
    expect(screen.queryByRole("region", { name: "Missing skills" })).toBeNull();
  });

  describe("drone selector", () => {
    it("lists only the drones in the bay, with what is launched and each type's limit", () => {
      render(<FitSheet view={view} />);
      const drones = panel("Drones");
      expect(within(drones).getByText("2× Hammerhead II, 1× Hobgoblin II")).toBeInTheDocument();   // hardest-hitting type first
      expect(within(drones).getByText("5 in bay · 5 Mbit/s · 20.0 dps each")).toBeInTheDocument();
      const hobgoblin = within(drones).getByText("Hobgoblin II").closest(".sd-drone-row") as HTMLElement;
      expect(hobgoblin).toHaveTextContent("1 / 1");            // 25 Mbit/s all in use: no room for more
      expect(within(hobgoblin).getByRole("button", { name: "One more Hobgoblin II" })).toBeDisabled();
      expect(drones).toHaveTextContent("Launched3 / 5 drones");
      expect(drones).toHaveTextContent("Bandwidth25 / 25 Mbit/s");
      expect(drones).toHaveTextContent("Control range60.0 km");
      expect(drones).toHaveTextContent("Drone bay40 / 40 m³");
      expect(within(drones).getByText("80.0 DPS")).toBeInTheDocument();
    });

    it("recalculates drone DPS, total DPS, launched count and bandwidth when the selection changes", () => {
      render(<FitSheet view={view} />);
      const drones = panel("Drones");
      fireEvent.click(within(drones).getByRole("button", { name: "One fewer Hammerhead II" }));
      // 1 Hammerhead (30) + 1 Hobgoblin (20) = 50; bandwidth 15 / 25 leaves room for two more Hobgoblins.
      expect(within(drones).getByText("50.0 DPS")).toBeInTheDocument();
      expect(drones).toHaveTextContent("Launched2 / 5 drones");
      expect(drones).toHaveTextContent("Bandwidth15 / 25 Mbit/s");
      expect(within(drones).getByText("Hobgoblin II").closest(".sd-drone-row")).toHaveTextContent("1 / 3");
      expect(within(panel("Key figures")).getByText("DPS").parentElement).toHaveTextContent("550.0500.0 weapons · 50.0 drones");
      expect(panel("Offense")).toHaveTextContent("550.0 DPS");
      expect(panel("Offense")).toHaveTextContent("Drones50.0 dps");
      expect(panel("Offense")).toHaveTextContent("Volley1,130 HP");   // 1000 + 90 + 40

      fireEvent.click(within(drones).getByRole("button", { name: "One more Hobgoblin II" }));
      fireEvent.click(within(drones).getByRole("button", { name: "One more Hobgoblin II" }));
      expect(within(drones).getByText("90.0 DPS")).toBeInTheDocument();
      expect(within(drones).getByRole("button", { name: "One more Hobgoblin II" })).toBeDisabled();
      expect(within(drones).getByText("1× Hammerhead II, 3× Hobgoblin II")).toBeInTheDocument();
    });

    it("stops at the pilot's drone control limit even with bandwidth to spare", () => {
      render(<FitSheet view={{ ...view, droneControl: { ...view.droneControl!, bandwidth: 100, maxActive: 4, launched: { 2185: 3, 2456: 1 } } }} />);
      const drones = panel("Drones");
      expect(drones).toHaveTextContent("Launched4 / 4 drones");
      expect(within(drones).getByRole("button", { name: "One more Hobgoblin II" })).toBeDisabled();
      expect(within(drones).getByRole("button", { name: "One more Hammerhead II" })).toBeDisabled();   // none left in the bay either
    });

    it("can launch nothing, and says so", () => {
      render(<FitSheet view={{ ...view, droneControl: { ...view.droneControl!, launched: { 2456: 1 } } }} />);
      const drones = panel("Drones");
      fireEvent.click(within(drones).getByRole("button", { name: "One fewer Hobgoblin II" }));
      expect(within(drones).getByText("No drones launched")).toBeInTheDocument();
      expect(within(drones).getByRole("button", { name: "One fewer Hobgoblin II" })).toBeDisabled();
      expect(panel("Offense")).toHaveTextContent("Drones—");
      expect(within(panel("Key figures")).getByText("DPS").parentElement).toHaveTextContent("500.0500.0 weapons · 0.0 drones");
    });

    it("folds away, and is absent for a hull with no drone bay", () => {
      const { rerender } = render(<FitSheet view={view} />);
      fireEvent.click(within(panel("Drones")).getByRole("button", { name: /Drones launched/ }));
      expect(within(panel("Drones")).queryByRole("button", { name: /One more/ })).toBeNull();
      rerender(<FitSheet view={{ ...view, droneControl: null, weapons: { dps: 0, volley: 0 } }} />);
      expect(screen.queryByRole("region", { name: "Drones" })).toBeNull();
      expect(within(panel("Key figures")).getByText("DPS").parentElement).toHaveTextContent("DPS—Nothing fitted deals damage");
    });
  });
});

describe("CouldNotCompute", () => {
  it("names the fit and offers a way back", () => {
    render(<CouldNotCompute title="Scarlet Dart" />);
    expect(screen.getByRole("heading", { level: 1, name: "Scarlet Dart" })).toBeInTheDocument();
    expect(screen.getByText(/Could not compute this fit/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "All ships" })).toHaveAttribute("href", "/ships");
  });
});

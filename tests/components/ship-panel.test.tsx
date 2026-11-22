import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ShipPanel } from "../../src/app/ships/ShipPanel.js";
import type { ShipCardView } from "../../src/lib/view/ships.js";

const card: ShipCardView = {
  key: "asset:1", href: "/ships/asset/1", name: "Wraith", typeId: 33157, typeName: "Hurricane Fleet Issue",
  groupName: "Combat Battlecruiser", raceName: "Minmatar", location: "Kubinen VI - Moon 2 - Lai Dai Corporation Factory",
  stats: { dps: "812.4", ehp: "98,112", velocity: "1,402 m/s", cap: "Lasts 2m 41s", capOk: false, propKind: "MWD" },
  cpu: { label: "CPU", unit: "tf", used: 520.5, output: 593.75, text: "520.50 / 593.75 tf", percent: 87.7, over: false },
  power: { label: "Powergrid", unit: "MW", used: 1500, output: 1437.5, text: "1500.00 / 1437.50 MW", percent: 100, over: true },
  missingSkills: 0,
  weapons: [
    { key: "a", name: "220mm Vulcan AutoCannon II", count: 6, charge: "Hail M", range: "optimal 1.5 km · falloff 14.2 km" },
    { key: "b", name: "Republic Fleet Warp Scrambler", count: 1, charge: null, range: "range 11.3 km" },
  ],
  value: "412.6M ISK", valueRaw: 412_600_000, unpriced: "2 items unpriced", error: null, mastery: 4,
};
const cell = (label: RegExp | string) => screen.getByText(label).parentElement!;

describe("ShipPanel", () => {
  it("shows hull type and faction, the hull as a link to its sheet, the fit name and the station", () => {
    render(<ShipPanel card={card} />);
    expect(screen.getByText("Combat Battlecruiser · Minmatar")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Hurricane Fleet Issue" })).toHaveAttribute("href", "/ships/asset/1");
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("Hurricane Fleet IssueWraith");
    expect(screen.getByTitle(card.location)).toBeInTheDocument();
  });

  it("shows the four headline stats, with the capacitor's verdict in the label and its colour", () => {
    render(<ShipPanel card={card} />);
    expect(cell("DPS")).toHaveTextContent("DPS812.4");
    expect(cell("EHP")).toHaveTextContent("EHP98,112");
    expect(cell("Speed · MWD")).toHaveTextContent("1,402 m/s");
    expect(cell("Cap · Lasts")).toHaveTextContent("Cap · Lasts2m 41s");
    expect(screen.getByText("2m 41s")).toHaveClass("yo-bad");
  });

  it("marks a stable capacitor in teal", () => {
    render(<ShipPanel card={{ ...card, stats: { ...card.stats!, cap: "Stable 43%", capOk: true } }} />);
    expect(cell("Cap · Stable")).toHaveTextContent("Cap · Stable43%");
    expect(screen.getByText("43%")).toHaveClass("yo-good");
  });

  it("draws CPU and powergrid bars with used / max, coral and in words when over", () => {
    render(<ShipPanel card={card} />);
    expect(screen.getByRole("img", { name: "CPU 88% used" }).className).toBe("yo-bar");
    expect(screen.getByText("520.50 / 593.75 tf")).not.toHaveClass("yo-bad");
    expect(screen.getByRole("img", { name: "Powergrid 100% used, over" }).className).toBe("yo-bar is-bad");
    expect(screen.getByText("1500.00 / 1437.50 MW · over")).toHaveClass("yo-bad");
  });

  it("shows value, skill status and mastery", () => {
    const { rerender } = render(<ShipPanel card={card} />);
    expect(screen.getByText(/412\.6M/)).toHaveTextContent("412.6M ISK");
    expect(screen.getByText("All skills trained")).toHaveClass("yo-good");
    const blocks = screen.getByRole("img", { name: "Mastery level 4 of 5" });
    expect([...blocks.children].filter((b) => b.classList.contains("is-filled"))).toHaveLength(4);
    expect(screen.getByText("IV")).toBeInTheDocument();
    rerender(<ShipPanel card={{ ...card, missingSkills: 3, mastery: 0 }} />);
    expect(screen.getByText("3 missing skills")).toHaveClass("yo-bad");
    expect(screen.getByRole("img", { name: "Mastery level 0 of 5" })).toBeInTheDocument();
    rerender(<ShipPanel card={{ ...card, missingSkills: 1, mastery: null }} />);
    expect(screen.getByText("1 missing skill")).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: /Mastery level/ })).toBeNull();   // unknown is not level 0
  });

  it("opens the weapons and modules along the bottom from the Modules button", () => {
    render(<ShipPanel card={card} />);
    const button = screen.getByRole("button", { name: "Modules 2" });
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText(/220mm Vulcan/)).toBeNull();
    fireEvent.click(button);
    expect(button).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("6× 220mm Vulcan AutoCannon II").nextElementSibling).toHaveTextContent("Hail M · optimal 1.5 km · falloff 14.2 km");
    expect(screen.getByText("Republic Fleet Warp Scrambler").nextElementSibling).toHaveTextContent("range 11.3 km");
    expect(screen.getByText(/2 items unpriced/)).toBeInTheDocument();
    fireEvent.click(button);
    expect(screen.queryByText(/220mm Vulcan/)).toBeNull();
  });

  it("says so when a fit has no weapons or ranged modules", () => {
    render(<ShipPanel card={{ ...card, weapons: [], unpriced: null }} />);
    fireEvent.click(screen.getByRole("button", { name: "Modules 0" }));
    expect(screen.getByText("No weapons or modules listed")).toBeInTheDocument();
  });

  it("does not repeat a ship's name when it is just the hull name, and copes with no group or race", () => {
    render(<ShipPanel card={{ ...card, name: "Hurricane Fleet Issue", groupName: null, raceName: null }} />);
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent(/^Hurricane Fleet Issue$/);
    expect(screen.queryByText(/Minmatar/)).toBeNull();
  });

  it("says a fit could not be computed instead of showing numbers", () => {
    render(<ShipPanel card={{ ...card, stats: null, cpu: null, power: null, value: null, valueRaw: -1, weapons: [], error: "Could not compute" }} />);
    expect(screen.getByText("Could not compute")).toHaveClass("yo-bad");
    expect(screen.queryByText("DPS")).toBeNull();
    expect(screen.queryByRole("button", { name: /Modules/ })).toBeNull();
    expect(screen.getByRole("link", { name: "Hurricane Fleet Issue" })).toBeInTheDocument();
  });
});

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ShipCard } from "../../src/app/ships/ShipCard.js";
import type { ShipCardView } from "../../src/lib/view/ships.js";

const card: ShipCardView = {
  key: "asset:1000", href: "/ships/asset/1000", name: "Scarlet Dart", typeId: 587, typeName: "Rifter",
  groupName: "Frigate", raceName: "Minmatar",
  location: "Jita IV - Moon 4 - Caldari Navy Assembly Plant",
  cpu: { label: "CPU", unit: "tf", used: 121.5, output: 162.5, text: "121.50 / 162.50 tf", percent: 74.8, over: false },
  power: { label: "Powergrid", unit: "MW", used: 60, output: 51.25, text: "60.00 / 51.25 MW", percent: 100, over: true },
  missingSkills: 2, value: "13.1M ISK", valueRaw: 13_100_100, unpriced: "1 item unpriced", error: null,
};

describe("ShipCard", () => {
  it("shows the custom name, race/category/type pills, location and value, linking to the sheet", () => {
    const { container } = render(<ShipCard card={card} />);
    expect(screen.getByRole("link")).toHaveAttribute("href", "/ships/asset/1000");
    expect(screen.getByText("Scarlet Dart")).toBeInTheDocument();
    const pills = container.querySelector(".ship-type-pills");
    expect(pills).not.toBeNull();
    expect(pills!.querySelectorAll(".pill")).toHaveLength(3);
    expect(screen.getByText("Minmatar")).toHaveClass("pill");
    expect(screen.getByText("Frigate")).toHaveClass("pill");
    expect(screen.getByText("Rifter")).toHaveClass("pill");
    expect(screen.getByText(/Caldari Navy Assembly Plant/)).toBeInTheDocument();
    expect(screen.getByText("13.1M ISK")).toBeInTheDocument();
    expect(screen.getByText("1 item unpriced")).toBeInTheDocument();
    expect(screen.getByText("2 missing skills")).toBeInTheDocument();
  });

  it("shows the ship's in-game render, not the generic type icon", () => {
    const { container } = render(<ShipCard card={card} />);
    const img = container.querySelector<HTMLImageElement>(".ship-render");
    expect(img).not.toBeNull();
    expect(img).toHaveAttribute("src", "https://images.evetech.net/types/587/render?size=128");
    expect(img).toHaveAttribute("alt", "");
  });

  it("omits the category and race pills when the hull's group or race is unknown", () => {
    const { container } = render(<ShipCard card={{ ...card, groupName: null, raceName: null }} />);
    const pills = container.querySelector(".ship-type-pills")!;
    expect(pills.querySelectorAll(".pill")).toHaveLength(1);
    expect(screen.getByText("Rifter")).toBeInTheDocument();
  });

  it("draws both gauges and marks only the over-budget one", () => {
    const { container } = render(<ShipCard card={card} />);
    const gauges = container.querySelectorAll(".gauge");
    expect(gauges).toHaveLength(2);
    expect(gauges[0]).not.toHaveClass("over");
    expect(gauges[1]).toHaveClass("over");
    expect(gauges[0].querySelector(".gauge-fill")).toHaveStyle({ width: "74.8%" });
    expect(screen.getByText("121.50 / 162.50 tf")).toBeInTheDocument();
  });

  it("falls back to the type name when the ship was never renamed", () => {
    render(<ShipCard card={{ ...card, name: null, missingSkills: 0 }} />);
    expect(screen.getAllByText("Rifter").length).toBeGreaterThan(0);
    expect(screen.getByText("All skills trained")).toBeInTheDocument();
  });

  it("shows Could not compute instead of gauges when the engine threw", () => {
    const { container } = render(<ShipCard card={{
      ...card, cpu: null, power: null, value: null, unpriced: null, error: "Could not compute",
    }} />);
    expect(screen.getByText("Could not compute")).toBeInTheDocument();
    expect(container.querySelectorAll(".gauge")).toHaveLength(0);
  });
});

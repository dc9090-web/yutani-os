import { describe, it, expect } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { AssetsBrowser } from "../../src/app/assets/AssetsBrowser.js";
import type { AssetViewLocation, AssetViewNode } from "../../src/lib/view/assets.js";

const FLAGS: Record<string, string> = { Hangar: "Hangar", LoSlot0: "Low slot 1", LoSlot1: "Low slot 2", HiSlot0: "High slot 1", Cargo: "Cargo hold", DroneBay: "Drone bay" };
const node = (itemId: number, typeId: number, typeName: string, rawFlag: string, extra: Partial<AssetViewNode> = {}): AssetViewNode => ({
  itemId, typeId, typeName, name: null, quantity: 1, flag: FLAGS[rawFlag] ?? rawFlag, rawFlag, isCharge: false,
  isBlueprintCopy: false, volume: 1, iconUrl: `https://images.evetech.net/types/${typeId}/icon?size=32`, children: [], ...extra,
});

const locations: AssetViewLocation[] = [
  {
    locationId: 60003760, label: "Jita IV - Moon 4 - Caldari Navy Assembly Plant", itemCount: 1323, volume: 27294,
    nodes: [
      node(1035000000001, 587, "Rifter", "Hangar", {
        name: "Scarlet Dart",
        children: [
          node(2001, 519, "Gyrostabilizer II", "LoSlot0"),
          node(2003, 519, "Gyrostabilizer II", "LoSlot1"),
          node(2004, 484, "125mm Gatling AutoCannon II", "HiSlot0"),
          node(2005, 12608, "Hail S", "HiSlot0", { isCharge: true, quantity: 120 }),
          node(2006, 2454, "Hobgoblin I", "DroneBay", { quantity: 2 }),
          node(2007, 12608, "Hail S", "Cargo", { quantity: 500 }),
        ],
      }),
      node(2002, 691, "Rifter Blueprint", "Hangar", { isBlueprintCopy: true, iconUrl: "https://images.evetech.net/types/691/bpc?size=32" }),
    ],
  },
  { locationId: 60008494, label: "Amarr VIII - Emperor Family Academy", itemCount: 1, volume: 1.2, nodes: [node(3001, 34, "Tritanium", "Hangar", { quantity: 120 })] },
];
const descriptions = { 519: "Raises projectile damage and rate of fire." };
const ui = () => render(<AssetsBrowser locations={locations} descriptions={descriptions} />);
const jita = () => screen.getByRole("button", { name: /Caldari Navy Assembly Plant/ });

describe("AssetsBrowser", () => {
  it("lists locations with their item count and volume, collapsed", () => {
    ui();
    expect(jita()).toHaveAttribute("aria-expanded", "false");
    expect(jita()).toHaveTextContent("1,323 items27,294 m³");
    expect(screen.getByRole("button", { name: /Emperor Family Academy/ })).toHaveTextContent("1 item1.2 m³");
    expect(screen.queryByText("Rifter")).toBeNull();
    expect(screen.getByText("All 2 locations, most items first")).toBeInTheDocument();
  });

  it("opens a location into its ships and containers, each with a header, summary and flag", () => {
    ui();
    fireEvent.click(jita());
    expect(jita()).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Rifter")).toBeInTheDocument();
    expect(screen.getByText("Scarlet Dart")).toBeInTheDocument();
    expect(screen.getByText("6 items inside: 3 fitted, 2 drones, 1 cargo stack")).toBeInTheDocument();
    expect(screen.getByText("HANGAR")).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent)).toEqual(["Fitted", "Drone bay", "Cargo hold", "Hangar"]);
  });

  it("merges identical modules into one row with a quantity and slot range, and notes the loaded charge", () => {
    ui();
    fireEvent.click(jita());
    const fitted = screen.getByRole("heading", { name: "Fitted" }).closest(".as-group") as HTMLElement;
    expect(within(fitted).getByText("3 items")).toBeInTheDocument();
    const rows = within(fitted).getAllByRole("listitem");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent("125mm Gatling AutoCannon IIHail S loadedHigh 1");
    expect(rows[1]).toHaveTextContent("2×Gyrostabilizer IILow 1–2");
  });

  it("puts drones and cargo in their own columns, and loose hangar items after the ships", () => {
    ui();
    fireEvent.click(jita());
    const drones = screen.getByRole("heading", { name: "Drone bay" }).closest(".as-group") as HTMLElement;
    expect(drones).toHaveTextContent("2 drones");
    expect(within(drones).getByRole("listitem")).toHaveTextContent("2×Hobgoblin I");
    const cargo = screen.getByRole("heading", { name: "Cargo hold" }).closest(".as-group") as HTMLElement;
    expect(within(cargo).getByRole("listitem")).toHaveTextContent("500×Hail S");
    const hangar = screen.getByRole("heading", { name: "Hangar" }).closest(".as-group") as HTMLElement;
    expect(within(hangar).getByRole("listitem")).toHaveTextContent("Rifter BlueprintBPC");
  });

  it("gives every item row an icon tile and keeps the tile when the image is missing", () => {
    ui();
    fireEvent.click(jita());
    const icon = screen.getByText("Hobgoblin I").closest("li")!.querySelector("img.as-icon") as HTMLImageElement;
    expect(icon.getAttribute("src")).toBe("https://images.evetech.net/types/2454/icon?size=32");
    fireEvent.error(icon);
    expect(icon).toHaveClass("yo-tile", "is-blank");
    expect(screen.getByText("Rifter Blueprint").closest("li")!.querySelector("img")?.getAttribute("src")).toContain("/bpc");
  });

  it("explains an item on hover from its type description, and stays quiet for one without", () => {
    ui();
    fireEvent.click(jita());
    expect(screen.getByText("Gyrostabilizer II")).toHaveAttribute("data-desc", "Raises projectile damage and rate of fire.");
    expect(screen.getByText("Hobgoblin I")).not.toHaveAttribute("data-desc");
  });

  it("keeps several locations open at once", () => {
    ui();
    fireEvent.click(jita());
    fireEvent.click(screen.getByRole("button", { name: /Emperor Family Academy/ }));
    expect(screen.getByText("Rifter")).toBeInTheDocument();
    expect(screen.getByText("Tritanium")).toBeInTheDocument();
    fireEvent.click(jita());
    expect(screen.queryByText("Rifter")).toBeNull();
    expect(screen.getByText("Tritanium")).toBeInTheDocument();
  });

  it("filters by item name: matching locations open by themselves and show only the matches", () => {
    ui();
    fireEvent.change(screen.getByLabelText("Filter by name"), { target: { value: "gyro" } });
    expect(screen.getByText("Gyrostabilizer II")).toBeInTheDocument();
    expect(screen.queryByText("Hobgoblin I")).toBeNull();
    expect(screen.queryByRole("button", { name: /Emperor Family Academy/ })).toBeNull();
    expect(screen.getByText("1 of 2 locations match")).toBeInTheDocument();
  });

  it("filters by location name, leaving the location closed with all its contents", () => {
    ui();
    fireEvent.change(screen.getByLabelText("Filter by name"), { target: { value: "amarr" } });
    const amarr = screen.getByRole("button", { name: /Emperor Family Academy/ });
    expect(amarr).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("button", { name: /Caldari Navy Assembly Plant/ })).toBeNull();
    fireEvent.click(amarr);
    expect(screen.getByText("Tritanium")).toBeInTheDocument();
  });

  it("finds a ship by the pilot's name for it and shows its whole fit", () => {
    ui();
    fireEvent.change(screen.getByLabelText("Filter by name"), { target: { value: "scarlet" } });
    expect(screen.getByText("Gyrostabilizer II")).toBeInTheDocument();
    expect(screen.getByText("Hobgoblin I")).toBeInTheDocument();
    expect(screen.queryByText("Rifter Blueprint")).toBeNull();
  });

  it("says so when the filter matches nothing", () => {
    ui();
    fireEvent.change(screen.getByLabelText("Filter by name"), { target: { value: "zzz" } });
    expect(screen.getByText("No locations or items match that filter.")).toBeInTheDocument();
    expect(screen.getByText("0 of 2 locations match")).toBeInTheDocument();
  });

  it("shows the empty state before the first sync", () => {
    render(<AssetsBrowser locations={[]} />);
    expect(screen.getByText(/Not synced yet/)).toBeInTheDocument();
  });
});

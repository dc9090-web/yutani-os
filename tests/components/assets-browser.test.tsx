import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AssetsBrowser } from "../../src/app/assets/AssetsBrowser.js";
import type { AssetViewLocation } from "../../src/lib/view/assets.js";

const locations: AssetViewLocation[] = [
  {
    locationId: 60003760, label: "Jita IV - Moon 4 - Caldari Navy Assembly Plant", itemCount: 3, volume: 27294,
    nodes: [
      {
        itemId: 1035000000001, typeId: 587, typeName: "Rifter", name: "Scarlet Dart", quantity: 1,
        flag: "Hangar", isBlueprintCopy: false, volume: 27289, iconUrl: "https://images.evetech.net/types/587/icon?size=32",
        children: [
          { itemId: 2001, typeId: 519, typeName: "Gyrostabilizer II", name: null, quantity: 1, flag: "Low slot 1", isBlueprintCopy: false, volume: 5, iconUrl: "https://images.evetech.net/types/519/icon?size=32", children: [] },
        ],
      },
      { itemId: 2002, typeId: 691, typeName: "Rifter Blueprint", name: null, quantity: 1, flag: "Hangar", isBlueprintCopy: true, volume: 0.01, iconUrl: "https://images.evetech.net/types/691/bpc?size=32", children: [] },
    ],
  },
  {
    locationId: 60008494, label: "Amarr VIII - Emperor Family Academy", itemCount: 1, volume: 1.2,
    nodes: [{ itemId: 3001, typeId: 34, typeName: "Tritanium", name: null, quantity: 120, flag: "Hangar", isBlueprintCopy: false, volume: 1.2, iconUrl: "https://images.evetech.net/types/34/icon?size=32", children: [] }],
  },
];

describe("AssetsBrowser", () => {
  it("lists locations with their item count and volume, collapsed", () => {
    render(<AssetsBrowser locations={locations} />);
    expect(screen.getByRole("button", { name: /Caldari Navy Assembly Plant/ })).toBeInTheDocument();
    expect(screen.getByText(/3 items · 27,294 m³/)).toBeInTheDocument();
    expect(screen.getByText(/1 item · 1.2 m³/)).toBeInTheDocument();
    expect(screen.queryByText("Rifter")).toBeNull();
  });

  it("expands a location into its tree, nesting fitted modules under the ship", () => {
    render(<AssetsBrowser locations={locations} />);
    fireEvent.click(screen.getByRole("button", { name: /Caldari Navy Assembly Plant/ }));
    expect(screen.getByText("Rifter")).toBeInTheDocument();
    expect(screen.getByText("Scarlet Dart")).toBeInTheDocument();
    expect(screen.getByText("Gyrostabilizer II")).toBeInTheDocument();
    expect(screen.getByText("Low slot 1")).toBeInTheDocument();
    expect(screen.getByText("BPC")).toHaveClass("bpc");
    expect(screen.queryByText("Tritanium")).toBeNull();
  });

  it("explains each item on hover from its type description, and stays quiet for one without", () => {
    render(<AssetsBrowser locations={locations} descriptions={{ 587: "The Rifter is a very powerful combat frigate.", 519: "Gives a bonus to projectile turrets." }} />);
    fireEvent.click(screen.getByRole("button", { name: /Caldari Navy Assembly Plant/ }));
    expect(screen.getByText("Rifter").closest(".tree-item")).toHaveAttribute("data-desc", "The Rifter is a very powerful combat frigate.");
    expect(screen.getByText("Gyrostabilizer II").closest(".tree-item")).toHaveAttribute("data-desc", "Gives a bonus to projectile turrets.");
    expect(screen.getByText("Rifter Blueprint").closest(".tree-item")).not.toHaveAttribute("data-desc");
  });

  it("shows each item's type icon and hides one the image server cannot supply", () => {
    const { container } = render(<AssetsBrowser locations={locations} />);
    fireEvent.click(screen.getByRole("button", { name: /Caldari Navy Assembly Plant/ }));
    const icons = container.querySelectorAll<HTMLImageElement>("img.item-icon");
    expect(icons).toHaveLength(3);
    expect(icons[0].src).toBe("https://images.evetech.net/types/587/icon?size=32");
    expect(icons[2].src).toBe("https://images.evetech.net/types/691/bpc?size=32");
    fireEvent.error(icons[1]);
    expect(icons[1]).toHaveClass("missing");
  });

  it("collapses a container without losing the rest of the tree", () => {
    render(<AssetsBrowser locations={locations} />);
    fireEvent.click(screen.getByRole("button", { name: /Caldari Navy Assembly Plant/ }));
    fireEvent.click(screen.getByRole("button", { name: /collapse Rifter/i }));
    expect(screen.queryByText("Gyrostabilizer II")).toBeNull();
    expect(screen.getByText("Rifter")).toBeInTheDocument();
  });

  it("filters by type name across every location and auto-expands the matches", () => {
    render(<AssetsBrowser locations={locations} />);
    fireEvent.change(screen.getByLabelText(/filter/i), { target: { value: "gyro" } });
    expect(screen.getByText("Gyrostabilizer II")).toBeInTheDocument();
    expect(screen.getByText("Rifter")).toBeInTheDocument();               // kept as the ancestor
    expect(screen.queryByRole("button", { name: /Emperor Family Academy/ })).toBeNull();
  });

  it("says so when the filter matches nothing", () => {
    render(<AssetsBrowser locations={locations} />);
    fireEvent.change(screen.getByLabelText(/filter/i), { target: { value: "zzz" } });
    expect(screen.getByText(/nothing matches/i)).toBeInTheDocument();
  });

  it("shows the empty state before the first sync", () => {
    render(<AssetsBrowser locations={[]} />);
    expect(screen.getByText(/not synced yet/i)).toBeInTheDocument();
  });
});

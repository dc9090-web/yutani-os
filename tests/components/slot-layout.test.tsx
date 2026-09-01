import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { fixtureData } from "../dogma/fixture.js";
import { CATEGORY } from "../../src/lib/dogma/index.js";
import { computeEditor } from "../../src/lib/fits/editor-view.js";
import { CARGO_FLAG, type FitDoc } from "../../src/lib/fits/doc.js";
import { SlotLayout } from "../../src/app/fitting/SlotLayout.js";

const data = fixtureData("rifter");
const allV = new Map<number, number>();
for (const t of data.types.values()) if (t.categoryId === CATEGORY.skill) allV.set(t.id, 5);

const DOC: FitDoc = {
  id: 1, name: "Cheap Rifter", description: "", shipTypeId: 587, characterId: "all-v",
  items: [
    { typeId: 2889, quantity: 1, flag: "HiSlot0", chargeTypeId: 12608, state: "active" },
    { typeId: 2048, quantity: 1, flag: "LoSlot0", chargeTypeId: null, state: "online" },
    { typeId: 2456, quantity: 2, flag: "DroneBay", chargeTypeId: null, state: "active" },
    { typeId: 12608, quantity: 600, flag: CARGO_FLAG, chargeTypeId: null, state: "active" },
  ],
};

function renderLayout(over: Partial<Parameters<typeof SlotLayout>[0]> = {}) {
  const result = computeEditor(DOC, { data, skills: allV, implants: [] }, new Map());
  if (result.kind !== "ok") throw new Error("expected ok");
  const props = {
    blocks: result.view.blocks, drones: result.view.drones, cargo: result.view.cargo,
    unknown: result.view.unknown, selected: null,
    onSelect: vi.fn(), onRemove: vi.fn(), onState: vi.fn(),
    onClearCharge: vi.fn(), onQuantity: vi.fn(), onRemoveEntry: vi.fn(), ...over,
  };
  render(<SlotLayout {...props} />);
  return props;
}

describe("SlotLayout", () => {
  it("renders every slot the hull has, empties included, with the loaded charge", () => {
    renderLayout();
    expect(screen.getByText("High")).toBeInTheDocument();
    expect(screen.getAllByText("200mm AutoCannon II")).toHaveLength(1);
    expect(screen.getByText("· Hail S")).toBeInTheDocument();      // the loaded charge, not the cargo row
    // The Rifter has 3 high, 3 mid, 4 low and 3 rig slots; 2 are filled, so 11 read "Empty".
    expect(screen.getAllByText("Empty")).toHaveLength(11);
    expect(screen.queryByText("Subsystems")).toBeNull();
  });

  it("selects a slot, changes its state, unloads its charge and removes it", () => {
    const props = renderLayout();
    fireEvent.click(screen.getByRole("button", { name: /select 200mm AutoCannon II/i }));
    expect(props.onSelect).toHaveBeenCalledWith("high", 0);

    fireEvent.change(screen.getByLabelText("200mm AutoCannon II state"), { target: { value: "offline" } });
    expect(props.onState).toHaveBeenCalledWith("high", 0, "offline");

    fireEvent.click(screen.getByRole("button", { name: "Unload Hail S" }));
    expect(props.onClearCharge).toHaveBeenCalledWith("high", 0);

    fireEvent.click(screen.getByRole("button", { name: "Remove 200mm AutoCannon II" }));
    expect(props.onRemove).toHaveBeenCalledWith("high", 0);
  });

  it("marks the selected slot", () => {
    renderLayout({ selected: { slot: "high", index: 0 } });
    expect(screen.getByRole("button", { name: /select 200mm AutoCannon II/i }))
      .toHaveAttribute("aria-pressed", "true");
  });

  it("renders each module's CPU and powergrid as an affected-by control", () => {
    renderLayout();
    const cpu = screen.getByRole("button", { name: /^CPU 6\.75, affected by/i });
    fireEvent.click(cpu);
    expect(cpu).toHaveAttribute("aria-expanded", "true");
  });

  it("shows the drone bay and the cargo hold with editable quantities", () => {
    const props = renderLayout();
    const drones = screen.getByRole("group", { name: "Drone bay" });
    expect(within(drones).getByText("Hobgoblin II")).toBeInTheDocument();
    fireEvent.change(within(drones).getByLabelText("Hobgoblin II quantity"), { target: { value: "3" } });
    expect(props.onQuantity).toHaveBeenCalledWith("DroneBay", 2456, 3);

    const cargo = screen.getByRole("group", { name: "Cargo" });
    fireEvent.click(within(cargo).getByRole("button", { name: "Remove Hail S" }));
    expect(props.onRemoveEntry).toHaveBeenCalledWith("Cargo", 12608);
  });
});

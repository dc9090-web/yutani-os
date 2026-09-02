import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { fixtureData } from "../dogma/fixture.js";
import { CATEGORY } from "../../src/lib/dogma/index.js";
import { computeEditor } from "../../src/lib/fits/editor-view.js";
import { CARGO_FLAG, type FitDoc } from "../../src/lib/fits/doc.js";
import { CargoCard } from "../../src/app/fitting/CargoCard.js";

const data = fixtureData("rifter");
const allV = new Map<number, number>();
for (const t of data.types.values()) if (t.categoryId === CATEGORY.skill) allV.set(t.id, 5);

const DOC: FitDoc = {
  id: 1, name: "Cheap Rifter", description: "", shipTypeId: 587, characterId: "all-v",
  items: [
    { typeId: 2456, quantity: 2, flag: "DroneBay", chargeTypeId: null, state: "active" },
    { typeId: 12608, quantity: 600, flag: CARGO_FLAG, chargeTypeId: null, state: "active" },
    { typeId: 999999, quantity: 1, flag: "MedSlot0", chargeTypeId: null, state: "active" },
  ],
};

function renderCard(over: Partial<Parameters<typeof CargoCard>[0]> = {}) {
  const result = computeEditor(DOC, { data, skills: allV, implants: [] }, new Map());
  if (result.kind !== "ok") throw new Error("expected ok");
  const props = {
    drones: result.view.drones, cargo: result.view.cargo, unknown: result.view.unknown,
    onQuantity: vi.fn(), onRemoveEntry: vi.fn(), ...over,
  };
  render(<CargoCard {...props} />);
  return props;
}

describe("CargoCard", () => {
  it("shows the drone bay and the cargo hold with editable quantities and a hover description", () => {
    const props = renderCard();
    const drones = screen.getByRole("group", { name: "Drone bay" });
    expect(within(drones).getByText("Hobgoblin II")).toBeInTheDocument();
    expect(within(drones).getByText("Hobgoblin II")).toHaveAttribute("data-desc", "Hobgoblin II — Combat Drone");
    fireEvent.change(within(drones).getByLabelText("Hobgoblin II quantity"), { target: { value: "3" } });
    expect(props.onQuantity).toHaveBeenCalledWith("DroneBay", 2456, 3);

    const cargo = screen.getByRole("group", { name: "Cargo" });
    fireEvent.click(within(cargo).getByRole("button", { name: "Remove Hail S" }));
    expect(props.onRemoveEntry).toHaveBeenCalledWith("Cargo", 12608);
  });

  it("lists unlisted types as read-only, excluded from the calculation", () => {
    renderCard();
    expect(screen.getByText(/does not know these types/)).toBeInTheDocument();
    const unknown = screen.getByRole("group", { name: "Unknown types" });
    expect(within(unknown).getByText("Unknown type (999999)")).toBeInTheDocument();
    expect(within(unknown).queryByLabelText(/quantity/)).toBeNull();
  });

  it("says so when the drone bay and cargo hold are both empty", () => {
    renderCard({ drones: [], cargo: [], unknown: [] });
    expect(screen.getByText("Nothing in the drone bay or the cargo hold.")).toBeInTheDocument();
  });
});

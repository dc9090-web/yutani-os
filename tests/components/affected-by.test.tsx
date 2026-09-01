import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AffectedBy } from "../../src/app/ships/AffectedBy.js";

const rows = [
  { carrier: "Weapon Upgrades", operator: "%", value: "-25", penalised: false },
  { carrier: "Zainou 'Gypsy' CPU Management EE-601", operator: "%", value: "1", penalised: true },
];

describe("AffectedBy", () => {
  it("shows the value and opens the modifier list on click", () => {
    render(<AffectedBy label="CPU" value="6.75" rows={rows} />);
    const button = screen.getByRole("button");
    expect(button).toHaveTextContent("6.75");
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Weapon Upgrades")).toBeNull();

    fireEvent.click(button);
    expect(button).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Weapon Upgrades")).toBeInTheDocument();
    expect(screen.getByText("% -25")).toBeInTheDocument();
    expect(screen.getByText(/penalised/)).toBeInTheDocument();
  });

  it("closes again on a second click", () => {
    render(<AffectedBy label="CPU" value="6.75" rows={rows} />);
    const button = screen.getByRole("button");
    fireEvent.click(button);
    fireEvent.click(button);
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Weapon Upgrades")).toBeNull();
  });

  it("renders a plain number when nothing modifies the attribute", () => {
    render(<AffectedBy label="Powergrid" value="2.00" rows={[]} />);
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByText("2.00")).toBeInTheDocument();
  });
});

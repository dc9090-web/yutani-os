import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { NoCharacter } from "../../src/app/components/NoCharacter.js";

describe("NoCharacter", () => {
  it("renders the page title and the phase-1 empty card", () => {
    render(<NoCharacter title="Skills" />);
    expect(screen.getByRole("heading", { name: "Skills" })).toBeInTheDocument();
    expect(screen.getByText(/no characters yet/i)).toHaveClass("coming-soon");
  });
});

import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import { CharacterSwitcher } from "../../src/app/components/CharacterSwitcher.js";

const groups = [
  { label: "Main", characters: [{ id: 1, name: "TrilliumONE", accountId: 1, corporationName: null, allianceName: null, tokenStatus: "ok" as const }, { id: 2, name: "Reacher-9", accountId: 1, corporationName: null, allianceName: null, tokenStatus: "needs_reauth" as const }] },
  { label: "Alt", characters: [{ id: 3, name: "Sasha-9999", accountId: 2, corporationName: null, allianceName: null, tokenStatus: "ok" as const }] },
];
const ui = (activeId: number | null) => render(<MantineProvider><CharacterSwitcher groups={groups} activeId={activeId} pathname="/ships" /></MantineProvider>);

describe("CharacterSwitcher", () => {
  it("shows the active character in the trigger", () => {
    ui(3);
    expect(screen.getByRole("button", { name: /character menu/i })).toHaveTextContent("Sasha-9999");
  });
  it("lists groups, marks re-auth, and posts a switch form to /auth/switch with the current path", () => {
    ui(1);
    fireEvent.click(screen.getByRole("button", { name: /character menu/i }));
    expect(screen.getByText("Main")).toBeInTheDocument();
    expect(screen.getByText("Alt")).toBeInTheDocument();
    expect(screen.getByText(/re-authorise/i)).toBeInTheDocument();
    const form = screen.getByText("Reacher-9").closest("form")!;
    expect(form.getAttribute("action")).toBe("/auth/switch");
    expect((form.querySelector('input[name="characterId"]') as HTMLInputElement).value).toBe("2");
    expect((form.querySelector('input[name="next"]') as HTMLInputElement).value).toBe("/ships");
    expect(screen.getByRole("link", { name: /add character/i })).toHaveAttribute("href", "/auth/start");
  });
  it("falls back to 'Add character' when nothing is active", () => {
    ui(null);
    expect(screen.getByRole("button", { name: /character menu/i })).toHaveTextContent(/add character/i);
  });
});

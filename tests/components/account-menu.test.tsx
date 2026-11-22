import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import { AccountMenu } from "../../src/app/components/AccountMenu.js";

const ui = (initials: string | null, needsReauth = 0) =>
  render(<MantineProvider><AccountMenu account={{ initials, needsReauth }} /></MantineProvider>);

describe("AccountMenu", () => {
  it("shows the owner's initials and nothing else in the trigger", () => {
    ui("DC");
    const button = screen.getByRole("button", { name: "Account menu, DC" });
    expect(button).toHaveTextContent(/^DC$/);
  });
  it("draws an icon when no initials are configured", () => {
    ui(null);
    const button = screen.getByRole("button", { name: "Account menu" });
    expect(button.querySelector(".account-tile svg")).not.toBeNull();
  });
  it("links to add a character and settings, and posts logout", () => {
    ui("DC");
    fireEvent.click(screen.getByRole("button", { name: /account menu/i }));
    expect(screen.getByRole("link", { name: /add character/i })).toHaveAttribute("href", "/auth/start");
    expect(screen.getByRole("link", { name: /settings/i })).toHaveAttribute("href", "/settings");
    const logout = screen.getByText("Logout").closest("button")!;
    fireEvent.click(logout);
    expect(logout.isConnected).toBe(true);                     // the menu stays mounted so the submit can happen
    expect(logout.closest("form")?.getAttribute("action")).toBe("/auth/logout");
    expect(screen.queryByText(/re-authorise/i)).toBeNull();
  });
  it("flags characters that need re-authorising, on the button and in the menu", () => {
    ui("DC", 2);
    expect(document.querySelector(".account-warn")).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /account menu/i }));
    expect(screen.getByRole("link", { name: /2 characters to re-authorise/i })).toHaveAttribute("href", "/settings");
  });
});

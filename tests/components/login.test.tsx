import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { LoginCard } from "../../src/app/login/LoginCard.js";

describe("LoginCard", () => {
  it("links to /auth/google/start and explains errors", () => {
    render(<LoginCard error="not-allowed" />);
    expect(screen.getByRole("link", { name: /sign in with google/i })).toHaveAttribute("href", "/auth/google/start");
    expect(screen.getByText("That Google account is not allowed on this site.")).toBeInTheDocument();
  });
  it("no longer mentions EVE Online", () => {
    const { container } = render(<LoginCard error={null} />);
    expect(container.textContent).not.toMatch(/EVE Online/i);
    expect(screen.queryByText(/EVE Online/i)).toBeNull();
  });
  it("shows no error by default", () => {
    render(<LoginCard error={null} />);
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

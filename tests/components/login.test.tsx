import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { LoginCard } from "../../src/app/login/LoginCard.js";

describe("LoginCard", () => {
  it("links to /auth/start and explains errors", () => {
    render(<LoginCard error="not-allowed" />);
    expect(screen.getByRole("link", { name: /log in with eve online/i })).toHaveAttribute("href", "/auth/start");
    expect(screen.getByText(/not on the allow-list/i)).toBeInTheDocument();
  });
  it("shows no error by default", () => {
    render(<LoginCard error={null} />);
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

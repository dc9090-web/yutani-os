import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SyncStatus } from "../../src/app/settings/SyncStatus.js";
describe("SyncStatus", () => {
  it("renders a row per run with status badge and character name", () => {
    render(<SyncStatus runs={[{ job: "character-info", characterId: 1, startedAt: new Date(), finishedAt: new Date(), status: "error", rows: null, error: "boom" }]} names={{ 1: "TrilliumONE" }} />);
    expect(screen.getByText("character-info")).toBeInTheDocument();
    expect(screen.getByText("TrilliumONE")).toBeInTheDocument();
    expect(screen.getByText("error")).toHaveClass("badge");
    expect(screen.getByText("boom")).toBeInTheDocument();
  });
  it("shows an empty state", () => {
    render(<SyncStatus runs={[]} names={{}} />);
    expect(screen.getByText(/no sync runs yet/i)).toBeInTheDocument();
  });
});

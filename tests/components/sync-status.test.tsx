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
  it("lists every phase-3 job, including the global one with no character", () => {
    const names = ["sde-update", "character-info", "skills", "clones", "assets", "fittings", "wallet", "location"];
    render(<SyncStatus
      runs={names.map((job, i) => ({
        job, characterId: job === "sde-update" ? null : 1, startedAt: new Date("2026-09-01T12:00:00Z"),
        finishedAt: new Date("2026-09-01T12:00:05Z"), status: "ok" as const, rows: i, error: null,
      }))}
      names={{ 1: "TrilliumONE" }} />);
    for (const job of names) expect(screen.getByText(job)).toBeInTheDocument();
    expect(screen.getByText("—")).toBeInTheDocument();          // the global sde-update row
    expect(screen.getAllByText("TrilliumONE")).toHaveLength(7);
  });
});

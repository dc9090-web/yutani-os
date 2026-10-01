import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SystemStrip } from "../../src/app/components/SystemStrip.js";

describe("SystemStrip", () => {
  it("shows the sync, ESI, SDE and character readouts plus the UTC clock", () => {
    render(<SystemStrip sync="ok" esi="ok" sdeBuild={3113402} characters={4} now="2026-10-01T13:25:40.000Z" />);
    expect(screen.getByText("Sys online")).toBeInTheDocument();
    expect(screen.getByText("ESI · ok")).toBeInTheDocument();
    expect(screen.getByText("SDE 3113402")).toBeInTheDocument();
    expect(screen.getByText("4 characters")).toBeInTheDocument();
    expect(screen.getByText("2026-10-01 · 13:25 UTC")).toBeInTheDocument();
    expect(document.querySelector(".sys-dot")?.className).toBe("sys-dot ok");
  });

  it("names a degraded, syncing and idle system and a missing SDE", () => {
    const { rerender } = render(<SystemStrip sync="error" esi="error" sdeBuild={null} characters={1} now="2026-10-01T13:25:40.000Z" />);
    expect(screen.getByText("Sys degraded")).toBeInTheDocument();
    expect(screen.getByText("ESI · error")).toBeInTheDocument();
    expect(screen.getByText("SDE —")).toBeInTheDocument();
    expect(screen.getByText("1 character")).toBeInTheDocument();
    expect(document.querySelector(".sys-dot")?.className).toBe("sys-dot error");
    rerender(<SystemStrip sync="running" esi="running" sdeBuild={1} characters={0} now="2026-10-01T13:25:40.000Z" />);
    expect(screen.getByText("Sys syncing")).toBeInTheDocument();
    rerender(<SystemStrip sync="none" esi="none" sdeBuild={1} characters={0} now="2026-10-01T13:25:40.000Z" />);
    expect(screen.getByText("Sys idle")).toBeInTheDocument();
    expect(screen.getByText("ESI · —")).toBeInTheDocument();
  });
});

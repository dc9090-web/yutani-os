import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StaticDataPanel } from "../../src/app/settings/StaticDataPanel.js";

const meta = {
  buildNumber: 3484357,
  releaseDate: new Date("2026-08-28T11:07:12Z"),
  importedAt: new Date("2026-09-01T18:30:00Z"),
  counts: { types: 52863, dogmaAttributes: 2867, dogmaEffects: 3417, solarSystems: 8436 },
};

describe("StaticDataPanel", () => {
  it("shows the build, the dates and the four counts", () => {
    render(<StaticDataPanel meta={meta} />);
    expect(screen.getByText("Static data")).toBeInTheDocument();
    expect(screen.getByText("3484357")).toBeInTheDocument();
    expect(screen.getByText("2026-08-28 11:07")).toBeInTheDocument();
    expect(screen.getByText("2026-09-01 18:30")).toBeInTheDocument();
    expect(screen.getByText("52,863")).toBeInTheDocument();
    expect(screen.getByText("2,867")).toBeInTheDocument();
    expect(screen.getByText("3,417")).toBeInTheDocument();
    expect(screen.getByText("8,436")).toBeInTheDocument();
  });

  it("shows the empty state before the first import", () => {
    render(<StaticDataPanel meta={null} />);
    expect(screen.getByText(/not imported yet/i)).toBeInTheDocument();
    expect(screen.getByText(/the worker imports the SDE on its next run/i)).toBeInTheDocument();
    expect(screen.queryByText("Types")).toBeNull();
  });
});

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueueTable } from "../../src/app/skills/QueueTable.js";

const entries = [
  { position: 1, skill: "Caldari Frigate", level: "V", start: "2026-08-30 12:00", finish: "2026-08-31 18:30", progress: 0.42 },
  { position: 2, skill: "Gunnery", level: "III", start: "—", finish: "—", progress: null },
];

describe("QueueTable", () => {
  it("lists the queue and draws a progress bar on the head entry only", () => {
    const { container } = render(<QueueTable entries={entries} />);
    expect(screen.getByText("Caldari Frigate")).toBeInTheDocument();
    expect(screen.getByText("V")).toBeInTheDocument();
    expect(screen.getByText("2026-08-31 18:30")).toBeInTheDocument();
    const bars = container.querySelectorAll(".progress-fill");
    expect(bars).toHaveLength(1);
    expect(bars[0].getAttribute("style")).toContain("42%");
    expect(screen.getAllByText("—")).toHaveLength(2);    // the paused entry's two dates
  });

  it("shows the empty state when the queue is empty", () => {
    render(<QueueTable entries={[]} />);
    expect(screen.getByText(/nothing in the training queue/i)).toBeInTheDocument();
  });
});

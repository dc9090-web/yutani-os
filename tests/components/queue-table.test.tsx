import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueueTable, type QueueEntryView } from "../../src/app/skills/QueueTable.js";

const entries: QueueEntryView[] = [
  { position: 1, skillId: 3300, skill: "Gunnery", desc: "Basic turret operation skill.", targetLevel: 5, remaining: "6d 2h 40m", progress: 0.37 },
  { position: 2, skillId: 3327, skill: "Spaceship Command", desc: null, targetLevel: 4, remaining: "1d 2h", progress: null },
  { position: 3, skillId: 3327, skill: "Spaceship Command", desc: null, targetLevel: 5, remaining: "5d 9h 12m", progress: null },
];

describe("QueueTable", () => {
  it("lists the queue in order with the target level and time remaining", () => {
    render(<QueueTable entries={entries} />);
    const rows = screen.getAllByRole("listitem");
    expect(rows).toHaveLength(3);
    expect(rows[0]).toHaveTextContent("15Gunnery");
    expect(rows[0]).toHaveTextContent("6d 2h 40m");
    // A skill queued twice steps up one level per entry.
    expect(rows[1]).toHaveTextContent("24Spaceship Command1d 2h");
    expect(rows[2]).toHaveTextContent("35Spaceship Command5d 9h 12m");
  });

  it("gives the entry in training a TRAINING tag, a progress bar and a pulsing target block", () => {
    render(<QueueTable entries={entries} />);
    expect(screen.getAllByText("TRAINING")).toHaveLength(1);
    const bar = screen.getByRole("img", { name: "Progress 37%" });
    expect((bar.firstElementChild as HTMLElement).style.width).toBe("37%");
    expect(screen.getByText("37%")).toBeInTheDocument();
    const blocks = screen.getByRole("img", { name: "Training to level 5" });
    expect([...blocks.children].map((c) => c.className)).toEqual([
      "yo-block is-filled", "yo-block is-filled", "yo-block is-filled", "yo-block is-filled", "yo-block is-training",
    ]);
  });

  it("outlines a queued entry's target level and leaves higher levels empty", () => {
    render(<QueueTable entries={entries} />);
    const blocks = screen.getByRole("img", { name: "Queued to level 4" });
    expect([...blocks.children].map((c) => c.className)).toEqual([
      "yo-block is-filled", "yo-block is-filled", "yo-block is-filled", "yo-block is-queued", "yo-block",
    ]);
  });

  it("opens the skill's description inline from its info button, and has no button without one", () => {
    render(<QueueTable entries={entries} />);
    expect(screen.queryByText("Basic turret operation skill.")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "About Gunnery" }));
    expect(screen.getByText("Basic turret operation skill.")).toHaveClass("yo-info-panel");
    expect(screen.queryByRole("button", { name: "About Spaceship Command" })).toBeNull();
  });

  it("shows no bar for a paused queue", () => {
    render(<QueueTable entries={[{ ...entries[0], remaining: "—", progress: null }]} />);
    expect(screen.queryByText("TRAINING")).toBeNull();
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("shows the empty state when the queue is empty", () => {
    render(<QueueTable entries={[]} />);
    expect(screen.getByText("Nothing in the training queue.")).toBeInTheDocument();
  });
});

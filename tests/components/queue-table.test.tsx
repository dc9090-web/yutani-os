import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { QueueTable } from "../../src/app/skills/QueueTable.js";

const entries = [
  { position: 1, skill: "Caldari Frigate", desc: "Skill at operating Caldari frigates.", trainedLevel: 4, targetLevel: 5, duration: "1d 6h 30m", progress: 0.42 },
  { position: 2, skill: "Gunnery", desc: null, trainedLevel: 2, targetLevel: 3, duration: "—", progress: null },
];

describe("QueueTable", () => {
  it("lists the queue with duration and level-box columns, drawing a progress bar on the head entry only", () => {
    render(<QueueTable entries={entries} />);
    expect(screen.getByText("Caldari Frigate")).toBeInTheDocument();
    expect(screen.getByText("1d 6h 30m")).toBeInTheDocument();
    expect(screen.getByText("—")).toBeInTheDocument();   // the queued entry's missing duration
    const bar = screen.getByRole("progressbar");
    expect(bar.querySelector(".progress-fill")?.getAttribute("style")).toContain("42%");
    expect(screen.getByText("42%")).toBeInTheDocument();   // .progress-pct
    expect(screen.queryAllByRole("progressbar")).toHaveLength(1);
  });

  it("shows the training entry's level boxes as active up to trainedLevel, blinking at targetLevel", () => {
    render(<QueueTable entries={entries} />);
    const trainingRow = screen.getByText("Caldari Frigate").closest("tr")!;
    const boxes = within(trainingRow).getByLabelText("Trained level 4, training level 5");
    const cells = boxes.querySelectorAll(".level-box");
    expect(cells).toHaveLength(5);
    expect(within(trainingRow).getByLabelText(/training level 5/)).toBeInTheDocument();
    expect(boxes.querySelectorAll(".level-box.active")).toHaveLength(4);
    expect(boxes.querySelectorAll(".level-box.training")).toHaveLength(1);
  });

  it("shows a merely-queued entry's level boxes with no training box and the 'queued' label", () => {
    render(<QueueTable entries={entries} />);
    const queuedRow = screen.getByText("Gunnery").closest("tr")!;
    const boxes = within(queuedRow).getByLabelText("Trained level 2, level 3 queued");
    expect(boxes.querySelectorAll(".level-box.active")).toHaveLength(2);
    expect(boxes.querySelectorAll(".level-box.training")).toHaveLength(0);
  });

  it("hangs the SDE description off the skill name as hover text, and no hover at all when there is none", () => {
    render(<QueueTable entries={entries} />);
    expect(screen.getByText("Caldari Frigate").getAttribute("data-desc")).toBe("Skill at operating Caldari frigates.");
    expect(screen.getByText("Gunnery").hasAttribute("data-desc")).toBe(false);
  });

  it("shows the empty state when the queue is empty", () => {
    render(<QueueTable entries={[]} />);
    expect(screen.getByText(/nothing in the training queue/i)).toBeInTheDocument();
  });
});

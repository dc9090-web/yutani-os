import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { TrainingOverview } from "../../src/app/skills/TrainingOverview.js";
import type { TrainingQueueView } from "../../src/lib/view/training-overview.js";

const active: TrainingQueueView = {
  id: 1, name: "TrilliumONE", online: true,
  status: { kind: "eta", text: "29d 16h 11m" }, progress: 0.37, count: 22, truncated: true,
  rows: [
    { position: 1, skill: "Large Projectile Turret", trainedLevel: 4, targetLevel: 5, training: true, remaining: "9d 4h 12m" },
    { position: 2, skill: "Surgical Strike", trainedLevel: 4, targetLevel: 5, training: false, remaining: "6d 2h 40m" },
  ],
};
const paused: TrainingQueueView = {
  id: 2, name: "Reacher-9", online: null, status: { kind: "paused" }, progress: null, count: 1, truncated: false,
  rows: [{ position: 1, skill: "Caldari Battlecruiser", trainedLevel: 3, targetLevel: 4, training: false, remaining: "—" }],
};
const empty: TrainingQueueView = { id: 3, name: "Sasha-9999", online: false, status: { kind: "empty" }, progress: null, count: 0, truncated: false, rows: [] };
const unsynced: TrainingQueueView = { id: 4, name: "Lana C", online: null, status: { kind: "notSynced" }, progress: null, count: 0, truncated: false, rows: [] };

describe("TrainingOverview", () => {
  it("renders one card per character with the head progress bar, rows and the truncation note", () => {
    render(<TrainingOverview characters={[active, paused, empty, unsynced]} />);
    expect(screen.getByText("Training overview")).toBeInTheDocument();
    expect(document.querySelectorAll(".tq-card")).toHaveLength(4);

    const card = screen.getByText("TrilliumONE").closest(".tq-card") as HTMLElement;
    expect(within(card).getByText("29d 16h 11m")).toBeInTheDocument();
    expect(within(card).getByText("22")).toBeInTheDocument();              // .tq-count is the full queue length
    expect(within(card).getByRole("progressbar").querySelector(".progress-fill")?.getAttribute("style")).toContain("37%");
    expect(within(card).getByText("Large Projectile Turret")).toBeInTheDocument();
    expect(within(card).getByLabelText("Trained level 4, training level 5")).toBeInTheDocument();
    expect(within(card).getByText("Showing first 2 of 22")).toBeInTheDocument();
    expect(card.querySelector(".online-dot.on")).not.toBeNull();
  });

  it("shows paused, empty and not-synced states without a progress bar", () => {
    render(<TrainingOverview characters={[paused, empty, unsynced]} />);
    expect(screen.queryAllByRole("progressbar")).toHaveLength(0);
    expect(screen.getByText("Paused")).toBeInTheDocument();
    expect(screen.getByText("No skills in queue")).toBeInTheDocument();
    expect(screen.getByText("Not synced")).toBeInTheDocument();
    expect(screen.queryByText(/Showing first/)).toBeNull();
    expect(document.querySelectorAll(".online-dot")).toHaveLength(0);
  });
});

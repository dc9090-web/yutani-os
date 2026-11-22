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
  it("renders one card per character with the queue length, the current skill's bar, rows and the remainder", () => {
    render(<TrainingOverview characters={[active, paused, empty, unsynced]} />);
    expect(screen.getByRole("region", { name: "Training overview" })).toBeInTheDocument();
    expect(document.querySelectorAll(".tq-card")).toHaveLength(4);

    const card = screen.getByRole("heading", { name: /TrilliumONE/ }).closest(".tq-card") as HTMLElement;
    expect(within(card).getByText("29d 16h 11m")).toBeInTheDocument();
    expect(within(card).getByText("In queue").nextElementSibling).toHaveTextContent("22");   // the full queue length
    const bar = within(card).getByRole("img", { name: "Current skill progress 37%" });
    expect((bar.firstElementChild as HTMLElement).style.width).toBe("37%");
    expect(within(card).getByText("Large Projectile Turret")).toBeInTheDocument();
    // Levels below the target are solid; the target is amber — pulsing on the entry in training.
    const training = within(card).getByRole("img", { name: "Training to level 5" });
    expect([...training.children].map((c) => c.className)).toEqual([
      "yo-block is-filled", "yo-block is-filled", "yo-block is-filled", "yo-block is-filled", "yo-block is-training",
    ]);
    const queued = within(card).getByRole("img", { name: "Queued to level 5" });
    expect(queued.lastElementChild?.className).toBe("yo-block is-queued");
    expect(within(card).getByText("+20 more in queue")).toBeInTheDocument();
    expect(within(card).getByText("Online")).toHaveClass("yo-tag", "is-good");
  });

  it("shows paused, empty and not-synced states without a progress bar", () => {
    render(<TrainingOverview characters={[paused, empty, unsynced]} />);
    expect(screen.queryAllByRole("img", { name: /Current skill progress/ })).toHaveLength(0);
    expect(screen.getByText("Paused")).toBeInTheDocument();
    expect(screen.getByText("No skills in queue")).toBeInTheDocument();
    expect(screen.getByText("Not synced")).toBeInTheDocument();
    expect(screen.getByText("Skills not synced yet")).toBeInTheDocument();
    expect(screen.queryByText(/more in queue/)).toBeNull();
    expect(screen.queryByText("Online")).toBeNull();
  });

  it("shows the block legend", () => {
    render(<TrainingOverview characters={[active]} />);
    expect(screen.getByText("Trained")).toBeInTheDocument();
    expect(screen.getByText("Training now")).toBeInTheDocument();
    expect(screen.getByText("Queued")).toBeInTheDocument();
  });
});

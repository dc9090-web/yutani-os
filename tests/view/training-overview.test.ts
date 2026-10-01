import { describe, it, expect } from "vitest";
import { trainingQueueView, TRAINING_OVERVIEW_LIMIT } from "../../src/lib/view/training-overview.js";

const now = new Date("2026-10-01T12:00:00Z");
const names = new Map([[3300, "Gunnery"], [3301, "Small Projectile Turret"]]);

function entry(position: number, skillId: number, level: number, startH: number, finishH: number) {
  return {
    queuePosition: position, skillId, finishedLevel: level,
    startDate: new Date(now.getTime() + startH * 3_600_000), finishDate: new Date(now.getTime() + finishH * 3_600_000),
    levelStartSp: 0, levelEndSp: 1000, trainingStartSp: 0,
  };
}

const base = { id: 1, name: "TrilliumONE", online: true as boolean | null, synced: true };

describe("trainingQueueView", () => {
  it("shapes an active queue: eta to the last finish, head progress, rows with remaining time", () => {
    const view = trainingQueueView({ ...base, queue: [entry(0, 3300, 5, -2, 2), entry(1, 3301, 4, 2, 26)] }, names, now);
    expect(view.status).toEqual({ kind: "eta", text: "1d 2h" });
    expect(view.progress).toBe(0.5);
    expect(view.count).toBe(2);
    expect(view.truncated).toBe(false);
    expect(view.rows).toEqual([
      { position: 1, skill: "Gunnery", trainedLevel: 4, targetLevel: 5, training: true, remaining: "2h" },
      { position: 2, skill: "Small Projectile Turret", trainedLevel: 3, targetLevel: 4, training: false, remaining: "1d" },
    ]);
  });

  it("marks a paused queue (no dates) and gives its rows a dash", () => {
    const paused = { ...entry(0, 3300, 5, 0, 1), startDate: null, finishDate: null };
    const view = trainingQueueView({ ...base, queue: [paused] }, names, now);
    expect(view.status).toEqual({ kind: "paused" });
    expect(view.progress).toBeNull();
    expect(view.rows[0].remaining).toBe("—");
    expect(view.rows[0].training).toBe(false);
  });

  it("reports an empty queue and an unsynced character", () => {
    expect(trainingQueueView({ ...base, queue: [] }, names, now).status).toEqual({ kind: "empty" });
    expect(trainingQueueView({ ...base, synced: false, queue: [] }, names, now).status).toEqual({ kind: "notSynced" });
  });

  it("caps the rows at the overview limit but keeps the full count", () => {
    const queue = Array.from({ length: 25 }, (_, i) => entry(i, 3300, 1, i, i + 1));
    const view = trainingQueueView({ ...base, queue }, names, now);
    expect(view.rows).toHaveLength(TRAINING_OVERVIEW_LIMIT);
    expect(view.count).toBe(25);
    expect(view.truncated).toBe(true);
  });

  it("falls back to the skill id when the SDE has no name", () => {
    const view = trainingQueueView({ ...base, queue: [entry(0, 9999, 1, 0, 1)] }, names, now);
    expect(view.rows[0].skill).toBe("Skill 9999");
  });
});

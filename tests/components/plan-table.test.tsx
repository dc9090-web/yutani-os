import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { PlanTable } from "../../src/app/skills/PlanTable.js";
import type { PlanRowView } from "../../src/lib/view/plan.js";

const row = (over: Partial<PlanRowView>): PlanRowView => ({
  position: 1, skillId: 3300, skill: "Gunnery", group: "Gunnery", level: "I", levelNumber: 1,
  rank: "×1", sp: "250 SP", time: "8m", cumulative: "8m", doneAt: "2026-09-01 00:08",
  status: "planned", statusLabel: "Planned", prereq: false, alpha: true, note: null, unknown: false,
  entryIndex: null, ...over,
});
const ROWS: PlanRowView[] = [
  row({ position: 1, level: "I", levelNumber: 1, status: "done", statusLabel: "Done", prereq: true, time: "—" }),
  row({ position: 2, level: "II", levelNumber: 2, status: "queued", statusLabel: "In queue", prereq: true, time: "—" }),
  row({ position: 3, level: "III", levelNumber: 3, note: "for the Rifter", entryIndex: 0 }),
  row({ position: 4, skillId: 3329, skill: "Minmatar Frigate", group: "Spaceship Command",
        level: "I", levelNumber: 1, rank: "×2", entryIndex: 1 }),
];

const onMove = vi.fn(); const onRemove = vi.fn(); const onLevel = vi.fn();
beforeEach(() => { onMove.mockClear(); onRemove.mockClear(); onLevel.mockClear(); });

const table = (rows: PlanRowView[] = ROWS) =>
  render(<PlanTable rows={rows} onMove={onMove} onRemove={onRemove} onLevel={onLevel} />);

describe("PlanTable", () => {
  it("says so when the plan is empty", () => {
    table([]);
    expect(screen.getByText("No entries yet — add a skill to start planning.")).toBeInTheDocument();
  });

  it("renders one row per level with its status badge and tags", () => {
    table();
    const rows = screen.getAllByRole("row");
    expect(rows).toHaveLength(5);          // header + four entries
    // "Done" also names the doneAt column header, so scope to the status badge's own row —
    // the phase-5/6 standing ruling for selector ambiguity (see queue-table.test.tsx precedent).
    expect(within(rows[1]).getByText("Done")).toBeInTheDocument();
    expect(screen.getByText("In queue")).toBeInTheDocument();
    expect(screen.getAllByText("Planned")).toHaveLength(2);
    expect(screen.getAllByText("prereq")).toHaveLength(2);
    expect(screen.getAllByText("alpha")).toHaveLength(4);
    expect(screen.getByText("for the Rifter")).toBeInTheDocument();
    expect(screen.getAllByText("×1")).toHaveLength(3);           // the three Gunnery rows
  });

  it("gives a prerequisite row no actions at all", () => {
    table();
    expect(screen.queryByRole("button", { name: "Remove Gunnery I" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Raise Gunnery II" })).not.toBeInTheDocument();
  });

  it("moves, removes and re-levels by stored entry index", () => {
    table();
    fireEvent.click(screen.getByRole("button", { name: "Move Minmatar Frigate I up" }));
    expect(onMove).toHaveBeenCalledWith(1, -1);
    fireEvent.click(screen.getByRole("button", { name: "Remove Gunnery III" }));
    expect(onRemove).toHaveBeenCalledWith(0);
    fireEvent.click(screen.getByRole("button", { name: "Raise Gunnery III" }));
    expect(onLevel).toHaveBeenCalledWith(0, 1);
  });

  it("disables the moves at the ends and the levels at the extremes", () => {
    table([row({ position: 1, level: "V", levelNumber: 5, entryIndex: 0 })]);
    expect(screen.getByRole("button", { name: "Move Gunnery V up" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Move Gunnery V down" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Raise Gunnery V" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Lower Gunnery V" })).toBeEnabled();
  });

  it("renders an unknown skill without a rank or an alpha badge", () => {
    table([row({ skill: "Unknown skill (999999)", group: null, rank: "—", alpha: false, unknown: true, entryIndex: 0 })]);
    expect(screen.getByText("Unknown skill (999999)")).toBeInTheDocument();
    expect(screen.queryByText("alpha")).not.toBeInTheDocument();
  });
});

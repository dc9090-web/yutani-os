import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AttributesPanel } from "../../src/app/skills/AttributesPanel.js";
import type { AttributePanelView, RemapSuggestionView } from "../../src/lib/view/plan.js";

const PANEL: AttributePanelView = {
  attributes: [
    { key: "charisma", label: "Charisma", base: 18, bonus: 0, total: 18 },
    { key: "intelligence", label: "Intelligence", base: 20, bonus: 0, total: 20 },
    { key: "memory", label: "Memory", base: 18, bonus: 0, total: 18 },
    { key: "perception", label: "Perception", base: 21, bonus: 3, total: 24 },
    { key: "willpower", label: "Willpower", base: 22, bonus: 3, total: 25 },
  ],
  pairs: [{ label: "Perception / Willpower", spPerHour: "2,190 SP/h", entries: 3 }],
  remapAvailable: "available now", bonusRemaps: 2, sane: true,
};
const SUGGESTION: RemapSuggestionView = {
  deltas: [
    { key: "charisma", label: "Charisma", from: 18, to: 17, delta: "-1" },
    { key: "perception", label: "Perception", from: 21, to: 27, delta: "+6" },
  ],
  totalTime: "4d 17h 47m", currentTime: "5d 13h 20m", saved: "19h 33m", alreadyOptimal: false,
};

const onOptimise = vi.fn(); const onToggleRemap = vi.fn();
beforeEach(() => { onOptimise.mockClear(); onToggleRemap.mockClear(); });

describe("AttributesPanel", () => {
  it("shows the breakdown and the per-pair rate", () => {
    render(<AttributesPanel panel={PANEL} suggestion={null} optimising={false} usingRemap={false}
                            onOptimise={onOptimise} onToggleRemap={onToggleRemap} />);
    expect(screen.getByText("Perception")).toBeInTheDocument();
    expect(screen.getByText("24")).toBeInTheDocument();
    expect(screen.getAllByText("+3")).toHaveLength(2);           // perception and willpower implants
    expect(screen.getByText("2,190 SP/h")).toBeInTheDocument();
    expect(screen.getByText(/available now/)).toBeInTheDocument();
    expect(screen.getByText(/2 bonus remaps/)).toBeInTheDocument();
  });

  it("asks for an optimal remap and reports progress", () => {
    const { rerender } = render(
      <AttributesPanel panel={PANEL} suggestion={null} optimising={false} usingRemap={false}
                       onOptimise={onOptimise} onToggleRemap={onToggleRemap} />);
    fireEvent.click(screen.getByRole("button", { name: "Find optimal remap" }));
    expect(onOptimise).toHaveBeenCalledTimes(1);
    rerender(<AttributesPanel panel={PANEL} suggestion={null} optimising usingRemap={false}
                              onOptimise={onOptimise} onToggleRemap={onToggleRemap} />);
    expect(screen.getByRole("button", { name: "Optimising…" })).toBeDisabled();
  });

  it("shows the deltas and toggles planning with the remap", () => {
    render(<AttributesPanel panel={PANEL} suggestion={SUGGESTION} optimising={false} usingRemap={false}
                            onOptimise={onOptimise} onToggleRemap={onToggleRemap} />);
    expect(screen.getByText("+6")).toBeInTheDocument();
    expect(screen.getByText("19h 33m")).toBeInTheDocument();
    expect(screen.getByText("4d 17h 47m")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Plan with this remap"));
    expect(onToggleRemap).toHaveBeenCalledWith(true);
  });

  it("says when the current attributes are already optimal", () => {
    render(<AttributesPanel panel={PANEL} suggestion={{ ...SUGGESTION, alreadyOptimal: true, saved: "0m" }}
                            optimising={false} usingRemap={false}
                            onOptimise={onOptimise} onToggleRemap={onToggleRemap} />);
    expect(screen.getByText("Already optimal for this plan.")).toBeInTheDocument();
  });

  it("warns when the stored attributes cannot be a legal remap", () => {
    render(<AttributesPanel panel={{ ...PANEL, sane: false }} suggestion={null} optimising={false}
                            usingRemap={false} onOptimise={onOptimise} onToggleRemap={onToggleRemap} />);
    expect(screen.getByText(/cannot be a legal remap/)).toBeInTheDocument();
  });
});

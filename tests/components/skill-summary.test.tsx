import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SkillSummaryCard } from "../../src/app/skills/SkillSummaryCard.js";

const attributes = [
  { key: "charisma" as const, label: "Charisma", base: 20, bonus: 0, total: 20 },
  { key: "intelligence" as const, label: "Intelligence", base: 24, bonus: 5, total: 29 },
  { key: "memory" as const, label: "Memory", base: 21, bonus: 3, total: 24 },
  { key: "perception" as const, label: "Perception", base: 20, bonus: 0, total: 20 },
  { key: "willpower" as const, label: "Willpower", base: 21, bonus: 0, total: 21 },
];

describe("SkillSummaryCard", () => {
  it("shows the totals, every attribute and the implant bonuses", () => {
    render(<SkillSummaryCard totalSp="47.4M SP" unallocatedSp="210k SP" attributes={attributes}
      bonusRemaps={2} lastRemap="9 months ago" remapAvailable="in 45 days" />);
    expect(screen.getByText("47.4M SP")).toBeInTheDocument();
    expect(screen.getByText("210k SP")).toBeInTheDocument();
    expect(screen.getByText("Intelligence")).toBeInTheDocument();
    expect(screen.getByText("29")).toBeInTheDocument();
    expect(screen.getByText("+5")).toHaveClass("attr-bonus");
    expect(screen.getByText("+3")).toHaveClass("attr-bonus");
    expect(screen.queryByText("+0")).toBeNull();          // no bonus, no clutter
    expect(screen.getByText(/2 bonus remaps/)).toBeInTheDocument();
    expect(screen.getByText(/last remap 9 months ago/i)).toBeInTheDocument();
    expect(screen.getByText(/next remap in 45 days/i)).toBeInTheDocument();
  });

  it("degrades before the first sync", () => {
    render(<SkillSummaryCard totalSp={null} unallocatedSp={null} attributes={[]}
      bonusRemaps={null} lastRemap={null} remapAvailable={null} />);
    expect(screen.getByText(/not synced yet/i)).toBeInTheDocument();
    expect(screen.queryByText("Intelligence")).toBeNull();
  });
});

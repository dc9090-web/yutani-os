import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SkillGroups } from "../../src/app/skills/SkillGroups.js";

const groups = [
  {
    groupId: 255, name: "Gunnery", groupSp: "301k SP",
    skills: [
      { skillId: 3300, name: "Gunnery", trainedLevel: 5, activeLevel: 5, sp: "256k SP" },
      { skillId: 3301, name: "Small Hybrid Turret", trainedLevel: 4, activeLevel: 3, sp: "45k SP" },
    ],
  },
  { groupId: 1216, name: "Engineering", groupSp: "256k SP", skills: [{ skillId: 3426, name: "CPU Management", trainedLevel: 5, activeLevel: 5, sp: "256k SP" }] },
];

describe("SkillGroups", () => {
  it("starts collapsed, showing each group's name and SP", () => {
    render(<SkillGroups groups={groups} />);
    expect(screen.getByRole("button", { name: /Gunnery/ })).toBeInTheDocument();
    expect(screen.getByText(/301k SP/)).toBeInTheDocument();
    expect(screen.queryByText("Small Hybrid Turret")).toBeNull();
  });

  it("expands one group at a time on click and collapses it again", () => {
    render(<SkillGroups groups={groups} />);
    fireEvent.click(screen.getByRole("button", { name: /Gunnery/ }));
    expect(screen.getByText("Small Hybrid Turret")).toBeInTheDocument();
    expect(screen.queryByText("CPU Management")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Gunnery/ }));
    expect(screen.queryByText("Small Hybrid Turret")).toBeNull();
  });

  it("draws five level boxes per skill, dimming the levels that are trained but not active", () => {
    const { container } = render(<SkillGroups groups={groups} />);
    fireEvent.click(screen.getByRole("button", { name: /Gunnery/ }));
    const rows = container.querySelectorAll(".level-boxes");
    expect(rows).toHaveLength(2);
    expect(rows[0].querySelectorAll(".level-box")).toHaveLength(5);
    expect(rows[0].querySelectorAll(".level-box.active")).toHaveLength(5);   // trained 5, active 5
    expect(rows[1].querySelectorAll(".level-box.active")).toHaveLength(3);   // active 3
    expect(rows[1].querySelectorAll(".level-box.trained")).toHaveLength(1);  // level 4 trained, not active
  });

  it("shows the empty state for an unsynced sheet", () => {
    render(<SkillGroups groups={[]} />);
    expect(screen.getByText(/not synced yet/i)).toBeInTheDocument();
  });
});

import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { TrainedSkills } from "../../src/app/skills/TrainedSkills.js";

const groups = [
  {
    groupId: 255, name: "Gunnery", groupSp: "301k SP",
    skills: [
      { skillId: 3300, name: "Gunnery", desc: "Basic turret operation skill. 2% Bonus to weapon turrets' rate of fire per skill level.", trainedLevel: 5, activeLevel: 5 },
      { skillId: 3301, name: "Small Hybrid Turret", desc: null, trainedLevel: 4, activeLevel: 3 },
    ],
  },
  { groupId: 1216, name: "Engineering", groupSp: "256k SP", skills: [{ skillId: 3426, name: "CPU Management", desc: null, trainedLevel: 5, activeLevel: 5 }] },
];

describe("TrainedSkills", () => {
  it("renders every group always expanded, in the flat grid layout", () => {
    const { container } = render(<TrainedSkills groups={groups} />);
    expect(container.querySelectorAll(".skill-group-flat")).toHaveLength(2);
    expect(screen.getByText("Gunnery", { selector: ".group-head span" })).toBeInTheDocument();
    expect(screen.getByText(/301k SP/)).toBeInTheDocument();
    // Nothing is collapsed — every skill cell is present without any interaction.
    expect(screen.getByText("Small Hybrid Turret")).toBeInTheDocument();
    expect(screen.getByText("CPU Management")).toBeInTheDocument();
  });

  it("labels a fully-active skill with the plain 'Level N' form, and a trained/active mismatch with both numbers", () => {
    render(<TrainedSkills groups={groups} />);
    const gunneryCell = screen.getByText("Gunnery", { selector: ".skill-cell span" }).closest(".skill-cell") as HTMLElement;
    expect(within(gunneryCell).getByLabelText("Level 5")).toBeInTheDocument();

    const hybridCell = screen.getByText("Small Hybrid Turret").closest(".skill-cell") as HTMLElement;
    const boxes = within(hybridCell).getByLabelText("Trained level 4, active level 3");
    expect(boxes.querySelectorAll(".level-box.active")).toHaveLength(3);
    expect(boxes.querySelectorAll(".level-box.trained")).toHaveLength(1);
  });

  it("hangs the SDE description off the skill name as hover text, and no hover at all when there is none", () => {
    render(<TrainedSkills groups={groups} />);
    const gunnery = screen.getByText("Gunnery", { selector: ".skill-cell span" });
    expect(gunnery.getAttribute("data-desc")).toBe("Basic turret operation skill. 2% Bonus to weapon turrets' rate of fire per skill level.");
    expect(screen.getByText("Small Hybrid Turret").hasAttribute("data-desc")).toBe(false);
  });

  it("shows the empty state for an unsynced sheet", () => {
    render(<TrainedSkills groups={[]} />);
    expect(screen.getByText(/not synced yet/i)).toBeInTheDocument();
  });
});

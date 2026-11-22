import { describe, it, expect } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { TrainedSkills, type SheetGroupProps } from "../../src/app/skills/TrainedSkills.js";

const groups: SheetGroupProps[] = [
  {
    groupId: 255, name: "Gunnery", groupSp: "4.2M", queued: 3,
    skills: [
      { skillId: 3300, name: "Gunnery", desc: "Basic turret operation skill.", level: 5, activeLevel: 5, queued: 0, training: false },
      { skillId: 3301, name: "Small Hybrid Turret", desc: null, level: 3, activeLevel: 3, queued: 2, training: true },
      { skillId: 3302, name: "Small Projectile Turret", desc: null, level: 2, activeLevel: 2, queued: 1, training: false },
      { skillId: 3303, name: "Large Energy Turret", desc: null, level: 0, activeLevel: 0, queued: 0, training: false },
      { skillId: 3304, name: "Large Hybrid Turret", desc: null, level: 0, activeLevel: 0, queued: 1, training: false },
      { skillId: 3305, name: "Sharpshooter", desc: null, level: 5, activeLevel: 4, queued: 0, training: false },
    ],
  },
  { groupId: 257, name: "Spaceship Command", groupSp: "850k", queued: 0, skills: [{ skillId: 3327, name: "Spaceship Command", desc: null, level: 4, activeLevel: 4, queued: 0, training: false }] },
];

const classes = (label: string) => [...screen.getByRole("img", { name: label }).children].map((c) => c.className.replace("yo-block", "").replace(" is-", "") || "empty");

describe("TrainedSkills", () => {
  it("renders every group as a panel with its skill count, SP and queued levels", () => {
    render(<TrainedSkills groups={groups} queueLength={144} />);
    const gunnery = screen.getByRole("heading", { level: 2, name: "Gunnery" }).closest("section") as HTMLElement;
    expect(within(gunnery).getByText(/6 skills · 4.2M SP/)).toHaveTextContent("6 skills · 4.2M SP · 3 levels queued");
    const command = screen.getByRole("heading", { level: 2, name: "Spaceship Command" }).closest("section") as HTMLElement;
    expect(within(command).getByText(/1 skill · 850k SP/)).toHaveTextContent(/^1 skill · 850k SP$/);
    expect(screen.getByText("144 levels in queue")).toBeInTheDocument();
    expect(screen.getByText("Untrained")).toBeInTheDocument();
  });

  it("fills trained levels, outlines queued ones and pulses the level in training", () => {
    render(<TrainedSkills groups={groups} queueLength={3} />);
    expect(classes("Level 5 of 5")).toEqual(["filled", "filled", "filled", "filled", "filled"]);
    expect(classes("Level 3 of 5, training to level 5")).toEqual(["filled", "filled", "filled", "training", "queued"]);
    expect(classes("Level 2 of 5, queued to level 3")).toEqual(["filled", "filled", "queued", "empty", "empty"]);
    expect(screen.getAllByText("TRAINING")).toHaveLength(1);
    expect(screen.getByText("TRAINING").closest(".sk-row")).toHaveTextContent("Small Hybrid Turret");
  });

  it("dims an untrained skill unless it is queued", () => {
    render(<TrainedSkills groups={groups} queueLength={3} />);
    expect(screen.getByText("Large Energy Turret")).toHaveClass("is-untrained");
    expect(screen.getByText("Large Hybrid Turret")).not.toHaveClass("is-untrained");
    expect(screen.getByText("Small Hybrid Turret")).not.toHaveClass("is-untrained");
  });

  it("says so when a trained level is not active", () => {
    render(<TrainedSkills groups={groups} queueLength={3} />);
    expect(screen.getByRole("img", { name: "Trained level 5 of 5, active level 4" })).toBeInTheDocument();
    expect(screen.getByText("ACTIVE 4")).toBeInTheDocument();
  });

  it("opens the skill's description inline from its info button, and has no button without one", () => {
    render(<TrainedSkills groups={groups} queueLength={3} />);
    expect(screen.queryByText("Basic turret operation skill.")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "About Gunnery" }));
    expect(screen.getByText("Basic turret operation skill.")).toHaveClass("yo-info-panel");
    expect(screen.queryByRole("button", { name: "About Sharpshooter" })).toBeNull();
  });

  it("shows the empty state for an unsynced sheet", () => {
    render(<TrainedSkills groups={[]} queueLength={0} />);
    expect(screen.getByText(/Not synced yet/)).toBeInTheDocument();
  });
});

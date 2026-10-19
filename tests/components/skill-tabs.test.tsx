import { describe, it, expect, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SkillTabs } from "../../src/app/skills/SkillTabs.js";

const tabs = [
  { id: "skills", label: "Skills", content: <p>skills panel</p> },
  { id: "training", label: "Training", content: <p>training panel</p> },
  { id: "multiview", label: "Multiview", content: <p>multiview panel</p> },
];

describe("SkillTabs", () => {
  afterEach(() => history.replaceState(null, "", window.location.pathname));

  it("shows the first panel by default, with its tab marked active", () => {
    render(<SkillTabs tabs={tabs} />);
    expect(screen.getByText("skills panel")).toBeVisible();
    expect(screen.getByText("training panel")).not.toBeVisible();
    expect(screen.getByText("multiview panel")).not.toBeVisible();
    const skillsTab = screen.getByRole("tab", { name: "Skills" });
    const trainingTab = screen.getByRole("tab", { name: "Training" });
    expect(skillsTab).toHaveAttribute("data-active");
    expect(skillsTab).toHaveAttribute("aria-selected", "true");
    expect(trainingTab).not.toHaveAttribute("data-active");
    expect(trainingTab).toHaveAttribute("aria-selected", "false");
  });

  it("switches panels and active tab on click, and records the tab in the hash", () => {
    render(<SkillTabs tabs={tabs} />);
    fireEvent.click(screen.getByRole("tab", { name: "Multiview" }));
    expect(screen.getByText("multiview panel")).toBeVisible();
    expect(screen.getByText("skills panel")).not.toBeVisible();
    expect(screen.getByRole("tab", { name: "Multiview" })).toHaveAttribute("aria-selected", "true");
    expect(window.location.hash).toBe("#multiview");

    fireEvent.click(screen.getByRole("tab", { name: "Training" }));
    expect(screen.getByText("training panel")).toBeVisible();
    expect(screen.getByText("multiview panel")).not.toBeVisible();
  });

  it("opens on the tab named in the hash", () => {
    history.replaceState(null, "", "#training");
    render(<SkillTabs tabs={tabs} />);
    expect(screen.getByText("training panel")).toBeVisible();
    expect(screen.getByText("skills panel")).not.toBeVisible();
  });
});

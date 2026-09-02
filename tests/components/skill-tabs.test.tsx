import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SkillTabs } from "../../src/app/skills/SkillTabs.js";

describe("SkillTabs", () => {
  it("shows the training queue panel by default, with the queue tab marked active", () => {
    render(<SkillTabs queue={<p>queue panel</p>} trained={<p>trained panel</p>} />);
    expect(screen.getByText("queue panel")).toBeVisible();
    expect(screen.getByText("trained panel")).not.toBeVisible();
    const queueTab = screen.getByRole("tab", { name: "Training queue" });
    const trainedTab = screen.getByRole("tab", { name: "Trained skills" });
    expect(queueTab).toHaveAttribute("data-active");
    expect(queueTab).toHaveAttribute("aria-selected", "true");
    expect(trainedTab).not.toHaveAttribute("data-active");
    expect(trainedTab).toHaveAttribute("aria-selected", "false");
  });

  it("switches panels and active tab on click", () => {
    render(<SkillTabs queue={<p>queue panel</p>} trained={<p>trained panel</p>} />);
    fireEvent.click(screen.getByRole("tab", { name: "Trained skills" }));
    expect(screen.getByText("trained panel")).toBeVisible();
    expect(screen.getByText("queue panel")).not.toBeVisible();
    const trainedTab = screen.getByRole("tab", { name: "Trained skills" });
    expect(trainedTab).toHaveAttribute("data-active");
    expect(trainedTab).toHaveAttribute("aria-selected", "true");

    fireEvent.click(screen.getByRole("tab", { name: "Training queue" }));
    expect(screen.getByText("queue panel")).toBeVisible();
    expect(screen.getByText("trained panel")).not.toBeVisible();
  });
});

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ClonesCard } from "../../src/app/skills/ClonesCard.js";

describe("ClonesCard", () => {
  it("shows the home location, active implants with bonuses and every jump clone", () => {
    render(<ClonesCard
      home="Jita IV - Moon 4 - Caldari Navy Assembly Plant"
      implants={[
        { typeId: 9899, name: "Ocular Filter - Basic", bonus: "+3 Perception" },
        { typeId: 9941, name: "Zainou 'Gnome' Shield Management", bonus: null },
      ]}
      jumpClones={[
        { jumpCloneId: 1001, label: "Amarr VIII - Emperor Family Academy", name: "Amarr medical", implants: ["Ocular Filter - Basic"] },
        { jumpCloneId: 1002, label: "Unknown structure (1035…)", name: null, implants: [] },
      ]} />);
    expect(screen.getByText(/Caldari Navy Assembly Plant/)).toBeInTheDocument();
    expect(screen.getAllByText("Ocular Filter - Basic").length).toBeGreaterThan(0);   // active implant + jump clone 1001
    expect(screen.getByText("+3 Perception")).toBeInTheDocument();
    expect(screen.getByText("Zainou 'Gnome' Shield Management")).toBeInTheDocument();
    expect(screen.getByText("Amarr medical")).toBeInTheDocument();
    expect(screen.getByText("Unknown structure (1035…)")).toBeInTheDocument();
    expect(screen.getByText(/no implants/i)).toBeInTheDocument();
  });

  it("degrades before the clones job has run", () => {
    render(<ClonesCard home={null} implants={[]} jumpClones={[]} />);
    expect(screen.getByText(/not synced yet/i)).toBeInTheDocument();
  });
});

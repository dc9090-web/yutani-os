import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CharacterCard, type OverviewCard } from "../../src/app/components/CharacterCard.js";

const full: OverviewCard = {
  id: 669539978,
  name: "TrilliumONE",
  corp: "Caldari Navy · Northern Coalition",
  race: "Caldari",
  needsReauth: false,
  balance: "1,234,568",
  system: { name: "Jita", sec: "0.9", secClass: "sec-high" },
  dockedAt: "Jita IV - Moon 4 - Caldari Navy Assembly Plant",
  ship: { typeName: "Rifter", groupName: "Frigate" },
  online: null,
  training: { active: true, skill: "Caldari Frigate V", time: "3h 12m", percent: 64 },
  totalSp: "47.4M",
  accountTag: "MAIN",
  tags: ["Miner", "Scanner"],
};

const cell = (label: string) => screen.getByText(label).parentElement!;

describe("CharacterCard", () => {
  it("shows identity, SP, wallet, ship, location and training", () => {
    render(<CharacterCard card={full} />);
    expect(screen.getByRole("heading", { level: 2, name: "TrilliumONE" })).toBeInTheDocument();
    expect(screen.getByText("Caldari Navy · Northern Coalition · Caldari")).toBeInTheDocument();
    expect(cell("Total SP")).toHaveTextContent("47.4M");
    expect(cell("Wallet")).toHaveTextContent("Wallet1,234,568ISK");
    expect(cell("Ship")).toHaveTextContent("ShipRifterFrigate");
    expect(screen.getByText("0.9")).toHaveClass("sec-high");
    expect(cell("Location")).toHaveTextContent("0.9 Jita");
    const station = screen.getByText("Jita IV - Moon 4 - Caldari Navy Assembly Plant");
    expect(station).toHaveAttribute("title", "Jita IV - Moon 4 - Caldari Navy Assembly Plant");
    expect(screen.getByText("Caldari Frigate V")).toBeInTheDocument();
    expect(screen.getByText("3h 12m")).toHaveClass("ov-eta");
    expect(screen.getByRole("img", { name: "Training progress 64%" })).toBeInTheDocument();
    expect(screen.getByText("64%")).toBeInTheDocument();
  });

  it("gives MAIN the filled badge and any other account the outlined one", () => {
    const { rerender } = render(<CharacterCard card={full} />);
    expect(screen.getByText("MAIN").className).toBe("yo-tag is-main");
    rerender(<CharacterCard card={{ ...full, accountTag: "ALT" }} />);
    expect(screen.getByText("ALT").className).toBe("yo-tag");
    rerender(<CharacterCard card={{ ...full, accountTag: null }} />);
    expect(screen.queryByText("MAIN")).toBeNull();
    expect(screen.queryByText("ALT")).toBeNull();
  });

  it("shows the owner's role tags as chips, and keeps the row when there are none", () => {
    const { container, rerender } = render(<CharacterCard card={full} />);
    expect(screen.getByText("Miner")).toHaveClass("yo-chip");
    expect(screen.getByText("Scanner")).toHaveClass("yo-chip");
    rerender(<CharacterCard card={{ ...full, tags: [] }} />);
    expect(container.querySelector(".ov-roles")).not.toBeNull();
    expect(container.querySelectorAll(".yo-chip")).toHaveLength(0);
  });

  it("omits the race until the character-info job has stored one", () => {
    render(<CharacterCard card={{ ...full, race: null }} />);
    expect(screen.getByText("Caldari Navy · Northern Coalition")).toBeInTheDocument();
  });

  it("says Online in words only for a character who is online", () => {
    const { rerender } = render(<CharacterCard card={{ ...full, online: true }} />);
    expect(screen.getByText("Online")).toHaveClass("yo-tag", "is-good");
    rerender(<CharacterCard card={{ ...full, online: false }} />);
    expect(screen.queryByText("Online")).toBeNull();
    rerender(<CharacterCard card={{ ...full, online: null }} />);
    expect(screen.queryByText("Online")).toBeNull();
  });

  it("flags a character whose token needs re-authorising", () => {
    render(<CharacterCard card={{ ...full, needsReauth: true }} />);
    expect(screen.getByText("Re-authorise")).toHaveClass("yo-tag", "is-bad");
  });

  it("says In space for an undocked character", () => {
    render(<CharacterCard card={{ ...full, dockedAt: null }} />);
    expect(cell("Location")).toHaveTextContent("0.9 JitaIn space");
  });

  it("marks what has not synced yet instead of inventing values", () => {
    render(<CharacterCard card={{ ...full, balance: null, system: null, dockedAt: null, ship: null, totalSp: null, training: { active: false, label: "Not synced" } }} />);
    expect(screen.getAllByText("Not synced yet")).toHaveLength(3);
    expect(cell("Total SP")).toHaveTextContent("—");
    expect(screen.getByText("Not synced")).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: /Training progress/ })).toBeNull();
  });

  it("shows a message and no bar when the queue is empty", () => {
    render(<CharacterCard card={{ ...full, training: { active: false, label: "Queue empty" } }} />);
    expect(screen.getByText("Queue empty")).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: /Training progress/ })).toBeNull();
  });
});

import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { CharacterCard, type OverviewCard } from "../../src/app/components/CharacterCard.js";

const full: OverviewCard = {
  id: 669539978,
  name: "TrilliumONE",
  corp: "Caldari Navy · Northern Coalition",
  needsReauth: false,
  balance: "1,234,567.89 ISK",
  system: { name: "Jita", sec: "0.9", secClass: "sec-high" },
  dockedAt: "Jita IV - Moon 4 - Caldari Navy Assembly Plant",
  ship: "Rifter — Scarlet Dart",
  online: true,
  training: "Caldari Frigate V · 3h 12m",
  totalSp: "47.4M SP",
  account: "Main",
  tags: ["Miner", "Scanner"],
};

describe("CharacterCard", () => {
  it("shows the balance, location, ship, training and SP", () => {
    render(<CharacterCard card={full} />);
    expect(screen.getByRole("heading", { name: /TrilliumONE/ })).toBeInTheDocument();
    expect(screen.getByText("Caldari Navy · Northern Coalition")).toBeInTheDocument();
    expect(screen.getByText("1,234,567.89 ISK")).toBeInTheDocument();
    expect(screen.getByText("Jita")).toBeInTheDocument();
    expect(screen.getByText("0.9")).toHaveClass("sec-high");
    expect(screen.getByText(/Caldari Navy Assembly Plant/)).toBeInTheDocument();
    expect(screen.getByText("Rifter — Scarlet Dart")).toBeInTheDocument();
    expect(screen.getByText("Caldari Frigate V · 3h 12m")).toBeInTheDocument();
    expect(screen.getByText("47.4M SP")).toBeInTheDocument();
  });

  it("does not show a Last sync row", () => {
    render(<CharacterCard card={full} />);
    expect(screen.queryByText(/last sync/i)).not.toBeInTheDocument();
  });

  it("shows the online dot only when the online scope produced a value", () => {
    const { rerender, container } = render(<CharacterCard card={full} />);
    expect(container.querySelector(".online-dot.on")).not.toBeNull();
    rerender(<CharacterCard card={{ ...full, online: false }} />);
    expect(container.querySelector(".online-dot")).not.toBeNull();
    expect(container.querySelector(".online-dot.on")).toBeNull();
    rerender(<CharacterCard card={{ ...full, online: null }} />);
    expect(container.querySelector(".online-dot")).toBeNull();
  });

  it("shows the re-authorise badge for a broken token", () => {
    render(<CharacterCard card={{ ...full, needsReauth: true }} />);
    expect(screen.getByText("re-authorise")).toHaveClass("needs_reauth");
  });

  it("degrades to placeholders before the first sync", () => {
    render(<CharacterCard card={{
      ...full, balance: null, system: null, dockedAt: null, ship: null, online: null,
      training: "Not synced", totalSp: null,
    }} />);
    expect(screen.getAllByText("Not synced yet")).toHaveLength(2);   // wallet and location
    expect(screen.getAllByText("—")).toHaveLength(2);                // ship and total SP
    expect(screen.getByText("Not synced")).toBeInTheDocument();
  });

  it("shows an account pill when the character is assigned to an account", () => {
    render(<CharacterCard card={full} />);
    const pills = screen.getByText("Main");
    expect(pills).toHaveClass("pill");
  });

  it("shows no account pill when unassigned", () => {
    render(<CharacterCard card={{ ...full, account: null }} />);
    expect(screen.queryByText("Main")).not.toBeInTheDocument();
  });

  it("shows a pill per tag, and no pills row when there are no tags", () => {
    render(<CharacterCard card={full} />);
    const pillsRow = screen.getByText("Miner").closest<HTMLElement>(".ov-pills");
    expect(pillsRow).not.toBeNull();
    expect(within(pillsRow!).getByText("Scanner")).toBeInTheDocument();

    const { container } = render(<CharacterCard card={{ ...full, account: null, tags: [] }} />);
    expect(container.querySelector(".ov-pills")).toBeNull();
  });
});

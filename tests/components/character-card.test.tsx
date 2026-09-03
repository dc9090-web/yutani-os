import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { CharacterCard, type OverviewCard } from "../../src/app/components/CharacterCard.js";

const full: OverviewCard = {
  id: 669539978,
  name: "TrilliumONE",
  corp: "Caldari Navy · Northern Coalition",
  needsReauth: false,
  balance: "1,234,568 ISK",
  system: { name: "Jita", sec: "0.9", secClass: "sec-high" },
  dockedAt: "Jita IV - Moon 4 - Caldari Navy Assembly Plant",
  ship: { typeName: "Rifter", groupName: "Frigate" },
  online: true,
  training: { active: true, skill: "Caldari Frigate V", time: "3h 12m", percent: 64 },
  totalSp: "47.4M",
  account: "Main",
  tags: ["Miner", "Scanner"],
};

describe("CharacterCard", () => {
  it("shows the balance, location, ship, training and SP", () => {
    const { container } = render(<CharacterCard card={full} />);
    expect(screen.getByRole("heading", { name: /TrilliumONE/ })).toBeInTheDocument();
    expect(screen.getByText("Caldari Navy · Northern Coalition")).toBeInTheDocument();
    expect(screen.getByText("1,234,568 ISK")).toBeInTheDocument();
    expect(screen.getByText("0.9")).toHaveClass("sec-high");

    const locationRow = container.querySelectorAll(".ov-row")[1];
    expect(locationRow.textContent).toContain("Jita");
    expect(locationRow.textContent).toContain("Caldari Navy Assembly Plant");

    const shipRow = container.querySelectorAll(".ov-row")[2];
    expect(shipRow.querySelector(".ship-type-pills.ov-ship-pills")).not.toBeNull();
    expect(shipRow.textContent).toContain("Rifter");
    expect(shipRow.textContent).not.toContain("Scarlet Dart");   // the pilot's ship name is not shown here
    expect(screen.getByText("Frigate")).toHaveClass("pill");
    expect(screen.getByText("Rifter")).toHaveClass("pill");

    expect(screen.getByText("Caldari Frigate V")).toBeInTheDocument();
    expect(screen.getByText("3h 12m")).toHaveClass("dur");
    expect(screen.getByText("47.4M")).toBeInTheDocument();
    expect(screen.getByText("Total SP")).toBeInTheDocument();
  });

  it("shows a mini progress bar sized to the training percent", () => {
    render(<CharacterCard card={full} />);
    const bar = screen.getByRole("progressbar");
    expect(bar).toHaveAttribute("aria-valuenow", "64");
    expect(bar.querySelector(".progress-fill")).toHaveStyle({ width: "64%" });
  });

  it("shows the online dot only while the character is online", () => {
    const { rerender, container } = render(<CharacterCard card={full} />);
    expect(container.querySelector(".online-dot.on")).not.toBeNull();
    rerender(<CharacterCard card={{ ...full, online: false }} />);
    expect(container.querySelector(".online-dot")).toBeNull();   // offline: no grey dot
    rerender(<CharacterCard card={{ ...full, online: null }} />);
    expect(container.querySelector(".online-dot")).toBeNull();
  });

  it("shows the re-authorise badge, top-right of the head, for a broken token", () => {
    render(<CharacterCard card={{ ...full, needsReauth: true }} />);
    const badge = screen.getByText("re-authorise");
    expect(badge).toHaveClass("needs_reauth");
    expect(badge).toHaveClass("ov-status");
  });

  it("degrades to placeholders before the first sync", () => {
    render(<CharacterCard card={{
      ...full, balance: null, system: null, dockedAt: null, ship: null, online: null,
      training: { active: false, label: "Not synced" }, totalSp: null,
    }} />);
    expect(screen.getAllByText("Not synced yet")).toHaveLength(3);   // wallet, location and ship
    expect(screen.getAllByText("—")).toHaveLength(1);                // total SP
    expect(screen.getByText("Not synced")).toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });

  it("shows 'Queue empty' with no progress bar when the queue is empty", () => {
    render(<CharacterCard card={{ ...full, training: { active: false, label: "Queue empty" } }} />);
    expect(screen.getByText("Queue empty")).toHaveClass("faint");
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });

  it("shows an account pill when the character is assigned to an account", () => {
    render(<CharacterCard card={full} />);
    expect(screen.getByText("Main")).toHaveClass("pill main");
    expect(screen.getByText("Main").closest(".ov-head-right")).not.toBeNull();   // top-right of the card, not in the tag row
  });

  it("shows a plain pill for an account name that isn't Main or Alt", () => {
    render(<CharacterCard card={{ ...full, account: "Trial" }} />);
    const pill = screen.getByText("Trial");
    expect(pill).toHaveClass("pill");
    expect(pill).not.toHaveClass("main");
    expect(pill).not.toHaveClass("alt");
  });

  it("shows no account pill when unassigned", () => {
    render(<CharacterCard card={{ ...full, account: null }} />);
    expect(screen.queryByText("Main")).not.toBeInTheDocument();
  });

  it("shows one green tag pill per tag, and no pills row when there are none", () => {
    render(<CharacterCard card={full} />);
    const pillsRow = screen.getByText("Miner").closest<HTMLElement>(".ov-pills");
    expect(pillsRow).not.toBeNull();
    expect(within(pillsRow!).getByText("Miner")).toHaveClass("pill tag");
    expect(within(pillsRow!).getByText("Scanner")).toHaveClass("pill tag");

    const { container } = render(<CharacterCard card={{ ...full, account: null, tags: [] }} />);
    expect(container.querySelector(".ov-pills")).toBeNull();
  });

  it("gives an unknown tag name the same green tag pill", () => {
    render(<CharacterCard card={{ ...full, tags: ["Hauler"] }} />);
    const pill = screen.getByText("Hauler");
    expect(pill).toHaveClass("pill tag");
    expect(pill.className.trim()).toBe("pill tag");
  });
});

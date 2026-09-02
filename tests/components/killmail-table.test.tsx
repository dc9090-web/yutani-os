import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { KillmailTable } from "../../src/app/combat/KillmailTable.js";
import type { KillmailRowView } from "../../src/lib/view/combat.js";

const CID = 669539978;

function row(id: number, over: Partial<KillmailRowView> = {}): KillmailRowView {
  return {
    killmailId: id, href: `/combat/${id}`, time: "2026-09-01 12:00",
    role: "loss", roleLabel: "Loss", victimShipTypeId: 621, victimShip: "Caracal",
    victim: "TrilliumONE", victimCorp: "Trill Industries",
    system: "Jita", secClass: "sec-high", secText: "0.9",
    value: "8.1M ISK", attackers: "3", ourShip: "Caracal", ...over,
  };
}

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });
beforeEach(() => { vi.restoreAllMocks(); });

describe("KillmailTable", () => {
  it("renders a row with its badge, value and link", () => {
    render(<KillmailTable characterId={CID} period="90d" all={false}
             initial={[row(1)]} initialHasMore={false} />);
    expect(screen.getByRole("link", { name: /Caracal/ })).toHaveAttribute("href", "/combat/1");
    expect(screen.getByText("Loss")).toHaveClass("badge", "loss");
    expect(screen.getByText("8.1M ISK")).toBeInTheDocument();
    expect(screen.getByText("0.9")).toHaveClass("sec-high");
    expect(screen.queryByRole("button", { name: /show more/i })).toBeNull();
  });

  it("says so when there is nothing to show", () => {
    render(<KillmailTable characterId={CID} period="90d" all={false} initial={[]} initialHasMore={false} />);
    expect(screen.getByText(/no killmails/i)).toBeInTheDocument();
  });

  it("appends the next page, carrying the period and the all flag", async () => {
    const fetchMock = vi.fn(async () => new Response(
      JSON.stringify({ rows: [row(2, { roleLabel: "Kill", role: "kill" })], hasMore: false }),
      { status: 200 }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    render(<KillmailTable characterId={CID} period="1y" all
             initial={[row(1)]} initialHasMore />);
    fireEvent.click(screen.getByRole("button", { name: /show more/i }));
    await waitFor(() => expect(screen.getByText("Kill")).toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/characters/${CID}/killmails?offset=1&period=1y&all=1`);
    expect(screen.queryByRole("button", { name: /show more/i })).toBeNull();
  });

  it("shows the error and keeps the button when the request fails", async () => {
    globalThis.fetch = vi.fn(async () => new Response("nope", { status: 500 })) as unknown as typeof fetch;
    render(<KillmailTable characterId={CID} period="90d" all={false}
             initial={[row(1)]} initialHasMore />);
    fireEvent.click(screen.getByRole("button", { name: /show more/i }));
    await waitFor(() => expect(screen.getByText(/could not load more \(500\)/)).toHaveClass("neg"));
    expect(screen.getByRole("button", { name: /show more/i })).toBeInTheDocument();
  });
});

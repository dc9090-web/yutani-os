import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { JournalTable, TransactionsTable } from "../../src/app/wallet/WalletTables.js";
import type { JournalView, TransactionView } from "../../src/lib/view/wallet.js";

const CID = 669539978;

function journalRow(id: number, sign: "pos" | "neg" | "" = "neg"): JournalView {
  return {
    id, date: "2026-08-31 18:30", refType: "Market transaction", description: "",
    amount: sign === "" ? null : "-4,180.50 ISK", sign, balance: "1,234,567.89 ISK",
    firstParty: "TrilliumONE", secondParty: "Caldari Navy",
  };
}
function transactionRow(id: number): TransactionView {
  return {
    transactionId: id, date: "2026-08-31 18:30", side: "Buy", typeName: "Tritanium",
    quantity: "1,000", unitPrice: "4.18 ISK", total: "4,180.00 ISK",
    location: "Jita IV - Moon 4 - Caldari Navy Assembly Plant",
  };
}

const hundred = Array.from({ length: 100 }, (_, i) => journalRow(i + 1));

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });
beforeEach(() => { vi.restoreAllMocks(); });

describe("JournalTable", () => {
  it("colours the amount by sign and names both parties", () => {
    render(<JournalTable characterId={CID} initial={[journalRow(1), { ...journalRow(2), sign: "pos", amount: "1,000,000.00 ISK" }]} />);
    expect(screen.getByText("-4,180.50 ISK")).toHaveClass("neg");
    expect(screen.getByText("1,000,000.00 ISK")).toHaveClass("pos");
    expect(screen.getAllByText("TrilliumONE")).toHaveLength(2);
    expect(screen.getAllByText("Market transaction")).toHaveLength(2);
  });

  it("renders a row with no amount without a colour class", () => {
    const { container } = render(<JournalTable characterId={CID} initial={[journalRow(1, "")]} />);
    expect(container.querySelectorAll(".pos, .neg")).toHaveLength(0);
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
  });

  it("hides Show more when the first page is short", () => {
    render(<JournalTable characterId={CID} initial={[journalRow(1)]} />);
    expect(screen.queryByRole("button", { name: /show more/i })).toBeNull();
  });

  it("appends the next 100 rows from the API and stops when the page is short", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ rows: [journalRow(101), journalRow(102)] }), { status: 200 }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    render(<JournalTable characterId={CID} initial={hundred} />);
    fireEvent.click(screen.getByRole("button", { name: /show more/i }));
    await waitFor(() => expect(screen.getAllByRole("row")).toHaveLength(103));   // header + 102
    expect(fetchMock).toHaveBeenCalledWith(`/api/characters/${CID}/wallet?kind=journal&offset=100`);
    expect(screen.queryByRole("button", { name: /show more/i })).toBeNull();
  });

  it("reports a failed request instead of silently doing nothing", async () => {
    globalThis.fetch = vi.fn(async () => new Response("nope", { status: 500 })) as unknown as typeof fetch;
    render(<JournalTable characterId={CID} initial={hundred} />);
    fireEvent.click(screen.getByRole("button", { name: /show more/i }));
    await waitFor(() => expect(screen.getByText(/could not load more/i)).toHaveClass("neg"));
    expect(screen.getByRole("button", { name: /show more/i })).toBeInTheDocument();
  });

  it("shows the empty state before the first sync", () => {
    render(<JournalTable characterId={CID} initial={[]} />);
    expect(screen.getByText(/not synced yet/i)).toBeInTheDocument();
  });
});

describe("TransactionsTable", () => {
  it("shows side, type, quantity, prices and location", () => {
    render(<TransactionsTable characterId={CID} initial={[transactionRow(1)]} />);
    expect(screen.getByText("Buy")).toBeInTheDocument();
    expect(screen.getByText("Tritanium")).toBeInTheDocument();
    expect(screen.getByText("1,000")).toBeInTheDocument();
    expect(screen.getByText("4.18 ISK")).toBeInTheDocument();
    expect(screen.getByText("4,180.00 ISK")).toBeInTheDocument();
    expect(screen.getByText(/Caldari Navy Assembly Plant/)).toBeInTheDocument();
  });

  it("asks the API for the transactions page", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ rows: [] }), { status: 200 }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    render(<TransactionsTable characterId={CID} initial={Array.from({ length: 100 }, (_, i) => transactionRow(i + 1))} />);
    fireEvent.click(screen.getByRole("button", { name: /show more/i }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(`/api/characters/${CID}/wallet?kind=transactions&offset=100`));
  });

  it("shows the empty state before the first sync", () => {
    render(<TransactionsTable characterId={CID} initial={[]} />);
    expect(screen.getByText(/not synced yet/i)).toBeInTheDocument();
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { JournalTable, TransactionsTable } from "../../src/app/wallet/WalletTables.js";
import type { JournalView, TransactionView } from "../../src/lib/view/wallet.js";

const CID = 669539978;

function journalRow(id: number, extra: Partial<JournalView> = {}): JournalView {
  return {
    id, date: "2026-08-31 18:30", day: "2026-08-31", time: "18:30", refType: "Market transaction", description: "",
    amount: "-4,180.50 ISK", signedAmount: "−4,180.50", sign: "neg", balance: "1,234,567.89 ISK", balanceText: "1,234,567.89",
    firstParty: "TrilliumONE", secondParty: "Caldari Navy", withParty: "Caldari Navy", ...extra,
  };
}
function transactionRow(id: number, extra: Partial<TransactionView> = {}): TransactionView {
  return {
    transactionId: id, date: "2026-08-31 18:30", day: "2026-08-31", time: "18:30", side: "Buy", typeId: 34, typeName: "Tritanium",
    quantity: "1,000", unitPrice: "4.18 ISK", unitText: "4.18", total: "4,180.00 ISK", signedTotal: "−4,180.00",
    location: "Jita IV - Moon 4 - Caldari Navy Assembly Plant", system: { name: "Jita", sec: "0.9", secClass: "sec-high" }, ...extra,
  };
}

const hundred = Array.from({ length: 100 }, (_, i) => journalRow(i + 1));
const dataRows = () => screen.getAllByRole("row").slice(1);   // without the column header

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });
beforeEach(() => { vi.restoreAllMocks(); });

describe("JournalTable", () => {
  it("shows time, type, who it was with, the signed amount and the balance", () => {
    render(<JournalTable characterId={CID} initial={[journalRow(1)]} />);
    expect(screen.getAllByRole("columnheader").map((h) => h.textContent)).toEqual(["Time", "Type", "With", "Amount (ISK)", "Balance (ISK)"]);
    const [row] = dataRows();
    expect(within(row).getAllByRole("cell").map((c) => c.textContent)).toEqual(["18:30", "Market transaction", "Caldari Navy", "−4,180.50", "1,234,567.89"]);
  });

  it("colours money out coral and money in teal, with the sign saying the same", () => {
    render(<JournalTable characterId={CID} initial={[journalRow(1), journalRow(2, { signedAmount: "+10,000,000.00", sign: "pos" })]} />);
    expect(screen.getByText("−4,180.50")).toHaveClass("is-neg");
    expect(screen.getByText("+10,000,000.00")).toHaveClass("is-pos");
  });

  it("renders a row with no amount, party or balance without a colour", () => {
    render(<JournalTable characterId={CID} initial={[journalRow(1, { signedAmount: null, sign: "", withParty: null, balanceText: null })]} />);
    const cells = within(dataRows()[0]).getAllByRole("cell");
    expect(cells.map((c) => c.textContent)).toEqual(["18:30", "Market transaction", "—", "—", "—"]);
    expect(cells[3].className).toBe("wt-amount");
  });

  it("groups entries under a header per day with an entry count", () => {
    render(<JournalTable characterId={CID} initial={[
      journalRow(1), journalRow(2), journalRow(3, { day: "2026-08-30", time: "09:00" }),
    ]} />);
    const heads = screen.getAllByRole("heading", { level: 2 });
    expect(heads.map((h) => h.textContent)).toEqual(["2026-08-31", "2026-08-30"]);
    expect(heads[0].nextElementSibling).toHaveTextContent("2 entries");
    expect(heads[1].nextElementSibling).toHaveTextContent("1 entry");
  });

  it("hides Show more when the first page is short, and says how many there are", () => {
    render(<JournalTable characterId={CID} initial={[journalRow(1)]} />);
    expect(screen.queryByRole("button", { name: /show more/i })).toBeNull();
    expect(screen.getByText("All 1 journal entry")).toBeInTheDocument();
  });

  it("appends the next 100 rows from the API and stops when the page is short", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ rows: [journalRow(101), journalRow(102)] }), { status: 200 }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    render(<JournalTable characterId={CID} initial={hundred} />);
    expect(screen.getByText("Showing the latest 100 journal entries")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /show more/i }));
    await waitFor(() => expect(dataRows()).toHaveLength(102));
    expect(fetchMock).toHaveBeenCalledWith(`/api/characters/${CID}/wallet?kind=journal&offset=100`);
    expect(screen.queryByRole("button", { name: /show more/i })).toBeNull();
  });

  it("reports a failed request instead of silently doing nothing", async () => {
    globalThis.fetch = vi.fn(async () => new Response("nope", { status: 500 })) as unknown as typeof fetch;
    render(<JournalTable characterId={CID} initial={hundred} />);
    fireEvent.click(screen.getByRole("button", { name: /show more/i }));
    await waitFor(() => expect(screen.getByText(/could not load more/i)).toHaveClass("yo-bad"));
    expect(screen.getByRole("button", { name: /show more/i })).toBeInTheDocument();
  });

  it("shows the empty state before the first sync", () => {
    render(<JournalTable characterId={CID} initial={[]} />);
    expect(screen.getByText(/not synced yet/i)).toBeInTheDocument();
  });
});

describe("TransactionsTable", () => {
  it("shows time, side, item with its icon, quantity, unit price, signed total and location", () => {
    render(<TransactionsTable characterId={CID} initial={[transactionRow(1)]} />);
    const [row] = dataRows();
    expect(within(row).getAllByRole("cell").map((c) => c.textContent)).toEqual([
      "18:30", "BUY", "Tritanium", "1,000", "× 4.18", "−4,180.00", "0.9 Jita IV - Moon 4 - Caldari Navy Assembly Plant",
    ]);
    expect(within(row).getByText("0.9")).toHaveClass("yo-sec", "sec-high");
    expect(row.querySelector("img.wt-icon")?.getAttribute("src")).toBe("https://images.evetech.net/types/34/icon?size=32");
  });

  it("marks a buy coral and a sale teal, in the tag and the total", () => {
    render(<TransactionsTable characterId={CID} initial={[transactionRow(1), transactionRow(2, { side: "Sell", signedTotal: "+250,000.00" })]} />);
    expect(screen.getByText("BUY")).toHaveClass("is-neg");
    expect(screen.getByText("−4,180.00")).toHaveClass("is-neg");
    expect(screen.getByText("SELL")).toHaveClass("is-pos");
    expect(screen.getByText("+250,000.00")).toHaveClass("is-pos");
  });

  it("groups transactions by day", () => {
    render(<TransactionsTable characterId={CID} initial={[transactionRow(1), transactionRow(2, { day: "2026-08-30" })]} />);
    expect(screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual(["2026-08-31", "2026-08-30"]);
    expect(screen.getAllByText("1 transaction")).toHaveLength(2);
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

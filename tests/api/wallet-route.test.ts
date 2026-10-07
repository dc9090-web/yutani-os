import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// vi.mock factories are hoisted above every other statement, so the spies they close over must be
// created with vi.hoisted or they are still in the temporal dead zone when the factory runs.
const { getCharacter, loadJournalViews, loadTransactionViews } = vi.hoisted(() => ({
  getCharacter: vi.fn(), loadJournalViews: vi.fn(), loadTransactionViews: vi.fn(),
}));

vi.mock("../../src/lib/db/characters.js", () => ({ getCharacter }));
vi.mock("../../src/lib/view/wallet.js", () => ({ loadJournalViews, loadTransactionViews }));

const { GET } = await import("../../src/app/api/characters/[id]/wallet/route.js");

const CID = 669539978;
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const request = (query: string) => new NextRequest(`https://eve.example.com/api/characters/${CID}/wallet${query}`);

beforeEach(() => {
  vi.resetAllMocks();
  getCharacter.mockImplementation(async (id: number) => (id === CID ? { id: CID, name: "TrilliumONE" } : null));
  loadJournalViews.mockResolvedValue([{ id: 1, date: "2026-08-31 18:30", refType: "Market transaction", description: "", amount: null, sign: "", balance: null, firstParty: null, secondParty: null }]);
  loadTransactionViews.mockResolvedValue([{ transactionId: 2, date: "2026-08-31 18:30", side: "Buy", typeName: "Tritanium", quantity: "1,000", unitPrice: "4.18 ISK", total: "4,180.00 ISK", location: "Jita" }]);
});

describe("GET /api/characters/[id]/wallet", () => {
  it("returns journal rows at the requested offset", async () => {
    const res = await GET(request("?kind=journal&offset=100"), ctx(String(CID)));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ rows: [expect.objectContaining({ refType: "Market transaction" })] });
    expect(loadJournalViews).toHaveBeenCalledWith(CID, 100);
    expect(loadTransactionViews).not.toHaveBeenCalled();
  });

  it("returns transaction rows and defaults the offset to zero", async () => {
    const res = await GET(request("?kind=transactions"), ctx(String(CID)));
    expect(res.status).toBe(200);
    expect(loadTransactionViews).toHaveBeenCalledWith(CID, 0);
  });

  it("rejects a bad kind, a bad offset and a bad id", async () => {
    expect((await GET(request("?kind=ledger"), ctx(String(CID)))).status).toBe(400);
    expect((await GET(request(""), ctx(String(CID)))).status).toBe(400);
    expect((await GET(request("?kind=journal&offset=-1"), ctx(String(CID)))).status).toBe(400);
    expect((await GET(request("?kind=journal&offset=abc"), ctx(String(CID)))).status).toBe(400);
    expect((await GET(request("?kind=journal"), ctx("nope"))).status).toBe(400);
    expect(loadJournalViews).not.toHaveBeenCalled();
  });

  it("404s for a character that does not exist", async () => {
    const res = await GET(request("?kind=journal"), ctx("12345"));
    expect(res.status).toBe(404);
    expect(loadJournalViews).not.toHaveBeenCalled();
  });
});

import { describe, it, expect } from "vitest";
import { stamp, toJournalViews, toTransactionViews, WALLET_PAGE_SIZE } from "../../src/lib/view/wallet.js";
import type { JournalRow, TransactionRow } from "../../src/lib/db/character-wallet.js";

const journal: JournalRow[] = [
  {
    id: 24_000_000_001, date: new Date("2026-08-31T18:30:12Z"), refType: "market_transaction",
    description: "Market transaction", amount: -4180.5, balance: 1234567.89, reason: null,
    contextId: 99, contextIdType: "market_transaction_id",
    firstPartyId: 669539978, secondPartyId: 2112625428, tax: null, taxReceiverId: null,
  },
  {
    id: 24_000_000_002, date: new Date("2026-08-31T17:00:00Z"), refType: "brand_new_ref_type_2027",
    description: "", amount: null, balance: null, reason: null,
    contextId: null, contextIdType: null, firstPartyId: null, secondPartyId: 888, tax: null, taxReceiverId: null,
  },
  {
    id: 24_000_000_003, date: new Date("2026-08-31T16:00:00Z"), refType: "player_donation",
    description: "gift", amount: 1000000, balance: 1238748.39, reason: "thanks",
    contextId: null, contextIdType: null, firstPartyId: 2112625428, secondPartyId: 669539978, tax: null, taxReceiverId: null,
  },
];

const names = new Map([[669539978, "TrilliumONE"], [2112625428, "Caldari Navy"]]);

describe("toJournalViews", () => {
  it("formats the date, humanises the ref type and signs the amount", () => {
    const [first] = toJournalViews(journal, names);
    expect(first).toEqual({
      id: 24_000_000_001, date: "2026-08-31 18:30", refType: "Market transaction",
      description: "Market transaction", amount: "-4,180.50 ISK", sign: "neg", balance: "1,234,567.89 ISK",
      firstParty: "TrilliumONE", secondParty: "Caldari Navy",
    });
    expect(toJournalViews(journal, names)[2].sign).toBe("pos");
  });

  it("survives a row with no amount, no parties and a ref type nobody has seen", () => {
    const [, second] = toJournalViews(journal, names);
    expect(second.amount).toBeNull();
    expect(second.balance).toBeNull();
    expect(second.sign).toBe("");
    expect(second.refType).toBe("Brand new ref type 2027");
    expect(second.firstParty).toBeNull();
    expect(second.secondParty).toBe("ID 888");     // synced but not yet named
  });

  it("returns nothing for no rows", () => {
    expect(toJournalViews([], names)).toEqual([]);
    expect(WALLET_PAGE_SIZE).toBe(100);
    expect(stamp(new Date("2026-08-31T18:30:12Z"))).toBe("2026-08-31 18:30");
  });
});

const transactions: TransactionRow[] = [
  {
    transactionId: 7_000_000_001, date: new Date("2026-08-31T18:30:12Z"), typeId: 34,
    quantity: 1000, unitPrice: 4.18, clientId: 2112625428, locationId: 60003760,
    isBuy: true, isPersonal: true, journalRefId: 24_000_000_001,
  },
  {
    transactionId: 7_000_000_002, date: new Date("2026-08-31T12:00:00Z"), typeId: 999999,
    quantity: 1, unitPrice: 250000, clientId: null, locationId: null,
    isBuy: false, isPersonal: true, journalRefId: null,
  },
];

describe("toTransactionViews", () => {
  it("names the type and the location and multiplies out the total", () => {
    const [first] = toTransactionViews(
      transactions,
      new Map([[34, { name: "Tritanium" }]]),
      new Map([[60003760, { name: "Jita IV - Moon 4 - Caldari Navy Assembly Plant" }]]),
    );
    expect(first).toEqual({
      transactionId: 7_000_000_001, date: "2026-08-31 18:30", side: "Buy", typeName: "Tritanium",
      quantity: "1,000", unitPrice: "4.18 ISK", total: "4,180.00 ISK",
      location: "Jita IV - Moon 4 - Caldari Navy Assembly Plant",
    });
  });

  it("degrades for an unknown type and a missing location", () => {
    const [, second] = toTransactionViews(transactions, new Map(), new Map());
    expect(second.typeName).toBe("Type 999999");
    expect(second.location).toBe("—");
    expect(second.side).toBe("Sell");
  });
});

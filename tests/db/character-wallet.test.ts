import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { resetDb } from "./helpers.js";
import { closePool } from "../../src/lib/db/client.js";
import { upsertCharacter } from "../../src/lib/db/characters.js";
import { saveWallet, getWallet, listJournal, listTransactions, type JournalRow, type TransactionRow } from "../../src/lib/db/character-wallet.js";

const CID = 669539978;
beforeEach(async () => {
  await resetDb();
  await upsertCharacter({ id: CID, name: "TrilliumONE", refreshTokenEnc: "enc", scopes: [] });
});
afterAll(closePool);

const journal: JournalRow[] = [
  { id: 24000000001, date: new Date("2026-09-01T10:14:07Z"), refType: "market_transaction", description: "Market: bought Tritanium", amount: -418293.5, balance: 1234567.89, reason: null, contextId: 6100000001, contextIdType: "market_transaction_id", firstPartyId: 669539978, secondPartyId: 2112625428, tax: null, taxReceiverId: null },
  { id: 24000000004, date: new Date("2026-08-31T18:22:51Z"), refType: "corporate_reward_payout", description: "Corporation reward payout", amount: null, balance: null, reason: null, contextId: null, contextIdType: null, firstPartyId: null, secondPartyId: null, tax: null, taxReceiverId: null },
];
const transactions: TransactionRow[] = [
  { transactionId: 6100000001, date: new Date("2026-09-01T10:14:07Z"), typeId: 34, quantity: 100000, unitPrice: 4.18, clientId: 2112625428, locationId: 60003760, isBuy: true, isPersonal: true, journalRefId: 24000000001 },
];

describe("character-wallet repo", () => {
  it("upserts the balance and inserts journal and transaction rows", async () => {
    expect(await saveWallet(CID, { balance: 1234567.89, journal, transactions })).toBe(4);   // 1 + 2 + 1
    expect((await getWallet(CID))!.balance).toBe(1234567.89);
    const rows = await listJournal(CID);
    expect(rows.map((r) => r.id)).toEqual([24000000001, 24000000004]);   // newest first
    expect(rows[0].amount).toBe(-418293.5);
    expect(rows[1].amount).toBeNull();
    expect(rows[1].balance).toBeNull();
    expect((await listTransactions(CID))[0]).toMatchObject({ transactionId: 6100000001, unitPrice: 4.18, isBuy: true });
  });
  it("accumulates: re-importing the same journal adds nothing and keeps older rows", async () => {
    await saveWallet(CID, { balance: 1, journal, transactions });
    expect(await saveWallet(CID, { balance: 2, journal, transactions })).toBe(1);   // balance only
    expect((await listJournal(CID)).length).toBe(2);
    expect((await listTransactions(CID)).length).toBe(1);
    await saveWallet(CID, { balance: 3, journal: [{ ...journal[0], id: 24000000009, date: new Date("2026-09-02T00:00:00Z") }], transactions: [] });
    expect((await listJournal(CID)).map((r) => r.id)).toEqual([24000000009, 24000000001, 24000000004]);
    expect((await getWallet(CID))!.balance).toBe(3);
  });
  it("pages the journal newest-first", async () => {
    await saveWallet(CID, { balance: 1, journal, transactions: [] });
    expect((await listJournal(CID, { limit: 1 })).map((r) => r.id)).toEqual([24000000001]);
    expect((await listJournal(CID, { limit: 1, offset: 1 })).map((r) => r.id)).toEqual([24000000004]);
    expect(await listJournal(CID, { limit: 100, offset: 50 })).toEqual([]);
  });
  it("leaves the stored balance alone when it was not synced", async () => {
    await saveWallet(CID, { balance: 500, journal: [], transactions: [] });
    expect(await saveWallet(CID, { balance: null, journal: [], transactions: [] })).toBe(0);
    expect((await getWallet(CID))!.balance).toBe(500);
  });
  it("returns null for a character that has never synced", async () => {
    expect(await getWallet(CID)).toBeNull();
    expect(await listJournal(CID)).toEqual([]);
    expect(await listTransactions(CID)).toEqual([]);
  });
});

import { describe, it, expect, vi } from "vitest";
import {
  createWalletJob, walletJob, fetchTransactions, WALLET_INTERVAL_MS, WALLET_RETRY_MS,
  MAX_TRANSACTION_BATCHES, type EsiTransaction, type WalletJobDeps,
} from "../../src/worker/jobs/wallet.js";
import type { WalletWrite } from "../../src/lib/db/character-wallet.js";
import { EsiError, EsiUnavailableError } from "../../src/lib/esi/client.js";
import { NeedsReauthError } from "../../src/lib/esi/tokens.js";
import { esiFixture } from "../fixtures/esi.js";

const CID = 669539978;
const WALLET_SCOPE = "esi-wallet.read_character_wallet.v1";

function harness(scopes: string[] = [WALLET_SCOPE], over: Partial<WalletJobDeps> = {}) {
  const writes: WalletWrite[] = [];
  const resolved: number[][] = [];
  const resolvedPlaces: { ids: number[]; characterId: number }[] = [];
  const calls: { path: string; query?: Record<string, string | number> }[] = [];
  const deps: WalletJobDeps = {
    getCharacter: async () => ({ scopes }),
    saveWallet: async (_id, w) => { writes.push(w); return 7; },
    resolveNames: async (ids) => { resolved.push(ids); return new Map(); },
    resolveLocations: async (ids: number[], characterId: number) => { resolvedPlaces.push({ ids, characterId }); return new Map(); },
    ...over,
  };
  const esi = {
    get: vi.fn(async (path: string, opts?: { query?: Record<string, string | number> }) => {
      calls.push({ path, query: opts?.query });
      if (path.endsWith("/wallet")) return { data: esiFixture("wallet-balance") };
      if (path.endsWith("/wallet/transactions")) {
        return { data: opts?.query?.from_id === undefined ? esiFixture("wallet-transactions") : [] };
      }
      throw new Error(`unexpected ${path}`);
    }),
    getAll: vi.fn(async (path: string) => { calls.push({ path }); return esiFixture("wallet-journal"); }),
  };
  return { job: createWalletJob(deps), esi, writes, resolved, resolvedPlaces, calls };
}

describe("wallet job", () => {
  it("is an hourly character job that retries in 10 minutes", () => {
    expect(walletJob.name).toBe("wallet");
    expect(walletJob.intervalMs).toBe(WALLET_INTERVAL_MS);
    expect(WALLET_INTERVAL_MS).toBe(60 * 60 * 1000);
    expect(walletJob.retryMs).toBe(WALLET_RETRY_MS);
    expect(WALLET_RETRY_MS).toBe(10 * 60 * 1000);
    expect(MAX_TRANSACTION_BATCHES).toBe(10);
  });
  it("reads balance, journal and transactions and returns the repo's count", async () => {
    const h = harness();
    expect(await h.job.run({ characterId: CID, esi: h.esi as never })).toBe(7);
    expect(h.calls.map((c) => c.path)).toEqual([
      `/characters/${CID}/wallet`, `/characters/${CID}/wallet/journal`,
      `/characters/${CID}/wallet/transactions`, `/characters/${CID}/wallet/transactions`,
    ]);
    expect(h.writes[0].balance).toBe(1234567.89);
  });
  it("maps journal rows including one with no amount, balance or parties", async () => {
    const h = harness();
    await h.job.run({ characterId: CID, esi: h.esi as never });
    const journal = h.writes[0].journal;
    expect(journal).toHaveLength(4);
    expect(journal[0]).toEqual({
      id: 24000000001, date: new Date("2026-09-01T10:14:07Z"), refType: "market_transaction",
      description: "Market: TrilliumONE bought Tritanium", amount: -418293.5, balance: 1234567.89,
      reason: null, contextId: 6100000001, contextIdType: "market_transaction_id",
      firstPartyId: 669539978, secondPartyId: 2112625428, tax: null, taxReceiverId: null,
    });
    expect(journal[3]).toEqual({
      id: 24000000004, date: new Date("2026-08-31T18:22:51Z"), refType: "corporate_reward_payout",
      description: "Corporation reward payout", amount: null, balance: null, reason: null,
      contextId: null, contextIdType: null, firstPartyId: null, secondPartyId: null,
      tax: null, taxReceiverId: null,
    });
    expect(journal[1].tax).toBe(0);
    expect(journal[2].reason).toBe("for the doctrine");
  });
  it("maps transactions and resolves every party id exactly once", async () => {
    const h = harness();
    await h.job.run({ characterId: CID, esi: h.esi as never });
    expect(h.writes[0].transactions[0]).toEqual({
      transactionId: 6100000001, date: new Date("2026-09-01T10:14:07Z"), typeId: 34, quantity: 100000,
      unitPrice: 4.18, clientId: 2112625428, locationId: 60003760, isBuy: true, isPersonal: true,
      journalRefId: 24000000001,
    });
    expect(h.resolved).toHaveLength(1);
    expect([...h.resolved[0]].sort((a, b) => a - b)).toEqual([1000035, 669539978, 2112625428, 2124678472]);
  });
  it("returns 0 without calling ESI when the scope is missing", async () => {
    const h = harness([]);
    expect(await h.job.run({ characterId: CID, esi: h.esi as never })).toBe(0);
    expect(h.calls).toEqual([]);
    expect(h.writes).toEqual([]);
  });
  it("lets an ESI outage propagate without writing or resolving anything", async () => {
    const h = harness();
    h.esi.get = vi.fn(async () => { throw new EsiUnavailableError(`/characters/${CID}/wallet`, Date.now() + 60_000); });
    await expect(h.job.run({ characterId: CID, esi: h.esi as never })).rejects.toBeInstanceOf(EsiUnavailableError);
    expect(h.writes).toEqual([]);
    expect(h.resolved).toEqual([]);
  });
  it("resolves every transaction location so the wallet page can label it", async () => {
    const h = harness();
    await h.job.run({ characterId: CID, esi: h.esi as never });
    expect(h.resolvedPlaces).toHaveLength(1);
    expect(h.resolvedPlaces[0].characterId).toBe(CID);
    expect(h.resolvedPlaces[0].ids).toContain(60003760);
  });
  it("does not fail the run when resolveLocations throws a non-outage error", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const h = harness([WALLET_SCOPE], { resolveLocations: async () => { throw new Error("boom"); } });
    await expect(h.job.run({ characterId: CID, esi: h.esi as never })).resolves.toBe(7);
    expect(warn).toHaveBeenCalledWith(`[wallet] location resolution failed for ${CID}: boom`);
    warn.mockRestore();
  });
  it("still rejects when resolveLocations throws an EsiUnavailableError", async () => {
    const h = harness([WALLET_SCOPE], { resolveLocations: async () => { throw new EsiUnavailableError("/universe/structures/1", Date.now() + 60_000); } });
    await expect(h.job.run({ characterId: CID, esi: h.esi as never })).rejects.toBeInstanceOf(EsiUnavailableError);
  });
  it("still rejects when resolveLocations throws a NeedsReauthError", async () => {
    const h = harness([WALLET_SCOPE], { resolveLocations: async () => { throw new NeedsReauthError(CID); } });
    await expect(h.job.run({ characterId: CID, esi: h.esi as never })).rejects.toBeInstanceOf(NeedsReauthError);
  });
  it("still rejects when resolveLocations throws an EsiError(401)", async () => {
    const h = harness([WALLET_SCOPE], { resolveLocations: async () => { throw new EsiError(401, "/universe/structures/1", "token rejected"); } });
    await expect(h.job.run({ characterId: CID, esi: h.esi as never })).rejects.toMatchObject({ status: 401 });
  });
});

function tx(id: number): EsiTransaction {
  return {
    transaction_id: id, date: "2026-09-01T10:00:00Z", type_id: 34, quantity: 1, unit_price: 1,
    client_id: 1, location_id: 60003760, is_buy: true, is_personal: true, journal_ref_id: id,
  };
}

describe("fetchTransactions", () => {
  function source(batches: EsiTransaction[][]) {
    const queries: (number | undefined)[] = [];
    const esi = {
      get: async <T,>(_path: string, opts?: { query?: Record<string, string | number> }) => {
        queries.push(opts?.query?.from_id as number | undefined);
        return { data: (batches.shift() ?? []) as T };
      },
    };
    return { esi, queries };
  }

  it("walks backwards with from_id = min(transaction_id) - 1 until a batch is empty", async () => {
    const s = source([[tx(30), tx(29)], [tx(28), tx(27)], []]);
    const out = await fetchTransactions(s.esi, CID);
    expect(out.map((t) => t.transaction_id)).toEqual([30, 29, 28, 27]);
    expect(s.queries).toEqual([undefined, 28, 26]);
  });
  it("stops when a batch brings nothing new", async () => {
    const s = source([[tx(30), tx(29)], [tx(30), tx(29)], [tx(28)]]);
    const out = await fetchTransactions(s.esi, CID);
    expect(out.map((t) => t.transaction_id)).toEqual([30, 29]);
    expect(s.queries).toEqual([undefined, 28]);
  });
  it("stops after at most 10 batches so a busy trader cannot drain the char-wallet bucket", async () => {
    const s = source(Array.from({ length: 20 }, (_, i) => [tx(1000 - i)]));
    const out = await fetchTransactions(s.esi, CID);
    expect(out).toHaveLength(MAX_TRANSACTION_BATCHES);
    expect(s.queries).toHaveLength(MAX_TRANSACTION_BATCHES);
  });
  it("honours a lower batch cap and returns nothing for an immediately empty wallet", async () => {
    const s = source([[tx(9)], [tx(8)], [tx(7)]]);
    expect(await fetchTransactions(s.esi, CID, 2)).toHaveLength(2);
    const empty = source([[]]);
    expect(await fetchTransactions(empty.esi, CID)).toEqual([]);
    expect(empty.queries).toEqual([undefined]);
  });
});

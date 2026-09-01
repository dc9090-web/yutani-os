import type { CharacterSyncJob } from "../scheduler.js";
import { hasScope } from "../../lib/auth/sso.js";
import { getCharacter } from "../../lib/db/characters.js";
import { saveWallet, type JournalRow, type TransactionRow, type WalletWrite } from "../../lib/db/character-wallet.js";
import { resolveNames } from "../../lib/names/index.js";

export const WALLET_INTERVAL_MS = 60 * 60 * 1000;
export const WALLET_RETRY_MS = 10 * 60 * 1000;
/** The char-wallet bucket is 150 tokens / 15 min across all three wallet routes — walk gently. */
export const MAX_TRANSACTION_BATCHES = 10;
const WALLET_SCOPE = "esi-wallet.read_character_wallet.v1";

interface EsiJournalEntry {
  id: number; date: string; ref_type: string; description: string;
  amount?: number; balance?: number; reason?: string;
  context_id?: number; context_id_type?: string;
  first_party_id?: number; second_party_id?: number;
  tax?: number; tax_receiver_id?: number;
}
export interface EsiTransaction {
  transaction_id: number; date: string; type_id: number; quantity: number; unit_price: number;
  client_id: number; location_id: number; is_buy: boolean; is_personal: boolean; journal_ref_id: number;
}
export interface TransactionSource {
  get<T>(path: string, opts?: { characterId?: number; query?: Record<string, string | number> }): Promise<{ data: T }>;
}

export interface WalletJobDeps {
  getCharacter: (id: number) => Promise<{ scopes: string[] } | null>;
  saveWallet: (characterId: number, w: WalletWrite) => Promise<number>;
  resolveNames: (ids: number[]) => Promise<unknown>;
}

const nullable = (v: number | undefined): number | null => (v === undefined ? null : v);
const nullableStr = (v: string | undefined): string | null => (v === undefined ? null : v);

function toJournalRow(e: EsiJournalEntry): JournalRow {
  return {
    id: e.id, date: new Date(e.date), refType: e.ref_type, description: e.description,
    amount: nullable(e.amount), balance: nullable(e.balance), reason: nullableStr(e.reason),
    contextId: nullable(e.context_id), contextIdType: nullableStr(e.context_id_type),
    firstPartyId: nullable(e.first_party_id), secondPartyId: nullable(e.second_party_id),
    tax: nullable(e.tax), taxReceiverId: nullable(e.tax_receiver_id),
  };
}

function toTransactionRow(t: EsiTransaction): TransactionRow {
  return {
    transactionId: t.transaction_id, date: new Date(t.date), typeId: t.type_id,
    quantity: t.quantity, unitPrice: t.unit_price, clientId: t.client_id,
    locationId: t.location_id, isBuy: t.is_buy, isPersonal: t.is_personal, journalRefId: t.journal_ref_id,
  };
}

/**
 * /wallet/transactions has no X-Pages: it walks backwards through a `from_id` cursor. Repeat with
 * `from_id = min(transaction_id) - 1` while the batch is non-empty and brings at least one id we
 * have not already collected in this run, and never more than `maxBatches` times.
 */
export async function fetchTransactions(
  esi: TransactionSource, characterId: number, maxBatches = MAX_TRANSACTION_BATCHES,
): Promise<EsiTransaction[]> {
  const out: EsiTransaction[] = [];
  const seen = new Set<number>();
  let fromId: number | undefined;
  for (let batchNo = 0; batchNo < maxBatches; batchNo++) {
    const query: Record<string, string | number> | undefined = fromId === undefined ? undefined : { from_id: fromId };
    const batch = (await esi.get<EsiTransaction[]>(`/characters/${characterId}/wallet/transactions`, { characterId, query })).data;
    if (batch.length === 0) break;
    let fresh = 0;
    let lowest = Number.POSITIVE_INFINITY;
    for (const t of batch) {
      if (!seen.has(t.transaction_id)) { seen.add(t.transaction_id); out.push(t); fresh++; }
      if (t.transaction_id < lowest) lowest = t.transaction_id;
    }
    if (fresh === 0) break;
    fromId = lowest - 1;
  }
  return out;
}

export function createWalletJob(deps: WalletJobDeps): CharacterSyncJob {
  return {
    name: "wallet",
    intervalMs: WALLET_INTERVAL_MS,
    retryMs: WALLET_RETRY_MS,
    async run({ characterId, esi }) {
      const character = await deps.getCharacter(characterId);
      if (!hasScope(character, WALLET_SCOPE)) return 0;

      // GET /wallet returns a bare double, not an object.
      const balance = (await esi.get<number>(`/characters/${characterId}/wallet`, { characterId })).data;
      const journal = await esi.getAll<EsiJournalEntry>(`/characters/${characterId}/wallet/journal`, { characterId });
      const transactions = await fetchTransactions(esi, characterId);

      const written = await deps.saveWallet(characterId, {
        balance, journal: journal.map(toJournalRow), transactions: transactions.map(toTransactionRow),
      });

      const parties = new Set<number>();
      for (const j of journal) {
        for (const id of [j.first_party_id, j.second_party_id]) if (typeof id === "number" && id > 0) parties.add(id);
      }
      for (const t of transactions) if (t.client_id > 0) parties.add(t.client_id);
      await deps.resolveNames([...parties]);
      return written;
    },
  };
}

export const walletJob: CharacterSyncJob = createWalletJob({ getCharacter, saveWallet, resolveNames });

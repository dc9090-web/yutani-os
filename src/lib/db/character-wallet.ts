import { getPool } from "./client.js";
import { chunk } from "../chunk.js";

export interface JournalRow {
  id: number; date: Date; refType: string; description: string;
  amount: number | null; balance: number | null; reason: string | null;
  contextId: number | null; contextIdType: string | null;
  firstPartyId: number | null; secondPartyId: number | null;
  tax: number | null; taxReceiverId: number | null;
}
export interface TransactionRow {
  transactionId: number; date: Date; typeId: number; quantity: number; unitPrice: number;
  clientId: number | null; locationId: number | null; isBuy: boolean; isPersonal: boolean; journalRefId: number | null;
}
/** `balance: null` = the wallet endpoint was not synced this run; journal/transactions accumulate. */
export interface WalletWrite { balance: number | null; journal: JournalRow[]; transactions: TransactionRow[] }
export interface WalletRow { characterId: number; balance: number; updatedAt: Date }

const INSERT_BATCH = 2000;
const num = (v: string | null): number | null => (v === null ? null : Number(v));
const bigints = (v: (number | null)[]): (string | null)[] => v.map((n) => (n === null ? null : String(n)));

/**
 * ESI keeps only 30 days of journal, so rows accumulate for ever and are deduplicated on their
 * stable ids with ON CONFLICT DO NOTHING. Returns the number of rows actually written.
 */
export async function saveWallet(characterId: number, w: WalletWrite): Promise<number> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    let rows = 0;
    if (w.balance !== null) {
      await client.query(
        `INSERT INTO character_wallet (character_id, balance, updated_at) VALUES ($1, $2, now())
         ON CONFLICT (character_id) DO UPDATE SET balance = EXCLUDED.balance, updated_at = now()`,
        [characterId, w.balance]);
      rows += 1;
    }
    for (const batch of chunk(w.journal, INSERT_BATCH)) {
      const res = await client.query(
        `INSERT INTO character_wallet_journal (character_id, id, date, ref_type, description, amount,
           balance, reason, context_id, context_id_type, first_party_id, second_party_id, tax, tax_receiver_id)
         SELECT $1, * FROM unnest($2::bigint[], $3::timestamptz[], $4::text[], $5::text[], $6::numeric[],
           $7::numeric[], $8::text[], $9::bigint[], $10::text[], $11::bigint[], $12::bigint[],
           $13::numeric[], $14::bigint[])
         ON CONFLICT (character_id, id) DO NOTHING`,
        [characterId, batch.map((j) => String(j.id)), batch.map((j) => j.date), batch.map((j) => j.refType),
         batch.map((j) => j.description), batch.map((j) => j.amount), batch.map((j) => j.balance),
         batch.map((j) => j.reason), bigints(batch.map((j) => j.contextId)), batch.map((j) => j.contextIdType),
         bigints(batch.map((j) => j.firstPartyId)), bigints(batch.map((j) => j.secondPartyId)),
         batch.map((j) => j.tax), bigints(batch.map((j) => j.taxReceiverId))]);
      rows += res.rowCount ?? 0;
    }
    for (const batch of chunk(w.transactions, INSERT_BATCH)) {
      const res = await client.query(
        `INSERT INTO character_wallet_transactions (character_id, transaction_id, date, type_id, quantity,
           unit_price, client_id, location_id, is_buy, is_personal, journal_ref_id)
         SELECT $1, * FROM unnest($2::bigint[], $3::timestamptz[], $4::int[], $5::bigint[], $6::numeric[],
           $7::bigint[], $8::bigint[], $9::bool[], $10::bool[], $11::bigint[])
         ON CONFLICT (character_id, transaction_id) DO NOTHING`,
        [characterId, batch.map((t) => String(t.transactionId)), batch.map((t) => t.date), batch.map((t) => t.typeId),
         batch.map((t) => String(t.quantity)), batch.map((t) => t.unitPrice), bigints(batch.map((t) => t.clientId)),
         bigints(batch.map((t) => t.locationId)), batch.map((t) => t.isBuy), batch.map((t) => t.isPersonal),
         bigints(batch.map((t) => t.journalRefId))]);
      rows += res.rowCount ?? 0;
    }
    await client.query("COMMIT");
    return rows;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

export async function getWallet(characterId: number): Promise<WalletRow | null> {
  const { rows } = await getPool().query<{ characterId: string; balance: string; updatedAt: Date }>(
    `SELECT character_id AS "characterId", balance, updated_at AS "updatedAt"
     FROM character_wallet WHERE character_id = $1`, [characterId]);
  return rows[0] ? { characterId: Number(rows[0].characterId), balance: Number(rows[0].balance), updatedAt: rows[0].updatedAt } : null;
}

export async function listJournal(characterId: number, opts: { limit?: number; offset?: number } = {}): Promise<JournalRow[]> {
  const { rows } = await getPool().query<Record<string, string | null> & { date: Date; refType: string; description: string }>(
    `SELECT id, date, ref_type AS "refType", description, amount, balance, reason,
            context_id AS "contextId", context_id_type AS "contextIdType",
            first_party_id AS "firstPartyId", second_party_id AS "secondPartyId",
            tax, tax_receiver_id AS "taxReceiverId"
     FROM character_wallet_journal WHERE character_id = $1
     ORDER BY date DESC, id DESC LIMIT $2 OFFSET $3`,
    [characterId, opts.limit ?? 100, opts.offset ?? 0]);
  return rows.map((r) => ({
    id: Number(r.id), date: r.date, refType: r.refType, description: r.description,
    amount: num(r.amount), balance: num(r.balance), reason: r.reason,
    contextId: num(r.contextId), contextIdType: r.contextIdType,
    firstPartyId: num(r.firstPartyId), secondPartyId: num(r.secondPartyId),
    tax: num(r.tax), taxReceiverId: num(r.taxReceiverId),
  }));
}

export async function listTransactions(characterId: number, opts: { limit?: number; offset?: number } = {}): Promise<TransactionRow[]> {
  const { rows } = await getPool().query<Record<string, string | null> & { date: Date; typeId: number; isBuy: boolean; isPersonal: boolean }>(
    `SELECT transaction_id AS "transactionId", date, type_id AS "typeId", quantity,
            unit_price AS "unitPrice", client_id AS "clientId", location_id AS "locationId",
            is_buy AS "isBuy", is_personal AS "isPersonal", journal_ref_id AS "journalRefId"
     FROM character_wallet_transactions WHERE character_id = $1
     ORDER BY date DESC, transaction_id DESC LIMIT $2 OFFSET $3`,
    [characterId, opts.limit ?? 100, opts.offset ?? 0]);
  return rows.map((r) => ({
    transactionId: Number(r.transactionId), date: r.date, typeId: r.typeId,
    quantity: Number(r.quantity), unitPrice: Number(r.unitPrice),
    clientId: num(r.clientId), locationId: num(r.locationId),
    isBuy: r.isBuy, isPersonal: r.isPersonal, journalRefId: num(r.journalRefId),
  }));
}

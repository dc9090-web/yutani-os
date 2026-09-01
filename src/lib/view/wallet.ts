import { listJournal, listTransactions, type JournalRow, type TransactionRow } from "../db/character-wallet.js";
import { displayNames, locationLabels } from "../names/label.js";
import { getTypes } from "../sde/repo.js";
import { refTypeLabel } from "./enums.js";
import { grouped, isk } from "./format.js";

/** Spec §8: the page and the "show more" route both hand out 100 rows at a time. */
export const WALLET_PAGE_SIZE = 100;

export interface JournalView {
  id: number;
  date: string;
  refType: string;
  description: string;
  amount: string | null;
  /** "" when there is no amount — the ESI field is optional despite being the point of the record. */
  sign: "pos" | "neg" | "";
  balance: string | null;
  firstParty: string | null;
  secondParty: string | null;
}

export interface TransactionView {
  transactionId: number;
  date: string;
  side: "Buy" | "Sell";
  typeName: string;
  quantity: string;
  unitPrice: string;
  total: string;
  location: string;
}

/** "2026-08-31 18:30" — matches the settings tables, and survives JSON as a plain string. */
export function stamp(date: Date): string {
  return date.toISOString().replace("T", " ").slice(0, 16);
}

function party(id: number | null, names: ReadonlyMap<number, string>): string | null {
  if (id === null) return null;
  return names.get(id) ?? `ID ${id}`;
}

export function toJournalViews(rows: JournalRow[], names: ReadonlyMap<number, string>): JournalView[] {
  return rows.map((row) => ({
    id: row.id,
    date: stamp(row.date),
    refType: refTypeLabel(row.refType),
    description: row.description,
    amount: row.amount === null ? null : isk(row.amount),
    sign: row.amount === null || row.amount === 0 ? "" : row.amount > 0 ? "pos" : "neg",
    balance: row.balance === null ? null : isk(row.balance),
    firstParty: party(row.firstPartyId, names),
    secondParty: party(row.secondPartyId, names),
  }));
}

export function toTransactionViews(
  rows: TransactionRow[],
  types: ReadonlyMap<number, { name: string | null }>,
  places: ReadonlyMap<number, { name: string }>,
): TransactionView[] {
  return rows.map((row) => ({
    transactionId: row.transactionId,
    date: stamp(row.date),
    side: row.isBuy ? "Buy" : "Sell",
    typeName: types.get(row.typeId)?.name ?? `Type ${row.typeId}`,
    quantity: grouped(row.quantity),
    unitPrice: isk(row.unitPrice),
    total: isk(row.unitPrice * row.quantity),
    location: row.locationId === null ? "—" : places.get(row.locationId)?.name ?? `Location ${row.locationId}`,
  }));
}

/** One page of journal rows plus one batched name lookup. Postgres only — never ESI. */
export async function loadJournalViews(characterId: number, offset = 0): Promise<JournalView[]> {
  const rows = await listJournal(characterId, { limit: WALLET_PAGE_SIZE, offset });
  const ids = new Set<number>();
  for (const row of rows) {
    if (row.firstPartyId !== null) ids.add(row.firstPartyId);
    if (row.secondPartyId !== null) ids.add(row.secondPartyId);
  }
  return toJournalViews(rows, await displayNames([...ids]));
}

/** One page of transactions plus one getTypes and one locationLabels pass. */
export async function loadTransactionViews(characterId: number, offset = 0): Promise<TransactionView[]> {
  const rows = await listTransactions(characterId, { limit: WALLET_PAGE_SIZE, offset });
  const [types, places] = await Promise.all([
    getTypes([...new Set(rows.map((r) => r.typeId))]),
    locationLabels(rows.map((r) => r.locationId).filter((id): id is number => id !== null)),
  ]);
  return toTransactionViews(rows, types, places);
}

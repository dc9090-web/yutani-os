import { listJournal, listTransactions, type JournalRow, type TransactionRow } from "../db/character-wallet.js";
import { displayNames } from "../names/label.js";
import { placeViews } from "../names/place.js";
import { getTypes } from "../sde/repo.js";
import { refTypeLabel } from "./enums.js";
import { grouped, isk, stamp, type SecView } from "./format.js";

export { stamp } from "./format.js";

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
  /** "2026-08-31" (UTC) — the day header the row sits under. */
  day: string;
  /** "18:30" (UTC). */
  time: string;
  /** The other side of the entry — From and To merged into one column (redesign hand-off, PAGES.md §7). */
  withParty: string | null;
  /** "+10,000,000.00" / "−189,752.69", no unit: the column header carries it. */
  signedAmount: string | null;
  /** "50,000,000.00", no unit. */
  balanceText: string | null;
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
  day: string;
  time: string;
  /** For the item's icon. */
  typeId: number;
  /** Unit price and total without the unit; the total is signed — money out for a buy, in for a sale. */
  unitText: string;
  signedTotal: string;
  /** The location's solar system and security status; null when there is no location or it resolves to none. */
  system: SecView | null;
}

function party(id: number | null, names: ReadonlyMap<number, string>): string | null {
  if (id === null) return null;
  return names.get(id) ?? `ID ${id}`;
}

const MINUS = "\u2212";
/** "1,234.50" — two decimals, grouped, no unit and no sign. */
function money(value: number): string {
  return grouped(Math.abs(value).toFixed(2));
}
/** "+1,234.50" / "−1,234.50"; a zero carries no sign. */
function signed(value: number): string {
  const text = money(value);
  if (text === "0.00") return text;
  return `${value > 0 ? "+" : MINUS}${text}`;
}
const dayOf = (date: Date): string => date.toISOString().slice(0, 10);
const timeOf = (date: Date): string => date.toISOString().slice(11, 16);

/**
 * Who the entry was with, seen from `selfId`: the party that is not this character. When both
 * sides are the character — market escrow moving between their own wallet and their own order —
 * there is no other party, and the column says "Own escrow" for an escrow entry and the character's
 * own name otherwise. Without `selfId` the first party is the best guess.
 */
function otherParty(row: JournalRow, names: ReadonlyMap<number, string>, selfId: number | null): string | null {
  const { firstPartyId: first, secondPartyId: second } = row;
  if (selfId === null) return party(first ?? second, names);
  if (first === selfId && second === selfId) return row.refType === "market_escrow" ? "Own escrow" : party(selfId, names);
  if (first === selfId) return party(second, names);
  return party(first ?? second, names);
}

export function toJournalViews(rows: JournalRow[], names: ReadonlyMap<number, string>, selfId: number | null = null): JournalView[] {
  return rows.map((row) => ({
    day: dayOf(row.date),
    time: timeOf(row.date),
    withParty: otherParty(row, names, selfId),
    signedAmount: row.amount === null ? null : signed(row.amount),
    balanceText: row.balance === null ? null : money(row.balance),
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
  places: ReadonlyMap<number, { name: string; system?: SecView | null }>,
): TransactionView[] {
  return rows.map((row) => ({
    day: dayOf(row.date),
    time: timeOf(row.date),
    typeId: row.typeId,
    system: row.locationId === null ? null : places.get(row.locationId)?.system ?? null,
    unitText: money(row.unitPrice),
    signedTotal: signed(row.unitPrice * row.quantity * (row.isBuy ? -1 : 1)),
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
export async function loadJournalViews(characterId: number, offset = 0, limit = WALLET_PAGE_SIZE): Promise<JournalView[]> {
  const rows = await listJournal(characterId, { limit, offset });
  const ids = new Set<number>();
  for (const row of rows) {
    if (row.firstPartyId !== null) ids.add(row.firstPartyId);
    if (row.secondPartyId !== null) ids.add(row.secondPartyId);
  }
  return toJournalViews(rows, await displayNames([...ids]), characterId);
}

/** One page of transactions plus one getTypes and one locationLabels pass. */
export async function loadTransactionViews(characterId: number, offset = 0, limit = WALLET_PAGE_SIZE): Promise<TransactionView[]> {
  const rows = await listTransactions(characterId, { limit, offset });
  const [types, places] = await Promise.all([
    getTypes([...new Set(rows.map((r) => r.typeId))]),
    placeViews(rows.map((r) => r.locationId).filter((id): id is number => id !== null)),
  ]);
  return toTransactionViews(rows, types, places);
}

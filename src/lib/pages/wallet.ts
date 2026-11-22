import { getWallet } from "../db/character-wallet.js";
import { grouped } from "../view/format.js";
import { loadJournalViews, loadTransactionViews, WALLET_PAGE_SIZE, type JournalView, type TransactionView } from "../view/wallet.js";

/** The most rows one request may ask for: what the phone keeps of each list. */
export const WALLET_MAX_LIMIT = 500;

export type WalletKind = "journal" | "transactions";

export interface WalletSummary {
  /** "1,234,567.89", no unit; null until the wallet job has run. */
  balance: string | null;
  /** The same figure as a number. */
  balanceIsk: number | null;
}

/** What the Wallet page shows above its lists. */
export async function loadWalletSummary(characterId: number): Promise<WalletSummary> {
  const wallet = await getWallet(characterId);
  return wallet === null ? { balance: null, balanceIsk: null } : { balance: grouped(wallet.balance.toFixed(2)), balanceIsk: wallet.balance };
}

export interface WalletRows<K extends WalletKind = WalletKind> {
  kind: K; offset: number; limit: number;
  /** Newest first. Fewer than `limit` means the list ends here. */
  rows: K extends "journal" ? JournalView[] : TransactionView[];
}

/** One slice of the journal or of the transactions, newest first. */
export async function loadWalletRows(characterId: number, kind: WalletKind, offset = 0, limit = WALLET_PAGE_SIZE): Promise<WalletRows> {
  const rows = kind === "journal" ? await loadJournalViews(characterId, offset, limit) : await loadTransactionViews(characterId, offset, limit);
  return { kind, offset, limit, rows };
}

export interface WalletData { summary: WalletSummary; journal: JournalView[]; transactions: TransactionView[] }

/** The Wallet page: the balance and the first page of each list. */
export async function loadWallet(characterId: number): Promise<WalletData> {
  const [summary, journal, transactions] = await Promise.all([
    loadWalletSummary(characterId),
    loadJournalViews(characterId),
    loadTransactionViews(characterId),
  ]);
  return { summary, journal, transactions };
}

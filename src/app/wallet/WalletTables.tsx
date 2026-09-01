"use client";
import { useState } from "react";
import type { JournalView, TransactionView } from "../../lib/view/wallet.js";
// Mirrors WALLET_PAGE_SIZE in src/lib/view/wallet.ts. A value import from that module would pull the
// Postgres client into the browser bundle (it imports the wallet repo), so the constant is repeated here.
const WALLET_PAGE_SIZE = 100;

const DASH = "—";

/** Fetches one more page from the Task-10 route. The route hands back the same view shapes. */
async function fetchPage<T>(characterId: number, kind: "journal" | "transactions", offset: number): Promise<T[]> {
  const res = await fetch(`/api/characters/${characterId}/wallet?kind=${kind}&offset=${offset}`);
  if (!res.ok) throw new Error(`could not load more (${res.status})`);
  const body = (await res.json()) as { rows: T[] };
  return body.rows;
}

/** Shared "show more" state machine: a full page implies there may be another one. */
function usePaged<T>(characterId: number, kind: "journal" | "transactions", initial: T[]) {
  const [rows, setRows] = useState<T[]>(initial);
  const [done, setDone] = useState(initial.length < WALLET_PAGE_SIZE);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function more(): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      const next = await fetchPage<T>(characterId, kind, rows.length);
      setRows([...rows, ...next]);
      if (next.length < WALLET_PAGE_SIZE) setDone(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return { rows, done, busy, error, more };
}

function ShowMore({ done, busy, error, onClick }: { done: boolean; busy: boolean; error: string | null; onClick: () => void }) {
  return (<>
    {done ? null : (
      <button type="button" className="show-more" disabled={busy} onClick={onClick}>
        {busy ? "Loading…" : "Show more"}
      </button>
    )}
    {error === null ? null : <p className="neg">{error}</p>}
  </>);
}

export function JournalTable({ characterId, initial }: { characterId: number; initial: JournalView[] }) {
  const { rows, done, busy, error, more } = usePaged<JournalView>(characterId, "journal", initial);
  if (rows.length === 0) return <p className="faint">Not synced yet — the wallet job runs hourly.</p>;
  return (<>
    <table className="table">
      <thead><tr><th>Date</th><th>Type</th><th>From</th><th>To</th><th className="num">Amount</th><th className="num">Balance</th></tr></thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id}>
            <td className="muted">{row.date}</td>
            <td>{row.refType}</td>
            <td>{row.firstParty ?? DASH}</td>
            <td>{row.secondParty ?? DASH}</td>
            <td className="num">{row.amount === null ? DASH : <span className={row.sign}>{row.amount}</span>}</td>
            <td className="num muted">{row.balance ?? DASH}</td>
          </tr>
        ))}
      </tbody>
    </table>
    <ShowMore done={done} busy={busy} error={error} onClick={more} />
  </>);
}

export function TransactionsTable({ characterId, initial }: { characterId: number; initial: TransactionView[] }) {
  const { rows, done, busy, error, more } = usePaged<TransactionView>(characterId, "transactions", initial);
  if (rows.length === 0) return <p className="faint">Not synced yet — the wallet job runs hourly.</p>;
  return (<>
    <table className="table">
      <thead><tr><th>Date</th><th>Side</th><th>Item</th><th className="num">Qty</th><th className="num">Unit</th><th className="num">Total</th><th>Location</th></tr></thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.transactionId}>
            <td className="muted">{row.date}</td>
            <td className={row.side === "Buy" ? "neg" : "pos"}>{row.side}</td>
            <td>{row.typeName}</td>
            <td className="num">{row.quantity}</td>
            <td className="num">{row.unitPrice}</td>
            <td className="num">{row.total}</td>
            <td className="muted">{row.location}</td>
          </tr>
        ))}
      </tbody>
    </table>
    <ShowMore done={done} busy={busy} error={error} onClick={more} />
  </>);
}

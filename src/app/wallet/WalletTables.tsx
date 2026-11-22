"use client";
import { useState, type ReactNode } from "react";
import type { JournalView, TransactionView } from "../../lib/view/wallet.js";
// Mirrors WALLET_PAGE_SIZE in src/lib/view/wallet.ts. A value import from that module would pull the
// Postgres client into the browser bundle (it imports the wallet repo), so the constant is repeated here.
const WALLET_PAGE_SIZE = 100;

const DASH = "—";

/** Fetches one more page from the wallet route. The route hands back the same view shapes. */
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

/** Rows arrive newest first; consecutive rows of one UTC day share a header. */
function byDay<T extends { day: string }>(rows: T[]): { day: string; rows: T[] }[] {
  const days: { day: string; rows: T[] }[] = [];
  for (const row of rows) {
    const last = days[days.length - 1];
    if (last !== undefined && last.day === row.day) last.rows.push(row);
    else days.push({ day: row.day, rows: [row] });
  }
  return days;
}

function Foot({ shown, noun, done, busy, error, onClick }: { shown: number; noun: [string, string]; done: boolean; busy: boolean; error: string | null; onClick: () => void }) {
  return (
    <div className="wt-foot">
      <span className="wt-foot-note">
        {done ? `All ${shown} ${shown === 1 ? noun[0] : noun[1]}` : `Showing the latest ${shown} ${shown === 1 ? noun[0] : noun[1]}`}
        {error === null ? null : <span className="yo-bad"> · {error}</span>}
      </span>
      {done ? null : (
        <button type="button" className="yo-btn show-more" disabled={busy} onClick={onClick}>
          {busy ? "Loading…" : "Show more"}
        </button>
      )}
    </div>
  );
}

function DayHead({ day, count }: { day: string; count: string }) {
  return (
    <div className="wt-day">
      <h2 className="wt-day-date">{day}</h2>
      <span className="wt-day-count">{count}</span>
    </div>
  );
}

function Table({ label, wide, head, children }: { label: string; wide?: boolean; head: ReactNode; children: ReactNode }) {
  return (
    <div className="wt-scroll">
      <div className={`wt-table${wide ? " is-wide" : ""}`} role="table" aria-label={label}>
        <div className="wt-head yo-label" role="row">{head}</div>
        {children}
      </div>
    </div>
  );
}

/**
 * The Journal tab (redesign hand-off, `Wallet.dc.html`): grouped by day; time, type, who it was
 * with, the signed amount (teal in, coral out — the sign says it too) and the running balance.
 */
export function JournalTable({ characterId, initial }: { characterId: number; initial: JournalView[] }) {
  const { rows, done, busy, error, more } = usePaged<JournalView>(characterId, "journal", initial);
  if (rows.length === 0) return <p className="yo-empty">Not synced yet — the wallet job runs hourly.</p>;
  return (
    <section className="wt-section" aria-label="Journal">
      <Table label="Journal" head={<>
        <span className="wt-time" role="columnheader">Time</span>
        <span className="wt-type" role="columnheader">Type</span>
        <span className="wt-with" role="columnheader">With</span>
        <span className="wt-amount" role="columnheader">Amount (ISK)</span>
        <span className="wt-balance" role="columnheader">Balance (ISK)</span>
      </>}>
        {byDay(rows).map((day) => (
          <div key={day.day} className="wt-group" role="rowgroup">
            <DayHead day={day.day} count={`${day.rows.length} ${day.rows.length === 1 ? "entry" : "entries"}`} />
            {day.rows.map((row) => (
              <div key={row.id} className="wt-row is-journal" role="row">
                <span className="wt-time" role="cell">{row.time}</span>
                <span className="wt-type" role="cell">{row.refType}</span>
                <span className="wt-with" role="cell" title={row.withParty ?? undefined}>{row.withParty ?? DASH}</span>
                <span className={`wt-amount${row.sign === "" ? "" : ` is-${row.sign}`}`} role="cell">{row.signedAmount ?? DASH}</span>
                <span className="wt-balance" role="cell">{row.balanceText ?? DASH}</span>
              </div>
            ))}
          </div>
        ))}
      </Table>
      <Foot shown={rows.length} noun={["journal entry", "journal entries"]} done={done} busy={busy} error={error} onClick={more} />
    </section>
  );
}

/**
 * The Transactions tab: grouped by day; time, a BUY / SELL tag, the item with its icon, quantity,
 * unit price, the signed total and the location.
 */
export function TransactionsTable({ characterId, initial }: { characterId: number; initial: TransactionView[] }) {
  const { rows, done, busy, error, more } = usePaged<TransactionView>(characterId, "transactions", initial);
  if (rows.length === 0) return <p className="yo-empty">Not synced yet — the wallet job runs hourly.</p>;
  return (
    <section className="wt-section" aria-label="Transactions">
      <Table label="Transactions" wide head={<>
        <span className="wt-time" role="columnheader">Time</span>
        <span className="wt-side" role="columnheader">Side</span>
        <span className="wt-item" role="columnheader">Item</span>
        <span className="wt-qty" role="columnheader">Qty</span>
        <span className="wt-unit" role="columnheader">Unit (ISK)</span>
        <span className="wt-total" role="columnheader">Total (ISK)</span>
        <span className="wt-loc" role="columnheader">Location</span>
      </>}>
        {byDay(rows).map((day) => (
          <div key={day.day} className="wt-group" role="rowgroup">
            <DayHead day={day.day} count={`${day.rows.length} transaction${day.rows.length === 1 ? "" : "s"}`} />
            {day.rows.map((row) => {
              const tone = row.side === "Buy" ? "neg" : "pos";
              return (
                <div key={row.transactionId} className="wt-row is-trade" role="row">
                  <span className="wt-time" role="cell">{row.time}</span>
                  <span className="wt-side" role="cell"><span className={`wt-side-tag is-${tone}`}>{row.side.toUpperCase()}</span></span>
                  <span className="wt-item" role="cell">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img className="yo-tile wt-icon" src={`https://images.evetech.net/types/${row.typeId}/icon?size=32`} alt="" loading="lazy" onError={(e) => e.currentTarget.classList.add("is-blank")} />
                    <span className="wt-item-name" title={row.typeName}>{row.typeName}</span>
                  </span>
                  {/* Two cells on a wide screen; on a phone they read as one "5 × 1,200.00". */}
                  <span className="wt-qty" role="cell">{row.quantity}</span>
                  <span className="wt-unit" role="cell"><span className="wt-times" aria-hidden="true">× </span>{row.unitText}</span>
                  <span className={`wt-total is-${tone}`} role="cell">{row.signedTotal}</span>
                  <span className="wt-loc" role="cell" title={row.location}>{row.location}</span>
                </div>
              );
            })}
          </div>
        ))}
      </Table>
      <Foot shown={rows.length} noun={["market transaction", "market transactions"]} done={done} busy={busy} error={error} onClick={more} />
    </section>
  );
}

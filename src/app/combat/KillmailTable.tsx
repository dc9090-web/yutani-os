"use client";
import { useState } from "react";
import Link from "next/link";
import type { KillmailRowView } from "../../lib/view/combat.js";

interface Props {
  characterId: number; period: string; all: boolean;
  initial: KillmailRowView[]; initialHasMore: boolean;
}

/**
 * The killmail table and its "Show more", mirroring phase-3b's WalletTables. The rows arrive
 * already formatted from `src/lib/view/combat.ts`, and the route hands back the same shapes, so an
 * appended page cannot disagree with what is already on screen.
 */
export function KillmailTable({ characterId, period, all, initial, initialHasMore }: Props) {
  const [rows, setRows] = useState<KillmailRowView[]>(initial);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function more(): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      const query = `offset=${rows.length}&period=${period}&all=${all ? "1" : "0"}`;
      const res = await fetch(`/api/characters/${characterId}/killmails?${query}`);
      if (!res.ok) throw new Error(`could not load more (${res.status})`);
      const body = (await res.json()) as { rows: KillmailRowView[]; hasMore: boolean };
      setRows([...rows, ...body.rows]);
      setHasMore(body.hasMore);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (rows.length === 0) {
    return <p className="faint">No killmails in this period — the killmails job runs hourly and the
      zKillboard backfill every 15 minutes.</p>;
  }

  return (<>
    <table className="table killmail-table">
      <thead>
        <tr>
          <th>Time</th><th></th><th>Ship</th><th>Victim</th><th>System</th>
          <th className="num">Value</th><th className="num">Attackers</th><th>Our ship</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.killmailId}>
            <td className="muted">{row.time}</td>
            <td><span className={`badge ${row.role}`}>{row.roleLabel}</span></td>
            <td>
              <Link className="km-ship" href={row.href}>
                {row.victimShipTypeId === null ? null : (
                  <img className="module-icon" alt=""
                       src={`https://images.evetech.net/types/${row.victimShipTypeId}/icon?size=32`} />
                )}
                {row.victimShip}
              </Link>
            </td>
            <td>{row.victim}<span className="faint km-corp">{row.victimCorp}</span></td>
            <td>{row.system} <span className={row.secClass}>{row.secText}</span></td>
            <td className="num">{row.value}</td>
            <td className="num muted">{row.attackers}</td>
            <td className="muted">{row.ourShip}</td>
          </tr>
        ))}
      </tbody>
    </table>
    {hasMore ? (
      <button type="button" className="show-more" disabled={busy} onClick={more}>
        {busy ? "Loading…" : "Show more"}
      </button>
    ) : null}
    {error === null ? null : <p className="neg">{error}</p>}
  </>);
}

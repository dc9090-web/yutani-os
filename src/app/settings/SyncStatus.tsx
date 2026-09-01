import type { SyncRunSummary } from "../../lib/db/sync-runs.js";
export function SyncStatus({ runs, names }: { runs: SyncRunSummary[]; names: Record<number, string> }) {
  if (runs.length === 0) return <p className="faint">No sync runs yet — the worker runs the first job within a minute of a character being added.</p>;
  return (
    <table className="table">
      <thead><tr><th>Job</th><th>Character</th><th>Started</th><th>Status</th><th>Rows</th><th>Error</th></tr></thead>
      <tbody>
        {runs.map((r, i) => (
          <tr key={i}>
            <td>{r.job}</td>
            <td>{r.characterId === null ? "—" : names[r.characterId] ?? r.characterId}</td>
            <td className="muted">{r.startedAt.toISOString().replace("T", " ").slice(0, 16)}</td>
            <td><span className={`badge ${r.status}`}>{r.status}</span></td>
            <td>{r.rows ?? "—"}</td>
            <td className="neg">{r.error ?? ""}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

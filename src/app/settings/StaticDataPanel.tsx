import type { SdeMeta } from "../../lib/sde/repo.js";

/** "2026-08-28 11:07" — matches the SyncStatus table's timestamp format. */
function when(value: Date): string {
  return value.toISOString().replace("T", " ").slice(0, 16);
}

/** Thousands separators without depending on the runtime's ICU locale data. */
function grouped(value: number): string {
  return value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

export function StaticDataPanel({ meta }: { meta: SdeMeta | null }) {
  return (
    <div className="card">
      <h2 className="card-title">Static data</h2>
      {meta === null ? (
        <p className="faint">Not imported yet — the worker imports the SDE on its next run.</p>
      ) : (
        <table className="table">
          <tbody>
            <tr><th>SDE build</th><td>{meta.buildNumber}</td></tr>
            <tr><th>Released</th><td className="muted">{when(meta.releaseDate)}</td></tr>
            <tr><th>Imported</th><td className="muted">{when(meta.importedAt)}</td></tr>
            <tr><th>Types</th><td>{grouped(meta.counts.types)}</td></tr>
            <tr><th>Dogma attributes</th><td>{grouped(meta.counts.dogmaAttributes)}</td></tr>
            <tr><th>Dogma effects</th><td>{grouped(meta.counts.dogmaEffects)}</td></tr>
            <tr><th>Solar systems</th><td>{grouped(meta.counts.solarSystems)}</td></tr>
          </tbody>
        </table>
      )}
    </div>
  );
}

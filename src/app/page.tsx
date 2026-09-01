import { listCharacters } from "../lib/db/characters.js";
import { latestRuns } from "../lib/db/sync-runs.js";
import { portraitUrl } from "../lib/view/characters.js";

function ago(d: Date | null): string {
  if (!d) return "never";
  const m = Math.round((Date.now() - d.getTime()) / 60000);
  return m < 1 ? "just now" : m < 60 ? `${m} min ago` : `${Math.round(m / 60)} h ago`;
}

export default async function Overview() {
  const [characters, runs] = await Promise.all([listCharacters(), latestRuns()]);
  return (<>
    <h1 className="page-title">Overview</h1>
    <p className="page-sub">{characters.length} character{characters.length === 1 ? "" : "s"} authorised</p>
    <div className="card-grid">
      {characters.map((c) => {
        const last = runs.filter((r) => r.characterId === c.id).sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())[0];
        return (
          <div key={c.id} className="card char-card">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={portraitUrl(c.id, 128)} alt="" />
            <div>
              <h3>{c.name}</h3>
              <p>{c.corporationName ?? "—"}{c.allianceName ? ` · ${c.allianceName}` : ""}</p>
              <p>Wallet: <span className="faint">not synced yet</span></p>
              <p className="faint">Last sync: {ago(last?.startedAt ?? null)}{c.tokenStatus === "needs_reauth" ? <span className="badge needs_reauth" style={{ marginLeft: 8 }}>re-authorise</span> : null}</p>
            </div>
          </div>
        );
      })}
    </div>
    {characters.length === 0 ? <div className="card coming-soon">No characters yet — use the menu top-right to add one.</div> : null}
  </>);
}

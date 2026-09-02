import { readSession } from "../../lib/auth/session.js";
import { listCharacters } from "../../lib/db/characters.js";
import { loadCombatPage } from "../../lib/combat/load.js";
import { parsePeriod } from "../../lib/combat/stats.js";
import { pickActive } from "../../lib/view/characters.js";
import { NoCharacter } from "../components/NoCharacter.js";
import { CombatFilters } from "./CombatFilters.js";
import { KillmailTable } from "./KillmailTable.js";

export default async function CombatPage(
  { searchParams }: { searchParams: Promise<{ period?: string; all?: string }> },
) {
  const [session, characters, query] = await Promise.all([readSession(), listCharacters(), searchParams]);
  const character = pickActive(characters, session?.activeCharacterId ?? null);
  if (character === null) return <NoCharacter title="Combat" />;

  const period = parsePeriod(query.period);
  const all = query.all === "1";
  const characterIds = all ? characters.map((c) => c.id) : [character.id];
  const view = await loadCombatPage(characterIds, period);

  return (<>
    <h1 className="page-title">Combat</h1>
    <p className="page-sub">{all ? `${characters.length} characters` : character.name}</p>
    <CombatFilters period={period} all={all} />

    <div className="card-grid stat-tiles">
      {view.tiles.map((tile) => (
        <div className="card" key={tile.key}>
          <span className="stat-label">{tile.label}</span>
          <span className="stat-value">{tile.value}</span>
        </div>
      ))}
    </div>

    <div className="card-stack">
      <div className="card">
        <h2 className="card-title">Monthly activity</h2>
        <div className="month-strip">
          {view.months.map((m) => (
            <div className="month-col" key={m.month} title={m.title}>
              <div className="month-half up">
                <div className="month-bar kill" style={{ height: `${m.killPct}%` }} />
              </div>
              <div className="month-half down">
                <div className="month-bar loss" style={{ height: `${m.lossPct}%` }} />
              </div>
              <span className="month-label">{m.label}</span>
            </div>
          ))}
        </div>
        <p className="faint month-legend">Kills above the line, losses below.</p>
      </div>

      <div className="card-grid top-lists">
        {view.topLists.map((list) => (
          <div className="card" key={list.key}>
            <h2 className="card-title">{list.title}</h2>
            {list.rows.length === 0
              ? <p className="faint">Nothing yet.</p>
              : (
                <ul className="top-list">
                  {list.rows.map((row) => (
                    <li key={row.label}><span>{row.label}</span><span className="num muted">{row.count}</span></li>
                  ))}
                </ul>
              )}
          </div>
        ))}
      </div>

      <div className="card">
        <h2 className="card-title">Killmails</h2>
        {view.backfill === null ? null : <p className="faint">{view.backfill}</p>}
        <KillmailTable characterId={character.id} period={period} all={all}
                       initial={view.rows} initialHasMore={view.hasMore} />
      </div>
    </div>
  </>);
}

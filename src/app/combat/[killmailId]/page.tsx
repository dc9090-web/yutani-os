import Link from "next/link";
import { notFound } from "next/navigation";
import { readSession } from "../../../lib/auth/session.js";
import { listCharacters } from "../../../lib/db/characters.js";
import { parseId } from "../../../lib/api/json.js";
import { loadKillmailDetail } from "../../../lib/combat/load.js";
import { pickActive } from "../../../lib/view/characters.js";
import { NoCharacter } from "../../components/NoCharacter.js";

export default async function KillmailPage(
  { params }: { params: Promise<{ killmailId: string }> },
) {
  const [session, characters] = await Promise.all([readSession(), listCharacters()]);
  const character = pickActive(characters, session?.activeCharacterId ?? null);
  if (character === null) return <NoCharacter title="Combat" />;

  const killmailId = parseId((await params).killmailId);
  if (killmailId === null) notFound();
  const view = await loadKillmailDetail(killmailId, characters.map((c) => c.id));
  if (view === null) notFound();

  return (<>
    <h1 className="page-title">{view.victim.shipName}</h1>
    <p className="page-sub">
      {view.header.time} · {view.header.system}{" "}
      <span className={view.header.secClass}>{view.header.secText}</span> · {view.header.value}
      {view.header.roleLabel === null ? null : (
        <> · <span className={`badge ${view.header.roleLabel.toLowerCase()}`}>{view.header.roleLabel}</span></>
      )}
    </p>

    <div className="card-stack">
      <div className="card km-head">
        <div className="km-head-meta">
          {view.header.points === null ? null : <span className="muted">{view.header.points} points</span>}
          {view.header.flags.map((flag) => <span className="badge running" key={flag}>{flag}</span>)}
        </div>
        <a className="fit-btn" href={view.header.zkbHref} target="_blank" rel="noreferrer">
          View on zKillboard
        </a>
      </div>

      <div className="card km-victim">
        {view.victim.portrait === null ? null
          : <img className="ov-portrait" src={view.victim.portrait} alt="" />}
        <div>
          <h2 className="card-title">{view.victim.name}</h2>
          <p className="muted">{view.victim.corp}{view.victim.alliance === null ? "" : ` · ${view.victim.alliance}`}</p>
          <p className="faint">{view.victim.shipName} · {view.victim.damageTaken} damage taken</p>
        </div>
        {view.victim.shipRender === null ? null
          : <img className="fit-render" src={view.victim.shipRender} alt="" />}
      </div>

      <div className="card">
        <h2 className="card-title">Fit</h2>
        {view.slots.length === 0 ? <p className="faint">This killmail carries no items.</p> : (
          view.slots.map((slot) => (
            <div className="km-slot" key={slot.slot}>
              <h3 className="slot-title">{slot.title}</h3>
              <table className="table">
                <thead>
                  <tr><th>Item</th><th className="num">Destroyed</th><th className="num">Dropped</th><th className="num">Value</th></tr>
                </thead>
                <tbody>
                  {slot.rows.map((row) => (
                    <tr key={row.idx}>
                      <td>
                        <span className="km-ship">
                          <img className="module-icon" src={row.icon} alt="" />
                          {row.name}
                        </span>
                        {row.inContainer === null ? null
                          : <span className="faint km-corp">in {row.inContainer}</span>}
                      </td>
                      <td className="num">{row.destroyed ?? "—"}</td>
                      <td className="num">{row.dropped ?? "—"}</td>
                      <td className="num muted">{row.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))
        )}
      </div>

      <div className="card">
        <h2 className="card-title">Attackers</h2>
        <table className="table">
          <thead>
            <tr><th></th><th>Name</th><th>Corporation</th><th>Ship</th><th>Weapon</th>
              <th className="num">Damage</th><th className="num">Share</th><th className="num">Sec</th></tr>
          </thead>
          <tbody>
            {view.attackers.map((a) => (
              <tr key={a.idx}>
                <td>{a.finalBlow ? <span className="badge kill" title="Final blow">★</span> : null}</td>
                <td>{a.name}</td>
                <td className="muted">{a.corp}{a.alliance === null ? "" : ` · ${a.alliance}`}</td>
                <td>{a.ship}</td>
                <td className="muted">{a.weapon}</td>
                <td className="num">{a.damage}</td>
                <td className="num muted">{a.share}</td>
                <td className="num muted">{a.security}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p><Link className="fit-btn" href="/combat">Back to combat</Link></p>
    </div>
  </>);
}

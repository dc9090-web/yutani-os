import { portraitUrl } from "../../lib/view/characters.js";
import type { OverviewTraining } from "../../lib/view/format.js";
import type { RawQueueEntry } from "../../lib/pages/raw.js";
import { SegBar } from "./SegBar.js";

export interface OverviewShip { typeId: number; typeName: string; groupName: string | null }

export interface OverviewCard {
  id: number;
  name: string;
  corp: string;
  /** SDE race name (Caldari, Minmatar, …); null until the character-info job has run. */
  race: string | null;
  needsReauth: boolean;
  /** Whole ISK, grouped, no unit ("97,505,629") — the unit sits on its own line under it. */
  balance: string | null;
  system: { name: string; sec: string; secClass: string } | null;
  dockedAt: string | null;
  ship: OverviewShip | null;
  /** null when the token lacks esi-location.read_online.v1 — spec §9 says show nothing, not "offline". */
  online: boolean | null;
  training: OverviewTraining;
  /** What `training` was worked out from, for a reader that has to work it out again later (the phone). */
  trainingRaw?: { synced: boolean; queue: RawQueueEntry[] };
  /** "112.5M", no " SP" suffix — the label above it already says "Total SP". */
  totalSp: string | null;
  /** The account's name in capitals; "MAIN" gets the filled amber badge, anything else the outlined one. */
  accountTag: string | null;
  /** The owner's role tags (Settings › Tags), shown as chips. */
  tags: string[];
}

const NOT_SYNCED = <span className="ov-cell-value yo-muted">Not synced yet</span>;

/** One character on the Overview (redesign hand-off, `Main.dc.html`): three of these fit a row. */
export function CharacterCard({ card }: { card: OverviewCard }) {
  return (
    <article className="ov-card">
      <div className="ov-head">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={portraitUrl(card.id, 128)} alt="" className="yo-tile ov-portrait" />
        <div className="ov-id">
          <div className="ov-name-row">
            <h2 className="ov-name">{card.name}</h2>
            {card.accountTag === null ? null : (
              <span className={`yo-tag${card.accountTag === "MAIN" ? " is-main" : ""}`}>{card.accountTag}</span>
            )}
            {card.online === true ? <span className="yo-tag is-good">Online</span> : null}
            {card.needsReauth ? <span className="yo-tag is-bad">Re-authorise</span> : null}
          </div>
          <span className="ov-corp">{card.corp}{card.race === null ? "" : ` · ${card.race}`}</span>
        </div>
        <div className="ov-sp">
          <span className="yo-label">Total SP</span>
          <span className="ov-sp-val">{card.totalSp ?? "—"}</span>
        </div>
      </div>

      <div className="ov-roles">
        {card.tags.map((tag) => <span key={tag} className="yo-chip">{tag}</span>)}
      </div>

      <div className="ov-cells">
        <div className="ov-cell">
          <span className="yo-label">Wallet</span>
          {card.balance === null ? NOT_SYNCED : (<>
            <span className="ov-cell-value yo-mono">{card.balance}</span>
            <span className="ov-cell-sub">ISK</span>
          </>)}
        </div>
        <div className="ov-cell">
          <span className="yo-label">Ship</span>
          {card.ship === null ? NOT_SYNCED : (
            <div className="ov-ship">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="yo-tile ov-ship-icon" src={`https://images.evetech.net/types/${card.ship.typeId}/icon?size=64`} alt="" loading="lazy" />
              <span className="ov-ship-text">
                <span className="ov-cell-value">{card.ship.typeName}</span>
                <span className="ov-cell-sub">{card.ship.groupName ?? "—"}</span>
              </span>
            </div>
          )}
        </div>
        <div className="ov-cell">
          <span className="yo-label">Location</span>
          {card.system === null ? NOT_SYNCED : (<>
            <span className="ov-cell-value"><span className={`ov-sec ${card.system.secClass}`}>{card.system.sec}</span> {card.system.name}</span>
            <span className="ov-cell-sub ov-station" title={card.dockedAt ?? undefined}>{card.dockedAt ?? "In space"}</span>
          </>)}
        </div>
      </div>

      <div className="ov-training">
        <div className="ov-training-top">
          <span className="ov-training-skill">
            <span className="yo-label">Training</span>
            {card.training.active ? card.training.skill : <span className="yo-muted">{card.training.label}</span>}
          </span>
          {card.training.active ? <span className="ov-eta">{card.training.time}</span> : null}
        </div>
        {card.training.active ? (
          <div className="yo-bar-row">
            <SegBar value={card.training.percent / 100} tone="accent" label={`Training progress ${card.training.percent}%`} />
            <span className="yo-bar-pct">{card.training.percent}%</span>
          </div>
        ) : null}
      </div>
    </article>
  );
}

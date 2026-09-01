import { portraitUrl } from "../../lib/view/characters.js";

export interface OverviewCard {
  id: number;
  name: string;
  corp: string;
  needsReauth: boolean;
  balance: string | null;
  system: { name: string; sec: string; secClass: string } | null;
  dockedAt: string | null;
  ship: string | null;
  /** null when the token lacks esi-location.read_online.v1 — spec §9 says show nothing, not "offline". */
  online: boolean | null;
  training: string;
  totalSp: string | null;
  lastSync: string;
}

const NOT_SYNCED = <span className="faint">Not synced yet</span>;
const DASH = <span className="faint">—</span>;

export function CharacterCard({ card }: { card: OverviewCard }) {
  return (
    <div className="card ov-card">
      <div className="ov-head">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={portraitUrl(card.id, 128)} alt="" className="ov-portrait" />
        <div>
          <h3 className="ov-name">
            {card.name}
            {card.online === null ? null : (
              <span className={`online-dot${card.online ? " on" : ""}`} title={card.online ? "Online" : "Offline"} />
            )}
          </h3>
          <p className="ov-corp">{card.corp}</p>
          {card.needsReauth ? <span className="badge needs_reauth">re-authorise</span> : null}
        </div>
      </div>
      <dl className="ov-rows">
        <div className="ov-row"><dt>Wallet</dt><dd>{card.balance ?? NOT_SYNCED}</dd></div>
        <div className="ov-row"><dt>Location</dt><dd>
          {card.system === null ? NOT_SYNCED : (<>
            <span className={card.system.secClass}>{card.system.sec}</span>{" "}
            <span>{card.system.name}</span>
            {card.dockedAt === null ? null : <span className="muted"> · {card.dockedAt}</span>}
          </>)}
        </dd></div>
        <div className="ov-row"><dt>Ship</dt><dd>{card.ship ?? DASH}</dd></div>
        <div className="ov-row"><dt>Training</dt><dd>{card.training}</dd></div>
        <div className="ov-row"><dt>Total SP</dt><dd>{card.totalSp ?? DASH}</dd></div>
        <div className="ov-row"><dt>Last sync</dt><dd className="muted">{card.lastSync}</dd></div>
      </dl>
    </div>
  );
}

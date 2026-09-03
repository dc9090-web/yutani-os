import { portraitUrl } from "../../lib/view/characters.js";
import type { OverviewTraining } from "../../lib/view/format.js";

export interface OverviewShip { typeName: string; groupName: string | null }

export interface OverviewCard {
  id: number;
  name: string;
  corp: string;
  needsReauth: boolean;
  /** Whole-ISK, no decimals (`iskWhole`) — the design hand-back's `.ov-rows` Wallet row. */
  balance: string | null;
  system: { name: string; sec: string; secClass: string } | null;
  dockedAt: string | null;
  ship: OverviewShip | null;
  /** null when the token lacks esi-location.read_online.v1 — spec §9 says show nothing, not "offline". */
  online: boolean | null;
  training: OverviewTraining;
  /** "34.2M", no " SP" suffix — the `.ov-sp-label` next to it already says "Total SP". */
  totalSp: string | null;
  account: string | null;
  tags: string[];
}

const NOT_SYNCED = <span className="faint">Not synced yet</span>;

/** Main/alt account pills get a coloured variant when the (lower-cased) name matches one of the
 *  design hand-back's known variants; anything else stays a plain `.pill`. Tags are all `.pill.tag`. */
function pillClass(name: string, variants: readonly string[]): string {
  const variant = variants.find((v) => v === name.toLowerCase());
  return variant === undefined ? "pill" : `pill ${variant}`;
}

const ACCOUNT_VARIANTS = ["main", "alt"] as const;

export function CharacterCard({ card }: { card: OverviewCard }) {
  return (
    <div className="card ov-card">
      <div className="ov-head">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={portraitUrl(card.id, 128)} alt="" className="ov-portrait" />
        <div className="ov-id">
          <h3 className="ov-name">
            {card.name}
            {card.online === true ? <span className="online-dot on" title="Online" /> : null}
          </h3>
          <p className="ov-corp">{card.corp}</p>
        </div>
        {card.account === null && !card.needsReauth ? null : (
          <div className="ov-head-right">
            {card.account === null ? null : (
              <span className={pillClass(card.account, ACCOUNT_VARIANTS)}>{card.account}</span>
            )}
            {card.needsReauth ? <span className="badge needs_reauth ov-status">re-authorise</span> : null}
          </div>
        )}
      </div>
      {card.tags.length === 0 ? null : (
        <div className="ov-pills">
          {card.tags.map((tag) => <span key={tag} className="pill tag">{tag}</span>)}
        </div>
      )}
      <dl className="ov-rows">
        <div className="ov-row"><dt>Wallet</dt><dd className={card.balance === null ? undefined : "dur"}>{card.balance ?? NOT_SYNCED}</dd></div>
        <div className="ov-row ov-row-location"><dt>Location</dt><dd>
          {card.system === null ? NOT_SYNCED : (<>
            <span className={card.system.secClass}>{card.system.sec}</span> {card.system.name}
            {card.dockedAt === null ? null : <span className="ov-station"> · {card.dockedAt}</span>}
          </>)}
        </dd></div>
        <div className="ov-row"><dt>Ship</dt><dd>
          {card.ship === null ? NOT_SYNCED : (<>
            <span className="ship-type-pills ov-ship-pills">
              <span className="pill hull">{card.ship.typeName}</span>
              {card.ship.groupName === null ? null : <span className="pill">{card.ship.groupName}</span>}
            </span>
          </>)}
        </dd></div>
      </dl>
      <div className="ov-foot">
        <div className="ov-training">
          <div className="ov-training-top">
            {card.training.active ? (<>
              <span>{card.training.skill}</span>
              <span className="dur muted">{card.training.time}</span>
            </>) : <span className="faint">{card.training.label}</span>}
          </div>
          {card.training.active ? (
            <div className="progress-wrap">
              <div className="progress" role="progressbar" aria-valuenow={card.training.percent} aria-valuemin={0} aria-valuemax={100}>
                <div className="progress-fill" style={{ width: `${card.training.percent}%` }} />
              </div>
              <span className="progress-pct">{Math.round(card.training.percent)}%</span>
            </div>
          ) : null}
        </div>
        <div className="ov-sp">
          <span className="ov-sp-label">Total SP</span>
          <span className={`ov-sp-val${card.totalSp === null ? " faint" : ""}`}>{card.totalSp ?? "—"}</span>
        </div>
      </div>
    </div>
  );
}

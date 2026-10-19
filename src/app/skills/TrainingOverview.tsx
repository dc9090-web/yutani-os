import { portraitUrl } from "../../lib/view/characters.js";
import type { TrainingQueueView } from "../../lib/view/training-overview.js";
import { LevelBoxes } from "./QueueTable.js";
import { MultiviewEditor } from "./MultiviewEditor.js";

function Status({ view }: { view: TrainingQueueView }) {
  switch (view.status.kind) {
    case "eta": return <span className="tq-total"><span className="faint">done in</span> <strong className="dur">{view.status.text}</strong></span>;
    case "paused": return <span className="tq-total warn-text">Paused</span>;
    case "notSynced": return <span className="tq-total faint">Not synced</span>;
    case "empty": return <span className="tq-total faint">Queue empty</span>;
  }
}

function QueueCard({ view }: { view: TrainingQueueView }) {
  return (
    <div className="tq-card">
      <div className="tq-head">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={portraitUrl(view.id)} alt="" className="tq-portrait" />
        <div className="tq-id">
          <span className="tq-name">
            {view.name}
            {view.online === true ? <span className="online-dot on" title="Online" /> : null}
          </span>
          <Status view={view} />
        </div>
        <span className="tq-count">{view.count}</span>
      </div>
      {view.progress === null ? null : (
        <div className="progress tq-progress" role="progressbar" aria-valuenow={Math.round(view.progress * 100)} aria-valuemin={0} aria-valuemax={100}>
          <div className="progress-fill" style={{ width: `${Math.round(view.progress * 100)}%` }} />
        </div>
      )}
      {view.rows.length === 0 ? (
        <p className="tq-empty faint">{view.status.kind === "notSynced" ? "Skills not synced yet" : "No skills in queue"}</p>
      ) : (
        <ol className="tq-list">
          {view.rows.map((row) => (
            <li key={row.position} className="tq-row">
              <span className="tq-n">{row.position}</span>
              <span className="tq-skill">{row.skill}</span>
              <LevelBoxes trainedLevel={row.trainedLevel} targetLevel={row.targetLevel} training={row.training} />
              <span className="tq-time dur">{row.remaining}</span>
            </li>
          ))}
        </ol>
      )}
      {view.truncated ? <p className="tq-more">Showing first {view.rows.length} of {view.count}</p> : null}
    </div>
  );
}

/**
 * Every authorised character's training queue side by side (design hand-back 2026-10-01,
 * `TrainingOverview.tsx`): portrait, name, time to the end of the queue, the head skill's
 * progress, then the first twenty entries with level boxes and time remaining. With `all`, an Edit
 * button lets the user pick which characters show and in what order (`MultiviewEditor`).
 */
export function TrainingOverview({ characters, all }: {
  characters: TrainingQueueView[];
  /** Every stored character, for the edit mode's picker; leave out for a read-only card. */
  all?: { id: number; name: string }[];
}) {
  const grid = (
    <div className="tq-grid">
      {characters.map((view) => <QueueCard key={view.id} view={view} />)}
    </div>
  );
  return (
    <div className="card">
      <h2 className="card-title">Training overview</h2>
      {all === undefined ? grid : (
        <MultiviewEditor all={all} selected={characters.map((c) => c.id)}>{grid}</MultiviewEditor>
      )}
    </div>
  );
}

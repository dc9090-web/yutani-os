import { portraitUrl } from "../../lib/view/characters.js";
import type { TrainingQueueView } from "../../lib/view/training-overview.js";
import { LevelBlocks, queueBlocks } from "../components/LevelBlocks.js";
import { SegBar } from "../components/SegBar.js";
import { BlockLegend } from "./Legend.js";
import { MultiviewEditor } from "./MultiviewEditor.js";

function Status({ view }: { view: TrainingQueueView }) {
  switch (view.status.kind) {
    case "eta": return <span className="tq-status">Done in <span className="yo-figure">{view.status.text}</span></span>;
    case "paused": return <span className="tq-status yo-bad">Paused</span>;
    case "notSynced": return <span className="tq-status">Not synced</span>;
    case "empty": return <span className="tq-status">Queue empty</span>;
  }
}

function QueueCard({ view }: { view: TrainingQueueView }) {
  const pct = view.progress === null ? null : Math.round(view.progress * 100);
  const more = view.count - view.rows.length;
  return (
    <article className="tq-card">
      <div className="tq-head">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={portraitUrl(view.id)} alt="" className="yo-tile tq-portrait" />
        <div className="tq-id">
          <h2 className="tq-name">
            {view.name}
            {view.online === true ? <span className="yo-tag is-good">Online</span> : null}
          </h2>
          <Status view={view} />
        </div>
        <div className="tq-count">
          <span className="yo-label">In queue</span>
          <span className="tq-count-val">{view.count}</span>
        </div>
      </div>
      {pct === null ? null : (
        <div className="yo-bar-row">
          <span className="yo-label">Current skill</span>
          <SegBar value={view.progress ?? 0} tone="accent" label={`Current skill progress ${pct}%`} />
          <span className="yo-bar-pct">{pct}%</span>
        </div>
      )}
      {view.rows.length === 0 ? (
        <p className="yo-empty">{view.status.kind === "notSynced" ? "Skills not synced yet" : "No skills in queue"}</p>
      ) : (
        <ol className="tq-list">
          {view.rows.map((row) => (
            <li key={row.position} className="tq-row">
              <span className="tq-n">{row.position}</span>
              <LevelBlocks states={queueBlocks(row.targetLevel, row.training)} label={`${row.training ? "Training" : "Queued"} to level ${row.targetLevel}`} />
              <span className="sk-level is-target" aria-hidden="true">{row.targetLevel}</span>
              <span className="tq-skill">{row.skill}</span>
              <span className="tq-time">{row.remaining}</span>
            </li>
          ))}
        </ol>
      )}
      {more > 0 ? <span className="tq-more">+{more} more in queue</span> : null}
    </article>
  );
}

/**
 * The Skills page's Overview tab (redesign hand-off, `Skills.dc.html`): every chosen character's
 * training queue side by side — portrait, name, time to the end of the queue, queue length, the
 * current skill's progress, then the first ten entries. With `all`, an Edit button lets the owner
 * pick which characters show and in what order (`MultiviewEditor`).
 */
export function TrainingOverview({ characters, all }: {
  characters: TrainingQueueView[];
  /** Every stored character, for the edit mode's picker; leave out for a read-only view. */
  all?: { id: number; name: string }[];
}) {
  const grid = (
    <div className="tq-grid">
      {characters.map((view) => <QueueCard key={view.id} view={view} />)}
    </div>
  );
  return (
    <section className="tq-section" aria-label="Training overview">
      {all === undefined ? (<><BlockLegend />{grid}</>) : (
        <MultiviewEditor all={all} selected={characters.map((c) => c.id)} legend={<BlockLegend />}>{grid}</MultiviewEditor>
      )}
    </section>
  );
}

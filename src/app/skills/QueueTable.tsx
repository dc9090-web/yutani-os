import { InfoButton, InfoGroup, InfoPanel } from "../components/Info.js";
import { LevelBlocks, queueBlocks } from "../components/LevelBlocks.js";
import { SegBar } from "../components/SegBar.js";

export interface QueueEntryView {
  /** 1-based place in the live queue. */
  position: number;
  skillId: number;
  skill: string;
  /** The skill's SDE description for the info panel (`typeDescription()`); null when the SDE has none. */
  desc: string | null;
  /** The level this queue entry finishes at (`finished_level`). A skill queued several times steps up one level per entry. */
  targetLevel: number;
  /** Time left to train, pre-formatted with `duration()`; "—" when the entry has no dates (a paused queue). */
  remaining: string;
  /** 0–1 through the level, on the entry in training only; every other row is `null`. */
  progress: number | null;
  /** What `remaining` and `progress` were worked out from (ISO-8601 UTC, SP bounds), for a reader that works them out again later. */
  startAt?: string | null;
  finishAt?: string | null;
  levelStartSp?: number | null;
  levelEndSp?: number | null;
  trainingStartSp?: number | null;
}

/**
 * The Training tab's rows (redesign hand-off, `Skills.dc.html`): position, level blocks, the target
 * level digit, the skill with its info button, and the time remaining. The row in training adds a
 * TRAINING tag and its progress bar.
 */
export function QueueTable({ entries }: { entries: QueueEntryView[] }) {
  if (entries.length === 0) return <p className="yo-empty">Nothing in the training queue.</p>;
  return (
    <InfoGroup>
      <div className="tr-head yo-label">
        <span className="tr-n">#</span>
        <span className="tr-level">Level</span>
        <span className="tr-skill">Skill</span>
        <span>Time remaining</span>
      </div>
      <ol className="tr-list">
        {entries.map((e) => {
          const id = `queue-${e.position}`;
          const training = e.progress !== null;
          const pct = e.progress === null ? 0 : Math.round(e.progress * 100);
          return (
            <li key={e.position} className="tr-item">
              <div className="tr-row">
                <span className="tr-n yo-mono">{e.position}</span>
                <LevelBlocks states={queueBlocks(e.targetLevel, training)} label={`${training ? "Training" : "Queued"} to level ${e.targetLevel}`} />
                <span className="sk-level is-target" aria-hidden="true">{e.targetLevel}</span>
                <span className="tr-name">{e.skill}</span>
                {e.desc === null ? null : <InfoButton id={id} name={e.skill} />}
                {/* One group, so on a phone the tag, bar and time drop to a second line together. */}
                <span className="tr-end">
                  {training ? (
                    <span className="tr-active">
                      <span className="yo-flag">TRAINING</span>
                      <SegBar value={e.progress ?? 0} tone="accent" label={`Progress ${pct}%`} className="tr-bar" />
                      <span className="tr-pct">{pct}%</span>
                    </span>
                  ) : null}
                  <span className="tr-time">{e.remaining}</span>
                </span>
              </div>
              {e.desc === null ? null : <InfoPanel id={id} className="tr-info">{e.desc}</InfoPanel>}
            </li>
          );
        })}
      </ol>
    </InfoGroup>
  );
}

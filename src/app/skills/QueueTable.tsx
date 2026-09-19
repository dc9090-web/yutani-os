export interface QueueEntryView {
  position: number;
  skill: string;
  /** The skill's SDE description as hover text (`typeDescription()`); null when the SDE has none. */
  desc: string | null;
  /** The level already trained going into this entry — `targetLevel - 1` (see the page's derivation). */
  trainedLevel: number;
  /** The level this queue entry finishes at. */
  targetLevel: number;
  /** Pre-formatted with `duration()`; "—" when the entry has no start/finish dates (a paused queue). */
  duration: string;
  /** Only the head entry gets a bar; every other row is `null`. */
  progress: number | null;
}

/**
 * Five boxes: solid for every level already trained, and — only on the entry actually in progress
 * (`training`) — a blinking box (`.level-box.training`, `@keyframes levelBlink`) at the level being
 * trained towards. Queued-but-not-yet-training entries just show the gap as empty boxes.
 */
function LevelBoxes({ trainedLevel, targetLevel, training }: { trainedLevel: number; targetLevel: number; training: boolean }) {
  const label = training
    ? `Trained level ${trainedLevel}, training level ${targetLevel}`
    : `Trained level ${trainedLevel}, level ${targetLevel} queued`;
  return (
    <span className="level-boxes" aria-label={label}>
      {[1, 2, 3, 4, 5].map((level) => {
        const cls = level <= trainedLevel ? " active" : training && level === targetLevel ? " training" : "";
        return <span key={level} className={`level-box${cls}`} />;
      })}
    </span>
  );
}

export function QueueTable({ entries }: { entries: QueueEntryView[] }) {
  if (entries.length === 0) return <p className="faint">Nothing in the training queue.</p>;
  return (
    <table className="table">
      <thead><tr><th>#</th><th>Skill</th><th>Level</th><th>Duration</th><th>Progress</th></tr></thead>
      <tbody>
        {entries.map((e) => (
          <tr key={e.position}>
            <td className="muted">{e.position}</td>
            <td><span data-desc={e.desc ?? undefined}>{e.skill}</span></td>
            <td><LevelBoxes trainedLevel={e.trainedLevel} targetLevel={e.targetLevel} training={e.progress !== null} /></td>
            <td className="dur">{e.duration}</td>
            <td>
              {e.progress === null ? null : (
                <div className="progress-wrap">
                  <div className="progress" role="progressbar" aria-valuenow={Math.round(e.progress * 100)} aria-valuemin={0} aria-valuemax={100}>
                    <div className="progress-fill" style={{ width: `${Math.round(e.progress * 100)}%` }} />
                  </div>
                  <span className="progress-pct">{Math.round(e.progress * 100)}%</span>
                </div>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

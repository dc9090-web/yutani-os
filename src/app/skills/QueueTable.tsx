export interface QueueEntryView {
  position: number;
  skill: string;
  level: string;
  start: string;
  finish: string;
  /** Only the head entry gets a bar; every other row is `null`. */
  progress: number | null;
}

export function QueueTable({ entries }: { entries: QueueEntryView[] }) {
  if (entries.length === 0) return <p className="faint">Nothing in the training queue.</p>;
  return (
    <table className="table">
      <thead><tr><th>#</th><th>Skill</th><th>Level</th><th>Start</th><th>Finish</th><th>Progress</th></tr></thead>
      <tbody>
        {entries.map((e) => (
          <tr key={e.position}>
            <td className="muted">{e.position}</td>
            <td>{e.skill}</td>
            <td>{e.level}</td>
            <td className="muted">{e.start}</td>
            <td className="muted">{e.finish}</td>
            <td>
              {e.progress === null ? null : (
                <div className="progress" role="progressbar" aria-valuenow={Math.round(e.progress * 100)} aria-valuemin={0} aria-valuemax={100}>
                  <div className="progress-fill" style={{ width: `${Math.round(e.progress * 100)}%` }} />
                </div>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

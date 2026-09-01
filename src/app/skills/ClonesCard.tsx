export interface ImplantView { typeId: number; name: string; bonus: string | null }
export interface JumpCloneView { jumpCloneId: number; label: string; name: string | null; implants: string[] }

export function ClonesCard({ home, implants, jumpClones }: { home: string | null; implants: ImplantView[]; jumpClones: JumpCloneView[] }) {
  if (home === null && implants.length === 0 && jumpClones.length === 0) {
    return (
      <div className="card">
        <h2 className="card-title">Clones</h2>
        <p className="faint">Not synced yet — the clones job runs every six hours.</p>
      </div>
    );
  }
  return (
    <div className="card">
      <h2 className="card-title">Clones</h2>
      <p className="faint">Home station</p>
      <p style={{ marginTop: 0 }}>{home ?? "—"}</p>
      <p className="faint">Active clone implants</p>
      {implants.length === 0 ? <p style={{ marginTop: 0 }} className="muted">No implants plugged in.</p> : (
        <ul className="clone-list">
          {implants.map((implant) => (
            <li key={implant.typeId}>
              {implant.name}
              {implant.bonus === null ? null : <span className="attr-bonus">{implant.bonus}</span>}
            </li>
          ))}
        </ul>
      )}
      <p className="faint">Jump clones</p>
      {jumpClones.length === 0 ? <p style={{ marginTop: 0 }} className="muted">No jump clones.</p> : (
        <ul className="clone-list">
          {jumpClones.map((clone) => (
            <li key={clone.jumpCloneId}>
              <div>{clone.name ?? clone.label}</div>
              {clone.name === null ? null : <div className="muted">{clone.label}</div>}
              <div className="faint">{clone.implants.length === 0 ? "No implants" : clone.implants.join(", ")}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

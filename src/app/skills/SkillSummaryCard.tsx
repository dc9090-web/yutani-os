import type { AttributeView } from "../../lib/view/skills.js";

export interface SkillSummaryProps {
  totalSp: string | null;
  unallocatedSp: string | null;
  attributes: AttributeView[];
}

// The remap line (bonus remaps · last remap · next remap) was dropped from this card on
// 2026-10-02; the plan editor's AttributesPanel still shows remap state where it matters.
export function SkillSummaryCard({ totalSp, unallocatedSp, attributes }: SkillSummaryProps) {
  if (totalSp === null && attributes.length === 0) {
    return (
      <div className="card">
        <h2 className="card-title">Summary</h2>
        <p className="faint">Not synced yet — the skills job runs hourly.</p>
      </div>
    );
  }
  return (
    <div className="card">
      <h2 className="card-title">Summary</h2>
      <div className="stat-row">
        <div><span className="stat-label">Total SP</span><span className="stat-value">{totalSp ?? "—"}</span></div>
        <div><span className="stat-label">Unallocated SP</span><span className="stat-value">{unallocatedSp ?? "—"}</span></div>
      </div>
      <div className="attr-grid">
        {attributes.map((a) => (
          <div key={a.key} className="attr">
            <span className="attr-label">{a.label}</span>
            <div>
              <span className="attr-total">{a.total}</span>
              {a.bonus > 0 ? <span className="attr-bonus">+{a.bonus}</span> : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

"use client";
import { useState } from "react";
import { IconInfoCircle } from "@tabler/icons-react";
import type { ExplainRowView } from "../../lib/view/fit-sheet.js";

/**
 * Spec §4's "affected by" popover. The rows are computed on the server by `explain()` — this
 * component only opens and closes, so no engine data and no `DogmaData` ever reaches the browser.
 */
export function AffectedBy({ label, value, rows }: { label: string; value: string; rows: ExplainRowView[] }) {
  const [open, setOpen] = useState(false);
  if (rows.length === 0) return <span className="num">{value}</span>;
  return (
    <span className="affected">
      <button
        type="button" className="affected-btn num" aria-expanded={open}
        aria-label={`${label} ${value}, affected by ${rows.length} modifier${rows.length === 1 ? "" : "s"}`}
        onClick={() => setOpen((current) => !current)}
      >
        {value}
        <IconInfoCircle size={12} />
      </button>
      {open ? (
        <span className="popover" role="dialog" aria-label={`Affected by — ${label}`}>
          <span className="popover-title">Affected by</span>
          <ul className="popover-list">
            {rows.map((row, index) => (
              <li key={`${row.carrier}:${index}`}>
                <span>{row.carrier}</span>
                <span className="num">{row.operator} {row.value}</span>
                {row.penalised ? <span className="faint"> penalised</span> : null}
              </li>
            ))}
          </ul>
        </span>
      ) : null}
    </span>
  );
}

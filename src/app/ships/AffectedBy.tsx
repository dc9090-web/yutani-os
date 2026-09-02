"use client";
import { useEffect, useRef, useState } from "react";
import { IconInfoCircle } from "@tabler/icons-react";
import type { ExplainRowView } from "../../lib/view/fit-sheet.js";

/**
 * Spec §4's "affected by" popover. The rows are computed on the server by `explain()` — this
 * component only opens and closes, so no engine data and no `DogmaData` ever reaches the browser.
 */
export function AffectedBy({ label, value, rows }: { label: string; value: string; rows: ExplainRowView[] }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLSpanElement | null>(null);

  // Escape and an outside click both close the popover — plain DOM listeners, not Mantine, so this
  // stays the inline span the rest of the component already is.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    const onPointerDown = (e: MouseEvent) => {
      if (rootRef.current !== null && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, [open]);

  if (rows.length === 0) return <span className="num">{value}</span>;
  return (
    <span className="affected" ref={rootRef}>
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

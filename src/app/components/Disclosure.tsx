"use client";
import { useState, type ReactNode } from "react";

/** The chevron every collapsible row carries; it turns 90° when the row is open. */
export function Chevron({ open }: { open: boolean }) {
  return (
    <svg className="yo-chevron" data-open={open || undefined} aria-hidden="true" width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4.5 3l3 3-3 3" />
    </svg>
  );
}

/**
 * A collapsible row (redesign hand-off, DESIGN_SYSTEM.md "Collapsible row"): a full-width button
 * with a chevron, and a body that shows while it is open. Each row keeps its own state, so several
 * can be open at once. `forceOpen` holds it open regardless — the Assets filter does that for every
 * location with a match.
 */
export function Disclosure({ summary, children, defaultOpen = false, forceOpen = false, className, label }: {
  summary: ReactNode; children: ReactNode; defaultOpen?: boolean; forceOpen?: boolean; className?: string;
  /** Accessible name when the summary alone does not make one. */
  label?: string;
}) {
  const [own, setOwn] = useState(defaultOpen);
  const open = forceOpen || own;
  return (
    <div className={`yo-disclosure${className === undefined ? "" : ` ${className}`}`} data-open={open || undefined}>
      <button type="button" className="yo-disclosure-row" aria-expanded={open} aria-label={label} onClick={() => setOwn(!open)}>
        <Chevron open={open} />
        {summary}
      </button>
      {open ? <div className="yo-disclosure-body">{children}</div> : null}
    </div>
  );
}

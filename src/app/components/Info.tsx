"use client";
import { createContext, useContext, useState, type ReactNode } from "react";

interface InfoState { open: string | null; toggle: (id: string) => void }
const InfoContext = createContext<InfoState | null>(null);

/**
 * One list's worth of info buttons (redesign hand-off, DESIGN_SYSTEM.md "Info button and inline
 * panel"): at most one description is open at a time within a group. The rows themselves stay
 * server-rendered; only the button and the panel are client pieces.
 */
export function InfoGroup({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState<string | null>(null);
  const toggle = (id: string) => setOpen((current) => (current === id ? null : id));
  return <InfoContext.Provider value={{ open, toggle }}>{children}</InfoContext.Provider>;
}

function useInfo(): InfoState {
  const state = useContext(InfoContext);
  if (state === null) throw new Error("InfoButton and InfoPanel must sit inside an InfoGroup");
  return state;
}

/** The 28px "i" button that follows a skill or implant name. Grey when closed, amber when open. */
export function InfoButton({ id, name }: { id: string; name: string }) {
  const { open, toggle } = useInfo();
  const isOpen = open === id;
  return (
    <button type="button" className="yo-info-btn" aria-label={`About ${name}`} aria-expanded={isOpen} aria-controls={`info-${id}`} data-open={isOpen || undefined} onClick={() => toggle(id)}>
      <svg aria-hidden="true" width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"><circle cx="7" cy="7" r="5.6" /><path d="M7 6.4v3.4" /><path d="M7 4.3v.1" /></svg>
    </button>
  );
}

/** The description, inline under its row — not a floating popover. Renders nothing while closed. */
export function InfoPanel({ id, children, className }: { id: string; children: ReactNode; className?: string }) {
  const { open } = useInfo();
  if (open !== id) return null;
  return <p id={`info-${id}`} className={`yo-info-panel${className === undefined ? "" : ` ${className}`}`}>{children}</p>;
}

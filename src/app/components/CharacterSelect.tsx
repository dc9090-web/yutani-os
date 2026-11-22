"use client";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { portraitUrl } from "../../lib/view/characters.js";

export interface CharacterOption {
  id: number;
  name: string;
  /** The account's name in capitals ("MAIN", "ALT"); null when the character has no account. */
  tag: string | null;
  /** "112.5M"; null until the skills job has run. */
  sp: string | null;
  needsReauth: boolean;
}

/**
 * The character dropdown under the page title on every per-character page (redesign hand-off,
 * DESIGN_SYSTEM.md "Character dropdown"). Picking a character posts to /auth/switch — the same
 * session switch the old header menu used — and comes back to the page it was opened on.
 */
export function CharacterSelect({ options, activeId }: { options: CharacterOption[]; activeId: number }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const active = options.find((o) => o.id === activeId) ?? options[0];

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

  if (active === undefined) return null;
  return (
    <div className="yo-charsel" ref={rootRef}>
      <button type="button" className="yo-charsel-btn" aria-haspopup="listbox" aria-expanded={open} aria-label={`Character: ${active.name}`} onClick={() => setOpen(!open)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={portraitUrl(active.id)} alt="" className="yo-charsel-tile" />
        <span className="yo-charsel-name">{active.name}</span>
        <svg aria-hidden="true" width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 4.5l3 3 3-3" /></svg>
      </button>
      {open ? (
        <div className="yo-charsel-menu" role="listbox" aria-label="Characters">
          {options.map((option) => (
            <form key={option.id} method="post" action="/auth/switch">
              <input type="hidden" name="characterId" value={option.id} />
              <input type="hidden" name="next" value={pathname ?? "/"} />
              <button type="submit" className="yo-charsel-option" role="option" aria-selected={option.id === active.id} data-active={option.id === active.id || undefined}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={portraitUrl(option.id)} alt="" className="yo-charsel-tile" />
                <span className="yo-charsel-name">{option.name}</span>
                {option.needsReauth ? <span className="yo-charsel-warn">RE-AUTHORISE</span> : null}
                {option.tag === null ? null : <span className="yo-charsel-tag">{option.tag}</span>}
                <span className="yo-charsel-sp">{option.sp ?? "—"}</span>
              </button>
            </form>
          ))}
        </div>
      ) : null}
    </div>
  );
}

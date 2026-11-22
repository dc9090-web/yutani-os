import type { SystemReadout } from "../../lib/view/system.js";
import { SysClock } from "./SysClock.js";

const SYS_LABEL: Record<SystemReadout, string> = { ok: "ONLINE", error: "DEGRADED", running: "SYNCING", none: "IDLE" };
const ESI_LABEL: Record<SystemReadout, string> = { ok: "OK", error: "ERROR", running: "SYNCING", none: "—" };

export interface SystemStripProps {
  sync: SystemReadout;
  esi: SystemReadout;
  sdeBuild: number | null;
  characters: number;
  /** ISO timestamp of the server render; the clock ticks on from it client-side. */
  now: string;
}

/**
 * The status strip directly under the header (redesign hand-off, DESIGN_SYSTEM.md "Shell"): a state
 * dot + SYS, ESI, SDE build, character count, and the UTC clock right-aligned. Fed from the same
 * data the settings page shows. The dot's colour is never the only signal — the word beside it says
 * the same thing.
 */
export function SystemStrip({ sync, esi, sdeBuild, characters, now }: SystemStripProps) {
  return (
    <div className="sys-strip">
      <span className="sys-item sys-lead"><span className={`sys-dot ${sync}`} aria-hidden="true" />SYS {SYS_LABEL[sync]}</span>
      <span className="sys-item">ESI {ESI_LABEL[esi]}</span>
      <span className="sys-item">SDE {sdeBuild ?? "—"}</span>
      <span className="sys-item">{characters} CHARACTER{characters === 1 ? "" : "S"}</span>
      <span className="sys-item sys-right"><SysClock initial={now} /></span>
    </div>
  );
}

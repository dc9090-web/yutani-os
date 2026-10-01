import type { SystemReadout } from "../../lib/view/system.js";
import { SysClock } from "./SysClock.js";

const SYS_LABEL: Record<SystemReadout, string> = { ok: "online", error: "degraded", running: "syncing", none: "idle" };
const ESI_LABEL: Record<SystemReadout, string> = { ok: "ok", error: "error", running: "syncing", none: "—" };

export interface SystemStripProps {
  sync: SystemReadout;
  esi: SystemReadout;
  sdeBuild: number | null;
  characters: number;
  /** ISO timestamp of the server render; the clock ticks on from it client-side. */
  now: string;
}

/**
 * The console strip directly under the header (design hand-back 2026-10-01, `SystemStrip.tsx`):
 * sync state · ESI · SDE build · character count · UTC clock. Fed from the same data the settings
 * page shows; hidden under 760 px by the stylesheet.
 */
export function SystemStrip({ sync, esi, sdeBuild, characters, now }: SystemStripProps) {
  return (
    <div className="sys-strip">
      <span className="sys-item"><span className={`sys-dot ${sync}`} />Sys {SYS_LABEL[sync]}</span>
      <span className="sys-item">ESI · {ESI_LABEL[esi]}</span>
      <span className="sys-item">SDE {sdeBuild ?? "—"}</span>
      <span className="sys-item">{characters} character{characters === 1 ? "" : "s"}</span>
      <span className="sys-item sys-right"><SysClock initial={now} /></span>
    </div>
  );
}

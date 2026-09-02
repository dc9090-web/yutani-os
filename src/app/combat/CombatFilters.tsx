import Link from "next/link";
import { COMBAT_PERIODS, PERIOD_LABELS } from "../../lib/combat/stats.js";

/**
 * The period tabs and the All-characters toggle. Plain links carrying query parameters, so the page
 * stays a server component and a reload lands on exactly the view that was shared (Decision 10).
 */
export function CombatFilters({ period, all }: { period: string; all: boolean }) {
  const href = (p: string, a: boolean): string => `/combat?period=${p}${a ? "&all=1" : ""}`;
  return (
    <div className="combat-filters">
      <div className="combat-tabs" role="group" aria-label="Period">
        {COMBAT_PERIODS.map((p) => (
          <Link key={p} className="combat-tab" href={href(p, all)}
                data-active={p === period || undefined}
                aria-current={p === period ? "page" : undefined}>
            {PERIOD_LABELS[p]}
          </Link>
        ))}
      </div>
      <Link className="combat-tab" href={href(period, !all)} data-active={all || undefined}>
        All characters
      </Link>
    </div>
  );
}

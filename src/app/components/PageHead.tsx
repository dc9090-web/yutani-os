import type { ReactNode } from "react";

/**
 * Title block at the top of every page (redesign hand-off): the h1, then either a one-line `sub` or
 * the page's own lead content (the character dropdown), with an optional `aside` on the right — the
 * wallet balance, a filter box, a tab strip.
 */
export function PageHead({ title, sub, aside, children }: { title: string; sub?: ReactNode; aside?: ReactNode; children?: ReactNode }) {
  const lead = (
    <div className="yo-page-head">
      <h1 className="page-title">{title}</h1>
      {sub === undefined ? null : <p className="page-sub">{sub}</p>}
      {children}
    </div>
  );
  if (aside === undefined) return lead;
  return <div className="yo-page-head-row">{lead}{aside}</div>;
}

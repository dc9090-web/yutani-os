"use client";
import { useEffect, useState, type ReactNode } from "react";

export interface TabView {
  id: string;
  label: string;
  /** A count shown in mono after the label ("Fitted ships 67"). */
  count?: number;
  /** With `title`: what sits under the page title while this tab is showing. */
  lead?: ReactNode;
  content: ReactNode;
}

/**
 * The segmented-control tabs (redesign hand-off, DESIGN_SYSTEM.md "Tabs"). Every panel is rendered
 * on the server and handed in, so the page stays a server component; this only decides which one
 * shows. The active tab lives in the URL hash (`/skills#training`) so a reload or a shared link
 * comes back to it — read after hydration, so the first client render matches the server's HTML,
 * which always shows the first tab.
 *
 * With `title` the component also draws the page head: the h1 and the active tab's `lead` on the
 * left, the tab strip on the right. Without it, just the strip above the panels.
 */
export function Tabs({ tabs, label, title }: { tabs: TabView[]; label: string; title?: string }) {
  const [active, setActive] = useState(tabs[0]?.id);

  useEffect(() => {
    const fromHash = () => {
      const id = window.location.hash.slice(1);
      if (tabs.some((t) => t.id === id)) setActive(id);
    };
    fromHash();
    window.addEventListener("hashchange", fromHash);
    return () => window.removeEventListener("hashchange", fromHash);
  }, [tabs]);

  const pick = (id: string) => {
    setActive(id);
    history.replaceState(null, "", `#${id}`);
  };

  const strip = (
    <div className="yo-tabs" role="tablist" aria-label={label}>
      {tabs.map((t) => (
        <button
          key={t.id} type="button" className="yo-tab" role="tab" data-tab={t.id}
          id={`tab-${t.id}`} aria-controls={`panel-${t.id}`}
          data-active={active === t.id || undefined} aria-selected={active === t.id}
          onClick={() => pick(t.id)}
        >
          {t.label}
          {t.count === undefined ? null : <span className="yo-tab-count">{t.count}</span>}
        </button>
      ))}
    </div>
  );

  return (
    <>
      {title === undefined ? strip : (
        <div className="yo-page-head-row is-tabs">
          <div className="yo-page-head">
            <h1 className="page-title">{title}</h1>
            {tabs.map((t) => (t.lead === undefined ? null : <div key={t.id} hidden={active !== t.id}>{t.lead}</div>))}
          </div>
          {strip}
        </div>
      )}
      {tabs.map((t) => (
        <div key={t.id} id={`panel-${t.id}`} className="yo-tab-panel" role="tabpanel" aria-labelledby={`tab-${t.id}`} hidden={active !== t.id}>
          {t.content}
        </div>
      ))}
    </>
  );
}

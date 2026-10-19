"use client";
import { useEffect, useState, type ReactNode } from "react";

export interface SkillTab {
  id: string;
  label: string;
  content: ReactNode;
}

/**
 * Page-level tabs for the Skills page (Skills / Training / Multiview), styled like the design
 * hand-back's `.combat-tabs .skill-tabs` + `.combat-tab`. Every panel is rendered server-side and
 * handed in, so the page itself stays a server component; this wrapper only decides which one is
 * visible. The active tab lives in the URL hash (`/skills#training`) so a reload or a shared link
 * comes back to the same tab — read after hydration, so the first client render matches the SSR
 * HTML (which always shows the first tab).
 */
export function SkillTabs({ tabs }: { tabs: SkillTab[] }) {
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

  return (
    <>
      <div className="combat-tabs skill-tabs page-tabs" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.id} type="button" className="combat-tab" data-tab={t.id} role="tab"
            id={`tab-${t.id}`} aria-controls={`panel-${t.id}`}
            data-active={active === t.id || undefined} aria-selected={active === t.id}
            onClick={() => pick(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tabs.map((t) => (
        <div key={t.id} id={`panel-${t.id}`} role="tabpanel" aria-labelledby={`tab-${t.id}`} hidden={active !== t.id}>
          {t.content}
        </div>
      ))}
    </>
  );
}

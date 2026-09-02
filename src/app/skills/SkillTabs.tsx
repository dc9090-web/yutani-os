"use client";
import { useState, type ReactNode } from "react";

/**
 * Training queue / Trained skills toggle for the Skills page (design hand-back: `.combat-tabs
 * .skill-tabs` + `.combat-tab`, squared via CSS). The hand-back's static package flips this with
 * inline JS; here it's ordinary component state so the page itself can stay a server component —
 * both panels are rendered server-side and handed in as children, and this wrapper only decides
 * which one is visible.
 */
export function SkillTabs({ queue, trained }: { queue: ReactNode; trained: ReactNode }) {
  const [active, setActive] = useState<"queue" | "trained">("queue");
  return (
    <>
      <div className="combat-tabs skill-tabs" role="tablist" style={{ marginBottom: 16 }}>
        <button
          type="button" className="combat-tab" data-tab="queue" role="tab"
          data-active={active === "queue" || undefined} aria-selected={active === "queue"}
          onClick={() => setActive("queue")}
        >
          Training queue
        </button>
        <button
          type="button" className="combat-tab" data-tab="trained" role="tab"
          data-active={active === "trained" || undefined} aria-selected={active === "trained"}
          onClick={() => setActive("trained")}
        >
          Trained skills
        </button>
      </div>
      <div id="tab-queue" role="tabpanel" hidden={active !== "queue"}>{queue}</div>
      <div id="tab-trained" role="tabpanel" hidden={active !== "trained"}>{trained}</div>
    </>
  );
}

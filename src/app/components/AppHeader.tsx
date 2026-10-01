"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { TopNav } from "./TopNav.js";
import { CharacterSwitcher } from "./CharacterSwitcher.js";
import type { CharacterGroup } from "../../lib/view/characters.js";

export function AppHeader({ groups, activeId }: { groups: CharacterGroup[]; activeId: number | null }) {
  const pathname = usePathname();
  return (
    <header className="app-header">
      <div className="app-bar-inner">
        <Link href="/" className="logo-lockup" aria-label="Yutani OS — home">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/yutani/wordmark-white.png" alt="Yutani" className="logo-img" />
          <span className="logo-divider" aria-hidden="true" />
          <span className="logo-os">OS</span>
        </Link>
        <TopNav />
        <CharacterSwitcher groups={groups} activeId={activeId} pathname={pathname} />
      </div>
    </header>
  );
}

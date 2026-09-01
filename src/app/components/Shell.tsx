"use client";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { AppHeader } from "./AppHeader.js";
import { AppFooter } from "./AppFooter.js";
import { BottomBar } from "./BottomBar.js";
import { isBareRoute } from "./shell-routes.js";
import type { CharacterGroup } from "../../lib/view/characters.js";

export function Shell({ children, groups, activeId }: { children: ReactNode; groups: CharacterGroup[]; activeId: number | null }) {
  const pathname = usePathname();
  if (isBareRoute(pathname)) return <>{children}</>;
  return (<>
    <AppHeader groups={groups} activeId={activeId} />
    <main className="app-main">{children}</main>
    <AppFooter />
    <BottomBar />
  </>);
}

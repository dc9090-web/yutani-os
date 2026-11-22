"use client";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { AppHeader } from "./AppHeader.js";
import { SystemStrip, type SystemStripProps } from "./SystemStrip.js";
import { isBareRoute } from "./shell-routes.js";

export interface ShellAccount {
  /** OWNER_INITIALS; null draws a person icon instead. */
  initials: string | null;
  /** Characters whose token has to be re-authorised in Settings. */
  needsReauth: number;
}

/**
 * The frame every signed-in page sits in (redesign hand-off, DESIGN_SYSTEM.md "Shell"): header with
 * the nav and the account button, the status strip, then the page container. No footer and no
 * mobile bottom bar — on a phone the nav is the header's second, sideways-scrolling row.
 */
export function Shell({ children, account, system }: { children: ReactNode; account: ShellAccount; system: SystemStripProps }) {
  const pathname = usePathname();
  if (isBareRoute(pathname)) return <>{children}</>;
  return (<>
    <AppHeader account={account} />
    <SystemStrip {...system} />
    <main className="app-main">{children}</main>
  </>);
}

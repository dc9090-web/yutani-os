import Link from "next/link";
import { TopNav } from "./TopNav.js";
import { AccountMenu } from "./AccountMenu.js";
import type { ShellAccount } from "./Shell.js";

export function AppHeader({ account }: { account: ShellAccount }) {
  return (
    <header className="app-header">
      <Link href="/" className="logo-lockup" aria-label="Yutani OS home">
        {/* The real wordmark, not the artboards' text stand-in (REPO_MAPPING.md). */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/yutani/wordmark-white.png" alt="Yutani" className="logo-img" />
        <span className="logo-os">OS</span>
      </Link>
      <TopNav />
      <AccountMenu account={account} />
    </header>
  );
}

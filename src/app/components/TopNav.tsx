"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS, isNavActive } from "../../config/nav.js";
export function TopNav() {
  const pathname = usePathname();
  return (
    <nav className="top-nav" aria-label="Primary">
      {NAV_ITEMS.map((item) => { const active = isNavActive(item, pathname);
        return <Link key={item.key} href={item.href} className="nav-link" data-active={active || undefined} aria-current={active ? "page" : undefined}>{item.label}</Link>; })}
    </nav>
  );
}

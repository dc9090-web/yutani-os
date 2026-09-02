"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconHome, IconBrain, IconRocket, IconTool, IconBox, IconWallet, IconSwords, type IconProps } from "@tabler/icons-react";
import type { ComponentType } from "react";
import { NAV_ITEMS, isNavActive, type NavKey } from "../../config/nav.js";
// Clones has no tab here — the mobile bottom bar stays at its fixed seven destinations (design
// hand-back `clones.html`); it's reached from the top nav on wider screens.
const ICONS: Partial<Record<NavKey, ComponentType<IconProps>>> = { overview: IconHome, skills: IconBrain, ships: IconRocket, fitting: IconTool, assets: IconBox, wallet: IconWallet, combat: IconSwords };
export function BottomBar() {
  const pathname = usePathname();
  return (
    <nav className="bottom-bar" aria-label="Primary (mobile)">
      {NAV_ITEMS.filter((item) => item.key in ICONS).map((item) => { const Icon = ICONS[item.key]!; const active = isNavActive(item, pathname);
        return <Link key={item.key} href={item.href} className="bottom-item" data-active={active || undefined}><Icon size={20} stroke={1.8} /><span>{item.shortLabel}</span></Link>; })}
    </nav>
  );
}

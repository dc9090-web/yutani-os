"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconHome, IconBrain, IconRocket, IconTool, IconBox, IconWallet, IconSwords, type IconProps } from "@tabler/icons-react";
import type { ComponentType } from "react";
import { NAV_ITEMS, isNavActive, type NavKey } from "../../config/nav.js";
const ICONS: Record<NavKey, ComponentType<IconProps>> = { overview: IconHome, skills: IconBrain, ships: IconRocket, fitting: IconTool, assets: IconBox, wallet: IconWallet, combat: IconSwords };
export function BottomBar() {
  const pathname = usePathname();
  return (
    <nav className="bottom-bar" aria-label="Primary (mobile)">
      {NAV_ITEMS.map((item) => { const Icon = ICONS[item.key]; const active = isNavActive(item, pathname);
        return <Link key={item.key} href={item.href} className="bottom-item" data-active={active || undefined}><Icon size={20} stroke={1.8} /><span>{item.shortLabel}</span></Link>; })}
    </nav>
  );
}

export type NavKey = "overview" | "skills" | "clones" | "ships" | "fitting" | "assets" | "wallet" | "combat";
export interface NavItem { key: NavKey; label: string; shortLabel: string; href: string }

export const NAV_ITEMS: NavItem[] = [
  { key: "overview", label: "Overview", shortLabel: "Home", href: "/" },
  { key: "skills", label: "Skills", shortLabel: "Skills", href: "/skills" },
  { key: "clones", label: "Clones", shortLabel: "Clones", href: "/clones" },
  { key: "ships", label: "Ships", shortLabel: "Ships", href: "/ships" },
  { key: "fitting", label: "Fitting", shortLabel: "Fit", href: "/fitting" },
  { key: "assets", label: "Assets", shortLabel: "Assets", href: "/assets" },
  { key: "wallet", label: "Wallet", shortLabel: "Wallet", href: "/wallet" },
  { key: "combat", label: "Combat", shortLabel: "Combat", href: "/combat" },
];

export function isNavActive(item: NavItem, pathname: string): boolean {
  return item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
}

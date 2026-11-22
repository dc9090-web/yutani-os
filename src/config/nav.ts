export type NavKey = "overview" | "skills" | "clones" | "ships" | "fitting" | "assets" | "wallet" | "combat";
export interface NavItem { key: NavKey; label: string; href: string }

// The redesign (docs/design-handoff) took Fitting and Combat out of the navigation. Their routes
// still work — /fitting is linked from Ships › Saved fits — they just have no nav entry, which is
// why NavKey still names them.
export const NAV_ITEMS: NavItem[] = [
  { key: "overview", label: "Overview", href: "/" },
  { key: "skills", label: "Skills", href: "/skills" },
  { key: "clones", label: "Clones", href: "/clones" },
  { key: "ships", label: "Ships", href: "/ships" },
  { key: "assets", label: "Assets", href: "/assets" },
  { key: "wallet", label: "Wallet", href: "/wallet" },
];

export function isNavActive(item: NavItem, pathname: string): boolean {
  return item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
}

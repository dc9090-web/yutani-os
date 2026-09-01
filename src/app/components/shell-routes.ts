const BARE_PREFIXES = ["/login"];
export function isBareRoute(pathname: string | null): boolean { return !!pathname && BARE_PREFIXES.some((p) => pathname.startsWith(p)); }

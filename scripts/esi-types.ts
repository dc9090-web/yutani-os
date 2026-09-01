import { writeFile } from "node:fs/promises";
import openapiTS, { astToString } from "openapi-typescript";

export const SPEC = "https://esi.evetech.net/meta/openapi.json";
/**
 * A *published* compatibility date. ESI silently rounds an unlisted date down to the newest
 * published date <= it, and with no header at all it serves the 2020-01-01 spec (182 paths
 * instead of 218), which is how types.gen.ts was generated wrong the first time.
 * Keep this in lockstep with ESI_COMPATIBILITY_DATE.
 */
export const COMPATIBILITY_DATE = "2026-08-18";
const OUT = new URL("../src/lib/esi/types.gen.ts", import.meta.url);

/** openapi-typescript passes a `fetch` option straight through; this wraps it with the header. */
export function specFetch(fetchImpl: typeof fetch = fetch): typeof fetch {
  return ((url: string | URL | Request, init?: RequestInit) =>
    fetchImpl(url, {
      ...init,
      headers: { ...((init?.headers ?? {}) as Record<string, string>), "X-Compatibility-Date": COMPATIBILITY_DATE },
    })) as typeof fetch;
}

export async function generate(fetchImpl: typeof fetch = fetch): Promise<string> {
  // openapi-typescript 7.x has no `fetch` option on OpenAPITSOptions (it only takes a Redocly
  // `Config` for header injection); the resolver it delegates to calls `config.customFetch ||
  // fetch` — bare global fetch — so the compatibility-date header is patched in here instead.
  const original = globalThis.fetch;
  globalThis.fetch = specFetch(fetchImpl);
  try {
    const ast = await openapiTS(new URL(SPEC));
    return `// Generated from ${SPEC} (X-Compatibility-Date: ${COMPATIBILITY_DATE}) by scripts/esi-types.ts — do not edit.\n` + astToString(ast);
  } finally {
    globalThis.fetch = original;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await writeFile(OUT, await generate());
  console.log("wrote", OUT.pathname);
}

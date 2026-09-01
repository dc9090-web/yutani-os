import { NextResponse, type NextRequest } from "next/server";
import { loadDogmaData } from "../../../../lib/dogma/sde-loader.js";
import { serialiseMeta } from "../../../../lib/dogma/serialize.js";
import { getSdeMeta } from "../../../../lib/sde/repo.js";

/**
 * Spec §3: the attribute/effect/group half of `DogmaData`, ~1.25 MB of JSON, identical for every
 * request. It changes only when the SDE is re-imported, so the build number is the ETag and the
 * browser keeps it for a day.
 */
const CACHE = "public, max-age=86400";

export async function GET(req: NextRequest) {
  const meta = await getSdeMeta();
  if (meta === null) return NextResponse.json({ error: "no static data" }, { status: 503 });

  const etag = `"sde-${meta.buildNumber}"`;
  if (req.headers.get("if-none-match") === etag) {
    return new NextResponse(null, { status: 304, headers: { ETag: etag, "Cache-Control": CACHE } });
  }
  // An empty id list gives the base maps and no types — exactly this payload.
  const data = await loadDogmaData([]);
  return NextResponse.json(serialiseMeta(data, meta.buildNumber), {
    headers: { ETag: etag, "Cache-Control": CACHE },
  });
}

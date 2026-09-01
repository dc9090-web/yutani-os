import { NextResponse, type NextRequest } from "next/server";
import { MAX_IDS, parseIdList } from "../../../../lib/api/json.js";
import { loadDogmaData } from "../../../../lib/dogma/sde-loader.js";
import { serialiseTypes } from "../../../../lib/dogma/serialize.js";
import { getSdeMeta } from "../../../../lib/sde/repo.js";

export async function GET(req: NextRequest) {
  const ids = parseIdList(req.nextUrl.searchParams.get("ids"), MAX_IDS);
  if (ids === null) return NextResponse.json({ error: "bad request" }, { status: 400 });

  const meta = await getSdeMeta();
  if (meta === null) return NextResponse.json({ error: "no static data" }, { status: 503 });

  // loadDogmaData adds the transitive requiredSkillN closure, which is how the editor can name a
  // missing skill without a second round trip. Unknown ids are simply absent from the answer.
  const data = await loadDogmaData(ids);
  return NextResponse.json(
    { build: meta.buildNumber, types: serialiseTypes(data) },
    { headers: { "Cache-Control": "public, max-age=86400" } });
}

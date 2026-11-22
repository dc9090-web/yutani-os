import { NextResponse, type NextRequest } from "next/server";
import { authenticateApi, type ApiIdentity } from "../../auth/app-session.js";
import { getCharacter } from "../../db/characters.js";
import { parseId } from "../json.js";
import { respond, v1Error, type Resource } from "./respond.js";

export interface V1Context<P> { req: NextRequest; params: P; who: ApiIdentity }

/**
 * Every `/api/v1` GET: check who is asking (bearer token or the site's cookie), let the route name
 * its resource — or refuse with a 400 / 404 — and answer with the envelope and its ETag.
 */
export function v1Get<P = Record<string, never>>(resolve: (ctx: V1Context<P>) => Promise<Resource | NextResponse> | Resource | NextResponse) {
  return async (req: NextRequest, ctx: { params: Promise<P> }): Promise<NextResponse> => {
    const who = await authenticateApi(req);
    if (who === null) return v1Error(401, "unauthorised");
    const resource = await resolve({ req, params: await ctx.params, who });
    return resource instanceof NextResponse ? resource : respond(req, resource);
  };
}

/**
 * The character in the path: 400 for an id that is not one, 404 for a character the site does not
 * hold — the same set the pages' character switcher offers. Never reads `activeCharacterId`.
 */
export async function pathCharacter(raw: string): Promise<number | NextResponse> {
  const id = parseId(raw);
  if (id === null) return v1Error(400, "bad-id");
  return (await getCharacter(id)) === null ? v1Error(404, "not-found") : id;
}

/** A GET on `/api/v1/characters/{id}/…` whose only parameter is the character. */
export function characterGet(make: (characterId: number) => Resource) {
  return v1Get<{ id: string }>(async ({ params }) => {
    const id = await pathCharacter(params.id);
    return typeof id === "number" ? make(id) : id;
  });
}

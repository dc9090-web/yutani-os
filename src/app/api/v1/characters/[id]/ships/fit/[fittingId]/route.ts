import { parseId } from "../../../../../../../../lib/api/json.js";
import { shipDetailResource } from "../../../../../../../../lib/api/v1/resources.js";
import { v1Error } from "../../../../../../../../lib/api/v1/respond.js";
import { pathCharacter, v1Get } from "../../../../../../../../lib/api/v1/route.js";

export const GET = v1Get<{ id: string; fittingId: string }>(async ({ params }) => {
  const id = await pathCharacter(params.id);
  if (typeof id !== "number") return id;
  const detailId = parseId(params.fittingId);
  return detailId === null ? v1Error(400, "bad-id") : shipDetailResource(id, "fit", detailId);
});

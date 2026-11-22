import { assetsResource } from "../../../../../../lib/api/v1/resources.js";
import { characterGet } from "../../../../../../lib/api/v1/route.js";

export const GET = characterGet((characterId) => assetsResource(characterId));

import { meResource } from "../../../../lib/api/v1/resources.js";
import { v1Get } from "../../../../lib/api/v1/route.js";

export const GET = v1Get(({ who }) => meResource(who));

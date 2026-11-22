import { v1Get } from "../../../../lib/api/v1/route.js";
import { syncResource } from "../../../../lib/api/v1/sync.js";

export const GET = v1Get(({ who }) => syncResource(who));

/**
 * The planner's server-side glue. THIS IS THE ONLY MODULE UNDER src/lib/skills THAT TOUCHES
 * POSTGRES — everything else in this directory is pure and isomorphic. A "use client" component
 * must never import it; server components and API routes are its only callers.
 */
import { getAlphaSkills, listPlanSkills } from "../sde/repo.js";
import { buildCatalogue, type PlanSkill } from "./catalogue.js";

/** Every trainable skill with its rank, attribute pair, prerequisites and Alpha cap. */
export async function loadSkillCatalogue(): Promise<PlanSkill[]> {
  const [rows, alpha] = await Promise.all([listPlanSkills(), getAlphaSkills()]);
  return buildCatalogue(rows, alpha);
}

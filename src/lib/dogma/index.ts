/**
 * The dogma engine's public surface. Phase 4b (pages) and phase 5 (the fitting designer) import from
 * here; `sde-loader.js` is imported directly by server code only, because it is the one module that
 * touches Postgres.
 */
export {
  ATTR, CATEGORY, EFFECT, Operator, State,
  type AttrId, type DogmaAttribute, type DogmaData, type DogmaDataJson, type DogmaEffect,
  type DogmaGroup, type DogmaType, type EffectId, type GroupId, type Modifier, type ModifierDomain, type ModifierFunc, type TypeId,
  deserialiseDogmaData, serialiseDogmaData,
} from "./data.js";
export { PENALTY_BASE, penalizeValues, round2 } from "./operators.js";
export {
  CHARACTER_TYPE_ID, HARDPOINTS, SLOT_KINDS, UnknownTypeError, addModule, attachCharge, createFit,
  defaultStateOfType, effectiveState, fitItems, hardpointOf, hardpointOfType, kindOfType, makeItem,
  makeSkill, requiredSkills, slotOf, slotOfType,
  type Fit, type Hardpoint, type Item, type ItemDomain, type ItemKind, type SlotKind, type Slotted,
} from "./fit.js";
export {
  DogmaCycleError, UnknownAttributeError, clearMemo, explain, getAttr, type AppliedModifier,
} from "./calc.js";
export { fitStats, type FitStats, type ModuleStat, type ResourcePool, type SlotUsage } from "./stats.js";
export {
  itemLabel, missingSkills, validateFit, type MissingSkill, type Problem, type ProblemKind,
} from "./validate.js";
export {
  DRONE_BAY_FLAG, INVALID_FLAG, fitFromAssets, fitFromFitting, slotFromFlag,
  type BuiltFit, type FitContext, type FitEntry,
} from "./build.js";
export {
  deserialiseMeta, deserialiseTypes, dogmaDataFrom, serialiseMeta, serialiseTypes,
  type DogmaMeta, type DogmaMetaJson, type DogmaTypesJson,
} from "./serialize.js";

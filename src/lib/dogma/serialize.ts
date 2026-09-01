/**
 * The wire format the browser engine is fed with (spec §3).
 *
 * `data.ts` already serialises a **whole** `DogmaData` for the committed test fixtures. This module
 * is the *split* the HTTP layer needs: one big meta payload (attributes, effects, groups — identical
 * for every request, cacheable for a day behind the SDE build number) and small per-id type batches.
 * Both halves carry the build number so the client can drop a stale memo after an SDE re-import.
 */
import type {
  AttrId, DogmaAttribute, DogmaAttributeJson, DogmaData, DogmaEffect, DogmaEffectJson, DogmaGroup,
  DogmaType, DogmaTypeJson, EffectId, GroupId, TypeId,
} from "./data.js";

export interface DogmaMeta {
  build: number;
  attributes: Map<AttrId, DogmaAttribute>;
  effects: Map<EffectId, DogmaEffect>;
  groups: Map<GroupId, DogmaGroup>;
}
export interface DogmaMetaJson {
  build: number;
  attributes: DogmaAttributeJson[];
  effects: DogmaEffectJson[];
  groups: DogmaGroup[];
}
export interface DogmaTypesJson { build: number; types: DogmaTypeJson[] }

export function serialiseMeta(data: DogmaData, build: number): DogmaMetaJson {
  return {
    build,
    attributes: [...data.attributes.values()],
    effects: [...data.effects.values()],
    groups: [...data.groups.values()],
  };
}

export function deserialiseMeta(json: DogmaMetaJson): DogmaMeta {
  return {
    build: json.build,
    attributes: new Map(json.attributes.map((a) => [a.id, a])),
    effects: new Map(json.effects.map((e) => [e.id, e])),
    groups: new Map(json.groups.map((g) => [g.id, g])),
  };
}

/** Maps are not JSON-representable; a type's attribute and effect maps travel as entry arrays. */
export function serialiseTypes(data: DogmaData): DogmaTypeJson[] {
  return [...data.types.values()].map((t) => ({
    id: t.id, groupId: t.groupId, categoryId: t.categoryId, name: t.name,
    attrs: [...t.attrs.entries()], effects: [...t.effects.entries()],
  }));
}

export function deserialiseTypes(json: readonly DogmaTypeJson[]): Map<TypeId, DogmaType> {
  return new Map(json.map((t) => [t.id, {
    id: t.id, groupId: t.groupId, categoryId: t.categoryId, name: t.name,
    attrs: new Map(t.attrs), effects: new Map(t.effects),
  }]));
}

/**
 * The engine's view of "everything we have so far". The meta maps are **shared, not copied** — the
 * engine only reads them and the client rebuilds this object on every edit.
 */
export function dogmaDataFrom(meta: DogmaMeta, types: Map<TypeId, DogmaType>): DogmaData {
  return { attributes: meta.attributes, effects: meta.effects, groups: meta.groups, types };
}

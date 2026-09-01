import {
  CATEGORY, Operator, State,
  type AttrId, type DogmaAttribute, type DogmaData, type DogmaEffect, type DogmaGroup, type DogmaType,
  type EffectId, type GroupId, type Modifier, type TypeId,
} from "../../src/lib/dogma/data.js";

export interface TypeOver {
  id?: TypeId; groupId?: GroupId; categoryId?: number; name?: string | null;
  attrs?: [AttrId, number][]; effects?: [EffectId, boolean][];
}

export interface World {
  data: DogmaData;
  attr(over?: Partial<DogmaAttribute>): DogmaAttribute;
  effect(over?: Partial<DogmaEffect>): DogmaEffect;
  group(categoryId: number): DogmaGroup;
  type(over?: TypeOver): DogmaType;
}

/** EOS's test harness shape: auto-allocated ids from 1 000 000 over an in-memory DogmaData. */
export function world(): World {
  let next = 1_000_000;
  const data: DogmaData = { attributes: new Map(), effects: new Map(), types: new Map(), groups: new Map() };

  const group = (categoryId: number): DogmaGroup => {
    const g: DogmaGroup = { id: next++, name: null, categoryId };
    data.groups.set(g.id, g);
    return g;
  };

  return {
    data,
    group,
    attr(over: Partial<DogmaAttribute> = {}): DogmaAttribute {
      const a: DogmaAttribute = { id: next++, name: null, defaultValue: 0, stackable: true, highIsGood: true, ...over };
      data.attributes.set(a.id, a);
      return a;
    },
    effect(over: Partial<DogmaEffect> = {}): DogmaEffect {
      const e: DogmaEffect = { id: next++, categoryId: 0, state: State.Offline, modifiers: [], ...over };
      data.effects.set(e.id, e);
      return e;
    },
    type(over: TypeOver = {}): DogmaType {
      const categoryId = over.categoryId ?? CATEGORY.module;
      const groupId = over.groupId ?? group(categoryId).id;
      if (!data.groups.has(groupId)) data.groups.set(groupId, { id: groupId, name: null, categoryId });
      const t: DogmaType = {
        id: over.id ?? next++, groupId, categoryId, name: over.name ?? null,
        attrs: new Map(over.attrs ?? []), effects: new Map(over.effects ?? []),
      };
      data.types.set(t.id, t);
      return t;
    },
  };
}

/** A Modifier with the common defaults filled in. */
export function mod(over: Partial<Modifier> & Pick<Modifier, "modifiedAttrId" | "modifyingAttrId">): Modifier {
  return { func: "ItemModifier", domain: "self", operation: Operator.PostPercent, ...over };
}

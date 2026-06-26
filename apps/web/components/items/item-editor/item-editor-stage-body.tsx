"use client";

import { ItemCompositionStage, type ItemCompositionStageModel } from "@/components/items/item-editor/item-composition-stage";
import { ItemEssentialsStage, type ItemEssentialsStageModel } from "@/components/items/item-editor/item-essentials-stage";
import { ItemReachStage, type ItemReachStageModel } from "@/components/items/item-editor/item-reach-stage";
import { ItemVariantsStage, type ItemVariantsStageModel } from "@/components/items/item-editor/item-variants-stage";

export type ItemEditorStageBodyProps = {
  essentials: ItemEssentialsStageModel;
  variants?: ItemVariantsStageModel | null;
  composition?: ItemCompositionStageModel | null;
  reach?: ItemReachStageModel | null;
};

/** Composes all item wizard / editor stage sections in catalog order. */
export function ItemEditorStageBody({
  essentials,
  variants = null,
  composition = null,
  reach = null,
}: ItemEditorStageBodyProps) {
  return (
    <>
      <ItemEssentialsStage model={essentials} />
      {variants ? <ItemVariantsStage model={variants} /> : null}
      {composition ? <ItemCompositionStage model={composition} /> : null}
      {reach ? <ItemReachStage model={reach} /> : null}
    </>
  );
}

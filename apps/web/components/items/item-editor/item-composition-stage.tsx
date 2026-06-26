"use client";

import type { ReactNode } from "react";
import { EditorSectionBlock } from "@/components/products/product-editor/editor-form-primitives";
import { ProductCompositionSection } from "@/components/products/product-editor/product-composition-section";
import type { CompositionCommitResult } from "@/components/products/product-editor/composition-editor";
import type { ItemClassification } from "@/lib/products/classification-labels";
import { COMPOSITION_SECTION_LABEL } from "@/lib/products/composition";
import type { EditorSectionId } from "@/lib/products/editor-sections";
import type { ItemType } from "@/lib/products/item-model";
import type { ProductVariantSnapshot } from "@/lib/products/types";

export type ItemCompositionStageModel = {
  stageAccordionHeader: ReactNode;
  sectionVisible: (id: EditorSectionId) => boolean;
  registerSection: (id: EditorSectionId) => (el: HTMLDivElement | null) => void;
  isPanelLayout: boolean;
  itemId: string;
  itemType: ItemType;
  classification: ItemClassification;
  variants: ProductVariantSnapshot[];
  isMultiSku: boolean;
  currency: string;
  readOnly: boolean;
  compositionDeferSave: boolean;
  onRegisterCommit: (commit: (() => Promise<CompositionCommitResult>) | null) => void;
  onDirtyChange: (dirty: boolean) => void;
};

type Props = {
  model: ItemCompositionStageModel;
};

export function ItemCompositionStage({ model }: Props) {
  const {
    stageAccordionHeader,
    sectionVisible,
    registerSection,
    isPanelLayout,
    itemId,
    itemType,
    classification,
    variants,
    isMultiSku,
    currency,
    readOnly,
    compositionDeferSave,
    onRegisterCommit,
    onDirtyChange,
  } = model;

  return (
    <>
      {stageAccordionHeader}
      <EditorSectionBlock
        id="composition"
        title={COMPOSITION_SECTION_LABEL}
        description="Items included when this product is sold as a set."
        registerRef={registerSection("composition")}
        hidden={!sectionVisible("composition")}
        panel={isPanelLayout}
      >
        <ProductCompositionSection
          itemId={itemId}
          parentItemType={itemType}
          classification={classification}
          variants={variants}
          isMultiSku={isMultiSku}
          currency={currency}
          readOnly={readOnly}
          deferSave={compositionDeferSave}
          onRegisterCommit={onRegisterCommit}
          onDirtyChange={onDirtyChange}
        />
      </EditorSectionBlock>
    </>
  );
}

"use client";

import type { ItemClassification } from "@/lib/products/classification-labels";
import {
  compositionEmptyStateMessage,
  compositionRoleAllowsComponents,
} from "@/lib/products/composition";
import { CompositionEditor } from "@/components/products/product-editor/composition-editor";
import type { CompositionCommitResult } from "@/components/products/product-editor/composition-editor";
import { editorEmptyStateClass, useEditorPanelLayout } from "@/lib/products/editor-chrome";
import type { ItemType } from "@/lib/products/item-model";
import type { ProductVariantSnapshot } from "@/lib/products/types";

type Props = {
  itemId: string | null;
  parentItemType: ItemType;
  classification: ItemClassification;
  variants: ProductVariantSnapshot[];
  isMultiSku: boolean;
  currency: string;
  readOnly?: boolean;
  deferSave?: boolean;
  onRegisterCommit?: (commit: (() => Promise<CompositionCommitResult>) | null) => void;
  onDirtyChange?: (dirty: boolean) => void;
};

export function ProductCompositionSection({
  itemId,
  parentItemType,
  classification,
  variants,
  isMultiSku,
  currency,
  readOnly = false,
  deferSave = false,
  onRegisterCommit,
  onDirtyChange,
}: Props) {
  const isPanelLayout = useEditorPanelLayout();

  if (!compositionRoleAllowsComponents(parentItemType, classification)) {
    return (
      <p className={editorEmptyStateClass(isPanelLayout)}>
        {compositionEmptyStateMessage(parentItemType, classification, Boolean(itemId))}
      </p>
    );
  }

  if (!itemId) {
    return (
      <p className={editorEmptyStateClass(isPanelLayout)}>
        {compositionEmptyStateMessage(parentItemType, classification, false)}
      </p>
    );
  }

  return (
    <CompositionEditor
      itemId={itemId}
      parentItemType={parentItemType}
      classification={classification}
      variants={variants}
      isMultiSku={isMultiSku}
      currency={currency}
      readOnly={readOnly}
      deferSave={deferSave}
      onRegisterCommit={onRegisterCommit}
      onDirtyChange={onDirtyChange}
    />
  );
}

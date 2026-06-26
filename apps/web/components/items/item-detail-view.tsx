"use client";

import { ProductItemSummaryCard } from "@/components/products/product-item-summary-card";
import { MutationGlassRoot } from "@/components/layout/mutation-form/mutation-glass-root";
import type { AttributeTemplateEntry } from "@/lib/categories/types";
import type { ProductCatalogContext, ProductDetailSnapshot } from "@/lib/products/types";
import type { ProductPeekPanelId } from "@/lib/products/peek-panels";
import { cn } from "@/lib/utils";

type Props = {
  detail: ProductDetailSnapshot;
  currency: string;
  catalogContext?: ProductCatalogContext | null;
  categoryTemplates?: AttributeTemplateEntry[];
  peekPanel?: ProductPeekPanelId;
  onPeekPanelChange?: (panel: ProductPeekPanelId) => void;
  peekPanelLoading?: ProductPeekPanelId | null;
  isValuationsLoading?: boolean;
  className?: string;
};

/**
 * Unified read-only item detail — shared by split inline panel, matrix drawer peek, and item drawer view.
 */
export function ItemDetailView({
  detail,
  currency,
  catalogContext = null,
  categoryTemplates = [],
  peekPanel,
  onPeekPanelChange,
  peekPanelLoading,
  isValuationsLoading = false,
  className,
}: Props) {
  return (
    <MutationGlassRoot className={cn("pb-2", className)}>
      <ProductItemSummaryCard
        detail={detail}
        currency={currency}
        catalogContext={catalogContext}
        categoryTemplates={categoryTemplates}
        peekPanel={peekPanel}
        onPeekPanelChange={onPeekPanelChange}
        peekPanelLoading={peekPanelLoading}
        isValuationsLoading={isValuationsLoading}
      />
    </MutationGlassRoot>
  );
}

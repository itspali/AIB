"use client";

import { useMemo } from "react";
import { Package } from "lucide-react";
import { ItemDetailView } from "@/components/items/item-detail-view";
import { ItemDetailPeekHeader } from "@/components/items/item-detail-peek-header";
import {
  ItemsRecordDetailBody,
  ItemsRecordDetailHero,
} from "@/components/items/revamp/items-record-detail-body";
import { ProductPanelHeaderActions } from "@/components/products/product-panel-form";
import { Spinner } from "@/components/ui/spinner";
import { resolveEffectiveAttributeTemplates } from "@/lib/categories/tree";
import type { CategoryRow } from "@/lib/categories/types";
import { itemFullPageHref } from "@/lib/products/item-navigation";
import type { ProductCatalogContext, ProductDetailSnapshot, ProductListRow } from "@/lib/products/types";
import type { ProductPeekPanelId } from "@/lib/products/peek-panels";
import { cn } from "@/lib/utils";
import { useOptionalProductPanelContext } from "@/components/products/product-panel-form";

type Props = {
  detail: ProductDetailSnapshot | null;
  selectedRow: ProductListRow | null;
  loading: boolean;
  catalogContext?: ProductCatalogContext | null;
  categories?: CategoryRow[];
  peekPanel?: ProductPeekPanelId;
  onPeekPanelChange?: (panel: ProductPeekPanelId) => void;
  peekPanelLoading?: ProductPeekPanelId | null;
  onBack?: () => void;
  showMobileBack?: boolean;
  className?: string;
};

export function ItemsDetailCanvas({
  detail,
  selectedRow,
  loading,
  catalogContext = null,
  categories = [],
  peekPanel,
  onPeekPanelChange,
  peekPanelLoading,
  onBack,
  showMobileBack = false,
  className,
}: Props) {
  const panelContext = useOptionalProductPanelContext();
  const categoryTemplates = useMemo(() => {
    if (!detail?.category_id || categories.length === 0) return [];
    return resolveEffectiveAttributeTemplates(detail.category_id, categories);
  }, [categories, detail?.category_id]);

  if (!selectedRow && !detail) {
    return (
      <section className={cn("spatial-detail-pane spatial-detail-pane--empty", className)}>
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 ring-1 ring-primary/20">
            <Package className="h-6 w-6 text-primary" aria-hidden />
          </div>
          <p className="text-sm font-medium">Select an item</p>
          <p className="max-w-xs text-xs text-muted-foreground">
            Choose a record from the master feed to inspect details here.
          </p>
        </div>
      </section>
    );
  }

  const itemId = detail?.id ?? selectedRow?.id ?? null;
  const popOutHref =
    panelContext?.fullPageHref ??
    (itemId ? itemFullPageHref("view", itemId, { fromCatalog: true }) : undefined);

  return (
    <section className={cn("spatial-detail-pane", className)}>
      <ItemDetailPeekHeader
        detail={detail}
        selectedRow={selectedRow}
        popOutHref={popOutHref}
        showMobileBack={showMobileBack}
        onBack={onBack}
        trailingActions={panelContext ? <ProductPanelHeaderActions /> : null}
      />

      <div className="spatial-detail-body min-h-0 flex-1 overflow-y-auto overscroll-y-contain">
        {detail ? (
          loading ? (
            <div className="flex flex-1 items-center justify-center py-12">
              <Spinner className="h-6 w-6 text-primary" />
            </div>
          ) : (
            <ItemDetailView
              detail={detail}
              currency={catalogContext?.base_currency ?? "USD"}
              catalogContext={catalogContext}
              categoryTemplates={categoryTemplates}
              peekPanel={peekPanel}
              onPeekPanelChange={onPeekPanelChange}
              peekPanelLoading={peekPanelLoading}
              showContextBanner={false}
            />
          )
        ) : (
          <>
            <ItemsRecordDetailHero detail={detail} row={selectedRow} />
            {loading ? (
              <div className="flex flex-1 items-center justify-center py-12">
                <Spinner className="h-6 w-6 text-primary" />
              </div>
            ) : (
              <ItemsRecordDetailBody detail={detail} row={selectedRow} variant="spatial" />
            )}
          </>
        )}
      </div>
    </section>
  );
}

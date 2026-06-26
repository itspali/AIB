"use client";

import { useMemo } from "react";
import { ArrowLeft, Package, Pencil } from "lucide-react";
import { ItemDetailView } from "@/components/items/item-detail-view";
import { MutationIconButton } from "@/components/layout/mutation-form/mutation-icon-button";
import {
  buildItemsRecordDetailView,
  ItemsRecordDetailBody,
  ItemsRecordDetailHero,
} from "@/components/items/revamp/items-record-detail-body";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { resolveEffectiveAttributeTemplates } from "@/lib/categories/tree";
import type { CategoryRow } from "@/lib/categories/types";
import { itemFullPageHref } from "@/lib/products/item-navigation";
import type { ProductCatalogContext, ProductDetailSnapshot, ProductListRow } from "@/lib/products/types";
import type { ProductPeekPanelId } from "@/lib/products/peek-panels";
import { cn } from "@/lib/utils";
import { DrawerPopOutButton } from "@/components/layout/drawer-pop-out-button";

type Props = {
  detail: ProductDetailSnapshot | null;
  selectedRow: ProductListRow | null;
  loading: boolean;
  catalogContext?: ProductCatalogContext | null;
  categories?: CategoryRow[];
  peekPanel?: ProductPeekPanelId;
  onPeekPanelChange?: (panel: ProductPeekPanelId) => void;
  peekPanelLoading?: ProductPeekPanelId | null;
  onEdit: () => void;
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
  onEdit,
  onBack,
  showMobileBack = false,
  className,
}: Props) {
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

  const view = buildItemsRecordDetailView(detail, selectedRow);
  const popOutHref = view.itemId
    ? itemFullPageHref("view", view.itemId, { fromCatalog: true })
    : undefined;

  return (
    <section className={cn("spatial-detail-pane", className)}>
      <header className="spatial-detail-header">
        <div className="flex min-h-0 min-w-0 flex-1 items-center gap-2">
          {popOutHref ? <DrawerPopOutButton href={popOutHref} label="Open item outside panel" /> : null}
          <div className="min-w-0 flex-1">
            <h2 className="spatial-detail-id truncate">{view.skuDisplay}</h2>
            <p className="spatial-detail-name truncate">{view.name}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {showMobileBack && onBack ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="spatial-mobile-back h-8 lg:hidden"
              onClick={onBack}
            >
              <ArrowLeft className="mr-1 h-3.5 w-3.5" aria-hidden />
              Back
            </Button>
          ) : null}
          {view.itemId ? (
            <MutationIconButton
              label="Edit item"
              icon={Pencil}
              onClick={onEdit}
              className="h-8 w-8"
            />
          ) : null}
        </div>
      </header>

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

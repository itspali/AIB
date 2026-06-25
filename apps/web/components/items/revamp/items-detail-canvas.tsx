"use client";

import Link from "next/link";
import { ArrowLeft, ExternalLink, Package, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  buildItemsRecordDetailView,
  ItemsRecordDetailBody,
  ItemsRecordDetailHero,
} from "@/components/items/revamp/items-record-detail-body";
import { itemFullPageHref } from "@/lib/products/item-navigation";
import type { ProductDetailSnapshot, ProductListRow } from "@/lib/products/types";
import { cn } from "@/lib/utils";

type Props = {
  detail: ProductDetailSnapshot | null;
  selectedRow: ProductListRow | null;
  loading: boolean;
  onEdit: () => void;
  onBack?: () => void;
  showMobileBack?: boolean;
  className?: string;
};

export function ItemsDetailCanvas({
  detail,
  selectedRow,
  loading,
  onEdit,
  onBack,
  showMobileBack = false,
  className,
}: Props) {
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

  return (
    <section className={cn("spatial-detail-pane", className)}>
      <header className="spatial-detail-header">
        <div className="min-w-0 flex-1">
          <h2 className="spatial-detail-id truncate">{view.skuDisplay}</h2>
          <p className="spatial-detail-name truncate">{view.name}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
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
            <Button variant="outline" size="sm" className="spatial-detail-action h-8 gap-1.5" asChild>
              <Link
                href={itemFullPageHref("view", view.itemId, { fromCatalog: true })}
                aria-label="Open full page"
              >
                <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                <span className="hidden sm:inline">Open</span>
              </Link>
            </Button>
          ) : null}
          <Button
            type="button"
            size="sm"
            className="spatial-detail-action spatial-detail-action--primary h-8 gap-1.5 shadow-glow-sm"
            onClick={onEdit}
          >
            <Pencil className="h-3.5 w-3.5" aria-hidden />
            <span className="hidden sm:inline">Edit item</span>
            <span className="sr-only sm:hidden">Edit item</span>
          </Button>
        </div>
      </header>

      <div className="spatial-detail-body">
        <ItemsRecordDetailHero detail={detail} row={selectedRow} />

        {loading ? (
          <div className="flex flex-1 items-center justify-center py-12">
            <Spinner className="h-6 w-6 text-primary" />
          </div>
        ) : (
          <ItemsRecordDetailBody detail={detail} row={selectedRow} variant="spatial" />
        )}
      </div>
    </section>
  );
}

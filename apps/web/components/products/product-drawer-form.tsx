"use client";

import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { ProductFormEditLinkContent } from "@/components/products/product-form-edit-link-content";
import { ProductFormSkeleton } from "@/components/products/product-form-skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RightDrawer } from "@/components/ui/right-drawer";
import type { CategoryRow } from "@/lib/categories/types";
import { formatDate } from "@/lib/dashboard/format";
import { classificationLabel } from "@/lib/products/classification-labels";
import { itemStatusLabel, itemTypeLabel } from "@/lib/products/item-model";
import { taxCategoryLabel } from "@/lib/products/tax-options";
import { variantStrategyLabel } from "@/lib/products/variant-strategy";
import type { ProductFormMode } from "@/lib/products/use-product-form";
import type { ProductCatalogContext, ProductDetailSnapshot } from "@/lib/products/types";

const ITEMS_HREF = "/inventory/items";

type Props = {
  open: boolean;
  mode: ProductFormMode;
  onOpenChange: (open: boolean) => void;
  onModeChange: (mode: ProductFormMode) => void;
  tenantId: string;
  categories: CategoryRow[];
  catalogContext: ProductCatalogContext | null;
  detail?: ProductDetailSnapshot | null;
  isLoading?: boolean;
  onSaved: (itemId: string, detail?: ProductDetailSnapshot | null) => void;
  onExtensionsChanged?: () => void;
};

function formatMoney(amount: string | null | undefined, currency: string): string {
  const parsed = Number(amount);
  if (!amount || !Number.isFinite(parsed)) return "—";
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: currency || "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(parsed);
}

function Fact({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className={mono ? "truncate font-mono text-sm" : "truncate text-sm"}>{value}</p>
    </div>
  );
}

/**
 * Read-only quick peek for the item catalog. Heavy create/edit lives on the
 * deep-linkable routes (ProductEditorShell); this drawer just surfaces the key
 * facts and links out to the full editor.
 */
export function ProductDrawerForm({
  open,
  onOpenChange,
  catalogContext,
  detail = null,
  isLoading = false,
}: Props) {
  const currency = catalogContext?.base_currency ?? "USD";
  const isMultiSku = detail?.variant_strategy === "MULTI_SKU";

  return (
    <RightDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={detail?.name ?? "Item"}
      description={detail?.sku ? detail.sku : "Quick view"}
      scrollable
      headerActions={
        detail ? (
          <>
            <Button asChild variant="ghost" size="sm">
              <Link href={`${ITEMS_HREF}/${detail.id}`} prefetch>
                <ExternalLink className="h-4 w-4" />
                Open
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href={`${ITEMS_HREF}/${detail.id}/edit`} prefetch>
                <ProductFormEditLinkContent />
              </Link>
            </Button>
          </>
        ) : null
      }
    >
      {!open ? null : isLoading || !detail ? (
        <ProductFormSkeleton />
      ) : (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="active">{itemTypeLabel(detail.item_type)}</Badge>
            <Badge variant={detail.status === "ACTIVE" ? "completed" : "locked"}>
              {itemStatusLabel(detail.status)}
            </Badge>
            <Badge variant="default">{classificationLabel(detail.classification)}</Badge>
            <Badge variant="default">{variantStrategyLabel(detail.variant_strategy)}</Badge>
            {detail.needs_review ? <Badge variant="action_required">Needs review</Badge> : null}
            {!detail.is_active ? <Badge variant="locked">Inactive</Badge> : null}
          </div>

          {detail.description ? (
            <p className="whitespace-pre-wrap text-sm text-muted-foreground">{detail.description}</p>
          ) : null}

          <div className="grid grid-cols-2 gap-4">
            <Fact label={isMultiSku ? "Style code" : "Master SKU"} value={detail.sku} mono />
            <Fact label="Base unit" value={detail.base_unit_of_measure} />
            <Fact label="Category" value={detail.category_name ?? "Uncategorized"} />
            <Fact label="Tax category" value={taxCategoryLabel(detail.default_tax_category)} />
            <Fact
              label="Selling rate"
              value={`${formatMoney(detail.selling_price, currency)} / ${detail.selling_uom}`}
              mono
            />
            <Fact label="Purchase rate" value={formatMoney(detail.purchase_price, currency)} mono />
            <Fact label="Preferred supplier" value={detail.supplier_name ?? "—"} />
            <Fact label="HSN / SAC" value={detail.hsn_sac_code ?? "—"} mono />
            <Fact
              label="Purchasable"
              value={detail.is_purchasable ? "Yes" : "No"}
            />
            <Fact label="Salable" value={detail.is_salable ? "Yes" : "No"} />
            <Fact label="Variants" value={String(detail.variants.length)} />
            <Fact label="Media" value={String(detail.media.length)} />
          </div>

          <div className="grid grid-cols-2 gap-4 border-t border-border pt-4">
            <Fact label="Created" value={formatDate(detail.created_at)} />
            <Fact label="Updated" value={formatDate(detail.updated_at)} />
          </div>
        </div>
      )}
    </RightDrawer>
  );
}

"use client";

import { Fragment, useMemo } from "react";
import { Layers, Undo2, type LucideIcon } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { ProductListItemImage } from "@/components/products/product-list-item-image";
import {
  buildSplitFeedCardPlan,
  type SplitFeedCapabilityIcon,
  type SplitFeedCapabilityIconColumnId,
} from "@/lib/items/split-feed-card-plan";
import { LIST_WORKSPACE_BULK_CHECKBOX_CLASS } from "@/lib/layout/list-table-chrome";
import {
  GLASS_V2_LIST_IMAGE,
} from "@/lib/layout/list-module-chrome";
import { isProductListRowInactive } from "@/lib/products/list-row-key";
import type { ProductListColumnId } from "@/lib/products/list-columns";
import type { ProductListRow } from "@/lib/products/types";
import { cn } from "@/lib/utils";

const CAPABILITY_ICON: Record<SplitFeedCapabilityIconColumnId, LucideIcon> = {
  has_variants: Layers,
  is_returnable: Undo2,
};

function SplitFeedCapabilityIconBadge({ icon }: { icon: SplitFeedCapabilityIcon }) {
  const Icon = CAPABILITY_ICON[icon.columnId];

  return (
    <span
      title={icon.tooltip}
      aria-label={icon.tooltip}
      className={cn(
        "inline-flex shrink-0",
        icon.enabled
          ? "text-blue-600 dark:text-blue-400"
          : "text-blue-600/35 dark:text-blue-400/35"
      )}
    >
      <Icon className="h-3 w-3" aria-hidden />
    </span>
  );
}

type Props = {
  product: ProductListRow;
  columns: ProductListColumnId[];
  showVariants?: boolean;
  active: boolean;
  bulkSelected?: boolean;
  onSelect: () => void;
  onBulkToggle?: (checked: boolean) => void;
};

export function ItemsMasterFeedCard({
  product,
  columns,
  showVariants = false,
  active,
  bulkSelected = false,
  onSelect,
  onBulkToggle,
}: Props) {
  const plan = useMemo(
    () => buildSplitFeedCardPlan(columns, product, showVariants),
    [columns, product, showVariants]
  );
  const rowInactive = isProductListRowInactive(product, showVariants);
  const bulkEnabled = Boolean(onBulkToggle);

  return (
    <div
      className={cn(
        "spatial-master-card-row flex items-start gap-2",
        rowInactive && "spatial-master-card-row--inactive",
        active && "spatial-master-card-row--active"
      )}
    >
      {bulkEnabled ? (
        <div
          className={cn(
            "flex shrink-0 pl-1",
            plan.showImage ? "spatial-master-card-checkbox--with-image" : "pt-3"
          )}
          onClick={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <Checkbox
            className={LIST_WORKSPACE_BULK_CHECKBOX_CLASS}
            checked={bulkSelected}
            onCheckedChange={(checked) => onBulkToggle?.(checked === true)}
            aria-label={`Select ${product.name}${product.default_sku ? ` (${product.default_sku})` : ""}`}
          />
        </div>
      ) : null}
      <button
        type="button"
        onClick={onSelect}
        className={cn(
          "spatial-master-card min-w-0 flex-1",
          plan.showImage && "spatial-master-card--with-image"
        )}
        aria-pressed={active}
      >
        {plan.showImage ? (
          <div className="spatial-master-card-image-cell">
            <ProductListItemImage
              product={product}
              className={cn(
                GLASS_V2_LIST_IMAGE,
                "spatial-master-card-image !h-full !w-full shrink-0 overflow-hidden"
              )}
            />
          </div>
        ) : null}
        <span
          className={cn(
            "spatial-card-top-row",
            plan.showImage && "spatial-master-card-sku-cell"
          )}
        >
          <span className="spatial-card-id">{plan.sku}</span>
          {plan.topRightValue ? (
            <span className="spatial-card-value">{plan.topRightValue}</span>
          ) : null}
        </span>
        <span
          className={cn(
            "spatial-card-name flex min-w-0 items-center gap-1.5",
            plan.showImage && "spatial-master-card-name-cell"
          )}
        >
          <span className="min-w-0 flex-1 truncate">{plan.name}</span>
          {plan.capabilityIcons.length > 0 ? (
            <span className="flex shrink-0 items-center gap-1">
              {plan.capabilityIcons.map((icon) => (
                <SplitFeedCapabilityIconBadge key={icon.columnId} icon={icon} />
              ))}
            </span>
          ) : null}
        </span>
        {plan.metaSegments.length > 0 ? (
          <span
            className={cn(
              "spatial-card-meta",
              plan.showImage && "spatial-master-card-meta-cell"
            )}
          >
            {plan.metaSegments.map((segment, index) => (
              <Fragment key={`${segment.text}-${index}`}>
                {index > 0 ? <span aria-hidden="true"> • </span> : null}
                <span
                  className={
                    segment.flagEnabled !== undefined
                      ? segment.flagEnabled
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-muted-foreground"
                      : undefined
                  }
                >
                  {segment.text}
                </span>
              </Fragment>
            ))}
          </span>
        ) : null}
      </button>
    </div>
  );
}

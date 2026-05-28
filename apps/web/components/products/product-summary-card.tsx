"use client";

import { Badge } from "@/components/ui/badge";
import { classificationLabel } from "@/lib/products/classification-labels";
import type { ProductListRow } from "@/lib/products/types";
import { cn } from "@/lib/utils";

type Props = {
  product: ProductListRow;
  selected: boolean;
  onSelect: (productId: string) => void;
};

export function ProductSummaryCard({ product, selected, onSelect }: Props) {
  return (
    <button
      type="button"
      onClick={() => onSelect(product.id)}
      className={cn(
        "surface-panel w-full space-y-2 p-3 text-left transition-colors duration-200 hover:border-primary/40",
        selected && "border-primary/50 bg-primary/5 ring-1 ring-primary/20"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold leading-tight">{product.name}</p>
        <Badge variant={product.is_active ? "completed" : "locked"}>
          {product.is_active ? "ACTIVE" : "ARCHIVED"}
        </Badge>
      </div>
      <p className="text-xs text-muted-foreground">{classificationLabel(product.classification)}</p>
      <p className="font-mono text-xs text-muted-foreground">{product.default_sku ?? "No SKU"}</p>
      {product.category_name && (
        <p className="text-xs text-muted-foreground">{product.category_name}</p>
      )}
    </button>
  );
}

"use client";

import { Pencil } from "lucide-react";
import { classificationLabel } from "@/lib/products/classification-labels";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/dashboard/format";
import type { ProductDetailSnapshot } from "@/lib/products/types";

type Props = {
  product: ProductDetailSnapshot;
  onEdit: () => void;
};

export function ProductDetailViewport({ product, onEdit }: Props) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold">{product.name}</h2>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge variant={product.is_active ? "completed" : "locked"}>
              {product.is_active ? "ACTIVE" : "ARCHIVED"}
            </Badge>
            <Badge variant="active">{classificationLabel(product.classification)}</Badge>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={onEdit}>
          <Pencil className="h-4 w-4" />
          Edit Product Master Profile
        </Button>
      </div>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <h3 className="text-sm font-medium text-muted-foreground">Master SKU</h3>
          <p className="font-mono text-sm">{product.sku}</p>
        </div>
        <div>
          <h3 className="text-sm font-medium text-muted-foreground">Base unit of measure</h3>
          <p className="text-sm">{product.base_unit_of_measure}</p>
        </div>
        <div>
          <h3 className="text-sm font-medium text-muted-foreground">Category</h3>
          <p className="text-sm">{product.category_name ?? "Uncategorized"}</p>
        </div>
        <div>
          <h3 className="text-sm font-medium text-muted-foreground">Classification</h3>
          <p className="text-sm">{classificationLabel(product.classification)}</p>
        </div>
        <div>
          <h3 className="text-sm font-medium text-muted-foreground">HSN / SAC code</h3>
          <p className="text-right font-mono text-sm sm:text-left">{product.hsn_sac_code ?? "—"}</p>
        </div>
        <div>
          <h3 className="text-sm font-medium text-muted-foreground">Return eligible</h3>
          <p className="text-sm">{product.is_returnable ? "Yes" : "No"}</p>
        </div>
        <div>
          <h3 className="text-sm font-medium text-muted-foreground">Dead weight (kg)</h3>
          <p className="text-right font-mono text-sm sm:text-left">{product.dead_weight_kg}</p>
        </div>
        <div>
          <h3 className="text-sm font-medium text-muted-foreground">Dimensions (L × W × H cm)</h3>
          <p className="text-right font-mono text-sm sm:text-left">
            {product.length_cm} × {product.width_cm} × {product.height_cm}
          </p>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <h3 className="text-sm font-medium text-muted-foreground">Created</h3>
          <p className="text-sm">{formatDate(product.created_at)}</p>
        </div>
        <div>
          <h3 className="text-sm font-medium text-muted-foreground">Last updated</h3>
          <p className="text-sm">{formatDate(product.updated_at)}</p>
        </div>
      </section>
    </div>
  );
}

"use client";

import { Pencil } from "lucide-react";
import { classificationLabel } from "@/lib/products/classification-labels";
import { taxCategoryLabel } from "@/lib/products/tax-options";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/dashboard/format";
import type { ProductCatalogContext, ProductDetailSnapshot } from "@/lib/products/types";

type Props = {
  product: ProductDetailSnapshot;
  catalogContext: ProductCatalogContext;
  onEdit: () => void;
};

function formatMoney(amount: string, currency: string): string {
  const parsed = Number(amount);
  if (!amount || !Number.isFinite(parsed)) return "—";
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(parsed);
}

function FlagBadge({ active, activeLabel, inactiveLabel }: { active: boolean; activeLabel: string; inactiveLabel: string }) {
  return (
    <Badge variant={active ? "completed" : "locked"}>{active ? activeLabel : inactiveLabel}</Badge>
  );
}

export function ProductDetailViewport({ product, catalogContext, onEdit }: Props) {
  const attributeEntries = Object.entries(product.variant_attributes).filter(
    ([, value]) => value !== null && value !== undefined && String(value).trim() !== ""
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold">{product.name}</h2>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <FlagBadge active={product.is_active} activeLabel="ACTIVE" inactiveLabel="ARCHIVED" />
            <Badge variant="active">{classificationLabel(product.classification)}</Badge>
            <FlagBadge active={product.is_purchasable} activeLabel="Purchasable" inactiveLabel="Not purchasable" />
            <FlagBadge active={product.is_salable} activeLabel="Salable" inactiveLabel="Not salable" />
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={onEdit}>
          <Pencil className="h-4 w-4" />
          Edit Product Master Profile
        </Button>
      </div>

      {product.description && (
        <section className="space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground">Description</h3>
          <p className="text-sm whitespace-pre-wrap">{product.description}</p>
        </section>
      )}

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <h3 className="text-sm font-medium text-muted-foreground">Master SKU</h3>
          <p className="font-mono text-sm">{product.sku}</p>
        </div>
        <div>
          <h3 className="text-sm font-medium text-muted-foreground">Barcode / GTIN</h3>
          <p className="font-mono text-sm">{product.barcode ?? "—"}</p>
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
          <h3 className="text-sm font-medium text-muted-foreground">Default tax category</h3>
          <p className="text-sm">{taxCategoryLabel(product.default_tax_category)}</p>
        </div>
        <div>
          <h3 className="text-sm font-medium text-muted-foreground">Multi-variant product</h3>
          <p className="text-sm">{product.has_variants ? "Yes" : "No"}</p>
        </div>
        <div>
          <h3 className="text-sm font-medium text-muted-foreground">HSN / SAC code</h3>
          <p className="font-mono text-sm">{product.hsn_sac_code ?? "—"}</p>
        </div>
        <div>
          <h3 className="text-sm font-medium text-muted-foreground">Return eligible</h3>
          <p className="text-sm">{product.is_returnable ? "Yes" : "No"}</p>
        </div>
        <div>
          <h3 className="text-sm font-medium text-muted-foreground">Master variant status</h3>
          <p className="text-sm">{product.variant_is_active ? "Active" : "Inactive"}</p>
        </div>
        <div>
          <h3 className="text-sm font-medium text-muted-foreground">Dead weight (kg)</h3>
          <p className="font-mono text-sm">{product.dead_weight_kg}</p>
        </div>
        <div>
          <h3 className="text-sm font-medium text-muted-foreground">Legacy weight</h3>
          <p className="font-mono text-sm">{product.weight !== "0" ? product.weight : "—"}</p>
        </div>
        <div>
          <h3 className="text-sm font-medium text-muted-foreground">Volume</h3>
          <p className="font-mono text-sm">{product.volume !== "0" ? product.volume : "—"}</p>
        </div>
        <div>
          <h3 className="text-sm font-medium text-muted-foreground">Dimensions (L × W × H cm)</h3>
          <p className="font-mono text-sm">
            {product.length_cm} × {product.width_cm} × {product.height_cm}
          </p>
        </div>
      </section>

      {attributeEntries.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground">Variant attributes</h3>
          <div className="surface-inset overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left">
                  <th className="p-3 font-medium text-muted-foreground">Key</th>
                  <th className="p-3 font-medium text-muted-foreground">Value</th>
                </tr>
              </thead>
              <tbody>
                {attributeEntries.map(([key, value]) => (
                  <tr key={key} className="border-b border-border last:border-0">
                    <td className="p-3 font-medium">{key}</td>
                    <td className="p-3">{String(value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="surface-panel space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Commerce &amp; Costing
        </h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <h4 className="text-sm font-medium text-muted-foreground">Default selling rate</h4>
            <p className="font-mono text-sm">
              {product.selling_price
                ? formatMoney(product.selling_price, catalogContext.base_currency)
                : "—"}
            </p>
          </div>
          <div>
            <h4 className="text-sm font-medium text-muted-foreground">Selling unit</h4>
            <p className="text-sm">{product.selling_uom}</p>
          </div>
          <div>
            <h4 className="text-sm font-medium text-muted-foreground">Purchase unit</h4>
            <p className="text-sm">
              {product.purchase_uom}
              {product.purchase_uom !== product.base_unit_of_measure && (
                <span className="text-muted-foreground">
                  {" "}
                  (1 {product.purchase_uom} = {product.purchase_uom_conversion}{" "}
                  {product.base_unit_of_measure})
                </span>
              )}
            </p>
          </div>
          <div>
            <h4 className="text-sm font-medium text-muted-foreground">Preferred supplier</h4>
            <p className="text-sm">{product.supplier_name ?? "—"}</p>
          </div>
          <div>
            <h4 className="text-sm font-medium text-muted-foreground">Purchase rate</h4>
            <p className="font-mono text-sm">
              {product.purchase_price
                ? formatMoney(product.purchase_price, catalogContext.base_currency)
                : "—"}
            </p>
          </div>
          <div>
            <h4 className="text-sm font-medium text-muted-foreground">Valuation method</h4>
            <p className="text-sm">
              {catalogContext.inventory_valuation_method}{" "}
              <span className="text-muted-foreground">
                (runtime: {catalogContext.runtime_valuation_engine})
              </span>
            </p>
          </div>
        </div>

        {product.valuations.length > 0 && (
          <div className="space-y-3 border-t border-border pt-4">
            <h4 className="text-sm font-medium text-muted-foreground">Live inventory valuation</h4>
            <div className="surface-inset overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-left">
                    <th className="p-3 font-medium text-muted-foreground">Location</th>
                    <th className="p-3 font-medium text-muted-foreground">On hand</th>
                    <th className="p-3 font-medium text-muted-foreground">MWAC</th>
                  </tr>
                </thead>
                <tbody>
                  {product.valuations.map((row) => (
                    <tr key={row.location_id} className="border-b border-border last:border-0">
                      <td className="p-3">{row.location_name}</td>
                      <td className="p-3 font-mono">{row.total_quantity_on_hand}</td>
                      <td className="p-3 font-mono">
                        {formatMoney(row.current_average_cost, catalogContext.base_currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
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

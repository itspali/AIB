"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  getSupplierCatalog,
  saveSupplierCatalog,
  type SupplierCatalogEntryRow,
} from "@/app/items/actions";
import { useOptionalItemExtensionData } from "@/components/products/item-extension-data-provider";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { fieldHelpText, FieldLabelInfo, SubsectionHeading } from "@/components/ui/field-label-info";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SUPPLY_FIELD_HELP } from "@/lib/products/item-editor-field-help";
import {
  SUPPLIERS_SECTION_HELP,
  SUPPLIERS_SECTION_LABEL,
} from "@/lib/products/product-user-labels";
import type { ProductVariantSnapshot } from "@/lib/products/types";

type Props = {
  itemId: string;
  variants: ProductVariantSnapshot[];
  suppliers: Array<{ id: string; name: string }>;
  readOnly?: boolean;
  /** Compact layout inside Salable/Purchasable “Show advanced”. */
  embedded?: boolean;
};

const ALL_VARIANTS = "__all__";

type DraftRow = {
  key: string;
  variantId: string | null;
  supplierId: string;
  supplierPrice: string;
  supplierPartNumber: string;
  isPreferred: boolean;
};

let rowCounter = 0;
function nextRowKey(): string {
  rowCounter += 1;
  return `supplier-row-${rowCounter}`;
}

function rowsFromEntries(entries: SupplierCatalogEntryRow[]): DraftRow[] {
  return entries.map((entry) => ({
    key: nextRowKey(),
    variantId: entry.variant_id,
    supplierId: entry.supplier_id,
    supplierPrice: String(entry.supplier_price),
    supplierPartNumber: entry.supplier_part_number ?? "",
    isPreferred: entry.is_preferred,
  }));
}

export function SupplierCatalogEditor({
  itemId,
  variants,
  suppliers,
  readOnly = false,
  embedded = false,
}: Props) {
  const router = useRouter();
  const extension = useOptionalItemExtensionData();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<DraftRow[]>([]);
  const [isPending, startTransition] = useTransition();

  const variantLabel = useCallback(
    (variantId: string | null): string => {
      if (!variantId) return "All variants";
      const match = variants.find((v) => v.id === variantId);
      return match ? match.sku : variantId;
    },
    [variants]
  );

  const load = useCallback(async () => {
    setLoading(true);
    const result = await getSupplierCatalog(itemId);
    if ("error" in result) {
      toast.error(result.error ?? "Unable to load suppliers.");
      setLoading(false);
      return;
    }
    setRows(rowsFromEntries(result.data.entries));
    setLoading(false);
  }, [itemId]);

  useEffect(() => {
    if (!extension) {
      void load();
      return;
    }
    if (extension.status === "loading" || extension.status === "idle") {
      setLoading(true);
      return;
    }
    if (extension.status === "error") {
      toast.error(extension.error);
      setLoading(false);
      return;
    }
    setRows(rowsFromEntries(extension.data.supplierCatalog.entries));
    setLoading(false);
  }, [extension, load]);

  const supplierOptions = useMemo(() => suppliers, [suppliers]);

  const addRow = () => {
    setRows((prev) => [
      ...prev,
      {
        key: nextRowKey(),
        variantId: null,
        supplierId: supplierOptions[0]?.id ?? "",
        supplierPrice: "",
        supplierPartNumber: "",
        isPreferred: prev.length === 0,
      },
    ]);
  };

  const removeRow = (key: string) => {
    setRows((prev) => prev.filter((row) => row.key !== key));
  };

  const patchRow = (key: string, patch: Partial<DraftRow>) => {
    setRows((prev) => {
      const target = prev.find((row) => row.key === key);
      const bucket = target?.variantId ?? null;
      return prev.map((row) => {
        if (row.key === key) return { ...row, ...patch };
        if (patch.isPreferred === true && row.variantId === bucket) {
          return { ...row, isPreferred: false };
        }
        return row;
      });
    });
  };

  const handleSave = () => {
    const seen = new Set<string>();
    const preferredBuckets = new Set<string>();
    const payload: Array<{
      variant_id: string | null;
      supplier_id: string;
      supplier_price: number;
      supplier_part_number: string | null;
      is_preferred: boolean;
    }> = [];

    for (const row of rows) {
      if (!row.supplierId) {
        toast.error(`Select a supplier for the ${variantLabel(row.variantId)} row.`);
        return;
      }
      const price = Number(row.supplierPrice);
      if (!row.supplierPrice.trim() || !Number.isFinite(price) || price < 0) {
        toast.error(`Enter a valid price for ${variantLabel(row.variantId)}.`);
        return;
      }

      const combo = `${row.variantId ?? "*"}|${row.supplierId}`;
      if (seen.has(combo)) {
        toast.error("Two rows share the same variant and supplier.");
        return;
      }
      seen.add(combo);

      const bucket = row.variantId ?? "*";
      if (row.isPreferred) {
        if (preferredBuckets.has(bucket)) {
          toast.error(`Only one preferred supplier per ${variantLabel(row.variantId)}.`);
          return;
        }
        preferredBuckets.add(bucket);
      }

      payload.push({
        variant_id: row.variantId,
        supplier_id: row.supplierId,
        supplier_price: price,
        supplier_part_number: row.supplierPartNumber.trim() || null,
        is_preferred: row.isPreferred,
      });
    }

    startTransition(async () => {
      const result = await saveSupplierCatalog(itemId, payload);
      if ("error" in result) {
        toast.error(result.error ?? "Unable to save suppliers.");
        return;
      }
      toast.success("Suppliers updated.");
      router.refresh();
      void load();
    });
  };

  const loadingMessage = (
    <p className="text-sm text-muted-foreground">Loading suppliers…</p>
  );

  const emptySuppliersMessage = (
    <p className="text-sm text-muted-foreground">
      Add supplier contacts in Settings before linking buy prices to this product.
    </p>
  );

  if (loading) {
    return embedded ? loadingMessage : <section className="surface-panel">{loadingMessage}</section>;
  }

  if (supplierOptions.length === 0) {
    return embedded ? (
      emptySuppliersMessage
    ) : (
      <section className="surface-panel space-y-2">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {SUPPLIERS_SECTION_LABEL}
        </h3>
        {emptySuppliersMessage}
      </section>
    );
  }

  const tableBlock = (
      <div className={embedded ? "overflow-x-auto rounded-md border border-border" : "surface-inset overflow-x-auto"}>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-left">
              <th className="p-3 font-medium text-muted-foreground">Variant</th>
              <th className="p-3 font-medium text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  Supplier
                  <FieldLabelInfo label="Supplier">
                    {fieldHelpText(SUPPLY_FIELD_HELP.supplierSelect)}
                  </FieldLabelInfo>
                </span>
              </th>
              <th className="p-3 text-right font-medium text-muted-foreground">
                <span className="inline-flex items-center justify-end gap-1">
                  Purchase rate
                  <FieldLabelInfo label="Purchase rate">
                    {fieldHelpText(SUPPLY_FIELD_HELP.purchaseRate)}
                  </FieldLabelInfo>
                </span>
              </th>
              <th className="p-3 font-medium text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  Supplier code
                  <FieldLabelInfo label="Supplier code">
                    {fieldHelpText(SUPPLY_FIELD_HELP.partNumber)}
                  </FieldLabelInfo>
                </span>
              </th>
              <th className="p-3 font-medium text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  Preferred
                  <FieldLabelInfo label="Preferred">
                    {fieldHelpText(SUPPLY_FIELD_HELP.preferred)}
                  </FieldLabelInfo>
                </span>
              </th>
              {!readOnly && <th className="p-3" />}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key} className="border-b border-border last:border-0">
                <td className="p-3">
                  <Select
                    value={row.variantId ?? ALL_VARIANTS}
                    disabled={readOnly || isPending}
                    onValueChange={(value) =>
                      patchRow(row.key, { variantId: value === ALL_VARIANTS ? null : value })
                    }
                  >
                    <SelectTrigger className="min-w-44">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL_VARIANTS}>All variants</SelectItem>
                      {variants.map((variant) => (
                        <SelectItem key={variant.id} value={variant.id}>
                          {variant.sku}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </td>
                <td className="p-3">
                  <Select
                    value={row.supplierId || undefined}
                    disabled={readOnly || isPending}
                    onValueChange={(value) => patchRow(row.key, { supplierId: value })}
                  >
                    <SelectTrigger className="min-w-44">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {supplierOptions.map((supplier) => (
                        <SelectItem key={supplier.id} value={supplier.id}>
                          {supplier.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </td>
                <td className="p-3">
                  <Input
                    className="text-right font-mono"
                    inputMode="decimal"
                    disabled={readOnly || isPending}
                    value={row.supplierPrice}
                    onChange={(event) =>
                      patchRow(row.key, { supplierPrice: event.target.value })
                    }
                  />
                </td>
                <td className="p-3">
                  <Input
                    className="font-mono"
                    disabled={readOnly || isPending}
                    value={row.supplierPartNumber}
                    onChange={(event) =>
                      patchRow(row.key, { supplierPartNumber: event.target.value })
                    }
                  />
                </td>
                <td className="p-3">
                  <Checkbox
                    checked={row.isPreferred}
                    disabled={readOnly || isPending}
                    onCheckedChange={(checked) =>
                      patchRow(row.key, { isPreferred: checked === true })
                    }
                    aria-label={`Preferred for ${variantLabel(row.variantId)}`}
                  />
                </td>
                {!readOnly && (
                  <td className="p-3 text-right">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 px-0 text-destructive hover:text-destructive"
                      disabled={isPending}
                      onClick={() => removeRow(row.key)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                )}
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={readOnly ? 5 : 6} className="p-6 text-center text-muted-foreground">
                  No supplier quotes yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
  );

  const addRowButton = !readOnly ? (
    <Button type="button" size="sm" variant="outline" onClick={addRow} disabled={isPending}>
      <Plus className="h-4 w-4" />
      Add supplier row
    </Button>
  ) : null;

  if (embedded) {
    return (
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <SubsectionHeading title="Preferred vendors" compact />
          {!readOnly ? (
            <Button type="button" size="sm" onClick={handleSave} disabled={isPending}>
              Save vendors
            </Button>
          ) : null}
        </div>
        <p className="text-xs text-muted-foreground">{SUPPLIERS_SECTION_HELP}</p>
        {tableBlock}
        {addRowButton}
      </div>
    );
  }

  return (
    <section className="surface-panel space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-1.5">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {SUPPLIERS_SECTION_LABEL}
            </h3>
            <FieldLabelInfo label={SUPPLIERS_SECTION_LABEL}>
              {fieldHelpText(SUPPLIERS_SECTION_HELP)}
            </FieldLabelInfo>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {SUPPLIERS_SECTION_HELP}
          </p>
        </div>
        {!readOnly && (
          <Button type="button" size="sm" onClick={handleSave} disabled={isPending}>
            Save suppliers
          </Button>
        )}
      </div>

      {tableBlock}
      {addRowButton}
    </section>
  );
}

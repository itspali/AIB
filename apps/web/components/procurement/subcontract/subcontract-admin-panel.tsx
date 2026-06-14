"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  saveSubcontractBomLines,
  saveVendorJobWorkLocation,
} from "@/app/procurement/subcontract/actions";
import {
  StockVariantSkuField,
  type StockLineSkuSelection,
} from "@/components/inventory/stock/stock-variant-sku-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { prefetchBrowseVariants } from "@/lib/inventory/stock/variant-suggestion-cache";

type JobLinkRow = {
  id: string;
  supplier_id: string;
  supplier_name: string;
  location_id: string;
  is_active: boolean;
};

type BomLineRow = {
  id: string;
  parent_item_id: string;
  parent_item_name: string;
  component_item_id: string;
  component_name: string;
  quantity_per: string;
};

type Props = {
  suppliers: Array<{ id: string; name: string }>;
  wipLocations: Array<{ id: string; name: string; code: string }>;
  jobLinks: JobLinkRow[];
  bomLines: BomLineRow[];
  onChanged: () => void;
};

function emptyCatalogSelection(): StockLineSkuSelection {
  return {
    sku: "",
    variant_id: "",
    item_id: "",
    item_name: "",
    variant_sku: "",
    unit_cost: "0",
    skuError: null,
  };
}

export function SubcontractAdminPanel({
  suppliers,
  wipLocations,
  jobLinks,
  bomLines,
  onChanged,
}: Props) {
  const [supplierId, setSupplierId] = useState("");
  const [locationId, setLocationId] = useState(wipLocations[0]?.id ?? "");
  const [parentSelection, setParentSelection] = useState<StockLineSkuSelection>(
    emptyCatalogSelection
  );
  const [componentSelection, setComponentSelection] = useState<StockLineSkuSelection>(
    emptyCatalogSelection
  );
  const [quantityPer, setQuantityPer] = useState("1");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    prefetchBrowseVariants();
  }, []);

  if (wipLocations.length === 0 && jobLinks.length === 0 && bomLines.length === 0) {
    return (
      <section className="mb-4 rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
        No subcontract WIP locations configured yet.
      </section>
    );
  }

  const linkSupplier = () => {
    if (!supplierId || !locationId) {
      toast.error("Select a supplier and subcontract WIP location.");
      return;
    }
    startTransition(async () => {
      const result = await saveVendorJobWorkLocation({
        supplier_id: supplierId,
        location_id: locationId,
      });
      if ("error" in result) {
        toast.error(result.error ?? "Unable to save subcontract link.");
        return;
      }
      toast.success("Vendor job work location linked.");
      onChanged();
    });
  };

  const saveBom = () => {
    const parentItemId = parentSelection.item_id?.trim() ?? "";
    const componentItemId = componentSelection.item_id?.trim() ?? "";

    if (!parentItemId || !componentItemId) {
      toast.error("Select finished and component items from the catalog.");
      return;
    }
    if (parentItemId === componentItemId) {
      toast.error("Component must differ from the finished item.");
      return;
    }

    startTransition(async () => {
      const existingForParent = bomLines.filter((line) => line.parent_item_id === parentItemId);
      const nextLines = [
        ...existingForParent.map((line) => ({
          component_item_id: line.component_item_id,
          quantity_per: line.quantity_per,
        })),
        { component_item_id: componentItemId, quantity_per: quantityPer },
      ];
      const result = await saveSubcontractBomLines({
        parent_item_id: parentItemId,
        lines: nextLines,
      });
      if ("error" in result) {
        toast.error(result.error ?? "Unable to save subcontract BOM.");
        return;
      }
      toast.success("Subcontract BOM updated.");
      setComponentSelection(emptyCatalogSelection());
      onChanged();
    });
  };

  return (
    <section className="mb-4 rounded-lg border border-border bg-muted/20 p-4">
      <h2 className="text-sm font-semibold">Subcontracting</h2>
      <p className="mb-3 text-xs text-muted-foreground">
        Link suppliers to subcontract WIP locations and define BOM backflush lines for finished
        goods received on purchase orders.
      </p>

      {wipLocations.length > 0 ? (
        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="space-y-1">
            <Label>Supplier</Label>
            <Select value={supplierId} onValueChange={setSupplierId}>
              <SelectTrigger>
                <SelectValue placeholder="Select supplier" />
              </SelectTrigger>
              <SelectContent>
                {suppliers.map((supplier) => (
                  <SelectItem key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>WIP location</Label>
            <Select value={locationId} onValueChange={setLocationId}>
              <SelectTrigger>
                <SelectValue placeholder="Select WIP location" />
              </SelectTrigger>
              <SelectContent>
                {wipLocations.map((location) => (
                  <SelectItem key={location.id} value={location.id}>
                    {location.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button type="button" size="sm" disabled={isPending} onClick={linkSupplier}>
              Link vendor WIP
            </Button>
          </div>
        </div>
      ) : null}

      {jobLinks.length > 0 ? (
        <ul className="mb-4 space-y-1 text-sm">
          {jobLinks.map((link) => (
            <li key={link.id}>
              {link.supplier_name} →{" "}
              {wipLocations.find((loc) => loc.id === link.location_id)?.name ?? link.location_id}
            </li>
          ))}
        </ul>
      ) : null}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <div className="space-y-1">
          <Label>Finished item</Label>
          <StockVariantSkuField
            compact
            displayMode="item"
            disabled={isPending}
            value={parentSelection}
            onChange={(patch) => setParentSelection((current) => ({ ...current, ...patch }))}
          />
        </div>
        <div className="space-y-1">
          <Label>Component item</Label>
          <StockVariantSkuField
            compact
            displayMode="item"
            disabled={isPending}
            value={componentSelection}
            onChange={(patch) => setComponentSelection((current) => ({ ...current, ...patch }))}
          />
        </div>
        <div className="space-y-1">
          <Label>Qty per FG</Label>
          <Input value={quantityPer} onChange={(event) => setQuantityPer(event.target.value)} />
        </div>
        <div className="flex items-end">
          <Button type="button" size="sm" variant="outline" disabled={isPending} onClick={saveBom}>
            Add BOM line
          </Button>
        </div>
      </div>

      {bomLines.length > 0 ? (
        <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
          {bomLines.slice(0, 6).map((line) => (
            <li key={line.id}>
              {line.parent_item_name || "Finished item"} uses {line.quantity_per} ×{" "}
              {line.component_name || "Component"}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

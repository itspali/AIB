"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  getItemComposition,
  listCompositionComponentCandidates,
  saveItemComposition,
} from "@/app/items/actions";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { fieldHelpText, FieldLabelInfo } from "@/components/ui/field-label-info";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ItemClassification } from "@/lib/products/classification-labels";
import {
  COMPOSITION_PRICE_MODES,
  compositionPriceModeLabel,
  type CompositionLineRow,
  type CompositionPriceMode,
} from "@/lib/products/composition";
import { COMPOSITION_FIELD_HELP } from "@/lib/products/item-editor-field-help";
import { itemTypeLabel, type ItemType } from "@/lib/products/item-model";
import {
  editorInsetTableWrapClass,
  useEditorPanelLayout,
} from "@/lib/products/editor-chrome";
import type { ProductVariantSnapshot } from "@/lib/products/types";

type Props = {
  itemId: string;
  parentItemType: ItemType;
  classification: ItemClassification;
  variants: ProductVariantSnapshot[];
  isMultiSku: boolean;
  currency: string;
  readOnly?: boolean;
};

const ALL_VARIANTS = "__all__";
const LINE_KIND_MANDATORY = "mandatory";
const LINE_KIND_OPTIONAL = "optional";

type DraftRow = {
  key: string;
  parentVariantId: string | null;
  componentItemId: string;
  lineKind: typeof LINE_KIND_MANDATORY | typeof LINE_KIND_OPTIONAL;
  defaultSelected: boolean;
  quantity: string;
  priceMode: CompositionPriceMode;
  unitPrice: string;
};

let rowCounter = 0;
function nextRowKey(): string {
  rowCounter += 1;
  return `composition-row-${rowCounter}`;
}

function rowsFromLines(lines: CompositionLineRow[]): DraftRow[] {
  return lines.map((line) => ({
    key: nextRowKey(),
    parentVariantId: line.parent_variant_id,
    componentItemId: line.component_item_id,
    lineKind: line.is_optional_addon ? LINE_KIND_OPTIONAL : LINE_KIND_MANDATORY,
    defaultSelected: line.default_selected,
    quantity: String(line.quantity),
    priceMode: line.price_mode,
    unitPrice: line.price_mode === "COMPLIMENTARY" ? "" : String(line.unit_price),
  }));
}

function componentLabel(
  componentId: string,
  candidates: Map<string, { name: string; item_type: ItemType; default_sku: string | null }>
): string {
  const match = candidates.get(componentId);
  if (!match) return componentId;
  const typeLabel = itemTypeLabel(match.item_type);
  return match.default_sku
    ? `${match.name} (${match.default_sku}) · ${typeLabel}`
    : `${match.name} · ${typeLabel}`;
}

export function CompositionEditor({
  itemId,
  parentItemType,
  classification,
  variants,
  isMultiSku,
  currency,
  readOnly = false,
}: Props) {
  const router = useRouter();
  const isPanelLayout = useEditorPanelLayout();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<DraftRow[]>([]);
  const [candidates, setCandidates] = useState<
    Array<{
      id: string;
      name: string;
      item_type: ItemType;
      default_variant_id: string | null;
      default_sku: string | null;
    }>
  >([]);
  const [isPending, startTransition] = useTransition();

  const candidateMap = useMemo(
    () =>
      new Map(
        candidates.map((entry) => [
          entry.id,
          {
            name: entry.name,
            item_type: entry.item_type,
            default_sku: entry.default_sku,
            default_variant_id: entry.default_variant_id,
          },
        ])
      ),
    [candidates]
  );

  const sellableVariants = useMemo(
    () => variants.filter((variant) => variant.is_sellable !== false),
    [variants]
  );

  const load = useCallback(async () => {
    setLoading(true);
    const [linesResult, candidatesResult] = await Promise.all([
      getItemComposition(itemId),
      listCompositionComponentCandidates(itemId, parentItemType, classification),
    ]);

    if ("error" in linesResult) {
      toast.error(linesResult.error ?? "Unable to load composition.");
      setLoading(false);
      return;
    }
    if ("error" in candidatesResult) {
      toast.error(candidatesResult.error ?? "Unable to load component items.");
      setLoading(false);
      return;
    }

    setCandidates(candidatesResult.data);
    setRows(rowsFromLines(linesResult.data.lines));
    setLoading(false);
  }, [classification, itemId, parentItemType]);

  useEffect(() => {
    void load();
  }, [load]);

  const addRow = (kind: DraftRow["lineKind"]) => {
    const firstCandidate = candidates[0];
    setRows((prev) => [
      ...prev,
      {
        key: nextRowKey(),
        parentVariantId: null,
        componentItemId: firstCandidate?.id ?? "",
        lineKind: kind,
        defaultSelected: kind === LINE_KIND_OPTIONAL,
        quantity: "1",
        priceMode: "FIXED",
        unitPrice: "",
      },
    ]);
  };

  const removeRow = (key: string) => {
    setRows((prev) => prev.filter((row) => row.key !== key));
  };

  const patchRow = (key: string, patch: Partial<DraftRow>) => {
    setRows((prev) =>
      prev.map((row) => {
        if (row.key !== key) return row;
        const next = { ...row, ...patch };
        if (patch.priceMode === "COMPLIMENTARY") {
          next.unitPrice = "";
        }
        if (patch.lineKind === LINE_KIND_MANDATORY) {
          next.defaultSelected = true;
        }
        return next;
      })
    );
  };

  const handleSave = () => {
    const seen = new Set<string>();
    const payload: Parameters<typeof saveItemComposition>[1] = [];

    for (const [index, row] of rows.entries()) {
      if (!row.componentItemId) {
        toast.error("Select a component for every line.");
        return;
      }

      const qty = Number(row.quantity);
      if (!row.quantity.trim() || !Number.isFinite(qty) || qty <= 0) {
        toast.error("Enter a valid quantity for each line.");
        return;
      }

      const combo = `${row.parentVariantId ?? "*"}|${row.componentItemId}`;
      if (seen.has(combo)) {
        toast.error("The same component is listed twice for one variant scope.");
        return;
      }
      seen.add(combo);

      let unitPrice = 0;
      if (row.priceMode === "FIXED") {
        unitPrice = Number(row.unitPrice);
        if (!row.unitPrice.trim() || !Number.isFinite(unitPrice) || unitPrice < 0) {
          toast.error("Enter a valid fixed price or choose Complimentary.");
          return;
        }
      }

      const candidate = candidateMap.get(row.componentItemId);

      payload.push({
        parent_variant_id: row.parentVariantId,
        component_item_id: row.componentItemId,
        component_variant_id: candidate?.default_variant_id ?? null,
        quantity: qty,
        is_mandatory: row.lineKind === LINE_KIND_MANDATORY,
        is_optional_addon: row.lineKind === LINE_KIND_OPTIONAL,
        default_selected: row.lineKind === LINE_KIND_OPTIONAL ? row.defaultSelected : true,
        unit_price: unitPrice,
        price_mode: row.priceMode,
        sort_order: index,
      });
    }

    startTransition(async () => {
      const result = await saveItemComposition(itemId, payload);
      if ("error" in result) {
        toast.error(result.error ?? "Unable to save composition.");
        return;
      }
      toast.success("Composition saved.");
      router.refresh();
      void load();
    });
  };

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading composition…</p>;
  }

  if (candidates.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No eligible component items yet. Create active items of the allowed types first, then return
        here.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className={editorInsetTableWrapClass(isPanelLayout)}>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-left">
              {isMultiSku ? (
                <th className="p-3 font-medium text-muted-foreground">Parent SKU</th>
              ) : null}
              <th className="p-3 font-medium text-muted-foreground">Component</th>
              <th className="p-3 font-medium text-muted-foreground">Kind</th>
              <th className="p-3 font-medium text-muted-foreground">Qty</th>
              <th className="p-3 font-medium text-muted-foreground">Price</th>
              <th className="p-3 text-right font-medium text-muted-foreground">
                Amount ({currency})
              </th>
              <th className="p-3 font-medium text-muted-foreground">Pre-selected</th>
              {!readOnly ? <th className="p-3" /> : null}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key} className="border-b border-border last:border-0">
                {isMultiSku ? (
                  <td className="p-3">
                    <Select
                      value={row.parentVariantId ?? ALL_VARIANTS}
                      disabled={readOnly || isPending}
                      onValueChange={(value) =>
                        patchRow(row.key, {
                          parentVariantId: value === ALL_VARIANTS ? null : value,
                        })
                      }
                    >
                      <SelectTrigger className="min-w-36">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={ALL_VARIANTS}>All SKUs</SelectItem>
                        {sellableVariants.map((variant) => (
                          <SelectItem key={variant.id} value={variant.id}>
                            {variant.sku}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                ) : null}
                <td className="p-3">
                  <Select
                    value={row.componentItemId || undefined}
                    disabled={readOnly || isPending}
                    onValueChange={(value) => patchRow(row.key, { componentItemId: value })}
                  >
                    <SelectTrigger className="min-w-52">
                      <SelectValue placeholder="Select item" />
                    </SelectTrigger>
                    <SelectContent>
                      {candidates.map((candidate) => (
                        <SelectItem key={candidate.id} value={candidate.id}>
                          {componentLabel(candidate.id, candidateMap)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </td>
                <td className="p-3">
                  <Select
                    value={row.lineKind}
                    disabled={readOnly || isPending}
                    onValueChange={(value) =>
                      patchRow(row.key, {
                        lineKind: value as DraftRow["lineKind"],
                      })
                    }
                  >
                    <SelectTrigger className="min-w-36">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={LINE_KIND_MANDATORY}>Mandatory</SelectItem>
                      <SelectItem value={LINE_KIND_OPTIONAL}>Optional add-on</SelectItem>
                    </SelectContent>
                  </Select>
                </td>
                <td className="p-3">
                  <Input
                    className="w-20 text-right font-mono"
                    inputMode="decimal"
                    disabled={readOnly || isPending}
                    value={row.quantity}
                    onChange={(event) => patchRow(row.key, { quantity: event.target.value })}
                  />
                </td>
                <td className="p-3">
                  <Select
                    value={row.priceMode}
                    disabled={readOnly || isPending}
                    onValueChange={(value) =>
                      patchRow(row.key, { priceMode: value as CompositionPriceMode })
                    }
                  >
                    <SelectTrigger className="min-w-36">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {COMPOSITION_PRICE_MODES.map((mode) => (
                        <SelectItem key={mode} value={mode}>
                          {compositionPriceModeLabel(mode)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </td>
                <td className="p-3 text-right">
                  <Input
                    className="w-28 text-right font-mono"
                    inputMode="decimal"
                    disabled={readOnly || isPending || row.priceMode === "COMPLIMENTARY"}
                    placeholder={row.priceMode === "COMPLIMENTARY" ? "0" : ""}
                    value={row.unitPrice}
                    onChange={(event) => patchRow(row.key, { unitPrice: event.target.value })}
                  />
                </td>
                <td className="p-3">
                  <Checkbox
                    checked={row.lineKind === LINE_KIND_OPTIONAL ? row.defaultSelected : true}
                    disabled={
                      readOnly || isPending || row.lineKind !== LINE_KIND_OPTIONAL
                    }
                    onCheckedChange={(checked) =>
                      patchRow(row.key, { defaultSelected: checked === true })
                    }
                    aria-label="Pre-selected on quote"
                  />
                </td>
                {!readOnly ? (
                  <td className="p-3 text-right">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      disabled={isPending}
                      onClick={() => removeRow(row.key)}
                      aria-label="Remove line"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Add at least one mandatory component. Use optional add-ons for items the customer can
          include or skip (for example extended warranty).
        </p>
      ) : null}

      {!readOnly ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isPending}
            onClick={() => addRow(LINE_KIND_MANDATORY)}
          >
            <Plus className="mr-1 h-4 w-4" aria-hidden />
            Mandatory line
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isPending}
            onClick={() => addRow(LINE_KIND_OPTIONAL)}
          >
            <Plus className="mr-1 h-4 w-4" aria-hidden />
            Optional add-on
          </Button>
          <Button type="button" size="sm" disabled={isPending} onClick={handleSave}>
            Save composition
          </Button>
          <FieldLabelInfo label={COMPOSITION_FIELD_HELP.linesTitle}>
            {fieldHelpText(COMPOSITION_FIELD_HELP.linesBody)}
          </FieldLabelInfo>
        </div>
      ) : null}
    </div>
  );
}

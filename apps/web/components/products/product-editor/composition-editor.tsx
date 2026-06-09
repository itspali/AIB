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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  /** Wizard: persist on Continue instead of a separate save button. */
  deferSave?: boolean;
  onRegisterCommit?: (commit: (() => Promise<CompositionCommitResult>) | null) => void;
  onDirtyChange?: (dirty: boolean) => void;
};

export type CompositionCommitResult = { success: true } | { error: string };

const ALL_VARIANTS_TAB = "__all__";
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

function defaultUnitPriceForComponent(
  componentItemId: string,
  candidateMap: Map<string, { default_selling_price: string | null }>
): string {
  if (!componentItemId) return "";
  const price = candidateMap.get(componentItemId)?.default_selling_price;
  if (!price?.trim() || price === "0") return "";
  return price.trim();
}

export function CompositionEditor({
  itemId,
  parentItemType,
  classification,
  variants,
  isMultiSku,
  currency,
  readOnly = false,
  deferSave = false,
  onRegisterCommit,
  onDirtyChange,
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
      default_selling_price: string | null;
    }>
  >([]);
  const [isPending, startTransition] = useTransition();
  const [compositionDirty, setCompositionDirty] = useState(false);
  const [activeScope, setActiveScope] = useState(ALL_VARIANTS_TAB);

  const markCompositionDirty = useCallback(() => {
    setCompositionDirty(true);
  }, []);

  useEffect(() => {
    onDirtyChange?.(compositionDirty);
    return () => onDirtyChange?.(false);
  }, [compositionDirty, onDirtyChange]);

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
            default_selling_price: entry.default_selling_price,
          },
        ])
      ),
    [candidates]
  );

  const sellableVariants = useMemo(
    () => variants.filter((variant) => variant.is_sellable !== false),
    [variants]
  );

  const showVariantScopes = isMultiSku && sellableVariants.length > 0;

  const scopeParentVariantId = useMemo((): string | null => {
    if (!showVariantScopes || activeScope === ALL_VARIANTS_TAB) return null;
    return activeScope;
  }, [activeScope, showVariantScopes]);

  const visibleRows = useMemo(() => {
    if (!showVariantScopes) return rows;
    if (activeScope === ALL_VARIANTS_TAB) {
      return rows.filter((row) => row.parentVariantId === null);
    }
    return rows.filter((row) => row.parentVariantId === activeScope);
  }, [activeScope, rows, showVariantScopes]);

  const rowCountByScope = useMemo(() => {
    const counts = new Map<string, number>();
    counts.set(ALL_VARIANTS_TAB, 0);
    for (const variant of sellableVariants) {
      counts.set(variant.id, 0);
    }
    for (const row of rows) {
      const key = row.parentVariantId ?? ALL_VARIANTS_TAB;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
  }, [rows, sellableVariants]);

  const activeVariantSku = useMemo(() => {
    if (activeScope === ALL_VARIANTS_TAB) return null;
    return sellableVariants.find((variant) => variant.id === activeScope)?.sku ?? null;
  }, [activeScope, sellableVariants]);

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
    setActiveScope(ALL_VARIANTS_TAB);
    setCompositionDirty(false);
    setLoading(false);
  }, [classification, itemId, parentItemType]);

  useEffect(() => {
    void load();
  }, [load]);

  const addRow = (kind: DraftRow["lineKind"]) => {
    const firstCandidate = candidates[0];
    const componentItemId = firstCandidate?.id ?? "";
    markCompositionDirty();
    setRows((prev) => [
      ...prev,
      {
        key: nextRowKey(),
        parentVariantId: scopeParentVariantId,
        componentItemId,
        lineKind: kind,
        defaultSelected: kind === LINE_KIND_OPTIONAL,
        quantity: "1",
        priceMode: "FIXED",
        unitPrice: defaultUnitPriceForComponent(componentItemId, candidateMap),
      },
    ]);
  };

  const removeRow = (key: string) => {
    markCompositionDirty();
    setRows((prev) => prev.filter((row) => row.key !== key));
  };

  const patchRow = (key: string, patch: Partial<DraftRow>) => {
    markCompositionDirty();
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
        if (patch.componentItemId && patch.componentItemId !== row.componentItemId) {
          next.unitPrice = defaultUnitPriceForComponent(patch.componentItemId, candidateMap);
        }
        if (patch.priceMode === "FIXED" && row.priceMode === "COMPLIMENTARY" && !next.unitPrice.trim()) {
          next.unitPrice = defaultUnitPriceForComponent(next.componentItemId, candidateMap);
        }
        return next;
      })
    );
  };

  const buildPayload = useCallback((): Parameters<typeof saveItemComposition>[1] | { error: string } => {
    const seen = new Set<string>();
    const payload: Parameters<typeof saveItemComposition>[1] = [];

    for (const [index, row] of rows.entries()) {
      if (!row.componentItemId) {
        return { error: "Select a component for every line." };
      }

      const qty = Number(row.quantity);
      if (!row.quantity.trim() || !Number.isFinite(qty) || qty <= 0) {
        return { error: "Enter a valid quantity for each line." };
      }

      const combo = `${row.parentVariantId ?? "*"}|${row.componentItemId}`;
      if (seen.has(combo)) {
        return { error: "The same component is listed twice for one variant scope." };
      }
      seen.add(combo);

      let unitPrice = 0;
      if (row.priceMode === "FIXED") {
        unitPrice = Number(row.unitPrice);
        if (!row.unitPrice.trim() || !Number.isFinite(unitPrice) || unitPrice < 0) {
          return { error: "Enter a valid fixed price or choose Complimentary." };
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

    return payload;
  }, [candidateMap, rows]);

  const commitComposition = useCallback(async (): Promise<CompositionCommitResult> => {
    const built = buildPayload();
    if ("error" in built) {
      return built;
    }

    const result = await saveItemComposition(itemId, built);
    if ("error" in result) {
      return { error: result.error ?? "Unable to save composition." };
    }

    router.refresh();
    await load();
    setCompositionDirty(false);
    return { success: true };
  }, [buildPayload, itemId, load, router]);

  useEffect(() => {
    if (!deferSave) {
      onRegisterCommit?.(null);
      return;
    }
    onRegisterCommit?.(commitComposition);
    return () => onRegisterCommit?.(null);
  }, [commitComposition, deferSave, onRegisterCommit]);

  const handleSave = () => {
    startTransition(async () => {
      const result = await commitComposition();
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("Composition saved.");
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
      {showVariantScopes ? (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Lines on <span className="font-medium text-foreground">All variants</span> apply to
            every SKU. Switch to a variant tab to add or override components for that SKU only.
          </p>
          <Tabs value={activeScope} onValueChange={setActiveScope}>
            <TabsList className="h-auto w-full justify-start gap-1">
              <TabsTrigger value={ALL_VARIANTS_TAB} className="text-xs sm:text-sm">
                All variants
                {rowCountByScope.get(ALL_VARIANTS_TAB) ? (
                  <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] tabular-nums text-muted-foreground">
                    {rowCountByScope.get(ALL_VARIANTS_TAB)}
                  </span>
                ) : null}
              </TabsTrigger>
              {sellableVariants.map((variant) => (
                <TabsTrigger key={variant.id} value={variant.id} className="text-xs sm:text-sm">
                  {variant.sku}
                  {rowCountByScope.get(variant.id) ? (
                    <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] tabular-nums text-muted-foreground">
                      {rowCountByScope.get(variant.id)}
                    </span>
                  ) : null}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
      ) : null}

      <div className={editorInsetTableWrapClass(isPanelLayout)}>
        <table data-header-tone="subtle" className="table-chrome w-full border-separate border-spacing-0 text-sm">
          <thead>
            <tr className="border-b border-border text-left">
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
            {visibleRows.map((row) => (
              <tr key={row.key} className="border-b border-border last:border-0">
                <td className="p-3">
                  <Select
                    value={row.componentItemId || undefined}
                    disabled={readOnly || isPending}
                    onValueChange={(value) => patchRow(row.key, { componentItemId: value })}
                  >
                    <SelectTrigger className="no-underline-field min-w-52 h-auto min-h-10 items-start py-2 text-left [&>span:first-child]:min-w-0 [&>span:first-child]:flex-1 [&>span:first-child]:whitespace-normal [&>span:first-child]:text-left [&>span:first-child]:leading-snug [&>span:last-child]:shrink-0">
                      <SelectValue placeholder="Select item" className="text-left" />
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

      {visibleRows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {showVariantScopes && activeScope !== ALL_VARIANTS_TAB && activeVariantSku
            ? `Add components for ${activeVariantSku}. Shared lines belong on the All variants tab.`
            : showVariantScopes
              ? "Add components included with every variant. Use a variant tab above for SKU-specific lines."
              : "Add a component line, then set Kind to Mandatory or Optional add-on as needed."}
          {deferSave ? " Composition is saved when you continue to the next step." : null}
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
            Add Item
          </Button>
          {!deferSave ? (
            <Button type="button" size="sm" disabled={isPending} onClick={handleSave}>
              Save composition
            </Button>
          ) : null}
          <FieldLabelInfo label={COMPOSITION_FIELD_HELP.linesTitle}>
            {fieldHelpText(COMPOSITION_FIELD_HELP.linesBody)}
          </FieldLabelInfo>
        </div>
      ) : null}
    </div>
  );
}

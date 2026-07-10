"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { saveItemVariant } from "@/app/items/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { AttributeTemplateEntry } from "@/lib/categories/types";
import {
  variantSnapshotToFormValues,
  type ProductVariantSnapshot,
} from "@/lib/products/types";

function attributeStringFromSnapshot(
  attributes: Record<string, unknown>,
  key: string
): string {
  const value = attributes[key];
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

type DraftState = Record<string, Record<string, string>>;

type UseVariantAttributeDraftsOptions = {
  itemId: string;
  variants: ProductVariantSnapshot[];
  axisTemplates: AttributeTemplateEntry[];
  onSaved?: () => void | Promise<void>;
};

export function useVariantAttributeDrafts({
  itemId,
  variants,
  axisTemplates,
  onSaved,
}: UseVariantAttributeDraftsOptions) {
  const [drafts, setDrafts] = useState<DraftState>({});
  const [isPending, startTransition] = useTransition();

  const variantsVersion = useMemo(
    () =>
      variants
        .map((variant) => `${variant.id}:${JSON.stringify(variant.variant_attributes)}`)
        .join("|"),
    [variants]
  );

  useEffect(() => {
    setDrafts({});
  }, [variantsVersion]);

  const axisKeys = useMemo(() => axisTemplates.map((template) => template.key), [axisTemplates]);

  const sellableVariants = useMemo(
    () => variants.filter((variant) => !variant.is_master),
    [variants]
  );

  const serverValue = useCallback(
    (variant: ProductVariantSnapshot, key: string) =>
      attributeStringFromSnapshot(variant.variant_attributes, key),
    []
  );

  const displayValue = useCallback(
    (variant: ProductVariantSnapshot, key: string) => {
      const draft = drafts[variant.id]?.[key];
      if (draft !== undefined) return draft;
      return serverValue(variant, key);
    },
    [drafts, serverValue]
  );

  const setDraftValue = useCallback((variantId: string, key: string, value: string) => {
    setDrafts((prev) => ({
      ...prev,
      [variantId]: { ...(prev[variantId] ?? {}), [key]: value },
    }));
  }, []);

  const isVariantDirty = useCallback(
    (variant: ProductVariantSnapshot) => {
      const overlay = drafts[variant.id];
      if (!overlay) return false;
      return axisKeys.some(
        (key) => overlay[key] !== undefined && overlay[key] !== serverValue(variant, key)
      );
    },
    [axisKeys, drafts, serverValue]
  );

  const dirtyVariants = useMemo(
    () => sellableVariants.filter((variant) => isVariantDirty(variant)),
    [isVariantDirty, sellableVariants]
  );

  const axesNeedingBackfill = useMemo(() => {
    return axisTemplates.filter((template) =>
      sellableVariants.some((variant) => !serverValue(variant, template.key))
    );
  }, [axisTemplates, sellableVariants, serverValue]);

  const buildMergedAttributes = useCallback(
    (variant: ProductVariantSnapshot) => {
      const merged = { ...variantSnapshotToFormValues(variant, itemId).variant_attributes };
      const overlay = drafts[variant.id];
      if (overlay) {
        for (const [key, value] of Object.entries(overlay)) {
          merged[key] = value;
        }
      }
      return merged;
    },
    [drafts, itemId]
  );

  const discardDrafts = useCallback(() => {
    setDrafts({});
  }, []);

  const applyToVariants = useCallback(
    (variantIds: Iterable<string>, axisKey: string, value: string) => {
      const trimmed = value.trim();
      setDrafts((prev) => {
        const next = { ...prev };
        for (const variantId of variantIds) {
          next[variantId] = { ...(next[variantId] ?? {}), [axisKey]: trimmed };
        }
        return next;
      });
    },
    []
  );

  const saveDirtyVariants = useCallback(() => {
    if (!dirtyVariants.length) return;

    startTransition(async () => {
      let failed = 0;
      let lastError = "";
      for (const variant of dirtyVariants) {
        const result = await saveItemVariant({
          ...variantSnapshotToFormValues(variant, itemId),
          variant_attributes: buildMergedAttributes(variant),
        });
        if ("error" in result) {
          failed += 1;
          lastError = result.error ?? lastError;
        }
      }

      if (failed) {
        toast.error(
          lastError ||
            `${failed} variant(s) could not be saved. Check for duplicate attribute combinations.`
        );
        await onSaved?.();
        return;
      }

      toast.success(`Saved attributes on ${dirtyVariants.length} variant(s).`);
      setDrafts({});
      await onSaved?.();
    });
  }, [buildMergedAttributes, dirtyVariants, itemId, onSaved]);

  return {
    axisTemplates,
    axesNeedingBackfill,
    dirtyCount: dirtyVariants.length,
    displayValue,
    discardDrafts,
    isPending,
    applyToVariants,
    saveDirtyVariants,
    setDraftValue,
  };
}

type InlineCellProps = {
  template: AttributeTemplateEntry;
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
};

export function VariantAxisInlineCell({ template, value, disabled, onChange }: InlineCellProps) {
  if (template.type === "select" && template.options?.length) {
    return (
      <Select value={value || undefined} disabled={disabled} onValueChange={onChange}>
        <SelectTrigger className="h-8 min-w-[5.5rem] max-w-[9rem] text-xs">
          <SelectValue placeholder="—" />
        </SelectTrigger>
        <SelectContent>
          {template.options.map((option) => (
            <SelectItem key={option.label} value={option.label}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  return (
    <Input
      className="h-8 min-w-[5.5rem] max-w-[9rem] text-xs"
      disabled={disabled}
      placeholder="—"
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

type BulkBarProps = {
  axisTemplates: AttributeTemplateEntry[];
  dirtyCount: number;
  selectedCount: number;
  isPending?: boolean;
  onDiscard: () => void;
  onSaveAll: () => void;
  onApplyToSelected: (axisKey: string, value: string) => void;
};

export function VariantAxisBulkBar({
  axisTemplates,
  dirtyCount,
  selectedCount,
  isPending,
  onDiscard,
  onSaveAll,
  onApplyToSelected,
}: BulkBarProps) {
  const [applyAxisKey, setApplyAxisKey] = useState(axisTemplates[0]?.key ?? "");
  const [applyValue, setApplyValue] = useState("");
  const applyTemplate = axisTemplates.find((template) => template.key === applyAxisKey);

  if (dirtyCount === 0 && selectedCount === 0) return null;

  return (
    <div className="space-y-2">
      {dirtyCount > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-muted/40 px-3 py-2 editor-bulk-bar">
          <span className="text-sm">
            {dirtyCount} unsaved attribute change{dirtyCount === 1 ? "" : "s"}
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" size="sm" variant="outline" disabled={isPending} onClick={onDiscard}>
              Discard
            </Button>
            <Button type="button" size="sm" disabled={isPending} onClick={onSaveAll}>
              {isPending ? "Saving…" : "Save attributes"}
            </Button>
          </div>
        </div>
      ) : null}

      {selectedCount > 0 && axisTemplates.length > 0 ? (
        <div className="flex flex-wrap items-end gap-2 rounded-md border border-border/50 bg-muted/20 px-3 py-2">
          <div className="space-y-1">
            <span className="text-[11px] font-medium text-muted-foreground">Apply to {selectedCount} selected</span>
            <div className="flex flex-wrap items-center gap-2">
              <Select value={applyAxisKey} onValueChange={setApplyAxisKey}>
                <SelectTrigger className="h-8 w-[7rem] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {axisTemplates.map((template) => (
                    <SelectItem key={template.key} value={template.key}>
                      {template.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {applyTemplate ? (
                <VariantAxisInlineCell
                  template={applyTemplate}
                  value={applyValue}
                  disabled={isPending}
                  onChange={setApplyValue}
                />
              ) : null}
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={isPending || !applyAxisKey || !applyValue.trim()}
                onClick={() => {
                  onApplyToSelected(applyAxisKey, applyValue);
                  setApplyValue("");
                }}
              >
                Apply
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

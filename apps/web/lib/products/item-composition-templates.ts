import type { AttributeTemplateEntry } from "@/lib/categories/types";
import { mergeAttributeTemplates } from "@/lib/categories/tree";
import {
  categoryHasComposableAxes,
  filterVariantAxisCandidateTemplates,
  sanitizeVariantAxisKeys,
  validateVariantAxesSelection,
} from "@/lib/products/variant-composition";

/** Merge category attribute templates with product-only extra SKU options. */
export function resolveItemCompositionTemplates(
  categoryTemplates: AttributeTemplateEntry[],
  extraTemplates: AttributeTemplateEntry[]
): AttributeTemplateEntry[] {
  if (extraTemplates.length === 0) {
    return categoryTemplates;
  }
  return mergeAttributeTemplates(categoryTemplates, extraTemplates);
}

export function sanitizeItemVariantAxisKeys(
  axisKeys: Iterable<string>,
  categoryTemplates: AttributeTemplateEntry[],
  extraTemplates: AttributeTemplateEntry[]
): string[] {
  const merged = resolveItemCompositionTemplates(categoryTemplates, extraTemplates);
  return sanitizeVariantAxisKeys(axisKeys, merged);
}

export function itemHasComposableAxes(
  categoryTemplates: AttributeTemplateEntry[],
  extraTemplates: AttributeTemplateEntry[]
): boolean {
  const merged = resolveItemCompositionTemplates(categoryTemplates, extraTemplates);
  return categoryHasComposableAxes(merged);
}

export function validateItemVariantAxesSelection(input: {
  variant_strategy: string;
  item_type: string;
  variant_axes: string[];
  categoryTemplates: AttributeTemplateEntry[];
  extraTemplates: AttributeTemplateEntry[];
}): string | null {
  const merged = resolveItemCompositionTemplates(input.categoryTemplates, input.extraTemplates);
  return validateVariantAxesSelection({
    variant_strategy: input.variant_strategy,
    item_type: input.item_type,
    variant_axes: input.variant_axes,
    categoryTemplates: merged,
  });
}

export function extraSkuOptionAxisCandidates(
  extraTemplates: AttributeTemplateEntry[]
): AttributeTemplateEntry[] {
  return filterVariantAxisCandidateTemplates(extraTemplates);
}

export function categoryOnlyAxisCandidates(
  categoryTemplates: AttributeTemplateEntry[]
): AttributeTemplateEntry[] {
  return filterVariantAxisCandidateTemplates(categoryTemplates);
}

/** Keys from extra templates that appear in sellable variant attributes. */
export function usedExtraTemplateKeys(
  extraTemplates: AttributeTemplateEntry[],
  variants: Array<{ variant_attributes?: Record<string, unknown> | null; is_sellable?: boolean }>
): string[] {
  const extraKeys = new Set(extraTemplates.map((template) => template.key));
  const used = new Set<string>();
  for (const variant of variants) {
    if (variant.is_sellable === false) continue;
    const attributes = variant.variant_attributes ?? {};
    for (const [key, value] of Object.entries(attributes)) {
      if (!extraKeys.has(key)) continue;
      if (value === null || value === undefined) continue;
      if (String(value).trim() === "") continue;
      used.add(key);
    }
  }
  return Array.from(used);
}

export function canRemoveExtraSkuOption(
  templateKey: string,
  variants: Array<{ variant_attributes?: Record<string, unknown> | null; is_sellable?: boolean }>
): boolean {
  return !usedExtraTemplateKeys([{ key: templateKey, label: templateKey, type: "text" }], variants).includes(
    templateKey
  );
}

import type { AttributeTemplateEntry } from "@/lib/categories/types";
import { maxAttributeOptionCodeLength } from "@/lib/categories/attribute-options";
import { isReservedCatalogFormFieldKey } from "@/lib/products/catalog-reserved-fields";
import {
  applyScanFriendlySkuPrefix,
  compactBaseSkuSegment,
  encodeScanFriendlyAxisSegment,
  normalizeScanFriendlySku,
  SCAN_FRIENDLY_SKU_MAX_LENGTH,
  SCAN_FRIENDLY_SKU_RECOMMENDED_LENGTH,
  SCAN_FRIENDLY_SKU_VARIANT_PREFIX,
} from "@/lib/products/scan-friendly-sku";

const BASE_TOKEN = "BASE";

export type ComposeSkuFromMaskOptions = {
  axisTemplates?: AttributeTemplateEntry[];
};

export type SkuLengthBudget = {
  estimatedLength: number;
  maxLength: number;
  recommendedLength: number;
  exceedsMax: boolean;
  exceedsRecommended: boolean;
};

export function suggestSkuMaskFromAxisKeys(keys: string[]): string {
  const cleaned = keys.map((key) => key.trim()).filter(Boolean);
  if (!cleaned.length) return `{${BASE_TOKEN}}`;
  return `{${BASE_TOKEN}}${cleaned.map((key) => `{${key}}`).join("")}`;
}

export function suggestSkuMask(templates: AttributeTemplateEntry[]): string {
  return suggestSkuMaskFromAxisKeys(templates.map((template) => template.key));
}

/** Axis keys referenced by `{token}` in the mask, excluding BASE. */
export function parseSkuMaskAxisKeys(mask: string): string[] {
  const keys: string[] = [];
  const seen = new Set<string>();
  for (const match of mask.matchAll(/\{([^{}]+)\}/g)) {
    const key = match[1]?.trim() ?? "";
    if (!key || key.toUpperCase() === BASE_TOKEN) continue;
    const normalized = key.toLowerCase();
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    keys.push(key);
  }
  return keys;
}

export function skuMaskIncludesAxis(mask: string, axisKey: string): boolean {
  return mask.includes(`{${axisKey}}`);
}

/** True when every axis template has a `{key}` token in the mask. */
export function skuMaskCoversAllAxes(
  mask: string,
  templates: AttributeTemplateEntry[]
): boolean {
  const trimmed = mask.trim();
  if (!templates.length) return true;
  if (!trimmed) return false;
  return templates.every((template) => skuMaskIncludesAxis(trimmed, template.key));
}

/**
 * Use the stored mask when present and still valid for current axes.
 * Subset masks are allowed — only strip unknown axes; empty mask suggests from templates.
 */
export function resolveEffectiveSkuMask(
  mask: string,
  templates: AttributeTemplateEntry[]
): string {
  const trimmed = mask.trim();
  if (!trimmed) return suggestSkuMask(templates);

  const allowed = new Set(templates.map((template) => template.key));
  const maskKeys = parseSkuMaskAxisKeys(trimmed);
  const kept = maskKeys.filter((key) => allowed.has(key));
  if (!maskKeys.length) return suggestSkuMask(templates);
  if (kept.length !== maskKeys.length) {
    return suggestSkuMaskFromAxisKeys(kept.length ? kept : templates.map((t) => t.key));
  }
  return trimmed;
}

/** Drop `{axisKey}` tokens when an axis is removed from variant_axes. */
export function stripAxisFromSkuMask(mask: string, removedAxisKeys: string[]): string {
  let next = mask;
  for (const key of removedAxisKeys) {
    const trimmed = key.trim();
    if (!trimmed) continue;
    next = next.split(`{${trimmed}}`).join("");
  }
  const remaining = parseSkuMaskAxisKeys(next);
  if (!remaining.length && !next.includes(`{${BASE_TOKEN}}`) && !next.includes("{BASE}")) {
    return "";
  }
  if (!remaining.length) return `{${BASE_TOKEN}}`;
  return suggestSkuMaskFromAxisKeys(remaining);
}

/**
 * When variant axes change: default empty mask to all axes; strip removed axes;
 * never force a full-cover rewrite for intentional subsets.
 */
export function reconcileSkuMaskWithVariantAxes(
  mask: string,
  previousAxisKeys: string[],
  nextAxisKeys: string[]
): string {
  const previous = previousAxisKeys.map((key) => key.trim()).filter(Boolean);
  const next = nextAxisKeys.map((key) => key.trim()).filter(Boolean);
  const removed = previous.filter((key) => !next.includes(key));
  const trimmed = mask.trim();

  if (!next.length) return "";
  if (!trimmed) return suggestSkuMaskFromAxisKeys(next);

  let reconciled = stripAxisFromSkuMask(trimmed, removed);
  const maskKeys = parseSkuMaskAxisKeys(reconciled);
  const allowed = new Set(next);
  const kept = maskKeys.filter((key) => allowed.has(key));
  if (!kept.length) return suggestSkuMaskFromAxisKeys(next);
  return suggestSkuMaskFromAxisKeys(kept);
}

export function composeSkuFromMask(
  mask: string,
  baseSku: string,
  attributes: Record<string, string>,
  options?: ComposeSkuFromMaskOptions
): string {
  const templateByKey = new Map(
    (options?.axisTemplates ?? []).map((template) => [template.key, template])
  );
  const trimmedMask = mask.trim();
  if (!trimmedMask) {
    return applyScanFriendlySkuPrefix(compactBaseSkuSegment(baseSku), "variant");
  }

  const baseSegment = compactBaseSkuSegment(baseSku);
  let composed = trimmedMask.replace(/\{BASE\}/gi, baseSegment);

  for (const [key, rawValue] of Object.entries(attributes)) {
    const token = `{${key}}`;
    const segment = encodeScanFriendlyAxisSegment(rawValue, templateByKey.get(key));
    composed = composed.split(token).join(segment);
  }

  composed = composed.replace(/\{[^{}]+\}/g, "");
  const normalized = normalizeScanFriendlySku(composed) || baseSegment;
  return applyScanFriendlySkuPrefix(normalized, "variant");
}

/** Worst-case composed SKU length for the mask axes (for budget UI). */
export function estimateComposedSkuLength(
  mask: string,
  baseSku: string,
  axisTemplates: AttributeTemplateEntry[]
): number {
  const baseLen = compactBaseSkuSegment(baseSku).length;
  const prefixLen = SCAN_FRIENDLY_SKU_VARIANT_PREFIX.length;
  const templateByKey = new Map(axisTemplates.map((template) => [template.key, template]));
  const keys = parseSkuMaskAxisKeys(mask);
  let axisLen = 0;
  for (const key of keys) {
    const template = templateByKey.get(key);
    axisLen += template ? maxAttributeOptionCodeLength(template) : 3;
  }
  return prefixLen + baseLen + axisLen;
}

export function estimateSkuBudget(
  mask: string,
  baseSku: string,
  axisTemplates: AttributeTemplateEntry[]
): SkuLengthBudget {
  const estimatedLength = estimateComposedSkuLength(mask, baseSku, axisTemplates);
  return {
    estimatedLength,
    maxLength: SCAN_FRIENDLY_SKU_MAX_LENGTH,
    recommendedLength: SCAN_FRIENDLY_SKU_RECOMMENDED_LENGTH,
    exceedsMax: estimatedLength > SCAN_FRIENDLY_SKU_MAX_LENGTH,
    exceedsRecommended: estimatedLength > SCAN_FRIENDLY_SKU_RECOMMENDED_LENGTH,
  };
}

export function parseCustomFields(raw: Record<string, unknown> | null | undefined): {
  sku_mask: string;
  entries: Array<{ key: string; value: string }>;
  defaultPurchaseUom: string | null;
  defaultSellingUom: string | null;
} {
  if (!raw || typeof raw !== "object") {
    return { sku_mask: "", entries: [], defaultPurchaseUom: null, defaultSellingUom: null };
  }

  const skuMask = typeof raw.sku_mask === "string" ? raw.sku_mask : "";
  const entries: Array<{ key: string; value: string }> = [];
  const defaultPurchaseUom =
    typeof raw._default_purchase_uom === "string" ? raw._default_purchase_uom.trim() || null : null;
  const defaultSellingUom =
    typeof raw._default_selling_uom === "string" ? raw._default_selling_uom.trim() || null : null;

  for (const [key, value] of Object.entries(raw)) {
    if (key === "sku_mask" || isReservedCatalogFormFieldKey(key)) continue;
    if (value === null || value === undefined) continue;
    const stringValue = String(value).trim();
    if (!stringValue) continue;
    entries.push({ key, value: stringValue });
  }

  return { sku_mask: skuMask, entries, defaultPurchaseUom, defaultSellingUom };
}

export function buildCustomFieldsPayload(
  skuMask: string,
  entries: Array<{ key: string; value: string }>
): Record<string, string> {
  const payload: Record<string, string> = {};

  const trimmedMask = skuMask.trim();
  if (trimmedMask) {
    payload.sku_mask = trimmedMask;
  }

  for (const entry of entries) {
    const key = entry.key.trim();
    const value = entry.value.trim();
    if (!key || key === "sku_mask" || isReservedCatalogFormFieldKey(key) || !value) {
      continue;
    }
    payload[key] = value;
  }

  return payload;
}

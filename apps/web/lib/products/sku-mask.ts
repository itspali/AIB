import type { AttributeTemplateEntry } from "@/lib/categories/types";
import { isReservedCatalogFormFieldKey } from "@/lib/products/catalog-reserved-fields";

const BASE_TOKEN = "BASE";

function slugifySegment(value: string): string {
  return value
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toUpperCase();
}

export function suggestSkuMask(templates: AttributeTemplateEntry[]): string {
  if (!templates.length) return `{${BASE_TOKEN}}`;
  const parts = templates.map((template) => `{${template.key}}`);
  return `{${BASE_TOKEN}}-${parts.join("-")}`;
}

export function composeSkuFromMask(
  mask: string,
  baseSku: string,
  attributes: Record<string, string>
): string {
  const trimmedMask = mask.trim();
  if (!trimmedMask) return baseSku.trim();

  const baseSegment = slugifySegment(baseSku);
  let composed = trimmedMask.replace(/\{BASE\}/gi, baseSegment);

  for (const [key, rawValue] of Object.entries(attributes)) {
    const token = `{${key}}`;
    const segment = slugifySegment(rawValue);
    composed = composed.split(token).join(segment);
  }

  composed = composed.replace(/\{[^{}]+\}/g, "");
  composed = composed.replace(/--+/g, "-").replace(/^-+|-+$/g, "");

  return composed || baseSegment;
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

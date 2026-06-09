import {
  isCatalogFieldId,
  parseCatalogFieldId,
} from "@/lib/documents/catalog-field-ids";
import { listVariantAttributeEntries } from "@/lib/products/list-row-key";
import type { DocumentColumnPref } from "@/lib/documents/types";

/** Read-only catalog snapshot attached to a PO draft line after item pick. */
export type PoLineCatalogContext = {
  description: string | null;
  hsn_sac_code: string | null;
  base_unit_of_measure: string | null;
  image_url: string | null;
  /** User-defined item custom fields (reserved keys excluded). */
  custom_fields: Record<string, string>;
  variant_attributes: Record<string, string>;
  /** Category template label by attribute key (falls back to key). */
  attribute_labels: Record<string, string>;
};

export function emptyPoLineCatalogContext(imageUrl: string | null = null): PoLineCatalogContext {
  return {
    description: null,
    hsn_sac_code: null,
    base_unit_of_measure: null,
    image_url: imageUrl,
    custom_fields: {},
    variant_attributes: {},
    attribute_labels: {},
  };
}

export function resolveCatalogLineFieldDisplay(
  column: DocumentColumnPref,
  context: PoLineCatalogContext | null | undefined
): string | null {
  const parsed = parseCatalogFieldId(column.id);
  if (!parsed || !context) return null;

  switch (parsed.source) {
    case "item_column": {
      const value = context[parsed.key as keyof PoLineCatalogContext];
      if (typeof value !== "string") return null;
      const trimmed = value.trim();
      return trimmed || null;
    }
    case "item_custom_field": {
      const value = context.custom_fields[parsed.key];
      if (value == null) return null;
      const trimmed = String(value).trim();
      return trimmed || null;
    }
    case "variant_attribute": {
      const value = context.variant_attributes[parsed.key];
      if (value == null) return null;
      const trimmed = String(value).trim();
      return trimmed || null;
    }
    case "variant_attributes_all": {
      const entries = listVariantAttributeEntries(context.variant_attributes);
      if (entries.length === 0) return null;
      return entries
        .map(([key, value]) => {
          const label = context.attribute_labels[key] ?? key;
          return `${label}: ${value}`;
        })
        .join(" · ");
    }
    default:
      return null;
  }
}

export function resolveLineDetailFieldDisplay(
  column: DocumentColumnPref,
  context: PoLineCatalogContext | null | undefined,
  commercialValue?: string | null
): string | null {
  if (isCatalogFieldId(column.id)) {
    return resolveCatalogLineFieldDisplay(column, context);
  }
  return commercialValue ?? null;
}

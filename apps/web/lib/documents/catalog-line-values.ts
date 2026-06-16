import {
  isCatalogFieldId,
  parseCatalogFieldId,
} from "@/lib/documents/catalog-field-ids";
import { extractMrpFromCustomFieldsRecord, extractDefaultSellingPriceFromCustomFieldsRecord } from "@/lib/products/catalog-reserved-fields";
import { COMMERCE_DEFAULT_PURCHASE_UOM_KEY, COMMERCE_DEFAULT_SELLING_UOM_KEY } from "@/lib/products/item-uom-commerce";
import { listVariantAttributeEntries } from "@/lib/products/list-row-key";
import type { DocumentColumnPref } from "@/lib/documents/types";

function parseDefaultPurchaseUomFromPickerCustomFields(
  customFields: Record<string, string> | undefined
): string | null {
  const raw = customFields?.[COMMERCE_DEFAULT_PURCHASE_UOM_KEY];
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  return trimmed || null;
}

function parseDefaultSellingUomFromPickerCustomFields(
  customFields: Record<string, string> | undefined
): string | null {
  const raw = customFields?.[COMMERCE_DEFAULT_SELLING_UOM_KEY];
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  return trimmed || null;
}

/** Read-only catalog snapshot attached to a PO draft line after item pick. */
export type PoLineCatalogContext = {
  description: string | null;
  hsn_sac_code: string | null;
  base_unit_of_measure: string | null;
  /** Maximum retail price from item master (reserved custom_fields key). */
  mrp: string | null;
  /** Default purchase rate from item master commerce settings. */
  purchase_price: string | null;
  /** Default selling rate from price book / item master commerce settings. */
  selling_price: string | null;
  image_url: string | null;
  tax_code_id: string | null;
  tax_rate: number;
  tax_is_variable: boolean;
  /** Item master selling price / MRP tax treatment from catalog. */
  price_is_tax_inclusive: boolean;
  /** GST sub-components from item tax code (CGST / SGST / IGST). */
  tax_components: Array<{ name: string; rate: number; sort_order: number }>;
  /** Default purchase UOM from item commerce settings (may differ from base). */
  default_purchase_uom: string | null;
  /** Default selling UOM from item commerce settings (may differ from base). */
  default_selling_uom: string | null;
  /** Alternate UOM rows from item master (excludes base; base is always factor 1). */
  alternate_uoms: Array<{ uom_code: string; conversion_factor: number }>;
  /** Custom fields (reserved keys excluded). */
  custom_fields: Record<string, string>;
  variant_attributes: Record<string, string>;
  /** Category template label by attribute key (falls back to key). */
  attribute_labels: Record<string, string>;
  /** Optimistic picker snapshot vs full server catalog fetch. */
  catalog_snapshot_source?: "optimistic" | "server";
};

export function emptyPoLineCatalogContext(imageUrl: string | null = null): PoLineCatalogContext {
  return {
    description: null,
    hsn_sac_code: null,
    base_unit_of_measure: null,
    mrp: null,
    purchase_price: null,
    selling_price: null,
    image_url: imageUrl,
    tax_code_id: null,
    tax_rate: 0,
    tax_is_variable: false,
    price_is_tax_inclusive: false,
    tax_components: [],
    default_purchase_uom: null,
    default_selling_uom: null,
    alternate_uoms: [],
    custom_fields: {},
    variant_attributes: {},
    attribute_labels: {},
    catalog_snapshot_source: "optimistic",
  };
}

/** Client-side snapshot from variant picker (image / base unit) before server catalog load. */
export function createOptimisticPoLineCatalogContext(partial: {
  image_url?: string | null;
  base_unit_of_measure?: string | null;
}): PoLineCatalogContext {
  return createOptimisticPoLineCatalogContextFromPicker(partial);
}

/** Rich picker snapshot — shows layout fields immediately while server labels load. */
export function createOptimisticPoLineCatalogContextFromPicker(partial: {
  image_url?: string | null;
  base_unit_of_measure?: string | null;
  description?: string | null;
  hsn_sac_code?: string | null;
  mrp?: string | null;
  selling_price?: string | null;
  tax_code_id?: string | null;
  tax_rate?: number | null;
  tax_is_variable?: boolean | null;
  default_selling_uom?: string | null;
  alternate_uoms?: ReadonlyArray<{ uom_code: string; conversion_factor: number | string }>;
  variant_attributes?: Record<string, string>;
  custom_fields?: Record<string, string>;
}): PoLineCatalogContext {
  const mrp =
    partial.mrp?.trim() ||
    extractMrpFromCustomFieldsRecord(partial.custom_fields) ||
    null;
  const selling_price =
    partial.selling_price?.trim() ||
    extractDefaultSellingPriceFromCustomFieldsRecord(partial.custom_fields) ||
    null;
  const taxRateRaw = partial.tax_rate;
  const tax_rate =
    taxRateRaw != null && Number.isFinite(Number(taxRateRaw)) && Number(taxRateRaw) >= 0
      ? Number(taxRateRaw)
      : 0;

  return {
    description: partial.description?.trim() || null,
    hsn_sac_code: partial.hsn_sac_code?.trim() || null,
    base_unit_of_measure: partial.base_unit_of_measure?.trim() || null,
    mrp,
    purchase_price: null,
    selling_price,
    image_url: partial.image_url?.trim() || null,
    tax_code_id: partial.tax_code_id?.trim() || null,
    tax_rate,
    tax_is_variable: partial.tax_is_variable === true,
    price_is_tax_inclusive: false,
    tax_components: [],
    default_purchase_uom: parseDefaultPurchaseUomFromPickerCustomFields(partial.custom_fields),
    default_selling_uom:
      partial.default_selling_uom?.trim() ||
      parseDefaultSellingUomFromPickerCustomFields(partial.custom_fields),
    alternate_uoms: (partial.alternate_uoms ?? [])
      .map((row) => ({
        uom_code: String(row.uom_code ?? "").trim(),
        conversion_factor: Number(row.conversion_factor),
      }))
      .filter(
        (row) =>
          row.uom_code.length > 0 &&
          Number.isFinite(row.conversion_factor) &&
          row.conversion_factor > 0
      ),
    custom_fields: { ...(partial.custom_fields ?? {}) },
    variant_attributes: { ...(partial.variant_attributes ?? {}) },
    attribute_labels: {},
    catalog_snapshot_source: "optimistic",
  };
}

/** True when a line still needs the full server catalog fetch. */
export function needsPoLineCatalogHydration(
  context: PoLineCatalogContext | null | undefined
): boolean {
  if (context == null) return true;
  return context.catalog_snapshot_source !== "server";
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

/** Merge server catalog snapshot with any optimistic client data (e.g. image from picker). */
export function mergePoLineCatalogContext(
  current: PoLineCatalogContext | null | undefined,
  incoming: PoLineCatalogContext | null | undefined,
  fallbackImageUrl?: string | null,
  fallbackBaseUnit?: string | null
): PoLineCatalogContext | null {
  const image_url =
    incoming?.image_url ?? current?.image_url ?? (fallbackImageUrl?.trim() || null);
  const base_unit_of_measure =
    incoming?.base_unit_of_measure?.trim() ||
    current?.base_unit_of_measure?.trim() ||
    (fallbackBaseUnit?.trim() || null);

  if (!incoming) {
    if (!current && !image_url && !base_unit_of_measure) return null;
    if (!current) {
      return createOptimisticPoLineCatalogContext({ image_url, base_unit_of_measure });
    }
    return {
      ...current,
      image_url,
      base_unit_of_measure,
    };
  }

  const incomingIsOptimistic = incoming.catalog_snapshot_source === "optimistic";
  const currentIsServer = current?.catalog_snapshot_source === "server";

  if (incomingIsOptimistic && current) {
    return {
      ...current,
      image_url,
      base_unit_of_measure,
      custom_fields: { ...current.custom_fields },
      variant_attributes: { ...current.variant_attributes },
      attribute_labels: { ...current.attribute_labels },
      catalog_snapshot_source: current.catalog_snapshot_source ?? "optimistic",
    };
  }

  if (incomingIsOptimistic && currentIsServer) {
    return {
      ...current,
      image_url,
      base_unit_of_measure,
    };
  }

  return {
    ...incoming,
    image_url,
    base_unit_of_measure,
    alternate_uoms: incoming.alternate_uoms?.length
      ? [...incoming.alternate_uoms]
      : current?.alternate_uoms ?? [],
    default_purchase_uom:
      incoming.default_purchase_uom?.trim() ||
      current?.default_purchase_uom?.trim() ||
      null,
    default_selling_uom:
      incoming.default_selling_uom?.trim() ||
      current?.default_selling_uom?.trim() ||
      null,
    custom_fields: { ...incoming.custom_fields },
    variant_attributes: { ...incoming.variant_attributes },
    attribute_labels: { ...incoming.attribute_labels },
    catalog_snapshot_source: incomingIsOptimistic ? "optimistic" : "server",
  };
}

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
  tax_code_id: string | null;
  tax_rate: number;
  tax_is_variable: boolean;
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
    image_url: imageUrl,
    tax_code_id: null,
    tax_rate: 0,
    tax_is_variable: false,
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
  variant_attributes?: Record<string, string>;
  custom_fields?: Record<string, string>;
}): PoLineCatalogContext {
  return {
    description: partial.description?.trim() || null,
    hsn_sac_code: partial.hsn_sac_code?.trim() || null,
    base_unit_of_measure: partial.base_unit_of_measure?.trim() || null,
    image_url: partial.image_url?.trim() || null,
    tax_code_id: null,
    tax_rate: 0,
    tax_is_variable: false,
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
    custom_fields: { ...incoming.custom_fields },
    variant_attributes: { ...incoming.variant_attributes },
    attribute_labels: { ...incoming.attribute_labels },
    catalog_snapshot_source: incomingIsOptimistic ? "optimistic" : "server",
  };
}

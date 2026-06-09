import type { DocumentCatalogFieldSource } from "@/lib/documents/types";

export const CATALOG_FIELD_PREFIX = {
  item_column: "item_col",
  item_custom_field: "item_cf",
  variant_attribute: "variant_attr",
} as const;

/** Layout id that renders all variant attributes for the line's SKU. */
export const VARIANT_ATTRIBUTES_ALL_ID = `${CATALOG_FIELD_PREFIX.variant_attribute}:__all__`;

export const PO_BUILTIN_ITEM_COLUMN_KEYS = [
  "description",
  "hsn_sac_code",
  "base_unit_of_measure",
] as const;

export type PoBuiltinItemColumnKey = (typeof PO_BUILTIN_ITEM_COLUMN_KEYS)[number];

const PO_BUILTIN_ITEM_COLUMN_LABELS: Record<PoBuiltinItemColumnKey, string> = {
  description: "Description",
  hsn_sac_code: "HSN/SAC",
  base_unit_of_measure: "Base unit",
};

export function isCatalogFieldId(id: string): boolean {
  return (
    id.startsWith(`${CATALOG_FIELD_PREFIX.item_column}:`) ||
    id.startsWith(`${CATALOG_FIELD_PREFIX.item_custom_field}:`) ||
    id.startsWith(`${CATALOG_FIELD_PREFIX.variant_attribute}:`)
  );
}

export function buildCatalogFieldId(
  source: DocumentCatalogFieldSource,
  key: string
): string {
  switch (source) {
    case "item_column":
      return `${CATALOG_FIELD_PREFIX.item_column}:${key}`;
    case "item_custom_field":
      return `${CATALOG_FIELD_PREFIX.item_custom_field}:${key}`;
    case "variant_attribute":
      return `${CATALOG_FIELD_PREFIX.variant_attribute}:${key}`;
    case "variant_attributes_all":
      return VARIANT_ATTRIBUTES_ALL_ID;
    default:
      return key;
  }
}

export function parseCatalogFieldId(id: string): {
  source: DocumentCatalogFieldSource;
  key: string;
} | null {
  if (id === VARIANT_ATTRIBUTES_ALL_ID) {
    return { source: "variant_attributes_all", key: "__all__" };
  }

  for (const [source, prefix] of Object.entries(CATALOG_FIELD_PREFIX) as Array<
    [Exclude<DocumentCatalogFieldSource, "variant_attributes_all">, string]
  >) {
    const token = `${prefix}:`;
    if (!id.startsWith(token)) continue;
    const key = id.slice(token.length);
    if (!key) return null;
    return { source, key };
  }

  return null;
}

export function defaultLabelForBuiltinItemColumn(key: PoBuiltinItemColumnKey): string {
  return PO_BUILTIN_ITEM_COLUMN_LABELS[key];
}

export function defaultLabelForCatalogField(
  source: DocumentCatalogFieldSource,
  key: string
): string {
  if (source === "variant_attributes_all") return "Variant attributes";
  if (source === "item_column" && (PO_BUILTIN_ITEM_COLUMN_KEYS as readonly string[]).includes(key)) {
    return defaultLabelForBuiltinItemColumn(key as PoBuiltinItemColumnKey);
  }
  if (source === "variant_attribute") return key;
  return key.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

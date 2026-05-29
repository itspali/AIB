import type { FieldRegistryEntry, FilterScope } from "@/lib/search/types";

export const SEARCH_FIELD_REGISTRY: FieldRegistryEntry[] = [
  {
    key: "purchase_price",
    synonyms: ["purchase price", "purchase_price", "buying price", "purchase cost", "cost price"],
    sensitivity: "financial",
    scopes: ["items"],
  },
  {
    key: "selling_price",
    synonyms: ["selling price", "selling_price", "sales price", "sale price", "retail price"],
    sensitivity: "financial",
    scopes: ["items"],
  },
  {
    key: "hsn_sac_code",
    synonyms: ["hsn number", "hsn sac code", "hsn", "sac code"],
    sensitivity: "standard",
    scopes: ["items"],
  },
  {
    key: "category_name",
    synonyms: ["category name", "category"],
    sensitivity: "standard",
    scopes: ["items", "categories"],
  },
  {
    key: "base_unit_of_measure",
    synonyms: ["base uom", "base unit of measure", "uom", "unit of measure"],
    sensitivity: "standard",
    scopes: ["items"],
  },
  {
    key: "created_at",
    synonyms: ["created", "created at", "creation date"],
    sensitivity: "standard",
    scopes: ["items", "locations", "categories"],
  },
  {
    key: "name",
    synonyms: ["name", "title"],
    sensitivity: "standard",
    scopes: ["items", "locations", "categories"],
  },
  {
    key: "default_sku",
    synonyms: ["sku", "default sku", "default_sku"],
    sensitivity: "standard",
    scopes: ["items"],
  },
  {
    key: "city",
    synonyms: ["city"],
    sensitivity: "standard",
    scopes: ["locations"],
  },
  {
    key: "location_type",
    synonyms: ["type", "location type"],
    sensitivity: "standard",
    scopes: ["locations"],
  },
  {
    key: "code",
    synonyms: ["code", "location code"],
    sensitivity: "standard",
    scopes: ["locations"],
  },
];

export function getFieldsForScope(scope: FilterScope): FieldRegistryEntry[] {
  if (scope === "all" || scope === "settings") return [];
  return SEARCH_FIELD_REGISTRY.filter((entry) => entry.scopes.includes(scope));
}

/** Fields that support numeric literal comparisons (>, >=, between, etc.). */
export const NUMERIC_FILTER_FIELDS = new Set<string>(["purchase_price", "selling_price"]);

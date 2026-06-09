import type { FieldRegistryEntry, FilterScope } from "@/lib/search/types";

export const SEARCH_FIELD_REGISTRY: FieldRegistryEntry[] = [
  {
    key: "classification",
    synonyms: [
      "classification",
      "item type",
      "raw material",
      "work in progress",
      "wip",
      "finished good",
      "service overhead",
      "service",
      "kit bundle",
    ],
    sensitivity: "standard",
    scopes: ["items"],
  },
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
    scopes: ["items", "locations", "categories", "customers", "suppliers"],
  },
  {
    key: "default_sku",
    synonyms: ["sku", "default sku", "default_sku"],
    sensitivity: "standard",
    scopes: ["items"],
  },
  {
    key: "is_active",
    synonyms: ["active status", "item status", "status", "is active", "is inactive"],
    sensitivity: "standard",
    scopes: ["items", "customers", "suppliers"],
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
  {
    key: "adjustment_number",
    synonyms: ["adjustment number", "adjustment_number", "document number", "document"],
    sensitivity: "standard",
    scopes: ["stock"],
  },
  {
    key: "variant_sku",
    synonyms: ["sku", "variant sku", "variant_sku"],
    sensitivity: "standard",
    scopes: ["stock", "transfers"],
  },
  {
    key: "item_name",
    synonyms: ["item", "item name", "product", "product name"],
    sensitivity: "standard",
    scopes: ["stock", "transfers"],
  },
  {
    key: "location_name",
    synonyms: ["location", "location name", "warehouse", "site"],
    sensitivity: "standard",
    scopes: ["stock"],
  },
  {
    key: "kind",
    synonyms: ["kind", "adjustment kind", "opening", "correction", "write off"],
    sensitivity: "standard",
    scopes: ["stock"],
  },
  {
    key: "reason",
    synonyms: ["reason", "notes"],
    sensitivity: "standard",
    scopes: ["stock"],
  },
  {
    key: "transfer_number",
    synonyms: ["transfer number", "transfer_number", "document number", "document"],
    sensitivity: "standard",
    scopes: ["transfers"],
  },
  {
    key: "current_status",
    synonyms: ["status", "transfer status", "in transit", "draft", "completed"],
    sensitivity: "standard",
    scopes: ["transfers"],
  },
  {
    key: "source_location_name",
    synonyms: ["source", "from location", "from", "source location"],
    sensitivity: "standard",
    scopes: ["transfers"],
  },
  {
    key: "destination_location_name",
    synonyms: ["destination", "to location", "to", "destination location"],
    sensitivity: "standard",
    scopes: ["transfers"],
  },
  {
    key: "party_nature",
    synonyms: ["party nature", "individual", "organization", "person", "company"],
    sensitivity: "standard",
    scopes: ["customers", "suppliers"],
  },
  {
    key: "customer_category_id",
    synonyms: ["customer category", "customer category id", "customer_category"],
    sensitivity: "standard",
    scopes: ["customers"],
  },
  {
    key: "supplier_category_id",
    synonyms: ["supplier category", "supplier category id", "supplier_category"],
    sensitivity: "standard",
    scopes: ["suppliers"],
  },
  {
    key: "type",
    synonyms: ["type", "entity type", "customer", "supplier", "mutual partner"],
    sensitivity: "standard",
    scopes: ["customers", "suppliers"],
  },
  {
    key: "tax_treatment",
    synonyms: ["tax treatment", "tax status", "gst treatment", "registered", "unregistered"],
    sensitivity: "standard",
    scopes: ["customers", "suppliers"],
  },
];

export function getFieldsForScope(scope: FilterScope): FieldRegistryEntry[] {
  if (scope === "all" || scope === "settings") return [];
  return SEARCH_FIELD_REGISTRY.filter((entry) => entry.scopes.includes(scope));
}

/** Fields that support numeric literal comparisons (>, >=, between, etc.). */
export const NUMERIC_FILTER_FIELDS = new Set<string>(["purchase_price", "selling_price"]);

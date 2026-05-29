import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { FilterScope, FilterValueOption } from "@/lib/search/types";

const CLASSIFICATION_OPTIONS: FilterValueOption[] = [
  { value: "PHYSICAL_GOOD", label: "Physical good" },
  { value: "RAW_MATERIAL", label: "Raw material" },
  { value: "WORK_IN_PROGRESS", label: "Work in progress" },
  { value: "FINISHED_GOOD", label: "Finished good" },
  { value: "SERVICE_OVERHEAD", label: "Service overhead" },
  { value: "KIT_BUNDLE", label: "Kit bundle" },
];

const UOM_OPTIONS: FilterValueOption[] = [
  { value: "pieces", label: "Pieces" },
  { value: "kg", label: "Kilograms" },
  { value: "liters", label: "Liters" },
  { value: "meters", label: "Meters" },
  { value: "boxes", label: "Boxes" },
];

const BOOLEAN_OPTIONS: FilterValueOption[] = [
  { value: "true", label: "Active" },
  { value: "false", label: "Inactive" },
];

export async function fetchFilterValueOptions(
  supabase: SupabaseClient,
  tenantId: string,
  scope: FilterScope,
  fieldKey: string
): Promise<FilterValueOption[]> {
  if (fieldKey === "is_active") {
    return BOOLEAN_OPTIONS;
  }

  if (fieldKey === "classification") {
    return CLASSIFICATION_OPTIONS;
  }

  if (fieldKey === "base_unit_of_measure") {
    return UOM_OPTIONS;
  }

  if (fieldKey === "category_name" && (scope === "items" || scope === "categories")) {
    const { data } = await supabase
      .from("item_categories")
      .select("name")
      .eq("tenant_id", tenantId)
      .order("name", { ascending: true });

    return (data ?? []).map((row) => ({
      value: String(row.name),
      label: String(row.name),
    }));
  }

  if (fieldKey === "city" && scope === "locations") {
    const { data } = await supabase
      .from("tenant_locations")
      .select("city")
      .eq("tenant_id", tenantId)
      .not("city", "is", null);

    const unique = [...new Set((data ?? []).map((row) => String(row.city).trim()).filter(Boolean))];
    return unique.sort().map((city) => ({ value: city, label: city }));
  }

  if (fieldKey === "location_type" && scope === "locations") {
    return [
      { value: "HEAD_OFFICE", label: "Head office" },
      { value: "WAREHOUSE", label: "Warehouse" },
      { value: "RETAIL_OUTLET", label: "Retail outlet" },
      { value: "MANUFACTURING_PLANT", label: "Manufacturing plant" },
      { value: "GLOBAL_HQ", label: "Global HQ" },
    ];
  }

  return [];
}

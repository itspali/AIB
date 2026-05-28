import type { ItemClassification } from "@/lib/products/classification-labels";

export type ProductListRow = {
  id: string;
  name: string;
  classification: ItemClassification;
  base_unit_of_measure: string;
  category_id: string | null;
  category_name: string | null;
  is_active: boolean;
  default_variant_id: string | null;
  default_sku: string | null;
  created_at: string;
  updated_at: string;
};

export type ProductDetailSnapshot = {
  id: string;
  name: string;
  classification: ItemClassification;
  base_unit_of_measure: string;
  category_id: string | null;
  category_name: string | null;
  hsn_sac_code: string | null;
  is_returnable: boolean;
  is_active: boolean;
  variant_id: string;
  sku: string;
  dead_weight_kg: string;
  length_cm: string;
  width_cm: string;
  height_cm: string;
  created_at: string;
  updated_at: string;
};

export type ProductMasterFormValues = {
  item_id: string | null;
  classification: ItemClassification;
  name: string;
  sku: string;
  base_unit_of_measure: string;
  category_id: string | null;
  hsn_sac_code: string;
  is_returnable: boolean;
  dead_weight_kg: string;
  length_cm: string;
  width_cm: string;
  height_cm: string;
  show_advanced: boolean;
};

export function detailToFormValues(detail: ProductDetailSnapshot): ProductMasterFormValues {
  return {
    item_id: detail.id,
    classification: detail.classification,
    name: detail.name,
    sku: detail.sku,
    base_unit_of_measure: detail.base_unit_of_measure,
    category_id: detail.category_id,
    hsn_sac_code: detail.hsn_sac_code ?? "",
    is_returnable: detail.is_returnable,
    dead_weight_kg: detail.dead_weight_kg,
    length_cm: detail.length_cm,
    width_cm: detail.width_cm,
    height_cm: detail.height_cm,
    show_advanced: Boolean(
      detail.hsn_sac_code ||
        !detail.is_returnable ||
        detail.dead_weight_kg !== "0" ||
        detail.length_cm !== "0" ||
        detail.width_cm !== "0" ||
        detail.height_cm !== "0"
    ),
  };
}

export const defaultProductFormValues: ProductMasterFormValues = {
  item_id: null,
  classification: "FINISHED_GOOD",
  name: "",
  sku: "",
  base_unit_of_measure: "PCS",
  category_id: null,
  hsn_sac_code: "",
  is_returnable: true,
  dead_weight_kg: "0",
  length_cm: "0",
  width_cm: "0",
  height_cm: "0",
  show_advanced: false,
};

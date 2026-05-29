import type { FieldMetadata, FilterOperator } from "@/lib/search/types";

export const FIELD_METADATA: Record<string, FieldMetadata> = {
  classification: {
    valueType: "enum",
    valueSource: "classifications",
    supportsMultiValue: true,
    supportsCompound: true,
  },
  purchase_price: {
    valueType: "number",
    supportsBetween: true,
    supportsCompound: true,
  },
  selling_price: {
    valueType: "number",
    supportsBetween: true,
    supportsCompound: true,
  },
  hsn_sac_code: {
    valueType: "text",
    supportsCompound: true,
  },
  category_name: {
    valueType: "enum",
    valueSource: "categories",
    supportsMultiValue: true,
    supportsCompound: true,
  },
  base_unit_of_measure: {
    valueType: "enum",
    valueSource: "uom",
    supportsMultiValue: true,
    supportsCompound: true,
  },
  created_at: {
    valueType: "date",
    supportsBetween: true,
    supportsCompound: true,
  },
  name: {
    valueType: "text",
    supportsMultiValue: true,
    supportsCompound: true,
  },
  default_sku: {
    valueType: "text",
    supportsMultiValue: true,
    supportsCompound: true,
  },
  is_active: {
    valueType: "boolean",
    supportsCompound: false,
  },
  city: {
    valueType: "enum",
    valueSource: "cities",
    supportsMultiValue: true,
    supportsCompound: true,
  },
  location_type: {
    valueType: "enum",
    valueSource: "locationTypes",
    supportsMultiValue: true,
    supportsCompound: true,
  },
  code: {
    valueType: "text",
    supportsMultiValue: true,
    supportsCompound: true,
  },
};

const DEFAULT_METADATA: FieldMetadata = {
  valueType: "text",
  supportsCompound: true,
};

export function getFieldMetadata(fieldKey: string): FieldMetadata {
  return FIELD_METADATA[fieldKey] ?? DEFAULT_METADATA;
}

export function getDefaultOperatorsForValueType(valueType: FieldMetadata["valueType"]): FilterOperator[] {
  switch (valueType) {
    case "number":
      return ["GT", "GTE", "LT", "LTE", "BETWEEN", "EQ", "IS_NOT_NULL"];
    case "date":
      return ["GT", "GTE", "LT", "LTE", "BETWEEN", "IS_NOT_NULL"];
    case "enum":
      return ["EQ", "NEQ", "IN", "IS_NULL", "IS_NOT_NULL"];
    case "boolean":
      return ["EQ"];
    case "image":
      return ["IS_NULL", "IS_NOT_NULL"];
    case "text":
    default:
      return ["ILIKE", "NOT_ILIKE", "IS_NULL", "IS_NOT_NULL"];
  }
}

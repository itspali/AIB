export const UOM_FAMILIES = [
  "COUNT",
  "WEIGHT",
  "LENGTH",
  "AREA",
  "VOLUME",
  "TIME",
] as const;

export type UomFamily = (typeof UOM_FAMILIES)[number];

export function isUomFamily(value: string): value is UomFamily {
  return (UOM_FAMILIES as readonly string[]).includes(value);
}

export function uomFamilyLabel(family: UomFamily): string {
  switch (family) {
    case "COUNT":
      return "Count";
    case "WEIGHT":
      return "Weight";
    case "LENGTH":
      return "Length";
    case "AREA":
      return "Area";
    case "VOLUME":
      return "Volume";
    case "TIME":
      return "Time";
    default:
      return family;
  }
}

/** A unit of measure as read from the database. */
export type UomRow = {
  id: string;
  code: string;
  name: string;
  family: UomFamily;
  factor_to_base: number;
  is_family_base: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

/** Values captured by the unit-of-measure drawer form. */
export type UomFormValues = {
  uom_id?: string | null;
  code: string;
  name: string;
  family: UomFamily;
  factor_to_base: string;
  is_family_base: boolean;
  is_active: boolean;
};

export const defaultUomFormValues: UomFormValues = {
  uom_id: null,
  code: "",
  name: "",
  family: "COUNT",
  factor_to_base: "1",
  is_family_base: false,
  is_active: true,
};

export const UOM_OPTIONS = ["PCS", "KG", "LTRS", "BOX"] as const;

export type UomCode = (typeof UOM_OPTIONS)[number];

export function isUomCode(value: string): value is UomCode {
  return (UOM_OPTIONS as readonly string[]).includes(value);
}

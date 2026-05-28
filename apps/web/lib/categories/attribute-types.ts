export const ATTRIBUTE_FIELD_TYPES = [
  { value: "text", label: "Text", group: "General" },
  { value: "textarea", label: "Long Text", group: "General" },
  { value: "number", label: "Number", group: "Numeric" },
  { value: "integer", label: "Whole Number", group: "Numeric" },
  { value: "decimal", label: "Decimal", group: "Numeric" },
  { value: "currency", label: "Currency", group: "Numeric" },
  { value: "percent", label: "Percentage", group: "Numeric" },
  { value: "boolean", label: "Yes / No", group: "General" },
  { value: "date", label: "Date", group: "Date & Time" },
  { value: "datetime", label: "Date & Time", group: "Date & Time" },
  { value: "time", label: "Time", group: "Date & Time" },
  { value: "email", label: "Email", group: "Contact" },
  { value: "url", label: "URL", group: "Contact" },
  { value: "phone", label: "Phone", group: "Contact" },
  { value: "color", label: "Color", group: "Visual" },
  { value: "select", label: "Single Select", group: "Choice" },
  { value: "multiselect", label: "Multi Select", group: "Choice" },
] as const;

export type AttributeFieldType = (typeof ATTRIBUTE_FIELD_TYPES)[number]["value"];

export const ATTRIBUTE_FIELD_TYPE_VALUES: readonly AttributeFieldType[] =
  ATTRIBUTE_FIELD_TYPES.map((entry) => entry.value);

export function isAttributeFieldType(value: string): value is AttributeFieldType {
  return (ATTRIBUTE_FIELD_TYPE_VALUES as readonly string[]).includes(value);
}

export function attributeTypeNeedsOptions(type: AttributeFieldType): boolean {
  return type === "select" || type === "multiselect";
}

export function attributeTypeLabel(type: AttributeFieldType): string {
  return ATTRIBUTE_FIELD_TYPES.find((entry) => entry.value === type)?.label ?? type;
}

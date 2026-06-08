import { z } from "zod";

export const PO_CUSTOM_FIELD_KEYS = [
  "requisition_number",
  "expected_delivery_date",
  "internal_notes",
] as const;

export type PoCustomFieldKey = (typeof PO_CUSTOM_FIELD_KEYS)[number];

export const purchaseOrderCustomFieldsSchema = z.object({
  requisition_number: z.string().trim().max(64).optional().default(""),
  expected_delivery_date: z.string().trim().max(32).optional().default(""),
  internal_notes: z.string().trim().max(2000).optional().default(""),
});

export type PurchaseOrderCustomFields = z.infer<typeof purchaseOrderCustomFieldsSchema>;

export function emptyPurchaseOrderCustomFields(): PurchaseOrderCustomFields {
  return {
    requisition_number: "",
    expected_delivery_date: "",
    internal_notes: "",
  };
}

export function parsePurchaseOrderCustomFields(raw: unknown): PurchaseOrderCustomFields {
  if (!raw || typeof raw !== "object") {
    return emptyPurchaseOrderCustomFields();
  }

  const record = raw as Record<string, unknown>;
  const parsed = purchaseOrderCustomFieldsSchema.safeParse({
    requisition_number:
      typeof record.requisition_number === "string" ? record.requisition_number : "",
    expected_delivery_date:
      typeof record.expected_delivery_date === "string" ? record.expected_delivery_date : "",
    internal_notes: typeof record.internal_notes === "string" ? record.internal_notes : "",
  });

  return parsed.success ? parsed.data : emptyPurchaseOrderCustomFields();
}

export function serializePurchaseOrderCustomFields(
  fields: PurchaseOrderCustomFields
): Record<string, string> {
  const payload: Record<string, string> = {};
  for (const key of PO_CUSTOM_FIELD_KEYS) {
    const value = fields[key]?.trim();
    if (value) payload[key] = value;
  }
  return payload;
}

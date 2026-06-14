import type { CustomerOption, SalesLocationOption } from "@/lib/sales/shared/types";
import {
  salesQuoteCustomFieldsSchema,
  type SalesQuoteCustomFields,
} from "@/lib/sales/quotes/schemas";
import type { SalesQuoteLineRow, SalesQuoteRow } from "@/lib/sales/quotes/types";

export type QuoteDraftLine = {
  key: string;
  sku: string;
  variant_id: string;
  item_id: string;
  item_name: string;
  variant_sku: string;
  quantity_quoted: string;
  unit_price_selling: string;
  discount_percentage: string;
  discount_amount: string;
  skuError: string | null;
};

export type QuoteDraftFormState = {
  customer_id: string;
  origin_location_id: string;
  billing_state: string;
  shipping_state: string;
  valid_until: string;
  payment_terms_days: string;
  custom_fields: SalesQuoteCustomFields;
  lines: QuoteDraftLine[];
};

function defaultValidUntilIso(): string {
  const date = new Date();
  date.setDate(date.getDate() + 30);
  return date.toISOString();
}

export function emptySalesQuoteCustomFields(): SalesQuoteCustomFields {
  return salesQuoteCustomFieldsSchema.parse({});
}

export function parseSalesQuoteCustomFields(raw: unknown): SalesQuoteCustomFields {
  if (!raw || typeof raw !== "object") {
    return emptySalesQuoteCustomFields();
  }

  const record = raw as Record<string, unknown>;
  const parsed = salesQuoteCustomFieldsSchema.safeParse({
    customer_reference:
      typeof record.customer_reference === "string" ? record.customer_reference : "",
    internal_notes: typeof record.internal_notes === "string" ? record.internal_notes : "",
    terms_and_conditions:
      typeof record.terms_and_conditions === "string" ? record.terms_and_conditions : "",
  });

  return parsed.success ? parsed.data : emptySalesQuoteCustomFields();
}

export function createEmptyQuoteLine(key?: string): QuoteDraftLine {
  return {
    key: key ?? crypto.randomUUID(),
    sku: "",
    variant_id: "",
    item_id: "",
    item_name: "",
    variant_sku: "",
    quantity_quoted: "1",
    unit_price_selling: "0",
    discount_percentage: "0",
    discount_amount: "0",
    skuError: null,
  };
}

export function isQuoteLineComplete(line: QuoteDraftLine): boolean {
  return Boolean(line.variant_id) && Number(line.quantity_quoted) > 0;
}

export function ensureTrailingQuoteLine(lines: QuoteDraftLine[]): QuoteDraftLine[] {
  const last = lines.at(-1);
  if (!last || isQuoteLineComplete(last)) {
    return [...lines, createEmptyQuoteLine()];
  }
  return lines;
}

export function filterSavableQuoteLines(lines: QuoteDraftLine[]): QuoteDraftLine[] {
  return lines.filter(isQuoteLineComplete);
}

export function customerDefaultStates(
  customers: CustomerOption[],
  customerId: string
): { billing_state: string; shipping_state: string } {
  const customer = customers.find((row) => row.id === customerId);
  return {
    billing_state: customer?.billing_state?.trim() ?? "",
    shipping_state: customer?.shipping_state?.trim() ?? customer?.billing_state?.trim() ?? "",
  };
}

export function defaultQuoteDraftForm(
  locations: SalesLocationOption[],
  customers: CustomerOption[],
  preferredOriginLocationId?: string | null,
  entryLineKey?: string
): QuoteDraftFormState {
  const customer = customers[0];
  const originLocationId =
    preferredOriginLocationId &&
    locations.some((location) => location.id === preferredOriginLocationId)
      ? preferredOriginLocationId
      : (locations[0]?.id ?? "");
  const states = customer
    ? customerDefaultStates(customers, customer.id)
    : { billing_state: "", shipping_state: "" };

  return {
    customer_id: customer?.id ?? "",
    origin_location_id: originLocationId,
    billing_state: states.billing_state,
    shipping_state: states.shipping_state,
    valid_until: defaultValidUntilIso(),
    payment_terms_days: String(customer?.payment_terms_days ?? 0),
    custom_fields: emptySalesQuoteCustomFields(),
    lines: [createEmptyQuoteLine(entryLineKey)],
  };
}

export function mapSavedQuoteLineToDraftLine(
  line: SalesQuoteLineRow,
  key: string = line.id
): QuoteDraftLine {
  return {
    key,
    sku: line.variant_sku,
    variant_id: line.variant_id,
    item_id: line.item_id,
    item_name: line.item_name,
    variant_sku: line.variant_sku,
    quantity_quoted: line.quantity_quoted,
    unit_price_selling: line.unit_price_selling,
    discount_percentage: line.discount_percentage ?? "0",
    discount_amount: line.discount_amount ?? "0",
    skuError: null,
  };
}

export function mapSalesQuoteToDraft(quote: SalesQuoteRow): QuoteDraftFormState {
  return {
    customer_id: quote.customer_id,
    origin_location_id: quote.origin_location_id ?? "",
    billing_state: quote.billing_state,
    shipping_state: quote.shipping_state,
    valid_until: quote.valid_until,
    payment_terms_days: String(quote.payment_terms_days ?? 0),
    custom_fields: parseSalesQuoteCustomFields(quote.custom_fields),
    lines:
      quote.lines?.length
        ? ensureTrailingQuoteLine(quote.lines.map((line) => mapSavedQuoteLineToDraftLine(line, line.id)))
        : [createEmptyQuoteLine()],
  };
}

export function mapQuoteLinesToRpcPayload(lines: QuoteDraftLine[]) {
  return filterSavableQuoteLines(lines).map((line) => ({
    variant_id: line.variant_id,
    quantity: Number(line.quantity_quoted),
    unit_price: Number(line.unit_price_selling),
    discount_percentage: Number(line.discount_percentage),
    discount_amount: Number(line.discount_amount),
  }));
}

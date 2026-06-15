import type { OrganizationCurrency } from "@/lib/organization/currency-options";
import {
  customerDefaultCurrency,
  customerPaymentTerms,
  customerDefaultStates,
  emptySalesCommerceDraftBase,
} from "@/lib/sales/shared/sales-commerce-draft";
import { emptySalesHeaderCharges, type SalesHeaderChargesFields } from "@/lib/sales/shared/sales-header-charges";
import type { CustomerOption, SalesLocationOption } from "@/lib/sales/shared/types";
import {
  salesQuoteCustomFieldsSchema,
  type SalesQuoteCustomFields,
} from "@/lib/sales/quotes/schemas";
import type { SalesQuoteLineRow, SalesQuoteRow } from "@/lib/sales/quotes/types";
import { mapSalesCommerceLineToRpcPayload } from "@/lib/sales/shared/sales-commerce-line-rpc";

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
  uom_code?: string;
  skuError: string | null;
  catalog_context?: import("@/lib/documents/catalog-line-values").PoLineCatalogContext | null;
  base_unit_of_measure?: string | null;
};

export type QuoteDraftFormState = {
  customer_id: string;
  origin_location_id: string;
  currency_code: OrganizationCurrency;
  payment_terms_days: string;
  prices_tax_inclusive: boolean;
  header_charges: SalesHeaderChargesFields;
  billing_state: string;
  shipping_state: string;
  valid_until: string;
  custom_fields: SalesQuoteCustomFields;
  lines: QuoteDraftLine[];
};

export { customerDefaultCurrency, customerPaymentTerms, customerDefaultStates } from "@/lib/sales/shared/sales-commerce-draft";

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

export function defaultQuoteDraftForm(
  locations: SalesLocationOption[],
  customers: CustomerOption[],
  preferredOriginLocationId?: string | null,
  entryLineKey?: string,
  defaultCurrency = "USD"
): QuoteDraftFormState {
  const customer = customers[0];
  const originLocationId =
    preferredOriginLocationId &&
    locations.some((location) => location.id === preferredOriginLocationId)
      ? preferredOriginLocationId
      : (locations[0]?.id ?? "");
  const states = customer
    ? customerDefaultStates(customers, customer.id, locations, originLocationId)
    : { billing_state: "", shipping_state: "" };
  const commerceBase = emptySalesCommerceDraftBase(customers, defaultCurrency);

  return {
    customer_id: customer?.id ?? "",
    origin_location_id: originLocationId,
    currency_code: commerceBase.currency_code,
    payment_terms_days: commerceBase.payment_terms_days,
    prices_tax_inclusive: commerceBase.prices_tax_inclusive,
    header_charges: commerceBase.header_charges,
    billing_state: states.billing_state,
    shipping_state: states.shipping_state,
    valid_until: defaultValidUntilIso(),
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
    uom_code: line.uom_code ?? undefined,
    base_unit_of_measure: line.base_unit_of_measure ?? null,
    skuError: null,
  };
}

export function mapSalesQuoteToDraft(
  quote: SalesQuoteRow,
  defaultCurrency = "USD"
): QuoteDraftFormState {
  return {
    customer_id: quote.customer_id,
    origin_location_id: quote.origin_location_id ?? "",
    currency_code: (defaultCurrency as OrganizationCurrency),
    payment_terms_days: String(quote.payment_terms_days ?? 0),
    prices_tax_inclusive: false,
    header_charges: emptySalesHeaderCharges(),
    billing_state: quote.billing_state,
    shipping_state: quote.shipping_state,
    valid_until: quote.valid_until,
    custom_fields: parseSalesQuoteCustomFields(quote.custom_fields),
    lines:
      quote.lines?.length
        ? ensureTrailingQuoteLine(quote.lines.map((line) => mapSavedQuoteLineToDraftLine(line, line.id)))
        : [createEmptyQuoteLine()],
  };
}

export function mapQuoteLinesToRpcPayload(lines: QuoteDraftLine[]) {
  return filterSavableQuoteLines(lines).map((line) =>
    mapSalesCommerceLineToRpcPayload(line, Number(line.quantity_quoted))
  );
}

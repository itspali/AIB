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
  salesOrderCustomFieldsSchema,
  type SalesOrderCustomFields,
} from "@/lib/sales/orders/schemas";
import type { SalesOrderLineRow, SalesOrderRow } from "@/lib/sales/orders/types";
import type { SalesQuoteRow } from "@/lib/sales/quotes/types";
import { mapSalesCommerceLineToRpcPayload } from "@/lib/sales/shared/sales-commerce-line-rpc";

export type SoDraftLine = {
  key: string;
  sku: string;
  variant_id: string;
  item_id: string;
  item_name: string;
  variant_sku: string;
  quantity_ordered: string;
  unit_price_selling: string;
  discount_percentage: string;
  discount_amount: string;
  uom_code?: string;
  skuError: string | null;
  catalog_context?: import("@/lib/documents/catalog-line-values").PoLineCatalogContext | null;
  base_unit_of_measure?: string | null;
};

export type SoDraftFormState = {
  customer_id: string;
  shipping_location_id: string;
  currency_code: OrganizationCurrency;
  payment_terms_days: string;
  prices_tax_inclusive: boolean;
  header_charges: SalesHeaderChargesFields;
  billing_state: string;
  shipping_state: string;
  source_quotation_id: string | null;
  custom_fields: SalesOrderCustomFields;
  lines: SoDraftLine[];
};

export { customerDefaultCurrency, customerPaymentTerms, customerDefaultStates } from "@/lib/sales/shared/sales-commerce-draft";

export function emptySalesOrderCustomFields(): SalesOrderCustomFields {
  return salesOrderCustomFieldsSchema.parse({});
}

export function parseSalesOrderCustomFields(raw: unknown): SalesOrderCustomFields {
  if (!raw || typeof raw !== "object") {
    return emptySalesOrderCustomFields();
  }

  const record = raw as Record<string, unknown>;
  const parsed = salesOrderCustomFieldsSchema.safeParse({
    customer_po_number:
      typeof record.customer_po_number === "string" ? record.customer_po_number : "",
    requested_ship_date:
      typeof record.requested_ship_date === "string" ? record.requested_ship_date : "",
    internal_notes: typeof record.internal_notes === "string" ? record.internal_notes : "",
  });

  return parsed.success ? parsed.data : emptySalesOrderCustomFields();
}

export function createEmptySoLine(key?: string): SoDraftLine {
  return {
    key: key ?? crypto.randomUUID(),
    sku: "",
    variant_id: "",
    item_id: "",
    item_name: "",
    variant_sku: "",
    quantity_ordered: "1",
    unit_price_selling: "0",
    discount_percentage: "0",
    discount_amount: "0",
    skuError: null,
  };
}

export function isSoLineComplete(line: SoDraftLine): boolean {
  return Boolean(line.variant_id) && Number(line.quantity_ordered) > 0;
}

export function isSoLineBlank(line: SoDraftLine): boolean {
  return !line.variant_id && !line.sku.trim();
}

export function ensureTrailingSoLine(lines: SoDraftLine[]): SoDraftLine[] {
  const last = lines.at(-1);
  if (!last || isSoLineComplete(last)) {
    return [...lines, createEmptySoLine()];
  }
  return lines;
}

export function filterSavableSoLines(lines: SoDraftLine[]): SoDraftLine[] {
  return lines.filter(isSoLineComplete);
}

export function defaultSoDraftForm(
  locations: SalesLocationOption[],
  customers: CustomerOption[],
  preferredShippingLocationId?: string | null,
  entryLineKey?: string,
  defaultCurrency = "USD"
): SoDraftFormState {
  const customer = customers[0];
  const shippingLocationId =
    preferredShippingLocationId &&
    locations.some((location) => location.id === preferredShippingLocationId)
      ? preferredShippingLocationId
      : (locations[0]?.id ?? "");
  const states = customer
    ? customerDefaultStates(customers, customer.id, locations, shippingLocationId)
    : { billing_state: "", shipping_state: "" };
  const commerceBase = emptySalesCommerceDraftBase(customers, defaultCurrency);

  return {
    customer_id: customer?.id ?? "",
    shipping_location_id: shippingLocationId,
    currency_code: commerceBase.currency_code,
    payment_terms_days: commerceBase.payment_terms_days,
    prices_tax_inclusive: commerceBase.prices_tax_inclusive,
    header_charges: commerceBase.header_charges,
    billing_state: states.billing_state,
    shipping_state: states.shipping_state,
    source_quotation_id: null,
    custom_fields: emptySalesOrderCustomFields(),
    lines: [createEmptySoLine(entryLineKey)],
  };
}

export function mapSavedSoLineToDraftLine(
  line: SalesOrderLineRow,
  key: string = line.id
): SoDraftLine {
  return {
    key,
    sku: line.variant_sku,
    variant_id: line.variant_id,
    item_id: line.item_id,
    item_name: line.item_name,
    variant_sku: line.variant_sku,
    quantity_ordered: line.quantity_ordered,
    unit_price_selling: line.unit_price_selling,
    discount_percentage: line.discount_percentage ?? "0",
    discount_amount: line.discount_amount ?? "0",
    uom_code: line.uom_code ?? undefined,
    base_unit_of_measure: line.base_unit_of_measure ?? null,
    skuError: null,
  };
}

export function mapSoLinesToRpcPayload(lines: SoDraftLine[]) {
  return filterSavableSoLines(lines).map((line) =>
    mapSalesCommerceLineToRpcPayload(line, Number(line.quantity_ordered))
  );
}

export function mapSalesOrderToDraft(
  order: SalesOrderRow,
  defaultCurrency = "USD"
): SoDraftFormState {
  return {
    customer_id: order.customer_id,
    shipping_location_id: order.shipping_location_id ?? "",
    currency_code: (defaultCurrency as OrganizationCurrency),
    payment_terms_days: "0",
    prices_tax_inclusive: false,
    header_charges: emptySalesHeaderCharges(),
    billing_state: order.billing_state,
    shipping_state: order.shipping_state,
    source_quotation_id: order.source_quotation_id,
    custom_fields: parseSalesOrderCustomFields(order.custom_fields),
    lines:
      order.lines?.length
        ? ensureTrailingSoLine(order.lines.map((line) => mapSavedSoLineToDraftLine(line, line.id)))
        : [createEmptySoLine()],
  };
}

export function copySoDraftFromOrder(order: SalesOrderRow): SoDraftFormState {
  const draft = mapSalesOrderToDraft(order);
  const sourceLines = (order.lines ?? []).filter((line) => Boolean(line.variant_id));

  return {
    ...draft,
    custom_fields: {
      ...draft.custom_fields,
      customer_po_number: "",
    },
    lines: ensureTrailingSoLine(
      sourceLines.map((line) => mapSavedSoLineToDraftLine(line, crypto.randomUUID()))
    ),
  };
}

export function mapSalesQuoteToSoDraft(
  quote: SalesQuoteRow,
  defaultCurrency = "USD"
): SoDraftFormState {
  const sourceLines = (quote.lines ?? []).filter((line) => Boolean(line.variant_id));

  return {
    customer_id: quote.customer_id,
    shipping_location_id: quote.origin_location_id ?? "",
    currency_code: (defaultCurrency as OrganizationCurrency),
    payment_terms_days: String(quote.payment_terms_days ?? 0),
    prices_tax_inclusive: false,
    header_charges: emptySalesHeaderCharges(),
    billing_state: quote.billing_state,
    shipping_state: quote.shipping_state,
    source_quotation_id: quote.id,
    custom_fields: emptySalesOrderCustomFields(),
    lines: ensureTrailingSoLine(
      sourceLines.map((line) => ({
        key: crypto.randomUUID(),
        sku: line.variant_sku,
        variant_id: line.variant_id,
        item_id: line.item_id,
        item_name: line.item_name,
        variant_sku: line.variant_sku,
        quantity_ordered: line.quantity_quoted,
        unit_price_selling: line.unit_price_selling,
        discount_percentage: line.discount_percentage ?? "0",
        discount_amount: line.discount_amount ?? "0",
        uom_code: line.uom_code ?? undefined,
        base_unit_of_measure: line.base_unit_of_measure ?? null,
        skuError: null,
      }))
    ),
  };
}

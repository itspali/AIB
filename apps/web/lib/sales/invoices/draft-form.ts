import type { CustomerOption, SalesLocationOption } from "@/lib/sales/shared/types";
import {
  salesInvoiceCustomFieldsSchema,
  type SalesInvoiceCustomFields,
} from "@/lib/sales/invoices/schemas";
import type { SalesInvoiceLineRow, SalesInvoiceRow } from "@/lib/sales/invoices/types";
import type { SalesOrderRow } from "@/lib/sales/orders/types";

export type InvoiceDraftLine = {
  key: string;
  sku: string;
  variant_id: string;
  item_id: string;
  item_name: string;
  variant_sku: string;
  quantity_invoiced: string;
  unit_price_selling: string;
  discount_percentage: string;
  discount_amount: string;
  source_order_line_id: string | null;
  skuError: string | null;
};

export type InvoiceDraftFormState = {
  customer_id: string;
  origin_location_id: string;
  billing_state: string;
  shipping_state: string;
  source_order_id: string | null;
  source_quotation_id: string | null;
  payment_terms_days: string;
  custom_fields: SalesInvoiceCustomFields;
  lines: InvoiceDraftLine[];
};

export function emptySalesInvoiceCustomFields(): SalesInvoiceCustomFields {
  return salesInvoiceCustomFieldsSchema.parse({});
}

export function parseSalesInvoiceCustomFields(raw: unknown): SalesInvoiceCustomFields {
  if (!raw || typeof raw !== "object") {
    return emptySalesInvoiceCustomFields();
  }

  const record = raw as Record<string, unknown>;
  const parsed = salesInvoiceCustomFieldsSchema.safeParse({
    customer_po_number:
      typeof record.customer_po_number === "string" ? record.customer_po_number : "",
    internal_notes: typeof record.internal_notes === "string" ? record.internal_notes : "",
  });

  return parsed.success ? parsed.data : emptySalesInvoiceCustomFields();
}

export function createEmptyInvoiceLine(key?: string): InvoiceDraftLine {
  return {
    key: key ?? crypto.randomUUID(),
    sku: "",
    variant_id: "",
    item_id: "",
    item_name: "",
    variant_sku: "",
    quantity_invoiced: "1",
    unit_price_selling: "0",
    discount_percentage: "0",
    discount_amount: "0",
    source_order_line_id: null,
    skuError: null,
  };
}

export function isInvoiceLineComplete(line: InvoiceDraftLine): boolean {
  return Boolean(line.variant_id) && Number(line.quantity_invoiced) > 0;
}

export function ensureTrailingInvoiceLine(lines: InvoiceDraftLine[]): InvoiceDraftLine[] {
  const last = lines.at(-1);
  if (!last || isInvoiceLineComplete(last)) {
    return [...lines, createEmptyInvoiceLine()];
  }
  return lines;
}

export function filterSavableInvoiceLines(lines: InvoiceDraftLine[]): InvoiceDraftLine[] {
  return lines.filter(isInvoiceLineComplete);
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

export function defaultInvoiceDraftForm(
  locations: SalesLocationOption[],
  customers: CustomerOption[],
  preferredOriginLocationId?: string | null,
  entryLineKey?: string
): InvoiceDraftFormState {
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
    source_order_id: null,
    source_quotation_id: null,
    payment_terms_days: String(customer?.payment_terms_days ?? 0),
    custom_fields: emptySalesInvoiceCustomFields(),
    lines: [createEmptyInvoiceLine(entryLineKey)],
  };
}

export function mapSavedInvoiceLineToDraftLine(
  line: SalesInvoiceLineRow,
  key: string = line.id
): InvoiceDraftLine {
  return {
    key,
    sku: line.variant_sku,
    variant_id: line.variant_id,
    item_id: line.item_id,
    item_name: line.item_name,
    variant_sku: line.variant_sku,
    quantity_invoiced: line.quantity_invoiced,
    unit_price_selling: line.unit_price_selling,
    discount_percentage: line.discount_percentage ?? "0",
    discount_amount: line.discount_amount ?? "0",
    source_order_line_id: line.source_order_line_id,
    skuError: null,
  };
}

export function mapSalesInvoiceToDraft(invoice: SalesInvoiceRow): InvoiceDraftFormState {
  return {
    customer_id: invoice.customer_id,
    origin_location_id: invoice.origin_location_id,
    billing_state: invoice.billing_state,
    shipping_state: invoice.shipping_state,
    source_order_id: invoice.source_order_id,
    source_quotation_id: invoice.source_quotation_id,
    payment_terms_days: String(invoice.payment_terms_days ?? 0),
    custom_fields: parseSalesInvoiceCustomFields(invoice.custom_fields),
    lines:
      invoice.lines?.length
        ? ensureTrailingInvoiceLine(
            invoice.lines.map((line) => mapSavedInvoiceLineToDraftLine(line, line.id))
          )
        : [createEmptyInvoiceLine()],
  };
}

export function mapSalesOrderToInvoiceDraft(order: SalesOrderRow): InvoiceDraftFormState {
  const openLines = (order.lines ?? []).filter((line) => {
    const openQty = Number(line.quantity_ordered) - Number(line.quantity_invoiced);
    return openQty > 0;
  });

  return {
    customer_id: order.customer_id,
    origin_location_id: order.shipping_location_id ?? "",
    billing_state: order.billing_state,
    shipping_state: order.shipping_state,
    source_order_id: order.id,
    source_quotation_id: order.source_quotation_id,
    payment_terms_days: "0",
    custom_fields: emptySalesInvoiceCustomFields(),
    lines: ensureTrailingInvoiceLine(
      openLines.map((line) => {
        const openQty = Math.max(
          0,
          Number(line.quantity_ordered) - Number(line.quantity_invoiced)
        );
        return {
          key: crypto.randomUUID(),
          sku: line.variant_sku,
          variant_id: line.variant_id,
          item_id: line.item_id,
          item_name: line.item_name,
          variant_sku: line.variant_sku,
          quantity_invoiced: String(openQty),
          unit_price_selling: line.unit_price_selling,
          discount_percentage: line.discount_percentage ?? "0",
          discount_amount: line.discount_amount ?? "0",
          source_order_line_id: line.id,
          skuError: null,
        };
      })
    ),
  };
}

export function mapInvoiceLinesToRpcPayload(lines: InvoiceDraftLine[]) {
  return filterSavableInvoiceLines(lines).map((line) => ({
    variant_id: line.variant_id,
    quantity: Number(line.quantity_invoiced),
    unit_price: Number(line.unit_price_selling),
    discount_percentage: Number(line.discount_percentage),
    discount_amount: Number(line.discount_amount),
    source_order_line_id: line.source_order_line_id,
  }));
}

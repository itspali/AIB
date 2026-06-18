import { formatDocumentDecimal, resolveColumnDecimalPlaces } from "@/lib/documents/decimal-format";
import { DOCUMENT_LAYOUT_MODULE_ADAPTERS } from "@/lib/documents/document-layout-module-adapters";
import {
  getVisibleHeaderFields as getVisibleGrnHeaderFields,
  getColumnLineFields as getGrnColumnLineFields,
  getItemDetailLineFields as getGrnItemDetailLineFields,
} from "@/lib/documents/goods-receipt-layout";
import {
  getVisibleHeaderFields as getVisibleBillHeaderFields,
  getColumnLineFields as getBillColumnLineFields,
  getItemDetailLineFields as getBillItemDetailLineFields,
  getVisibleTotalsFields as getVisibleBillTotalsFields,
} from "@/lib/documents/purchase-invoice-layout";
import {
  getVisibleHeaderFields as getVisiblePoHeaderFields,
  getColumnLineFields as getPoColumnLineFields,
  getItemDetailLineFields as getPoItemDetailLineFields,
  getVisibleTotalsFields as getVisiblePoTotalsFields,
} from "@/lib/documents/purchase-order-layout";
import type { DocumentColumnPref, DocumentLayoutTemplate, DocumentModuleKey, DocumentTypography } from "@/lib/documents/types";
import { formatDate } from "@/lib/dashboard/format";
import { purchaseOrderStatusLabel } from "@/lib/procurement/purchase-orders/labels";
import { poTaxSupplyNatureLabel } from "@/lib/procurement/purchase-orders/po-tax-supply";
import { billMatchStatusLabel } from "@/lib/procurement/bills/three-way-match";
import type { GoodsReceiptRow } from "@/lib/procurement/goods-receipts/types";
import type { PurchaseBillRow } from "@/lib/procurement/bills/types";
import type { PurchaseOrderRow } from "@/lib/procurement/purchase-orders/types";
import type { SalesQuoteLineRow, SalesQuoteRow } from "@/lib/sales/quotes/types";
import { salesQuoteDisplayStatusLabel } from "@/lib/sales/quotes/labels";
import type { SalesInvoiceLineRow, SalesInvoiceRow } from "@/lib/sales/invoices/types";
import { salesInvoiceStatusLabel } from "@/lib/sales/invoices/labels";
import type { SalesOrderLineRow, SalesOrderRow } from "@/lib/sales/orders/types";
import { salesOrderStatusLabel } from "@/lib/sales/orders/labels";
import {
  getColumnSalesLineFields,
  getSalesItemDetailLineFields,
  getVisibleSalesHeaderFields,
  getVisibleSalesTotalsFields,
} from "@/lib/sales/shared/sales-commerce-layout";
import { resolveLineDetailFieldDisplay, type PoLineCatalogContext } from "@/lib/documents/catalog-line-values";
import { isCatalogFieldId } from "@/lib/documents/catalog-field-ids";
import { resolvePrintLayoutHints, type DocumentPrintLayoutHints } from "@/lib/documents/print/print-layout-hints";
import { resolveSoAddressBlocks } from "@/lib/sales/orders/address-blocks";

export type { DocumentPrintLayoutHints };

type PrintLineSource = {
  mapLine: (fieldId: string) => string;
  catalogContext?: PoLineCatalogContext | null;
};

export type DocumentPrintField = {
  id: string;
  label: string;
  value: string;
  labelTypography?: DocumentTypography;
  valueTypography?: DocumentTypography;
};

function printFieldFromColumn(column: DocumentColumnPref, value: string): DocumentPrintField {
  return {
    id: column.id,
    label: column.label,
    value,
    labelTypography: column.labelTypography,
    valueTypography: column.valueTypography,
  };
}

export type DocumentPrintLine = Record<string, string>;

export type DocumentPrintAddressBlock = {
  kind: "bill_to" | "ship_to";
  title: string;
  name: string;
  lines: string[];
  taxIdentifier: string | null;
};

export type DocumentPrintModel = {
  moduleKey: DocumentModuleKey;
  headerFields: DocumentPrintField[];
  /** Table header columns (excludes item-detail fields rendered under the item cell). */
  lineColumns: DocumentColumnPref[];
  /** Optional fields rendered as sublines under each item name. */
  itemDetailColumns?: DocumentColumnPref[];
  lines: DocumentPrintLine[];
  totalsFields: DocumentPrintField[];
  statusBadge?: string | null;
  addressBlocks?: DocumentPrintAddressBlock[];
  printLayoutHints?: DocumentPrintLayoutHints;
};

function uniquePrintLineColumns(columns: readonly DocumentColumnPref[]): DocumentColumnPref[] {
  const seen = new Set<string>();
  const unique: DocumentColumnPref[] = [];
  for (const column of columns) {
    if (seen.has(column.id)) continue;
    seen.add(column.id);
    unique.push(column);
  }
  return unique;
}

function resolvePrintLineColumnValue(
  column: DocumentColumnPref,
  line: PrintLineSource,
  detailColumnIds: ReadonlySet<string>
): string {
  const commercial = line.mapLine(column.id);
  if (detailColumnIds.has(column.id) || isCatalogFieldId(column.id)) {
    const resolved = resolveLineDetailFieldDisplay(column, line.catalogContext ?? null, commercial);
    if (resolved != null && resolved.trim() !== "" && resolved !== "—") {
      return formatCell(column, resolved);
    }
  }
  return formatCell(column, commercial);
}

function buildPrintLineRows(
  tableColumns: DocumentColumnPref[],
  detailColumns: DocumentColumnPref[],
  sourceLines: PrintLineSource[],
  layoutHints?: DocumentPrintLayoutHints
): Pick<DocumentPrintModel, "lineColumns" | "itemDetailColumns" | "lines"> {
  const valueColumns = uniquePrintLineColumns([...tableColumns, ...detailColumns]);
  const detailColumnIds = new Set(detailColumns.map((column) => column.id));
  const embedUnitUnderQty =
    layoutHints?.showUnitUnderQty === true &&
    layoutHints.unitFieldId &&
    !valueColumns.some((column) => column.id === layoutHints.unitFieldId);
  const columnsForValues =
    embedUnitUnderQty && layoutHints
      ? [
          ...valueColumns,
          {
            id: layoutHints.unitFieldId,
            label: "Unit",
            defaultVisible: true,
          } satisfies DocumentColumnPref,
        ]
      : valueColumns;

  return {
    lineColumns: tableColumns,
    itemDetailColumns: detailColumns.length > 0 ? detailColumns : undefined,
    lines: sourceLines.map((line) => {
      const row: DocumentPrintLine = {};
      for (const column of columnsForValues) {
        row[column.id] = resolvePrintLineColumnValue(column, line, detailColumnIds);
      }
      return row;
    }),
  };
}

function formatCell(column: DocumentColumnPref, raw: string | number | boolean | null | undefined): string {
  if (raw == null || raw === "") return "—";
  if (typeof raw === "boolean") return raw ? "Yes" : "No";
  const text = String(raw);
  if (column.decimalPlaces != null && !Number.isNaN(Number(text))) {
    return formatDocumentDecimal(text, resolveColumnDecimalPlaces(column));
  }
  return text;
}

function poHeaderValue(order: PurchaseOrderRow, fieldId: string): string {
  switch (fieldId) {
    case "supplier":
      return order.supplier_name ?? "—";
    case "destination":
      return order.destination_location_name ?? "—";
    case "tax_supply_nature":
      return poTaxSupplyNatureLabel(order.tax_supply_nature);
    case "currency":
      return order.currency_code ?? "—";
    case "voucher_number":
      return order.voucher_number;
    case "payment_terms_days":
      return String(order.payment_terms_days ?? "—");
    case "requisition_number":
      return typeof order.custom_fields?.requisition_number === "string"
        ? order.custom_fields.requisition_number
        : "—";
    case "expected_delivery_date":
      return typeof order.custom_fields?.expected_delivery_date === "string"
        ? formatDate(order.custom_fields.expected_delivery_date)
        : "—";
    case "internal_notes":
      return typeof order.custom_fields?.internal_notes === "string"
        ? order.custom_fields.internal_notes
        : "—";
    case "document_status":
      return purchaseOrderStatusLabel(order.document_status);
    case "created_at":
      return formatDate(order.created_at);
    case "created_by":
      return order.created_by_name ?? "—";
    case "updated_at":
      return order.updated_at ? formatDate(order.updated_at) : "—";
    default:
      return "—";
  }
}

function grnHeaderValue(receipt: GoodsReceiptRow, fieldId: string): string {
  switch (fieldId) {
    case "destination":
      return receipt.destination_location_name ?? "—";
    case "purchase_order":
      return receipt.purchase_order_number ?? "—";
    case "voucher_number":
      return receipt.voucher_number;
    case "received_at":
      return formatDate(receipt.received_at);
    case "is_qc_pending":
      return receipt.is_qc_pending ? "Yes" : "No";
    case "bill_of_entry_number":
      return receipt.bill_of_entry_number ?? "—";
    case "bill_of_entry_date":
      return receipt.bill_of_entry_date ? formatDate(receipt.bill_of_entry_date) : "—";
    case "port_code":
      return receipt.port_code ?? "—";
    case "exchange_rate":
      return receipt.exchange_rate ?? "—";
    case "assessable_value":
      return receipt.assessable_value ?? "—";
    case "customs_duty_header":
      return receipt.customs_duty_amount ?? "—";
    case "import_igst_header":
      return receipt.import_igst_amount ?? "—";
    case "created_at":
      return formatDate(receipt.created_at);
    default:
      return "—";
  }
}

function billHeaderValue(bill: PurchaseBillRow, fieldId: string): string {
  switch (fieldId) {
    case "supplier":
      return bill.supplier_name ?? "—";
    case "invoice_number_vendor":
      return bill.invoice_number_vendor;
    case "system_voucher_number":
      return bill.system_voucher_number;
    case "purchase_order":
      return bill.purchase_order_number ?? "—";
    case "match_status":
      return bill.match_status ? billMatchStatusLabel(bill.match_status) : "—";
    case "tax_treatment":
      return bill.tax_treatment;
    case "created_at":
      return formatDate(bill.created_at);
    default:
      return "—";
  }
}

function poLineValue(line: NonNullable<PurchaseOrderRow["lines"]>[number], fieldId: string): string {
  switch (fieldId) {
    case "item":
      return line.item_name ?? "—";
    case "sku":
      return line.variant_sku ?? "—";
    case "quantity_ordered":
      return line.quantity_ordered ?? "—";
    case "quantity_received":
      return line.quantity_received ?? "—";
    case "unit":
      return line.uom_code ?? line.base_unit_of_measure ?? "—";
    case "unit_price":
      return line.unit_price_contractual ?? "—";
    case "mrp":
      return line.mrp ?? "—";
    case "discount_pct":
      return line.discount_percentage ?? "—";
    case "discount_amount":
      return line.discount_amount ?? "—";
    case "tax_rate_pct":
      return line.tax_rate_percentage ?? "—";
    case "line_tax_amount":
      return line.line_tax_amount ?? "—";
    case "cgst_amount":
    case "sgst_amount":
    case "igst_amount":
      return "—";
    case "line_total":
      return line.line_total_gross ?? "—";
    default:
      return "—";
  }
}

function grnLineValue(line: NonNullable<GoodsReceiptRow["lines"]>[number], fieldId: string): string {
  switch (fieldId) {
    case "item":
      return line.item_name ?? "—";
    case "sku":
      return line.variant_sku ?? "—";
    case "quantity_received":
      return line.quantity_received ?? "—";
    case "quantity_accepted":
      return line.quantity_accepted ?? "—";
    case "quantity_rejected":
      return line.quantity_rejected ?? "—";
    case "raw_unit_cost":
      return line.raw_unit_cost ?? "—";
    case "total_final_landed_cost":
      return line.total_final_landed_cost ?? "—";
    case "import_igst_amount":
      return line.import_igst_amount ?? "—";
    case "customs_duty_amount":
      return line.customs_duty_amount ?? "—";
    default:
      return "—";
  }
}

function billLineValue(line: NonNullable<PurchaseBillRow["lines"]>[number], fieldId: string): string {
  switch (fieldId) {
    case "item":
      return line.item_name ?? line.item_id ?? "—";
    case "sku":
      return line.variant_sku ?? "—";
    case "quantity_billed":
      return line.quantity_billed ?? "—";
    case "unit_price_billed":
      return line.unit_price_billed ?? "—";
    case "po_unit_price":
      return line.po_unit_price ?? "—";
    case "grn_landed_unit_cost":
      return line.grn_landed_unit_cost ?? "—";
    case "line_tax_computed":
      return line.line_tax_computed ?? "—";
    default:
      return "—";
  }
}

function invoiceHeaderValue(invoice: SalesInvoiceRow, fieldId: string): string {
  switch (fieldId) {
    case "customer":
      return invoice.customer_name ?? "—";
    case "shipping_location":
      return invoice.origin_location_name ?? "—";
    case "tax_supply_nature":
      return invoice.billing_state && invoice.shipping_state
        ? invoice.billing_state === invoice.shipping_state
          ? "Same state"
          : "Interstate"
        : "—";
    case "currency":
      return "INR";
    case "voucher_number":
      return invoice.invoice_number;
    case "payment_terms_days":
      return String(invoice.payment_terms_days ?? "—");
    case "requisition_number":
      return typeof invoice.custom_fields?.customer_reference === "string"
        ? invoice.custom_fields.customer_reference
        : "—";
    case "expected_delivery_date":
      return "—";
    case "internal_notes":
      return typeof invoice.custom_fields?.internal_notes === "string"
        ? invoice.custom_fields.internal_notes
        : "—";
    case "document_status":
      return salesInvoiceStatusLabel(invoice.commercial_status);
    case "created_at":
      return formatDate(invoice.created_at);
    case "created_by":
      return invoice.created_by_name ?? "—";
    case "updated_at":
      return invoice.updated_at ? formatDate(invoice.updated_at) : "—";
    default:
      return "—";
  }
}

function invoiceLineValue(line: SalesInvoiceLineRow, fieldId: string): string {
  switch (fieldId) {
    case "item":
      return line.item_name ?? "—";
    case "sku":
      return line.variant_sku ?? "—";
    case "quantity_ordered":
    case "quantity_invoiced":
      return line.quantity_invoiced ?? "—";
    case "unit":
      return line.uom_code ?? line.base_unit_of_measure ?? "—";
    case "unit_price":
      return line.unit_price_selling ?? "—";
    case "discount_pct":
      return line.discount_percentage ?? "—";
    case "discount_amount":
      return line.discount_amount ?? "—";
    case "tax_rate_pct":
      return "—";
    case "line_tax_amount":
      return line.line_tax_amount ?? "—";
    case "line_total":
      return line.line_total_net ?? "—";
    default:
      return "—";
  }
}

function buildSalesCommercePrintModel(
  moduleKey: "SALES_QUOTATION" | "SALES_INVOICE" | "SALES_ORDER",
  layout: DocumentLayoutTemplate,
  headerValue: (fieldId: string) => string,
  lines: PrintLineSource[],
  totals: {
    subtotal: string;
    tax: string;
    discount: string;
    grandTotal: string;
    lineCount: number;
  },
  extras?: Pick<DocumentPrintModel, "statusBadge" | "addressBlocks">
): DocumentPrintModel {
  const adapter = DOCUMENT_LAYOUT_MODULE_ADAPTERS[moduleKey];
  const normalized = adapter.normalize(layout);
  const headerColumns = getVisibleSalesHeaderFields(normalized);
  const tableLineColumns = getColumnSalesLineFields(normalized);
  const itemDetailColumns = getSalesItemDetailLineFields(normalized);
  const totalsColumns = getVisibleSalesTotalsFields(normalized);
  const printLayoutHints = resolvePrintLayoutHints(moduleKey, layout);
  const lineSection = buildPrintLineRows(
    tableLineColumns,
    itemDetailColumns,
    lines,
    printLayoutHints
  );

  return {
    moduleKey,
    headerFields: headerColumns.map((column) =>
      printFieldFromColumn(column, formatCell(column, headerValue(column.id)))
    ),
    ...lineSection,
    totalsFields: totalsColumns.map((column) => {
      const raw =
        column.id === "subtotal_ex_tax"
          ? totals.subtotal
          : column.id === "tax_amount"
            ? totals.tax
            : column.id === "transaction_discount"
              ? totals.discount
              : column.id === "grand_total"
                ? totals.grandTotal
                : column.id === "line_count"
                  ? String(totals.lineCount)
                  : "—";
      return printFieldFromColumn(column, formatCell(column, raw));
    }),
    printLayoutHints,
    ...extras,
  };
}

function quoteHeaderValue(quote: SalesQuoteRow, fieldId: string): string {
  switch (fieldId) {
    case "customer":
      return quote.customer_name ?? "—";
    case "shipping_location":
      return quote.origin_location_name ?? "—";
    case "tax_supply_nature":
      return quote.billing_state && quote.shipping_state
        ? quote.billing_state === quote.shipping_state
          ? "Same state"
          : "Interstate"
        : "—";
    case "currency":
      return "INR";
    case "voucher_number":
      return quote.quotation_number;
    case "payment_terms_days":
      return String(quote.payment_terms_days ?? "—");
    case "requisition_number":
      return typeof quote.custom_fields?.customer_reference === "string"
        ? quote.custom_fields.customer_reference
        : "—";
    case "expected_delivery_date":
      return formatDate(quote.valid_until);
    case "internal_notes":
      return typeof quote.custom_fields?.internal_notes === "string"
        ? quote.custom_fields.internal_notes
        : "—";
    case "document_status":
      return salesQuoteDisplayStatusLabel(quote);
    case "created_at":
      return formatDate(quote.created_at);
    case "created_by":
      return quote.created_by_name ?? "—";
    case "updated_at":
      return quote.updated_at ? formatDate(quote.updated_at) : "—";
    default:
      return "—";
  }
}

function quoteLineValue(line: SalesQuoteLineRow, fieldId: string): string {
  switch (fieldId) {
    case "item":
      return line.item_name ?? "—";
    case "sku":
      return line.variant_sku ?? "—";
    case "quantity_ordered":
    case "quantity_quoted":
      return line.quantity_quoted ?? "—";
    case "unit":
      return line.uom_code ?? line.base_unit_of_measure ?? "—";
    case "unit_price":
      return line.unit_price_selling ?? "—";
    case "discount_pct":
      return line.discount_percentage ?? "—";
    case "discount_amount":
      return line.discount_amount ?? "—";
    case "tax_rate_pct":
      return "—";
    case "line_tax_amount":
      return line.line_tax_amount ?? "—";
    case "line_total":
      return line.line_total_gross ?? "—";
    default:
      return "—";
  }
}

function orderHeaderValue(order: SalesOrderRow, fieldId: string): string {
  switch (fieldId) {
    case "customer":
      return order.customer_name ?? "—";
    case "shipping_location":
      return order.shipping_location_name ?? "—";
    case "tax_supply_nature":
      return order.billing_state && order.shipping_state
        ? order.billing_state === order.shipping_state
          ? "Same state"
          : "Interstate"
        : "—";
    case "currency":
      return "INR";
    case "voucher_number":
      return order.voucher_number;
    case "payment_terms_days":
      return typeof order.custom_fields?.payment_terms_days === "number" ||
        typeof order.custom_fields?.payment_terms_days === "string"
        ? String(order.custom_fields.payment_terms_days)
        : "—";
    case "requisition_number":
      return order.source_quotation_number ?? "—";
    case "expected_delivery_date":
      return "—";
    case "internal_notes":
      return typeof order.custom_fields?.internal_notes === "string"
        ? order.custom_fields.internal_notes
        : "—";
    case "document_status":
      return salesOrderStatusLabel(order.commercial_status);
    case "created_at":
      return formatDate(order.created_at);
    case "created_by":
      return order.created_by_name ?? "—";
    case "updated_at":
      return order.updated_at ? formatDate(order.updated_at) : "—";
    default:
      return "—";
  }
}

function orderLineValue(line: SalesOrderLineRow, fieldId: string): string {
  switch (fieldId) {
    case "item":
      return line.item_name ?? "—";
    case "sku":
      return line.variant_sku ?? "—";
    case "quantity_ordered":
      return line.quantity_ordered ?? "—";
    case "unit":
      return line.uom_code ?? line.base_unit_of_measure ?? "—";
    case "unit_price":
      return line.unit_price_selling ?? "—";
    case "discount_pct":
      return line.discount_percentage ?? "—";
    case "discount_amount":
      return line.discount_amount ?? "—";
    case "tax_rate_pct":
      return "—";
    case "line_tax_amount":
      return line.line_tax_amount ?? "—";
    case "line_total":
      return line.line_total_gross ?? "—";
    default:
      return "—";
  }
}

function lineCatalogContext(line: unknown): PoLineCatalogContext | null {
  if (!line || typeof line !== "object") return null;
  const context = (line as { catalog_context?: PoLineCatalogContext | null }).catalog_context;
  return context ?? null;
}

export function buildDocumentPrintModel(
  moduleKey: DocumentModuleKey,
  layout: DocumentLayoutTemplate,
  document:
    | PurchaseOrderRow
    | GoodsReceiptRow
    | PurchaseBillRow
    | SalesQuoteRow
    | SalesOrderRow
    | SalesInvoiceRow
): DocumentPrintModel {
  if (moduleKey === "SALES_QUOTATION") {
    const quote = document as SalesQuoteRow;
    return buildSalesCommercePrintModel(
      "SALES_QUOTATION",
      layout,
      (fieldId) => quoteHeaderValue(quote, fieldId),
      (quote.lines ?? []).map((line) => ({
        mapLine: (fieldId) => quoteLineValue(line, fieldId),
        catalogContext: lineCatalogContext(line),
      })),
      {
        subtotal: quote.total_gross_amount,
        tax: quote.total_tax_amount,
        discount: String(quote.custom_fields?.transaction_discount_amount ?? "0"),
        grandTotal: quote.total_net_amount,
        lineCount: quote.line_count ?? quote.lines?.length ?? 0,
      }
    );
  }

  if (moduleKey === "SALES_INVOICE") {
    const invoice = document as SalesInvoiceRow;
    return buildSalesCommercePrintModel(
      "SALES_INVOICE",
      layout,
      (fieldId) => invoiceHeaderValue(invoice, fieldId),
      (invoice.lines ?? []).map((line) => ({
        mapLine: (fieldId) => invoiceLineValue(line, fieldId),
        catalogContext: lineCatalogContext(line),
      })),
      {
        subtotal: invoice.total_gross_amount,
        tax: invoice.total_tax_amount,
        discount: String(invoice.custom_fields?.transaction_discount_amount ?? "0"),
        grandTotal: invoice.total_net_amount,
        lineCount: invoice.line_count ?? invoice.lines?.length ?? 0,
      }
    );
  }

  if (moduleKey === "SALES_ORDER") {
    const order = document as SalesOrderRow;
    const addressBlocks = resolveSoAddressBlocks(order).map((block) => ({
      kind: block.kind,
      title: block.title,
      name: block.name,
      lines: block.lines,
      taxIdentifier: block.tax_identifier,
    }));

    return buildSalesCommercePrintModel(
      "SALES_ORDER",
      layout,
      (fieldId) => orderHeaderValue(order, fieldId),
      (order.lines ?? []).map((line) => ({
        mapLine: (fieldId) => orderLineValue(line, fieldId),
        catalogContext: lineCatalogContext(line),
      })),
      {
        subtotal: order.total_gross_amount,
        tax: order.total_tax_amount,
        discount: String(order.custom_fields?.transaction_discount_amount ?? "0"),
        grandTotal: order.total_net_amount,
        lineCount: order.line_count ?? order.lines?.length ?? 0,
      },
      {
        statusBadge: salesOrderStatusLabel(order.commercial_status),
        addressBlocks: addressBlocks.length > 0 ? addressBlocks : undefined,
      }
    );
  }

  const adapter = DOCUMENT_LAYOUT_MODULE_ADAPTERS[moduleKey as "PURCHASE_ORDER" | "GOODS_RECEIPT_NOTE" | "PURCHASE_INVOICE"];
  const normalized = adapter?.normalize(layout) ?? layout;

  if (moduleKey === "PURCHASE_ORDER") {
    const order = document as PurchaseOrderRow;
    const headerColumns = getVisiblePoHeaderFields(normalized);
    const tableLineColumns = getPoColumnLineFields(normalized);
    const itemDetailColumns = getPoItemDetailLineFields(normalized);
    const totalsColumns = getVisiblePoTotalsFields(normalized);
    const printLayoutHints = resolvePrintLayoutHints(moduleKey, layout);
    const lineSection = buildPrintLineRows(
      tableLineColumns,
      itemDetailColumns,
      (order.lines ?? []).map((line) => ({
        mapLine: (fieldId) => poLineValue(line, fieldId),
        catalogContext: lineCatalogContext(line),
      })),
      printLayoutHints
    );

    return {
      moduleKey,
      headerFields: headerColumns.map((column) =>
        printFieldFromColumn(column, formatCell(column, poHeaderValue(order, column.id)))
      ),
      ...lineSection,
      printLayoutHints,
      totalsFields: totalsColumns.map((column) => {
        const raw =
          column.id === "subtotal_ex_tax"
            ? order.total_gross_amount
            : column.id === "tax_amount"
              ? order.total_tax_amount
              : column.id === "transaction_discount"
                ? order.transaction_discount_amount
                : column.id === "shipping_amount"
                  ? order.shipping_amount
                  : column.id === "shipping_tax_amount"
                    ? order.shipping_tax_amount
                    : column.id === "round_off_amount"
                      ? order.round_off_amount
                      : column.id === "additional_charges_amount"
                        ? order.additional_charges_amount
                        : column.id === "grand_total"
                          ? order.total_net_amount
                          : column.id === "line_count"
                            ? String(order.line_count ?? order.lines?.length ?? 0)
                            : "—";
        return printFieldFromColumn(column, formatCell(column, raw));
      }),
    };
  }

  if (moduleKey === "GOODS_RECEIPT_NOTE") {
    const receipt = document as GoodsReceiptRow;
    const headerColumns = getVisibleGrnHeaderFields(normalized);
    const tableLineColumns = getGrnColumnLineFields(normalized);
    const itemDetailColumns = getGrnItemDetailLineFields(normalized);
    const printLayoutHints = resolvePrintLayoutHints(moduleKey, layout);
    const lineSection = buildPrintLineRows(
      tableLineColumns,
      itemDetailColumns,
      (receipt.lines ?? []).map((line) => ({
        mapLine: (fieldId) => grnLineValue(line, fieldId),
        catalogContext: lineCatalogContext(line),
      })),
      printLayoutHints
    );

    return {
      moduleKey,
      headerFields: headerColumns.map((column) =>
        printFieldFromColumn(column, formatCell(column, grnHeaderValue(receipt, column.id)))
      ),
      ...lineSection,
      printLayoutHints,
      totalsFields: [],
    };
  }

  const bill = document as PurchaseBillRow;
  const headerColumns = getVisibleBillHeaderFields(normalized);
  const tableLineColumns = getBillColumnLineFields(normalized);
  const itemDetailColumns = getBillItemDetailLineFields(normalized);
  const totalsColumns = getVisibleBillTotalsFields(normalized);
  const printLayoutHints = resolvePrintLayoutHints(moduleKey, layout);
  const lineSection = buildPrintLineRows(
    tableLineColumns,
    itemDetailColumns,
    (bill.lines ?? []).map((line) => ({
      mapLine: (fieldId) => billLineValue(line, fieldId),
      catalogContext: lineCatalogContext(line),
    })),
    printLayoutHints
  );

  return {
    moduleKey,
    headerFields: headerColumns.map((column) =>
      printFieldFromColumn(column, formatCell(column, billHeaderValue(bill, column.id)))
    ),
    ...lineSection,
    printLayoutHints,
    totalsFields: totalsColumns.map((column) => {
      const raw =
        column.id === "total_gross_amount"
          ? bill.total_gross_amount
          : column.id === "total_tax_amount"
            ? bill.total_tax_amount
            : column.id === "total_liability_amount"
              ? bill.total_liability_amount
              : "—";
      return printFieldFromColumn(column, formatCell(column, raw));
    }),
  };
}

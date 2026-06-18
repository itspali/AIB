import type { GoodsReceiptRow } from "@/lib/procurement/goods-receipts/types";
import type { PurchaseBillRow } from "@/lib/procurement/bills/types";
import type { PurchaseOrderRow } from "@/lib/procurement/purchase-orders/types";
import type { SalesInvoiceRow } from "@/lib/sales/invoices/types";
import type { SalesOrderRow } from "@/lib/sales/orders/types";
import type { SalesQuoteRow } from "@/lib/sales/quotes/types";
import type { DocumentModuleKey } from "@/lib/documents/types";
import { buildPrintLineCatalogContext } from "@/lib/documents/print/print-line-catalog-context";

export type DesignerSampleDocument =
  | PurchaseOrderRow
  | GoodsReceiptRow
  | PurchaseBillRow
  | SalesQuoteRow
  | SalesOrderRow
  | SalesInvoiceRow;

const SAMPLE_LINES = {
  procurement: [
    {
      id: "line-1",
      item_id: "item-1",
      item_name: "Widget A",
      variant_id: "variant-1",
      variant_sku: "WGT-A",
      quantity_ordered: "2",
      quantity_received: "2",
      unit_price: "500.00",
      line_total: "1,000.00",
      uom_code: "EA",
    },
    {
      id: "line-2",
      item_id: "item-2",
      item_name: "Widget B",
      variant_id: "variant-2",
      variant_sku: "WGT-B",
      quantity_ordered: "1",
      quantity_received: "1",
      unit_price: "250.00",
      line_total: "250.00",
      uom_code: "EA",
    },
  ],
  sales: [
    {
      id: "line-1",
      item_id: "item-1",
      item_name: "Widget A",
      variant_id: "variant-1",
      variant_sku: "WGT-A",
      quantity_ordered: "2",
      quantity_quoted: "2",
      quantity_invoiced: "2",
      quantity_allocated: "0",
      quantity_shipped: "0",
      unit_price_selling: "500.00",
      discount_percentage: "0",
      discount_amount: "0",
      line_total_gross: "1,000.00",
      line_tax_amount: "180.00",
      line_total_net: "1,180.00",
      open_quantity: "2",
      uom_code: "EA",
    },
  ],
};

const SAMPLE_SALES_ADDRESS = {
  name: "J S Food",
  address_line1: "Plot 18, Industrial Area Phase II",
  address_line2: "Peenya",
  city: "Bengaluru",
  state: "Karnataka",
  zip_postal: "560058",
  country_code: "India",
  tax_identifier: "29AABCU9603R1ZX",
};

const SAMPLE_SALES_LINES: SalesOrderRow["lines"] = [
  {
    id: "line-1",
    item_id: "item-1",
    item_name: 'Frozen Dough Sheet (Spring Roll) 7.5" / 50 Sheets',
    variant_id: "variant-1",
    variant_sku: "FDS-75-50",
    quantity_ordered: "120",
    unit_price_selling: "145.00",
    discount_percentage: "0",
    discount_amount: "0",
    line_total_gross: "17,400.00",
    line_tax_amount: "3,132.00",
    line_total_net: "20,532.00",
    open_quantity: "120",
    uom_code: "Pcs",
    catalog_context: buildPrintLineCatalogContext({
      hsn_sac_code: "19059090",
      description: "Ready-to-use frozen dough sheets for spring rolls",
      base_unit_of_measure: "Pcs",
      uom_code: "Pcs",
      variant_attributes: { Pack: "50 Sheets", Size: '7.5"' },
    }),
  },
  {
    id: "line-2",
    item_id: "item-2",
    item_name: "Puff Pastry Block 1 kg",
    variant_id: "variant-2",
    variant_sku: "PPB-1KG",
    quantity_ordered: "80",
    unit_price_selling: "210.00",
    discount_percentage: "0",
    discount_amount: "0",
    line_total_gross: "16,800.00",
    line_tax_amount: "3,024.00",
    line_total_net: "19,824.00",
    open_quantity: "80",
    uom_code: "Pcs",
    catalog_context: buildPrintLineCatalogContext({
      hsn_sac_code: "19059020",
      description: "Butter puff pastry block for commercial baking",
      base_unit_of_measure: "Pcs",
      uom_code: "Pcs",
      variant_attributes: { Weight: "1 kg" },
    }),
  },
] as unknown as SalesOrderRow["lines"];

export function getDesignerSampleDocument(moduleKey: DocumentModuleKey): DesignerSampleDocument {
  switch (moduleKey) {
    case "PURCHASE_ORDER":
      return {
        id: "sample-po",
        voucher_number: "PO-00001",
        supplier_id: "supplier-1",
        supplier_name: "Acme Supplies Pvt Ltd",
        destination_location_id: "loc-1",
        destination_location_name: "Main warehouse",
        destination_location_code: "WH01",
        commercial_status: "APPROVED_ACTIVE",
        total_gross_amount: "1,250.00",
        total_tax_amount: "225.00",
        total_net_amount: "1,475.00",
        line_count: 2,
        created_at: "2026-06-17T10:00:00.000Z",
        updated_at: "2026-06-17T10:00:00.000Z",
        lines: SAMPLE_LINES.procurement as unknown as PurchaseOrderRow["lines"],
      } as unknown as PurchaseOrderRow;
    case "GOODS_RECEIPT_NOTE":
      return {
        id: "sample-grn",
        voucher_number: "GRN-00001",
        destination_location_id: "loc-1",
        destination_location_name: "Main warehouse",
        destination_location_code: "WH01",
        purchase_order_id: "po-1",
        purchase_order_number: "PO-00001",
        is_qc_pending: false,
        line_count: 2,
        received_at: "2026-06-17T10:00:00.000Z",
        created_at: "2026-06-17T10:00:00.000Z",
        bill_of_entry_number: null,
        bill_of_entry_date: null,
        port_code: null,
        exchange_rate: null,
        assessable_value: null,
        customs_duty_amount: null,
        import_igst_amount: null,
        lines: SAMPLE_LINES.procurement as unknown as GoodsReceiptRow["lines"],
      } as unknown as GoodsReceiptRow;
    case "PURCHASE_INVOICE":
      return {
        id: "sample-bill",
        invoice_number_vendor: "INV-VND-01",
        system_voucher_number: "BILL-00001",
        supplier_id: "supplier-1",
        supplier_name: "Acme Supplies Pvt Ltd",
        purchase_order_id: "po-1",
        purchase_order_number: "PO-00001",
        tax_treatment: "REGULAR_B2B",
        tax_supply_nature: "INTRA_STATE",
        tax_mechanism: "FORWARD_CHARGE",
        rcm_applicable: false,
        total_gross_amount: "1,250.00",
        total_tax_amount: "225.00",
        total_liability_amount: "1,475.00",
        is_paid: false,
        created_at: "2026-06-17T10:00:00.000Z",
        lines: SAMPLE_LINES.procurement as unknown as PurchaseBillRow["lines"],
      } as unknown as PurchaseBillRow;
    case "SALES_QUOTATION":
      return {
        id: "sample-quote",
        quotation_number: "QT-00001",
        customer_id: "customer-1",
        customer_name: "Acme Retail Pvt Ltd",
        origin_location_id: "loc-1",
        origin_location_name: "Main store",
        commercial_status: "APPROVED_ACTIVE",
        billing_state: "Karnataka",
        shipping_state: "Karnataka",
        payment_terms_days: 30,
        total_gross_amount: "1,000.00",
        total_tax_amount: "180.00",
        total_net_amount: "1,180.00",
        line_count: 1,
        custom_fields: {},
        created_by: "user-1",
        created_by_name: "Sample User",
        created_at: "2026-06-17T10:00:00.000Z",
        updated_at: "2026-06-17T10:00:00.000Z",
        lines: SAMPLE_LINES.sales as unknown as SalesQuoteRow["lines"],
      } as unknown as SalesQuoteRow;
    case "SALES_ORDER":
      return {
        id: "sample-so",
        voucher_number: "SO-00001",
        customer_id: "customer-1",
        customer_name: "J S Food",
        customer_address: SAMPLE_SALES_ADDRESS,
        shipping_location_id: "loc-1",
        shipping_location_name: "Peenya Outlet",
        shipping_location_code: "ST01",
        shipping_address: {
          ...SAMPLE_SALES_ADDRESS,
          name: "J S Food — Peenya Outlet",
          address_line2: "Peenya Industrial Area",
        },
        commercial_status: "APPROVED_ACTIVE",
        fulfillment_status: "NOT_FULFILLED",
        payment_status: "UNPAID",
        billing_state: "Karnataka",
        shipping_state: "Karnataka",
        total_gross_amount: "34,200.00",
        total_tax_amount: "6,156.00",
        line_count: 2,
        total_net_amount: "40,356.00",
        customer_tax_treatment: "REGULAR_B2B",
        custom_fields: {},
        source_quotation_id: null,
        created_by: "user-1",
        created_by_name: "Sample User",
        created_at: "2026-06-17T10:00:00.000Z",
        updated_at: "2026-06-17T10:00:00.000Z",
        lines: SAMPLE_SALES_LINES,
      } as unknown as SalesOrderRow;
    case "SALES_INVOICE":
      return {
        id: "sample-invoice",
        invoice_number: "INV-00001",
        customer_id: "customer-1",
        customer_name: "Acme Retail Pvt Ltd",
        origin_location_id: "loc-1",
        origin_location_name: "Main store",
        commercial_status: "APPROVED_ACTIVE",
        billing_state: "Karnataka",
        shipping_state: "Karnataka",
        payment_terms_days: 30,
        total_gross_amount: "1,000.00",
        total_tax_amount: "180.00",
        total_net_amount: "1,180.00",
        line_count: 1,
        custom_fields: {},
        created_by: "user-1",
        created_by_name: "Sample User",
        created_at: "2026-06-17T10:00:00.000Z",
        updated_at: "2026-06-17T10:00:00.000Z",
        lines: SAMPLE_LINES.sales as unknown as SalesInvoiceRow["lines"],
      } as unknown as SalesInvoiceRow;
    default:
      throw new Error(`Unsupported designer sample module: ${moduleKey}`);
  }
}

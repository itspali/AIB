import type { DocumentSplitFeedRow } from "@/components/layout/list-workspace-document-split-feed";
import type { EntityCategoryListRow } from "@/lib/entity-categories/list-row";
import type { EntityListRow } from "@/lib/entities/types";
import { shippingCarrierLabel } from "@/lib/fulfillment/shipping/labels";
import type { SalesShipmentRow } from "@/lib/fulfillment/shipping/types";
import type { StockAdjustmentRow, StockBalanceRow } from "@/lib/inventory/stock/types";
import type { StockTransferRow } from "@/lib/inventory/transfers/types";
import { stockTransferStatusLabel } from "@/lib/inventory/transfers/labels";
import type { PurchaseBillRow } from "@/lib/procurement/bills/types";
import type { GoodsInTransitRow } from "@/lib/procurement/git/types";
import { gitVoucherStatusLabel } from "@/lib/procurement/git/types";
import type { GoodsReceiptRow } from "@/lib/procurement/goods-receipts/types";
import { purchaseOrderStatusLabel } from "@/lib/procurement/purchase-orders/labels";
import type { PurchaseOrderRow } from "@/lib/procurement/purchase-orders/types";
import type { QcInspectionQueueRow } from "@/lib/procurement/quality-inspection/types";
import {
  importShipmentStatusLabel,
  type ImportShipmentRow,
} from "@/lib/procurement/shipments/types";
import type { SalesInvoiceRow } from "@/lib/sales/invoices/types";
import type { SalesOrderRow } from "@/lib/sales/orders/types";
import type { CustomerPaymentRow } from "@/lib/sales/payments/types";
import type { SalesQuoteRow } from "@/lib/sales/quotes/types";
import { salesDocumentStatusLabel } from "@/lib/sales/shared/document-status";
import { taxCodeKindLabel, type TaxCodeRow } from "@/lib/tax/types";

function joinMeta(parts: Array<string | null | undefined>): string | undefined {
  const value = parts.filter(Boolean).join(" · ");
  return value || undefined;
}

export function mapEntityListRowToSplitFeed(row: EntityListRow): DocumentSplitFeedRow {
  const category =
    row.customer_category_name ?? row.supplier_category_name ?? undefined;
  return {
    id: row.id,
    code: row.code ?? "—",
    title: row.name,
    meta: joinMeta([category, row.primary_contact_email]),
    trailing: row.is_active ? "Active" : "Inactive",
    inactive: !row.is_active,
  };
}

export function mapEntityCategoryListRowToSplitFeed(
  row: EntityCategoryListRow
): DocumentSplitFeedRow {
  return {
    id: row.id,
    code: row.name,
    title: row.name,
    meta: row.parent_name !== "—" ? row.parent_name : undefined,
    trailing: row.is_active ? "Active" : "Inactive",
    inactive: !row.is_active,
  };
}

export function mapPurchaseOrderRowToSplitFeed(row: PurchaseOrderRow): DocumentSplitFeedRow {
  return {
    id: row.id,
    code: row.voucher_number,
    title: row.supplier_name ?? "—",
    meta: joinMeta([row.destination_location_name, row.destination_location_code]),
    trailing: purchaseOrderStatusLabel(row.document_status),
    inactive: row.document_status === "CANCELLED",
  };
}

export function mapGoodsReceiptRowToSplitFeed(row: GoodsReceiptRow): DocumentSplitFeedRow {
  return {
    id: row.id,
    code: row.voucher_number,
    title: row.destination_location_name,
    meta: row.purchase_order_number ? `PO ${row.purchase_order_number}` : undefined,
    trailing: row.is_qc_pending ? "QC pending" : "Received",
    inactive: false,
  };
}

export function mapSalesInvoiceRowToSplitFeed(row: SalesInvoiceRow): DocumentSplitFeedRow {
  return {
    id: row.id,
    code: row.invoice_number,
    title: row.customer_name,
    meta: joinMeta([row.origin_location_name, row.origin_location_code]),
    trailing: salesDocumentStatusLabel(row.commercial_status),
    inactive: row.commercial_status === "CANCELLED",
  };
}

export function mapSalesOrderRowToSplitFeed(row: SalesOrderRow): DocumentSplitFeedRow {
  return {
    id: row.id,
    code: row.voucher_number,
    title: row.customer_name,
    meta: joinMeta([row.shipping_location_name, row.shipping_location_code]),
    trailing: salesDocumentStatusLabel(row.commercial_status),
    inactive: row.commercial_status === "CANCELLED",
  };
}

export function mapSalesQuoteRowToSplitFeed(row: SalesQuoteRow): DocumentSplitFeedRow {
  return {
    id: row.id,
    code: row.quotation_number,
    title: row.customer_name,
    meta: joinMeta([row.origin_location_name, row.origin_location_code]),
    trailing: salesDocumentStatusLabel(row.commercial_status),
    inactive: row.commercial_status === "CANCELLED",
  };
}

export function mapStockBalanceRowToSplitFeed(row: StockBalanceRow): DocumentSplitFeedRow {
  return {
    id: row.id,
    code: row.variant_sku,
    title: row.item_name,
    meta: joinMeta([row.location_name, row.location_code]),
    trailing: row.total_quantity_on_hand,
  };
}

export function mapStockAdjustmentRowToSplitFeed(row: StockAdjustmentRow): DocumentSplitFeedRow {
  return {
    id: row.id,
    code: row.adjustment_number,
    title: row.location_name,
    meta: row.reason || undefined,
    trailing: row.kind,
  };
}

export function mapStockTransferRowToSplitFeed(row: StockTransferRow): DocumentSplitFeedRow {
  return {
    id: row.id,
    code: row.transfer_number,
    title: row.source_location_name,
    meta: joinMeta(["→", row.destination_location_name]),
    trailing: stockTransferStatusLabel(row.current_status),
    inactive: row.current_status === "CANCELLED",
  };
}

export function mapGoodsInTransitRowToSplitFeed(row: GoodsInTransitRow): DocumentSplitFeedRow {
  return {
    id: row.id,
    code: row.voucher_number,
    title: row.source_location_name,
    meta: joinMeta([row.git_holding_location_name, row.destination_location_name]),
    trailing: gitVoucherStatusLabel(row.status),
    inactive: row.status === "CANCELLED",
  };
}

export function mapQcInspectionQueueRowToSplitFeed(
  row: QcInspectionQueueRow
): DocumentSplitFeedRow {
  return {
    id: row.id,
    code: row.variant_sku,
    title: row.item_name,
    meta: joinMeta([row.grn_number, row.destination_location_name]),
    trailing: row.quantity_on_hold,
  };
}

export function mapImportShipmentRowToSplitFeed(row: ImportShipmentRow): DocumentSplitFeedRow {
  return {
    id: row.id,
    code: row.shipment_number,
    title: row.supplier_name,
    meta: joinMeta([row.forwarder_name, row.staging_location_name]),
    trailing: importShipmentStatusLabel(row.status),
    inactive: row.status === "CANCELLED",
  };
}

export function mapPurchaseBillRowToSplitFeed(row: PurchaseBillRow): DocumentSplitFeedRow {
  return {
    id: row.id,
    code: row.system_voucher_number,
    title: row.supplier_name,
    meta: row.purchase_order_number
      ? `PO ${row.purchase_order_number}`
      : row.invoice_number_vendor,
    trailing: row.document_status ?? row.match_status,
    inactive: row.document_status === "CANCELLED",
  };
}

export function mapCustomerPaymentRowToSplitFeed(row: CustomerPaymentRow): DocumentSplitFeedRow {
  return {
    id: row.id,
    code: row.payment_number,
    title: row.customer_name,
    meta: row.reference_number ?? undefined,
    trailing: row.amount_received,
  };
}

export function mapSalesShipmentRowToSplitFeed(row: SalesShipmentRow): DocumentSplitFeedRow {
  return {
    id: row.id,
    code: row.tracking_number,
    title: row.customer_name,
    meta: joinMeta([row.sales_order_voucher, row.origin_location_name]),
    trailing: shippingCarrierLabel(row.carrier_provider),
  };
}

export function mapTaxCodeRowToSplitFeed(row: TaxCodeRow): DocumentSplitFeedRow {
  return {
    id: row.id,
    code: row.code,
    title: row.name,
    meta: taxCodeKindLabel(row.kind),
    trailing: row.is_active ? "Active" : "Inactive",
    inactive: !row.is_active,
  };
}

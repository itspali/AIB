export const PROCUREMENT_HREF = "/procurement";
export const PROCUREMENT_PO_HREF = "/procurement/purchase-orders";
export const PROCUREMENT_GRN_HREF = "/procurement/goods-receipts";
export const PROCUREMENT_QC_INSPECTION_HREF = "/procurement/quality-inspection";
export const PROCUREMENT_BILLS_HREF = "/procurement/bills";
export const PROCUREMENT_GIT_HREF = "/procurement/goods-in-transit";
export const PROCUREMENT_SHIPMENTS_HREF = "/procurement/shipments";
export const PROCUREMENT_SUBCONTRACT_HREF = "/procurement/subcontract";
export const INVENTORY_STOCK_HREF = "/inventory/stock";
export const SETTINGS_LOCATIONS_HREF = "/settings/locations";

export const GRN_DRAWER_PO_PARAM = "po";
export const IMPORT_SHIPMENT_DRAWER_PO_PARAM = "po";
export const BILL_DRAWER_PO_PARAM = "po";
export const PO_COPY_FROM_PARAM = "copyFrom";
export const PO_STATUS_FILTER_PARAM = "status";
export const BILL_MATCH_STATUS_FILTER_PARAM = "matchStatus";
export const BILL_PAID_FILTER_PARAM = "paid";

export function poPendingApprovalListHref(): string {
  const params = new URLSearchParams({ [PO_STATUS_FILTER_PARAM]: "PENDING_APPROVAL" });
  return `${PROCUREMENT_PO_HREF}?${params.toString()}`;
}

export function poDuplicateCreateHref(sourcePurchaseOrderId: string): string {
  const params = new URLSearchParams({
    action: "new",
    [PO_COPY_FROM_PARAM]: sourcePurchaseOrderId,
  });
  return `${PROCUREMENT_PO_HREF}?${params.toString()}`;
}

export function poFullPageCreateHref(options?: { copyFrom?: string | null }): string {
  const copyFrom = options?.copyFrom?.trim();
  if (!copyFrom) return `${PROCUREMENT_PO_HREF}/new`;
  const params = new URLSearchParams({ [PO_COPY_FROM_PARAM]: copyFrom });
  return `${PROCUREMENT_PO_HREF}/new?${params.toString()}`;
}

export function poFullPageEditHref(purchaseOrderId: string): string {
  return `${PROCUREMENT_PO_HREF}/${purchaseOrderId}/edit`;
}

export function poListReturnHref(purchaseOrderId?: string | null): string {
  if (!purchaseOrderId) return PROCUREMENT_PO_HREF;
  return `${PROCUREMENT_PO_HREF}?id=${encodeURIComponent(purchaseOrderId)}`;
}

export function importShipmentCreateFromPoHref(purchaseOrderId: string): string {
  const params = new URLSearchParams({
    action: "new",
    [IMPORT_SHIPMENT_DRAWER_PO_PARAM]: purchaseOrderId,
  });
  return `${PROCUREMENT_SHIPMENTS_HREF}?${params.toString()}`;
}

export function billCreateFromPoHref(purchaseOrderId: string): string {
  const params = new URLSearchParams({
    action: "new",
    [BILL_DRAWER_PO_PARAM]: purchaseOrderId,
  });
  return `${PROCUREMENT_BILLS_HREF}?${params.toString()}`;
}

export function billListReturnHref(billId?: string | null): string {
  if (!billId) return PROCUREMENT_BILLS_HREF;
  return `${PROCUREMENT_BILLS_HREF}?id=${encodeURIComponent(billId)}`;
}

export function billPpvHoldListHref(): string {
  const params = new URLSearchParams({ [BILL_MATCH_STATUS_FILTER_PARAM]: "PPV_HOLD" });
  return `${PROCUREMENT_BILLS_HREF}?${params.toString()}`;
}

export function billUnpaidListHref(): string {
  const params = new URLSearchParams({ [BILL_PAID_FILTER_PARAM]: "unpaid" });
  return `${PROCUREMENT_BILLS_HREF}?${params.toString()}`;
}

export const PROCUREMENT_HREF = "/procurement";
export const PROCUREMENT_PO_HREF = "/procurement/purchase-orders";
export const PROCUREMENT_GRN_HREF = "/procurement/goods-receipts";
export const PROCUREMENT_GIT_HREF = "/procurement/goods-in-transit";
export const SETTINGS_LOCATIONS_HREF = "/settings/locations";

export const GRN_DRAWER_PO_PARAM = "po";
export const PO_COPY_FROM_PARAM = "copyFrom";

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

export const SALES_HREF = "/sales";
export const SALES_ORDERS_HREF = "/sales/orders";
export const SALES_QUOTES_HREF = "/sales/quotes";
export const SALES_INVOICES_HREF = "/sales/invoices";
export const SALES_PAYMENTS_HREF = "/sales/payments";
export const SETTINGS_LOCATIONS_HREF = "/settings/locations";

export const SO_DRAWER_QUOTE_PARAM = "quote";
export const INVOICE_DRAWER_SO_PARAM = "so";
export const INVOICE_DRAWER_QUOTE_PARAM = "quote";
export const SO_COPY_FROM_PARAM = "copyFrom";
export const SO_STATUS_FILTER_PARAM = "status";
export const QUOTE_STATUS_FILTER_PARAM = "status";
export const INVOICE_STATUS_FILTER_PARAM = "status";
export const INVOICE_DRAWER_PAYMENT_PARAM = "payment";

export function soPendingApprovalListHref(): string {
  const params = new URLSearchParams({ [SO_STATUS_FILTER_PARAM]: "PENDING_APPROVAL" });
  return `${SALES_ORDERS_HREF}?${params.toString()}`;
}

export function soDuplicateCreateHref(sourceSalesOrderId: string): string {
  const params = new URLSearchParams({
    action: "new",
    [SO_COPY_FROM_PARAM]: sourceSalesOrderId,
  });
  return `${SALES_ORDERS_HREF}?${params.toString()}`;
}

export function soFullPageCreateHref(options?: { copyFrom?: string | null }): string {
  const copyFrom = options?.copyFrom?.trim();
  if (!copyFrom) return `${SALES_ORDERS_HREF}/new`;
  const params = new URLSearchParams({ [SO_COPY_FROM_PARAM]: copyFrom });
  return `${SALES_ORDERS_HREF}/new?${params.toString()}`;
}

export function soFullPageEditHref(salesOrderId: string): string {
  return `${SALES_ORDERS_HREF}/${salesOrderId}/edit`;
}

export function soListReturnHref(salesOrderId?: string | null): string {
  if (!salesOrderId) return SALES_ORDERS_HREF;
  return `${SALES_ORDERS_HREF}?id=${encodeURIComponent(salesOrderId)}`;
}

export function soCreateFromQuoteHref(quotationId: string): string {
  const params = new URLSearchParams({
    action: "new",
    [SO_DRAWER_QUOTE_PARAM]: quotationId,
  });
  return `${SALES_ORDERS_HREF}?${params.toString()}`;
}

export function invoiceCreateFromSoHref(salesOrderId: string): string {
  const params = new URLSearchParams({
    action: "new",
    [INVOICE_DRAWER_SO_PARAM]: salesOrderId,
  });
  return `${SALES_INVOICES_HREF}?${params.toString()}`;
}

export function invoiceCreateFromQuoteHref(quotationId: string): string {
  const params = new URLSearchParams({
    action: "new",
    [INVOICE_DRAWER_QUOTE_PARAM]: quotationId,
  });
  return `${SALES_INVOICES_HREF}?${params.toString()}`;
}

export function invoiceListReturnHref(invoiceId?: string | null): string {
  if (!invoiceId) return SALES_INVOICES_HREF;
  return `${SALES_INVOICES_HREF}?id=${encodeURIComponent(invoiceId)}`;
}

export function quoteListReturnHref(quotationId?: string | null): string {
  if (!quotationId) return SALES_QUOTES_HREF;
  return `${SALES_QUOTES_HREF}?id=${encodeURIComponent(quotationId)}`;
}

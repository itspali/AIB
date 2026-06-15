import { redirect } from "next/navigation";
import { SoDocumentPageShell } from "@/components/sales/orders/so-document-page-shell";
import {
  filterProcurementLocationsByScope,
  preferredPurchaseOrderDestinationId,
} from "@/lib/procurement/location-scope";
import { SO_COPY_FROM_PARAM } from "@/lib/sales/navigation";
import { resolveSalesOrderEditAccess } from "@/lib/sales/access";
import { fetchSalesSettings } from "@/lib/sales/settings";
import {
  fetchSalesCustomers,
  fetchSalesLocations,
} from "@/lib/sales/shared/queries";
import { fetchActivePoLineTaxCodeOptions } from "@/lib/tax/queries";
import { getModulePageContext } from "@/lib/layout/module-page";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

async function loadSoDocumentPageContext() {
  const { supabase, tenantId, userId } = await getModulePageContext();

  const [locations, customers, editAccess, salesSettings, tenantRow, taxCodeOptions] =
    await Promise.all([
      fetchSalesLocations(supabase, tenantId),
      fetchSalesCustomers(supabase, tenantId),
      resolveSalesOrderEditAccess(supabase, userId, tenantId),
      fetchSalesSettings(supabase, tenantId),
      supabase
        .from("tenants")
        .select("base_currency, billing_country_code")
        .eq("id", tenantId)
        .maybeSingle(),
      fetchActivePoLineTaxCodeOptions(supabase, tenantId),
    ]);

  const scopedLocations = filterProcurementLocationsByScope(locations, editAccess.locationScope);
  const defaultCurrency = (tenantRow.data?.base_currency as string | undefined) ?? "USD";
  const tenantCountry = (tenantRow.data?.billing_country_code as string | undefined) ?? null;
  const preferredShippingLocationId = preferredPurchaseOrderDestinationId(
    scopedLocations,
    editAccess.locationScope
  );

  return {
    locations: scopedLocations,
    customers,
    editAccessGranted: editAccess.granted,
    allowLineItemDiscounts: salesSettings.allow_line_item_discounts,
    allowTransactionDiscounts: salesSettings.allow_transaction_discounts,
    defaultCurrency,
    taxCodeOptions,
    tenantCountry,
    preferredShippingLocationId: preferredShippingLocationId ?? null,
  };
}

export async function SoDocumentCreateLoader({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const context = await loadSoDocumentPageContext();

  if (!context.editAccessGranted) {
    redirect("/sales/orders");
  }

  const copyFromRaw = params[SO_COPY_FROM_PARAM];
  const copyFromId =
    typeof copyFromRaw === "string"
      ? copyFromRaw.trim() || null
      : Array.isArray(copyFromRaw)
        ? copyFromRaw[0]?.trim() || null
        : null;

  return (
    <SoDocumentPageShell
      mode="create"
      copyFromId={copyFromId}
      locations={context.locations}
      customers={context.customers}
      editAccessGranted={context.editAccessGranted}
      allowLineItemDiscounts={context.allowLineItemDiscounts}
      allowTransactionDiscounts={context.allowTransactionDiscounts}
      defaultCurrency={context.defaultCurrency}
      taxCodeOptions={context.taxCodeOptions}
      tenantCountry={context.tenantCountry}
      preferredShippingLocationId={context.preferredShippingLocationId}
    />
  );
}

export async function SoDocumentEditLoader({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const context = await loadSoDocumentPageContext();

  if (!context.editAccessGranted) {
    redirect("/sales/orders");
  }

  return (
    <SoDocumentPageShell
      mode="edit"
      editOrderId={id}
      locations={context.locations}
      customers={context.customers}
      editAccessGranted={context.editAccessGranted}
      allowLineItemDiscounts={context.allowLineItemDiscounts}
      allowTransactionDiscounts={context.allowTransactionDiscounts}
      defaultCurrency={context.defaultCurrency}
      taxCodeOptions={context.taxCodeOptions}
      tenantCountry={context.tenantCountry}
      preferredShippingLocationId={context.preferredShippingLocationId}
    />
  );
}

import { redirect } from "next/navigation";
import { PoDocumentPageShell } from "@/components/procurement/purchase-orders/po-document-page-shell";
import { resolveEffectiveDocumentLayout } from "@/lib/documents/resolve-effective-document-layout";
import { resolvePurchaseOrderEditAccess } from "@/lib/procurement/access";
import {
  filterProcurementLocationsByScope,
  preferredPurchaseOrderDestinationId,
} from "@/lib/procurement/location-scope";
import { PO_COPY_FROM_PARAM } from "@/lib/procurement/navigation";
import { fetchProcurementSettings } from "@/lib/procurement/settings";
import { resolvePoAutoRoundOffPolicy } from "@/lib/procurement/purchase-orders/po-auto-round-off";
import { mapOrganizationBillToSnapshot } from "@/lib/procurement/purchase-orders/organization-bill-to";
import {
  fetchProcurementLocations,
  fetchProcurementSuppliers,
} from "@/lib/procurement/shared/queries";
import { getModulePageContext } from "@/lib/layout/module-page";
import { fetchActivePoLineTaxCodeOptions } from "@/lib/tax/queries";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

async function loadPoDocumentPageContext() {
  const { supabase, tenantId, userId } = await getModulePageContext();

  const [locations, suppliers, editAccess, procurementSettings, tenantRow, documentLayout, taxCodeOptions] =
    await Promise.all([
      fetchProcurementLocations(supabase, tenantId),
      fetchProcurementSuppliers(supabase, tenantId),
      resolvePurchaseOrderEditAccess(supabase, userId, tenantId),
      fetchProcurementSettings(supabase, tenantId),
      supabase
        .from("tenants")
        .select(
          "base_currency, name, legal_name, trade_name, tax_identifier, billing_address_line1, billing_address_line2, billing_city, billing_state, billing_zip_postal, billing_country_code"
        )
        .eq("id", tenantId)
        .maybeSingle(),
      resolveEffectiveDocumentLayout({
        supabase,
        tenantId,
        moduleKey: "PURCHASE_ORDER",
        viewContext: "SCREEN_GRID",
      }),
      fetchActivePoLineTaxCodeOptions(supabase, tenantId),
    ]);

  const scopedLocations = filterProcurementLocationsByScope(locations, editAccess.locationScope);
  const defaultCurrency = (tenantRow.data?.base_currency as string | undefined) ?? "USD";
  const organizationBillTo = mapOrganizationBillToSnapshot(tenantRow.data ?? {});
  const preferredDestinationLocationId = preferredPurchaseOrderDestinationId(
    scopedLocations,
    editAccess.locationScope
  );

  return {
    locations: scopedLocations,
    suppliers,
    editAccessGranted: editAccess.granted,
    allowEditIssuedPurchaseOrders: procurementSettings.allow_edit_issued_purchase_orders,
    allowLineItemDiscounts: procurementSettings.allow_line_item_discounts,
    allowTransactionDiscounts: procurementSettings.allow_transaction_discounts,
    enableMrpTradeTerms: procurementSettings.po_mrp_trade_terms_enabled,
    autoRoundOffPolicy: resolvePoAutoRoundOffPolicy(procurementSettings),
    defaultPricesTaxInclusive: procurementSettings.purchase_prices_tax_inclusive,
    defaultCurrency,
    documentLayout,
    preferredDestinationLocationId: preferredDestinationLocationId ?? null,
    organizationBillTo,
    taxCodeOptions,
  };
}

export async function PoDocumentCreateLoader({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const context = await loadPoDocumentPageContext();

  if (!context.editAccessGranted) {
    redirect("/procurement/purchase-orders");
  }

  const copyFromRaw = params[PO_COPY_FROM_PARAM];
  const copyFromId =
    typeof copyFromRaw === "string"
      ? copyFromRaw.trim() || null
      : Array.isArray(copyFromRaw)
        ? copyFromRaw[0]?.trim() || null
        : null;

  return (
    <PoDocumentPageShell
      mode="create"
      copyFromId={copyFromId}
      locations={context.locations}
      suppliers={context.suppliers}
      editAccessGranted={context.editAccessGranted}
      allowEditIssuedPurchaseOrders={context.allowEditIssuedPurchaseOrders}
      allowLineItemDiscounts={context.allowLineItemDiscounts}
      allowTransactionDiscounts={context.allowTransactionDiscounts}
      enableMrpTradeTerms={context.enableMrpTradeTerms}
      autoRoundOffPolicy={context.autoRoundOffPolicy}
      defaultPricesTaxInclusive={context.defaultPricesTaxInclusive}
      defaultCurrency={context.defaultCurrency}
      documentLayout={context.documentLayout}
      preferredDestinationLocationId={context.preferredDestinationLocationId}
      organizationBillTo={context.organizationBillTo}
      taxCodeOptions={context.taxCodeOptions}
    />
  );
}

export async function PoDocumentEditLoader({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const context = await loadPoDocumentPageContext();

  if (!context.editAccessGranted) {
    redirect("/procurement/purchase-orders");
  }

  return (
    <PoDocumentPageShell
      mode="edit"
      editOrderId={id}
      locations={context.locations}
      suppliers={context.suppliers}
      editAccessGranted={context.editAccessGranted}
      allowEditIssuedPurchaseOrders={context.allowEditIssuedPurchaseOrders}
      allowLineItemDiscounts={context.allowLineItemDiscounts}
      allowTransactionDiscounts={context.allowTransactionDiscounts}
      enableMrpTradeTerms={context.enableMrpTradeTerms}
      autoRoundOffPolicy={context.autoRoundOffPolicy}
      defaultPricesTaxInclusive={context.defaultPricesTaxInclusive}
      defaultCurrency={context.defaultCurrency}
      documentLayout={context.documentLayout}
      preferredDestinationLocationId={context.preferredDestinationLocationId}
      organizationBillTo={context.organizationBillTo}
      taxCodeOptions={context.taxCodeOptions}
    />
  );
}

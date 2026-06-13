import { StockManagementTerminal } from "@/components/inventory/stock/stock-management-terminal";
import {
  fetchStockAdjustments,
  fetchStockBalances,
  fetchStockLocations,
} from "@/lib/inventory/stock/queries";
import { fetchPromoInventoryBalances } from "@/lib/inventory/stock/promo-balances";
import { fetchPromotionalReclassificationBatches } from "@/lib/procurement/promo/reclassification";
import { getModulePageContext } from "@/lib/layout/module-page";

export async function StockCatalogLoader() {
  const { supabase, tenantId } = await getModulePageContext();

  const [locations, balances, adjustments, promoBalances, draftBatches] = await Promise.all([
    fetchStockLocations(supabase, tenantId),
    fetchStockBalances(supabase, tenantId),
    fetchStockAdjustments(supabase, tenantId),
    fetchPromoInventoryBalances(supabase, tenantId),
    fetchPromotionalReclassificationBatches(supabase, tenantId, { status: "DRAFT" }),
  ]);

  return (
    <StockManagementTerminal
      initialBalances={balances}
      initialAdjustments={adjustments}
      initialPromoBalances={promoBalances}
      initialDraftBatches={draftBatches}
      locations={locations}
    />
  );
}

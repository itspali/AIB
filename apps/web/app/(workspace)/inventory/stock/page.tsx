import { Suspense } from "react";
import { StockCatalogLoader } from "@/components/inventory/stock/stock-catalog-loader";
import { StockCatalogPageSkeleton } from "@/components/inventory/stock/stock-catalog-page-skeleton";

/** Drawer `id` is client-only (history.pushState) — omit from searchParams so row clicks do not refetch this RSC. */
export default function InventoryStockPage() {
  return (
    <Suspense fallback={<StockCatalogPageSkeleton />}>
      <StockCatalogLoader />
    </Suspense>
  );
}

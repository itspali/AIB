import { Suspense } from "react";
import { GrnCatalogLoader } from "@/components/procurement/goods-receipts/grn-catalog-loader";
import { GrnCatalogPageSkeleton } from "@/components/procurement/goods-receipts/grn-catalog-page-skeleton";

/** Drawer `id` is client-only (history.pushState) — omit from searchParams so row clicks do not refetch this RSC. */
export default function ProcurementGoodsReceiptsPage() {
  return (
    <Suspense fallback={<GrnCatalogPageSkeleton />}>
      <GrnCatalogLoader />
    </Suspense>
  );
}

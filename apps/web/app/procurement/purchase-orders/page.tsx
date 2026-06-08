import { Suspense } from "react";
import { PoCatalogLoader } from "@/components/procurement/purchase-orders/po-catalog-loader";
import { PoCatalogPageSkeleton } from "@/components/procurement/purchase-orders/po-catalog-page-skeleton";

/** Drawer `id` is client-only (history.pushState) — omit from searchParams so row clicks do not refetch this RSC. */
export default function ProcurementPurchaseOrdersPage() {
  return (
    <Suspense fallback={<PoCatalogPageSkeleton />}>
      <PoCatalogLoader />
    </Suspense>
  );
}

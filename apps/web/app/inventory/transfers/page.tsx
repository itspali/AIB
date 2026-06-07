import { Suspense } from "react";
import { TransferCatalogLoader } from "@/components/inventory/transfers/transfer-catalog-loader";
import { TransferCatalogPageSkeleton } from "@/components/inventory/transfers/transfer-catalog-page-skeleton";

/** Drawer `id` is client-only (history.pushState) — omit from searchParams so row clicks do not refetch this RSC. */
export default function InventoryTransfersPage() {
  return (
    <Suspense fallback={<TransferCatalogPageSkeleton />}>
      <TransferCatalogLoader />
    </Suspense>
  );
}

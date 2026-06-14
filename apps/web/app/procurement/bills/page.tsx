import { Suspense } from "react";
import { BillCatalogLoader } from "@/components/procurement/bills/bill-catalog-loader";
import { BillCatalogPageSkeleton } from "@/components/procurement/bills/bill-catalog-page-skeleton";

/** Drawer `id` is client-only (history.pushState) — omit from searchParams so row clicks do not refetch this RSC. */
export default function ProcurementBillsPage() {
  return (
    <Suspense fallback={<BillCatalogPageSkeleton />}>
      <BillCatalogLoader />
    </Suspense>
  );
}

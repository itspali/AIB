import { Suspense } from "react";
import { SoCatalogLoader } from "@/components/sales/orders/so-catalog-loader";
import { SoCatalogPageSkeleton } from "@/components/sales/orders/so-catalog-page-skeleton";

/** Drawer `id` is client-only (history.pushState) — omit from searchParams so row clicks do not refetch this RSC. */
export default function SalesOrdersPage() {
  return (
    <Suspense fallback={<SoCatalogPageSkeleton />}>
      <SoCatalogLoader />
    </Suspense>
  );
}

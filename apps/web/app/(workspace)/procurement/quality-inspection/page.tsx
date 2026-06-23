import { Suspense } from "react";
import { QcInspectionCatalogLoader } from "@/components/procurement/quality-inspection/qc-inspection-catalog-loader";
import { QcInspectionCatalogPageSkeleton } from "@/components/procurement/quality-inspection/qc-inspection-catalog-page-skeleton";

/** Drawer `id` is client-only (history.pushState) — omit from searchParams so row clicks do not refetch this RSC. */
export default function ProcurementQualityInspectionPage() {
  return (
    <Suspense fallback={<QcInspectionCatalogPageSkeleton />}>
      <QcInspectionCatalogLoader />
    </Suspense>
  );
}

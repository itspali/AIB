import { Suspense } from "react";
import { PoDocumentCreateLoader } from "@/components/procurement/purchase-orders/po-document-page-loader";
import { PoCatalogPageSkeleton } from "@/components/procurement/purchase-orders/po-catalog-page-skeleton";

export default function NewPurchaseOrderPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <Suspense fallback={<PoCatalogPageSkeleton />}>
      <PoDocumentCreateLoader searchParams={searchParams} />
    </Suspense>
  );
}

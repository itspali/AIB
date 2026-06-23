import { Suspense } from "react";
import { PoDocumentEditLoader } from "@/components/procurement/purchase-orders/po-document-page-loader";
import { PoCatalogPageSkeleton } from "@/components/procurement/purchase-orders/po-catalog-page-skeleton";

export default function EditPurchaseOrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense fallback={<PoCatalogPageSkeleton />}>
      <PoDocumentEditLoader params={params} />
    </Suspense>
  );
}

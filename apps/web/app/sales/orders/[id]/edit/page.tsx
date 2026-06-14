import { Suspense } from "react";
import { SoDocumentEditLoader } from "@/components/sales/orders/so-document-page-loader";
import { SoCatalogPageSkeleton } from "@/components/sales/orders/so-catalog-page-skeleton";

export default function EditSalesOrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense fallback={<SoCatalogPageSkeleton />}>
      <SoDocumentEditLoader params={params} />
    </Suspense>
  );
}

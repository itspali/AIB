import { Suspense } from "react";
import { SoDocumentCreateLoader } from "@/components/sales/orders/so-document-page-loader";
import { SoCatalogPageSkeleton } from "@/components/sales/orders/so-catalog-page-skeleton";

export default function NewSalesOrderPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <Suspense fallback={<SoCatalogPageSkeleton />}>
      <SoDocumentCreateLoader searchParams={searchParams} />
    </Suspense>
  );
}

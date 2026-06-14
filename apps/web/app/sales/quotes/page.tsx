import { Suspense } from "react";
import { QuoteCatalogLoader } from "@/components/sales/quotes/quote-catalog-loader";
import { QuoteCatalogPageSkeleton } from "@/components/sales/quotes/quote-catalog-page-skeleton";

export default function SalesQuotesPage() {
  return (
    <Suspense fallback={<QuoteCatalogPageSkeleton />}>
      <QuoteCatalogLoader />
    </Suspense>
  );
}

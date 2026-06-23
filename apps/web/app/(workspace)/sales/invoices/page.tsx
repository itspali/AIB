import { Suspense } from "react";
import { InvoiceCatalogLoader } from "@/components/sales/invoices/invoice-catalog-loader";
import { InvoiceCatalogPageSkeleton } from "@/components/sales/invoices/invoice-catalog-page-skeleton";

export default function SalesInvoicesPage() {
  return (
    <Suspense fallback={<InvoiceCatalogPageSkeleton />}>
      <InvoiceCatalogLoader />
    </Suspense>
  );
}

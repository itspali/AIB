import { Suspense } from "react";
import { PaymentCatalogLoader } from "@/components/sales/payments/payment-catalog-loader";
import { InvoiceCatalogPageSkeleton } from "@/components/sales/invoices/invoice-catalog-page-skeleton";

export default function SalesPaymentsPage() {
  return (
    <Suspense fallback={<InvoiceCatalogPageSkeleton />}>
      <PaymentCatalogLoader />
    </Suspense>
  );
}

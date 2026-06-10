import { Suspense } from "react";
import { BillCatalogLoader } from "@/components/procurement/bills/bill-catalog-loader";

export default function ProcurementBillsPage() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-muted-foreground">Loading bills…</p>}>
      <BillCatalogLoader />
    </Suspense>
  );
}

import { Suspense } from "react";
import { FulfillmentShippingCatalogLoader } from "@/components/fulfillment/shipping/fulfillment-shipping-catalog-loader";
import { FulfillmentShippingCatalogPageSkeleton } from "@/components/fulfillment/shipping/fulfillment-shipping-catalog-page-skeleton";

export default function FulfillmentShippingPage() {
  return (
    <Suspense fallback={<FulfillmentShippingCatalogPageSkeleton />}>
      <FulfillmentShippingCatalogLoader />
    </Suspense>
  );
}

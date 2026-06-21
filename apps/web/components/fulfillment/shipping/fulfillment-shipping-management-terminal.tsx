"use client";

import { useCallback, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { loadSalesShipments } from "@/app/fulfillment/shipping/actions";
import { FulfillmentShippingListTable } from "@/components/fulfillment/shipping/fulfillment-shipping-list-table";
import { ListModulePageTitleHeader } from "@/components/layout/list-module-page-title-header";
import { ListModuleShell } from "@/components/layout/list-module-shell";
import { lazyClientExport } from "@/lib/lazy/lazy-client-export";
import {
  FULFILLMENT_SHIPPING_HREF,
  SHIPMENT_DRAWER_SO_PARAM,
} from "@/lib/fulfillment/shipping/navigation";
import type { SalesShipmentRow } from "@/lib/fulfillment/shipping/types";
import { useModuleDrawerUrl } from "@/lib/layout/use-module-drawer-url";

const PAGE_DESCRIPTION =
  "Post customer shipments against confirmed sales orders and move reserved stock out of inventory.";

const FulfillmentShippingDrawerForm = lazyClientExport(
  () => import("@/components/fulfillment/shipping/fulfillment-shipping-drawer-form"),
  "FulfillmentShippingDrawerForm"
);

type Props = {
  initialShipments: SalesShipmentRow[];
};

export function FulfillmentShippingManagementTerminal({ initialShipments }: Props) {
  const searchParams = useSearchParams();
  const drawer = useModuleDrawerUrl(FULFILLMENT_SHIPPING_HREF, {
    clearParamsOnClose: [SHIPMENT_DRAWER_SO_PARAM],
  });
  const [shipments, setShipments] = useState(initialShipments);
  const [, startRefresh] = useTransition();

  const prefillSalesOrderId = searchParams.get(SHIPMENT_DRAWER_SO_PARAM);

  const refreshShipments = useCallback(() => {
    startRefresh(async () => {
      const rows = await loadSalesShipments();
      setShipments(rows);
    });
  }, []);

  const handleAfterPost = useCallback(
    (shipmentId: string) => {
      refreshShipments();
      drawer.openPeek(shipmentId);
    },
    [drawer, refreshShipments]
  );

  return (
    <>
      <ListModuleShell
        title={
          <ListModulePageTitleHeader
            title="Fulfillment & Shipping"
            description={PAGE_DESCRIPTION}
            createLabel="New shipment"
            onCreate={() => drawer.openCreate()}
            aboutAriaLabel="About Fulfillment and Shipping"
          />
        }
      >
        <div className="flex h-full min-h-0 min-w-0 flex-1 basis-0 flex-col overflow-hidden">
          <FulfillmentShippingListTable
            shipments={shipments}
            selectedId={drawer.recordId}
            onSelect={drawer.openPeek}
          />
        </div>
      </ListModuleShell>

      {drawer.isOpen ? (
        <FulfillmentShippingDrawerForm
          open={drawer.isOpen}
          surface={drawer.surface === "create" ? "create" : "peek"}
          shipmentId={drawer.surface === "peek" ? drawer.recordId : null}
          prefillSalesOrderId={drawer.surface === "create" ? prefillSalesOrderId : null}
          onClose={drawer.close}
          onAfterPost={handleAfterPost}
        />
      ) : null}
    </>
  );
}

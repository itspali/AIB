"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { loadSalesShipments } from "@/app/fulfillment/shipping/actions";
import { FulfillmentShippingDrawerForm } from "@/components/fulfillment/shipping/fulfillment-shipping-drawer-form";
import { FulfillmentShippingListTable } from "@/components/fulfillment/shipping/fulfillment-shipping-list-table";
import { ListModulePageTitleHeader } from "@/components/layout/list-module-page-title-header";
import { ListModuleShell } from "@/components/layout/list-module-shell";
import {
  FULFILLMENT_SHIPPING_HREF,
  SHIPMENT_DRAWER_SO_PARAM,
} from "@/lib/fulfillment/shipping/navigation";
import type { SalesShipmentRow } from "@/lib/fulfillment/shipping/types";
import { useModuleDrawerUrl } from "@/lib/layout/use-module-drawer-url";

const PAGE_DESCRIPTION =
  "Post customer shipments against confirmed sales orders and move reserved stock out of inventory.";

type Props = {
  initialShipments: SalesShipmentRow[];
};

export function FulfillmentShippingManagementTerminal({ initialShipments }: Props) {
  const searchParams = useSearchParams();
  const drawer = useModuleDrawerUrl(FULFILLMENT_SHIPPING_HREF);
  const [shipments, setShipments] = useState(initialShipments);
  const [, startRefresh] = useTransition();

  const prefillSalesOrderId = searchParams.get(SHIPMENT_DRAWER_SO_PARAM);

  useEffect(() => {
    if (searchParams.get("action") === "new" && prefillSalesOrderId) {
      drawer.openCreate();
    }
  }, [drawer, prefillSalesOrderId, searchParams]);

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

      <FulfillmentShippingDrawerForm
        open={drawer.isOpen}
        surface={drawer.surface === "create" ? "create" : "peek"}
        shipmentId={drawer.surface === "peek" ? drawer.recordId : null}
        prefillSalesOrderId={drawer.surface === "create" ? prefillSalesOrderId : null}
        onClose={drawer.close}
        onAfterPost={handleAfterPost}
      />
    </>
  );
}

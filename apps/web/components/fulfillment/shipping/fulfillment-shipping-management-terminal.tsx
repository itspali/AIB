"use client";

import { useCallback, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { loadSalesShipments } from "@/app/fulfillment/shipping/actions";
import { FulfillmentShippingListTable } from "@/components/fulfillment/shipping/fulfillment-shipping-list-table";
import { UnifiedCatalogHeader } from "@/components/layout/unified-catalog-header";
import { ListWorkspaceLayoutToggleControl } from "@/components/layout/list-workspace-layout-toggle-control";
import { ListModuleShell } from "@/components/layout/list-module-shell";
import {
  ListWorkspaceCatalogBody,
  ListWorkspaceModuleFrame,
  useListWorkspaceCatalogLayout,
} from "@/components/layout/list-workspace-catalog-module";
import { lazyClientExport } from "@/lib/lazy/lazy-client-export";
import {
  FULFILLMENT_SHIPPING_HREF,
  SHIPMENT_DRAWER_SO_PARAM,
} from "@/lib/fulfillment/shipping/navigation";
import type { SalesShipmentRow } from "@/lib/fulfillment/shipping/types";
import { useModuleDrawerUrl } from "@/lib/layout/use-module-drawer-url";
import {
  buildCatalogSplitListPane,
  mapSalesShipmentRowToSplitFeed,
  useListWorkspaceFeedFilter,
} from "@/lib/layout/list-workspace";

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

  const peekOpen = drawer.isOpen && drawer.surface === "peek";
  const { layout } = useListWorkspaceCatalogLayout();

  const { feedFilteredRows, feedFilterProps } = useListWorkspaceFeedFilter({
    rows: shipments,
    extractSearchable: (row) => [
      row.tracking_number,
      row.sales_order_voucher,
      row.customer_name,
      row.origin_location_name,
      row.origin_location_code,
      row.carrier_provider,
    ],
  });

  const listPrimary = (
    <FulfillmentShippingListTable
      shipments={feedFilteredRows}
      selectedId={drawer.recordId}
      onSelect={drawer.openPeek}
    />
  );

  const splitListPrimary = buildCatalogSplitListPane({
    rows: feedFilteredRows,
    selectedId: drawer.recordId,
    onSelect: drawer.openPeek,
    mapRow: mapSalesShipmentRowToSplitFeed,
    hasAnyData: shipments.length > 0,
    emptyMessage: "No shipments match the current filters.",
  });

  return (
    <ListWorkspaceModuleFrame peekOpen={peekOpen}>
      <>
      <ListModuleShell
        surface="classic"
        className="list-module-shell-root"
        title={
          <UnifiedCatalogHeader
            title="Fulfillment & Shipping"
            count={shipments.length > 0 ? String(feedFilteredRows.length) : undefined}
            onNew={() => drawer.openCreate()}
            newAriaLabel="New shipment"
            layout={layout}
            feedFilter={feedFilterProps}
            controls={<ListWorkspaceLayoutToggleControl />}
          />
        }
      >
        <ListWorkspaceCatalogBody
          peekOpen={peekOpen}
          splitEmptyTitle="Select a shipment"
          splitEmptyMessage="Choose a row from the list to inspect details here."
          listContent={listPrimary}
          splitListContent={splitListPrimary}
        />
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
    </ListWorkspaceModuleFrame>
  );
}

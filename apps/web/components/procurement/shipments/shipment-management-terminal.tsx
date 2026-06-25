"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { loadImportShipments } from "@/app/(workspace)/procurement/shipments/actions";
import {
  ShipmentDrawerForm,
  ShipmentList,
} from "@/components/procurement/shipments/shipment-drawer-form";
import { UnifiedCatalogHeader } from "@/components/layout/unified-catalog-header";
import { ListWorkspaceLayoutToggleControl } from "@/components/layout/list-workspace-layout-toggle-control";
import { ListModuleShell } from "@/components/layout/list-module-shell";
import {
  ListWorkspaceCatalogBody,
  ListWorkspaceModuleFrame,
  useListWorkspaceCatalogLayout,
} from "@/components/layout/list-workspace-catalog-module";
import { useModuleDrawerUrl } from "@/lib/layout/use-module-drawer-url";
import {
  buildCatalogSplitListPane,
  mapImportShipmentRowToSplitFeed,
  useListWorkspaceFeedFilter,
} from "@/lib/layout/list-workspace";
import {
  IMPORT_SHIPMENT_DRAWER_PO_PARAM,
  PROCUREMENT_SHIPMENTS_HREF,
} from "@/lib/procurement/navigation";
import type { AllocatableImportPurchaseOrderOption, ImportShipmentRow } from "@/lib/procurement/shipments/types";
import type { ProcurementLocationOption, ProcurementSupplierOption } from "@/lib/procurement/shared/types";

type Props = {
  initialShipments: ImportShipmentRow[];
  suppliers: ProcurementSupplierOption[];
  locations: ProcurementLocationOption[];
  allocatableOrders: AllocatableImportPurchaseOrderOption[];
};

export function ShipmentManagementTerminal({
  initialShipments,
  suppliers,
  locations,
  allocatableOrders,
}: Props) {
  const searchParams = useSearchParams();
  const drawer = useModuleDrawerUrl(PROCUREMENT_SHIPMENTS_HREF, {
    clearParamsOnClose: [IMPORT_SHIPMENT_DRAWER_PO_PARAM],
  });
  const [shipments, setShipments] = useState(initialShipments);
  const [, startRefresh] = useTransition();

  const refresh = useCallback(() => {
    startRefresh(async () => {
      const next = await loadImportShipments();
      setShipments(next);
    });
  }, []);

  useEffect(() => {
    setShipments(initialShipments);
  }, [initialShipments]);

  const prefillPurchaseOrderId = useMemo(() => {
    if (drawer.surface !== "create") return null;
    return searchParams.get(IMPORT_SHIPMENT_DRAWER_PO_PARAM)?.trim() || null;
  }, [drawer.surface, searchParams]);

  const editingShipmentId =
    drawer.isOpen && drawer.surface === "peek" ? drawer.recordId : null;
  const peekOpen = drawer.isOpen && drawer.surface === "peek";
  const { layout } = useListWorkspaceCatalogLayout();

  const { feedFilteredRows, feedFilterProps } = useListWorkspaceFeedFilter({
    rows: shipments,
    extractSearchable: (row) => [
      row.shipment_number,
      row.supplier_name,
      row.forwarder_name,
      row.staging_location_name,
      row.ultimate_destination_location_name,
      row.bill_of_lading,
      row.awb,
      row.vessel_name,
      row.port_of_loading,
      row.port_of_discharge,
      row.bill_of_entry_number,
      row.port_code,
      row.notes,
      ...row.purchase_order_numbers,
      ...row.container_numbers,
    ],
  });

  const listPrimary = (
    <ShipmentList
      shipments={feedFilteredRows}
      onRefresh={refresh}
      onEdit={(shipmentId) => drawer.openPeek(shipmentId)}
    />
  );

  const splitListPrimary = buildCatalogSplitListPane({
    rows: feedFilteredRows,
    selectedId: editingShipmentId,
    onSelect: (shipmentId) => drawer.openPeek(shipmentId),
    mapRow: mapImportShipmentRowToSplitFeed,
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
            title="Import shipments"
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

      <ShipmentDrawerForm
        open={drawer.isOpen}
        onOpenChange={(open) => {
          if (!open) drawer.close();
        }}
        shipmentId={editingShipmentId}
        prefillPurchaseOrderId={prefillPurchaseOrderId}
        suppliers={suppliers}
        locations={locations}
        allocatableOrders={allocatableOrders}
        onSaved={refresh}
      />
      </>
    </ListWorkspaceModuleFrame>
  );
}

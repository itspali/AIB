"use client";

import { useCallback, useState, useTransition } from "react";
import { loadImportShipments } from "@/app/(workspace)/procurement/shipments/actions";
import {
  ShipmentDrawerForm,
  ShipmentList,
} from "@/components/procurement/shipments/shipment-drawer-form";
import { ListModulePageTitleHeader } from "@/components/layout/list-module-page-title-header";
import { ListModuleShell } from "@/components/layout/list-module-shell";
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
  const [shipments, setShipments] = useState(initialShipments);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingShipmentId, setEditingShipmentId] = useState<string | null>(null);
  const [, startRefresh] = useTransition();

  const refresh = useCallback(() => {
    startRefresh(async () => {
      const next = await loadImportShipments();
      setShipments(next);
    });
  }, []);

  const handleCreate = () => {
    setEditingShipmentId(null);
    setDrawerOpen(true);
  };

  const handleEdit = (shipmentId: string) => {
    setEditingShipmentId(shipmentId);
    setDrawerOpen(true);
  };

  return (
    <>
      <ListModuleShell
        title={
          <ListModulePageTitleHeader
            title="Import shipments"
            description="Plan overseas inbound shipments, allocate purchase order lines, and track logistics through staging, customs, and clearance."
            createLabel="New shipment"
            onCreate={handleCreate}
          />
        }
      >
        <ShipmentList shipments={shipments} onRefresh={refresh} onEdit={handleEdit} />
      </ListModuleShell>

      <ShipmentDrawerForm
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        shipmentId={editingShipmentId}
        suppliers={suppliers}
        locations={locations}
        allocatableOrders={allocatableOrders}
        onSaved={refresh}
      />
    </>
  );
}

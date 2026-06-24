import { ShipmentManagementTerminal } from "@/components/procurement/shipments/shipment-management-terminal";
import { loadShipmentCatalogContext } from "@/app/(workspace)/procurement/shipments/actions";

export default async function ProcurementShipmentsPage() {
  const { shipments, suppliers, locations, allocatableOrders } = await loadShipmentCatalogContext();

  return (
    <ShipmentManagementTerminal
      initialShipments={shipments}
      suppliers={suppliers}
      locations={locations}
      allocatableOrders={allocatableOrders}
    />
  );
}

export const IMPORT_SHIPMENT_STATUSES = [
  "DRAFT",
  "BOOKED",
  "IN_TRANSIT",
  "AT_STAGING",
  "CUSTOMS_PENDING",
  "CLEARED",
  "CLOSED",
  "CANCELLED",
] as const;

export type ImportShipmentStatus = (typeof IMPORT_SHIPMENT_STATUSES)[number];

const STATUS_LABELS: Record<ImportShipmentStatus, string> = {
  DRAFT: "Draft",
  BOOKED: "Booked",
  IN_TRANSIT: "In transit",
  AT_STAGING: "At staging",
  CUSTOMS_PENDING: "Customs pending",
  CLEARED: "Cleared",
  CLOSED: "Closed",
  CANCELLED: "Cancelled",
};

export function importShipmentStatusLabel(status: ImportShipmentStatus | string): string {
  return STATUS_LABELS[status as ImportShipmentStatus] ?? status;
}

export type ImportShipmentLineRow = {
  id: string;
  purchase_order_id: string;
  purchase_order_number: string;
  po_item_id: string;
  variant_id: string;
  item_id: string;
  item_name: string;
  variant_sku: string;
  quantity_shipped: string;
  quantity_received_staging: string;
  quantity_in_git: string;
  quantity_cleared: string;
};

export type ImportShipmentRow = {
  id: string;
  shipment_number: string;
  status: ImportShipmentStatus;
  supplier_id: string | null;
  supplier_name: string;
  forwarder_entity_id: string | null;
  forwarder_name: string | null;
  staging_location_id: string | null;
  staging_location_name: string | null;
  ultimate_destination_location_id: string | null;
  ultimate_destination_location_name: string | null;
  incoterms_code: string | null;
  bill_of_lading: string | null;
  container_numbers: string[];
  awb: string | null;
  vessel_name: string | null;
  port_of_loading: string | null;
  port_of_discharge: string | null;
  etd: string | null;
  eta: string | null;
  bill_of_entry_number: string | null;
  bill_of_entry_date: string | null;
  port_code: string | null;
  exchange_rate: string;
  assessable_value: string;
  customs_duty_amount: string;
  import_igst_amount: string;
  notes: string | null;
  line_count: number;
  purchase_order_numbers: string[];
  created_at: string;
  issued_at: string | null;
};

export type AllocatableImportPurchaseOrderOption = {
  id: string;
  voucher_number: string;
  supplier_id: string;
  supplier_name: string;
  destination_location_id: string;
  destination_location_name: string;
  lines: Array<{
    id: string;
    variant_id: string;
    item_id: string;
    item_name: string;
    variant_sku: string;
    open_quantity: string;
    unit_price_contractual: string;
    is_promotional: boolean;
  }>;
};

export type ImportShipmentLineDraft = {
  purchase_order_id: string;
  po_item_id: string;
  variant_id: string;
  quantity_shipped: string;
  label: string;
  purchase_order_number: string;
};

import type { ReactNode } from "react";
import { fieldHelpText } from "@/components/ui/field-label-info";

export const IMPORT_LOGISTICS_PO_LABELS = {
  fulfillmentStage: "When PO is fulfilled",
  firstReceivingLocation: "First receiving location (staging)",
  finalWarehouse: "Final warehouse",
} as const;

export const IMPORT_SHIPMENT_LABELS = {
  supplier: "Overseas supplier",
  customsAgent: "Customs agent (CHA)",
  firstReceivingLocation: "First receiving location (staging)",
  finalWarehouse: "Final warehouse",
  deliveryTerms: "Delivery terms (Incoterms)",
  transportMode: "Transport mode",
  billOfLading: "Bill of lading (B/L)",
  awb: "Air waybill (AWB)",
  vessel: "Vessel name",
  containers: "Container numbers",
  originPort: "Origin port",
  arrivalPort: "Arrival port",
  etd: "Departure date (ETD)",
  eta: "Arrival date (ETA)",
  boeSection: "Customs bill of entry (BoE)",
  boeNumber: "BoE number",
  boeDate: "BoE date",
  customsPortCode: "Customs port code",
  exchangeRate: "Customs exchange rate",
  assessableValue: "Assessable value (INR)",
  customsDuty: "Customs duty (INR)",
  importIgst: "Import IGST (INR)",
  poAllocation: "Link purchase order lines",
  importPo: "Import purchase order",
  notes: "Notes",
} as const;

export const IMPORT_SHIPMENT_HELP = {
  supplier: fieldHelpText(
    "The overseas vendor on the linked import purchase order(s). Must match the PO supplier."
  ),
  customsAgent: fieldHelpText(
    "Optional customs house agent (CHA) or forwarder handling clearance. Pick an existing supplier profile or create one."
  ),
  firstReceivingLocation: fieldHelpText(
    "Physical warehouse where goods first arrive in India — often your CHA or port warehouse. Commercial goods receipts post here."
  ),
  finalWarehouse: fieldHelpText(
    "Stock-holding location where goods should end up after customs and goods-in-transit clearance."
  ),
  deliveryTerms: fieldHelpText(
    "Incoterms from the supplier contract (e.g. FOB, CIF). Defaults from the supplier profile when available."
  ),
  transportMode: fieldHelpText(
    "Choose sea, air, or road. Sea shows bill of lading and vessel fields; air shows the air waybill field."
  ),
  billOfLading: fieldHelpText("Carrier bill of lading number for sea freight."),
  awb: fieldHelpText("Air waybill number — used for air shipments only."),
  vessel: fieldHelpText("Name of the vessel carrying the container(s)."),
  containers: fieldHelpText("One or more container numbers, separated by commas."),
  originPort: fieldHelpText("Foreign port where goods are loaded onto the vessel or aircraft."),
  arrivalPort: fieldHelpText("Indian port or ICD where the shipment is expected to arrive."),
  etd: fieldHelpText("Estimated date of departure from the origin port."),
  eta: fieldHelpText("Estimated date of arrival at the first receiving location."),
  boeSection: fieldHelpText(
    "Master customs filing for this shipment. Values copy to customs-stage goods receipts. Required before clearance when your import policy requires a bill of entry."
  ),
  boeNumber: fieldHelpText("Bill of entry number as filed with customs."),
  boeDate: fieldHelpText("Date on the bill of entry challan."),
  customsPortCode: fieldHelpText("Indian customs port code (ICEGATE), e.g. INNSA1 for Nhava Sheva."),
  exchangeRate: fieldHelpText("Exchange rate used by customs to convert invoice currency to INR."),
  assessableValue: fieldHelpText("Total assessable value in INR for duty calculation."),
  customsDuty: fieldHelpText("Basic and additional customs duty assessed on the shipment."),
  importIgst: fieldHelpText("Integrated GST assessed on the import."),
  poAllocation: fieldHelpText(
    "Select issued import purchase orders and quantities on this shipment. Partial shipments are supported."
  ),
  importPo: fieldHelpText(
    "Only issued import purchase orders with open quantity appear here. Use Add open lines to allocate items."
  ),
  notes: fieldHelpText("Internal notes for your logistics team."),
} as const;

export const IMPORT_LOGISTICS_PO_HELP = {
  fulfillmentStage: fieldHelpText(
    "Controls when the purchase order open quantity is consumed: at commercial receipt (port) or at final warehouse receipt."
  ),
  firstReceivingLocation: fieldHelpText(
    "Where the first commercial goods receipt should post stock. Leave as same as destination to use the PO destination."
  ),
  finalWarehouse: fieldHelpText(
    "Where goods should ultimately be stocked after import clearance. May differ from the first receiving location."
  ),
} as const;

export type ImportTransportMode = "SEA" | "AIR" | "ROAD";

export const IMPORT_TRANSPORT_MODE_OPTIONS: Array<{
  value: ImportTransportMode;
  label: string;
  help: ReactNode;
}> = [
  {
    value: "SEA",
    label: "Sea",
    help: fieldHelpText("Ocean freight — use bill of lading, vessel, and container fields."),
  },
  {
    value: "AIR",
    label: "Air",
    help: fieldHelpText("Air freight — use the air waybill (AWB) field."),
  },
  {
    value: "ROAD",
    label: "Road",
    help: fieldHelpText("Cross-border road — transport document fields are optional."),
  },
];

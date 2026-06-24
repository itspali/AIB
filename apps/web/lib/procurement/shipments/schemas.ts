import { z } from "zod";
import { IMPORT_SHIPMENT_STATUSES } from "@/lib/procurement/shipments/types";

const optionalUuid = z
  .string()
  .uuid()
  .optional()
  .nullable()
  .or(z.literal("").transform(() => null));

const optionalDate = z
  .string()
  .trim()
  .optional()
  .nullable()
  .or(z.literal("").transform(() => null));

const optionalDecimal = z.string().trim().optional().default("0");

export const saveImportShipmentSchema = z.object({
  shipment_id: optionalUuid,
  supplier_id: z.string().uuid(),
  forwarder_entity_id: optionalUuid,
  staging_location_id: optionalUuid,
  ultimate_destination_location_id: optionalUuid,
  incoterms_code: z.string().trim().optional().nullable(),
  bill_of_lading: z.string().trim().optional().nullable(),
  container_numbers: z.array(z.string().trim().min(1)).default([]),
  awb: z.string().trim().optional().nullable(),
  vessel_name: z.string().trim().optional().nullable(),
  port_of_loading: z.string().trim().optional().nullable(),
  port_of_discharge: z.string().trim().optional().nullable(),
  etd: optionalDate,
  eta: optionalDate,
  bill_of_entry_number: z.string().trim().optional().nullable(),
  bill_of_entry_date: optionalDate,
  port_code: z.string().trim().optional().nullable(),
  exchange_rate: optionalDecimal,
  assessable_value: optionalDecimal,
  customs_duty_amount: optionalDecimal,
  import_igst_amount: optionalDecimal,
  notes: z.string().trim().optional().nullable(),
  purchase_order_ids: z.array(z.string().uuid()).default([]),
});

export const allocateShipmentLinesSchema = z.object({
  shipment_id: z.string().uuid(),
  lines: z
    .array(
      z.object({
        purchase_order_id: z.string().uuid(),
        po_item_id: z.string().uuid(),
        variant_id: z.string().uuid(),
        quantity_shipped: z.string().trim().min(1),
      })
    )
    .min(1),
});

export const updateImportShipmentStatusSchema = z.object({
  shipment_id: z.string().uuid(),
  status: z.enum(IMPORT_SHIPMENT_STATUSES),
});

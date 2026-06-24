-- PO import receipt routing fields.

ALTER TABLE public.purchase_orders
    ADD COLUMN IF NOT EXISTS receipt_location_id UUID REFERENCES public.tenant_locations(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS ultimate_destination_location_id UUID REFERENCES public.tenant_locations(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS po_fulfillment_stage_override TEXT;

ALTER TABLE public.purchase_orders
    DROP CONSTRAINT IF EXISTS purchase_orders_po_fulfillment_stage_override_chk;

ALTER TABLE public.purchase_orders
    ADD CONSTRAINT purchase_orders_po_fulfillment_stage_override_chk
    CHECK (
        po_fulfillment_stage_override IS NULL
        OR po_fulfillment_stage_override IN ('COMMERCIAL', 'FINAL')
    );

-- ====================================================================
-- GST GRN import landed cost + BoE fields
-- Migration: 20260618140000_gst_grn_import_landed_cost.sql
-- ====================================================================

DROP FUNCTION IF EXISTS public.post_goods_receipt(UUID, UUID, JSONB, UUID);

CREATE OR REPLACE FUNCTION public.post_goods_receipt(
    p_destination_location_id UUID,
    p_purchase_order_id UUID,
    p_lines JSONB,
    p_created_by UUID,
    p_bill_of_entry_number TEXT DEFAULT NULL,
    p_bill_of_entry_date DATE DEFAULT NULL,
    p_port_code VARCHAR(10) DEFAULT NULL,
    p_exchange_rate NUMERIC(15, 6) DEFAULT NULL,
    p_assessable_value NUMERIC(15, 4) DEFAULT NULL,
    p_customs_duty_amount NUMERIC(15, 4) DEFAULT NULL,
    p_import_igst_amount NUMERIC(15, 4) DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_tenant_id UUID;
    v_location RECORD;
    v_po public.purchase_orders%ROWTYPE;
    v_gr_id UUID;
    v_voucher_number TEXT;
    v_entry JSONB;
    v_variant_id UUID;
    v_po_item_id UUID;
    v_item_id UUID;
    v_qty NUMERIC(15, 4);
    v_unit_cost NUMERIC(15, 4);
    v_po_item public.purchase_order_items%ROWTYPE;
    v_open_qty NUMERIC(15, 4);
    v_line_count INTEGER := 0;
    v_track_inventory BOOLEAN;
    v_tracking public.item_tracking_mode;
    v_total_line_value NUMERIC(15, 4) := 0;
    v_line_value NUMERIC(15, 4);
    v_import_igst_header NUMERIC(15, 4) := GREATEST(COALESCE(p_import_igst_amount, 0), 0);
    v_customs_duty_header NUMERIC(15, 4) := GREATEST(COALESCE(p_customs_duty_amount, 0), 0);
    v_line_import_igst NUMERIC(15, 4);
    v_line_customs_duty NUMERIC(15, 4);
    v_allocated_landed NUMERIC(15, 4);
    v_final_landed NUMERIC(15, 4);
    v_exchange_rate NUMERIC(15, 6) := GREATEST(COALESCE(p_exchange_rate, 1), 0.000001);
BEGIN
    v_tenant_id := private.current_tenant_id();
    IF v_tenant_id IS NULL THEN RAISE EXCEPTION 'tenant context missing from session'; END IF;
    IF p_created_by IS NULL THEN RAISE EXCEPTION 'created_by is required'; END IF;
    IF p_destination_location_id IS NULL THEN RAISE EXCEPTION 'destination location is required'; END IF;
    IF p_lines IS NULL OR jsonb_typeof(p_lines) IS DISTINCT FROM 'array' OR jsonb_array_length(p_lines) = 0 THEN
        RAISE EXCEPTION 'at least one receipt line is required';
    END IF;

    SELECT id, code, is_stock_holding, presence_type
    INTO v_location FROM public.tenant_locations
    WHERE id = p_destination_location_id AND tenant_id = v_tenant_id AND is_active = TRUE;
    IF NOT FOUND THEN RAISE EXCEPTION 'destination location not found'; END IF;
    IF NOT COALESCE(v_location.is_stock_holding, FALSE) OR v_location.presence_type = 'VIRTUAL' THEN
        RAISE EXCEPTION 'destination location cannot hold inventory';
    END IF;

    IF p_purchase_order_id IS NOT NULL THEN
        SELECT * INTO v_po FROM public.purchase_orders
        WHERE id = p_purchase_order_id AND tenant_id = v_tenant_id;
        IF NOT FOUND THEN RAISE EXCEPTION 'purchase order not found'; END IF;
        IF v_po.document_status NOT IN (
            'ISSUED_ACTIVE'::public.purchase_document_status,
            'PARTIALLY_FULFILLED'::public.purchase_document_status
        ) THEN RAISE EXCEPTION 'purchase order is not open for receiving'; END IF;
        IF v_po.destination_location_id <> p_destination_location_id THEN
            RAISE EXCEPTION 'destination location must match purchase order destination';
        END IF;
        IF v_po.tax_supply_nature = 'IMPORT_GOODS' THEN
            IF p_bill_of_entry_number IS NULL OR btrim(p_bill_of_entry_number) = '' THEN
                RAISE EXCEPTION 'bill of entry number is required for import goods receipt';
            END IF;
            IF p_bill_of_entry_date IS NULL THEN
                RAISE EXCEPTION 'bill of entry date is required for import goods receipt';
            END IF;
        END IF;
    END IF;

    FOR v_entry IN SELECT value FROM jsonb_array_elements(p_lines)
    LOOP
        v_qty := NULLIF(v_entry ->> 'quantity_received', '')::NUMERIC;
        v_unit_cost := COALESCE(NULLIF(v_entry ->> 'raw_unit_cost', '')::NUMERIC, 0);
        IF v_qty IS NULL OR v_qty <= 0 OR v_unit_cost <= 0 THEN CONTINUE; END IF;
        v_total_line_value := v_total_line_value + (v_qty * v_unit_cost);
    END LOOP;

    v_voucher_number := public.generate_next_voucher_string(
        v_tenant_id, 'GOODS_RECEIPT_NOTE'::public.document_voucher_type, NULL, p_destination_location_id
    );

    INSERT INTO public.goods_receipts (
        tenant_id, destination_location_id, purchase_order_id, voucher_number, created_by,
        tax_supply_nature, tax_mechanism,
        bill_of_entry_number, bill_of_entry_date, port_code,
        exchange_rate, assessable_value, customs_duty_amount, import_igst_amount
    ) VALUES (
        v_tenant_id, p_destination_location_id, p_purchase_order_id, v_voucher_number, p_created_by,
        CASE WHEN p_purchase_order_id IS NOT NULL THEN v_po.tax_supply_nature ELSE NULL END,
        CASE WHEN p_purchase_order_id IS NOT NULL THEN v_po.tax_mechanism ELSE NULL END,
        NULLIF(btrim(p_bill_of_entry_number), ''),
        p_bill_of_entry_date,
        NULLIF(btrim(p_port_code), ''),
        v_exchange_rate,
        GREATEST(COALESCE(p_assessable_value, 0), 0),
        v_customs_duty_header,
        v_import_igst_header
    ) RETURNING id INTO v_gr_id;

    FOR v_entry IN SELECT value FROM jsonb_array_elements(p_lines)
    LOOP
        v_variant_id := NULLIF(v_entry ->> 'variant_id', '')::UUID;
        v_po_item_id := NULLIF(v_entry ->> 'po_item_id', '')::UUID;
        v_qty := NULLIF(v_entry ->> 'quantity_received', '')::NUMERIC;
        v_unit_cost := COALESCE(NULLIF(v_entry ->> 'raw_unit_cost', '')::NUMERIC, 0);

        IF v_variant_id IS NULL OR v_qty IS NULL OR v_qty <= 0 OR v_unit_cost <= 0 THEN
            RAISE EXCEPTION 'invalid receipt line';
        END IF;

        SELECT iv.item_id, i.track_inventory, i.tracking_mode
        INTO v_item_id, v_track_inventory, v_tracking
        FROM public.item_variants iv
        INNER JOIN public.items i ON i.id = iv.item_id AND i.tenant_id = iv.tenant_id
        WHERE iv.id = v_variant_id AND iv.tenant_id = v_tenant_id AND iv.is_active = TRUE;
        IF NOT FOUND THEN RAISE EXCEPTION 'variant % not found', v_variant_id; END IF;
        IF NOT COALESCE(v_track_inventory, FALSE) THEN RAISE EXCEPTION 'item does not track inventory'; END IF;
        IF v_tracking IS DISTINCT FROM 'NONE'::public.item_tracking_mode THEN
            RAISE EXCEPTION 'lot and serial tracking are not supported in goods receipts yet';
        END IF;

        IF p_purchase_order_id IS NOT NULL THEN
            IF v_po_item_id IS NULL THEN RAISE EXCEPTION 'po_item_id is required when receiving against a purchase order'; END IF;
            SELECT * INTO v_po_item FROM public.purchase_order_items
            WHERE id = v_po_item_id AND tenant_id = v_tenant_id AND purchase_order_id = p_purchase_order_id;
            IF NOT FOUND THEN RAISE EXCEPTION 'purchase order line not found'; END IF;
            IF v_po_item.variant_id IS DISTINCT FROM v_variant_id THEN RAISE EXCEPTION 'variant does not match purchase order line'; END IF;
            v_open_qty := v_po_item.quantity_ordered - v_po_item.quantity_received;
            IF v_qty > v_open_qty THEN RAISE EXCEPTION 'quantity_received exceeds open purchase order quantity'; END IF;
        END IF;

        v_line_value := v_qty * v_unit_cost;
        IF v_total_line_value > 0 THEN
            v_line_import_igst := ROUND(v_import_igst_header * (v_line_value / v_total_line_value) / v_qty, 4);
            v_line_customs_duty := ROUND(v_customs_duty_header * (v_line_value / v_total_line_value) / v_qty, 4);
        ELSE
            v_line_import_igst := 0;
            v_line_customs_duty := 0;
        END IF;

        v_allocated_landed := v_line_import_igst + v_line_customs_duty;
        v_final_landed := v_unit_cost + v_allocated_landed;

        INSERT INTO public.goods_receipt_items (
            tenant_id, goods_receipt_id, po_item_id, item_id, variant_id,
            quantity_received, quantity_accepted, quantity_rejected,
            raw_unit_cost, allocated_landed_cost, total_final_landed_cost,
            import_igst_amount, customs_duty_amount
        ) VALUES (
            v_tenant_id, v_gr_id, v_po_item_id, v_item_id, v_variant_id,
            v_qty, v_qty, 0,
            v_unit_cost, v_allocated_landed, v_final_landed,
            ROUND(v_line_import_igst * v_qty, 4), ROUND(v_line_customs_duty * v_qty, 4)
        );

        IF p_purchase_order_id IS NOT NULL AND v_po_item_id IS NOT NULL THEN
            UPDATE public.purchase_order_items SET
                quantity_received = quantity_received + v_qty, updated_at = NOW()
            WHERE id = v_po_item_id AND tenant_id = v_tenant_id;
        END IF;

        INSERT INTO public.item_variant_locations (tenant_id, item_id, variant_id, location_id, is_stocked, is_sellable, is_orderable)
        VALUES (v_tenant_id, v_item_id, v_variant_id, p_destination_location_id, TRUE, FALSE, FALSE)
        ON CONFLICT (variant_id, location_id) DO UPDATE SET is_stocked = TRUE, updated_at = NOW();

        v_line_count := v_line_count + 1;
    END LOOP;

    IF v_line_count = 0 THEN RAISE EXCEPTION 'no valid receipt lines were posted'; END IF;

    IF p_purchase_order_id IS NOT NULL THEN
        INSERT INTO public.purchase_order_grn_mappings (tenant_id, purchase_order_id, goods_receipt_id, mapped_by)
        VALUES (v_tenant_id, p_purchase_order_id, v_gr_id, p_created_by)
        ON CONFLICT (purchase_order_id, goods_receipt_id) DO NOTHING;

        UPDATE public.purchase_orders po SET document_status = CASE
            WHEN EXISTS (
                SELECT 1 FROM public.purchase_order_items poi
                WHERE poi.purchase_order_id = po.id AND poi.tenant_id = v_tenant_id
                  AND poi.quantity_received < poi.quantity_ordered
            ) THEN 'PARTIALLY_FULFILLED'::public.purchase_document_status
            ELSE 'FULLY_COMPLETED'::public.purchase_document_status
        END, updated_at = NOW()
        WHERE po.id = p_purchase_order_id AND po.tenant_id = v_tenant_id;
    END IF;

    RETURN v_gr_id;
END;
$$;

REVOKE ALL ON FUNCTION public.post_goods_receipt(UUID, UUID, JSONB, UUID, TEXT, DATE, VARCHAR, NUMERIC, NUMERIC, NUMERIC, NUMERIC) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.post_goods_receipt(UUID, UUID, JSONB, UUID, TEXT, DATE, VARCHAR, NUMERIC, NUMERIC, NUMERIC, NUMERIC) TO authenticated;

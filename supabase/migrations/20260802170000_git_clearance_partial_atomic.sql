-- Partial GIT clearance, cancel/reverse, and atomic GRN clearance orchestrator.

ALTER TABLE public.goods_in_transit_voucher_items
    ADD COLUMN IF NOT EXISTS quantity_cleared NUMERIC(15, 4) NOT NULL DEFAULT 0.0000;

ALTER TABLE public.goods_in_transit_voucher_items
    DROP CONSTRAINT IF EXISTS goods_in_transit_voucher_items_quantity_cleared_chk;

ALTER TABLE public.goods_in_transit_voucher_items
    ADD CONSTRAINT goods_in_transit_voucher_items_quantity_cleared_chk
    CHECK (quantity_cleared >= 0 AND quantity_cleared <= quantity);

DROP FUNCTION IF EXISTS public.clear_goods_in_transit_for_grn(UUID, UUID, JSONB, UUID);

CREATE OR REPLACE FUNCTION public.clear_goods_in_transit_for_grn(
    p_git_voucher_id UUID,
    p_destination_location_id UUID,
    p_lines JSONB,
    p_created_by UUID,
    p_goods_receipt_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_tenant_id UUID;
    v_voucher public.goods_in_transit_vouchers%ROWTYPE;
    v_entry JSONB;
    v_variant_id UUID;
    v_qty NUMERIC(15, 4);
    v_git_line RECORD;
    v_reference TEXT;
    v_cleared_qty NUMERIC(15, 4) := 0;
    v_open_qty NUMERIC(15, 4);
    v_fully_cleared BOOLEAN := TRUE;
BEGIN
    v_tenant_id := private.current_tenant_id();
    IF v_tenant_id IS NULL THEN RAISE EXCEPTION 'tenant context missing from session'; END IF;
    IF p_created_by IS NULL THEN RAISE EXCEPTION 'created_by is required'; END IF;
    IF p_git_voucher_id IS NULL THEN RAISE EXCEPTION 'GIT voucher id is required'; END IF;

    SELECT * INTO v_voucher
    FROM public.goods_in_transit_vouchers
    WHERE id = p_git_voucher_id AND tenant_id = v_tenant_id
    FOR UPDATE;

    IF NOT FOUND THEN RAISE EXCEPTION 'GIT voucher not found'; END IF;
    IF v_voucher.status NOT IN ('POSTED') THEN
        RAISE EXCEPTION 'only posted GIT vouchers can be cleared on receipt';
    END IF;
    IF v_voucher.git_holding_location_id IS NULL THEN
        RAISE EXCEPTION 'GIT voucher has no holding location';
    END IF;

    IF NOT private.location_allows_inventory_storage(p_destination_location_id) THEN
        RAISE EXCEPTION 'destination location cannot hold inventory';
    END IF;

    v_reference := v_voucher.voucher_number;

    FOR v_entry IN SELECT value FROM jsonb_array_elements(p_lines)
    LOOP
        v_variant_id := NULLIF(v_entry ->> 'variant_id', '')::UUID;
        v_qty := COALESCE(
            NULLIF(v_entry ->> 'quantity_accepted', '')::NUMERIC,
            NULLIF(v_entry ->> 'quantity_received', '')::NUMERIC,
            0
        );

        IF v_variant_id IS NULL OR v_qty <= 0 THEN CONTINUE; END IF;

        SELECT * INTO v_git_line
        FROM public.goods_in_transit_voucher_items
        WHERE goods_in_transit_voucher_id = p_git_voucher_id
          AND tenant_id = v_tenant_id
          AND variant_id = v_variant_id
        LIMIT 1
        FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'variant % is not on GIT voucher %', v_variant_id, v_voucher.voucher_number;
        END IF;

        v_open_qty := v_git_line.quantity - COALESCE(v_git_line.quantity_cleared, 0);
        IF v_qty > v_open_qty THEN
            RAISE EXCEPTION 'clearance quantity exceeds open GIT quantity for variant %', v_variant_id;
        END IF;

        INSERT INTO public.inventory_ledger (
            tenant_id, item_id, variant_id, location_id,
            transaction_type, quantity, cost_at_transaction,
            reference_document, created_by
        )
        VALUES (
            v_tenant_id, v_git_line.item_id, v_git_line.variant_id, v_voucher.git_holding_location_id,
            'STOCK_TRANSFER', -v_qty, private.money_round(v_git_line.unit_cost),
            v_reference || '|GIT-CLEAR', p_created_by
        );

        UPDATE public.goods_in_transit_voucher_items
        SET quantity_cleared = COALESCE(quantity_cleared, 0) + v_qty
        WHERE id = v_git_line.id AND tenant_id = v_tenant_id;

        v_cleared_qty := v_cleared_qty + v_qty;
    END LOOP;

    IF v_cleared_qty <= 0 THEN
        RAISE EXCEPTION 'at least one clearance line with quantity is required';
    END IF;

    SELECT NOT EXISTS (
        SELECT 1
        FROM public.goods_in_transit_voucher_items
        WHERE goods_in_transit_voucher_id = p_git_voucher_id
          AND tenant_id = v_tenant_id
          AND COALESCE(quantity_cleared, 0) < quantity
    )
    INTO v_fully_cleared;

    UPDATE public.goods_in_transit_vouchers
    SET status = CASE WHEN v_fully_cleared THEN 'CLEARED' ELSE 'POSTED' END,
        destination_location_id = COALESCE(destination_location_id, p_destination_location_id),
        goods_receipt_id = COALESCE(p_goods_receipt_id, goods_receipt_id),
        cleared_at = CASE WHEN v_fully_cleared THEN NOW() ELSE cleared_at END,
        updated_at = NOW()
    WHERE id = p_git_voucher_id;

    RETURN jsonb_build_object(
        'voucher_id', p_git_voucher_id,
        'quantity_cleared', v_cleared_qty,
        'status', CASE WHEN v_fully_cleared THEN 'CLEARED' ELSE 'POSTED' END,
        'fully_cleared', v_fully_cleared
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_goods_in_transit(
    p_git_voucher_id UUID,
    p_created_by UUID,
    p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_tenant_id UUID;
    v_voucher public.goods_in_transit_vouchers%ROWTYPE;
    v_line RECORD;
    v_reference TEXT;
    v_reversed_lines INTEGER := 0;
BEGIN
    v_tenant_id := private.current_tenant_id();
    IF v_tenant_id IS NULL THEN RAISE EXCEPTION 'tenant context missing from session'; END IF;
    IF p_created_by IS NULL THEN RAISE EXCEPTION 'created_by is required'; END IF;
    IF p_git_voucher_id IS NULL THEN RAISE EXCEPTION 'GIT voucher id is required'; END IF;

    SELECT * INTO v_voucher
    FROM public.goods_in_transit_vouchers
    WHERE id = p_git_voucher_id AND tenant_id = v_tenant_id
    FOR UPDATE;

    IF NOT FOUND THEN RAISE EXCEPTION 'GIT voucher not found'; END IF;
    IF v_voucher.status <> 'POSTED' THEN
        RAISE EXCEPTION 'only posted GIT vouchers can be cancelled';
    END IF;

    IF EXISTS (
        SELECT 1 FROM public.goods_in_transit_voucher_items
        WHERE goods_in_transit_voucher_id = p_git_voucher_id
          AND tenant_id = v_tenant_id
          AND COALESCE(quantity_cleared, 0) > 0
    ) THEN
        RAISE EXCEPTION 'cannot cancel a GIT voucher after partial clearance';
    END IF;

    v_reference := v_voucher.voucher_number;

    FOR v_line IN
        SELECT * FROM public.goods_in_transit_voucher_items
        WHERE goods_in_transit_voucher_id = p_git_voucher_id AND tenant_id = v_tenant_id
    LOOP
        INSERT INTO public.inventory_ledger (
            tenant_id, item_id, variant_id, location_id,
            transaction_type, quantity, cost_at_transaction,
            reference_document, created_by
        )
        VALUES (
            v_tenant_id, v_line.item_id, v_line.variant_id, v_voucher.git_holding_location_id,
            'STOCK_TRANSFER', -v_line.quantity, private.money_round(v_line.unit_cost),
            v_reference || '|GIT-CANCEL-HOLD', p_created_by
        );

        INSERT INTO public.inventory_ledger (
            tenant_id, item_id, variant_id, location_id,
            transaction_type, quantity, cost_at_transaction,
            reference_document, created_by
        )
        VALUES (
            v_tenant_id, v_line.item_id, v_line.variant_id, v_voucher.source_location_id,
            'STOCK_TRANSFER', v_line.quantity, private.money_round(v_line.unit_cost),
            v_reference || '|GIT-CANCEL-RESTORE', p_created_by
        );

        v_reversed_lines := v_reversed_lines + 1;
    END LOOP;

    UPDATE public.goods_in_transit_vouchers
    SET status = 'CANCELLED',
        notes = CASE
            WHEN NULLIF(btrim(p_reason), '') IS NOT NULL THEN
                COALESCE(NULLIF(btrim(notes), ''), '') || CASE WHEN notes IS NULL OR btrim(notes) = '' THEN '' ELSE E'\n' END
                || 'Cancelled: ' || btrim(p_reason)
            ELSE notes
        END,
        updated_at = NOW()
    WHERE id = p_git_voucher_id;

    RETURN jsonb_build_object(
        'voucher_id', p_git_voucher_id,
        'status', 'CANCELLED',
        'lines_reversed', v_reversed_lines
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.post_grn_with_git_clearance(
    p_git_voucher_id UUID,
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
    p_import_igst_amount NUMERIC(15, 4) DEFAULT NULL,
    p_landed_charges JSONB DEFAULT '[]'::jsonb,
    p_shipment_id UUID DEFAULT NULL,
    p_parent_grn_id UUID DEFAULT NULL,
    p_staging_location_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_grn_result JSONB;
    v_clear_result JSONB;
    v_gr_id UUID;
BEGIN
    v_clear_result := public.clear_goods_in_transit_for_grn(
        p_git_voucher_id,
        p_destination_location_id,
        p_lines,
        p_created_by,
        NULL
    );

    v_grn_result := public.post_goods_receipt(
        p_destination_location_id,
        p_purchase_order_id,
        p_lines,
        p_created_by,
        p_bill_of_entry_number,
        p_bill_of_entry_date,
        p_port_code,
        p_exchange_rate,
        p_assessable_value,
        p_customs_duty_amount,
        p_import_igst_amount,
        p_landed_charges,
        'GIT_CLEARANCE',
        FALSE,
        p_parent_grn_id,
        p_shipment_id,
        p_staging_location_id
    );

    v_gr_id := NULLIF(v_grn_result ->> 'goods_receipt_id', '')::UUID;
    IF v_gr_id IS NULL THEN
        RAISE EXCEPTION 'goods receipt posting failed during GIT clearance';
    END IF;

    UPDATE public.goods_in_transit_vouchers
    SET goods_receipt_id = v_gr_id,
        updated_at = NOW()
    WHERE id = p_git_voucher_id AND tenant_id = private.current_tenant_id();

    RETURN jsonb_build_object(
        'goods_receipt_id', v_gr_id,
        'steps', v_grn_result -> 'steps',
        'git_clearance', v_clear_result
    );
END;
$$;

REVOKE ALL ON FUNCTION public.clear_goods_in_transit_for_grn(UUID, UUID, JSONB, UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.clear_goods_in_transit_for_grn(UUID, UUID, JSONB, UUID, UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.cancel_goods_in_transit(UUID, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_goods_in_transit(UUID, UUID, TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.post_grn_with_git_clearance(
    UUID, UUID, UUID, JSONB, UUID, TEXT, DATE, VARCHAR, NUMERIC, NUMERIC, NUMERIC, NUMERIC, JSONB, UUID, UUID, UUID
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.post_grn_with_git_clearance(
    UUID, UUID, UUID, JSONB, UUID, TEXT, DATE, VARCHAR, NUMERIC, NUMERIC, NUMERIC, NUMERIC, JSONB, UUID, UUID, UUID
) TO authenticated;

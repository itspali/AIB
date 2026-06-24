-- ====================================================================
-- Import logistics Phase 5: GIT post/clear GL entries
-- Migration: 20260802180000_git_gl_posting.sql
-- ====================================================================
--
-- When FINANCIAL_SETTINGS.git_holding_account_id is configured:
--   post_goods_in_transit  -> Dr GIT holding asset / Cr 1400-INVENTORY
--   clear_goods_in_transit_for_grn -> Dr 1400-INVENTORY / Cr GIT holding asset
--
-- Skips GL silently when git_holding_account_id is NULL (inventory-only tenants).
-- Uses private.get_financial_control_uuid + post_gl_line_by_account_id from
-- 20260622110000_procurement_billing_three_way_gl.sql.
-- ====================================================================

CREATE OR REPLACE FUNCTION private.post_git_inventory_gl(
    p_tenant_id UUID,
    p_source_document_id UUID,
    p_source_document_type TEXT,
    p_voucher_number TEXT,
    p_narration TEXT,
    p_amount NUMERIC(15, 4),
    p_to_git BOOLEAN
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_git_account_id UUID;
    v_gl_header_id UUID;
BEGIN
    IF p_amount IS NULL OR p_amount <= 0 THEN
        RETURN;
    END IF;

    v_git_account_id := private.get_financial_control_uuid(p_tenant_id, 'git_holding_account_id');
    IF v_git_account_id IS NULL THEN
        RETURN;
    END IF;

    v_gl_header_id := private.create_gl_voucher(
        p_tenant_id,
        p_voucher_number || '-GL',
        NOW(),
        p_source_document_type,
        p_source_document_id,
        p_narration,
        FALSE
    );

    IF p_to_git THEN
        PERFORM private.post_gl_line_by_account_id(
            p_tenant_id, v_gl_header_id, v_git_account_id, p_amount, 0.0000
        );
        PERFORM private.post_gl_line(
            p_tenant_id, v_gl_header_id, '1400-INVENTORY', 0.0000, p_amount
        );
    ELSE
        PERFORM private.post_gl_line(
            p_tenant_id, v_gl_header_id, '1400-INVENTORY', p_amount, 0.0000
        );
        PERFORM private.post_gl_line_by_account_id(
            p_tenant_id, v_gl_header_id, v_git_account_id, 0.0000, p_amount
        );
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.post_goods_in_transit(
    p_source_location_id UUID,
    p_git_holding_location_id UUID,
    p_lines JSONB,
    p_created_by UUID,
    p_purchase_order_id UUID DEFAULT NULL,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_tenant_id UUID;
    v_voucher_id UUID;
    v_voucher_number TEXT;
    v_next_seq INTEGER;
    v_entry JSONB;
    v_variant_id UUID;
    v_item_id UUID;
    v_po_item_id UUID;
    v_qty NUMERIC(15, 4);
    v_unit_cost NUMERIC(15, 4);
    v_on_hand NUMERIC(15, 4);
    v_reference TEXT;
    v_line_count INTEGER := 0;
    v_total_gl_amount NUMERIC(15, 4) := 0;
    v_line_amount NUMERIC(15, 4);
BEGIN
    v_tenant_id := private.current_tenant_id();
    IF v_tenant_id IS NULL THEN RAISE EXCEPTION 'tenant context missing from session'; END IF;
    IF p_created_by IS NULL THEN RAISE EXCEPTION 'created_by is required'; END IF;
    IF p_source_location_id IS NULL OR p_git_holding_location_id IS NULL THEN
        RAISE EXCEPTION 'source and GIT holding locations are required';
    END IF;
    IF p_source_location_id = p_git_holding_location_id THEN
        RAISE EXCEPTION 'source and GIT holding must be different locations';
    END IF;
    IF p_lines IS NULL OR jsonb_typeof(p_lines) IS DISTINCT FROM 'array' OR jsonb_array_length(p_lines) = 0 THEN
        RAISE EXCEPTION 'at least one line is required';
    END IF;

    IF NOT private.location_allows_inventory_storage(p_source_location_id) THEN
        RAISE EXCEPTION 'source location cannot hold inventory';
    END IF;

    IF NOT private.location_allows_inventory_storage(p_git_holding_location_id) THEN
        RAISE EXCEPTION 'GIT holding location cannot hold inventory';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.tenant_locations
        WHERE id = p_git_holding_location_id
          AND tenant_id = v_tenant_id
          AND COALESCE(is_git_holding, FALSE) = TRUE
    ) THEN
        RAISE EXCEPTION 'destination must be flagged as a GIT holding location';
    END IF;

    IF p_purchase_order_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.purchase_orders
            WHERE id = p_purchase_order_id AND tenant_id = v_tenant_id
        ) THEN
            RAISE EXCEPTION 'purchase order not found';
        END IF;
    END IF;

    SELECT COALESCE(
        MAX(
            CASE
                WHEN voucher_number ~ '^GIT-[0-9]+$'
                THEN substring(voucher_number from 5)::INTEGER
                ELSE NULL
            END
        ),
        0
    ) + 1
    INTO v_next_seq
    FROM public.goods_in_transit_vouchers
    WHERE tenant_id = v_tenant_id;

    v_voucher_number := 'GIT-' || lpad(v_next_seq::TEXT, 5, '0');

    INSERT INTO public.goods_in_transit_vouchers (
        tenant_id, voucher_number, status,
        source_location_id, git_holding_location_id, destination_location_id,
        purchase_order_id, notes, created_by, posted_at
    )
    VALUES (
        v_tenant_id, v_voucher_number, 'POSTED',
        p_source_location_id, p_git_holding_location_id, NULL,
        p_purchase_order_id, NULLIF(btrim(p_notes), ''), p_created_by, NOW()
    )
    RETURNING id INTO v_voucher_id;

    v_reference := v_voucher_number;

    FOR v_entry IN SELECT value FROM jsonb_array_elements(p_lines)
    LOOP
        v_variant_id := NULLIF(v_entry ->> 'variant_id', '')::UUID;
        v_po_item_id := NULLIF(v_entry ->> 'po_item_id', '')::UUID;
        v_qty := NULLIF(v_entry ->> 'quantity', '')::NUMERIC;
        v_unit_cost := COALESCE(NULLIF(v_entry ->> 'unit_cost', '')::NUMERIC, 0);

        IF v_variant_id IS NULL OR v_qty IS NULL OR v_qty <= 0 THEN
            RAISE EXCEPTION 'each line requires variant_id and quantity > 0';
        END IF;

        SELECT iv.item_id INTO v_item_id
        FROM public.item_variants iv
        WHERE iv.id = v_variant_id AND iv.tenant_id = v_tenant_id AND iv.is_active = TRUE;
        IF NOT FOUND THEN RAISE EXCEPTION 'variant not found'; END IF;

        v_on_hand := private.get_item_valuation_on_hand(
            v_tenant_id, p_source_location_id, v_item_id, v_variant_id
        );
        IF v_on_hand < v_qty THEN
            RAISE EXCEPTION 'insufficient on-hand at source for variant %', v_variant_id;
        END IF;

        IF v_unit_cost <= 0 THEN
            v_unit_cost := private.get_item_average_cost(
                v_tenant_id, p_source_location_id, v_item_id, v_variant_id
            );
        END IF;

        INSERT INTO public.goods_in_transit_voucher_items (
            tenant_id, goods_in_transit_voucher_id, item_id, variant_id, po_item_id, quantity, unit_cost
        )
        VALUES (
            v_tenant_id, v_voucher_id, v_item_id, v_variant_id, v_po_item_id, v_qty, v_unit_cost
        );

        INSERT INTO public.inventory_ledger (
            tenant_id, item_id, variant_id, location_id,
            transaction_type, quantity, cost_at_transaction,
            reference_document, created_by
        )
        VALUES (
            v_tenant_id, v_item_id, v_variant_id, p_source_location_id,
            'STOCK_TRANSFER', -v_qty, private.money_round(v_unit_cost),
            v_reference || '|GIT-OUT', p_created_by
        );

        INSERT INTO public.inventory_ledger (
            tenant_id, item_id, variant_id, location_id,
            transaction_type, quantity, cost_at_transaction,
            reference_document, created_by
        )
        VALUES (
            v_tenant_id, v_item_id, v_variant_id, p_git_holding_location_id,
            'STOCK_TRANSFER', v_qty, private.money_round(v_unit_cost),
            v_reference || '|GIT-IN', p_created_by
        );

        v_line_amount := private.money_round(v_qty * GREATEST(v_unit_cost, 0));
        v_total_gl_amount := v_total_gl_amount + v_line_amount;
        v_line_count := v_line_count + 1;
    END LOOP;

    IF v_line_count = 0 THEN RAISE EXCEPTION 'no valid GIT lines were posted'; END IF;

    PERFORM private.post_git_inventory_gl(
        v_tenant_id,
        v_voucher_id,
        'GIT_VOUCHER',
        v_voucher_number,
        'Goods in transit post — ' || v_voucher_number,
        v_total_gl_amount,
        TRUE
    );

    RETURN jsonb_build_object(
        'voucher_id', v_voucher_id,
        'voucher_number', v_voucher_number,
        'line_count', v_line_count,
        'status', 'POSTED'
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.clear_goods_in_transit_for_grn(
    p_git_voucher_id UUID,
    p_destination_location_id UUID,
    p_lines JSONB,
    p_created_by UUID
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
    v_total_gl_amount NUMERIC(15, 4) := 0;
    v_line_amount NUMERIC(15, 4);
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
        LIMIT 1;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'variant % is not on GIT voucher %', v_variant_id, v_voucher.voucher_number;
        END IF;

        IF v_qty > v_git_line.quantity THEN
            RAISE EXCEPTION 'clearance quantity exceeds GIT quantity for variant %', v_variant_id;
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

        v_line_amount := private.money_round(v_qty * GREATEST(v_git_line.unit_cost, 0));
        v_total_gl_amount := v_total_gl_amount + v_line_amount;
        v_cleared_qty := v_cleared_qty + v_qty;
    END LOOP;

    PERFORM private.post_git_inventory_gl(
        v_tenant_id,
        p_git_voucher_id,
        'GIT_CLEARANCE',
        v_reference,
        'Goods in transit clearance — ' || v_reference,
        v_total_gl_amount,
        FALSE
    );

    UPDATE public.goods_in_transit_vouchers
    SET status = 'CLEARED',
        destination_location_id = p_destination_location_id,
        cleared_at = NOW(),
        updated_at = NOW()
    WHERE id = p_git_voucher_id;

    RETURN jsonb_build_object(
        'voucher_id', p_git_voucher_id,
        'quantity_cleared', v_cleared_qty,
        'status', 'CLEARED'
    );
END;
$$;

REVOKE ALL ON FUNCTION private.post_git_inventory_gl(UUID, UUID, TEXT, TEXT, TEXT, NUMERIC, BOOLEAN) FROM PUBLIC;

REVOKE ALL ON FUNCTION public.post_goods_in_transit(UUID, UUID, JSONB, UUID, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.post_goods_in_transit(UUID, UUID, JSONB, UUID, UUID, TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.clear_goods_in_transit_for_grn(UUID, UUID, JSONB, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.clear_goods_in_transit_for_grn(UUID, UUID, JSONB, UUID) TO authenticated;

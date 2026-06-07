-- Stock transfer document RPCs (draft save, dispatch, receive, cancel).

CREATE OR REPLACE FUNCTION public.save_stock_transfer(
    p_transfer_id UUID,
    p_source_location_id UUID,
    p_destination_location_id UUID,
    p_lines JSONB,
    p_created_by UUID,
    p_inter_company_freight_cost NUMERIC DEFAULT 0,
    p_loading_overhead_cost NUMERIC DEFAULT 0,
    p_unloading_overhead_cost NUMERIC DEFAULT 0
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_tenant_id UUID;
    v_source RECORD;
    v_destination RECORD;
    v_transfer_id UUID;
    v_transfer_number TEXT;
    v_entry JSONB;
    v_variant_id UUID;
    v_item_id UUID;
    v_qty NUMERIC(15, 4);
    v_tracking public.item_tracking_mode;
    v_track_inventory BOOLEAN;
    v_line_count INTEGER := 0;
BEGIN
    v_tenant_id := private.current_tenant_id();
    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'tenant context missing from session';
    END IF;

    IF p_created_by IS NULL THEN
        RAISE EXCEPTION 'created_by is required';
    END IF;

    IF p_source_location_id IS NULL OR p_destination_location_id IS NULL THEN
        RAISE EXCEPTION 'source and destination locations are required';
    END IF;

    IF p_source_location_id = p_destination_location_id THEN
        RAISE EXCEPTION 'source and destination must be different locations';
    END IF;

    IF p_lines IS NULL OR jsonb_typeof(p_lines) IS DISTINCT FROM 'array' OR jsonb_array_length(p_lines) = 0 THEN
        RAISE EXCEPTION 'at least one transfer line is required';
    END IF;

    SELECT id, code, is_stock_holding, presence_type
    INTO v_source
    FROM public.tenant_locations
    WHERE id = p_source_location_id
      AND tenant_id = v_tenant_id
      AND is_active = TRUE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'source location not found';
    END IF;

    IF NOT COALESCE(v_source.is_stock_holding, FALSE) OR v_source.presence_type = 'VIRTUAL' THEN
        RAISE EXCEPTION 'source location cannot hold inventory';
    END IF;

    SELECT id, code, is_stock_holding, presence_type
    INTO v_destination
    FROM public.tenant_locations
    WHERE id = p_destination_location_id
      AND tenant_id = v_tenant_id
      AND is_active = TRUE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'destination location not found';
    END IF;

    IF NOT COALESCE(v_destination.is_stock_holding, FALSE) OR v_destination.presence_type = 'VIRTUAL' THEN
        RAISE EXCEPTION 'destination location cannot hold inventory';
    END IF;

    IF p_transfer_id IS NOT NULL THEN
        SELECT id, current_status
        INTO v_transfer_id
        FROM public.stock_transfers
        WHERE id = p_transfer_id
          AND tenant_id = v_tenant_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'transfer not found';
        END IF;

        IF (SELECT current_status FROM public.stock_transfers WHERE id = p_transfer_id) <> 'DRAFT' THEN
            RAISE EXCEPTION 'only draft transfers can be edited';
        END IF;

        UPDATE public.stock_transfers
        SET source_location_id = p_source_location_id,
            destination_location_id = p_destination_location_id,
            inter_company_freight_cost = COALESCE(p_inter_company_freight_cost, 0),
            loading_overhead_cost = COALESCE(p_loading_overhead_cost, 0),
            unloading_overhead_cost = COALESCE(p_unloading_overhead_cost, 0),
            updated_at = NOW()
        WHERE id = p_transfer_id;

        DELETE FROM public.stock_transfer_items
        WHERE stock_transfer_id = p_transfer_id
          AND tenant_id = v_tenant_id;

        v_transfer_id := p_transfer_id;
    ELSE
        v_transfer_number := public.generate_next_voucher_string(
            v_tenant_id,
            'STOCK_TRANSFER'::public.document_voucher_type,
            NULL,
            p_source_location_id
        );

        INSERT INTO public.stock_transfers (
            tenant_id,
            transfer_number,
            source_location_id,
            destination_location_id,
            current_status,
            inter_company_freight_cost,
            loading_overhead_cost,
            unloading_overhead_cost,
            created_by
        )
        VALUES (
            v_tenant_id,
            v_transfer_number,
            p_source_location_id,
            p_destination_location_id,
            'DRAFT'::public.stock_transfer_status,
            COALESCE(p_inter_company_freight_cost, 0),
            COALESCE(p_loading_overhead_cost, 0),
            COALESCE(p_unloading_overhead_cost, 0),
            p_created_by
        )
        RETURNING id INTO v_transfer_id;
    END IF;

    FOR v_entry IN SELECT value FROM jsonb_array_elements(p_lines)
    LOOP
        v_variant_id := NULLIF(v_entry ->> 'variant_id', '')::UUID;
        v_qty := NULLIF(v_entry ->> 'quantity_dispatched', '')::NUMERIC;

        IF v_variant_id IS NULL THEN
            RAISE EXCEPTION 'variant_id is required on each line';
        END IF;

        IF v_qty IS NULL OR v_qty <= 0 THEN
            RAISE EXCEPTION 'quantity_dispatched must be greater than zero';
        END IF;

        SELECT iv.item_id, i.track_inventory, i.tracking_mode
        INTO v_item_id, v_track_inventory, v_tracking
        FROM public.item_variants iv
        INNER JOIN public.items i ON i.id = iv.item_id AND i.tenant_id = iv.tenant_id
        WHERE iv.id = v_variant_id
          AND iv.tenant_id = v_tenant_id
          AND iv.is_active = TRUE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'variant % not found', v_variant_id;
        END IF;

        IF NOT COALESCE(v_track_inventory, FALSE) THEN
            RAISE EXCEPTION 'item does not track inventory';
        END IF;

        IF v_tracking IS DISTINCT FROM 'NONE'::public.item_tracking_mode THEN
            RAISE EXCEPTION 'lot and serial tracking are not supported in stock transfers yet';
        END IF;

        INSERT INTO public.stock_transfer_items (
            tenant_id,
            stock_transfer_id,
            item_id,
            variant_id,
            quantity_dispatched
        )
        VALUES (
            v_tenant_id,
            v_transfer_id,
            v_item_id,
            v_variant_id,
            v_qty
        );

        v_line_count := v_line_count + 1;
    END LOOP;

    IF v_line_count = 0 THEN
        RAISE EXCEPTION 'no valid transfer lines were saved';
    END IF;

    RETURN v_transfer_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.dispatch_stock_transfer(p_transfer_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_tenant_id UUID;
    v_transfer RECORD;
    v_line RECORD;
    v_on_hand NUMERIC(15, 4);
BEGIN
    v_tenant_id := private.current_tenant_id();
    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'tenant context missing from session';
    END IF;

    IF p_transfer_id IS NULL THEN
        RAISE EXCEPTION 'transfer id is required';
    END IF;

    SELECT *
    INTO v_transfer
    FROM public.stock_transfers
    WHERE id = p_transfer_id
      AND tenant_id = v_tenant_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'transfer not found';
    END IF;

    IF v_transfer.current_status <> 'DRAFT' THEN
        RAISE EXCEPTION 'only draft transfers can be dispatched';
    END IF;

    FOR v_line IN
        SELECT *
        FROM public.stock_transfer_items
        WHERE stock_transfer_id = p_transfer_id
          AND tenant_id = v_tenant_id
    LOOP
        v_on_hand := private.get_item_valuation_on_hand(
            v_tenant_id,
            v_transfer.source_location_id,
            v_line.item_id,
            v_line.variant_id
        );

        IF v_on_hand < v_line.quantity_dispatched THEN
            RAISE EXCEPTION 'insufficient on-hand for variant % at source location', v_line.variant_id;
        END IF;
    END LOOP;

    UPDATE public.stock_transfers
    SET current_status = 'DISPATCHED_IN_TRANSIT'::public.stock_transfer_status,
        updated_at = NOW()
    WHERE id = p_transfer_id
      AND tenant_id = v_tenant_id;

    RETURN p_transfer_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.receive_stock_transfer(
    p_transfer_id UUID,
    p_lines JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_tenant_id UUID;
    v_transfer RECORD;
    v_entry JSONB;
    v_line_id UUID;
    v_accepted NUMERIC(15, 4);
    v_damaged NUMERIC(15, 4);
    v_lost NUMERIC(15, 4);
    v_line RECORD;
    v_has_discrepancy BOOLEAN := FALSE;
    v_final_status public.stock_transfer_status;
BEGIN
    v_tenant_id := private.current_tenant_id();
    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'tenant context missing from session';
    END IF;

    IF p_transfer_id IS NULL THEN
        RAISE EXCEPTION 'transfer id is required';
    END IF;

    IF p_lines IS NULL OR jsonb_typeof(p_lines) IS DISTINCT FROM 'array' OR jsonb_array_length(p_lines) = 0 THEN
        RAISE EXCEPTION 'receipt lines are required';
    END IF;

    SELECT *
    INTO v_transfer
    FROM public.stock_transfers
    WHERE id = p_transfer_id
      AND tenant_id = v_tenant_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'transfer not found';
    END IF;

    IF v_transfer.current_status <> 'DISPATCHED_IN_TRANSIT' THEN
        RAISE EXCEPTION 'only in-transit transfers can be received';
    END IF;

    FOR v_entry IN SELECT value FROM jsonb_array_elements(p_lines)
    LOOP
        v_line_id := NULLIF(v_entry ->> 'line_id', '')::UUID;
        v_accepted := COALESCE(NULLIF(v_entry ->> 'quantity_accepted', '')::NUMERIC, 0);
        v_damaged := COALESCE(NULLIF(v_entry ->> 'quantity_damaged', '')::NUMERIC, 0);
        v_lost := COALESCE(NULLIF(v_entry ->> 'quantity_lost', '')::NUMERIC, 0);

        IF v_line_id IS NULL THEN
            RAISE EXCEPTION 'line_id is required on each receipt line';
        END IF;

        SELECT *
        INTO v_line
        FROM public.stock_transfer_items
        WHERE id = v_line_id
          AND stock_transfer_id = p_transfer_id
          AND tenant_id = v_tenant_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'transfer line % not found', v_line_id;
        END IF;

        IF v_accepted < 0 OR v_damaged < 0 OR v_lost < 0 THEN
            RAISE EXCEPTION 'receipt quantities cannot be negative';
        END IF;

        IF v_accepted + v_damaged + v_lost > v_line.quantity_dispatched THEN
            RAISE EXCEPTION 'receipt quantities cannot exceed dispatched quantity on line %', v_line_id;
        END IF;

        UPDATE public.stock_transfer_items
        SET quantity_accepted = v_accepted,
            quantity_damaged = v_damaged,
            quantity_lost = v_lost,
            updated_at = NOW()
        WHERE id = v_line_id;
    END LOOP;

    FOR v_line IN
        SELECT *
        FROM public.stock_transfer_items
        WHERE stock_transfer_id = p_transfer_id
          AND tenant_id = v_tenant_id
    LOOP
        IF v_line.quantity_accepted + v_line.quantity_damaged + v_line.quantity_lost
           <> v_line.quantity_dispatched
        THEN
            RAISE EXCEPTION 'all receipt quantities must be entered for each line';
        END IF;

        IF v_line.quantity_damaged > 0 OR v_line.quantity_lost > 0 THEN
            v_has_discrepancy := TRUE;
        END IF;
    END LOOP;

    v_final_status := CASE
        WHEN v_has_discrepancy THEN 'RECEIPT_DISCREPANCY'::public.stock_transfer_status
        ELSE 'FULLY_COMPLETED'::public.stock_transfer_status
    END;

    UPDATE public.stock_transfers
    SET current_status = v_final_status,
        updated_at = NOW()
    WHERE id = p_transfer_id
      AND tenant_id = v_tenant_id;

    RETURN p_transfer_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_stock_transfer(p_transfer_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_tenant_id UUID;
    v_status public.stock_transfer_status;
BEGIN
    v_tenant_id := private.current_tenant_id();
    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'tenant context missing from session';
    END IF;

    IF p_transfer_id IS NULL THEN
        RAISE EXCEPTION 'transfer id is required';
    END IF;

    SELECT current_status
    INTO v_status
    FROM public.stock_transfers
    WHERE id = p_transfer_id
      AND tenant_id = v_tenant_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'transfer not found';
    END IF;

    IF v_status <> 'DRAFT' THEN
        RAISE EXCEPTION 'only draft transfers can be cancelled';
    END IF;

    UPDATE public.stock_transfers
    SET current_status = 'CANCELLED'::public.stock_transfer_status,
        updated_at = NOW()
    WHERE id = p_transfer_id
      AND tenant_id = v_tenant_id;

    RETURN p_transfer_id;
END;
$$;

REVOKE ALL ON FUNCTION public.save_stock_transfer(
    UUID, UUID, UUID, JSONB, UUID, NUMERIC, NUMERIC, NUMERIC
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_stock_transfer(
    UUID, UUID, UUID, JSONB, UUID, NUMERIC, NUMERIC, NUMERIC
) TO authenticated;

REVOKE ALL ON FUNCTION public.dispatch_stock_transfer(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.dispatch_stock_transfer(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.receive_stock_transfer(UUID, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.receive_stock_transfer(UUID, JSONB) TO authenticated;

REVOKE ALL ON FUNCTION public.cancel_stock_transfer(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_stock_transfer(UUID) TO authenticated;

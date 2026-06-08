-- Procurement GRN V1: PO draft/issue + goods receipt posting RPCs.
-- Reuses goods_receipt_items_post_stocking trigger for inventory_ledger.

CREATE OR REPLACE FUNCTION public.reconcile_document_sequence(
    p_tenant_id UUID,
    p_voucher_type public.document_voucher_type,
    p_location_id UUID,
    p_prefix TEXT DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_prefix TEXT;
    v_padding INTEGER;
    v_scope_location_id UUID;
    v_uses_location_scope BOOLEAN;
    v_max_suffix INTEGER := 0;
    v_next INTEGER;
    v_number TEXT;
    v_suffix_text TEXT;
BEGIN
    IF p_tenant_id IS NULL THEN
        RAISE EXCEPTION 'tenant id is required';
    END IF;
    IF p_location_id IS NULL THEN
        RAISE EXCEPTION 'location id is required';
    END IF;

    IF p_prefix IS NOT NULL THEN
        v_prefix := btrim(p_prefix);
    ELSE
        SELECT prefix, padding_length, uses_location_scope
        INTO v_prefix, v_padding, v_uses_location_scope
        FROM private.resolve_effective_naming_entry(p_tenant_id, p_location_id, p_voucher_type);

        v_scope_location_id := CASE
            WHEN v_uses_location_scope THEN p_location_id
            ELSE NULL
        END;
    END IF;

    IF v_prefix IS NULL OR v_prefix = '' THEN
        RAISE EXCEPTION 'document prefix not configured for % at location %', p_voucher_type, p_location_id;
    END IF;

    IF p_voucher_type = 'STOCK_ADJUSTMENT' THEN
        FOR v_number IN
            SELECT adjustment_number
            FROM public.stock_adjustments
            WHERE tenant_id = p_tenant_id
              AND location_id = p_location_id
              AND adjustment_number LIKE v_prefix || '%'
        LOOP
            v_suffix_text := substring(v_number from length(v_prefix) + 1);
            IF v_suffix_text ~ '^[0-9]+$' THEN
                v_max_suffix := GREATEST(v_max_suffix, v_suffix_text::INTEGER);
            END IF;
        END LOOP;
    ELSIF p_voucher_type = 'STOCK_TRANSFER' THEN
        FOR v_number IN
            SELECT transfer_number
            FROM public.stock_transfers
            WHERE tenant_id = p_tenant_id
              AND (source_location_id = p_location_id OR destination_location_id = p_location_id)
              AND transfer_number LIKE v_prefix || '%'
        LOOP
            v_suffix_text := substring(v_number from length(v_prefix) + 1);
            IF v_suffix_text ~ '^[0-9]+$' THEN
                v_max_suffix := GREATEST(v_max_suffix, v_suffix_text::INTEGER);
            END IF;
        END LOOP;
    ELSIF p_voucher_type = 'GOODS_RECEIPT_NOTE' THEN
        FOR v_number IN
            SELECT voucher_number
            FROM public.goods_receipts
            WHERE tenant_id = p_tenant_id
              AND destination_location_id = p_location_id
              AND voucher_number LIKE v_prefix || '%'
        LOOP
            v_suffix_text := substring(v_number from length(v_prefix) + 1);
            IF v_suffix_text ~ '^[0-9]+$' THEN
                v_max_suffix := GREATEST(v_max_suffix, v_suffix_text::INTEGER);
            END IF;
        END LOOP;
    ELSIF p_voucher_type = 'PURCHASE_ORDER' THEN
        FOR v_number IN
            SELECT voucher_number
            FROM public.purchase_orders
            WHERE tenant_id = p_tenant_id
              AND destination_location_id = p_location_id
              AND voucher_number LIKE v_prefix || '%'
        LOOP
            v_suffix_text := substring(v_number from length(v_prefix) + 1);
            IF v_suffix_text ~ '^[0-9]+$' THEN
                v_max_suffix := GREATEST(v_max_suffix, v_suffix_text::INTEGER);
            END IF;
        END LOOP;
    END IF;

    v_next := v_max_suffix + 1;

    IF p_prefix IS NOT NULL THEN
        v_scope_location_id := p_location_id;
        v_padding := 5;
    END IF;

    UPDATE public.document_sequences
    SET next_value = GREATEST(next_value, v_next),
        updated_at = NOW()
    WHERE tenant_id = p_tenant_id
      AND voucher_type = p_voucher_type
      AND prefix = v_prefix
      AND location_id IS NOT DISTINCT FROM COALESCE(v_scope_location_id, p_location_id);

    IF NOT FOUND THEN
        INSERT INTO public.document_sequences (
            tenant_id, location_id, voucher_type, prefix, next_value, padding_length
        )
        VALUES (
            p_tenant_id,
            COALESCE(v_scope_location_id, p_location_id),
            p_voucher_type,
            v_prefix,
            v_next,
            COALESCE(v_padding, 5)
        );
    END IF;

    RETURN v_next;
END;
$$;

CREATE OR REPLACE FUNCTION public.save_purchase_order(
    p_purchase_order_id UUID,
    p_destination_location_id UUID,
    p_supplier_id UUID,
    p_lines JSONB,
    p_created_by UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_tenant_id UUID;
    v_location RECORD;
    v_supplier RECORD;
    v_po_id UUID;
    v_voucher_number TEXT;
    v_entry JSONB;
    v_variant_id UUID;
    v_item_id UUID;
    v_uom TEXT;
    v_qty NUMERIC(15, 4);
    v_unit_price NUMERIC(15, 4);
    v_line_gross NUMERIC(15, 4);
    v_tracking public.item_tracking_mode;
    v_track_inventory BOOLEAN;
    v_total_gross NUMERIC(15, 4) := 0;
    v_line_count INTEGER := 0;
BEGIN
    v_tenant_id := private.current_tenant_id();
    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'tenant context missing from session';
    END IF;

    IF p_created_by IS NULL THEN
        RAISE EXCEPTION 'created_by is required';
    END IF;

    IF p_destination_location_id IS NULL THEN
        RAISE EXCEPTION 'destination location is required';
    END IF;

    IF p_supplier_id IS NULL THEN
        RAISE EXCEPTION 'supplier is required';
    END IF;

    IF p_lines IS NULL OR jsonb_typeof(p_lines) IS DISTINCT FROM 'array' OR jsonb_array_length(p_lines) = 0 THEN
        RAISE EXCEPTION 'at least one purchase order line is required';
    END IF;

    SELECT id, code, is_stock_holding, presence_type
    INTO v_location
    FROM public.tenant_locations
    WHERE id = p_destination_location_id
      AND tenant_id = v_tenant_id
      AND is_active = TRUE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'destination location not found';
    END IF;

    IF NOT COALESCE(v_location.is_stock_holding, FALSE) OR v_location.presence_type = 'VIRTUAL' THEN
        RAISE EXCEPTION 'destination location cannot hold inventory';
    END IF;

    SELECT id, type
    INTO v_supplier
    FROM public.entities
    WHERE id = p_supplier_id
      AND tenant_id = v_tenant_id
      AND is_active = TRUE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'supplier not found';
    END IF;

    IF v_supplier.type NOT IN ('SUPPLIER', 'MUTUAL_PARTNER') THEN
        RAISE EXCEPTION 'entity is not a supplier';
    END IF;

    IF p_purchase_order_id IS NOT NULL THEN
        SELECT id, document_status
        INTO v_po_id
        FROM public.purchase_orders
        WHERE id = p_purchase_order_id
          AND tenant_id = v_tenant_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'purchase order not found';
        END IF;

        IF (SELECT document_status FROM public.purchase_orders WHERE id = p_purchase_order_id)
            <> 'DRAFT'::public.purchase_document_status
        THEN
            RAISE EXCEPTION 'only draft purchase orders can be edited';
        END IF;

        UPDATE public.purchase_orders
        SET destination_location_id = p_destination_location_id,
            supplier_id = p_supplier_id,
            updated_at = NOW()
        WHERE id = p_purchase_order_id;

        DELETE FROM public.purchase_order_items
        WHERE purchase_order_id = p_purchase_order_id
          AND tenant_id = v_tenant_id;

        v_po_id := p_purchase_order_id;
    ELSE
        v_voucher_number := public.generate_next_voucher_string(
            v_tenant_id,
            'PURCHASE_ORDER'::public.document_voucher_type,
            NULL,
            p_destination_location_id
        );

        INSERT INTO public.purchase_orders (
            tenant_id,
            destination_location_id,
            supplier_id,
            voucher_number,
            document_status,
            created_by
        )
        VALUES (
            v_tenant_id,
            p_destination_location_id,
            p_supplier_id,
            v_voucher_number,
            'DRAFT'::public.purchase_document_status,
            p_created_by
        )
        RETURNING id INTO v_po_id;
    END IF;

    FOR v_entry IN SELECT value FROM jsonb_array_elements(p_lines)
    LOOP
        v_variant_id := NULLIF(v_entry ->> 'variant_id', '')::UUID;
        v_qty := NULLIF(v_entry ->> 'quantity_ordered', '')::NUMERIC;
        v_unit_price := COALESCE(NULLIF(v_entry ->> 'unit_price_contractual', '')::NUMERIC, 0);

        IF v_variant_id IS NULL THEN
            RAISE EXCEPTION 'variant_id is required on each line';
        END IF;

        IF v_qty IS NULL OR v_qty <= 0 THEN
            RAISE EXCEPTION 'quantity_ordered must be greater than zero';
        END IF;

        IF v_unit_price < 0 THEN
            RAISE EXCEPTION 'unit_price_contractual cannot be negative';
        END IF;

        SELECT iv.item_id, i.track_inventory, i.tracking_mode, i.base_unit_of_measure
        INTO v_item_id, v_track_inventory, v_tracking, v_uom
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
            RAISE EXCEPTION 'lot and serial tracking are not supported in purchase orders yet';
        END IF;

        v_line_gross := v_qty * v_unit_price;
        v_total_gross := v_total_gross + v_line_gross;

        INSERT INTO public.purchase_order_items (
            tenant_id,
            purchase_order_id,
            item_id,
            variant_id,
            uom_code,
            quantity_ordered,
            unit_price_contractual,
            line_total_gross
        )
        VALUES (
            v_tenant_id,
            v_po_id,
            v_item_id,
            v_variant_id,
            COALESCE(NULLIF(btrim(v_uom), ''), 'PCS'),
            v_qty,
            v_unit_price,
            v_line_gross
        );

        v_line_count := v_line_count + 1;
    END LOOP;

    IF v_line_count = 0 THEN
        RAISE EXCEPTION 'no valid purchase order lines were saved';
    END IF;

    UPDATE public.purchase_orders
    SET total_gross_amount = v_total_gross,
        total_tax_amount = 0,
        total_net_amount = v_total_gross,
        updated_at = NOW()
    WHERE id = v_po_id;

    RETURN v_po_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.issue_purchase_order(p_purchase_order_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_tenant_id UUID;
    v_po RECORD;
    v_line_count INTEGER;
BEGIN
    v_tenant_id := private.current_tenant_id();
    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'tenant context missing from session';
    END IF;

    IF p_purchase_order_id IS NULL THEN
        RAISE EXCEPTION 'purchase order id is required';
    END IF;

    SELECT *
    INTO v_po
    FROM public.purchase_orders
    WHERE id = p_purchase_order_id
      AND tenant_id = v_tenant_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'purchase order not found';
    END IF;

    IF v_po.document_status <> 'DRAFT'::public.purchase_document_status THEN
        RAISE EXCEPTION 'only draft purchase orders can be issued';
    END IF;

    SELECT COUNT(*)
    INTO v_line_count
    FROM public.purchase_order_items
    WHERE purchase_order_id = p_purchase_order_id
      AND tenant_id = v_tenant_id;

    IF v_line_count < 1 THEN
        RAISE EXCEPTION 'purchase order must have at least one line before issue';
    END IF;

    UPDATE public.purchase_orders
    SET document_status = 'ISSUED_ACTIVE'::public.purchase_document_status,
        updated_at = NOW()
    WHERE id = p_purchase_order_id;

    RETURN p_purchase_order_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.post_goods_receipt(
    p_destination_location_id UUID,
    p_purchase_order_id UUID,
    p_lines JSONB,
    p_created_by UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_tenant_id UUID;
    v_location RECORD;
    v_po RECORD;
    v_gr_id UUID;
    v_voucher_number TEXT;
    v_entry JSONB;
    v_variant_id UUID;
    v_item_id UUID;
    v_po_item_id UUID;
    v_qty NUMERIC(15, 4);
    v_unit_cost NUMERIC(15, 4);
    v_open_qty NUMERIC(15, 4);
    v_po_item RECORD;
    v_tracking public.item_tracking_mode;
    v_track_inventory BOOLEAN;
    v_line_count INTEGER := 0;
    v_all_fulfilled BOOLEAN := TRUE;
    v_any_received BOOLEAN := FALSE;
    v_po_line RECORD;
BEGIN
    v_tenant_id := private.current_tenant_id();
    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'tenant context missing from session';
    END IF;

    IF p_created_by IS NULL THEN
        RAISE EXCEPTION 'created_by is required';
    END IF;

    IF p_destination_location_id IS NULL THEN
        RAISE EXCEPTION 'destination location is required';
    END IF;

    IF p_lines IS NULL OR jsonb_typeof(p_lines) IS DISTINCT FROM 'array' OR jsonb_array_length(p_lines) = 0 THEN
        RAISE EXCEPTION 'at least one receipt line is required';
    END IF;

    SELECT id, code, is_stock_holding, presence_type
    INTO v_location
    FROM public.tenant_locations
    WHERE id = p_destination_location_id
      AND tenant_id = v_tenant_id
      AND is_active = TRUE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'destination location not found';
    END IF;

    IF NOT COALESCE(v_location.is_stock_holding, FALSE) OR v_location.presence_type = 'VIRTUAL' THEN
        RAISE EXCEPTION 'destination location cannot hold inventory';
    END IF;

    IF p_purchase_order_id IS NOT NULL THEN
        SELECT *
        INTO v_po
        FROM public.purchase_orders
        WHERE id = p_purchase_order_id
          AND tenant_id = v_tenant_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'purchase order not found';
        END IF;

        IF v_po.document_status NOT IN (
            'ISSUED_ACTIVE'::public.purchase_document_status,
            'PARTIALLY_FULFILLED'::public.purchase_document_status
        ) THEN
            RAISE EXCEPTION 'purchase order is not open for receiving';
        END IF;

        IF v_po.destination_location_id <> p_destination_location_id THEN
            RAISE EXCEPTION 'destination location must match purchase order destination';
        END IF;
    END IF;

    v_voucher_number := public.generate_next_voucher_string(
        v_tenant_id,
        'GOODS_RECEIPT_NOTE'::public.document_voucher_type,
        NULL,
        p_destination_location_id
    );

    INSERT INTO public.goods_receipts (
        tenant_id,
        destination_location_id,
        purchase_order_id,
        voucher_number,
        created_by
    )
    VALUES (
        v_tenant_id,
        p_destination_location_id,
        p_purchase_order_id,
        v_voucher_number,
        p_created_by
    )
    RETURNING id INTO v_gr_id;

    FOR v_entry IN SELECT value FROM jsonb_array_elements(p_lines)
    LOOP
        v_variant_id := NULLIF(v_entry ->> 'variant_id', '')::UUID;
        v_po_item_id := NULLIF(v_entry ->> 'po_item_id', '')::UUID;
        v_qty := NULLIF(v_entry ->> 'quantity_received', '')::NUMERIC;
        v_unit_cost := COALESCE(NULLIF(v_entry ->> 'raw_unit_cost', '')::NUMERIC, 0);

        IF v_variant_id IS NULL THEN
            RAISE EXCEPTION 'variant_id is required on each line';
        END IF;

        IF v_qty IS NULL OR v_qty <= 0 THEN
            RAISE EXCEPTION 'quantity_received must be greater than zero';
        END IF;

        IF v_unit_cost <= 0 THEN
            RAISE EXCEPTION 'raw_unit_cost is required for receipt lines';
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
            RAISE EXCEPTION 'lot and serial tracking are not supported in goods receipts yet';
        END IF;

        IF p_purchase_order_id IS NOT NULL THEN
            IF v_po_item_id IS NULL THEN
                RAISE EXCEPTION 'po_item_id is required when receiving against a purchase order';
            END IF;

            SELECT *
            INTO v_po_item
            FROM public.purchase_order_items
            WHERE id = v_po_item_id
              AND tenant_id = v_tenant_id
              AND purchase_order_id = p_purchase_order_id;

            IF NOT FOUND THEN
                RAISE EXCEPTION 'purchase order line % not found on this order', v_po_item_id;
            END IF;

            IF v_po_item.variant_id IS DISTINCT FROM v_variant_id THEN
                RAISE EXCEPTION 'variant does not match purchase order line';
            END IF;

            v_open_qty := v_po_item.quantity_ordered - v_po_item.quantity_received;
            IF v_qty > v_open_qty THEN
                RAISE EXCEPTION 'quantity_received exceeds open purchase order quantity for line %', v_po_item_id;
            END IF;
        END IF;

        INSERT INTO public.goods_receipt_items (
            tenant_id,
            goods_receipt_id,
            po_item_id,
            item_id,
            variant_id,
            quantity_received,
            quantity_accepted,
            quantity_rejected,
            raw_unit_cost,
            allocated_landed_cost,
            total_final_landed_cost
        )
        VALUES (
            v_tenant_id,
            v_gr_id,
            v_po_item_id,
            v_item_id,
            v_variant_id,
            v_qty,
            v_qty,
            0,
            v_unit_cost,
            0,
            v_unit_cost
        );

        IF p_purchase_order_id IS NOT NULL AND v_po_item_id IS NOT NULL THEN
            UPDATE public.purchase_order_items
            SET quantity_received = quantity_received + v_qty,
                updated_at = NOW()
            WHERE id = v_po_item_id
              AND tenant_id = v_tenant_id;
        END IF;

        INSERT INTO public.item_variant_locations (
            tenant_id, item_id, variant_id, location_id,
            is_stocked, is_sellable, is_orderable
        )
        VALUES (
            v_tenant_id, v_item_id, v_variant_id, p_destination_location_id,
            TRUE, FALSE, FALSE
        )
        ON CONFLICT (variant_id, location_id)
        DO UPDATE SET
            is_stocked = TRUE,
            updated_at = NOW();

        v_line_count := v_line_count + 1;
    END LOOP;

    IF v_line_count = 0 THEN
        RAISE EXCEPTION 'no valid receipt lines were posted';
    END IF;

    IF p_purchase_order_id IS NOT NULL THEN
        INSERT INTO public.purchase_order_grn_mappings (
            tenant_id,
            purchase_order_id,
            goods_receipt_id,
            mapped_by
        )
        VALUES (
            v_tenant_id,
            p_purchase_order_id,
            v_gr_id,
            p_created_by
        )
        ON CONFLICT (purchase_order_id, goods_receipt_id) DO NOTHING;

        FOR v_po_line IN
            SELECT quantity_ordered, quantity_received
            FROM public.purchase_order_items
            WHERE purchase_order_id = p_purchase_order_id
              AND tenant_id = v_tenant_id
        LOOP
            IF v_po_line.quantity_received > 0 THEN
                v_any_received := TRUE;
            END IF;
            IF v_po_line.quantity_received < v_po_line.quantity_ordered THEN
                v_all_fulfilled := FALSE;
            END IF;
        END LOOP;

        UPDATE public.purchase_orders
        SET document_status = CASE
                WHEN v_all_fulfilled AND v_any_received THEN 'FULLY_COMPLETED'::public.purchase_document_status
                WHEN v_any_received THEN 'PARTIALLY_FULFILLED'::public.purchase_document_status
                ELSE document_status
            END,
            updated_at = NOW()
        WHERE id = p_purchase_order_id;
    END IF;

    RETURN v_gr_id;
END;
$$;

REVOKE ALL ON FUNCTION public.reconcile_document_sequence(UUID, public.document_voucher_type, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reconcile_document_sequence(UUID, public.document_voucher_type, UUID, TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.save_purchase_order(UUID, UUID, UUID, JSONB, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_purchase_order(UUID, UUID, UUID, JSONB, UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.issue_purchase_order(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.issue_purchase_order(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.post_goods_receipt(UUID, UUID, JSONB, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.post_goods_receipt(UUID, UUID, JSONB, UUID) TO authenticated;

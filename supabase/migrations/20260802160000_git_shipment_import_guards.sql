-- Import-only GIT posting guards + shipment linkage + location-scoped numbering
-- Enum GOODS_IN_TRANSIT: see 20260802125000_import_logistics_enum_values.sql (55P04)

DROP FUNCTION IF EXISTS public.post_goods_in_transit(UUID, UUID, JSONB, UUID, UUID, TEXT);

CREATE OR REPLACE FUNCTION public.post_goods_in_transit(
    p_source_location_id UUID,
    p_git_holding_location_id UUID,
    p_lines JSONB,
    p_created_by UUID,
    p_purchase_order_id UUID DEFAULT NULL,
    p_notes TEXT DEFAULT NULL,
    p_shipment_id UUID DEFAULT NULL
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
    v_po public.purchase_orders%ROWTYPE;
    v_entry JSONB;
    v_variant_id UUID;
    v_item_id UUID;
    v_po_item_id UUID;
    v_qty NUMERIC(15, 4);
    v_unit_cost NUMERIC(15, 4);
    v_on_hand NUMERIC(15, 4);
    v_reference TEXT;
    v_line_count INTEGER := 0;
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
        SELECT * INTO v_po FROM public.purchase_orders
        WHERE id = p_purchase_order_id AND tenant_id = v_tenant_id;
        IF NOT FOUND THEN RAISE EXCEPTION 'purchase order not found'; END IF;
        IF v_po.tax_supply_nature IS DISTINCT FROM 'IMPORT_GOODS' THEN
            RAISE EXCEPTION 'goods in transit is only available for import purchase orders';
        END IF;
    ELSIF p_shipment_id IS NULL THEN
        RAISE EXCEPTION 'import GIT requires a purchase order or shipment reference';
    END IF;

    IF p_shipment_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.import_shipments
            WHERE id = p_shipment_id AND tenant_id = v_tenant_id
        ) THEN
            RAISE EXCEPTION 'import shipment not found';
        END IF;
    END IF;

    v_voucher_number := public.generate_next_voucher_string(
        v_tenant_id, 'GOODS_IN_TRANSIT'::public.document_voucher_type, NULL, p_git_holding_location_id
    );

    INSERT INTO public.goods_in_transit_vouchers (
        tenant_id, voucher_number, status,
        source_location_id, git_holding_location_id, destination_location_id,
        purchase_order_id, shipment_id, notes, created_by, posted_at
    )
    VALUES (
        v_tenant_id, v_voucher_number, 'POSTED',
        p_source_location_id, p_git_holding_location_id, NULL,
        p_purchase_order_id, p_shipment_id, NULLIF(btrim(p_notes), ''), p_created_by, NOW()
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

        v_line_count := v_line_count + 1;
    END LOOP;

    IF v_line_count = 0 THEN RAISE EXCEPTION 'no valid GIT lines were posted'; END IF;

    RETURN jsonb_build_object(
        'voucher_id', v_voucher_id,
        'voucher_number', v_voucher_number,
        'line_count', v_line_count,
        'status', 'POSTED'
    );
END;
$$;

REVOKE ALL ON FUNCTION public.post_goods_in_transit(UUID, UUID, JSONB, UUID, UUID, TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.post_goods_in_transit(UUID, UUID, JSONB, UUID, UUID, TEXT, UUID) TO authenticated;

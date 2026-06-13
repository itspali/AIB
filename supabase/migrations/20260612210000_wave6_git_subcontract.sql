-- Wave 6: GIT holding locations, goods-in-transit vouchers, subcontract job work

-- --------------------------------------------------------------------
-- 1. Extend goods_in_transit_vouchers + line items
-- --------------------------------------------------------------------
ALTER TABLE public.goods_in_transit_vouchers
    ADD COLUMN IF NOT EXISTS purchase_order_id UUID REFERENCES public.purchase_orders(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS source_location_id UUID REFERENCES public.tenant_locations(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS git_holding_location_id UUID REFERENCES public.tenant_locations(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS goods_receipt_id UUID REFERENCES public.goods_receipts(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS posted_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS cleared_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS notes TEXT;

ALTER TABLE public.goods_in_transit_vouchers
    DROP CONSTRAINT IF EXISTS goods_in_transit_vouchers_status_chk;

ALTER TABLE public.goods_in_transit_vouchers
    ADD CONSTRAINT goods_in_transit_vouchers_status_chk
    CHECK (status IN ('DRAFT', 'POSTED', 'CLEARED', 'CANCELLED'));

CREATE TABLE IF NOT EXISTS public.goods_in_transit_voucher_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    goods_in_transit_voucher_id UUID NOT NULL REFERENCES public.goods_in_transit_vouchers(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES public.items(id) ON DELETE RESTRICT,
    variant_id UUID REFERENCES public.item_variants(id) ON DELETE SET NULL,
    po_item_id UUID REFERENCES public.purchase_order_items(id) ON DELETE SET NULL,
    quantity NUMERIC(15, 4) NOT NULL CHECK (quantity > 0),
    unit_cost NUMERIC(15, 4) NOT NULL DEFAULT 0.0000 CHECK (unit_cost >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.goods_in_transit_voucher_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS goods_in_transit_voucher_items_tenant_isolation
    ON public.goods_in_transit_voucher_items;

CREATE POLICY goods_in_transit_voucher_items_tenant_isolation
    ON public.goods_in_transit_voucher_items FOR ALL TO authenticated
    USING (tenant_id = private.current_tenant_id())
    WITH CHECK (tenant_id = private.current_tenant_id());

CREATE UNIQUE INDEX IF NOT EXISTS subcontract_bom_lines_parent_component_uq
    ON public.subcontract_bom_lines (tenant_id, parent_item_id, component_item_id);

-- --------------------------------------------------------------------
-- 2. Location inventory helper (GIT / subcontract WIP virtual nodes)
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.location_allows_inventory_storage(p_location_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_row public.tenant_locations%ROWTYPE;
BEGIN
    SELECT * INTO v_row
    FROM public.tenant_locations
    WHERE id = p_location_id
      AND tenant_id = private.current_tenant_id()
      AND is_active = TRUE;

    IF NOT FOUND THEN RETURN FALSE; END IF;
    IF NOT COALESCE(v_row.is_stock_holding, FALSE) THEN RETURN FALSE; END IF;
    IF v_row.presence_type = 'VIRTUAL'
       AND NOT COALESCE(v_row.is_git_holding, FALSE)
       AND NOT COALESCE(v_row.is_subcontract_wip, FALSE) THEN
        RETURN FALSE;
    END IF;
    RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_location_logistics_flags(
    p_location_id UUID,
    p_is_git_holding BOOLEAN DEFAULT FALSE,
    p_is_subcontract_wip BOOLEAN DEFAULT FALSE
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_tenant_id UUID;
BEGIN
    v_tenant_id := private.current_tenant_id();
    IF v_tenant_id IS NULL THEN RAISE EXCEPTION 'tenant context missing from session'; END IF;
    IF p_location_id IS NULL THEN RAISE EXCEPTION 'location id is required'; END IF;

    UPDATE public.tenant_locations
    SET is_git_holding = COALESCE(p_is_git_holding, FALSE),
        is_subcontract_wip = COALESCE(p_is_subcontract_wip, FALSE),
        updated_at = NOW()
    WHERE id = p_location_id AND tenant_id = v_tenant_id;

    IF NOT FOUND THEN RAISE EXCEPTION 'location not found'; END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.update_location_logistics_flags(UUID, BOOLEAN, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_location_logistics_flags(UUID, BOOLEAN, BOOLEAN) TO authenticated;

-- --------------------------------------------------------------------
-- 3. post_goods_in_transit — move stock source → GIT holding
-- --------------------------------------------------------------------
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

REVOKE ALL ON FUNCTION public.post_goods_in_transit(UUID, UUID, JSONB, UUID, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.post_goods_in_transit(UUID, UUID, JSONB, UUID, UUID, TEXT) TO authenticated;

-- --------------------------------------------------------------------
-- 4. clear_goods_in_transit_for_grn — GIT holding → destination clearance
-- --------------------------------------------------------------------
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

        v_cleared_qty := v_cleared_qty + v_qty;
    END LOOP;

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

REVOKE ALL ON FUNCTION public.clear_goods_in_transit_for_grn(UUID, UUID, JSONB, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.clear_goods_in_transit_for_grn(UUID, UUID, JSONB, UUID) TO authenticated;

-- --------------------------------------------------------------------
-- 5. Vendor job work + subcontract BOM
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.save_vendor_job_work_location(
    p_supplier_id UUID,
    p_location_id UUID,
    p_is_active BOOLEAN DEFAULT TRUE
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_tenant_id UUID;
    v_id UUID;
BEGIN
    v_tenant_id := private.current_tenant_id();
    IF v_tenant_id IS NULL THEN RAISE EXCEPTION 'tenant context missing from session'; END IF;
    IF p_supplier_id IS NULL OR p_location_id IS NULL THEN
        RAISE EXCEPTION 'supplier and location are required';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.entities
        WHERE id = p_supplier_id AND tenant_id = v_tenant_id AND type = 'SUPPLIER'
    ) THEN
        RAISE EXCEPTION 'supplier not found';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.tenant_locations
        WHERE id = p_location_id AND tenant_id = v_tenant_id
          AND COALESCE(is_subcontract_wip, FALSE) = TRUE
    ) THEN
        RAISE EXCEPTION 'location must be flagged as subcontract WIP';
    END IF;

    INSERT INTO public.vendor_job_work_locations (
        tenant_id, supplier_id, location_id, is_active
    )
    VALUES (
        v_tenant_id, p_supplier_id, p_location_id, COALESCE(p_is_active, TRUE)
    )
    ON CONFLICT (tenant_id, supplier_id, location_id)
    DO UPDATE SET is_active = COALESCE(p_is_active, TRUE)
    RETURNING id INTO v_id;

    RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.save_subcontract_bom_lines(
    p_parent_item_id UUID,
    p_lines JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_tenant_id UUID;
    v_entry JSONB;
    v_component_item_id UUID;
    v_qty NUMERIC(15, 4);
    v_count INTEGER := 0;
BEGIN
    v_tenant_id := private.current_tenant_id();
    IF v_tenant_id IS NULL THEN RAISE EXCEPTION 'tenant context missing from session'; END IF;
    IF p_parent_item_id IS NULL THEN RAISE EXCEPTION 'parent item is required'; END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.items WHERE id = p_parent_item_id AND tenant_id = v_tenant_id
    ) THEN
        RAISE EXCEPTION 'parent item not found';
    END IF;

    DELETE FROM public.subcontract_bom_lines
    WHERE tenant_id = v_tenant_id AND parent_item_id = p_parent_item_id;

    IF p_lines IS NULL OR jsonb_typeof(p_lines) IS DISTINCT FROM 'array' THEN
        RETURN jsonb_build_object('line_count', 0);
    END IF;

    FOR v_entry IN SELECT value FROM jsonb_array_elements(p_lines)
    LOOP
        v_component_item_id := NULLIF(v_entry ->> 'component_item_id', '')::UUID;
        v_qty := COALESCE(NULLIF(v_entry ->> 'quantity_per', '')::NUMERIC, 0);

        IF v_component_item_id IS NULL OR v_qty <= 0 THEN CONTINUE; END IF;

        IF NOT EXISTS (
            SELECT 1 FROM public.items
            WHERE id = v_component_item_id AND tenant_id = v_tenant_id
        ) THEN
            RAISE EXCEPTION 'component item not found';
        END IF;

        INSERT INTO public.subcontract_bom_lines (
            tenant_id, parent_item_id, component_item_id, quantity_per
        )
        VALUES (v_tenant_id, p_parent_item_id, v_component_item_id, v_qty);

        v_count := v_count + 1;
    END LOOP;

    RETURN jsonb_build_object('line_count', v_count);
END;
$$;

-- --------------------------------------------------------------------
-- 6. apply_subcontract_backflush_for_grn
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.apply_subcontract_backflush_for_grn(p_goods_receipt_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_tenant_id UUID;
    v_gr public.goods_receipts%ROWTYPE;
    v_po public.purchase_orders%ROWTYPE;
    v_job_location_id UUID;
    v_line RECORD;
    v_bom RECORD;
    v_consume_qty NUMERIC(15, 4);
    v_unit_cost NUMERIC(15, 4);
    v_on_hand NUMERIC(15, 4);
    v_reference TEXT;
    v_total_consumed NUMERIC(15, 4) := 0;
    v_line_count INTEGER := 0;
BEGIN
    v_tenant_id := private.current_tenant_id();
    IF v_tenant_id IS NULL THEN RAISE EXCEPTION 'tenant context missing from session'; END IF;

    SELECT * INTO v_gr
    FROM public.goods_receipts
    WHERE id = p_goods_receipt_id AND tenant_id = v_tenant_id;

    IF NOT FOUND THEN RAISE EXCEPTION 'goods receipt not found'; END IF;
    IF v_gr.purchase_order_id IS NULL THEN
        RETURN jsonb_build_object('skipped', TRUE, 'reason', 'standalone_receipt');
    END IF;

    SELECT * INTO v_po
    FROM public.purchase_orders
    WHERE id = v_gr.purchase_order_id AND tenant_id = v_tenant_id;

    IF NOT FOUND THEN RAISE EXCEPTION 'purchase order not found'; END IF;

    SELECT vjw.location_id INTO v_job_location_id
    FROM public.vendor_job_work_locations vjw
    WHERE vjw.tenant_id = v_tenant_id
      AND vjw.supplier_id = v_po.supplier_id
      AND vjw.is_active = TRUE
    ORDER BY vjw.created_at
    LIMIT 1;

    IF v_job_location_id IS NULL THEN
        RETURN jsonb_build_object('skipped', TRUE, 'reason', 'no_subcontract_location');
    END IF;

    v_reference := v_gr.voucher_number || '|SUBCONTRACT-BACKFLUSH';

    FOR v_line IN
        SELECT gri.*, i.id AS finished_item_id
        FROM public.goods_receipt_items gri
        INNER JOIN public.items i ON i.id = gri.item_id AND i.tenant_id = gri.tenant_id
        WHERE gri.goods_receipt_id = p_goods_receipt_id
          AND gri.tenant_id = v_tenant_id
          AND COALESCE(gri.is_promotional, FALSE) = FALSE
          AND COALESCE(gri.quantity_accepted, gri.quantity_received) > 0
    LOOP
        FOR v_bom IN
            SELECT sbl.component_item_id, sbl.quantity_per, iv.id AS component_variant_id
            FROM public.subcontract_bom_lines sbl
            LEFT JOIN LATERAL (
                SELECT id FROM public.item_variants
                WHERE tenant_id = v_tenant_id
                  AND item_id = sbl.component_item_id
                  AND is_active = TRUE
                ORDER BY created_at
                LIMIT 1
            ) iv ON TRUE
            WHERE sbl.tenant_id = v_tenant_id
              AND sbl.parent_item_id = v_line.item_id
        LOOP
            IF v_bom.component_variant_id IS NULL THEN CONTINUE; END IF;

            v_consume_qty := private.money_round(
                v_bom.quantity_per * COALESCE(v_line.quantity_accepted, v_line.quantity_received)
            );
            IF v_consume_qty <= 0 THEN CONTINUE; END IF;

            v_unit_cost := private.get_item_average_cost(
                v_tenant_id, v_job_location_id, v_bom.component_item_id, v_bom.component_variant_id
            );

            v_on_hand := private.get_item_valuation_on_hand(
                v_tenant_id, v_job_location_id, v_bom.component_item_id, v_bom.component_variant_id
            );

            IF v_on_hand < v_consume_qty THEN
                RAISE EXCEPTION 'insufficient subcontract WIP for component % at vendor location',
                    v_bom.component_item_id;
            END IF;

            INSERT INTO public.inventory_ledger (
                tenant_id, item_id, variant_id, location_id,
                transaction_type, quantity, cost_at_transaction,
                reference_document, created_by
            )
            VALUES (
                v_tenant_id, v_bom.component_item_id, v_bom.component_variant_id, v_job_location_id,
                'PRODUCTION_CONSUMPTION', -v_consume_qty, private.money_round(v_unit_cost),
                v_reference, v_gr.created_by
            );

            v_total_consumed := v_total_consumed + v_consume_qty;
            v_line_count := v_line_count + 1;
        END LOOP;
    END LOOP;

    RETURN jsonb_build_object(
        'goods_receipt_id', p_goods_receipt_id,
        'component_issues', v_line_count,
        'quantity_consumed', v_total_consumed
    );
END;
$$;

REVOKE ALL ON FUNCTION public.save_vendor_job_work_location(UUID, UUID, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_vendor_job_work_location(UUID, UUID, BOOLEAN) TO authenticated;

REVOKE ALL ON FUNCTION public.save_subcontract_bom_lines(UUID, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_subcontract_bom_lines(UUID, JSONB) TO authenticated;

REVOKE ALL ON FUNCTION public.apply_subcontract_backflush_for_grn(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_subcontract_backflush_for_grn(UUID) TO authenticated;

-- --------------------------------------------------------------------
-- 7. Relax stock transfer location validation
-- --------------------------------------------------------------------
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
    IF v_tenant_id IS NULL THEN RAISE EXCEPTION 'tenant context missing from session'; END IF;
    IF p_created_by IS NULL THEN RAISE EXCEPTION 'created_by is required'; END IF;
    IF p_source_location_id IS NULL OR p_destination_location_id IS NULL THEN
        RAISE EXCEPTION 'source and destination locations are required';
    END IF;
    IF p_source_location_id = p_destination_location_id THEN
        RAISE EXCEPTION 'source and destination must be different locations';
    END IF;
    IF p_lines IS NULL OR jsonb_typeof(p_lines) IS DISTINCT FROM 'array' OR jsonb_array_length(p_lines) = 0 THEN
        RAISE EXCEPTION 'at least one transfer line is required';
    END IF;

    IF NOT private.location_allows_inventory_storage(p_source_location_id) THEN
        RAISE EXCEPTION 'source location cannot hold inventory';
    END IF;

    IF NOT private.location_allows_inventory_storage(p_destination_location_id) THEN
        RAISE EXCEPTION 'destination location cannot hold inventory';
    END IF;

    IF p_transfer_id IS NOT NULL THEN
        SELECT id INTO v_transfer_id
        FROM public.stock_transfers
        WHERE id = p_transfer_id AND tenant_id = v_tenant_id;

        IF NOT FOUND THEN RAISE EXCEPTION 'transfer not found'; END IF;

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
        WHERE stock_transfer_id = p_transfer_id AND tenant_id = v_tenant_id;

        v_transfer_id := p_transfer_id;
    ELSE
        v_transfer_number := public.generate_next_voucher_string(
            v_tenant_id,
            'STOCK_TRANSFER'::public.document_voucher_type,
            NULL,
            p_source_location_id
        );

        INSERT INTO public.stock_transfers (
            tenant_id, transfer_number, source_location_id, destination_location_id,
            current_status, inter_company_freight_cost, loading_overhead_cost,
            unloading_overhead_cost, created_by
        )
        VALUES (
            v_tenant_id, v_transfer_number, p_source_location_id, p_destination_location_id,
            'DRAFT'::public.stock_transfer_status, COALESCE(p_inter_company_freight_cost, 0),
            COALESCE(p_loading_overhead_cost, 0), COALESCE(p_unloading_overhead_cost, 0),
            p_created_by
        )
        RETURNING id INTO v_transfer_id;
    END IF;

    FOR v_entry IN SELECT value FROM jsonb_array_elements(p_lines)
    LOOP
        v_variant_id := NULLIF(v_entry ->> 'variant_id', '')::UUID;
        v_qty := NULLIF(v_entry ->> 'quantity_dispatched', '')::NUMERIC;

        IF v_variant_id IS NULL THEN RAISE EXCEPTION 'variant_id is required on each line'; END IF;
        IF v_qty IS NULL OR v_qty <= 0 THEN RAISE EXCEPTION 'quantity_dispatched must be greater than zero'; END IF;

        SELECT iv.item_id, i.track_inventory, i.tracking_mode
        INTO v_item_id, v_track_inventory, v_tracking
        FROM public.item_variants iv
        INNER JOIN public.items i ON i.id = iv.item_id AND i.tenant_id = iv.tenant_id
        WHERE iv.id = v_variant_id AND iv.tenant_id = v_tenant_id AND iv.is_active = TRUE;

        IF NOT FOUND THEN RAISE EXCEPTION 'variant % not found', v_variant_id; END IF;
        IF NOT COALESCE(v_track_inventory, FALSE) THEN RAISE EXCEPTION 'item does not track inventory'; END IF;
        IF v_tracking IS DISTINCT FROM 'NONE'::public.item_tracking_mode THEN
            RAISE EXCEPTION 'lot and serial tracking are not supported in stock transfers yet';
        END IF;

        INSERT INTO public.stock_transfer_items (
            tenant_id, stock_transfer_id, item_id, variant_id, quantity_dispatched
        )
        VALUES (v_tenant_id, v_transfer_id, v_item_id, v_variant_id, v_qty);

        v_line_count := v_line_count + 1;
    END LOOP;

    IF v_line_count = 0 THEN RAISE EXCEPTION 'no valid transfer lines were saved'; END IF;

    RETURN v_transfer_id;
END;
$$;

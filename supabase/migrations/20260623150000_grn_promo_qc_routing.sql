-- Route promotional / free-goods GRN lines through QC when policy requires inspection.
-- Migration: 20260623150000_grn_promo_qc_routing.sql

-- --------------------------------------------------------------------
-- post_goods_receipt: allow QC routing for promotional accepted qty
-- --------------------------------------------------------------------
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
    p_import_igst_amount NUMERIC(15, 4) DEFAULT NULL,
    p_landed_charges JSONB DEFAULT '[]'::jsonb
)
RETURNS JSONB
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
    v_charge JSONB;
    v_variant_id UUID;
    v_po_item_id UUID;
    v_item_id UUID;
    v_gr_item_id UUID;
    v_qty NUMERIC(15, 4);
    v_unit_cost NUMERIC(15, 4);
    v_is_promotional BOOLEAN;
    v_po_item public.purchase_order_items%ROWTYPE;
    v_open_qty NUMERIC(15, 4);
    v_line_count INTEGER := 0;
    v_total_qty NUMERIC(15, 4) := 0;
    v_track_inventory BOOLEAN;
    v_tracking public.item_tracking_mode;
    v_total_line_value NUMERIC(20, 8) := 0;
    v_total_line_qty NUMERIC(20, 8) := 0;
    v_line_value NUMERIC(20, 8);
    v_import_igst_header NUMERIC(15, 4) := GREATEST(COALESCE(p_import_igst_amount, 0), 0);
    v_customs_duty_header NUMERIC(15, 4) := GREATEST(COALESCE(p_customs_duty_amount, 0), 0);
    v_line_import_igst NUMERIC(15, 4);
    v_line_customs_duty NUMERIC(15, 4);
    v_allocated_landed NUMERIC(15, 4);
    v_final_landed NUMERIC(15, 4);
    v_exchange_rate NUMERIC(15, 6) := GREATEST(COALESCE(p_exchange_rate, 1), 0.000001);
    v_steps JSONB := '[]'::jsonb;
    v_qc_required BOOLEAN;
    v_location_label TEXT;
    v_allow_zero_cost BOOLEAN;
    v_has_promo_lines BOOLEAN := FALSE;
    v_has_orphan_sample BOOLEAN := FALSE;
    v_landed_charge_total NUMERIC(15, 4) := 0;
    v_charge_amount NUMERIC(15, 4);
    v_alloc_method TEXT;
    v_weight_total NUMERIC(20, 8) := 0;
    v_line_weight NUMERIC(20, 8);
    v_extra_landed NUMERIC(15, 4);
    v_entitlement_id UUID;
    v_ent_status public.promo_entitlement_status;
    v_restate_delta NUMERIC(15, 4);
    v_ent_closed_count INTEGER := 0;
    v_ent_partial_count INTEGER := 0;
    v_restate_total NUMERIC(15, 4) := 0;
    v_qty_accepted NUMERIC(15, 4);
    v_qty_rejected NUMERIC(15, 4);
    v_route_to_qc BOOLEAN;
    v_allow_qc_override BOOLEAN;
    v_any_qc_line BOOLEAN := FALSE;
    v_line_override BOOLEAN;
    v_has_override_key BOOLEAN;
    v_absorb_sunk BOOLEAN;
    v_reject_disposition public.grn_reject_disposition;
    v_alloc_unit NUMERIC(15, 4);
BEGIN
    v_tenant_id := private.current_tenant_id();
    IF v_tenant_id IS NULL THEN RAISE EXCEPTION 'tenant context missing from session'; END IF;
    IF p_created_by IS NULL THEN RAISE EXCEPTION 'created_by is required'; END IF;
    IF p_destination_location_id IS NULL THEN RAISE EXCEPTION 'destination location is required'; END IF;
    IF p_lines IS NULL OR jsonb_typeof(p_lines) IS DISTINCT FROM 'array' OR jsonb_array_length(p_lines) = 0 THEN
        RAISE EXCEPTION 'at least one receipt line is required';
    END IF;

    v_qc_required := private.get_procurement_control_flag(v_tenant_id, 'is_qc_required_before_stocking');
    v_allow_qc_override := private.get_procurement_control_flag(v_tenant_id, 'allow_qc_line_override');
    v_allow_zero_cost := private.get_procurement_control_flag(v_tenant_id, 'allow_zero_cost_receipts');
    v_alloc_method := COALESCE(
        private.get_procurement_control_text(v_tenant_id, 'landed_cost_allocation_method', 'BY_VALUE'),
        'BY_VALUE'
    );
    v_absorb_sunk := private.get_procurement_control_flag(v_tenant_id, 'absorb_sunk_logistics_overhead');

    IF p_landed_charges IS NOT NULL AND jsonb_typeof(p_landed_charges) = 'array' THEN
        FOR v_charge IN SELECT value FROM jsonb_array_elements(p_landed_charges)
        LOOP
            v_landed_charge_total := v_landed_charge_total
                + GREATEST(COALESCE(NULLIF(v_charge ->> 'amount', '')::NUMERIC, 0), 0);
        END LOOP;
    END IF;

    SELECT id, code, name, is_stock_holding, presence_type
    INTO v_location FROM public.tenant_locations
    WHERE id = p_destination_location_id AND tenant_id = v_tenant_id AND is_active = TRUE;
    IF NOT FOUND THEN RAISE EXCEPTION 'destination location not found'; END IF;
    IF NOT COALESCE(v_location.is_stock_holding, FALSE) OR v_location.presence_type = 'VIRTUAL' THEN
        RAISE EXCEPTION 'destination location cannot hold inventory';
    END IF;

    v_location_label := COALESCE(v_location.name, v_location.code, 'location');

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
        v_qty_accepted := COALESCE(NULLIF(v_entry ->> 'quantity_accepted', '')::NUMERIC, v_qty);
        v_unit_cost := COALESCE(NULLIF(v_entry ->> 'raw_unit_cost', '')::NUMERIC, 0);
        v_is_promotional := COALESCE((v_entry ->> 'is_promotional')::BOOLEAN, FALSE);
        IF v_qty IS NULL OR v_qty <= 0 THEN CONTINUE; END IF;
        IF v_unit_cost <= 0 AND NOT (v_is_promotional OR v_allow_zero_cost OR p_purchase_order_id IS NULL) THEN CONTINUE; END IF;
        v_alloc_unit := CASE WHEN v_absorb_sunk THEN v_qty ELSE GREATEST(v_qty_accepted, 0) END;
        IF v_unit_cost > 0 AND v_alloc_unit > 0 THEN
            v_total_line_value := v_total_line_value + (v_alloc_unit * v_unit_cost);
        END IF;
        v_total_line_qty := v_total_line_qty + v_alloc_unit;
    END LOOP;

    v_voucher_number := public.generate_next_voucher_string(
        v_tenant_id, 'GOODS_RECEIPT_NOTE'::public.document_voucher_type, NULL, p_destination_location_id
    );

    INSERT INTO public.goods_receipts (
        tenant_id, destination_location_id, purchase_order_id, voucher_number, created_by,
        is_qc_pending,
        tax_supply_nature, tax_mechanism,
        bill_of_entry_number, bill_of_entry_date, port_code,
        exchange_rate, assessable_value, customs_duty_amount, import_igst_amount
    ) VALUES (
        v_tenant_id, p_destination_location_id, p_purchase_order_id, v_voucher_number, p_created_by,
        FALSE,
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

    v_steps := private.append_posting_step(v_steps, 'grn_receipt_recorded', 'success', v_voucher_number);

    IF p_landed_charges IS NOT NULL AND jsonb_typeof(p_landed_charges) = 'array' THEN
        FOR v_charge IN SELECT value FROM jsonb_array_elements(p_landed_charges)
        LOOP
            v_charge_amount := GREATEST(COALESCE(NULLIF(v_charge ->> 'amount', '')::NUMERIC, 0), 0);
            IF v_charge_amount <= 0 THEN CONTINUE; END IF;
            INSERT INTO public.goods_receipt_landed_charges (
                tenant_id, goods_receipt_id, charge_type, description, amount, allocation_method
            )
            VALUES (
                v_tenant_id, v_gr_id,
                COALESCE(NULLIF(btrim(v_charge ->> 'charge_type'), ''), 'FREIGHT'),
                NULLIF(btrim(v_charge ->> 'description'), ''),
                v_charge_amount,
                COALESCE(NULLIF(btrim(v_charge ->> 'allocation_method'), ''), v_alloc_method)
            );
        END LOOP;
    END IF;

    FOR v_entry IN SELECT value FROM jsonb_array_elements(p_lines)
    LOOP
        v_variant_id := NULLIF(v_entry ->> 'variant_id', '')::UUID;
        v_po_item_id := NULLIF(v_entry ->> 'po_item_id', '')::UUID;
        v_qty := NULLIF(v_entry ->> 'quantity_received', '')::NUMERIC;
        v_qty_accepted := COALESCE(NULLIF(v_entry ->> 'quantity_accepted', '')::NUMERIC, v_qty);
        v_qty_rejected := COALESCE(NULLIF(v_entry ->> 'quantity_rejected', '')::NUMERIC, 0);
        v_unit_cost := COALESCE(NULLIF(v_entry ->> 'raw_unit_cost', '')::NUMERIC, 0);
        v_is_promotional := COALESCE((v_entry ->> 'is_promotional')::BOOLEAN, FALSE);

        IF v_variant_id IS NULL OR v_qty IS NULL OR v_qty <= 0 THEN
            RAISE EXCEPTION 'invalid receipt line';
        END IF;

        IF v_qty_accepted < 0 OR v_qty_rejected < 0 THEN
            RAISE EXCEPTION 'accepted and rejected quantities must be zero or greater';
        END IF;

        IF ABS((v_qty_accepted + v_qty_rejected) - v_qty) > 0.0001 THEN
            RAISE EXCEPTION 'accepted plus rejected must equal quantity received';
        END IF;

        IF v_unit_cost <= 0 AND NOT (v_is_promotional OR v_allow_zero_cost OR p_purchase_order_id IS NULL) THEN
            RAISE EXCEPTION 'unit cost must be greater than zero';
        END IF;

        IF p_purchase_order_id IS NULL AND v_unit_cost = 0 THEN
            v_has_orphan_sample := TRUE;
            v_is_promotional := TRUE;
        END IF;

        IF v_is_promotional THEN v_has_promo_lines := TRUE; END IF;

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
            IF COALESCE(v_po_item.is_promotional, FALSE) THEN v_is_promotional := TRUE; END IF;
            v_open_qty := v_po_item.quantity_ordered - v_po_item.quantity_received;
            IF v_qty > v_open_qty THEN RAISE EXCEPTION 'quantity_received exceeds open purchase order quantity'; END IF;
        END IF;

        v_has_override_key := (v_entry ? 'route_to_qc');
        v_line_override := COALESCE((v_entry ->> 'route_to_qc')::BOOLEAN, FALSE);
        v_route_to_qc := private.resolve_grn_line_route_to_qc(
            v_tenant_id,
            v_item_id,
            v_line_override,
            v_has_override_key AND v_allow_qc_override
        );
        IF v_qty_accepted <= 0 THEN
            v_route_to_qc := FALSE;
        END IF;
        IF v_route_to_qc THEN
            v_any_qc_line := TRUE;
        END IF;

        v_reject_disposition := 'SCRAP'::public.grn_reject_disposition;
        IF v_qty_rejected > 0 AND NULLIF(upper(btrim(v_entry ->> 'reject_disposition')), '') IS NOT NULL THEN
            v_reject_disposition := NULLIF(upper(btrim(v_entry ->> 'reject_disposition')), '')::public.grn_reject_disposition;
        END IF;

        v_line_value := v_qty * GREATEST(v_unit_cost, 0);
        IF v_total_line_value > 0 AND v_unit_cost > 0 THEN
            v_line_import_igst := private.money_round(v_import_igst_header * (v_line_value / v_total_line_value) / v_qty);
            v_line_customs_duty := private.money_round(v_customs_duty_header * (v_line_value / v_total_line_value) / v_qty);
        ELSE
            v_line_import_igst := 0;
            v_line_customs_duty := 0;
        END IF;

        v_extra_landed := 0;
        IF v_landed_charge_total > 0 AND NOT v_is_promotional AND v_qty_accepted > 0 THEN
            IF v_alloc_method = 'BY_QUANTITY' AND v_total_line_qty > 0 THEN
                v_extra_landed := private.money_round(
                    (v_landed_charge_total * GREATEST(v_alloc_unit, 0) / v_total_line_qty) / GREATEST(v_qty_accepted, 1)
                );
            ELSIF v_alloc_method = 'BY_VALUE' AND v_total_line_value > 0 AND v_unit_cost > 0 THEN
                v_extra_landed := private.money_round(
                    (v_landed_charge_total * (GREATEST(v_alloc_unit, 0) * GREATEST(v_unit_cost, 0)) / v_total_line_value)
                    / GREATEST(v_qty_accepted, 1)
                );
            ELSIF v_alloc_method = 'BY_WEIGHT' THEN
                SELECT COALESCE(iv.dead_weight_kg, 0) * v_qty INTO v_line_weight
                FROM public.item_variants iv WHERE iv.id = v_variant_id;
                SELECT COALESCE(SUM(COALESCE(iv.dead_weight_kg, 0) * NULLIF(e.value ->> 'quantity_received', '')::NUMERIC), 0)
                INTO v_weight_total
                FROM jsonb_array_elements(p_lines) e;
                IF v_weight_total > 0 THEN
                    v_extra_landed := private.money_round((v_landed_charge_total * v_line_weight / v_weight_total) / v_qty);
                END IF;
            END IF;
        END IF;

        v_allocated_landed := v_line_import_igst + v_line_customs_duty + v_extra_landed;
        v_final_landed := private.money_round(GREATEST(v_unit_cost, 0) + v_allocated_landed);

        v_entitlement_id := NULL;
        IF v_is_promotional AND p_purchase_order_id IS NOT NULL AND v_po_item_id IS NOT NULL THEN
            SELECT pfe.id INTO v_entitlement_id
            FROM public.promo_fulfillment_entitlements pfe
            WHERE pfe.tenant_id = v_tenant_id AND pfe.promo_line_id = v_po_item_id;
        END IF;

        INSERT INTO public.goods_receipt_items (
            tenant_id, goods_receipt_id, po_item_id, item_id, variant_id,
            quantity_received, quantity_accepted, quantity_rejected,
            raw_unit_cost, allocated_landed_cost, total_final_landed_cost,
            import_igst_amount, customs_duty_amount,
            is_promotional, linked_parent_line_id, entitlement_id, route_to_qc,
            reject_disposition
        ) VALUES (
            v_tenant_id, v_gr_id, v_po_item_id, v_item_id, v_variant_id,
            v_qty, v_qty_accepted, v_qty_rejected,
            GREATEST(v_unit_cost, 0), v_allocated_landed, v_final_landed,
            private.money_round(v_line_import_igst * v_qty), private.money_round(v_line_customs_duty * v_qty),
            v_is_promotional,
            CASE WHEN p_purchase_order_id IS NOT NULL THEN v_po_item.linked_parent_line_id ELSE NULLIF(v_entry ->> 'linked_parent_line_id', '')::UUID END,
            v_entitlement_id,
            v_route_to_qc,
            CASE WHEN v_qty_rejected > 0 THEN v_reject_disposition ELSE NULL END
        ) RETURNING id INTO v_gr_item_id;

        IF p_purchase_order_id IS NOT NULL AND v_po_item_id IS NOT NULL THEN
            UPDATE public.purchase_order_items SET
                quantity_received = quantity_received + v_qty, updated_at = NOW()
            WHERE id = v_po_item_id AND tenant_id = v_tenant_id;

            IF v_is_promotional THEN
                SELECT r.entitlement_id, r.new_status, r.restate_delta
                INTO v_entitlement_id, v_ent_status, v_restate_delta
                FROM private.process_grn_promo_entitlement(
                    v_tenant_id, v_gr_id, v_gr_item_id, v_po_item_id, v_qty, p_created_by
                ) AS r(entitlement_id, new_status, restate_delta);

                UPDATE public.goods_receipt_items
                SET entitlement_id = v_entitlement_id
                WHERE id = v_gr_item_id AND tenant_id = v_tenant_id;

                IF v_ent_status = 'PARTIAL'::public.promo_entitlement_status THEN
                    v_ent_partial_count := v_ent_partial_count + 1;
                ELSIF v_ent_status = 'CLOSED'::public.promo_entitlement_status THEN
                    v_ent_closed_count := v_ent_closed_count + 1;
                    v_restate_total := v_restate_total + COALESCE(v_restate_delta, 0);
                END IF;
            END IF;
        END IF;

        INSERT INTO public.item_variant_locations (tenant_id, item_id, variant_id, location_id, is_stocked, is_sellable, is_orderable)
        VALUES (v_tenant_id, v_item_id, v_variant_id, p_destination_location_id, TRUE, FALSE, FALSE)
        ON CONFLICT (variant_id, location_id) DO UPDATE SET is_stocked = TRUE, updated_at = NOW();

        v_line_count := v_line_count + 1;
        v_total_qty := v_total_qty + v_qty;
    END LOOP;

    IF v_line_count = 0 THEN RAISE EXCEPTION 'no valid receipt lines were posted'; END IF;

    UPDATE public.goods_receipts
    SET is_qc_pending = v_any_qc_line,
        updated_at = NOW()
    WHERE id = v_gr_id;

    v_steps := private.append_posting_step(
        v_steps, 'grn_quantities_received', 'success',
        v_total_qty::TEXT || ' units · ' || v_location_label
    );
    v_steps := private.append_posting_step(v_steps, 'grn_paid_stock_valued', 'success', v_line_count::TEXT || ' line(s) valued');

    IF v_has_promo_lines THEN
        v_steps := private.append_posting_step(v_steps, 'grn_free_stock_separated', 'success', NULL);
    ELSE
        v_steps := private.append_posting_step(v_steps, 'grn_free_stock_separated', 'skipped', NULL);
    END IF;

    IF v_has_orphan_sample THEN
        v_steps := private.append_posting_step(v_steps, 'grn_orphan_sample_quarantined', 'success', NULL);
    ELSE
        v_steps := private.append_posting_step(v_steps, 'grn_orphan_sample_quarantined', 'skipped', NULL);
    END IF;

    IF v_landed_charge_total > 0 THEN
        v_steps := private.append_posting_step(
            v_steps, 'grn_landed_charges_allocated', 'success', private.money_round(v_landed_charge_total)::TEXT
        );
    ELSE
        v_steps := private.append_posting_step(v_steps, 'grn_landed_charges_allocated', 'skipped', NULL);
    END IF;

    IF v_ent_partial_count > 0 THEN
        v_steps := private.append_posting_step(
            v_steps, 'grn_entitlement_partial', 'success', v_ent_partial_count::TEXT || ' bundle(s)'
        );
    ELSE
        v_steps := private.append_posting_step(v_steps, 'grn_entitlement_partial', 'skipped', NULL);
    END IF;

    IF v_ent_closed_count > 0 THEN
        v_steps := private.append_posting_step(
            v_steps, 'grn_entitlement_closed', 'success', v_ent_closed_count::TEXT || ' bundle(s)'
        );
        v_steps := private.append_posting_step(
            v_steps, 'grn_promo_bundle_cost_adjusted', 'success',
            CASE WHEN v_restate_total <> 0 THEN v_restate_total::TEXT ELSE NULL END
        );
    ELSE
        v_steps := private.append_posting_step(v_steps, 'grn_entitlement_closed', 'skipped', NULL);
        v_steps := private.append_posting_step(v_steps, 'grn_promo_bundle_cost_adjusted', 'skipped', NULL);
    END IF;

    IF v_any_qc_line THEN
        v_steps := private.append_posting_step(v_steps, 'grn_qc_quarantine_applied', 'success', NULL);
    ELSE
        v_steps := private.append_posting_step(v_steps, 'grn_qc_quarantine_applied', 'skipped', NULL);
    END IF;

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

        v_steps := private.append_posting_step(v_steps, 'grn_po_fulfillment_updated', 'success', NULL);
    ELSE
        v_steps := private.append_posting_step(v_steps, 'grn_po_fulfillment_updated', 'skipped', NULL);
    END IF;

    INSERT INTO public.document_posting_runs (
        tenant_id, document_type, document_id, overall_status, steps, posted_by
    ) VALUES (
        v_tenant_id, 'GRN'::public.document_posting_document_type, v_gr_id, 'success', v_steps, p_created_by
    );

    RETURN jsonb_build_object('goods_receipt_id', v_gr_id, 'steps', v_steps);
END;
$$;

-- --------------------------------------------------------------------
-- goods_receipt_items_post_stocking: QC hold before promo pool
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.goods_receipt_items_post_stocking()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_gr public.goods_receipts%ROWTYPE;
    v_stock_qty NUMERIC(15, 4);
    v_quarantine public.promo_quarantine_type;
BEGIN
    SELECT * INTO v_gr
    FROM public.goods_receipts
    WHERE id = NEW.goods_receipt_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'goods receipt % not found for line item', NEW.goods_receipt_id;
    END IF;

    v_stock_qty := GREATEST(COALESCE(NEW.quantity_accepted, 0), 0);

    IF v_stock_qty <= 0 THEN
        RETURN NEW;
    END IF;

    IF COALESCE(NEW.route_to_qc, FALSE) THEN
        PERFORM private.upsert_qc_inventory_balance(
            NEW.tenant_id,
            v_gr.destination_location_id,
            NEW.item_id,
            NEW.variant_id,
            v_gr.id,
            NEW.id,
            v_stock_qty,
            NEW.total_final_landed_cost
        );

        INSERT INTO public.item_variant_locations (
            tenant_id, item_id, variant_id, location_id, is_stocked, is_sellable, is_orderable
        )
        VALUES (NEW.tenant_id, NEW.item_id, NEW.variant_id, v_gr.destination_location_id, TRUE, FALSE, FALSE)
        ON CONFLICT (variant_id, location_id)
        DO UPDATE SET is_stocked = TRUE, is_sellable = FALSE, is_orderable = FALSE, updated_at = NOW();

        RETURN NEW;
    END IF;

    IF NEW.is_promotional OR (v_gr.purchase_order_id IS NULL AND NEW.raw_unit_cost = 0) THEN
        v_quarantine := CASE
            WHEN v_gr.purchase_order_id IS NULL THEN 'NOT_FOR_RESALE_SAMPLE'::public.promo_quarantine_type
            ELSE 'PROMOTIONAL_HOLD'::public.promo_quarantine_type
        END;

        PERFORM private.upsert_promo_inventory_balance(
            NEW.tenant_id,
            v_gr.destination_location_id,
            NEW.item_id,
            NEW.variant_id,
            v_quarantine,
            v_stock_qty,
            NEW.entitlement_id
        );

        RETURN NEW;
    END IF;

    INSERT INTO public.inventory_ledger (
        tenant_id, item_id, variant_id, location_id,
        transaction_type, quantity, cost_at_transaction,
        reference_document, created_by
    )
    VALUES (
        NEW.tenant_id, NEW.item_id, NEW.variant_id, v_gr.destination_location_id,
        'PURCHASE_RECEIPT', v_stock_qty, NEW.total_final_landed_cost,
        v_gr.voucher_number, v_gr.created_by
    );

    INSERT INTO public.item_variant_locations (
        tenant_id, item_id, variant_id, location_id, is_stocked, is_sellable, is_orderable
    )
    VALUES (NEW.tenant_id, NEW.item_id, NEW.variant_id, v_gr.destination_location_id, TRUE, TRUE, TRUE)
    ON CONFLICT (variant_id, location_id)
    DO UPDATE SET is_stocked = TRUE, is_sellable = TRUE, is_orderable = TRUE, updated_at = NOW();

    RETURN NEW;
END;
$$;

-- --------------------------------------------------------------------
-- release_goods_receipt_line_from_qc: promo pass → promotional hold pool
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.release_goods_receipt_line_from_qc(
    p_goods_receipt_item_id UUID,
    p_quantity_released NUMERIC,
    p_quantity_failed NUMERIC DEFAULT 0,
    p_failed_disposition public.grn_reject_disposition DEFAULT 'SCRAP',
    p_released_by UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_tenant_id UUID;
    v_row public.qc_inventory_balances%ROWTYPE;
    v_gr public.goods_receipts%ROWTYPE;
    v_gri public.goods_receipt_items%ROWTYPE;
    v_release NUMERIC(15, 4);
    v_fail NUMERIC(15, 4);
    v_new_hold NUMERIC(15, 4);
    v_steps JSONB := '[]'::jsonb;
    v_transfer_qty NUMERIC(15, 4);
    v_quarantine public.promo_quarantine_type;
BEGIN
    v_tenant_id := private.current_tenant_id();
    IF v_tenant_id IS NULL THEN RAISE EXCEPTION 'tenant context missing from session'; END IF;
    IF p_goods_receipt_item_id IS NULL THEN RAISE EXCEPTION 'goods receipt item id is required'; END IF;

    v_release := GREATEST(COALESCE(p_quantity_released, 0), 0);
    v_fail := GREATEST(COALESCE(p_quantity_failed, 0), 0);
    IF v_release <= 0 AND v_fail <= 0 THEN RAISE EXCEPTION 'release or fail quantity required'; END IF;

    SELECT * INTO v_row
    FROM public.qc_inventory_balances
    WHERE tenant_id = v_tenant_id AND goods_receipt_item_id = p_goods_receipt_item_id
    FOR UPDATE;

    IF NOT FOUND THEN
        SELECT * INTO v_gri
        FROM public.goods_receipt_items
        WHERE id = p_goods_receipt_item_id AND tenant_id = v_tenant_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'goods receipt line not found';
        END IF;

        SELECT * INTO v_gr FROM public.goods_receipts WHERE id = v_gri.goods_receipt_id;

        IF NOT COALESCE(v_gri.route_to_qc, FALSE) THEN
            IF COALESCE(v_gri.is_promotional, FALSE)
               AND GREATEST(COALESCE(v_gri.quantity_accepted, 0), 0) > 0
               AND COALESCE(v_gr.is_qc_pending, FALSE) THEN
                v_transfer_qty := GREATEST(COALESCE(v_gri.quantity_accepted, 0), 0);
                v_quarantine := CASE
                    WHEN v_gr.purchase_order_id IS NULL THEN 'NOT_FOR_RESALE_SAMPLE'::public.promo_quarantine_type
                    ELSE 'PROMOTIONAL_HOLD'::public.promo_quarantine_type
                END;

                UPDATE public.promo_inventory_balances
                SET quantity_on_hand = GREATEST(quantity_on_hand - v_transfer_qty, 0),
                    updated_at = NOW()
                WHERE tenant_id = v_tenant_id
                  AND location_id = v_gr.destination_location_id
                  AND item_id = v_gri.item_id
                  AND variant_id IS NOT DISTINCT FROM v_gri.variant_id
                  AND quarantine_type = v_quarantine
                  AND entitlement_id IS NOT DISTINCT FROM v_gri.entitlement_id;

                UPDATE public.goods_receipt_items
                SET route_to_qc = TRUE, updated_at = NOW()
                WHERE id = v_gri.id AND tenant_id = v_tenant_id;

                PERFORM private.upsert_qc_inventory_balance(
                    v_tenant_id,
                    v_gr.destination_location_id,
                    v_gri.item_id,
                    v_gri.variant_id,
                    v_gr.id,
                    v_gri.id,
                    v_transfer_qty,
                    v_gri.total_final_landed_cost
                );
            ELSE
                RAISE EXCEPTION 'line is not routed to quality inspection';
            END IF;
        ELSE
            IF GREATEST(COALESCE(v_gri.quantity_accepted, 0), 0) <= 0 THEN
                RAISE EXCEPTION 'no accepted quantity on line for QC release';
            END IF;

            SELECT * INTO v_gr FROM public.goods_receipts WHERE id = v_gri.goods_receipt_id;

            PERFORM private.upsert_qc_inventory_balance(
                v_tenant_id,
                v_gr.destination_location_id,
                v_gri.item_id,
                v_gri.variant_id,
                v_gr.id,
                v_gri.id,
                GREATEST(COALESCE(v_gri.quantity_accepted, 0), 0),
                v_gri.total_final_landed_cost
            );
        END IF;

        SELECT * INTO v_row
        FROM public.qc_inventory_balances
        WHERE tenant_id = v_tenant_id AND goods_receipt_item_id = p_goods_receipt_item_id
        FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'QC hold row not found for line';
        END IF;
    END IF;

    IF v_release + v_fail > v_row.quantity_on_hand + 0.0001 THEN
        RAISE EXCEPTION 'release plus failed exceeds QC hold quantity';
    END IF;

    SELECT * INTO v_gr FROM public.goods_receipts WHERE id = v_row.goods_receipt_id;

    SELECT * INTO v_gri
    FROM public.goods_receipt_items
    WHERE id = p_goods_receipt_item_id AND tenant_id = v_tenant_id;

    IF v_release > 0 THEN
        IF COALESCE(v_gri.is_promotional, FALSE) THEN
            v_quarantine := CASE
                WHEN v_gr.purchase_order_id IS NULL THEN 'NOT_FOR_RESALE_SAMPLE'::public.promo_quarantine_type
                ELSE 'PROMOTIONAL_HOLD'::public.promo_quarantine_type
            END;

            PERFORM private.upsert_promo_inventory_balance(
                v_tenant_id,
                v_row.location_id,
                v_row.item_id,
                v_row.variant_id,
                v_quarantine,
                v_release,
                v_gri.entitlement_id
            );
        ELSE
            INSERT INTO public.inventory_ledger (
                tenant_id, item_id, variant_id, location_id,
                transaction_type, quantity, cost_at_transaction,
                reference_document, created_by
            )
            VALUES (
                v_tenant_id, v_row.item_id, v_row.variant_id, v_row.location_id,
                'PURCHASE_RECEIPT', v_release, v_row.unit_cost,
                v_gr.voucher_number || '|QC-RELEASED', COALESCE(p_released_by, v_gr.created_by)
            );
        END IF;
    END IF;

    IF v_fail > 0 THEN
        UPDATE public.goods_receipt_items
        SET quantity_rejected = quantity_rejected + v_fail,
            reject_disposition = COALESCE(p_failed_disposition, reject_disposition, 'SCRAP'::public.grn_reject_disposition),
            updated_at = NOW()
        WHERE id = p_goods_receipt_item_id AND tenant_id = v_tenant_id;
    END IF;

    v_new_hold := v_row.quantity_on_hand - v_release - v_fail;

    IF v_new_hold <= 0.0001 THEN
        DELETE FROM public.qc_inventory_balances WHERE id = v_row.id;
    ELSE
        UPDATE public.qc_inventory_balances
        SET quantity_on_hand = v_new_hold,
            updated_at = NOW()
        WHERE id = v_row.id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.qc_inventory_balances
        WHERE tenant_id = v_tenant_id AND goods_receipt_id = v_row.goods_receipt_id AND quantity_on_hand > 0
    ) THEN
        UPDATE public.goods_receipts SET is_qc_pending = FALSE, updated_at = NOW()
        WHERE id = v_row.goods_receipt_id;
    END IF;

    v_steps := private.append_posting_step(
        v_steps, 'grn_qc_released', 'success',
        v_release::TEXT || ' released' || CASE WHEN v_fail > 0 THEN ', ' || v_fail::TEXT || ' failed' ELSE '' END
    );

    INSERT INTO public.document_posting_runs (
        tenant_id, document_type, document_id, overall_status, steps, posted_by
    )
    VALUES (
        v_tenant_id, 'GRN'::public.document_posting_document_type, v_row.goods_receipt_id,
        'success', v_steps, p_released_by
    );

    RETURN jsonb_build_object('goods_receipt_item_id', p_goods_receipt_item_id, 'steps', v_steps);
END;
$$;

-- --------------------------------------------------------------------
-- Backfill: move legacy promo lines on QC-pending receipts into QC hold
-- --------------------------------------------------------------------
DO $$
DECLARE
    r RECORD;
    v_qty NUMERIC(15, 4);
    v_quarantine public.promo_quarantine_type;
BEGIN
    FOR r IN
        SELECT
            gri.id AS gri_id,
            gri.tenant_id,
            gri.item_id,
            gri.variant_id,
            gri.entitlement_id,
            gri.quantity_accepted,
            gri.total_final_landed_cost,
            gr.id AS goods_receipt_id,
            gr.destination_location_id,
            gr.purchase_order_id
        FROM public.goods_receipt_items gri
        INNER JOIN public.goods_receipts gr
            ON gr.id = gri.goods_receipt_id AND gr.tenant_id = gri.tenant_id
        WHERE gr.is_qc_pending = TRUE
          AND COALESCE(gri.is_promotional, FALSE) = TRUE
          AND COALESCE(gri.route_to_qc, FALSE) = FALSE
          AND GREATEST(COALESCE(gri.quantity_accepted, 0), 0) > 0
          AND NOT EXISTS (
              SELECT 1 FROM public.qc_inventory_balances qib
              WHERE qib.tenant_id = gri.tenant_id
                AND qib.goods_receipt_item_id = gri.id
                AND qib.quantity_on_hand > 0
          )
    LOOP
        v_qty := GREATEST(COALESCE(r.quantity_accepted, 0), 0);
        v_quarantine := CASE
            WHEN r.purchase_order_id IS NULL THEN 'NOT_FOR_RESALE_SAMPLE'::public.promo_quarantine_type
            ELSE 'PROMOTIONAL_HOLD'::public.promo_quarantine_type
        END;

        UPDATE public.promo_inventory_balances
        SET quantity_on_hand = GREATEST(quantity_on_hand - v_qty, 0),
            updated_at = NOW()
        WHERE tenant_id = r.tenant_id
          AND location_id = r.destination_location_id
          AND item_id = r.item_id
          AND variant_id IS NOT DISTINCT FROM r.variant_id
          AND quarantine_type = v_quarantine
          AND entitlement_id IS NOT DISTINCT FROM r.entitlement_id;

        UPDATE public.goods_receipt_items
        SET route_to_qc = TRUE, updated_at = NOW()
        WHERE id = r.gri_id AND tenant_id = r.tenant_id;

        PERFORM private.upsert_qc_inventory_balance(
            r.tenant_id,
            r.destination_location_id,
            r.item_id,
            r.variant_id,
            r.goods_receipt_id,
            r.gri_id,
            v_qty,
            r.total_final_landed_cost
        );
    END LOOP;
END $$;

-- GRN exception quantity workflow + layered QC receipt policy (org / category / item / line).

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'qc_receipt_policy') THEN
        CREATE TYPE public.qc_receipt_policy AS ENUM ('INHERIT', 'REQUIRED', 'EXEMPT');
    END IF;
END $$;

ALTER TABLE public.item_categories
    ADD COLUMN IF NOT EXISTS qc_receipt_policy public.qc_receipt_policy NOT NULL DEFAULT 'INHERIT';

ALTER TABLE public.items
    ADD COLUMN IF NOT EXISTS qc_receipt_policy public.qc_receipt_policy NOT NULL DEFAULT 'INHERIT';

ALTER TABLE public.goods_receipt_items
    ADD COLUMN IF NOT EXISTS route_to_qc BOOLEAN NOT NULL DEFAULT FALSE;

CREATE OR REPLACE FUNCTION private.effective_category_qc_receipt_policy(
    p_tenant_id UUID,
    p_category_id UUID
)
RETURNS public.qc_receipt_policy
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_category_id UUID := p_category_id;
    v_policy public.qc_receipt_policy;
    v_parent_id UUID;
BEGIN
    WHILE v_category_id IS NOT NULL LOOP
        SELECT qc_receipt_policy, parent_id
        INTO v_policy, v_parent_id
        FROM public.item_categories
        WHERE id = v_category_id
          AND tenant_id = p_tenant_id;

        IF NOT FOUND THEN
            RETURN 'INHERIT'::public.qc_receipt_policy;
        END IF;

        IF v_policy IS DISTINCT FROM 'INHERIT'::public.qc_receipt_policy THEN
            RETURN v_policy;
        END IF;

        v_category_id := v_parent_id;
    END LOOP;

    RETURN 'INHERIT'::public.qc_receipt_policy;
END;
$$;

CREATE OR REPLACE FUNCTION private.resolve_item_qc_route_default(
    p_tenant_id UUID,
    p_item_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_qc_enabled BOOLEAN;
    v_item_policy public.qc_receipt_policy;
    v_category_id UUID;
    v_category_policy public.qc_receipt_policy;
BEGIN
    v_qc_enabled := private.get_procurement_control_flag(p_tenant_id, 'is_qc_required_before_stocking');
    IF NOT v_qc_enabled THEN
        RETURN FALSE;
    END IF;

    SELECT qc_receipt_policy, category_id
    INTO v_item_policy, v_category_id
    FROM public.items
    WHERE id = p_item_id
      AND tenant_id = p_tenant_id;

    IF NOT FOUND THEN
        RETURN TRUE;
    END IF;

    IF v_item_policy = 'EXEMPT'::public.qc_receipt_policy THEN
        RETURN FALSE;
    END IF;

    IF v_item_policy = 'REQUIRED'::public.qc_receipt_policy THEN
        RETURN TRUE;
    END IF;

    IF v_category_id IS NOT NULL THEN
        v_category_policy := private.effective_category_qc_receipt_policy(p_tenant_id, v_category_id);
        IF v_category_policy = 'EXEMPT'::public.qc_receipt_policy THEN
            RETURN FALSE;
        END IF;
        IF v_category_policy = 'REQUIRED'::public.qc_receipt_policy THEN
            RETURN TRUE;
        END IF;
    END IF;

    RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION private.resolve_grn_line_route_to_qc(
    p_tenant_id UUID,
    p_item_id UUID,
    p_line_override BOOLEAN,
    p_apply_line_override BOOLEAN
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_default BOOLEAN;
BEGIN
    v_default := private.resolve_item_qc_route_default(p_tenant_id, p_item_id);

    IF p_apply_line_override THEN
        RETURN COALESCE(p_line_override, v_default);
    END IF;

    RETURN v_default;
END;
$$;

CREATE OR REPLACE FUNCTION public.goods_receipts_po_mandatory_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
BEGIN
    IF private.get_procurement_control_flag(NEW.tenant_id, 'is_po_mandatory_for_grn')
       AND NEW.purchase_order_id IS NULL
    THEN
        RAISE EXCEPTION
            'purchase_order_id is required: is_po_mandatory_for_grn is enabled for tenant %',
            NEW.tenant_id;
    END IF;

    RETURN NEW;
END;
$$;

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

    INSERT INTO public.inventory_ledger (
        tenant_id,
        item_id,
        variant_id,
        location_id,
        transaction_type,
        quantity,
        cost_at_transaction,
        reference_document,
        created_by
    )
    VALUES (
        NEW.tenant_id,
        NEW.item_id,
        NEW.variant_id,
        v_gr.destination_location_id,
        'PURCHASE_RECEIPT',
        v_stock_qty,
        NEW.total_final_landed_cost,
        v_gr.voucher_number,
        v_gr.created_by
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

DROP FUNCTION IF EXISTS public.save_system_category(TEXT, UUID, BOOLEAN, JSONB, UUID, TEXT, BOOLEAN);

CREATE OR REPLACE FUNCTION private.save_system_category(
    p_name TEXT,
    p_parent_id UUID DEFAULT NULL,
    p_is_active BOOLEAN DEFAULT TRUE,
    p_attribute_templates JSONB DEFAULT '[]'::jsonb,
    p_category_id UUID DEFAULT NULL,
    p_default_variant_strategy TEXT DEFAULT 'SINGLE_SKU',
    p_inherit_parent_attributes BOOLEAN DEFAULT TRUE,
    p_qc_receipt_policy TEXT DEFAULT 'INHERIT'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_tenant_id UUID;
    v_category_id UUID;
    v_trimmed_name TEXT;
    v_strategy public.product_variant_strategy;
    v_qc_policy public.qc_receipt_policy;
BEGIN
    v_tenant_id := private.current_tenant_id();
    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'tenant context missing from session';
    END IF;

    v_trimmed_name := btrim(p_name);
    IF v_trimmed_name IS NULL OR v_trimmed_name = '' THEN
        RAISE EXCEPTION 'category name is required';
    END IF;

    v_strategy := COALESCE(
        NULLIF(upper(btrim(p_default_variant_strategy)), '')::public.product_variant_strategy,
        'SINGLE_SKU'::public.product_variant_strategy
    );

    v_qc_policy := COALESCE(
        NULLIF(upper(btrim(p_qc_receipt_policy)), '')::public.qc_receipt_policy,
        'INHERIT'::public.qc_receipt_policy
    );

    IF p_attribute_templates IS NULL THEN
        p_attribute_templates := '[]'::jsonb;
    END IF;

    IF jsonb_typeof(p_attribute_templates) IS DISTINCT FROM 'array' THEN
        RAISE EXCEPTION 'attribute_templates must be a JSON array';
    END IF;

    IF p_category_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.item_categories
            WHERE id = p_category_id AND tenant_id = v_tenant_id
        ) THEN
            RAISE EXCEPTION 'category not found for tenant';
        END IF;

        UPDATE public.item_categories
        SET
            name = v_trimmed_name,
            parent_id = p_parent_id,
            is_active = COALESCE(p_is_active, TRUE),
            attribute_templates = p_attribute_templates,
            default_variant_strategy = v_strategy,
            inherit_parent_attributes = COALESCE(p_inherit_parent_attributes, TRUE),
            qc_receipt_policy = v_qc_policy
        WHERE id = p_category_id AND tenant_id = v_tenant_id;

        RETURN p_category_id;
    END IF;

    INSERT INTO public.item_categories (
        tenant_id,
        name,
        parent_id,
        is_active,
        attribute_templates,
        default_variant_strategy,
        inherit_parent_attributes,
        qc_receipt_policy
    )
    VALUES (
        v_tenant_id,
        v_trimmed_name,
        p_parent_id,
        COALESCE(p_is_active, TRUE),
        p_attribute_templates,
        v_strategy,
        COALESCE(p_inherit_parent_attributes, TRUE),
        v_qc_policy
    )
    RETURNING id INTO v_category_id;

    RETURN v_category_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.save_system_category(
    p_name TEXT,
    p_parent_id UUID DEFAULT NULL,
    p_is_active BOOLEAN DEFAULT TRUE,
    p_attribute_templates JSONB DEFAULT '[]'::jsonb,
    p_category_id UUID DEFAULT NULL,
    p_default_variant_strategy TEXT DEFAULT 'SINGLE_SKU',
    p_inherit_parent_attributes BOOLEAN DEFAULT TRUE,
    p_qc_receipt_policy TEXT DEFAULT 'INHERIT'
)
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, private
AS $$
    SELECT private.save_system_category(
        p_name,
        p_parent_id,
        p_is_active,
        p_attribute_templates,
        p_category_id,
        p_default_variant_strategy,
        p_inherit_parent_attributes,
        p_qc_receipt_policy
    );
$$;

REVOKE ALL ON FUNCTION public.save_system_category(TEXT, UUID, BOOLEAN, JSONB, UUID, TEXT, BOOLEAN, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_system_category(TEXT, UUID, BOOLEAN, JSONB, UUID, TEXT, BOOLEAN, TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.post_goods_receipt(UUID, UUID, JSONB, UUID, TEXT, DATE, VARCHAR, NUMERIC, NUMERIC, NUMERIC, NUMERIC, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.post_goods_receipt(UUID, UUID, JSONB, UUID, TEXT, DATE, VARCHAR, NUMERIC, NUMERIC, NUMERIC, NUMERIC, JSONB) TO authenticated;

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
        v_unit_cost := COALESCE(NULLIF(v_entry ->> 'raw_unit_cost', '')::NUMERIC, 0);
        v_is_promotional := COALESCE((v_entry ->> 'is_promotional')::BOOLEAN, FALSE);
        IF v_qty IS NULL OR v_qty <= 0 THEN CONTINUE; END IF;
        IF v_unit_cost <= 0 AND NOT (v_is_promotional OR v_allow_zero_cost OR p_purchase_order_id IS NULL) THEN CONTINUE; END IF;
        IF v_unit_cost > 0 THEN
            v_total_line_value := v_total_line_value + (v_qty * v_unit_cost);
        END IF;
        v_total_line_qty := v_total_line_qty + v_qty;
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
        IF v_is_promotional OR v_qty_accepted <= 0 THEN
            v_route_to_qc := FALSE;
        END IF;
        IF v_route_to_qc THEN
            v_any_qc_line := TRUE;
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
        IF v_landed_charge_total > 0 AND NOT v_is_promotional THEN
            IF v_alloc_method = 'BY_QUANTITY' AND v_total_line_qty > 0 THEN
                v_extra_landed := private.money_round((v_landed_charge_total * v_qty / v_total_line_qty) / v_qty);
            ELSIF v_alloc_method = 'BY_VALUE' AND v_total_line_value > 0 AND v_unit_cost > 0 THEN
                v_extra_landed := private.money_round((v_landed_charge_total * v_line_value / v_total_line_value) / v_qty);
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
            is_promotional, linked_parent_line_id, entitlement_id, route_to_qc
        ) VALUES (
            v_tenant_id, v_gr_id, v_po_item_id, v_item_id, v_variant_id,
            v_qty, v_qty_accepted, v_qty_rejected,
            GREATEST(v_unit_cost, 0), v_allocated_landed, v_final_landed,
            private.money_round(v_line_import_igst * v_qty), private.money_round(v_line_customs_duty * v_qty),
            v_is_promotional,
            CASE WHEN p_purchase_order_id IS NOT NULL THEN v_po_item.linked_parent_line_id ELSE NULLIF(v_entry ->> 'linked_parent_line_id', '')::UUID END,
            v_entitlement_id,
            v_route_to_qc
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
        v_total_qty::TEXT || ' units Â· ' || v_location_label
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

REVOKE ALL ON FUNCTION public.post_goods_receipt(UUID, UUID, JSONB, UUID, TEXT, DATE, VARCHAR, NUMERIC, NUMERIC, NUMERIC, NUMERIC, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.post_goods_receipt(UUID, UUID, JSONB, UUID, TEXT, DATE, VARCHAR, NUMERIC, NUMERIC, NUMERIC, NUMERIC, JSONB) TO authenticated;

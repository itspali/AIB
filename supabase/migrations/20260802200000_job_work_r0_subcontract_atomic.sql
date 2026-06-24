-- Release 0: atomic subcontract GRN backflush, PO is_subcontract_job, JOB_WORK_SETTINGS

ALTER TABLE public.purchase_orders
    ADD COLUMN IF NOT EXISTS is_subcontract_job BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.purchase_orders.is_subcontract_job IS
    'When true, GRN posting backflushes subcontract BOM components from vendor WIP.';

-- ---------------------------------------------------------------------------
-- JOB_WORK_SETTINGS registry
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION private.clear_tenant_workspace_control(p_registry_key TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_tenant_id UUID;
BEGIN
    v_tenant_id := private.current_tenant_id();
    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'tenant context missing from session';
    END IF;

    IF NOT private.user_can_modify_organization_settings() THEN
        RAISE EXCEPTION 'administrative privileges required to modify workspace controls';
    END IF;

    IF p_registry_key NOT IN (
        'SALES_SETTINGS',
        'FINANCIAL_SETTINGS',
        'SEARCH_SETTINGS',
        'PROCUREMENT_SETTINGS',
        'THEME_SETTINGS',
        'IMPORT_LOGISTICS_SETTINGS',
        'JOB_WORK_SETTINGS'
    ) THEN
        RAISE EXCEPTION 'unsupported workspace control registry key';
    END IF;

    DELETE FROM public.workspace_control_registry
    WHERE tenant_id = v_tenant_id
      AND scope_level = 'TENANT_GLOBAL'
      AND registry_key = p_registry_key
      AND target_reference_id IS NULL;
END;
$$;

CREATE OR REPLACE FUNCTION private.upsert_tenant_workspace_control(
    p_registry_key TEXT,
    p_metadata_patch JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_tenant_id UUID;
    v_existing_id UUID;
    v_merged JSONB;
BEGIN
    v_tenant_id := private.current_tenant_id();
    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'tenant context missing from session';
    END IF;

    IF NOT private.user_can_modify_organization_settings() THEN
        RAISE EXCEPTION 'administrative privileges required to modify workspace controls';
    END IF;

    IF p_registry_key NOT IN (
        'SALES_SETTINGS',
        'FINANCIAL_SETTINGS',
        'SEARCH_SETTINGS',
        'PROCUREMENT_SETTINGS',
        'THEME_SETTINGS',
        'IMPORT_LOGISTICS_SETTINGS',
        'JOB_WORK_SETTINGS'
    ) THEN
        RAISE EXCEPTION 'unsupported workspace control registry key';
    END IF;

    SELECT id, configuration_metadata
    INTO v_existing_id, v_merged
    FROM public.workspace_control_registry
    WHERE tenant_id = v_tenant_id
      AND scope_level = 'TENANT_GLOBAL'
      AND registry_key = p_registry_key
      AND target_reference_id IS NULL
    LIMIT 1;

    v_merged := private.merge_jsonb_objects(v_merged, p_metadata_patch);

    IF v_existing_id IS NULL THEN
        INSERT INTO public.workspace_control_registry (
            tenant_id, scope_level, registry_key, target_reference_id, configuration_metadata
        )
        VALUES (v_tenant_id, 'TENANT_GLOBAL', p_registry_key, NULL, v_merged);
    ELSE
        UPDATE public.workspace_control_registry
        SET configuration_metadata = v_merged, updated_at = NOW()
        WHERE id = v_existing_id AND tenant_id = v_tenant_id;
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION private.get_job_work_control_text(
    p_tenant_id UUID,
    p_key TEXT,
    p_default TEXT DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_meta JSONB;
    v_value JSONB;
BEGIN
    SELECT configuration_metadata INTO v_meta
    FROM public.workspace_control_registry
    WHERE tenant_id = p_tenant_id
      AND registry_key = 'JOB_WORK_SETTINGS'
      AND scope_level = 'TENANT_GLOBAL'
      AND target_reference_id IS NULL
    LIMIT 1;

    IF v_meta IS NULL THEN RETURN p_default; END IF;
    v_value := v_meta -> p_key;
    IF jsonb_typeof(v_value) = 'string' THEN
        RETURN NULLIF(btrim(v_value #>> '{}'), '');
    END IF;
    RETURN p_default;
END;
$$;

CREATE OR REPLACE FUNCTION private.resolve_subcontract_wip_location(
    p_tenant_id UUID,
    p_supplier_id UUID
)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
    SELECT vjw.location_id
    FROM public.vendor_job_work_locations vjw
    WHERE vjw.tenant_id = p_tenant_id
      AND vjw.supplier_id = p_supplier_id
      AND vjw.is_active = TRUE
    ORDER BY vjw.created_at
    LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION private.job_work_backflush_at_grn(
    p_tenant_id UUID,
    p_route_to_qc BOOLEAN
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_trigger TEXT;
BEGIN
    v_trigger := COALESCE(
        private.get_job_work_control_text(p_tenant_id, 'backflush_trigger', 'AUTO_BY_QC_POLICY'),
        'AUTO_BY_QC_POLICY'
    );

    IF v_trigger = 'ON_GRN_ACCEPT' THEN RETURN TRUE; END IF;
    IF v_trigger = 'ON_QC_RELEASE' THEN RETURN FALSE; END IF;
    IF COALESCE(p_route_to_qc, FALSE) THEN RETURN FALSE; END IF;
    RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION private.job_work_backflush_at_qc_release(p_tenant_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_trigger TEXT;
BEGIN
    v_trigger := COALESCE(
        private.get_job_work_control_text(p_tenant_id, 'backflush_trigger', 'AUTO_BY_QC_POLICY'),
        'AUTO_BY_QC_POLICY'
    );

    IF v_trigger = 'ON_GRN_ACCEPT' THEN RETURN FALSE; END IF;
    RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION private.resolve_subcontract_component_variant(
    p_tenant_id UUID,
    p_component_item_id UUID
)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
    SELECT id
    FROM public.item_variants
    WHERE tenant_id = p_tenant_id
      AND item_id = p_component_item_id
      AND is_active = TRUE
    ORDER BY created_at
    LIMIT 1;
$$;

-- Pre-post validation: aggregate WIP demand vs on-hand for subcontract GRN lines.
CREATE OR REPLACE FUNCTION private.validate_subcontract_wip_for_grn(
    p_tenant_id UUID,
    p_po_id UUID,
    p_supplier_id UUID,
    p_lines JSONB,
    p_qc_required BOOLEAN,
    p_allow_qc_override BOOLEAN
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_entry JSONB;
    v_variant_id UUID;
    v_item_id UUID;
    v_qty_accepted NUMERIC(15, 4);
    v_qty NUMERIC(15, 4);
    v_is_promotional BOOLEAN;
    v_route_to_qc BOOLEAN;
    v_line_override BOOLEAN;
    v_has_override_key BOOLEAN;
    v_job_location_id UUID;
    v_bom RECORD;
    v_component_variant_id UUID;
    v_consume_qty NUMERIC(15, 4);
    v_on_hand NUMERIC(15, 4);
    v_required NUMERIC(15, 4);
    v_component_sku TEXT;
    v_location_name TEXT;
    v_demand RECORD;
BEGIN
    IF p_lines IS NULL OR jsonb_typeof(p_lines) IS DISTINCT FROM 'array' THEN RETURN; END IF;

    v_job_location_id := private.resolve_subcontract_wip_location(p_tenant_id, p_supplier_id);
    IF v_job_location_id IS NULL THEN
        RAISE EXCEPTION 'subcontract vendor WIP location is not configured for this supplier';
    END IF;

    SELECT COALESCE(name, code, 'vendor WIP') INTO v_location_name
    FROM public.tenant_locations
    WHERE id = v_job_location_id AND tenant_id = p_tenant_id;

    CREATE TEMP TABLE _subcon_wip_demand (
        component_variant_id UUID PRIMARY KEY,
        component_item_id UUID NOT NULL,
        required_qty NUMERIC(15, 4) NOT NULL
    ) ON COMMIT DROP;

    FOR v_entry IN SELECT value FROM jsonb_array_elements(p_lines)
    LOOP
        v_variant_id := NULLIF(v_entry ->> 'variant_id', '')::UUID;
        v_qty := NULLIF(v_entry ->> 'quantity_received', '')::NUMERIC;
        v_qty_accepted := COALESCE(NULLIF(v_entry ->> 'quantity_accepted', '')::NUMERIC, v_qty);
        v_is_promotional := COALESCE((v_entry ->> 'is_promotional')::BOOLEAN, FALSE);

        IF v_variant_id IS NULL OR v_qty IS NULL OR v_qty <= 0 OR v_qty_accepted <= 0 OR v_is_promotional THEN
            CONTINUE;
        END IF;

        SELECT iv.item_id INTO v_item_id
        FROM public.item_variants iv
        WHERE iv.id = v_variant_id AND iv.tenant_id = p_tenant_id;

        IF v_item_id IS NULL THEN CONTINUE; END IF;

        v_has_override_key := (v_entry ? 'route_to_qc');
        v_line_override := COALESCE((v_entry ->> 'route_to_qc')::BOOLEAN, FALSE);
        v_route_to_qc := private.resolve_grn_line_route_to_qc(
            p_tenant_id, v_item_id, v_line_override, v_has_override_key AND p_allow_qc_override
        );

        IF NOT private.job_work_backflush_at_grn(p_tenant_id, v_route_to_qc) THEN
            CONTINUE;
        END IF;

        FOR v_bom IN
            SELECT sbl.component_item_id, sbl.quantity_per
            FROM public.subcontract_bom_lines sbl
            WHERE sbl.tenant_id = p_tenant_id
              AND sbl.parent_item_id = v_item_id
        LOOP
            v_component_variant_id := private.resolve_subcontract_component_variant(
                p_tenant_id, v_bom.component_item_id
            );
            IF v_component_variant_id IS NULL THEN CONTINUE; END IF;

            v_consume_qty := private.money_round(v_bom.quantity_per * v_qty_accepted);
            IF v_consume_qty <= 0 THEN CONTINUE; END IF;

            INSERT INTO _subcon_wip_demand (component_variant_id, component_item_id, required_qty)
            VALUES (v_component_variant_id, v_bom.component_item_id, v_consume_qty)
            ON CONFLICT (component_variant_id) DO UPDATE
            SET required_qty = _subcon_wip_demand.required_qty + EXCLUDED.required_qty;
        END LOOP;
    END LOOP;

    FOR v_demand IN SELECT * FROM _subcon_wip_demand
    LOOP
        v_on_hand := private.get_item_valuation_on_hand(
            p_tenant_id, v_job_location_id, v_demand.component_item_id, v_demand.component_variant_id
        );

        IF v_on_hand + 0.0001 < v_demand.required_qty THEN
            SELECT iv.sku INTO v_component_sku
            FROM public.item_variants iv
            WHERE iv.id = v_demand.component_variant_id;

            RAISE EXCEPTION
                'insufficient subcontract WIP for % at %: need %, have %',
                COALESCE(v_component_sku, v_demand.component_item_id::TEXT),
                v_location_name,
                v_demand.required_qty,
                v_on_hand;
        END IF;
    END LOOP;
END;
$$;

-- Core backflush engine. When p_gr_item_id is set, backflush p_quantity for QC release.
CREATE OR REPLACE FUNCTION private.apply_subcontract_backflush_for_grn_internal(
    p_tenant_id UUID,
    p_goods_receipt_id UUID,
    p_qc_required BOOLEAN,
    p_gr_item_id UUID,
    p_quantity NUMERIC,
    p_created_by UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
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
    v_fg_qty NUMERIC(15, 4);
    v_insufficient_policy TEXT;
BEGIN
    SELECT * INTO v_gr
    FROM public.goods_receipts
    WHERE id = p_goods_receipt_id AND tenant_id = p_tenant_id;

    IF NOT FOUND THEN RAISE EXCEPTION 'goods receipt not found'; END IF;
    IF v_gr.purchase_order_id IS NULL THEN
        RETURN jsonb_build_object('skipped', TRUE, 'reason', 'standalone_receipt');
    END IF;

    SELECT * INTO v_po
    FROM public.purchase_orders
    WHERE id = v_gr.purchase_order_id AND tenant_id = p_tenant_id;

    IF NOT FOUND THEN RAISE EXCEPTION 'purchase order not found'; END IF;
    IF NOT COALESCE(v_po.is_subcontract_job, FALSE) THEN
        RETURN jsonb_build_object('skipped', TRUE, 'reason', 'not_subcontract_job');
    END IF;

    v_job_location_id := private.resolve_subcontract_wip_location(p_tenant_id, v_po.supplier_id);
    IF v_job_location_id IS NULL THEN
        RETURN jsonb_build_object('skipped', TRUE, 'reason', 'no_subcontract_location');
    END IF;

    v_insufficient_policy := COALESCE(
        private.get_job_work_control_text(p_tenant_id, 'insufficient_wip_policy', 'BLOCK_RECEIPT'),
        'BLOCK_RECEIPT'
    );

    v_reference := v_gr.voucher_number || '|SUBCONTRACT-BACKFLUSH';

    FOR v_line IN
        SELECT gri.*
        FROM public.goods_receipt_items gri
        WHERE gri.goods_receipt_id = p_goods_receipt_id
          AND gri.tenant_id = p_tenant_id
          AND COALESCE(gri.is_promotional, FALSE) = FALSE
          AND (p_gr_item_id IS NULL OR gri.id = p_gr_item_id)
    LOOP
        IF p_gr_item_id IS NOT NULL THEN
            IF NOT private.job_work_backflush_at_qc_release(p_tenant_id) THEN
                CONTINUE;
            END IF;
            IF NOT COALESCE(v_line.route_to_qc, FALSE) THEN
                CONTINUE;
            END IF;
            v_fg_qty := GREATEST(COALESCE(p_quantity, 0), 0);
            v_reference := v_gr.voucher_number || '|SUBCONTRACT-BACKFLUSH|QC|' || v_line.id::TEXT;
        ELSE
            IF NOT private.job_work_backflush_at_grn(p_tenant_id, COALESCE(v_line.route_to_qc, FALSE)) THEN
                CONTINUE;
            END IF;
            v_fg_qty := GREATEST(COALESCE(v_line.quantity_accepted, v_line.quantity_received, 0), 0);
        END IF;

        IF v_fg_qty <= 0 THEN CONTINUE; END IF;

        FOR v_bom IN
            SELECT sbl.component_item_id, sbl.quantity_per, iv.id AS component_variant_id
            FROM public.subcontract_bom_lines sbl
            LEFT JOIN LATERAL (
                SELECT id FROM public.item_variants
                WHERE tenant_id = p_tenant_id
                  AND item_id = sbl.component_item_id
                  AND is_active = TRUE
                ORDER BY created_at
                LIMIT 1
            ) iv ON TRUE
            WHERE sbl.tenant_id = p_tenant_id
              AND sbl.parent_item_id = v_line.item_id
        LOOP
            IF v_bom.component_variant_id IS NULL THEN CONTINUE; END IF;

            v_consume_qty := private.money_round(v_bom.quantity_per * v_fg_qty);
            IF v_consume_qty <= 0 THEN CONTINUE; END IF;

            v_unit_cost := private.get_item_average_cost(
                p_tenant_id, v_job_location_id, v_bom.component_item_id, v_bom.component_variant_id
            );

            v_on_hand := private.get_item_valuation_on_hand(
                p_tenant_id, v_job_location_id, v_bom.component_item_id, v_bom.component_variant_id
            );

            IF v_on_hand + 0.0001 < v_consume_qty THEN
                IF v_insufficient_policy = 'EXCEPTION_QUEUE' THEN
                    CONTINUE;
                END IF;
                RAISE EXCEPTION 'insufficient subcontract WIP for component % at vendor location',
                    v_bom.component_item_id;
            END IF;

            INSERT INTO public.inventory_ledger (
                tenant_id, item_id, variant_id, location_id,
                transaction_type, quantity, cost_at_transaction,
                reference_document, created_by
            )
            VALUES (
                p_tenant_id, v_bom.component_item_id, v_bom.component_variant_id, v_job_location_id,
                'PRODUCTION_CONSUMPTION', -v_consume_qty, private.money_round(v_unit_cost),
                v_reference, COALESCE(p_created_by, v_gr.created_by)
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

CREATE OR REPLACE FUNCTION public.apply_subcontract_backflush_for_grn(p_goods_receipt_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_tenant_id UUID;
    v_qc_required BOOLEAN;
    v_gr public.goods_receipts%ROWTYPE;
BEGIN
    v_tenant_id := private.current_tenant_id();
    IF v_tenant_id IS NULL THEN RAISE EXCEPTION 'tenant context missing from session'; END IF;

    SELECT * INTO v_gr FROM public.goods_receipts
    WHERE id = p_goods_receipt_id AND tenant_id = v_tenant_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'goods receipt not found'; END IF;

    IF EXISTS (
        SELECT 1 FROM public.inventory_ledger il
        WHERE il.tenant_id = v_tenant_id
          AND il.reference_document LIKE v_gr.voucher_number || '|SUBCONTRACT-BACKFLUSH%'
    ) THEN
        RETURN jsonb_build_object('skipped', TRUE, 'reason', 'already_applied');
    END IF;

    v_qc_required := private.get_procurement_control_flag(v_tenant_id, 'is_qc_required_before_stocking');

    RETURN private.apply_subcontract_backflush_for_grn_internal(
        v_tenant_id, p_goods_receipt_id, v_qc_required, NULL, NULL, v_gr.created_by
    );
END;
$$;

REVOKE ALL ON FUNCTION public.apply_subcontract_backflush_for_grn(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_subcontract_backflush_for_grn(UUID) TO authenticated;

-- post_goods_receipt: inline subcontract backflush (Release 0)

DROP FUNCTION IF EXISTS public.post_goods_receipt(UUID, UUID, JSONB, UUID, TEXT, DATE, VARCHAR, NUMERIC, NUMERIC, NUMERIC, NUMERIC, JSONB);
DROP FUNCTION IF EXISTS public.post_goods_receipt(UUID, UUID, JSONB, UUID, TEXT, DATE, VARCHAR, NUMERIC, NUMERIC, NUMERIC, NUMERIC, JSONB, TEXT, BOOLEAN, UUID, UUID, UUID);

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
    p_landed_charges JSONB DEFAULT '[]'::jsonb,
    p_receipt_stage TEXT DEFAULT 'FINAL',
    p_is_po_fulfilling BOOLEAN DEFAULT TRUE,
    p_parent_grn_id UUID DEFAULT NULL,
    p_shipment_id UUID DEFAULT NULL,
    p_staging_location_id UUID DEFAULT NULL
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
    v_receipt_stage TEXT;
    v_allow_staging_mismatch BOOLEAN;
    v_require_boe_policy TEXT;
    v_receipt_strategy TEXT;
    v_po_fulfillment_stage TEXT;
    v_shipment_staging UUID;
    v_boe_required BOOLEAN;
    v_destination_allowed BOOLEAN := FALSE;
    v_backflush_result JSONB;
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

    v_allow_staging_mismatch := private.get_import_logistics_control_flag(
        v_tenant_id, 'allow_staging_receipt_location_mismatch', FALSE
    );
    v_require_boe_policy := COALESCE(
        private.get_import_logistics_control_text(v_tenant_id, 'require_boe_on_first_receipt', 'ALWAYS'),
        'ALWAYS'
    );
    v_receipt_strategy := COALESCE(
        private.get_import_logistics_control_text(v_tenant_id, 'import_receipt_document_strategy', 'SINGLE_FINAL_ONLY'),
        'SINGLE_FINAL_ONLY'
    );
    v_receipt_stage := COALESCE(NULLIF(upper(btrim(p_receipt_stage)), ''), 'FINAL');

    IF v_receipt_strategy = 'SINGLE_FINAL_ONLY' AND v_receipt_stage <> 'FINAL' THEN
        RAISE EXCEPTION 'tenant import policy only allows FINAL receipt stage';
    END IF;

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
        v_po_fulfillment_stage := COALESCE(
            NULLIF(upper(btrim(v_po.po_fulfillment_stage_override)), ''),
            private.get_import_logistics_control_text(v_tenant_id, 'po_fulfillment_stage', 'COMMERCIAL'),
            'COMMERCIAL'
        );

        v_destination_allowed := (p_destination_location_id = v_po.destination_location_id);

        IF NOT v_destination_allowed AND v_po.receipt_location_id IS NOT NULL THEN
            v_destination_allowed := (p_destination_location_id = v_po.receipt_location_id);
        END IF;

        IF NOT v_destination_allowed AND v_po.ultimate_destination_location_id IS NOT NULL THEN
            v_destination_allowed := (p_destination_location_id = v_po.ultimate_destination_location_id);
        END IF;

        IF NOT v_destination_allowed AND p_staging_location_id IS NOT NULL THEN
            v_destination_allowed := (p_destination_location_id = p_staging_location_id);
        END IF;

        IF NOT v_destination_allowed AND v_allow_staging_mismatch THEN
            v_destination_allowed := TRUE;
        END IF;

        IF NOT v_destination_allowed THEN
            RAISE EXCEPTION 'destination location must match purchase order receipt or destination site';
        END IF;

        IF p_shipment_id IS NOT NULL AND to_regclass('public.import_shipments') IS NOT NULL THEN
            SELECT staging_location_id INTO v_shipment_staging
            FROM public.import_shipments
            WHERE id = p_shipment_id AND tenant_id = v_tenant_id;
            IF FOUND AND v_shipment_staging IS NOT NULL
               AND p_destination_location_id IS DISTINCT FROM v_shipment_staging
               AND NOT v_allow_staging_mismatch
               AND v_receipt_stage IN ('COMMERCIAL', 'CUSTOMS')
            THEN
                RAISE EXCEPTION 'destination must match shipment staging location';
            END IF;
        END IF;

        v_boe_required := FALSE;
        IF v_po.tax_supply_nature = 'IMPORT_GOODS' AND v_receipt_stage <> 'GIT_CLEARANCE' THEN
            IF v_receipt_stage = 'COMMERCIAL' THEN
                v_boe_required := v_require_boe_policy = 'ALWAYS'
                    AND NOT private.get_import_logistics_control_flag(
                        v_tenant_id, 'allow_commercial_receipt_before_customs', FALSE
                    );
            ELSIF v_receipt_stage = 'FINAL' THEN
                v_boe_required := v_require_boe_policy IN ('ALWAYS', 'ON_FINAL_RECEIPT_ONLY');
            ELSIF v_receipt_stage = 'CUSTOMS' THEN
                v_boe_required := v_require_boe_policy = 'ALWAYS';
            END IF;
        END IF;

        IF v_boe_required THEN
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

    IF p_purchase_order_id IS NOT NULL AND COALESCE(v_po.is_subcontract_job, FALSE) THEN
        PERFORM private.validate_subcontract_wip_for_grn(
            v_tenant_id, p_purchase_order_id, v_po.supplier_id, p_lines, v_qc_required, v_allow_qc_override
        );
    END IF;

    v_voucher_number := public.generate_next_voucher_string(
        v_tenant_id, 'GOODS_RECEIPT_NOTE'::public.document_voucher_type, NULL, p_destination_location_id
    );

    INSERT INTO public.goods_receipts (
        tenant_id, destination_location_id, purchase_order_id, voucher_number, created_by,
        is_qc_pending,
        tax_supply_nature, tax_mechanism,
        bill_of_entry_number, bill_of_entry_date, port_code,
        exchange_rate, assessable_value, customs_duty_amount, import_igst_amount,
        receipt_stage, is_po_fulfilling, parent_grn_id, shipment_id, staging_location_id
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
        v_import_igst_header,
        COALESCE(v_receipt_stage, 'FINAL'),
        COALESCE(p_is_po_fulfilling, TRUE),
        p_parent_grn_id,
        p_shipment_id,
        p_staging_location_id
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
            IF COALESCE(p_is_po_fulfilling, TRUE) THEN
                v_open_qty := v_po_item.quantity_ordered - v_po_item.quantity_received;
                IF v_qty > v_open_qty THEN
                    RAISE EXCEPTION 'quantity_received exceeds open purchase order quantity';
                END IF;
            END IF;
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

        IF p_purchase_order_id IS NOT NULL AND v_po_item_id IS NOT NULL AND COALESCE(p_is_po_fulfilling, TRUE) THEN
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

    IF p_purchase_order_id IS NOT NULL AND COALESCE(p_is_po_fulfilling, TRUE) THEN
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
    ELSIF p_purchase_order_id IS NOT NULL THEN
        INSERT INTO public.purchase_order_grn_mappings (tenant_id, purchase_order_id, goods_receipt_id, mapped_by)
        VALUES (v_tenant_id, p_purchase_order_id, v_gr_id, p_created_by)
        ON CONFLICT (purchase_order_id, goods_receipt_id) DO NOTHING;
        v_steps := private.append_posting_step(
            v_steps, 'grn_po_fulfillment_updated', 'skipped', 'non-PO-fulfilling receipt'
        );
    ELSE
        v_steps := private.append_posting_step(v_steps, 'grn_po_fulfillment_updated', 'skipped', NULL);
    END IF;

    IF p_purchase_order_id IS NOT NULL AND COALESCE(v_po.is_subcontract_job, FALSE) THEN
        v_backflush_result := private.apply_subcontract_backflush_for_grn_internal(
            v_tenant_id, v_gr_id, v_qc_required, NULL, NULL, p_created_by
        );
        IF COALESCE((v_backflush_result ->> 'skipped')::BOOLEAN, FALSE) THEN
            v_steps := private.append_posting_step(
                v_steps, 'grn_subcontract_backflush', 'skipped', v_backflush_result ->> 'reason'
            );
        ELSE
            v_steps := private.append_posting_step(
                v_steps, 'grn_subcontract_backflush', 'success',
                COALESCE(v_backflush_result ->> 'quantity_consumed', '0') || ' units consumed'
            );
        END IF;
    ELSE
        v_steps := private.append_posting_step(v_steps, 'grn_subcontract_backflush', 'skipped', NULL);
    END IF;

    INSERT INTO public.document_posting_runs (
        tenant_id, document_type, document_id, overall_status, steps, posted_by
    ) VALUES (
        v_tenant_id, 'GRN'::public.document_posting_document_type, v_gr_id, 'success', v_steps, p_created_by
    );

    RETURN jsonb_build_object('goods_receipt_id', v_gr_id, 'steps', v_steps);
END;
$$;

REVOKE ALL ON FUNCTION public.post_goods_receipt(UUID, UUID, JSONB, UUID, TEXT, DATE, VARCHAR, NUMERIC, NUMERIC, NUMERIC, NUMERIC, JSONB, TEXT, BOOLEAN, UUID, UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.post_goods_receipt(UUID, UUID, JSONB, UUID, TEXT, DATE, VARCHAR, NUMERIC, NUMERIC, NUMERIC, NUMERIC, JSONB, TEXT, BOOLEAN, UUID, UUID, UUID) TO authenticated;


-- Patch save_purchase_order for import receipt routing fields.

DROP FUNCTION IF EXISTS public.save_purchase_order(
    UUID, UUID, UUID, JSONB, UUID, INTEGER, JSONB, VARCHAR, BOOLEAN,
    NUMERIC, NUMERIC, NUMERIC, TEXT, NUMERIC, NUMERIC,
    NUMERIC, NUMERIC, TEXT,
    UUID, UUID, TEXT, BOOLEAN
);

CREATE OR REPLACE FUNCTION public.save_purchase_order(
    p_purchase_order_id UUID,
    p_destination_location_id UUID,
    p_supplier_id UUID,
    p_lines JSONB,
    p_created_by UUID,
    p_payment_terms_days INTEGER DEFAULT NULL,
    p_custom_fields JSONB DEFAULT NULL,
    p_currency_code VARCHAR(3) DEFAULT NULL,
    p_prices_tax_inclusive BOOLEAN DEFAULT NULL,
    p_shipping_amount NUMERIC DEFAULT NULL,
    p_shipping_tax_rate_pct NUMERIC DEFAULT NULL,
    p_shipping_tax_amount NUMERIC DEFAULT NULL,
    p_shipping_tax_type TEXT DEFAULT NULL,
    p_round_off_amount NUMERIC DEFAULT NULL,
    p_additional_charges_amount NUMERIC DEFAULT NULL,
    p_transaction_discount_percentage NUMERIC DEFAULT NULL,
    p_transaction_discount_amount NUMERIC DEFAULT NULL,
    p_transaction_discount_type TEXT DEFAULT NULL,
    p_receipt_location_id UUID DEFAULT NULL,
    p_ultimate_destination_location_id UUID DEFAULT NULL,
    p_po_fulfillment_stage_override TEXT DEFAULT NULL,
    p_is_subcontract_job BOOLEAN DEFAULT FALSE
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_tenant_id UUID;
    v_tenant_country TEXT;
    v_location RECORD;
    v_supplier RECORD;
    v_gst_ctx RECORD;
    v_po_id UUID;
    v_po_status public.purchase_document_status;
    v_voucher_number TEXT;
    v_entry JSONB;
    v_scratch RECORD;
    v_variant_id UUID;
    v_item_id UUID;
    v_base_uom TEXT;
    v_line_uom TEXT;
    v_requested_uom TEXT;
    v_uom_conversion NUMERIC(15, 6);
    v_qty NUMERIC(15, 4);
    v_unit_price NUMERIC(15, 4);
    v_discount_pct NUMERIC(5, 2);
    v_discount_amt NUMERIC(15, 4);
    v_line_extension NUMERIC(15, 4);
    v_line_discount NUMERIC(15, 4);
    v_line_taxable_pre NUMERIC(15, 4);
    v_combined_discount NUMERIC(15, 4);
    v_discount_per_unit NUMERIC(15, 4);
    v_line_gross NUMERIC(15, 4);
    v_line_tax NUMERIC(15, 4);
    v_tax_rate NUMERIC(15, 4);
    v_tax_components JSONB := '[]'::jsonb;
    v_tracking public.item_tracking_mode;
    v_track_inventory BOOLEAN;
    v_total_gross NUMERIC(15, 4) := 0;
    v_total_tax NUMERIC(15, 4) := 0;
    v_subtotal_pre_txn NUMERIC(15, 4) := 0;
    v_txn_discount NUMERIC(15, 4) := 0;
    v_txn_discount_pct NUMERIC(5, 2) := 0;
    v_txn_discount_amt NUMERIC(15, 4) := 0;
    v_txn_discount_type TEXT := 'percent';
    v_apportioned_sum NUMERIC(15, 4) := 0;
    v_line_count INTEGER := 0;
    v_scratch_count INTEGER := 0;
    v_payment_terms INTEGER := GREATEST(COALESCE(p_payment_terms_days, 0), 0);
    v_custom_fields JSONB := COALESCE(p_custom_fields, '{}'::jsonb);
    v_allow_issued_edit BOOLEAN := FALSE;
    v_allow_line_discounts BOOLEAN := FALSE;
    v_allow_txn_discounts BOOLEAN := FALSE;
    v_purchase_tax_inclusive BOOLEAN := FALSE;
    v_tax_supply_nature TEXT := 'INTERSTATE';
    v_tax_mechanism public.gst_tax_mechanism := 'FORWARD';
    v_currency_code VARCHAR(3);
    v_existing_destination_id UUID;
    v_receipt_location_id UUID := p_receipt_location_id;
    v_ultimate_destination_location_id UUID := COALESCE(
        p_ultimate_destination_location_id,
        p_destination_location_id
    );
    v_po_fulfillment_stage_override TEXT := NULLIF(upper(btrim(COALESCE(p_po_fulfillment_stage_override, ''))), '');
    v_is_subcontract_job BOOLEAN := COALESCE(p_is_subcontract_job, FALSE);
    v_shipping_amount NUMERIC(15, 4) := GREATEST(COALESCE(p_shipping_amount, 0), 0);
    v_shipping_tax_rate_pct NUMERIC(15, 4) := GREATEST(COALESCE(p_shipping_tax_rate_pct, 0), 0);
    v_shipping_tax_amount NUMERIC(15, 4) := 0;
    v_shipping_tax_type TEXT := CASE
        WHEN lower(btrim(COALESCE(p_shipping_tax_type, 'percent'))) = 'amount' THEN 'amount'
        ELSE 'percent'
    END;
    v_round_off_amount NUMERIC(15, 4) := COALESCE(p_round_off_amount, 0);
    v_additional_charges_amount NUMERIC(15, 4) := GREATEST(COALESCE(p_additional_charges_amount, 0), 0);
BEGIN
    v_tenant_id := private.current_tenant_id();
    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'tenant context missing from session';
    END IF;

    IF NOT private.can_edit_purchase_orders() THEN
        RAISE EXCEPTION 'purchase order edit permission required';
    END IF;

    IF p_created_by IS NULL THEN
        RAISE EXCEPTION 'created_by is required';
    END IF;

    IF p_destination_location_id IS NULL THEN
        RAISE EXCEPTION 'destination location is required';
    END IF;

    IF NOT private.user_can_access_po_destination(p_destination_location_id) THEN
        RAISE EXCEPTION 'destination location is outside your procurement scope';
    END IF;

    IF v_po_fulfillment_stage_override IS NOT NULL
       AND v_po_fulfillment_stage_override NOT IN ('COMMERCIAL', 'FINAL') THEN
        RAISE EXCEPTION 'po_fulfillment_stage_override must be COMMERCIAL or FINAL';
    END IF;

    IF v_receipt_location_id IS NOT NULL
       AND NOT private.user_can_access_po_destination(v_receipt_location_id) THEN
        RAISE EXCEPTION 'receipt location is outside your procurement scope';
    END IF;

    IF v_ultimate_destination_location_id IS NOT NULL
       AND NOT private.user_can_access_po_destination(v_ultimate_destination_location_id) THEN
        RAISE EXCEPTION 'ultimate destination location is outside your procurement scope';
    END IF;

    IF p_supplier_id IS NULL THEN
        RAISE EXCEPTION 'supplier is required';
    END IF;

    IF p_lines IS NULL OR jsonb_typeof(p_lines) IS DISTINCT FROM 'array' OR jsonb_array_length(p_lines) = 0 THEN
        RAISE EXCEPTION 'at least one purchase order line is required';
    END IF;

    IF jsonb_typeof(v_custom_fields) IS DISTINCT FROM 'object' THEN
        RAISE EXCEPTION 'custom_fields must be a JSON object';
    END IF;

    IF v_shipping_tax_type = 'amount' THEN
        v_shipping_tax_amount := GREATEST(COALESCE(p_shipping_tax_amount, 0), 0);
        v_shipping_tax_rate_pct := 0;
    ELSE
        v_shipping_tax_amount := ROUND(v_shipping_amount * v_shipping_tax_rate_pct / 100, 4);
    END IF;

    SELECT upper(btrim(COALESCE(country_code, 'IN')))
    INTO v_tenant_country
    FROM public.tenants
    WHERE id = v_tenant_id;

    SELECT upper(btrim(COALESCE(
        p_currency_code,
        (SELECT t.base_currency FROM public.tenants t WHERE t.id = v_tenant_id),
        'USD'
    )))
    INTO v_currency_code;

    IF v_currency_code IS NULL OR length(v_currency_code) <> 3 THEN
        RAISE EXCEPTION 'currency_code must be a 3-letter code';
    END IF;

    SELECT id, code, is_stock_holding, presence_type, state
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

    SELECT id, type, billing_state, tax_treatment, billing_country_code, incoterms_code
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

    SELECT * INTO v_gst_ctx FROM private.gst_resolve_supply_context(
        v_tenant_country,
        COALESCE(v_supplier.tax_treatment, 'REGULAR_B2B'::public.tax_treatment_type),
        v_supplier.billing_country_code,
        v_supplier.billing_state,
        v_location.state,
        'PURCHASE',
        'GOODS'
    ) LIMIT 1;

    v_tax_supply_nature := v_gst_ctx.supply_nature;
    v_tax_mechanism := v_gst_ctx.tax_mechanism;

    v_allow_issued_edit := private.get_procurement_control_flag(
        v_tenant_id,
        'allow_edit_issued_purchase_orders'
    );

    v_allow_line_discounts := private.get_procurement_control_flag(
        v_tenant_id,
        'allow_line_item_discounts'
    );

    v_allow_txn_discounts := private.get_procurement_control_flag(
        v_tenant_id,
        'allow_transaction_discounts'
    );

    IF p_prices_tax_inclusive IS NOT NULL THEN
        v_purchase_tax_inclusive := p_prices_tax_inclusive;
    ELSE
        v_purchase_tax_inclusive := private.get_procurement_control_flag(
            v_tenant_id,
            'purchase_prices_tax_inclusive'
        );
    END IF;

    IF v_allow_txn_discounts THEN
        v_txn_discount_type := CASE
            WHEN lower(btrim(COALESCE(p_transaction_discount_type, 'percent'))) = 'amount' THEN 'amount'
            ELSE 'percent'
        END;
        v_txn_discount_pct := GREATEST(COALESCE(p_transaction_discount_percentage, 0), 0);
        v_txn_discount_amt := GREATEST(COALESCE(p_transaction_discount_amount, 0), 0);

        IF v_txn_discount_pct > 100 THEN
            RAISE EXCEPTION 'transaction_discount_percentage cannot exceed 100';
        END IF;
    ELSE
        v_txn_discount_type := 'percent';
        v_txn_discount_pct := 0;
        v_txn_discount_amt := 0;
    END IF;

    IF p_purchase_order_id IS NOT NULL THEN
        SELECT id, document_status, destination_location_id
        INTO v_po_id, v_po_status, v_existing_destination_id
        FROM public.purchase_orders
        WHERE id = p_purchase_order_id
          AND tenant_id = v_tenant_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'purchase order not found';
        END IF;

        IF NOT private.user_can_access_po_destination(v_existing_destination_id) THEN
            RAISE EXCEPTION 'purchase order is outside your procurement scope';
        END IF;

        IF v_po_status <> 'DRAFT'::public.purchase_document_status
           AND NOT (v_allow_issued_edit AND v_po_status = 'ISSUED_ACTIVE'::public.purchase_document_status) THEN
            RAISE EXCEPTION 'this purchase order cannot be edited';
        END IF;

        UPDATE public.purchase_orders
        SET destination_location_id = p_destination_location_id,
            supplier_id = p_supplier_id,
            payment_terms_days = v_payment_terms,
            currency_code = v_currency_code,
            custom_fields = v_custom_fields,
            prices_tax_inclusive = v_purchase_tax_inclusive,
            tax_supply_nature = v_tax_supply_nature,
            tax_mechanism = v_tax_mechanism,
            supplier_tax_treatment = v_supplier.tax_treatment,
            supplier_country_code = upper(btrim(v_supplier.billing_country_code)),
            incoterms_code = v_supplier.incoterms_code,
            rcm_applicable = (v_tax_mechanism = 'REVERSE_CHARGE'::public.gst_tax_mechanism),
            shipping_amount = v_shipping_amount,
            shipping_tax_rate_pct = v_shipping_tax_rate_pct,
            shipping_tax_amount = v_shipping_tax_amount,
            shipping_tax_type = v_shipping_tax_type,
            round_off_amount = v_round_off_amount,
            additional_charges_amount = v_additional_charges_amount,
            transaction_discount_percentage = v_txn_discount_pct,
            transaction_discount_amount = v_txn_discount_amt,
            transaction_discount_type = v_txn_discount_type,
            receipt_location_id = v_receipt_location_id,
            ultimate_destination_location_id = v_ultimate_destination_location_id,
            po_fulfillment_stage_override = v_po_fulfillment_stage_override,
            is_subcontract_job = v_is_subcontract_job,
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
            payment_terms_days,
            currency_code,
            custom_fields,
            prices_tax_inclusive,
            tax_supply_nature,
            tax_mechanism,
            supplier_tax_treatment,
            supplier_country_code,
            incoterms_code,
            rcm_applicable,
            shipping_amount,
            shipping_tax_rate_pct,
            shipping_tax_amount,
            shipping_tax_type,
            round_off_amount,
            additional_charges_amount,
            transaction_discount_percentage,
            transaction_discount_amount,
            transaction_discount_type,
            receipt_location_id,
            ultimate_destination_location_id,
            po_fulfillment_stage_override,
            is_subcontract_job,
            created_by
        )
        VALUES (
            v_tenant_id,
            p_destination_location_id,
            p_supplier_id,
            v_voucher_number,
            'DRAFT'::public.purchase_document_status,
            v_payment_terms,
            v_currency_code,
            v_custom_fields,
            v_purchase_tax_inclusive,
            v_tax_supply_nature,
            v_tax_mechanism,
            v_supplier.tax_treatment,
            upper(btrim(v_supplier.billing_country_code)),
            v_supplier.incoterms_code,
            (v_tax_mechanism = 'REVERSE_CHARGE'::public.gst_tax_mechanism),
            v_shipping_amount,
            v_shipping_tax_rate_pct,
            v_shipping_tax_amount,
            v_shipping_tax_type,
            v_round_off_amount,
            v_additional_charges_amount,
            v_txn_discount_pct,
            v_txn_discount_amt,
            v_txn_discount_type,
            v_receipt_location_id,
            v_ultimate_destination_location_id,
            v_po_fulfillment_stage_override,
            v_is_subcontract_job,
            p_created_by
        )
        RETURNING id INTO v_po_id;
    END IF;

    CREATE TEMP TABLE _po_save_scratch (
        seq INT PRIMARY KEY,
        variant_id UUID NOT NULL,
        item_id UUID NOT NULL,
        line_uom TEXT NOT NULL,
        uom_conversion NUMERIC(15, 6) NOT NULL,
        qty NUMERIC(15, 4) NOT NULL,
        unit_price NUMERIC(15, 4) NOT NULL,
        discount_pct NUMERIC(5, 2) NOT NULL,
        discount_amt NUMERIC(15, 4) NOT NULL,
        line_taxable_pre NUMERIC(15, 4) NOT NULL,
        txn_discount_share NUMERIC(15, 4) NOT NULL DEFAULT 0
    ) ON COMMIT DROP;

    v_scratch_count := 0;

    FOR v_entry IN SELECT value FROM jsonb_array_elements(p_lines)
    LOOP
        v_variant_id := NULLIF(v_entry ->> 'variant_id', '')::UUID;
        v_qty := NULLIF(v_entry ->> 'quantity_ordered', '')::NUMERIC;
        v_unit_price := COALESCE(NULLIF(v_entry ->> 'unit_price_contractual', '')::NUMERIC, 0);
        v_discount_pct := GREATEST(COALESCE(NULLIF(v_entry ->> 'discount_percentage', '')::NUMERIC, 0), 0);
        v_discount_amt := GREATEST(COALESCE(NULLIF(v_entry ->> 'discount_amount', '')::NUMERIC, 0), 0);
        v_requested_uom := NULLIF(btrim(v_entry ->> 'uom_code'), '');

        IF v_variant_id IS NULL THEN
            RAISE EXCEPTION 'variant_id is required on each line';
        END IF;

        IF v_qty IS NULL OR v_qty <= 0 THEN
            RAISE EXCEPTION 'quantity_ordered must be greater than zero';
        END IF;

        IF v_unit_price < 0 THEN
            RAISE EXCEPTION 'unit_price_contractual cannot be negative';
        END IF;

        IF NOT v_allow_line_discounts THEN
            v_discount_pct := 0;
            v_discount_amt := 0;
        END IF;

        IF v_discount_pct > 100 THEN
            RAISE EXCEPTION 'discount_percentage cannot exceed 100';
        END IF;

        SELECT iv.item_id, i.track_inventory, i.tracking_mode, i.base_unit_of_measure
        INTO v_item_id, v_track_inventory, v_tracking, v_base_uom
        FROM public.item_variants iv
        INNER JOIN public.items i ON i.id = iv.item_id AND i.tenant_id = iv.tenant_id
        WHERE iv.id = v_variant_id
          AND iv.tenant_id = v_tenant_id
          AND iv.is_active = TRUE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'variant not found';
        END IF;

        IF NOT COALESCE(v_track_inventory, FALSE) THEN
            RAISE EXCEPTION 'variant does not track inventory';
        END IF;

        v_base_uom := COALESCE(NULLIF(btrim(v_base_uom), ''), 'PCS');

        IF v_requested_uom IS NULL OR v_requested_uom = v_base_uom THEN
            v_line_uom := v_base_uom;
            v_uom_conversion := 1;
        ELSE
            SELECT iu.conversion_factor
            INTO v_uom_conversion
            FROM public.item_uoms iu
            WHERE iu.item_id = v_item_id
              AND iu.tenant_id = v_tenant_id
              AND iu.uom_code = v_requested_uom
            LIMIT 1;

            IF NOT FOUND OR v_uom_conversion IS NULL OR v_uom_conversion <= 0 THEN
                RAISE EXCEPTION 'uom_code is not a valid alternate unit for this item';
            END IF;

            v_line_uom := v_requested_uom;
        END IF;

        v_line_extension := v_qty * v_unit_price;

        IF v_discount_amt > 0 THEN
            v_line_discount := LEAST(v_discount_amt, v_line_extension);
            v_discount_pct := 0;
        ELSIF v_discount_pct > 0 THEN
            v_line_discount := LEAST(v_line_extension, v_line_extension * v_discount_pct / 100);
            v_discount_amt := 0;
        ELSE
            v_line_discount := 0;
        END IF;

        v_discount_per_unit := CASE
            WHEN v_qty > 0 THEN ROUND(v_line_discount / v_qty, 4)
            ELSE 0
        END;

        SELECT taxable_base
        INTO v_line_taxable_pre
        FROM private.resolve_line_tax(
            v_item_id,
            v_qty,
            v_unit_price,
            v_discount_per_unit,
            v_purchase_tax_inclusive,
            v_tax_supply_nature,
            v_tax_mechanism
        )
        LIMIT 1;

        v_line_taxable_pre := COALESCE(v_line_taxable_pre, GREATEST(v_line_extension - v_line_discount, 0));
        v_subtotal_pre_txn := v_subtotal_pre_txn + v_line_taxable_pre;
        v_scratch_count := v_scratch_count + 1;

        INSERT INTO _po_save_scratch (
            seq,
            variant_id,
            item_id,
            line_uom,
            uom_conversion,
            qty,
            unit_price,
            discount_pct,
            discount_amt,
            line_taxable_pre
        )
        VALUES (
            v_scratch_count,
            v_variant_id,
            v_item_id,
            v_line_uom,
            v_uom_conversion,
            v_qty,
            v_unit_price,
            v_discount_pct,
            v_discount_amt,
            v_line_taxable_pre
        );
    END LOOP;

    IF v_scratch_count = 0 THEN
        RAISE EXCEPTION 'no valid purchase order lines were saved';
    END IF;

    IF v_allow_txn_discounts AND v_subtotal_pre_txn > 0 THEN
        IF v_txn_discount_type = 'amount' AND v_txn_discount_amt > 0 THEN
            v_txn_discount := LEAST(v_txn_discount_amt, v_subtotal_pre_txn);
            v_txn_discount_pct := 0;
        ELSIF v_txn_discount_type = 'percent' AND v_txn_discount_pct > 0 THEN
            v_txn_discount := LEAST(
                v_subtotal_pre_txn,
                ROUND(v_subtotal_pre_txn * v_txn_discount_pct / 100, 4)
            );
            v_txn_discount_amt := v_txn_discount;
        ELSE
            v_txn_discount := 0;
        END IF;
    ELSE
        v_txn_discount := 0;
        v_txn_discount_pct := 0;
        v_txn_discount_amt := 0;
    END IF;

    IF v_txn_discount > 0 THEN
        v_apportioned_sum := 0;

        FOR v_scratch IN
            SELECT seq, line_taxable_pre
            FROM _po_save_scratch
            ORDER BY seq
        LOOP
            IF v_scratch.seq < v_scratch_count THEN
                UPDATE _po_save_scratch
                SET txn_discount_share = ROUND(
                    v_txn_discount * v_scratch.line_taxable_pre / v_subtotal_pre_txn,
                    4
                )
                WHERE seq = v_scratch.seq;

                SELECT txn_discount_share
                INTO v_line_discount
                FROM _po_save_scratch
                WHERE seq = v_scratch.seq;

                v_apportioned_sum := v_apportioned_sum + COALESCE(v_line_discount, 0);
            ELSE
                UPDATE _po_save_scratch
                SET txn_discount_share = GREATEST(v_txn_discount - v_apportioned_sum, 0)
                WHERE seq = v_scratch.seq;
            END IF;
        END LOOP;
    END IF;

    UPDATE public.purchase_orders
    SET transaction_discount_amount = CASE
            WHEN v_txn_discount_type = 'amount' THEN v_txn_discount
            WHEN v_txn_discount_type = 'percent' THEN v_txn_discount
            ELSE 0
        END,
        transaction_discount_percentage = CASE
            WHEN v_txn_discount_type = 'percent' THEN v_txn_discount_pct
            ELSE 0
        END,
        transaction_discount_type = v_txn_discount_type
    WHERE id = v_po_id;

    FOR v_scratch IN SELECT * FROM _po_save_scratch ORDER BY seq
    LOOP
        v_combined_discount := (
            SELECT CASE
                WHEN v_scratch.discount_amt > 0 THEN LEAST(v_scratch.discount_amt, v_scratch.qty * v_scratch.unit_price)
                WHEN v_scratch.discount_pct > 0 THEN LEAST(
                    v_scratch.qty * v_scratch.unit_price,
                    v_scratch.qty * v_scratch.unit_price * v_scratch.discount_pct / 100
                )
                ELSE 0
            END
        ) + v_scratch.txn_discount_share;

        v_combined_discount := LEAST(v_combined_discount, v_scratch.qty * v_scratch.unit_price);

        v_discount_per_unit := CASE
            WHEN v_scratch.qty > 0 THEN ROUND(v_combined_discount / v_scratch.qty, 4)
            ELSE 0
        END;

        SELECT rate, tax_amount, taxable_base, tax_components
        INTO v_tax_rate, v_line_tax, v_line_gross, v_tax_components
        FROM private.resolve_line_tax(
            v_scratch.item_id,
            v_scratch.qty,
            v_scratch.unit_price,
            v_discount_per_unit,
            v_purchase_tax_inclusive,
            v_tax_supply_nature,
            v_tax_mechanism
        )
        LIMIT 1;

        v_tax_rate := COALESCE(v_tax_rate, 0);
        v_line_tax := COALESCE(v_line_tax, 0);
        v_line_gross := COALESCE(v_line_gross, GREATEST(v_scratch.qty * v_scratch.unit_price - v_combined_discount, 0));
        v_tax_components := COALESCE(v_tax_components, '[]'::jsonb);

        v_total_gross := v_total_gross + v_line_gross;
        v_total_tax := v_total_tax + v_line_tax;

        INSERT INTO public.purchase_order_items (
            tenant_id,
            purchase_order_id,
            item_id,
            variant_id,
            uom_code,
            uom_conversion_factor,
            quantity_ordered,
            unit_price_contractual,
            discount_percentage,
            discount_amount,
            tax_rate_percentage,
            line_tax_amount,
            line_total_gross,
            tax_components_json
        )
        VALUES (
            v_tenant_id,
            v_po_id,
            v_scratch.item_id,
            v_scratch.variant_id,
            v_scratch.line_uom,
            v_scratch.uom_conversion,
            v_scratch.qty,
            v_scratch.unit_price,
            v_scratch.discount_pct,
            v_scratch.discount_amt,
            v_tax_rate,
            v_line_tax,
            v_line_gross,
            v_tax_components
        );

        v_line_count := v_line_count + 1;
    END LOOP;

    UPDATE public.purchase_orders
    SET total_gross_amount = v_total_gross,
        total_tax_amount = v_total_tax + v_shipping_tax_amount,
        total_net_amount = v_total_gross
            + v_total_tax
            + v_shipping_tax_amount
            + v_shipping_amount
            + v_additional_charges_amount
            + v_round_off_amount,
        updated_at = NOW()
    WHERE id = v_po_id;

    PERFORM private.apply_po_save_promo_lines(v_po_id, p_lines);

    RETURN v_po_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.save_purchase_order(
    UUID, UUID, UUID, JSONB, UUID, INTEGER, JSONB, VARCHAR, BOOLEAN,
    NUMERIC, NUMERIC, NUMERIC, TEXT, NUMERIC, NUMERIC,
    NUMERIC, NUMERIC, TEXT,
    UUID, UUID, TEXT,
    BOOLEAN
) TO authenticated;

-- QC line release: deferred subcontract backflush when tenant policy requires it.

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
    v_qc_required BOOLEAN;
    v_backflush_result JSONB;
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

        IF NOT COALESCE(v_gri.route_to_qc, FALSE) THEN
            RAISE EXCEPTION 'line is not routed to quality inspection';
        END IF;

        IF GREATEST(COALESCE(v_gri.quantity_accepted, 0), 0) <= 0 THEN
            RAISE EXCEPTION 'no accepted quantity on line for QC release';
        END IF;

        SELECT * INTO v_gr FROM public.goods_receipts WHERE id = v_gri.goods_receipt_id;

        PERFORM private.upsert_qc_inventory_balance(
            v_tenant_id,
            v_gr.destination_location_id,
            v_gri.item_id,
            v_gri.variant_id,
            v_gri.goods_receipt_id,
            v_gri.id,
            GREATEST(COALESCE(v_gri.quantity_accepted, 0), 0),
            v_gri.total_final_landed_cost
        );

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

    IF v_release > 0 THEN
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

        v_qc_required := private.get_procurement_control_flag(v_tenant_id, 'is_qc_required_before_stocking');
        v_backflush_result := private.apply_subcontract_backflush_for_grn_internal(
            v_tenant_id,
            v_row.goods_receipt_id,
            v_qc_required,
            p_goods_receipt_item_id,
            v_release,
            COALESCE(p_released_by, v_gr.created_by)
        );

        IF COALESCE((v_backflush_result ->> 'skipped')::BOOLEAN, FALSE) THEN
            v_steps := private.append_posting_step(
                v_steps, 'grn_subcontract_backflush', 'skipped', v_backflush_result ->> 'reason'
            );
        ELSIF COALESCE((v_backflush_result ->> 'component_issues')::INTEGER, 0) > 0 THEN
            v_steps := private.append_posting_step(
                v_steps, 'grn_subcontract_backflush', 'success',
                COALESCE(v_backflush_result ->> 'quantity_consumed', '0') || ' units consumed on QC release'
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

REVOKE ALL ON FUNCTION public.release_goods_receipt_line_from_qc(UUID, NUMERIC, NUMERIC, public.grn_reject_disposition, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.release_goods_receipt_line_from_qc(UUID, NUMERIC, NUMERIC, public.grn_reject_disposition, UUID) TO authenticated;

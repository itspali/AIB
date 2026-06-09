-- Purchase order edit permission delegates and optional issued-PO editing.

CREATE OR REPLACE FUNCTION private.can_edit_purchase_orders()
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_tenant_id UUID;
    v_user_id UUID;
    v_role public.user_role;
BEGIN
    v_tenant_id := private.current_tenant_id();
    v_user_id := auth.uid();

    IF v_tenant_id IS NULL OR v_user_id IS NULL THEN
        RETURN FALSE;
    END IF;

    SELECT m.role INTO v_role
    FROM public.user_tenant_memberships m
    WHERE m.user_id = v_user_id
      AND m.tenant_id = v_tenant_id
      AND m.is_active = TRUE;

    IF v_role = 'OWNER'::public.user_role THEN
        RETURN TRUE;
    END IF;

    RETURN EXISTS (
        SELECT 1
        FROM public.workspace_control_registry
        WHERE tenant_id = v_tenant_id
          AND registry_key = 'allow_purchase_order_modification'
          AND target_reference_id = v_user_id
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.grant_purchase_order_edit_delegate(p_user_id UUID)
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

    IF NOT private.user_is_organization_owner() THEN
        RAISE EXCEPTION 'only workspace owners can grant purchase order edit access';
    END IF;

    IF p_user_id = auth.uid() THEN
        RAISE EXCEPTION 'owners already have purchase order edit access';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.users u
        WHERE u.id = p_user_id
          AND u.tenant_id = v_tenant_id
          AND u.is_active = TRUE
    ) THEN
        RAISE EXCEPTION 'active user not found in workspace';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.workspace_control_registry wcr
        WHERE wcr.tenant_id = v_tenant_id
          AND wcr.scope_level = 'FUNCTIONAL_MODULE'
          AND wcr.registry_key = 'allow_purchase_order_modification'
          AND wcr.target_reference_id = p_user_id
    ) THEN
        UPDATE public.workspace_control_registry
        SET
            configuration_metadata = jsonb_build_object(
                'granted_by', auth.uid(),
                'granted_at', NOW()
            ),
            updated_at = NOW()
        WHERE tenant_id = v_tenant_id
          AND scope_level = 'FUNCTIONAL_MODULE'
          AND registry_key = 'allow_purchase_order_modification'
          AND target_reference_id = p_user_id;
    ELSE
        INSERT INTO public.workspace_control_registry (
            tenant_id,
            scope_level,
            registry_key,
            target_reference_id,
            configuration_metadata
        )
        VALUES (
            v_tenant_id,
            'FUNCTIONAL_MODULE',
            'allow_purchase_order_modification',
            p_user_id,
            jsonb_build_object(
                'granted_by', auth.uid(),
                'granted_at', NOW()
            )
        );
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.revoke_purchase_order_edit_delegate(p_user_id UUID)
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

    IF NOT private.user_is_organization_owner() THEN
        RAISE EXCEPTION 'only workspace owners can revoke purchase order edit access';
    END IF;

    DELETE FROM public.workspace_control_registry
    WHERE tenant_id = v_tenant_id
      AND scope_level = 'FUNCTIONAL_MODULE'
      AND registry_key = 'allow_purchase_order_modification'
      AND target_reference_id = p_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.save_purchase_order(
    p_purchase_order_id UUID,
    p_destination_location_id UUID,
    p_supplier_id UUID,
    p_lines JSONB,
    p_created_by UUID,
    p_payment_terms_days INTEGER DEFAULT NULL,
    p_custom_fields JSONB DEFAULT NULL
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
    v_po_status public.purchase_document_status;
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
    v_payment_terms INTEGER := GREATEST(COALESCE(p_payment_terms_days, 0), 0);
    v_custom_fields JSONB := COALESCE(p_custom_fields, '{}'::jsonb);
    v_allow_issued_edit BOOLEAN := FALSE;
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

    IF p_supplier_id IS NULL THEN
        RAISE EXCEPTION 'supplier is required';
    END IF;

    IF p_lines IS NULL OR jsonb_typeof(p_lines) IS DISTINCT FROM 'array' OR jsonb_array_length(p_lines) = 0 THEN
        RAISE EXCEPTION 'at least one purchase order line is required';
    END IF;

    IF jsonb_typeof(v_custom_fields) IS DISTINCT FROM 'object' THEN
        RAISE EXCEPTION 'custom_fields must be a JSON object';
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

    v_allow_issued_edit := private.get_procurement_control_flag(
        v_tenant_id,
        'allow_edit_issued_purchase_orders'
    );

    IF p_purchase_order_id IS NOT NULL THEN
        SELECT id, document_status
        INTO v_po_id, v_po_status
        FROM public.purchase_orders
        WHERE id = p_purchase_order_id
          AND tenant_id = v_tenant_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'purchase order not found';
        END IF;

        IF v_po_status = 'DRAFT'::public.purchase_document_status THEN
            NULL;
        ELSIF v_allow_issued_edit
            AND v_po_status = 'ISSUED_ACTIVE'::public.purchase_document_status
        THEN
            NULL;
        ELSE
            RAISE EXCEPTION 'this purchase order cannot be edited';
        END IF;

        UPDATE public.purchase_orders
        SET destination_location_id = p_destination_location_id,
            supplier_id = p_supplier_id,
            payment_terms_days = v_payment_terms,
            custom_fields = v_custom_fields,
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
            custom_fields,
            created_by
        )
        VALUES (
            v_tenant_id,
            p_destination_location_id,
            p_supplier_id,
            v_voucher_number,
            'DRAFT'::public.purchase_document_status,
            v_payment_terms,
            v_custom_fields,
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
            RAISE EXCEPTION 'variant not found';
        END IF;

        IF NOT COALESCE(v_track_inventory, FALSE) THEN
            RAISE EXCEPTION 'variant does not track inventory';
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

    IF NOT private.can_edit_purchase_orders() THEN
        RAISE EXCEPTION 'purchase order edit permission required';
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

REVOKE ALL ON FUNCTION private.can_edit_purchase_orders() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.can_edit_purchase_orders() TO authenticated;

REVOKE ALL ON FUNCTION public.grant_purchase_order_edit_delegate(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.grant_purchase_order_edit_delegate(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.revoke_purchase_order_edit_delegate(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.revoke_purchase_order_edit_delegate(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.save_purchase_order(UUID, UUID, UUID, JSONB, UUID, INTEGER, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_purchase_order(UUID, UUID, UUID, JSONB, UUID, INTEGER, JSONB) TO authenticated;

REVOKE ALL ON FUNCTION public.issue_purchase_order(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.issue_purchase_order(UUID) TO authenticated;

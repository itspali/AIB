-- ====================================================================
-- PO Phase 3 — line tax via resolve_line_tax + procurement tax mode
-- Migration: 20260616200000_purchase_order_line_tax.sql
-- ====================================================================

DROP FUNCTION IF EXISTS public.resolve_line_tax(UUID, NUMERIC, NUMERIC, NUMERIC);
DROP FUNCTION IF EXISTS public.resolve_line_tax(UUID, NUMERIC, NUMERIC, NUMERIC, BOOLEAN);
DROP FUNCTION IF EXISTS private.resolve_line_tax(UUID, NUMERIC, NUMERIC, NUMERIC);
DROP FUNCTION IF EXISTS private.resolve_line_tax(UUID, NUMERIC, NUMERIC, NUMERIC, BOOLEAN);

CREATE OR REPLACE FUNCTION private.resolve_line_tax(
    p_item_id UUID,
    p_qty NUMERIC,
    p_unit_price NUMERIC,
    p_discount_per_unit NUMERIC DEFAULT 0,
    p_price_tax_inclusive BOOLEAN DEFAULT NULL
)
RETURNS TABLE (
    tax_code_id     UUID,
    rate            NUMERIC,
    is_inclusive    BOOLEAN,
    taxable_base    NUMERIC,
    tax_amount      NUMERIC,
    line_total      NUMERIC
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_tenant_id UUID;
    v_tax_code_id UUID;
    v_is_inclusive BOOLEAN := FALSE;
    v_is_variable BOOLEAN := FALSE;
    v_rate NUMERIC(7, 4) := 0;
    v_net_unit NUMERIC(15, 4);
    v_qty NUMERIC(15, 4);
    v_basis_value NUMERIC(15, 4);
    v_gross NUMERIC(15, 4);
    v_base NUMERIC(15, 4);
    v_tax NUMERIC(15, 4);
    v_rule RECORD;
BEGIN
    v_tenant_id := private.current_tenant_id();
    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'tenant context missing from session';
    END IF;

    v_qty := GREATEST(COALESCE(p_qty, 0), 0);
    v_net_unit := GREATEST(COALESCE(p_unit_price, 0) - COALESCE(p_discount_per_unit, 0), 0);

    SELECT i.tax_code_id, COALESCE(i.price_is_tax_inclusive, FALSE)
    INTO v_tax_code_id, v_is_inclusive
    FROM public.items i
    WHERE i.id = p_item_id
      AND i.tenant_id = v_tenant_id;

    IF v_tax_code_id IS NOT NULL THEN
        SELECT tc.rate, COALESCE(tc.is_variable, FALSE),
               COALESCE(tc.is_inclusive_default, v_is_inclusive)
        INTO v_rate, v_is_variable, v_is_inclusive
        FROM public.tax_codes tc
        WHERE tc.id = v_tax_code_id
          AND tc.tenant_id = v_tenant_id
          AND tc.is_active = TRUE;

        IF NOT FOUND THEN
            v_tax_code_id := NULL;
            v_rate := 0;
            v_is_variable := FALSE;
        END IF;
    END IF;

    IF p_price_tax_inclusive IS NOT NULL THEN
        v_is_inclusive := p_price_tax_inclusive;
    END IF;

    IF v_tax_code_id IS NOT NULL AND v_is_variable THEN
        v_rate := 0;
        FOR v_rule IN
            SELECT basis, threshold_min, threshold_max, rate
            FROM public.tax_rate_rules
            WHERE tenant_id = v_tenant_id
              AND tax_code_id = v_tax_code_id
            ORDER BY threshold_min ASC
        LOOP
            v_basis_value := CASE upper(v_rule.basis)
                WHEN 'LINE_VALUE' THEN v_net_unit * v_qty
                WHEN 'QTY' THEN v_qty
                ELSE v_net_unit
            END;

            IF v_basis_value >= v_rule.threshold_min
               AND (v_rule.threshold_max IS NULL OR v_basis_value < v_rule.threshold_max) THEN
                v_rate := v_rule.rate;
                EXIT;
            END IF;
        END LOOP;
    END IF;

    v_gross := ROUND(v_net_unit * v_qty, 4);

    IF COALESCE(v_rate, 0) = 0 THEN
        v_base := v_gross;
        v_tax := 0;
    ELSIF v_is_inclusive THEN
        v_base := ROUND(v_gross / (1 + (v_rate / 100)), 4);
        v_tax := v_gross - v_base;
    ELSE
        v_base := v_gross;
        v_tax := ROUND(v_gross * (v_rate / 100), 4);
    END IF;

    tax_code_id := v_tax_code_id;
    rate := v_rate;
    is_inclusive := v_is_inclusive;
    taxable_base := v_base;
    tax_amount := v_tax;
    line_total := CASE WHEN v_is_inclusive THEN v_gross ELSE v_base + v_tax END;
    RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.resolve_line_tax(
    p_item_id UUID,
    p_qty NUMERIC,
    p_unit_price NUMERIC,
    p_discount_per_unit NUMERIC DEFAULT 0,
    p_price_tax_inclusive BOOLEAN DEFAULT NULL
)
RETURNS TABLE (
    tax_code_id     UUID,
    rate            NUMERIC,
    is_inclusive    BOOLEAN,
    taxable_base    NUMERIC,
    tax_amount      NUMERIC,
    line_total      NUMERIC
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
    SELECT * FROM private.resolve_line_tax(
        p_item_id,
        p_qty,
        p_unit_price,
        p_discount_per_unit,
        p_price_tax_inclusive
    );
$$;

REVOKE ALL ON FUNCTION public.resolve_line_tax(UUID, NUMERIC, NUMERIC, NUMERIC, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_line_tax(UUID, NUMERIC, NUMERIC, NUMERIC, BOOLEAN) TO authenticated;

-- --------------------------------------------------------------------
-- save_purchase_order — persist line tax from resolve_line_tax
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.save_purchase_order(
    p_purchase_order_id UUID,
    p_destination_location_id UUID,
    p_supplier_id UUID,
    p_lines JSONB,
    p_created_by UUID,
    p_payment_terms_days INTEGER DEFAULT NULL,
    p_custom_fields JSONB DEFAULT NULL,
    p_currency_code VARCHAR(3) DEFAULT NULL
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
    v_discount_pct NUMERIC(5, 2);
    v_discount_amt NUMERIC(15, 4);
    v_line_extension NUMERIC(15, 4);
    v_line_discount NUMERIC(15, 4);
    v_discount_per_unit NUMERIC(15, 4);
    v_line_gross NUMERIC(15, 4);
    v_line_tax NUMERIC(15, 4);
    v_tax_rate NUMERIC(15, 4);
    v_tracking public.item_tracking_mode;
    v_track_inventory BOOLEAN;
    v_total_gross NUMERIC(15, 4) := 0;
    v_total_tax NUMERIC(15, 4) := 0;
    v_line_count INTEGER := 0;
    v_payment_terms INTEGER := GREATEST(COALESCE(p_payment_terms_days, 0), 0);
    v_custom_fields JSONB := COALESCE(p_custom_fields, '{}'::jsonb);
    v_allow_issued_edit BOOLEAN := FALSE;
    v_allow_discounts BOOLEAN := FALSE;
    v_purchase_tax_inclusive BOOLEAN := FALSE;
    v_currency_code VARCHAR(3);
    v_existing_destination_id UUID;
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

    IF p_supplier_id IS NULL THEN
        RAISE EXCEPTION 'supplier is required';
    END IF;

    IF p_lines IS NULL OR jsonb_typeof(p_lines) IS DISTINCT FROM 'array' OR jsonb_array_length(p_lines) = 0 THEN
        RAISE EXCEPTION 'at least one purchase order line is required';
    END IF;

    IF jsonb_typeof(v_custom_fields) IS DISTINCT FROM 'object' THEN
        RAISE EXCEPTION 'custom_fields must be a JSON object';
    END IF;

    SELECT upper(btrim(COALESCE(
        p_currency_code,
        (SELECT t.base_currency FROM public.tenants t WHERE t.id = v_tenant_id),
        'USD'
    )))
    INTO v_currency_code;

    IF v_currency_code IS NULL OR length(v_currency_code) <> 3 THEN
        RAISE EXCEPTION 'currency_code must be a 3-letter code';
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

    v_allow_discounts := private.get_procurement_control_flag(
        v_tenant_id,
        'allow_line_item_discounts'
    );

    v_purchase_tax_inclusive := private.get_procurement_control_flag(
        v_tenant_id,
        'purchase_prices_tax_inclusive'
    );

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
            currency_code = v_currency_code,
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
            currency_code,
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
            v_currency_code,
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
        v_discount_pct := GREATEST(COALESCE(NULLIF(v_entry ->> 'discount_percentage', '')::NUMERIC, 0), 0);
        v_discount_amt := GREATEST(COALESCE(NULLIF(v_entry ->> 'discount_amount', '')::NUMERIC, 0), 0);

        IF v_variant_id IS NULL THEN
            RAISE EXCEPTION 'variant_id is required on each line';
        END IF;

        IF v_qty IS NULL OR v_qty <= 0 THEN
            RAISE EXCEPTION 'quantity_ordered must be greater than zero';
        END IF;

        IF v_unit_price < 0 THEN
            RAISE EXCEPTION 'unit_price_contractual cannot be negative';
        END IF;

        IF NOT v_allow_discounts THEN
            v_discount_pct := 0;
            v_discount_amt := 0;
        END IF;

        IF v_discount_pct > 100 THEN
            RAISE EXCEPTION 'discount_percentage cannot exceed 100';
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

        SELECT rate, tax_amount, taxable_base
        INTO v_tax_rate, v_line_tax, v_line_gross
        FROM private.resolve_line_tax(
            v_item_id,
            v_qty,
            v_unit_price,
            v_discount_per_unit,
            v_purchase_tax_inclusive
        )
        LIMIT 1;

        v_tax_rate := COALESCE(v_tax_rate, 0);
        v_line_tax := COALESCE(v_line_tax, 0);
        v_line_gross := COALESCE(v_line_gross, GREATEST(v_line_extension - v_line_discount, 0));

        v_total_gross := v_total_gross + v_line_gross;
        v_total_tax := v_total_tax + v_line_tax;

        INSERT INTO public.purchase_order_items (
            tenant_id,
            purchase_order_id,
            item_id,
            variant_id,
            uom_code,
            quantity_ordered,
            unit_price_contractual,
            discount_percentage,
            discount_amount,
            tax_rate_percentage,
            line_tax_amount,
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
            v_discount_pct,
            v_discount_amt,
            v_tax_rate,
            v_line_tax,
            v_line_gross
        );

        v_line_count := v_line_count + 1;
    END LOOP;

    IF v_line_count = 0 THEN
        RAISE EXCEPTION 'no valid purchase order lines were saved';
    END IF;

    UPDATE public.purchase_orders
    SET total_gross_amount = v_total_gross,
        total_tax_amount = v_total_tax,
        total_net_amount = v_total_gross + v_total_tax,
        updated_at = NOW()
    WHERE id = v_po_id;

    RETURN v_po_id;
END;
$$;

REVOKE ALL ON FUNCTION public.save_purchase_order(UUID, UUID, UUID, JSONB, UUID, INTEGER, JSONB, VARCHAR) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_purchase_order(UUID, UUID, UUID, JSONB, UUID, INTEGER, JSONB, VARCHAR) TO authenticated;

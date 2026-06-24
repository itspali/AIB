-- Patch save_purchase_order for import receipt routing fields.

DROP FUNCTION IF EXISTS public.save_purchase_order(
    UUID, UUID, UUID, JSONB, UUID, INTEGER, JSONB, VARCHAR, BOOLEAN,
    NUMERIC, NUMERIC, NUMERIC, TEXT, NUMERIC, NUMERIC,
    NUMERIC, NUMERIC, TEXT
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
    p_po_fulfillment_stage_override TEXT DEFAULT NULL
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
    UUID, UUID, TEXT
) TO authenticated;

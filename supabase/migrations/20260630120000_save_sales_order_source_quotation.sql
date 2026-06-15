-- ====================================================================
-- Add p_source_quotation_id to save_sales_order (app RPC signature parity)
-- Migration: 20260630120000_save_sales_order_source_quotation.sql
-- ====================================================================

DROP FUNCTION IF EXISTS public.save_sales_order(
    UUID,
    UUID,
    JSONB,
    UUID,
    TEXT,
    TEXT,
    UUID,
    INTEGER,
    JSONB,
    VARCHAR,
    NUMERIC,
    BOOLEAN,
    NUMERIC,
    NUMERIC,
    NUMERIC,
    NUMERIC,
    NUMERIC,
    NUMERIC
);

CREATE OR REPLACE FUNCTION public.save_sales_order(
    p_sales_order_id UUID,
    p_customer_id UUID,
    p_lines JSONB,
    p_created_by UUID,
    p_billing_state TEXT,
    p_shipping_state TEXT,
    p_shipping_location_id UUID DEFAULT NULL,
    p_source_quotation_id UUID DEFAULT NULL,
    p_payment_terms_days INTEGER DEFAULT NULL,
    p_custom_fields JSONB DEFAULT NULL,
    p_currency_code VARCHAR(3) DEFAULT NULL,
    p_exchange_rate NUMERIC DEFAULT NULL,
    p_prices_tax_inclusive BOOLEAN DEFAULT NULL,
    p_shipping_amount NUMERIC DEFAULT NULL,
    p_shipping_tax_rate_pct NUMERIC DEFAULT NULL,
    p_round_off_amount NUMERIC DEFAULT NULL,
    p_additional_charges_amount NUMERIC DEFAULT NULL,
    p_transaction_discount_percentage NUMERIC DEFAULT NULL,
    p_transaction_discount_amount NUMERIC DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_tenant_id UUID;
    v_customer RECORD;
    v_gst RECORD;
    v_so_id UUID;
    v_so_status public.sales_document_status;
    v_voucher_number TEXT;
    v_entry JSONB;
    v_line RECORD;
    v_line_count INTEGER := 0;
    v_total_gross NUMERIC(15, 4) := 0;
    v_total_tax NUMERIC(15, 4) := 0;
    v_subtotal NUMERIC(15, 4) := 0;
    v_txn_discount NUMERIC(15, 4) := 0;
    v_payment_terms INTEGER := GREATEST(COALESCE(p_payment_terms_days, 0), 0);
    v_custom_fields JSONB := COALESCE(p_custom_fields, '{}'::jsonb);
    v_currency_code VARCHAR(3);
    v_exchange_rate NUMERIC(15, 4) := GREATEST(COALESCE(p_exchange_rate, 1), 0.0001);
    v_prices_tax_inclusive BOOLEAN := COALESCE(p_prices_tax_inclusive, FALSE);
    v_shipping_amount NUMERIC(15, 4) := GREATEST(COALESCE(p_shipping_amount, 0), 0);
    v_shipping_tax_rate_pct NUMERIC(15, 4) := GREATEST(COALESCE(p_shipping_tax_rate_pct, 0), 0);
    v_shipping_tax_amount NUMERIC(15, 4) := ROUND(v_shipping_amount * v_shipping_tax_rate_pct / 100, 4);
    v_round_off_amount NUMERIC(15, 4) := COALESCE(p_round_off_amount, 0);
    v_additional_charges_amount NUMERIC(15, 4) := GREATEST(COALESCE(p_additional_charges_amount, 0), 0);
    v_txn_discount_pct NUMERIC(5, 2) := GREATEST(COALESCE(p_transaction_discount_percentage, 0), 0);
    v_txn_discount_amt NUMERIC(15, 4) := GREATEST(COALESCE(p_transaction_discount_amount, 0), 0);
    v_total_net NUMERIC(15, 4);
BEGIN
    v_tenant_id := private.current_tenant_id();
    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'tenant context missing from session';
    END IF;

    IF NOT private.can_edit_sales_orders() THEN
        RAISE EXCEPTION 'sales order edit permission required';
    END IF;

    IF p_created_by IS NULL OR p_customer_id IS NULL THEN
        RAISE EXCEPTION 'created_by and customer_id are required';
    END IF;

    IF p_lines IS NULL OR jsonb_typeof(p_lines) <> 'array' OR jsonb_array_length(p_lines) = 0 THEN
        RAISE EXCEPTION 'at least one sales order line is required';
    END IF;

    IF p_source_quotation_id IS NOT NULL AND NOT EXISTS (
        SELECT 1
        FROM public.sales_quotations sq
        WHERE sq.id = p_source_quotation_id
          AND sq.tenant_id = v_tenant_id
    ) THEN
        RAISE EXCEPTION 'source quotation not found';
    END IF;

    SELECT upper(btrim(COALESCE(
        p_currency_code,
        (SELECT t.base_currency FROM public.tenants t WHERE t.id = v_tenant_id),
        'INR'
    ))) INTO v_currency_code;

    SELECT * INTO v_customer
    FROM public.entities
    WHERE id = p_customer_id AND tenant_id = v_tenant_id AND is_active = TRUE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'customer not found';
    END IF;

    IF v_customer.type NOT IN ('CUSTOMER'::public.entity_commercial_type, 'MUTUAL_PARTNER'::public.entity_commercial_type) THEN
        RAISE EXCEPTION 'entity is not a customer';
    END IF;

    SELECT * INTO v_gst
    FROM private.resolve_sales_document_gst_context(
        v_tenant_id, p_customer_id, p_billing_state, p_shipping_state, p_shipping_location_id
    );

    IF p_sales_order_id IS NOT NULL THEN
        SELECT id, commercial_status INTO v_so_id, v_so_status
        FROM public.sales_orders
        WHERE id = p_sales_order_id AND tenant_id = v_tenant_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'sales order not found';
        END IF;

        IF v_so_status NOT IN ('DRAFT'::public.sales_document_status, 'PENDING_APPROVAL'::public.sales_document_status) THEN
            RAISE EXCEPTION 'this sales order cannot be edited';
        END IF;

        UPDATE public.sales_orders
        SET customer_id = p_customer_id,
            shipping_location_id = p_shipping_location_id,
            source_quotation_id = p_source_quotation_id,
            billing_state = p_billing_state,
            shipping_state = p_shipping_state,
            payment_terms_days = v_payment_terms,
            currency_code = v_currency_code,
            exchange_rate = v_exchange_rate,
            prices_tax_inclusive = v_prices_tax_inclusive,
            tax_supply_nature = v_gst.tax_supply_nature,
            tax_mechanism = v_gst.tax_mechanism,
            customer_tax_treatment = v_gst.customer_tax_treatment,
            customer_country_code = v_gst.customer_country_code,
            rcm_applicable = v_gst.rcm_applicable,
            shipping_amount = v_shipping_amount,
            shipping_tax_rate_pct = v_shipping_tax_rate_pct,
            shipping_tax_amount = v_shipping_tax_amount,
            round_off_amount = v_round_off_amount,
            additional_charges_amount = v_additional_charges_amount,
            transaction_discount_percentage = v_txn_discount_pct,
            transaction_discount_amount = v_txn_discount_amt,
            custom_fields = v_custom_fields,
            updated_at = NOW()
        WHERE id = p_sales_order_id;

        DELETE FROM public.sales_order_items
        WHERE sales_order_id = p_sales_order_id AND tenant_id = v_tenant_id;

        v_so_id := p_sales_order_id;
    ELSE
        v_voucher_number := public.generate_next_voucher_string(
            v_tenant_id, 'SALES_ORDER'::public.document_voucher_type, NULL, p_shipping_location_id
        );

        INSERT INTO public.sales_orders (
            tenant_id, customer_id, shipping_location_id, source_quotation_id, voucher_number,
            commercial_status, billing_state, shipping_state,
            payment_terms_days, currency_code, exchange_rate, prices_tax_inclusive,
            tax_supply_nature, tax_mechanism, customer_tax_treatment, customer_country_code,
            rcm_applicable, shipping_amount, shipping_tax_rate_pct, shipping_tax_amount,
            round_off_amount, additional_charges_amount,
            transaction_discount_percentage, transaction_discount_amount,
            custom_fields, created_by
        )
        VALUES (
            v_tenant_id, p_customer_id, p_shipping_location_id, p_source_quotation_id, v_voucher_number,
            'DRAFT'::public.sales_document_status, p_billing_state, p_shipping_state,
            v_payment_terms, v_currency_code, v_exchange_rate, v_prices_tax_inclusive,
            v_gst.tax_supply_nature, v_gst.tax_mechanism, v_gst.customer_tax_treatment,
            v_gst.customer_country_code, v_gst.rcm_applicable,
            v_shipping_amount, v_shipping_tax_rate_pct, v_shipping_tax_amount,
            v_round_off_amount, v_additional_charges_amount,
            v_txn_discount_pct, v_txn_discount_amt,
            v_custom_fields, p_created_by
        )
        RETURNING id INTO v_so_id;
    END IF;

    FOR v_entry IN SELECT value FROM jsonb_array_elements(p_lines)
    LOOP
        SELECT * INTO v_line
        FROM private.compute_sales_line_amounts(
            v_entry, v_tenant_id, v_prices_tax_inclusive,
            v_gst.tax_supply_nature, v_gst.tax_mechanism
        );

        v_subtotal := v_subtotal + v_line.line_total_gross;
        v_total_gross := v_total_gross + v_line.line_total_gross;
        v_total_tax := v_total_tax + v_line.line_tax_amount;

        INSERT INTO public.sales_order_items (
            tenant_id, sales_order_id, item_id, variant_id,
            uom_code, uom_conversion_factor, quantity_ordered,
            unit_price_selling, discount_percentage, discount_amount,
            tax_rate_percentage, tax_components_json,
            line_tax_amount, line_total_gross
        )
        VALUES (
            v_tenant_id, v_so_id, v_line.item_id, v_line.variant_id,
            v_line.uom_code, v_line.uom_conversion_factor, v_line.quantity,
            v_line.unit_price, v_line.discount_percentage, v_line.discount_amount,
            v_line.tax_rate_percentage, v_line.tax_components_json,
            v_line.line_tax_amount, v_line.line_total_gross
        );

        v_line_count := v_line_count + 1;
    END LOOP;

    IF v_line_count = 0 THEN
        RAISE EXCEPTION 'no valid sales order lines were saved';
    END IF;

    IF v_txn_discount_amt > 0 THEN
        v_txn_discount := LEAST(v_txn_discount_amt, v_subtotal);
    ELSIF v_txn_discount_pct > 0 THEN
        v_txn_discount := LEAST(v_subtotal, ROUND(v_subtotal * v_txn_discount_pct / 100, 4));
    END IF;

    v_total_gross := GREATEST(v_total_gross - v_txn_discount, 0);
    v_total_tax := v_total_tax + v_shipping_tax_amount;
    v_total_net := v_total_gross + v_total_tax + v_shipping_amount + v_additional_charges_amount + v_round_off_amount;

    UPDATE public.sales_orders
    SET total_gross_amount = v_total_gross,
        total_tax_amount = v_total_tax,
        total_net_amount = v_total_net,
        transaction_discount_amount = v_txn_discount,
        updated_at = NOW()
    WHERE id = v_so_id;

    RETURN v_so_id;
END;
$$;

REVOKE ALL ON FUNCTION public.save_sales_order(
    UUID,
    UUID,
    JSONB,
    UUID,
    TEXT,
    TEXT,
    UUID,
    UUID,
    INTEGER,
    JSONB,
    VARCHAR,
    NUMERIC,
    BOOLEAN,
    NUMERIC,
    NUMERIC,
    NUMERIC,
    NUMERIC,
    NUMERIC,
    NUMERIC
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_sales_order(
    UUID,
    UUID,
    JSONB,
    UUID,
    TEXT,
    TEXT,
    UUID,
    UUID,
    INTEGER,
    JSONB,
    VARCHAR,
    NUMERIC,
    BOOLEAN,
    NUMERIC,
    NUMERIC,
    NUMERIC,
    NUMERIC,
    NUMERIC,
    NUMERIC
) TO authenticated;

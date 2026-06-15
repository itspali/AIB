-- ====================================================================
-- Sales document bidirectional linking: sync helpers, link RPCs,
-- save path parity, convert_quotation_to_order signature fix
-- Migration: 20260701120000_sales_document_link_sync.sql
-- ====================================================================

-- --------------------------------------------------------------------
-- 1. private.sync_quote_order_link
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.sync_quote_order_link(
    p_tenant_id UUID,
    p_quotation_id UUID,
    p_sales_order_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_quote RECORD;
    v_so RECORD;
BEGIN
    IF NOT private.can_edit_sales_orders() THEN
        RAISE EXCEPTION 'sales order edit permission required';
    END IF;

    SELECT * INTO v_quote
    FROM public.sales_quotations
    WHERE id = p_quotation_id AND tenant_id = p_tenant_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'sales quotation not found';
    END IF;

    SELECT * INTO v_so
    FROM public.sales_orders
    WHERE id = p_sales_order_id AND tenant_id = p_tenant_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'sales order not found';
    END IF;

    IF v_quote.customer_id <> v_so.customer_id THEN
        RAISE EXCEPTION 'quotation and sales order must belong to the same customer';
    END IF;

    IF v_quote.converted_to_order_id IS NOT NULL
       AND v_quote.converted_to_order_id <> p_sales_order_id THEN
        RAISE EXCEPTION 'quotation is already linked to another sales order';
    END IF;

    IF v_so.source_quotation_id IS NOT NULL
       AND v_so.source_quotation_id <> p_quotation_id THEN
        RAISE EXCEPTION 'sales order is already linked to another quotation';
    END IF;

    IF v_quote.origin_location_id IS NOT NULL
       AND v_so.shipping_location_id IS NOT NULL
       AND v_quote.origin_location_id <> v_so.shipping_location_id THEN
        RAISE EXCEPTION 'quotation origin location must match sales order shipping location';
    END IF;

    UPDATE public.sales_orders
    SET source_quotation_id = p_quotation_id,
        updated_at = NOW()
    WHERE id = p_sales_order_id;

    UPDATE public.sales_order_items soi
    SET source_quotation_line_id = sqi.id,
        updated_at = NOW()
    FROM public.sales_quotation_items sqi
    WHERE soi.sales_order_id = p_sales_order_id
      AND soi.tenant_id = p_tenant_id
      AND sqi.sales_quotation_id = p_quotation_id
      AND sqi.tenant_id = p_tenant_id
      AND soi.item_id = sqi.item_id
      AND soi.variant_id IS NOT DISTINCT FROM sqi.variant_id
      AND soi.quantity_ordered = sqi.quantity_quoted;

    UPDATE public.sales_quotations
    SET converted_to_order_id = p_sales_order_id,
        commercial_status = 'FULLY_COMPLETED'::public.sales_document_status,
        updated_at = NOW()
    WHERE id = p_quotation_id;
END;
$$;

-- --------------------------------------------------------------------
-- 2. private.sync_quote_invoice_link
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.sync_quote_invoice_link(
    p_tenant_id UUID,
    p_quotation_id UUID,
    p_sales_invoice_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_quote RECORD;
    v_invoice RECORD;
BEGIN
    IF NOT private.can_edit_sales_orders() THEN
        RAISE EXCEPTION 'sales invoice edit permission required';
    END IF;

    SELECT * INTO v_quote
    FROM public.sales_quotations
    WHERE id = p_quotation_id AND tenant_id = p_tenant_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'sales quotation not found';
    END IF;

    SELECT * INTO v_invoice
    FROM public.sales_invoices
    WHERE id = p_sales_invoice_id AND tenant_id = p_tenant_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'sales invoice not found';
    END IF;

    IF v_quote.customer_id <> v_invoice.customer_id THEN
        RAISE EXCEPTION 'quotation and invoice must belong to the same customer';
    END IF;

    IF v_quote.converted_to_invoice_id IS NOT NULL
       AND v_quote.converted_to_invoice_id <> p_sales_invoice_id THEN
        RAISE EXCEPTION 'quotation is already linked to another invoice';
    END IF;

    IF v_invoice.source_quotation_id IS NOT NULL
       AND v_invoice.source_quotation_id <> p_quotation_id THEN
        RAISE EXCEPTION 'invoice is already linked to another quotation';
    END IF;

    IF v_quote.origin_location_id IS NOT NULL
       AND v_invoice.origin_location_id IS NOT NULL
       AND v_quote.origin_location_id <> v_invoice.origin_location_id THEN
        RAISE EXCEPTION 'quotation origin location must match invoice origin location';
    END IF;

    UPDATE public.sales_invoices
    SET source_quotation_id = p_quotation_id,
        updated_at = NOW()
    WHERE id = p_sales_invoice_id;

    UPDATE public.sales_invoice_items sii
    SET source_quotation_line_id = sqi.id,
        updated_at = NOW()
    FROM public.sales_quotation_items sqi
    WHERE sii.sales_invoice_id = p_sales_invoice_id
      AND sii.tenant_id = p_tenant_id
      AND sqi.sales_quotation_id = p_quotation_id
      AND sqi.tenant_id = p_tenant_id
      AND sii.item_id = sqi.item_id
      AND sii.variant_id IS NOT DISTINCT FROM sqi.variant_id
      AND sii.quantity_invoiced = sqi.quantity_quoted;

    UPDATE public.sales_quotations
    SET converted_to_invoice_id = p_sales_invoice_id,
        commercial_status = 'FULLY_COMPLETED'::public.sales_document_status,
        updated_at = NOW()
    WHERE id = p_quotation_id;
END;
$$;

-- --------------------------------------------------------------------
-- 3. private.sync_order_invoice_link
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.sync_order_invoice_link(
    p_tenant_id UUID,
    p_sales_order_id UUID,
    p_sales_invoice_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_so RECORD;
    v_invoice RECORD;
BEGIN
    IF NOT private.can_edit_sales_orders() THEN
        RAISE EXCEPTION 'sales invoice edit permission required';
    END IF;

    SELECT * INTO v_so
    FROM public.sales_orders
    WHERE id = p_sales_order_id AND tenant_id = p_tenant_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'sales order not found';
    END IF;

    SELECT * INTO v_invoice
    FROM public.sales_invoices
    WHERE id = p_sales_invoice_id AND tenant_id = p_tenant_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'sales invoice not found';
    END IF;

    IF v_so.customer_id <> v_invoice.customer_id THEN
        RAISE EXCEPTION 'sales order and invoice must belong to the same customer';
    END IF;

    IF v_invoice.source_order_id IS NOT NULL
       AND v_invoice.source_order_id <> p_sales_order_id THEN
        RAISE EXCEPTION 'invoice is already linked to another sales order';
    END IF;

    UPDATE public.sales_invoices
    SET source_order_id = p_sales_order_id,
        source_quotation_id = COALESCE(v_invoice.source_quotation_id, v_so.source_quotation_id),
        updated_at = NOW()
    WHERE id = p_sales_invoice_id;

    UPDATE public.sales_invoice_items sii
    SET source_order_line_id = soi.id,
        updated_at = NOW()
    FROM public.sales_order_items soi
    WHERE sii.sales_invoice_id = p_sales_invoice_id
      AND sii.tenant_id = p_tenant_id
      AND soi.sales_order_id = p_sales_order_id
      AND soi.tenant_id = p_tenant_id
      AND sii.item_id = soi.item_id
      AND sii.variant_id IS NOT DISTINCT FROM soi.variant_id
      AND sii.quantity_invoiced = soi.quantity_ordered;

    IF v_so.source_quotation_id IS NOT NULL THEN
        PERFORM private.sync_quote_invoice_link(
            p_tenant_id,
            v_so.source_quotation_id,
            p_sales_invoice_id
        );
    END IF;
END;
$$;

-- --------------------------------------------------------------------
-- 4. Public link RPCs
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.link_sales_order_to_quotation(
    p_sales_order_id UUID,
    p_quotation_id UUID
)
RETURNS JSONB
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

    PERFORM private.sync_quote_order_link(v_tenant_id, p_quotation_id, p_sales_order_id);

    RETURN jsonb_build_object(
        'sales_order_id', p_sales_order_id,
        'quotation_id', p_quotation_id
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.link_sales_quotation_to_order(
    p_quotation_id UUID,
    p_sales_order_id UUID
)
RETURNS JSONB
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

    PERFORM private.sync_quote_order_link(v_tenant_id, p_quotation_id, p_sales_order_id);

    RETURN jsonb_build_object(
        'quotation_id', p_quotation_id,
        'sales_order_id', p_sales_order_id
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.link_sales_invoice_to_quotation(
    p_sales_invoice_id UUID,
    p_quotation_id UUID
)
RETURNS JSONB
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

    PERFORM private.sync_quote_invoice_link(v_tenant_id, p_quotation_id, p_sales_invoice_id);

    RETURN jsonb_build_object(
        'sales_invoice_id', p_sales_invoice_id,
        'quotation_id', p_quotation_id
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.link_sales_quotation_to_invoice(
    p_quotation_id UUID,
    p_sales_invoice_id UUID
)
RETURNS JSONB
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

    PERFORM private.sync_quote_invoice_link(v_tenant_id, p_quotation_id, p_sales_invoice_id);

    RETURN jsonb_build_object(
        'quotation_id', p_quotation_id,
        'sales_invoice_id', p_sales_invoice_id
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.link_sales_invoice_to_order(
    p_sales_invoice_id UUID,
    p_sales_order_id UUID
)
RETURNS JSONB
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

    PERFORM private.sync_order_invoice_link(v_tenant_id, p_sales_order_id, p_sales_invoice_id);

    RETURN jsonb_build_object(
        'sales_invoice_id', p_sales_invoice_id,
        'sales_order_id', p_sales_order_id
    );
END;
$$;

REVOKE ALL ON FUNCTION public.link_sales_order_to_quotation(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.link_sales_order_to_quotation(UUID, UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.link_sales_quotation_to_order(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.link_sales_quotation_to_order(UUID, UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.link_sales_invoice_to_quotation(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.link_sales_invoice_to_quotation(UUID, UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.link_sales_quotation_to_invoice(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.link_sales_quotation_to_invoice(UUID, UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.link_sales_invoice_to_order(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.link_sales_invoice_to_order(UUID, UUID) TO authenticated;

-- --------------------------------------------------------------------
-- 5. save_sales_order: line source_quotation_line_id + create sync
-- --------------------------------------------------------------------
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
    v_is_create BOOLEAN := FALSE;
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
    v_source_quotation_line_id UUID;
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
        v_is_create := TRUE;
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

        v_source_quotation_line_id := NULLIF(v_entry ->> 'source_quotation_line_id', '')::UUID;

        v_subtotal := v_subtotal + v_line.line_total_gross;
        v_total_gross := v_total_gross + v_line.line_total_gross;
        v_total_tax := v_total_tax + v_line.line_tax_amount;

        INSERT INTO public.sales_order_items (
            tenant_id, sales_order_id, item_id, variant_id,
            source_quotation_line_id,
            uom_code, uom_conversion_factor, quantity_ordered,
            unit_price_selling, discount_percentage, discount_amount,
            tax_rate_percentage, tax_components_json,
            line_tax_amount, line_total_gross
        )
        VALUES (
            v_tenant_id, v_so_id, v_line.item_id, v_line.variant_id,
            v_source_quotation_line_id,
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

    IF v_is_create AND p_source_quotation_id IS NOT NULL THEN
        PERFORM private.sync_quote_order_link(v_tenant_id, p_source_quotation_id, v_so_id);
    END IF;

    RETURN v_so_id;
END;
$$;

-- --------------------------------------------------------------------
-- 6. save_sales_invoice: create-time link sync
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.save_sales_invoice(
    p_sales_invoice_id UUID,
    p_customer_id UUID,
    p_origin_location_id UUID,
    p_lines JSONB,
    p_created_by UUID,
    p_billing_state TEXT,
    p_shipping_state TEXT,
    p_source_order_id UUID DEFAULT NULL,
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
    v_invoice_id UUID;
    v_invoice_status public.sales_document_status;
    v_is_create BOOLEAN := FALSE;
    v_invoice_number TEXT;
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
    v_source_order_line_id UUID;
    v_source_quotation_line_id UUID;
BEGIN
    v_tenant_id := private.current_tenant_id();
    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'tenant context missing from session';
    END IF;

    IF NOT private.can_edit_sales_orders() THEN
        RAISE EXCEPTION 'sales invoice edit permission required';
    END IF;

    IF p_created_by IS NULL OR p_customer_id IS NULL OR p_origin_location_id IS NULL THEN
        RAISE EXCEPTION 'created_by, customer_id, and origin_location_id are required';
    END IF;

    IF p_lines IS NULL OR jsonb_typeof(p_lines) <> 'array' OR jsonb_array_length(p_lines) = 0 THEN
        RAISE EXCEPTION 'at least one invoice line is required';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.tenant_locations
        WHERE id = p_origin_location_id AND tenant_id = v_tenant_id AND is_active = TRUE
    ) THEN
        RAISE EXCEPTION 'origin location not found';
    END IF;

    SELECT upper(btrim(COALESCE(
        p_currency_code,
        (SELECT t.base_currency FROM public.tenants t WHERE t.id = v_tenant_id),
        'INR'
    ))) INTO v_currency_code;

    SELECT * INTO v_customer
    FROM public.entities
    WHERE id = p_customer_id AND tenant_id = v_tenant_id AND is_active = TRUE;

    IF NOT FOUND OR v_customer.type NOT IN ('CUSTOMER'::public.entity_commercial_type, 'MUTUAL_PARTNER'::public.entity_commercial_type) THEN
        RAISE EXCEPTION 'customer not found';
    END IF;

    SELECT * INTO v_gst
    FROM private.resolve_sales_document_gst_context(
        v_tenant_id, p_customer_id, p_billing_state, p_shipping_state, p_origin_location_id
    );

    IF p_sales_invoice_id IS NOT NULL THEN
        SELECT id, commercial_status INTO v_invoice_id, v_invoice_status
        FROM public.sales_invoices
        WHERE id = p_sales_invoice_id AND tenant_id = v_tenant_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'sales invoice not found';
        END IF;

        IF v_invoice_status <> 'DRAFT'::public.sales_document_status THEN
            RAISE EXCEPTION 'only draft sales invoices can be saved';
        END IF;

        UPDATE public.sales_invoices
        SET customer_id = p_customer_id,
            origin_location_id = p_origin_location_id,
            source_order_id = p_source_order_id,
            source_quotation_id = p_source_quotation_id,
            billing_state = p_billing_state,
            shipping_state = p_shipping_state,
            payment_terms_days = v_payment_terms,
            currency_code = v_currency_code,
            exchange_rate = v_exchange_rate,
            exchange_rate_snapshot = v_exchange_rate,
            prices_tax_inclusive = v_prices_tax_inclusive,
            tax_supply_nature = v_gst.tax_supply_nature,
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
        WHERE id = p_sales_invoice_id;

        DELETE FROM public.sales_invoice_items
        WHERE sales_invoice_id = p_sales_invoice_id AND tenant_id = v_tenant_id;

        v_invoice_id := p_sales_invoice_id;
    ELSE
        v_is_create := TRUE;
        v_invoice_number := public.generate_next_voucher_string(
            v_tenant_id, 'SALES_INVOICE'::public.document_voucher_type, NULL, p_origin_location_id
        );

        INSERT INTO public.sales_invoices (
            tenant_id, customer_id, origin_location_id, source_order_id, source_quotation_id,
            invoice_number, commercial_status, billing_state, shipping_state,
            payment_terms_days, currency_code, exchange_rate, exchange_rate_snapshot,
            prices_tax_inclusive, tax_supply_nature, customer_country_code, rcm_applicable,
            shipping_amount, shipping_tax_rate_pct, shipping_tax_amount,
            round_off_amount, additional_charges_amount,
            transaction_discount_percentage, transaction_discount_amount,
            custom_fields, created_by
        )
        VALUES (
            v_tenant_id, p_customer_id, p_origin_location_id, p_source_order_id, p_source_quotation_id,
            v_invoice_number, 'DRAFT'::public.sales_document_status, p_billing_state, p_shipping_state,
            v_payment_terms, v_currency_code, v_exchange_rate, v_exchange_rate,
            v_prices_tax_inclusive, v_gst.tax_supply_nature, v_gst.customer_country_code, v_gst.rcm_applicable,
            v_shipping_amount, v_shipping_tax_rate_pct, v_shipping_tax_amount,
            v_round_off_amount, v_additional_charges_amount,
            v_txn_discount_pct, v_txn_discount_amt,
            v_custom_fields, p_created_by
        )
        RETURNING id INTO v_invoice_id;
    END IF;

    FOR v_entry IN SELECT value FROM jsonb_array_elements(p_lines)
    LOOP
        SELECT * INTO v_line
        FROM private.compute_sales_line_amounts(
            v_entry, v_tenant_id, v_prices_tax_inclusive,
            v_gst.tax_supply_nature, v_gst.tax_mechanism
        );

        v_source_order_line_id := NULLIF(v_entry ->> 'source_order_line_id', '')::UUID;
        v_source_quotation_line_id := NULLIF(v_entry ->> 'source_quotation_line_id', '')::UUID;

        v_subtotal := v_subtotal + v_line.line_total_gross;
        v_total_gross := v_total_gross + v_line.line_total_gross;
        v_total_tax := v_total_tax + v_line.line_tax_amount;

        INSERT INTO public.sales_invoice_items (
            tenant_id, sales_invoice_id, item_id, variant_id,
            source_order_line_id, source_quotation_line_id,
            uom_code, uom_conversion_factor, quantity_invoiced,
            unit_price_selling, discount_percentage, discount_amount,
            tax_rate_percentage, tax_components_json,
            line_tax_amount, line_total_net
        )
        VALUES (
            v_tenant_id, v_invoice_id, v_line.item_id, v_line.variant_id,
            v_source_order_line_id, v_source_quotation_line_id,
            v_line.uom_code, v_line.uom_conversion_factor, v_line.quantity,
            v_line.unit_price, v_line.discount_percentage, v_line.discount_amount,
            v_line.tax_rate_percentage, v_line.tax_components_json,
            v_line.line_tax_amount, v_line.line_total_gross + v_line.line_tax_amount
        );

        v_line_count := v_line_count + 1;
    END LOOP;

    IF v_line_count = 0 THEN
        RAISE EXCEPTION 'no valid invoice lines were saved';
    END IF;

    IF v_txn_discount_amt > 0 THEN
        v_txn_discount := LEAST(v_txn_discount_amt, v_subtotal);
    ELSIF v_txn_discount_pct > 0 THEN
        v_txn_discount := LEAST(v_subtotal, ROUND(v_subtotal * v_txn_discount_pct / 100, 4));
    END IF;

    v_total_gross := GREATEST(v_total_gross - v_txn_discount, 0);
    v_total_tax := v_total_tax + v_shipping_tax_amount;
    v_total_net := v_total_gross + v_total_tax + v_shipping_amount + v_additional_charges_amount + v_round_off_amount;

    UPDATE public.sales_invoices
    SET total_gross_amount = v_total_gross,
        total_tax_amount = v_total_tax,
        total_net_amount = v_total_net,
        transaction_discount_amount = v_txn_discount,
        updated_at = NOW()
    WHERE id = v_invoice_id;

    IF v_is_create THEN
        IF p_source_order_id IS NOT NULL THEN
            PERFORM private.sync_order_invoice_link(v_tenant_id, p_source_order_id, v_invoice_id);
        ELSIF p_source_quotation_id IS NOT NULL THEN
            PERFORM private.sync_quote_invoice_link(v_tenant_id, p_source_quotation_id, v_invoice_id);
        END IF;
    END IF;

    RETURN v_invoice_id;
END;
$$;

-- --------------------------------------------------------------------
-- 7. Fix convert_quotation_to_order (save_sales_order signature)
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.convert_quotation_to_order(p_quotation_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_tenant_id UUID;
    v_user_id UUID;
    v_quote RECORD;
    v_so_id UUID;
    v_lines JSONB := '[]'::jsonb;
BEGIN
    v_tenant_id := private.current_tenant_id();
    v_user_id := auth.uid();

    IF v_tenant_id IS NULL OR v_user_id IS NULL THEN
        RAISE EXCEPTION 'tenant context missing from session';
    END IF;

    IF NOT private.can_edit_sales_orders() THEN
        RAISE EXCEPTION 'sales order edit permission required';
    END IF;

    SELECT * INTO v_quote
    FROM public.sales_quotations
    WHERE id = p_quotation_id AND tenant_id = v_tenant_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'sales quotation not found';
    END IF;

    IF v_quote.converted_to_order_id IS NOT NULL THEN
        RETURN v_quote.converted_to_order_id;
    END IF;

    IF v_quote.commercial_status NOT IN ('DRAFT'::public.sales_document_status, 'APPROVED_ACTIVE'::public.sales_document_status) THEN
        RAISE EXCEPTION 'quotation cannot be converted in its current status';
    END IF;

    IF private.quote_approval_required(v_tenant_id, v_quote.total_net_amount, v_user_id, p_quotation_id)
       AND v_quote.commercial_status = 'DRAFT'::public.sales_document_status
    THEN
        RAISE EXCEPTION 'quotation approval is required before conversion';
    END IF;

    SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'item_id', sqi.item_id,
        'variant_id', sqi.variant_id,
        'quantity', sqi.quantity_quoted,
        'unit_price', sqi.unit_price_selling,
        'discount_percentage', sqi.discount_percentage,
        'discount_amount', sqi.discount_amount,
        'uom_code', sqi.uom_code,
        'tax_rate_percentage', sqi.tax_rate_percentage,
        'source_quotation_line_id', sqi.id
    )), '[]'::jsonb)
    INTO v_lines
    FROM public.sales_quotation_items sqi
    WHERE sqi.sales_quotation_id = p_quotation_id
      AND sqi.tenant_id = v_tenant_id;

    v_so_id := public.save_sales_order(
        NULL,
        v_quote.customer_id,
        v_lines,
        v_user_id,
        v_quote.billing_state,
        v_quote.shipping_state,
        v_quote.origin_location_id,
        p_quotation_id,
        v_quote.payment_terms_days,
        v_quote.custom_fields,
        v_quote.currency_code,
        v_quote.exchange_rate,
        v_quote.prices_tax_inclusive,
        v_quote.shipping_amount,
        v_quote.shipping_tax_rate_pct,
        v_quote.round_off_amount,
        v_quote.additional_charges_amount,
        v_quote.transaction_discount_percentage,
        v_quote.transaction_discount_amount
    );

    RETURN v_so_id;
END;
$$;

-- --------------------------------------------------------------------
-- 8. convert_quotation_to_invoice: rely on save sync (remove duplicate UPDATE)
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.convert_quotation_to_invoice(
    p_quotation_id UUID,
    p_origin_location_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_tenant_id UUID;
    v_user_id UUID;
    v_quote RECORD;
    v_invoice_id UUID;
    v_lines JSONB := '[]'::jsonb;
BEGIN
    v_tenant_id := private.current_tenant_id();
    v_user_id := auth.uid();

    IF v_tenant_id IS NULL OR v_user_id IS NULL THEN
        RAISE EXCEPTION 'tenant context missing from session';
    END IF;

    SELECT * INTO v_quote
    FROM public.sales_quotations
    WHERE id = p_quotation_id AND tenant_id = v_tenant_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'sales quotation not found';
    END IF;

    IF v_quote.converted_to_invoice_id IS NOT NULL THEN
        RETURN v_quote.converted_to_invoice_id;
    END IF;

    SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'item_id', sqi.item_id,
        'variant_id', sqi.variant_id,
        'quantity', sqi.quantity_quoted,
        'unit_price', sqi.unit_price_selling,
        'discount_percentage', sqi.discount_percentage,
        'discount_amount', sqi.discount_amount,
        'uom_code', sqi.uom_code,
        'tax_rate_percentage', sqi.tax_rate_percentage,
        'source_quotation_line_id', sqi.id
    )), '[]'::jsonb)
    INTO v_lines
    FROM public.sales_quotation_items sqi
    WHERE sqi.sales_quotation_id = p_quotation_id
      AND sqi.tenant_id = v_tenant_id;

    v_invoice_id := public.save_sales_invoice(
        NULL,
        v_quote.customer_id,
        COALESCE(p_origin_location_id, v_quote.origin_location_id),
        v_lines,
        v_user_id,
        v_quote.billing_state,
        v_quote.shipping_state,
        NULL,
        p_quotation_id,
        v_quote.payment_terms_days,
        v_quote.custom_fields,
        v_quote.currency_code,
        v_quote.exchange_rate,
        v_quote.prices_tax_inclusive,
        v_quote.shipping_amount,
        v_quote.shipping_tax_rate_pct,
        v_quote.round_off_amount,
        v_quote.additional_charges_amount,
        v_quote.transaction_discount_percentage,
        v_quote.transaction_discount_amount
    );

    RETURN v_invoice_id;
END;
$$;

-- --------------------------------------------------------------------
-- 9. convert_order_to_invoice: rely on save sync
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.convert_order_to_invoice(
    p_sales_order_id UUID,
    p_origin_location_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_tenant_id UUID;
    v_user_id UUID;
    v_so RECORD;
    v_invoice_id UUID;
    v_lines JSONB := '[]'::jsonb;
BEGIN
    v_tenant_id := private.current_tenant_id();
    v_user_id := auth.uid();

    IF v_tenant_id IS NULL OR v_user_id IS NULL THEN
        RAISE EXCEPTION 'tenant context missing from session';
    END IF;

    SELECT * INTO v_so
    FROM public.sales_orders
    WHERE id = p_sales_order_id AND tenant_id = v_tenant_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'sales order not found';
    END IF;

    IF v_so.commercial_status NOT IN ('APPROVED_ACTIVE'::public.sales_document_status, 'PARTIALLY_SHIPPED'::public.sales_document_status) THEN
        RAISE EXCEPTION 'sales order must be confirmed before invoicing';
    END IF;

    SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'item_id', soi.item_id,
        'variant_id', soi.variant_id,
        'quantity', soi.quantity_ordered - soi.quantity_invoiced,
        'unit_price', soi.unit_price_selling,
        'discount_percentage', soi.discount_percentage,
        'discount_amount', soi.discount_amount,
        'uom_code', soi.uom_code,
        'tax_rate_percentage', soi.tax_rate_percentage,
        'source_order_line_id', soi.id
    )), '[]'::jsonb)
    INTO v_lines
    FROM public.sales_order_items soi
    WHERE soi.sales_order_id = p_sales_order_id
      AND soi.tenant_id = v_tenant_id
      AND soi.quantity_ordered > soi.quantity_invoiced;

    IF jsonb_array_length(v_lines) = 0 THEN
        RAISE EXCEPTION 'no uninvoiced lines remain on this sales order';
    END IF;

    v_invoice_id := public.save_sales_invoice(
        NULL,
        v_so.customer_id,
        p_origin_location_id,
        v_lines,
        v_user_id,
        v_so.billing_state,
        v_so.shipping_state,
        p_sales_order_id,
        v_so.source_quotation_id,
        v_so.payment_terms_days,
        v_so.custom_fields,
        v_so.currency_code,
        v_so.exchange_rate,
        v_so.prices_tax_inclusive,
        v_so.shipping_amount,
        v_so.shipping_tax_rate_pct,
        v_so.round_off_amount,
        v_so.additional_charges_amount,
        v_so.transaction_discount_percentage,
        v_so.transaction_discount_amount
    );

    RETURN v_invoice_id;
END;
$$;

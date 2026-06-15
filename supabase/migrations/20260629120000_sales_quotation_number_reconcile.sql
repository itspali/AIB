-- ====================================================================
-- AIB SMART ERP - SALES QUOTATION NUMBER RECONCILIATION
-- Migration: 20260629120000_sales_quotation_number_reconcile.sql
-- ====================================================================
-- Sales document numbers are unique per tenant, but sequences are
-- tracked per location. Reconcile counters against existing tenant
-- documents before issuing the next number.
-- ====================================================================

CREATE OR REPLACE FUNCTION private.tenant_sales_voucher_number_exists(
    p_tenant_id UUID,
    p_voucher_type public.document_voucher_type,
    p_number TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
BEGIN
    CASE p_voucher_type
        WHEN 'SALES_QUOTATION' THEN
            RETURN EXISTS (
                SELECT 1
                FROM public.sales_quotations
                WHERE tenant_id = p_tenant_id
                  AND quotation_number = p_number
            );
        WHEN 'SALES_ORDER' THEN
            RETURN EXISTS (
                SELECT 1
                FROM public.sales_orders
                WHERE tenant_id = p_tenant_id
                  AND voucher_number = p_number
            );
        WHEN 'SALES_INVOICE' THEN
            RETURN EXISTS (
                SELECT 1
                FROM public.sales_invoices
                WHERE tenant_id = p_tenant_id
                  AND invoice_number = p_number
            );
        WHEN 'SALES_CREDIT_NOTE' THEN
            RETURN EXISTS (
                SELECT 1
                FROM public.sales_credit_notes
                WHERE tenant_id = p_tenant_id
                  AND credit_note_number = p_number
            );
        WHEN 'CUSTOMER_PAYMENT' THEN
            RETURN EXISTS (
                SELECT 1
                FROM public.customer_payments
                WHERE tenant_id = p_tenant_id
                  AND payment_number = p_number
            );
        ELSE
            RETURN FALSE;
    END CASE;
END;
$$;

CREATE OR REPLACE FUNCTION public.reconcile_document_sequence(
    p_tenant_id UUID,
    p_voucher_type public.document_voucher_type,
    p_location_id UUID,
    p_prefix TEXT DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_prefix TEXT;
    v_padding INTEGER;
    v_scope_location_id UUID;
    v_uses_location_scope BOOLEAN;
    v_max_suffix INTEGER := 0;
    v_next INTEGER;
    v_number TEXT;
    v_suffix_text TEXT;
BEGIN
    IF p_tenant_id IS NULL THEN
        RAISE EXCEPTION 'tenant id is required';
    END IF;
    IF p_location_id IS NULL THEN
        RAISE EXCEPTION 'location id is required';
    END IF;

    IF p_prefix IS NOT NULL THEN
        v_prefix := btrim(p_prefix);
    ELSE
        SELECT prefix, padding_length, uses_location_scope
        INTO v_prefix, v_padding, v_uses_location_scope
        FROM private.resolve_effective_naming_entry(p_tenant_id, p_location_id, p_voucher_type);

        v_scope_location_id := CASE
            WHEN v_uses_location_scope THEN p_location_id
            ELSE NULL
        END;
    END IF;

    IF v_prefix IS NULL OR v_prefix = '' THEN
        RAISE EXCEPTION 'document prefix not configured for % at location %', p_voucher_type, p_location_id;
    END IF;

    IF p_voucher_type = 'STOCK_ADJUSTMENT' THEN
        FOR v_number IN
            SELECT adjustment_number
            FROM public.stock_adjustments
            WHERE tenant_id = p_tenant_id
              AND location_id = p_location_id
              AND adjustment_number LIKE v_prefix || '%'
        LOOP
            v_suffix_text := substring(v_number from length(v_prefix) + 1);
            IF v_suffix_text ~ '^[0-9]+$' THEN
                v_max_suffix := GREATEST(v_max_suffix, v_suffix_text::INTEGER);
            END IF;
        END LOOP;
    ELSIF p_voucher_type = 'STOCK_TRANSFER' THEN
        FOR v_number IN
            SELECT transfer_number
            FROM public.stock_transfers
            WHERE tenant_id = p_tenant_id
              AND (source_location_id = p_location_id OR destination_location_id = p_location_id)
              AND transfer_number LIKE v_prefix || '%'
        LOOP
            v_suffix_text := substring(v_number from length(v_prefix) + 1);
            IF v_suffix_text ~ '^[0-9]+$' THEN
                v_max_suffix := GREATEST(v_max_suffix, v_suffix_text::INTEGER);
            END IF;
        END LOOP;
    ELSIF p_voucher_type = 'GOODS_RECEIPT_NOTE' THEN
        FOR v_number IN
            SELECT voucher_number
            FROM public.goods_receipts
            WHERE tenant_id = p_tenant_id
              AND destination_location_id = p_location_id
              AND voucher_number LIKE v_prefix || '%'
        LOOP
            v_suffix_text := substring(v_number from length(v_prefix) + 1);
            IF v_suffix_text ~ '^[0-9]+$' THEN
                v_max_suffix := GREATEST(v_max_suffix, v_suffix_text::INTEGER);
            END IF;
        END LOOP;
    ELSIF p_voucher_type = 'PURCHASE_ORDER' THEN
        FOR v_number IN
            SELECT voucher_number
            FROM public.purchase_orders
            WHERE tenant_id = p_tenant_id
              AND destination_location_id = p_location_id
              AND voucher_number LIKE v_prefix || '%'
        LOOP
            v_suffix_text := substring(v_number from length(v_prefix) + 1);
            IF v_suffix_text ~ '^[0-9]+$' THEN
                v_max_suffix := GREATEST(v_max_suffix, v_suffix_text::INTEGER);
            END IF;
        END LOOP;
    ELSIF p_voucher_type = 'SALES_QUOTATION' THEN
        FOR v_number IN
            SELECT quotation_number
            FROM public.sales_quotations
            WHERE tenant_id = p_tenant_id
              AND quotation_number LIKE v_prefix || '%'
        LOOP
            v_suffix_text := substring(v_number from length(v_prefix) + 1);
            IF v_suffix_text ~ '^[0-9]+$' THEN
                v_max_suffix := GREATEST(v_max_suffix, v_suffix_text::INTEGER);
            END IF;
        END LOOP;
    ELSIF p_voucher_type = 'SALES_ORDER' THEN
        FOR v_number IN
            SELECT voucher_number
            FROM public.sales_orders
            WHERE tenant_id = p_tenant_id
              AND voucher_number LIKE v_prefix || '%'
        LOOP
            v_suffix_text := substring(v_number from length(v_prefix) + 1);
            IF v_suffix_text ~ '^[0-9]+$' THEN
                v_max_suffix := GREATEST(v_max_suffix, v_suffix_text::INTEGER);
            END IF;
        END LOOP;
    ELSIF p_voucher_type = 'SALES_INVOICE' THEN
        FOR v_number IN
            SELECT invoice_number
            FROM public.sales_invoices
            WHERE tenant_id = p_tenant_id
              AND invoice_number LIKE v_prefix || '%'
        LOOP
            v_suffix_text := substring(v_number from length(v_prefix) + 1);
            IF v_suffix_text ~ '^[0-9]+$' THEN
                v_max_suffix := GREATEST(v_max_suffix, v_suffix_text::INTEGER);
            END IF;
        END LOOP;
    ELSIF p_voucher_type = 'SALES_CREDIT_NOTE' THEN
        FOR v_number IN
            SELECT credit_note_number
            FROM public.sales_credit_notes
            WHERE tenant_id = p_tenant_id
              AND credit_note_number LIKE v_prefix || '%'
        LOOP
            v_suffix_text := substring(v_number from length(v_prefix) + 1);
            IF v_suffix_text ~ '^[0-9]+$' THEN
                v_max_suffix := GREATEST(v_max_suffix, v_suffix_text::INTEGER);
            END IF;
        END LOOP;
    ELSIF p_voucher_type = 'CUSTOMER_PAYMENT' THEN
        FOR v_number IN
            SELECT payment_number
            FROM public.customer_payments
            WHERE tenant_id = p_tenant_id
              AND payment_number LIKE v_prefix || '%'
        LOOP
            v_suffix_text := substring(v_number from length(v_prefix) + 1);
            IF v_suffix_text ~ '^[0-9]+$' THEN
                v_max_suffix := GREATEST(v_max_suffix, v_suffix_text::INTEGER);
            END IF;
        END LOOP;
    END IF;

    v_next := v_max_suffix + 1;

    IF p_prefix IS NOT NULL THEN
        v_scope_location_id := p_location_id;
        v_padding := 5;
    END IF;

    UPDATE public.document_sequences
    SET next_value = GREATEST(next_value, v_next),
        updated_at = NOW()
    WHERE tenant_id = p_tenant_id
      AND voucher_type = p_voucher_type
      AND prefix = v_prefix
      AND location_id IS NOT DISTINCT FROM COALESCE(v_scope_location_id, p_location_id);

    IF NOT FOUND THEN
        INSERT INTO public.document_sequences (
            tenant_id, location_id, voucher_type, prefix, next_value, padding_length
        )
        VALUES (
            p_tenant_id,
            COALESCE(v_scope_location_id, p_location_id),
            p_voucher_type,
            v_prefix,
            v_next,
            COALESCE(v_padding, 5)
        );
    END IF;

    RETURN v_next;
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_next_voucher_string(
    p_tenant_id UUID,
    p_voucher_type document_voucher_type,
    p_prefix TEXT DEFAULT NULL,
    p_location_id UUID DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_row public.document_sequences%ROWTYPE;
    v_sequence_value INTEGER;
    v_resolved_prefix TEXT;
    v_resolved_padding INTEGER;
    v_uses_location_scope BOOLEAN;
    v_scope_location_id UUID;
    v_candidate TEXT;
    v_tenant_scoped_sales BOOLEAN;
BEGIN
    v_tenant_scoped_sales := p_voucher_type IN (
        'SALES_QUOTATION'::public.document_voucher_type,
        'SALES_ORDER'::public.document_voucher_type,
        'SALES_INVOICE'::public.document_voucher_type,
        'SALES_CREDIT_NOTE'::public.document_voucher_type,
        'CUSTOMER_PAYMENT'::public.document_voucher_type
    );

    IF v_tenant_scoped_sales AND p_location_id IS NOT NULL THEN
        PERFORM public.reconcile_document_sequence(
            p_tenant_id,
            p_voucher_type,
            p_location_id,
            p_prefix
        );
    END IF;

    IF p_prefix IS NOT NULL THEN
        SELECT *
        INTO v_row
        FROM public.document_sequences
        WHERE tenant_id = p_tenant_id
          AND voucher_type = p_voucher_type
          AND prefix = p_prefix
          AND location_id IS NOT DISTINCT FROM p_location_id
        FOR UPDATE;
    ELSE
        SELECT prefix, padding_length, uses_location_scope
        INTO v_resolved_prefix, v_resolved_padding, v_uses_location_scope
        FROM private.resolve_effective_naming_entry(p_tenant_id, p_location_id, p_voucher_type);

        v_scope_location_id := CASE
            WHEN v_uses_location_scope THEN p_location_id
            ELSE NULL
        END;

        SELECT *
        INTO v_row
        FROM public.document_sequences
        WHERE tenant_id = p_tenant_id
          AND voucher_type = p_voucher_type
          AND prefix = v_resolved_prefix
          AND location_id IS NOT DISTINCT FROM v_scope_location_id
        FOR UPDATE;

        IF NOT FOUND THEN
            INSERT INTO public.document_sequences (
                tenant_id,
                location_id,
                voucher_type,
                prefix,
                next_value,
                padding_length
            )
            VALUES (
                p_tenant_id,
                v_scope_location_id,
                p_voucher_type,
                v_resolved_prefix,
                1,
                v_resolved_padding
            )
            RETURNING * INTO v_row;
        END IF;
    END IF;

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'document sequence not configured for tenant %, type %, prefix %, location %',
            p_tenant_id, p_voucher_type, p_prefix, p_location_id;
    END IF;

    v_sequence_value := v_row.next_value;

    IF v_tenant_scoped_sales THEN
        LOOP
            v_candidate := v_row.prefix || lpad(v_sequence_value::text, v_row.padding_length, '0');
            EXIT WHEN NOT private.tenant_sales_voucher_number_exists(
                p_tenant_id,
                p_voucher_type,
                v_candidate
            );
            v_sequence_value := v_sequence_value + 1;
        END LOOP;
    ELSE
        v_candidate := v_row.prefix || lpad(v_sequence_value::text, v_row.padding_length, '0');
    END IF;

    UPDATE public.document_sequences
    SET next_value = v_sequence_value + 1,
        updated_at = NOW()
    WHERE id = v_row.id;

    RETURN v_candidate;
END;
$$;

DO $$
DECLARE
    v_location RECORD;
    v_type public.document_voucher_type;
BEGIN
    FOR v_location IN
        SELECT
            tl.tenant_id,
            tl.id AS location_id,
            tl.is_stock_holding,
            tl.is_commercial_storefront,
            tl.is_administrative_office
        FROM public.tenant_locations tl
        WHERE tl.is_active = TRUE
    LOOP
        FOREACH v_type IN ARRAY ARRAY[
            'SALES_QUOTATION'::public.document_voucher_type,
            'SALES_ORDER'::public.document_voucher_type,
            'SALES_INVOICE'::public.document_voucher_type,
            'SALES_CREDIT_NOTE'::public.document_voucher_type,
            'CUSTOMER_PAYMENT'::public.document_voucher_type
        ]
        LOOP
            IF NOT private.location_supports_document_voucher_key(
                v_type::text,
                v_location.is_stock_holding,
                v_location.is_commercial_storefront,
                v_location.is_administrative_office
            ) THEN
                CONTINUE;
            END IF;

            BEGIN
                PERFORM public.reconcile_document_sequence(
                    v_location.tenant_id,
                    v_type,
                    v_location.location_id
                );
            EXCEPTION
                WHEN OTHERS THEN
                    NULL;
            END;
        END LOOP;
    END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION private.tenant_sales_voucher_number_exists(UUID, public.document_voucher_type, TEXT) FROM PUBLIC;

-- ====================================================================
-- AIB SMART ERP - SALES DOCUMENT NUMBERING ON STOCK-HOLDING LOCATIONS
-- Migration: 20260628100000_sales_location_document_numbering.sql
-- ====================================================================
-- Sales quotations, orders, invoices, and credit notes are numbered at
-- the stock-holding origin/shipping location. Extend location capability
-- mapping and backfill default prefixes on existing warehouses.
-- Customer payments resolve through the central HQ or first configured
-- admin/storefront location because they are tenant-wide receipts.
-- ====================================================================

CREATE OR REPLACE FUNCTION private.location_supports_document_voucher_key(
    p_key TEXT,
    p_is_stock_holding BOOLEAN,
    p_is_commercial_storefront BOOLEAN,
    p_is_administrative_office BOOLEAN
)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
    IF NOT private.is_document_voucher_type(p_key) THEN
        RETURN FALSE;
    END IF;

    CASE upper(p_key)
        WHEN 'PURCHASE_ORDER', 'GOODS_RECEIPT_NOTE', 'PURCHASE_INVOICE', 'STOCK_TRANSFER', 'STOCK_ADJUSTMENT' THEN
            RETURN COALESCE(p_is_stock_holding, FALSE);
        WHEN 'SALES_QUOTATION', 'SALES_ORDER', 'SALES_INVOICE', 'SALES_CREDIT_NOTE' THEN
            RETURN COALESCE(p_is_stock_holding, FALSE)
                OR COALESCE(p_is_commercial_storefront, FALSE);
        WHEN 'CUSTOMER_PAYMENT' THEN
            RETURN COALESCE(p_is_commercial_storefront, FALSE)
                OR COALESCE(p_is_administrative_office, FALSE);
        WHEN 'GENERAL_LEDGER' THEN
            RETURN COALESCE(p_is_administrative_office, FALSE);
        ELSE
            RETURN FALSE;
    END CASE;
END;
$$;

CREATE OR REPLACE FUNCTION private.resolve_customer_payment_numbering_location(
    p_tenant_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_central_hq UUID;
    v_location_id UUID;
BEGIN
    v_central_hq := NULLIF(
        (private.get_location_governance_config(p_tenant_id) ->> 'central_hq_location_id'),
        ''
    )::uuid;

    IF v_central_hq IS NOT NULL THEN
        SELECT tl.id
        INTO v_location_id
        FROM public.tenant_locations tl
        WHERE tl.id = v_central_hq
          AND tl.tenant_id = p_tenant_id
          AND tl.is_active = TRUE
          AND private.location_supports_document_voucher_key(
              'CUSTOMER_PAYMENT',
              tl.is_stock_holding,
              tl.is_commercial_storefront,
              tl.is_administrative_office
          )
          AND NULLIF(
              btrim(
                  COALESCE(tl.location_meta, '{}'::jsonb)
                      -> 'configuration_metadata'
                      -> 'naming_sequences'
                      -> 'CUSTOMER_PAYMENT'
                      ->> 'prefix'
              ),
              ''
          ) IS NOT NULL
        LIMIT 1;

        IF v_location_id IS NOT NULL THEN
            RETURN v_location_id;
        END IF;
    END IF;

    SELECT tl.id
    INTO v_location_id
    FROM public.tenant_locations tl
    WHERE tl.tenant_id = p_tenant_id
      AND tl.is_active = TRUE
      AND NOT private.is_system_tenant_location(tl.code)
      AND private.location_supports_document_voucher_key(
          'CUSTOMER_PAYMENT',
          tl.is_stock_holding,
          tl.is_commercial_storefront,
          tl.is_administrative_office
      )
      AND NULLIF(
          btrim(
              COALESCE(tl.location_meta, '{}'::jsonb)
                  -> 'configuration_metadata'
                  -> 'naming_sequences'
                  -> 'CUSTOMER_PAYMENT'
                  ->> 'prefix'
          ),
          ''
      ) IS NOT NULL
    ORDER BY tl.name
    LIMIT 1;

    IF v_location_id IS NULL THEN
        RAISE EXCEPTION
            'document naming not configured for tenant %, type CUSTOMER_PAYMENT',
            p_tenant_id;
    END IF;

    RETURN v_location_id;
END;
$$;

DO $$
DECLARE
    v_location RECORD;
    v_location_meta JSONB;
    v_location_naming JSONB;
    v_key TEXT;
    v_existing_prefix TEXT;
    v_new_naming JSONB;
    v_updated_meta JSONB;
    v_default_prefix TEXT;
    v_changed BOOLEAN;
BEGIN
    FOR v_location IN
        SELECT
            id,
            tenant_id,
            location_meta,
            is_stock_holding,
            is_commercial_storefront,
            is_administrative_office
        FROM public.tenant_locations
    LOOP
        v_location_meta := COALESCE(v_location.location_meta, '{}'::jsonb);
        v_location_naming := COALESCE(
            v_location_meta -> 'configuration_metadata' -> 'naming_sequences',
            '{}'::jsonb
        );
        v_new_naming := v_location_naming;
        v_changed := FALSE;

        FOR v_key IN
            SELECT unnest(ARRAY[
                'PURCHASE_ORDER',
                'GOODS_RECEIPT_NOTE',
                'PURCHASE_INVOICE',
                'STOCK_TRANSFER',
                'STOCK_ADJUSTMENT',
                'SALES_QUOTATION',
                'SALES_ORDER',
                'SALES_INVOICE',
                'CUSTOMER_PAYMENT',
                'SALES_CREDIT_NOTE',
                'GENERAL_LEDGER'
            ])
        LOOP
            IF NOT private.location_supports_document_voucher_key(
                v_key,
                v_location.is_stock_holding,
                v_location.is_commercial_storefront,
                v_location.is_administrative_office
            ) THEN
                CONTINUE;
            END IF;

            v_existing_prefix := NULLIF(btrim(v_location_naming -> v_key ->> 'prefix'), '');
            IF v_existing_prefix IS NOT NULL THEN
                CONTINUE;
            END IF;

            v_default_prefix := private.default_document_naming_prefix(v_key);
            IF v_default_prefix IS NULL THEN
                CONTINUE;
            END IF;

            v_new_naming := v_new_naming || jsonb_build_object(
                v_key,
                jsonb_build_object(
                    'prefix', v_default_prefix,
                    'digits', 5
                )
            );
            v_changed := TRUE;
        END LOOP;

        IF v_changed THEN
            v_updated_meta := jsonb_set(
                v_location_meta,
                '{configuration_metadata,naming_sequences}',
                v_new_naming,
                true
            );

            UPDATE public.tenant_locations
            SET
                location_meta = v_updated_meta,
                updated_at = NOW()
            WHERE id = v_location.id;

            PERFORM private.sync_document_sequences_from_naming(
                v_location.tenant_id,
                v_new_naming,
                v_location.id
            );
        END IF;
    END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.save_customer_payment(
    p_customer_id UUID,
    p_amount_received NUMERIC,
    p_payment_method public.gateway_provider_type,
    p_created_by UUID,
    p_reference_number TEXT DEFAULT NULL,
    p_currency_code VARCHAR(3) DEFAULT NULL,
    p_exchange_rate NUMERIC DEFAULT NULL,
    p_received_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_tenant_id UUID;
    v_payment_id UUID;
    v_payment_number TEXT;
    v_currency_code VARCHAR(3);
    v_exchange_rate NUMERIC(15, 6) := GREATEST(COALESCE(p_exchange_rate, 1), 0.000001);
    v_numbering_location_id UUID;
BEGIN
    v_tenant_id := private.current_tenant_id();
    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'tenant context missing from session';
    END IF;

    IF NOT private.can_edit_sales_orders() THEN
        RAISE EXCEPTION 'customer payment permission required';
    END IF;

    IF p_customer_id IS NULL OR p_created_by IS NULL THEN
        RAISE EXCEPTION 'customer_id and created_by are required';
    END IF;

    IF p_amount_received IS NULL OR p_amount_received <= 0 THEN
        RAISE EXCEPTION 'amount_received must be greater than zero';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.entities
        WHERE id = p_customer_id AND tenant_id = v_tenant_id AND is_active = TRUE
          AND type IN ('CUSTOMER'::public.entity_commercial_type, 'MUTUAL_PARTNER'::public.entity_commercial_type)
    ) THEN
        RAISE EXCEPTION 'customer not found';
    END IF;

    SELECT upper(btrim(COALESCE(
        p_currency_code,
        (SELECT t.base_currency FROM public.tenants t WHERE t.id = v_tenant_id),
        'INR'
    ))) INTO v_currency_code;

    v_numbering_location_id := private.resolve_customer_payment_numbering_location(v_tenant_id);

    v_payment_number := public.generate_next_voucher_string(
        v_tenant_id,
        'CUSTOMER_PAYMENT'::public.document_voucher_type,
        NULL,
        v_numbering_location_id
    );

    INSERT INTO public.customer_payments (
        tenant_id, customer_id, payment_number, amount_received,
        payment_method, currency_code, exchange_rate_at_receipt,
        reference_number, received_at, created_by
    )
    VALUES (
        v_tenant_id, p_customer_id, v_payment_number, p_amount_received,
        p_payment_method, v_currency_code, v_exchange_rate,
        p_reference_number, COALESCE(p_received_at, NOW()), p_created_by
    )
    RETURNING id INTO v_payment_id;

    RETURN v_payment_id;
END;
$$;

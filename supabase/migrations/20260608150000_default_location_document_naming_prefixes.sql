-- ====================================================================
-- AIB SMART ERP - DEFAULT LOCATION DOCUMENT NAMING PREFIXES
-- Migration: 20260608150000_default_location_document_naming_prefixes.sql
-- ====================================================================
-- Seeds year-scoped voucher prefixes (e.g. PO-2026-) on locations that
-- support document numbering but have no prefix configured yet.
-- ====================================================================

CREATE OR REPLACE FUNCTION private.default_document_naming_prefix(
    p_key TEXT,
    p_year INTEGER DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    v_year INTEGER;
    v_token TEXT;
BEGIN
    v_year := COALESCE(p_year, EXTRACT(YEAR FROM NOW())::INTEGER);

    v_token := CASE upper(p_key)
        WHEN 'PURCHASE_ORDER' THEN 'PO'
        WHEN 'GOODS_RECEIPT_NOTE' THEN 'GRN'
        WHEN 'PURCHASE_INVOICE' THEN 'PI'
        WHEN 'STOCK_TRANSFER' THEN 'ST'
        WHEN 'STOCK_ADJUSTMENT' THEN 'SA'
        WHEN 'SALES_QUOTATION' THEN 'SQ'
        WHEN 'SALES_ORDER' THEN 'SO'
        WHEN 'SALES_INVOICE' THEN 'SI'
        WHEN 'CUSTOMER_PAYMENT' THEN 'CP'
        WHEN 'SALES_CREDIT_NOTE' THEN 'SCN'
        WHEN 'GENERAL_LEDGER' THEN 'GL'
        ELSE NULL
    END;

    IF v_token IS NULL THEN
        RETURN NULL;
    END IF;

    RETURN v_token || '-' || v_year::TEXT || '-';
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

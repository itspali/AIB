-- ====================================================================
-- GST compliance foundation: supply context resolver, document columns
-- Migration: 20260618120000_gst_compliance_foundation.sql
-- ====================================================================

CREATE TYPE public.gst_tax_mechanism AS ENUM (
    'FORWARD',
    'REVERSE_CHARGE',
    'IMPORT_IGST',
    'ZERO_RATED',
    'EXEMPT',
    'COMPOSITION'
);

-- Extend PO supply nature for import paths
ALTER TABLE public.purchase_orders
    DROP CONSTRAINT IF EXISTS purchase_orders_tax_supply_nature_chk;

ALTER TABLE public.purchase_orders
    ADD CONSTRAINT purchase_orders_tax_supply_nature_chk
        CHECK (tax_supply_nature IN (
            'INTRASTATE', 'INTERSTATE', 'IMPORT_GOODS', 'IMPORT_SERVICES', 'EXPORT'
        )) NOT VALID;

ALTER TABLE public.purchase_orders VALIDATE CONSTRAINT purchase_orders_tax_supply_nature_chk;

ALTER TABLE public.purchase_orders
    ADD COLUMN IF NOT EXISTS tax_mechanism public.gst_tax_mechanism NOT NULL DEFAULT 'FORWARD',
    ADD COLUMN IF NOT EXISTS supplier_tax_treatment public.tax_treatment_type,
    ADD COLUMN IF NOT EXISTS supplier_country_code VARCHAR(2),
    ADD COLUMN IF NOT EXISTS incoterms_code VARCHAR(3),
    ADD COLUMN IF NOT EXISTS rcm_applicable BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.goods_receipts
    ADD COLUMN IF NOT EXISTS tax_supply_nature TEXT,
    ADD COLUMN IF NOT EXISTS tax_mechanism public.gst_tax_mechanism,
    ADD COLUMN IF NOT EXISTS bill_of_entry_number TEXT,
    ADD COLUMN IF NOT EXISTS bill_of_entry_date DATE,
    ADD COLUMN IF NOT EXISTS port_code VARCHAR(10),
    ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC(15, 6) NOT NULL DEFAULT 1.000000,
    ADD COLUMN IF NOT EXISTS assessable_value NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
    ADD COLUMN IF NOT EXISTS customs_duty_amount NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
    ADD COLUMN IF NOT EXISTS import_igst_amount NUMERIC(15, 4) NOT NULL DEFAULT 0.0000;

ALTER TABLE public.goods_receipt_items
    ADD COLUMN IF NOT EXISTS import_igst_amount NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
    ADD COLUMN IF NOT EXISTS customs_duty_amount NUMERIC(15, 4) NOT NULL DEFAULT 0.0000;

ALTER TABLE public.purchase_invoices
    ADD COLUMN IF NOT EXISTS tax_supply_nature TEXT,
    ADD COLUMN IF NOT EXISTS tax_mechanism public.gst_tax_mechanism NOT NULL DEFAULT 'FORWARD',
    ADD COLUMN IF NOT EXISTS supplier_tax_treatment public.tax_treatment_type,
    ADD COLUMN IF NOT EXISTS supplier_country_code VARCHAR(2),
    ADD COLUMN IF NOT EXISTS currency_code VARCHAR(3),
    ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC(15, 6) NOT NULL DEFAULT 1.000000,
    ADD COLUMN IF NOT EXISTS total_gross_amount NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
    ADD COLUMN IF NOT EXISTS total_tax_amount NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
    ADD COLUMN IF NOT EXISTS place_of_supply TEXT,
    ADD COLUMN IF NOT EXISTS document_type VARCHAR(3) NOT NULL DEFAULT 'INV',
    ADD COLUMN IF NOT EXISTS rcm_applicable BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS bill_of_entry_number TEXT,
    ADD COLUMN IF NOT EXISTS bill_of_entry_date DATE,
    ADD COLUMN IF NOT EXISTS port_code VARCHAR(10);

ALTER TABLE public.purchase_invoice_items
    ADD COLUMN IF NOT EXISTS tax_components_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS hsn_sac_code TEXT,
    ADD COLUMN IF NOT EXISTS reverse_charge BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS purchase_order_item_id UUID;

ALTER TABLE public.sales_invoices
    ADD COLUMN IF NOT EXISTS tax_mechanism public.gst_tax_mechanism NOT NULL DEFAULT 'FORWARD',
    ADD COLUMN IF NOT EXISTS customer_tax_treatment public.tax_treatment_type,
    ADD COLUMN IF NOT EXISTS place_of_supply TEXT,
    ADD COLUMN IF NOT EXISTS document_type VARCHAR(3) NOT NULL DEFAULT 'INV',
    ADD COLUMN IF NOT EXISTS shipping_bill_number TEXT,
    ADD COLUMN IF NOT EXISTS port_code VARCHAR(10),
    ADD COLUMN IF NOT EXISTS irn TEXT,
    ADD COLUMN IF NOT EXISTS irn_ack_no TEXT,
    ADD COLUMN IF NOT EXISTS irn_ack_date TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS signed_qr_code TEXT,
    ADD COLUMN IF NOT EXISTS einvoice_status TEXT NOT NULL DEFAULT 'NOT_APPLICABLE',
    ADD COLUMN IF NOT EXISTS einvoice_error TEXT;

CREATE OR REPLACE FUNCTION private.gst_is_overseas_party(
    p_party_tax_treatment public.tax_treatment_type,
    p_party_country TEXT
)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT p_party_tax_treatment = 'OVERSEAS_EXPORT'::public.tax_treatment_type
        OR (
            COALESCE(upper(trim(p_party_country)), '') <> ''
            AND upper(trim(p_party_country)) <> 'IN'
        );
$$;

CREATE OR REPLACE FUNCTION private.gst_resolve_supply_context(
    p_tenant_country TEXT,
    p_party_tax_treatment public.tax_treatment_type,
    p_party_country TEXT,
    p_party_state TEXT,
    p_destination_state TEXT,
    p_document_side TEXT,
    p_supply_kind TEXT DEFAULT 'GOODS'
)
RETURNS TABLE (
    supply_nature TEXT,
    tax_mechanism public.gst_tax_mechanism,
    tax_treatment_applied TEXT
)
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    v_tenant_country TEXT := upper(trim(COALESCE(p_tenant_country, '')));
    v_party_country TEXT := upper(trim(COALESCE(p_party_country, '')));
    v_party_state TEXT := upper(trim(COALESCE(p_party_state, '')));
    v_destination_state TEXT := upper(trim(COALESCE(p_destination_state, '')));
    v_side TEXT := upper(trim(COALESCE(p_document_side, 'PURCHASE')));
    v_kind TEXT := upper(trim(COALESCE(p_supply_kind, 'GOODS')));
    v_overseas BOOLEAN;
    v_mode TEXT;
BEGIN
    v_overseas := private.gst_is_overseas_party(p_party_tax_treatment, v_party_country);

    IF v_tenant_country <> 'IN' THEN
        v_mode := private.resolve_sales_tax_mode(p_party_state, v_destination_state);
        supply_nature := private.map_sales_tax_mode_to_po_supply_nature(v_mode);
        tax_mechanism := 'FORWARD'::public.gst_tax_mechanism;
        tax_treatment_applied := v_mode;
        RETURN NEXT;
        RETURN;
    END IF;

    IF v_side = 'SALE' THEN
        IF p_party_tax_treatment IN (
            'OVERSEAS_EXPORT'::public.tax_treatment_type,
            'SEZ_DEVELOPER'::public.tax_treatment_type,
            'DEEMED_EXPORT'::public.tax_treatment_type
        ) OR v_overseas THEN
            supply_nature := 'EXPORT';
            tax_mechanism := 'ZERO_RATED'::public.gst_tax_mechanism;
            tax_treatment_applied := 'ZERO_RATED';
            RETURN NEXT;
            RETURN;
        END IF;

        IF p_party_tax_treatment = 'COMPOSITION'::public.tax_treatment_type THEN
            supply_nature := 'INTRASTATE';
            tax_mechanism := 'COMPOSITION'::public.gst_tax_mechanism;
            tax_treatment_applied := 'COMPOSITION';
            RETURN NEXT;
            RETURN;
        END IF;

        IF p_party_tax_treatment = 'UNREGISTERED_B2C'::public.tax_treatment_type THEN
            v_mode := private.resolve_sales_tax_mode(v_party_state, v_destination_state);
            supply_nature := private.map_sales_tax_mode_to_po_supply_nature(v_mode);
            tax_mechanism := 'FORWARD'::public.gst_tax_mechanism;
            tax_treatment_applied := v_mode;
            RETURN NEXT;
            RETURN;
        END IF;

        v_mode := private.resolve_sales_tax_mode(v_party_state, v_destination_state);
        supply_nature := private.map_sales_tax_mode_to_po_supply_nature(v_mode);
        tax_mechanism := 'FORWARD'::public.gst_tax_mechanism;
        tax_treatment_applied := v_mode;
        RETURN NEXT;
        RETURN;
    END IF;

    -- PURCHASE side
    IF v_overseas OR p_party_tax_treatment = 'OVERSEAS_EXPORT'::public.tax_treatment_type THEN
        IF v_kind = 'SERVICES' THEN
            supply_nature := 'IMPORT_SERVICES';
            tax_mechanism := 'REVERSE_CHARGE'::public.gst_tax_mechanism;
        ELSE
            supply_nature := 'IMPORT_GOODS';
            tax_mechanism := 'IMPORT_IGST'::public.gst_tax_mechanism;
        END IF;
        tax_treatment_applied := 'IGST';
        RETURN NEXT;
        RETURN;
    END IF;

    IF p_party_tax_treatment = 'COMPOSITION'::public.tax_treatment_type THEN
        v_mode := private.resolve_sales_tax_mode(v_party_state, v_destination_state);
        supply_nature := private.map_sales_tax_mode_to_po_supply_nature(v_mode);
        tax_mechanism := 'COMPOSITION'::public.gst_tax_mechanism;
        tax_treatment_applied := v_mode;
        RETURN NEXT;
        RETURN;
    END IF;

    IF p_party_tax_treatment = 'SEZ_DEVELOPER'::public.tax_treatment_type THEN
        supply_nature := 'INTERSTATE';
        tax_mechanism := 'ZERO_RATED'::public.gst_tax_mechanism;
        tax_treatment_applied := 'IGST';
        RETURN NEXT;
        RETURN;
    END IF;

    v_mode := private.resolve_sales_tax_mode(v_party_state, v_destination_state);
    supply_nature := private.map_sales_tax_mode_to_po_supply_nature(v_mode);
    tax_mechanism := 'FORWARD'::public.gst_tax_mechanism;
    tax_treatment_applied := v_mode;
    RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.gst_resolve_supply_context(
    p_tenant_country TEXT,
    p_party_tax_treatment public.tax_treatment_type,
    p_party_country TEXT,
    p_party_state TEXT,
    p_destination_state TEXT,
    p_document_side TEXT,
    p_supply_kind TEXT DEFAULT 'GOODS'
)
RETURNS TABLE (
    supply_nature TEXT,
    tax_mechanism public.gst_tax_mechanism,
    tax_treatment_applied TEXT
)
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT * FROM private.gst_resolve_supply_context(
        p_tenant_country,
        p_party_tax_treatment,
        p_party_country,
        p_party_state,
        p_destination_state,
        p_document_side,
        p_supply_kind
    );
$$;

REVOKE ALL ON FUNCTION public.gst_resolve_supply_context(TEXT, public.tax_treatment_type, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gst_resolve_supply_context(TEXT, public.tax_treatment_type, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;

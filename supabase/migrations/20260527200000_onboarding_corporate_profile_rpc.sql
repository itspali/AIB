-- ====================================================================
-- AIB SMART ERP - ONBOARDING CORPORATE PROFILE RPC (atomic Step 1 save)
-- Migration: 20260527200000_onboarding_corporate_profile_rpc.sql
-- ====================================================================

CREATE OR REPLACE FUNCTION private.save_onboarding_corporate_profile(
    p_company_name TEXT,
    p_legal_registration_number TEXT,
    p_tax_identifier TEXT,
    p_location_name TEXT,
    p_location_code TEXT,
    p_address_line1 TEXT,
    p_city TEXT,
    p_state TEXT,
    p_zip_postal TEXT,
    p_country_code TEXT,
    p_billing_state TEXT DEFAULT NULL,
    p_shipping_state TEXT DEFAULT NULL,
    p_tax_registered_name TEXT DEFAULT NULL,
    p_location_tax_identifier TEXT DEFAULT NULL
)
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

    UPDATE public.tenants
    SET
        name = btrim(p_company_name),
        legal_name = btrim(p_company_name),
        legal_registration_number = btrim(p_legal_registration_number),
        tax_identifier = btrim(p_tax_identifier),
        onboarding_status = 'ORGANIZATION_CONFIGURED',
        updated_at = NOW()
    WHERE id = v_tenant_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'tenant not found or access denied';
    END IF;

    IF EXISTS (SELECT 1 FROM public.tenant_locations WHERE tenant_id = v_tenant_id) THEN
        RETURN;
    END IF;

    INSERT INTO public.tenant_locations (
        tenant_id,
        name,
        code,
        address_line1,
        city,
        state,
        zip_postal,
        country_code,
        tax_registered_name,
        location_tax_identifier,
        location_meta
    )
    VALUES (
        v_tenant_id,
        btrim(p_location_name),
        btrim(p_location_code),
        btrim(p_address_line1),
        btrim(p_city),
        btrim(p_state),
        btrim(p_zip_postal),
        upper(btrim(p_country_code)),
        COALESCE(NULLIF(btrim(p_tax_registered_name), ''), btrim(p_company_name)),
        NULLIF(btrim(COALESCE(p_location_tax_identifier, p_tax_identifier)), ''),
        jsonb_build_object(
            'billing_state', NULLIF(btrim(COALESCE(p_billing_state, '')), ''),
            'shipping_state', NULLIF(btrim(COALESCE(p_shipping_state, '')), '')
        )
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.save_onboarding_corporate_profile(
    p_company_name TEXT,
    p_legal_registration_number TEXT,
    p_tax_identifier TEXT,
    p_location_name TEXT,
    p_location_code TEXT,
    p_address_line1 TEXT,
    p_city TEXT,
    p_state TEXT,
    p_zip_postal TEXT,
    p_country_code TEXT,
    p_billing_state TEXT DEFAULT NULL,
    p_shipping_state TEXT DEFAULT NULL,
    p_tax_registered_name TEXT DEFAULT NULL,
    p_location_tax_identifier TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, private
AS $$
    SELECT private.save_onboarding_corporate_profile(
        p_company_name,
        p_legal_registration_number,
        p_tax_identifier,
        p_location_name,
        p_location_code,
        p_address_line1,
        p_city,
        p_state,
        p_zip_postal,
        p_country_code,
        p_billing_state,
        p_shipping_state,
        p_tax_registered_name,
        p_location_tax_identifier
    );
$$;

REVOKE ALL ON FUNCTION public.save_onboarding_corporate_profile(
    TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.save_onboarding_corporate_profile(
    TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT
) TO authenticated;

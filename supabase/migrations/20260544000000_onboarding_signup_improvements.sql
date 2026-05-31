-- ====================================================================
-- Onboarding & signup improvements: Step 1 upsert + gated go-live RPC
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
    v_location_id UUID;
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

    SELECT id
    INTO v_location_id
    FROM public.tenant_locations
    WHERE tenant_id = v_tenant_id
    ORDER BY created_at ASC NULLS LAST, id ASC
    LIMIT 1;

    IF v_location_id IS NOT NULL THEN
        UPDATE public.tenant_locations
        SET
            name = btrim(p_location_name),
            code = btrim(p_location_code),
            address_line1 = btrim(p_address_line1),
            city = btrim(p_city),
            state = btrim(p_state),
            zip_postal = btrim(p_zip_postal),
            country_code = upper(btrim(p_country_code)),
            tax_registered_name = COALESCE(NULLIF(btrim(p_tax_registered_name), ''), btrim(p_company_name)),
            location_tax_identifier = NULLIF(btrim(COALESCE(p_location_tax_identifier, p_tax_identifier)), ''),
            location_meta = jsonb_build_object(
                'billing_state', NULLIF(btrim(COALESCE(p_billing_state, '')), ''),
                'shipping_state', NULLIF(btrim(COALESCE(p_shipping_state, '')), '')
            ),
            updated_at = NOW()
        WHERE id = v_location_id
          AND tenant_id = v_tenant_id;
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

CREATE OR REPLACE FUNCTION private.complete_onboarding()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_tenant_id UUID;
    v_location_count BIGINT;
    v_account_count BIGINT;
    v_tax_count BIGINT;
    v_channel_count BIGINT;
BEGIN
    v_tenant_id := private.current_tenant_id();
    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'tenant context missing from session';
    END IF;

    SELECT COUNT(*) INTO v_location_count
    FROM public.tenant_locations
    WHERE tenant_id = v_tenant_id;

    SELECT COUNT(*) INTO v_account_count
    FROM public.accounts
    WHERE tenant_id = v_tenant_id;

    SELECT COUNT(*) INTO v_tax_count
    FROM public.tax_rate_registry
    WHERE tenant_id = v_tenant_id;

    SELECT COUNT(*) INTO v_channel_count
    FROM public.storefront_channels
    WHERE tenant_id = v_tenant_id;

    IF v_location_count < 1 THEN
        RAISE EXCEPTION 'complete onboarding requires at least one location';
    END IF;

    IF v_account_count < 1 THEN
        RAISE EXCEPTION 'complete onboarding requires chart of accounts deployment';
    END IF;

    IF v_tax_count < 1 THEN
        RAISE EXCEPTION 'complete onboarding requires at least one tax rate';
    END IF;

    IF v_channel_count < 1 THEN
        RAISE EXCEPTION 'complete onboarding requires at least one storefront channel';
    END IF;

    UPDATE public.tenants
    SET
        onboarding_status = 'GO_LIVE_READY',
        updated_at = NOW()
    WHERE id = v_tenant_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'tenant not found or access denied';
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_onboarding()
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, private
AS $$
    SELECT private.complete_onboarding();
$$;

REVOKE ALL ON FUNCTION public.complete_onboarding() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_onboarding() TO authenticated;

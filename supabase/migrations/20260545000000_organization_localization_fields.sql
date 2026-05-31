-- ====================================================================
-- AIB SMART ERP - ORGANIZATION LOCALIZATION FIELDS
-- Migration: 20260545000000_organization_localization_fields.sql
-- Adds canonical operating country, default timezone, and locale to
-- the tenant profile, and extends the governance profile RPC to manage
-- them. Country was previously only inferred from a location address.
-- ====================================================================

-- 1. SCHEMA: canonical localization columns on the tenant profile
ALTER TABLE public.tenants
    ADD COLUMN IF NOT EXISTS country_code VARCHAR(2),
    ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'UTC',
    ADD COLUMN IF NOT EXISTS locale VARCHAR(10) NOT NULL DEFAULT 'en-US';

COMMENT ON COLUMN public.tenants.country_code IS 'ISO 3166-1 alpha-2 operating jurisdiction; drives COA + tax template defaults.';
COMMENT ON COLUMN public.tenants.timezone IS 'IANA timezone (e.g. Asia/Kolkata) used as the workspace default for document timestamps and fiscal cutoffs.';
COMMENT ON COLUMN public.tenants.locale IS 'BCP-47 locale tag (e.g. en-US) used for number, date, and currency formatting.';

-- 2. BACKFILL: derive canonical country from primary location, else billing
UPDATE public.tenants t
SET country_code = sub.country_code
FROM (
    SELECT DISTINCT ON (tl.tenant_id)
        tl.tenant_id,
        upper(tl.country_code) AS country_code
    FROM public.tenant_locations tl
    WHERE tl.country_code IS NOT NULL
    ORDER BY tl.tenant_id, tl.created_at ASC
) AS sub
WHERE t.id = sub.tenant_id
  AND t.country_code IS NULL;

UPDATE public.tenants
SET country_code = upper(billing_country_code)
WHERE country_code IS NULL
  AND billing_country_code IS NOT NULL;

-- 3. RPC: rebuild governance profile mutator with localization params
DROP FUNCTION IF EXISTS public.update_organization_governance_profile(
    TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT,
    SMALLINT, TEXT, JSONB, JSONB, JSONB
);
DROP FUNCTION IF EXISTS private.update_organization_governance_profile(
    TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT,
    SMALLINT, TEXT, JSONB, JSONB, JSONB
);

CREATE OR REPLACE FUNCTION private.update_organization_governance_profile(
    p_legal_name TEXT,
    p_trade_name TEXT DEFAULT NULL,
    p_tax_identifier TEXT DEFAULT NULL,
    p_legal_registration_number TEXT DEFAULT NULL,
    p_primary_email TEXT DEFAULT NULL,
    p_primary_phone TEXT DEFAULT NULL,
    p_secondary_phone TEXT DEFAULT NULL,
    p_website_url TEXT DEFAULT NULL,
    p_billing_address_line1 TEXT DEFAULT NULL,
    p_billing_address_line2 TEXT DEFAULT NULL,
    p_billing_city TEXT DEFAULT NULL,
    p_billing_state TEXT DEFAULT NULL,
    p_billing_zip_postal TEXT DEFAULT NULL,
    p_billing_country_code TEXT DEFAULT NULL,
    p_base_currency TEXT DEFAULT NULL,
    p_fiscal_year_start_month SMALLINT DEFAULT NULL,
    p_logo_url TEXT DEFAULT NULL,
    p_accounting_config_patch JSONB DEFAULT NULL,
    p_location_governance_config_patch JSONB DEFAULT NULL,
    p_naming_sequences JSONB DEFAULT NULL,
    p_country_code TEXT DEFAULT NULL,
    p_timezone TEXT DEFAULT NULL,
    p_locale TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_tenant_id UUID;
    v_trimmed_legal TEXT;
    v_current_currency VARCHAR(3);
    v_has_inventory_activity BOOLEAN;
BEGIN
    v_tenant_id := private.current_tenant_id();
    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'tenant context missing from session';
    END IF;

    IF NOT private.user_can_modify_organization_settings() THEN
        RAISE EXCEPTION 'administrative privileges required to modify organization settings';
    END IF;

    v_trimmed_legal := btrim(p_legal_name);
    IF v_trimmed_legal IS NULL OR v_trimmed_legal = '' THEN
        RAISE EXCEPTION 'legal entity name is required';
    END IF;

    IF p_primary_email IS NULL OR btrim(p_primary_email) = '' THEN
        RAISE EXCEPTION 'primary corporate email is required';
    END IF;

    IF p_primary_phone IS NULL OR btrim(p_primary_phone) = '' THEN
        RAISE EXCEPTION 'primary corporate phone is required';
    END IF;

    IF p_fiscal_year_start_month IS NOT NULL
       AND (p_fiscal_year_start_month < 1 OR p_fiscal_year_start_month > 12) THEN
        RAISE EXCEPTION 'fiscal year start month must be between 1 and 12';
    END IF;

    SELECT base_currency
    INTO v_current_currency
    FROM public.tenants
    WHERE id = v_tenant_id;

    IF p_base_currency IS NOT NULL
       AND upper(btrim(p_base_currency)) IS DISTINCT FROM upper(v_current_currency) THEN
        SELECT EXISTS (
            SELECT 1 FROM public.inventory_ledger WHERE tenant_id = v_tenant_id LIMIT 1
        )
        OR EXISTS (
            SELECT 1 FROM public.item_valuations WHERE tenant_id = v_tenant_id LIMIT 1
        )
        INTO v_has_inventory_activity;

        IF v_has_inventory_activity THEN
            RAISE EXCEPTION 'base currency cannot be changed after inventory activity exists';
        END IF;
    END IF;

    UPDATE public.tenants
    SET
        legal_name = v_trimmed_legal,
        trade_name = NULLIF(btrim(p_trade_name), ''),
        name = COALESCE(NULLIF(btrim(p_trade_name), ''), v_trimmed_legal),
        tax_identifier = NULLIF(btrim(p_tax_identifier), ''),
        legal_registration_number = NULLIF(btrim(p_legal_registration_number), ''),
        primary_email = lower(btrim(p_primary_email)),
        primary_phone = btrim(p_primary_phone),
        secondary_phone = NULLIF(btrim(p_secondary_phone), ''),
        website_url = NULLIF(btrim(p_website_url), ''),
        billing_address_line1 = NULLIF(btrim(p_billing_address_line1), ''),
        billing_address_line2 = NULLIF(btrim(p_billing_address_line2), ''),
        billing_city = NULLIF(btrim(p_billing_city), ''),
        billing_state = NULLIF(btrim(p_billing_state), ''),
        billing_zip_postal = NULLIF(btrim(p_billing_zip_postal), ''),
        billing_country_code = NULLIF(upper(btrim(p_billing_country_code)), ''),
        country_code = NULLIF(upper(btrim(p_country_code)), ''),
        timezone = COALESCE(NULLIF(btrim(p_timezone), ''), timezone),
        locale = COALESCE(NULLIF(btrim(p_locale), ''), locale),
        base_currency = COALESCE(upper(btrim(p_base_currency)), base_currency),
        fiscal_year_start_month = COALESCE(p_fiscal_year_start_month, fiscal_year_start_month),
        logo_url = COALESCE(NULLIF(btrim(p_logo_url), ''), logo_url),
        accounting_config = CASE
            WHEN p_accounting_config_patch IS NULL THEN accounting_config
            ELSE private.merge_jsonb_objects(accounting_config, p_accounting_config_patch)
        END,
        location_governance_config = CASE
            WHEN p_location_governance_config_patch IS NULL THEN location_governance_config
            ELSE private.merge_jsonb_objects(location_governance_config, p_location_governance_config_patch)
        END,
        naming_sequences = CASE
            WHEN p_naming_sequences IS NULL THEN naming_sequences
            ELSE p_naming_sequences
        END,
        updated_at = NOW()
    WHERE id = v_tenant_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'tenant not found for session';
    END IF;

    IF p_naming_sequences IS NOT NULL THEN
        PERFORM private.sync_document_sequences_from_naming(v_tenant_id, p_naming_sequences);
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_organization_governance_profile(
    p_legal_name TEXT,
    p_trade_name TEXT DEFAULT NULL,
    p_tax_identifier TEXT DEFAULT NULL,
    p_legal_registration_number TEXT DEFAULT NULL,
    p_primary_email TEXT DEFAULT NULL,
    p_primary_phone TEXT DEFAULT NULL,
    p_secondary_phone TEXT DEFAULT NULL,
    p_website_url TEXT DEFAULT NULL,
    p_billing_address_line1 TEXT DEFAULT NULL,
    p_billing_address_line2 TEXT DEFAULT NULL,
    p_billing_city TEXT DEFAULT NULL,
    p_billing_state TEXT DEFAULT NULL,
    p_billing_zip_postal TEXT DEFAULT NULL,
    p_billing_country_code TEXT DEFAULT NULL,
    p_base_currency TEXT DEFAULT NULL,
    p_fiscal_year_start_month SMALLINT DEFAULT NULL,
    p_logo_url TEXT DEFAULT NULL,
    p_accounting_config_patch JSONB DEFAULT NULL,
    p_location_governance_config_patch JSONB DEFAULT NULL,
    p_naming_sequences JSONB DEFAULT NULL,
    p_country_code TEXT DEFAULT NULL,
    p_timezone TEXT DEFAULT NULL,
    p_locale TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, private
AS $$
    SELECT private.update_organization_governance_profile(
        p_legal_name,
        p_trade_name,
        p_tax_identifier,
        p_legal_registration_number,
        p_primary_email,
        p_primary_phone,
        p_secondary_phone,
        p_website_url,
        p_billing_address_line1,
        p_billing_address_line2,
        p_billing_city,
        p_billing_state,
        p_billing_zip_postal,
        p_billing_country_code,
        p_base_currency,
        p_fiscal_year_start_month,
        p_logo_url,
        p_accounting_config_patch,
        p_location_governance_config_patch,
        p_naming_sequences,
        p_country_code,
        p_timezone,
        p_locale
    );
$$;

REVOKE ALL ON FUNCTION public.update_organization_governance_profile(
    TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT,
    SMALLINT, TEXT, JSONB, JSONB, JSONB, TEXT, TEXT, TEXT
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_organization_governance_profile(
    TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT,
    SMALLINT, TEXT, JSONB, JSONB, JSONB, TEXT, TEXT, TEXT
) TO authenticated;

-- 4. FLOW: persist canonical country during onboarding (signature unchanged)
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
        country_code = COALESCE(NULLIF(upper(btrim(p_country_code)), ''), country_code),
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

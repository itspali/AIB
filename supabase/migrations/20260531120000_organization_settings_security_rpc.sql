-- ====================================================================
-- AIB SMART ERP - ORGANIZATION SETTINGS SECURITY & RPC LAYER
-- Migration: 20260531120000_organization_settings_security_rpc.sql
-- ====================================================================

DROP POLICY IF EXISTS tenant_isolation_policy ON public.tenants;

CREATE POLICY tenants_select_tenant
    ON public.tenants
    FOR SELECT
    TO authenticated
    USING (id = private.current_tenant_id());

CREATE OR REPLACE FUNCTION private.user_can_modify_organization_settings()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
    SELECT
        private.current_user_role() = 'OWNER'::public.user_role
        OR EXISTS (
            SELECT 1
            FROM public.workspace_control_registry wcr
            WHERE wcr.tenant_id = private.current_tenant_id()
              AND wcr.registry_key = 'allow_organization_settings_modification'
              AND wcr.target_reference_id = auth.uid()
        );
$$;

CREATE OR REPLACE FUNCTION private.user_is_organization_owner()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
    SELECT private.current_user_role() = 'OWNER'::public.user_role;
$$;

CREATE OR REPLACE FUNCTION private.merge_jsonb_objects(
    p_base JSONB,
    p_patch JSONB
)
RETURNS JSONB
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT COALESCE(p_base, '{}'::jsonb) || COALESCE(p_patch, '{}'::jsonb);
$$;

CREATE OR REPLACE FUNCTION private.sync_document_sequences_from_naming(
    p_tenant_id UUID,
    p_naming_sequences JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_key TEXT;
    v_entry JSONB;
    v_prefix TEXT;
    v_digits INTEGER;
    v_voucher_type public.document_voucher_type;
BEGIN
    IF p_naming_sequences IS NULL OR jsonb_typeof(p_naming_sequences) IS DISTINCT FROM 'object' THEN
        RETURN;
    END IF;

    FOR v_key, v_entry IN SELECT * FROM jsonb_each(p_naming_sequences)
    LOOP
        BEGIN
            v_voucher_type := upper(v_key)::public.document_voucher_type;
        EXCEPTION
            WHEN others THEN
                CONTINUE;
        END;

        v_prefix := NULLIF(btrim(v_entry ->> 'prefix'), '');
        IF v_prefix IS NULL THEN
            CONTINUE;
        END IF;

        v_digits := COALESCE(NULLIF(v_entry ->> 'digits', '')::INTEGER, 5);
        IF v_digits < 3 OR v_digits > 12 THEN
            v_digits := 5;
        END IF;

        UPDATE public.document_sequences
        SET
            prefix = v_prefix,
            padding_length = v_digits
        WHERE tenant_id = p_tenant_id
          AND voucher_type = v_voucher_type
          AND prefix = v_prefix;

        IF NOT FOUND THEN
            INSERT INTO public.document_sequences (
                tenant_id,
                voucher_type,
                prefix,
                next_value,
                padding_length
            )
            VALUES (
                p_tenant_id,
                v_voucher_type,
                v_prefix,
                1,
                v_digits
            )
            ON CONFLICT (tenant_id, voucher_type, prefix) DO UPDATE
            SET padding_length = EXCLUDED.padding_length;
        END IF;
    END LOOP;
END;
$$;

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
    p_naming_sequences JSONB DEFAULT NULL
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
    p_naming_sequences JSONB DEFAULT NULL
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
        p_naming_sequences
    );
$$;

CREATE OR REPLACE FUNCTION private.upsert_tenant_workspace_control(
    p_registry_key TEXT,
    p_metadata_patch JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_tenant_id UUID;
    v_existing_id UUID;
    v_merged JSONB;
BEGIN
    v_tenant_id := private.current_tenant_id();
    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'tenant context missing from session';
    END IF;

    IF NOT private.user_can_modify_organization_settings() THEN
        RAISE EXCEPTION 'administrative privileges required to modify workspace controls';
    END IF;

    IF p_registry_key NOT IN ('SALES_SETTINGS', 'FINANCIAL_SETTINGS') THEN
        RAISE EXCEPTION 'unsupported workspace control registry key';
    END IF;

    SELECT id, configuration_metadata
    INTO v_existing_id, v_merged
    FROM public.workspace_control_registry
    WHERE tenant_id = v_tenant_id
      AND scope_level = 'TENANT_GLOBAL'
      AND registry_key = p_registry_key
      AND target_reference_id IS NULL
    LIMIT 1;

    v_merged := private.merge_jsonb_objects(v_merged, p_metadata_patch);

    IF v_existing_id IS NULL THEN
        INSERT INTO public.workspace_control_registry (
            tenant_id,
            scope_level,
            registry_key,
            target_reference_id,
            configuration_metadata
        )
        VALUES (
            v_tenant_id,
            'TENANT_GLOBAL',
            p_registry_key,
            NULL,
            v_merged
        );
    ELSE
        UPDATE public.workspace_control_registry
        SET
            configuration_metadata = v_merged,
            updated_at = NOW()
        WHERE id = v_existing_id
          AND tenant_id = v_tenant_id;
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.upsert_tenant_workspace_control(
    p_registry_key TEXT,
    p_metadata_patch JSONB
)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, private
AS $$
    SELECT private.upsert_tenant_workspace_control(p_registry_key, p_metadata_patch);
$$;

CREATE OR REPLACE FUNCTION public.grant_organization_settings_delegate(p_user_id UUID)
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

    IF NOT private.user_is_organization_owner() THEN
        RAISE EXCEPTION 'only workspace owners can grant organization settings access';
    END IF;

    IF p_user_id = auth.uid() THEN
        RAISE EXCEPTION 'owners already have organization settings access';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.users u
        WHERE u.id = p_user_id
          AND u.tenant_id = v_tenant_id
          AND u.is_active = TRUE
    ) THEN
        RAISE EXCEPTION 'active user not found in workspace';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.workspace_control_registry wcr
        WHERE wcr.tenant_id = v_tenant_id
          AND wcr.scope_level = 'FUNCTIONAL_MODULE'
          AND wcr.registry_key = 'allow_organization_settings_modification'
          AND wcr.target_reference_id = p_user_id
    ) THEN
        UPDATE public.workspace_control_registry
        SET
            configuration_metadata = jsonb_build_object(
                'granted_by', auth.uid(),
                'granted_at', NOW()
            ),
            updated_at = NOW()
        WHERE tenant_id = v_tenant_id
          AND scope_level = 'FUNCTIONAL_MODULE'
          AND registry_key = 'allow_organization_settings_modification'
          AND target_reference_id = p_user_id;
    ELSE
        INSERT INTO public.workspace_control_registry (
            tenant_id,
            scope_level,
            registry_key,
            target_reference_id,
            configuration_metadata
        )
        VALUES (
            v_tenant_id,
            'FUNCTIONAL_MODULE',
            'allow_organization_settings_modification',
            p_user_id,
            jsonb_build_object(
                'granted_by', auth.uid(),
                'granted_at', NOW()
            )
        );
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.revoke_organization_settings_delegate(p_user_id UUID)
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

    IF NOT private.user_is_organization_owner() THEN
        RAISE EXCEPTION 'only workspace owners can revoke organization settings access';
    END IF;

    DELETE FROM public.workspace_control_registry
    WHERE tenant_id = v_tenant_id
      AND registry_key = 'allow_organization_settings_modification'
      AND target_reference_id = p_user_id;
END;
$$;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'tenant-logos',
    'tenant-logos',
    FALSE,
    2097152,
    ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS tenant_logos_select_tenant ON storage.objects;
CREATE POLICY tenant_logos_select_tenant
    ON storage.objects
    FOR SELECT
    TO authenticated
    USING (
        bucket_id = 'tenant-logos'
        AND (storage.foldername(name))[1] = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')
    );

DROP POLICY IF EXISTS tenant_logos_insert_authorized ON storage.objects;
CREATE POLICY tenant_logos_insert_authorized
    ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (
        bucket_id = 'tenant-logos'
        AND (storage.foldername(name))[1] = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')
        AND private.user_can_modify_organization_settings()
    );

DROP POLICY IF EXISTS tenant_logos_update_authorized ON storage.objects;
CREATE POLICY tenant_logos_update_authorized
    ON storage.objects
    FOR UPDATE
    TO authenticated
    USING (
        bucket_id = 'tenant-logos'
        AND (storage.foldername(name))[1] = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')
        AND private.user_can_modify_organization_settings()
    )
    WITH CHECK (
        bucket_id = 'tenant-logos'
        AND (storage.foldername(name))[1] = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')
        AND private.user_can_modify_organization_settings()
    );

DROP POLICY IF EXISTS tenant_logos_delete_authorized ON storage.objects;
CREATE POLICY tenant_logos_delete_authorized
    ON storage.objects
    FOR DELETE
    TO authenticated
    USING (
        bucket_id = 'tenant-logos'
        AND (storage.foldername(name))[1] = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')
        AND private.user_can_modify_organization_settings()
    );

REVOKE ALL ON FUNCTION public.update_organization_governance_profile(
    TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT,
    SMALLINT, TEXT, JSONB, JSONB, JSONB
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_organization_governance_profile(
    TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT,
    SMALLINT, TEXT, JSONB, JSONB, JSONB
) TO authenticated;

REVOKE ALL ON FUNCTION public.upsert_tenant_workspace_control(TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_tenant_workspace_control(TEXT, JSONB) TO authenticated;

REVOKE ALL ON FUNCTION public.grant_organization_settings_delegate(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.grant_organization_settings_delegate(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.revoke_organization_settings_delegate(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.revoke_organization_settings_delegate(UUID) TO authenticated;

GRANT EXECUTE ON FUNCTION private.user_can_modify_organization_settings() TO authenticated;

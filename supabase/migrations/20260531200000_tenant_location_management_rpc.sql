-- ====================================================================
-- AIB SMART ERP - TENANT LOCATION MANAGEMENT RPC LAYER (V1)
-- Migration: 20260531200000_tenant_location_management_rpc.sql
-- ====================================================================

CREATE OR REPLACE FUNCTION private.get_location_governance_config(p_tenant_id UUID)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
    SELECT COALESCE(
        (
            SELECT location_governance_config
            FROM public.tenants
            WHERE id = p_tenant_id
        ),
        '{
            "multi_location_enabled": true,
            "central_hq_location_id": null,
            "regional_hqs_enabled": false,
            "consensual_stock_transfers": true
        }'::jsonb
    );
$$;

CREATE OR REPLACE FUNCTION private.is_system_tenant_location(p_code TEXT)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT p_code LIKE '\_SYSTEM\_%';
$$;

CREATE OR REPLACE FUNCTION private.user_can_manage_tenant_locations()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
    SELECT
        private.current_user_role() IN ('OWNER'::public.user_role, 'ADMIN'::public.user_role)
        OR private.user_can_modify_organization_settings();
$$;

DROP POLICY IF EXISTS location_isolation_policy ON public.tenant_locations;

CREATE POLICY tenant_locations_select_tenant
    ON public.tenant_locations
    FOR SELECT
    TO authenticated
    USING (tenant_id = private.current_tenant_id());

CREATE OR REPLACE FUNCTION private.save_tenant_location_core(
    p_location_id UUID,
    p_name TEXT,
    p_code TEXT,
    p_location_type public.location_operational_type,
    p_parent_location_id UUID,
    p_address_line1 TEXT,
    p_address_line2 TEXT,
    p_city TEXT,
    p_state TEXT,
    p_zip_postal TEXT,
    p_country_code TEXT,
    p_manager_name TEXT,
    p_contact_email TEXT,
    p_contact_phone TEXT,
    p_is_stock_holding BOOLEAN,
    p_location_tax_identifier TEXT,
    p_tax_registered_name TEXT,
    p_location_meta JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_tenant_id UUID;
    v_governance JSONB;
    v_multi_location BOOLEAN;
    v_regional_hqs BOOLEAN;
    v_central_hq UUID;
    v_normalized_code TEXT;
    v_trimmed_name TEXT;
    v_location_id UUID;
    v_existing_code TEXT;
    v_active_operational_count INTEGER;
BEGIN
    v_tenant_id := private.current_tenant_id();
    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'tenant context missing from session';
    END IF;

    IF NOT private.user_can_manage_tenant_locations() THEN
        RAISE EXCEPTION 'administrative privileges required to manage locations';
    END IF;

    v_governance := private.get_location_governance_config(v_tenant_id);
    v_multi_location := COALESCE((v_governance ->> 'multi_location_enabled')::boolean, TRUE);
    v_regional_hqs := COALESCE((v_governance ->> 'regional_hqs_enabled')::boolean, FALSE);
    v_central_hq := NULLIF(v_governance ->> 'central_hq_location_id', '')::uuid;

    v_trimmed_name := btrim(p_name);
    IF v_trimmed_name IS NULL OR v_trimmed_name = '' THEN
        RAISE EXCEPTION 'location name is required';
    END IF;

    v_normalized_code := upper(btrim(p_code));
    IF v_normalized_code IS NULL OR v_normalized_code = '' THEN
        RAISE EXCEPTION 'location code is required';
    END IF;

    IF private.is_system_tenant_location(v_normalized_code) THEN
        RAISE EXCEPTION 'system location codes are reserved';
    END IF;

    IF p_address_line1 IS NULL OR btrim(p_address_line1) = '' THEN
        RAISE EXCEPTION 'address line 1 is required';
    END IF;

    IF p_city IS NULL OR btrim(p_city) = '' THEN
        RAISE EXCEPTION 'city is required';
    END IF;

    IF p_state IS NULL OR btrim(p_state) = '' THEN
        RAISE EXCEPTION 'state is required';
    END IF;

    IF p_zip_postal IS NULL OR btrim(p_zip_postal) = '' THEN
        RAISE EXCEPTION 'postal code is required';
    END IF;

    IF p_country_code IS NULL OR btrim(p_country_code) = '' THEN
        RAISE EXCEPTION 'country code is required';
    END IF;

    IF p_location_id IS NOT NULL THEN
        SELECT code
        INTO v_existing_code
        FROM public.tenant_locations
        WHERE id = p_location_id
          AND tenant_id = v_tenant_id;

        IF v_existing_code IS NULL THEN
            RAISE EXCEPTION 'location not found for tenant';
        END IF;

        IF private.is_system_tenant_location(v_existing_code) THEN
            RAISE EXCEPTION 'system locations cannot be modified';
        END IF;
    ELSE
        IF NOT v_multi_location THEN
            SELECT COUNT(*)
            INTO v_active_operational_count
            FROM public.tenant_locations
            WHERE tenant_id = v_tenant_id
              AND is_active = TRUE
              AND NOT private.is_system_tenant_location(code);

            IF v_active_operational_count > 0 THEN
                RAISE EXCEPTION 'multi-location is disabled; only one operational location is permitted';
            END IF;
        END IF;
    END IF;

    IF NOT v_regional_hqs THEN
        IF p_parent_location_id IS NOT NULL THEN
            RAISE EXCEPTION 'regional hierarchy is disabled; parent location must be empty';
        END IF;

        IF p_location_type = 'REGIONAL_HQ'::public.location_operational_type THEN
            RAISE EXCEPTION 'regional HQ type requires regional HQs to be enabled in organization settings';
        END IF;
    ELSE
        IF p_parent_location_id IS NOT NULL THEN
            IF NOT EXISTS (
                SELECT 1
                FROM public.tenant_locations
                WHERE id = p_parent_location_id
                  AND tenant_id = v_tenant_id
                  AND is_active = TRUE
                  AND NOT private.is_system_tenant_location(code)
            ) THEN
                RAISE EXCEPTION 'parent location not found for tenant';
            END IF;
        END IF;
    END IF;

    IF p_location_id IS NULL THEN
        INSERT INTO public.tenant_locations (
            tenant_id,
            parent_location_id,
            name,
            code,
            location_type,
            address_line1,
            address_line2,
            city,
            state,
            zip_postal,
            country_code,
            manager_name,
            contact_email,
            contact_phone,
            is_stock_holding,
            location_tax_identifier,
            tax_registered_name,
            location_meta,
            is_active
        )
        VALUES (
            v_tenant_id,
            CASE WHEN v_regional_hqs THEN p_parent_location_id ELSE NULL END,
            v_trimmed_name,
            v_normalized_code,
            p_location_type,
            btrim(p_address_line1),
            NULLIF(btrim(p_address_line2), ''),
            btrim(p_city),
            btrim(p_state),
            btrim(p_zip_postal),
            upper(btrim(p_country_code)),
            NULLIF(btrim(p_manager_name), ''),
            NULLIF(btrim(p_contact_email), ''),
            NULLIF(btrim(p_contact_phone), ''),
            COALESCE(p_is_stock_holding, TRUE),
            NULLIF(btrim(p_location_tax_identifier), ''),
            NULLIF(btrim(p_tax_registered_name), ''),
            COALESCE(p_location_meta, '{}'::jsonb),
            TRUE
        )
        RETURNING id INTO v_location_id;
    ELSE
        UPDATE public.tenant_locations
        SET
            parent_location_id = CASE WHEN v_regional_hqs THEN p_parent_location_id ELSE NULL END,
            name = v_trimmed_name,
            code = v_normalized_code,
            location_type = p_location_type,
            address_line1 = btrim(p_address_line1),
            address_line2 = NULLIF(btrim(p_address_line2), ''),
            city = btrim(p_city),
            state = btrim(p_state),
            zip_postal = btrim(p_zip_postal),
            country_code = upper(btrim(p_country_code)),
            manager_name = NULLIF(btrim(p_manager_name), ''),
            contact_email = NULLIF(btrim(p_contact_email), ''),
            contact_phone = NULLIF(btrim(p_contact_phone), ''),
            is_stock_holding = COALESCE(p_is_stock_holding, is_stock_holding),
            location_tax_identifier = NULLIF(btrim(p_location_tax_identifier), ''),
            tax_registered_name = NULLIF(btrim(p_tax_registered_name), ''),
            location_meta = COALESCE(p_location_meta, location_meta),
            updated_at = NOW()
        WHERE id = p_location_id
          AND tenant_id = v_tenant_id
        RETURNING id INTO v_location_id;
    END IF;

    IF v_central_hq = v_location_id
       AND p_location_type IS DISTINCT FROM 'HEAD_OFFICE'::public.location_operational_type THEN
        RAISE EXCEPTION 'central HQ location must remain a headquarters type';
    END IF;

    RETURN v_location_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.save_tenant_location(
    p_name TEXT,
    p_code TEXT,
    p_location_type public.location_operational_type DEFAULT 'WAREHOUSE',
    p_location_id UUID DEFAULT NULL,
    p_parent_location_id UUID DEFAULT NULL,
    p_address_line1 TEXT DEFAULT NULL,
    p_address_line2 TEXT DEFAULT NULL,
    p_city TEXT DEFAULT NULL,
    p_state TEXT DEFAULT NULL,
    p_zip_postal TEXT DEFAULT NULL,
    p_country_code TEXT DEFAULT NULL,
    p_manager_name TEXT DEFAULT NULL,
    p_contact_email TEXT DEFAULT NULL,
    p_contact_phone TEXT DEFAULT NULL,
    p_is_stock_holding BOOLEAN DEFAULT NULL,
    p_location_tax_identifier TEXT DEFAULT NULL,
    p_tax_registered_name TEXT DEFAULT NULL,
    p_location_meta JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
BEGIN
    RETURN private.save_tenant_location_core(
        p_location_id,
        p_name,
        p_code,
        p_location_type,
        p_parent_location_id,
        p_address_line1,
        p_address_line2,
        p_city,
        p_state,
        p_zip_postal,
        p_country_code,
        p_manager_name,
        p_contact_email,
        p_contact_phone,
        p_is_stock_holding,
        p_location_tax_identifier,
        p_tax_registered_name,
        p_location_meta
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.deactivate_tenant_location(p_location_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_tenant_id UUID;
    v_code TEXT;
    v_governance JSONB;
    v_central_hq UUID;
    v_on_hand NUMERIC(15, 4);
BEGIN
    v_tenant_id := private.current_tenant_id();
    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'tenant context missing from session';
    END IF;

    IF NOT private.user_can_manage_tenant_locations() THEN
        RAISE EXCEPTION 'administrative privileges required to manage locations';
    END IF;

    SELECT code
    INTO v_code
    FROM public.tenant_locations
    WHERE id = p_location_id
      AND tenant_id = v_tenant_id
      AND is_active = TRUE;

    IF v_code IS NULL THEN
        RAISE EXCEPTION 'active location not found for tenant';
    END IF;

    IF private.is_system_tenant_location(v_code) THEN
        RAISE EXCEPTION 'system locations cannot be deactivated';
    END IF;

    v_governance := private.get_location_governance_config(v_tenant_id);
    v_central_hq := NULLIF(v_governance ->> 'central_hq_location_id', '')::uuid;

    IF v_central_hq = p_location_id THEN
        RAISE EXCEPTION 'cannot deactivate the central HQ location; reassign central HQ first';
    END IF;

    SELECT COALESCE(SUM(current_quantity_on_hand), 0)
    INTO v_on_hand
    FROM public.item_valuations
    WHERE tenant_id = v_tenant_id
      AND location_id = p_location_id;

    IF v_on_hand > 0 THEN
        RAISE EXCEPTION 'cannot deactivate location with on-hand inventory';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.stock_transfers
        WHERE tenant_id = v_tenant_id
          AND current_status NOT IN ('FULLY_COMPLETED', 'CANCELLED')
          AND (source_location_id = p_location_id OR destination_location_id = p_location_id)
    ) THEN
        RAISE EXCEPTION 'cannot deactivate location with open stock transfers';
    END IF;

    UPDATE public.tenant_locations
    SET is_active = FALSE, updated_at = NOW()
    WHERE id = p_location_id
      AND tenant_id = v_tenant_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.reactivate_tenant_location(p_location_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_tenant_id UUID;
    v_governance JSONB;
    v_multi_location BOOLEAN;
BEGIN
    v_tenant_id := private.current_tenant_id();
    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'tenant context missing from session';
    END IF;

    IF NOT private.user_can_manage_tenant_locations() THEN
        RAISE EXCEPTION 'administrative privileges required to manage locations';
    END IF;

    v_governance := private.get_location_governance_config(v_tenant_id);
    v_multi_location := COALESCE((v_governance ->> 'multi_location_enabled')::boolean, TRUE);

    IF NOT v_multi_location THEN
        IF EXISTS (
            SELECT 1
            FROM public.tenant_locations
            WHERE tenant_id = v_tenant_id
              AND is_active = TRUE
              AND NOT private.is_system_tenant_location(code)
              AND id <> p_location_id
        ) THEN
            RAISE EXCEPTION 'multi-location is disabled; deactivate the active location before reactivating another';
        END IF;
    END IF;

    UPDATE public.tenant_locations
    SET is_active = TRUE, updated_at = NOW()
    WHERE id = p_location_id
      AND tenant_id = v_tenant_id
      AND NOT private.is_system_tenant_location(code);

    IF NOT FOUND THEN
        RAISE EXCEPTION 'location not found for tenant';
    END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.save_tenant_location(
    TEXT, TEXT, public.location_operational_type, UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, TEXT, TEXT, JSONB
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.save_tenant_location(
    TEXT, TEXT, public.location_operational_type, UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, TEXT, TEXT, JSONB
) TO authenticated;

REVOKE ALL ON FUNCTION public.deactivate_tenant_location(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.deactivate_tenant_location(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.reactivate_tenant_location(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reactivate_tenant_location(UUID) TO authenticated;

-- ====================================================================
-- AIB SMART ERP - VIRTUAL LOCATION CONFIGURATION VALIDATION
-- Migration: 20260531700000_virtual_location_configuration_validation.sql
-- ====================================================================
-- Validates per-location virtual DOM / API integration settings stored
-- under location_meta.configuration_metadata.virtual before save.
-- ====================================================================

CREATE OR REPLACE FUNCTION private.validate_virtual_location_configuration(
    p_presence_type public.presence_environment,
    p_location_meta JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_tenant_id UUID;
    v_virtual JSONB;
    v_mode TEXT;
    v_buffer NUMERIC;
    v_url TEXT;
    v_account_id UUID;
    v_allowed_modes TEXT[] := ARRAY[
        'NEAREST_BY_POSTAL_CODE',
        'CENTRAL_FALLBACK_ENFORCED',
        'SPLIT_ORDER_PERMITTED'
    ];
BEGIN
    IF p_presence_type IS DISTINCT FROM 'VIRTUAL'::public.presence_environment THEN
        RETURN;
    END IF;

    v_tenant_id := private.current_tenant_id();
    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'tenant context missing from session';
    END IF;

    v_virtual := COALESCE(p_location_meta, '{}'::jsonb)
        -> 'configuration_metadata'
        -> 'virtual';

    IF v_virtual IS NULL OR v_virtual = 'null'::jsonb THEN
        RETURN;
    END IF;

    v_mode := v_virtual ->> 'fulfillment_assignment_mode';
    IF v_mode IS NULL OR NOT (v_mode = ANY (v_allowed_modes)) THEN
        RAISE EXCEPTION 'invalid virtual fulfillment assignment mode';
    END IF;

    BEGIN
        v_buffer := (v_virtual ->> 'digital_safety_stock_buffer')::numeric;
    EXCEPTION
        WHEN OTHERS THEN
            RAISE EXCEPTION 'digital safety stock buffer must be a non-negative integer';
    END;

    IF v_buffer IS NULL OR v_buffer <> trunc(v_buffer) OR v_buffer < 0 THEN
        RAISE EXCEPTION 'digital safety stock buffer must be a non-negative integer';
    END IF;

    v_url := NULLIF(btrim(v_virtual ->> 'channel_webhook_sync_url'), '');
    IF v_url IS NOT NULL AND v_url !~* '^https?://[^\s]+$' THEN
        RAISE EXCEPTION 'channel webhook sync URL must be a valid http or https URL';
    END IF;

    IF v_virtual ? 'default_revenue_clearing_account_id'
       AND v_virtual ->> 'default_revenue_clearing_account_id' IS NOT NULL
       AND btrim(v_virtual ->> 'default_revenue_clearing_account_id') <> '' THEN
        BEGIN
            v_account_id := (v_virtual ->> 'default_revenue_clearing_account_id')::uuid;
        EXCEPTION
            WHEN OTHERS THEN
                RAISE EXCEPTION 'default revenue clearing account id must be a valid UUID';
        END;

        IF NOT EXISTS (
            SELECT 1
            FROM public.accounts
            WHERE id = v_account_id
              AND tenant_id = v_tenant_id
              AND is_active = TRUE
              AND classification = 'REVENUE'::account_type_class
        ) THEN
            RAISE EXCEPTION 'default revenue clearing account not found for tenant';
        END IF;
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION private.save_tenant_location_core(
    p_location_id UUID,
    p_name TEXT,
    p_code TEXT,
    p_presence_type public.presence_environment,
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
    p_is_administrative_office BOOLEAN,
    p_is_commercial_storefront BOOLEAN,
    p_is_manufacturing_floor BOOLEAN,
    p_is_stock_holding BOOLEAN,
    p_pos_terminal_count INT,
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
    v_depth INTEGER;
    v_resolved_presence public.presence_environment;
    v_resolved_admin BOOLEAN;
    v_resolved_storefront BOOLEAN;
    v_resolved_manufacturing BOOLEAN;
    v_resolved_stock BOOLEAN;
    v_resolved_pos INT;
    v_existing_meta JSONB;
    v_effective_meta JSONB;
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

    v_resolved_presence := COALESCE(p_presence_type, 'PHYSICAL'::public.presence_environment);
    v_resolved_admin := COALESCE(p_is_administrative_office, FALSE);
    v_resolved_storefront := COALESCE(p_is_commercial_storefront, FALSE);
    v_resolved_manufacturing := COALESCE(p_is_manufacturing_floor, FALSE);
    v_resolved_stock := COALESCE(p_is_stock_holding, FALSE);
    v_resolved_pos := COALESCE(p_pos_terminal_count, 0);

    IF v_resolved_pos < 0 THEN
        RAISE EXCEPTION 'pos terminal count cannot be negative';
    END IF;

    IF v_resolved_presence = 'VIRTUAL'::public.presence_environment AND v_resolved_stock THEN
        RAISE EXCEPTION 'virtual locations cannot be stock-holding locations';
    END IF;

    IF v_resolved_presence = 'VIRTUAL'::public.presence_environment AND v_resolved_manufacturing THEN
        RAISE EXCEPTION 'virtual locations cannot be manufacturing floors';
    END IF;

    IF NOT v_resolved_storefront AND v_resolved_pos <> 0 THEN
        RAISE EXCEPTION 'pos terminal count must be zero when location is not a commercial storefront';
    END IF;

    IF p_location_id IS NOT NULL THEN
        SELECT code, location_meta
        INTO v_existing_code, v_existing_meta
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
        v_existing_meta := NULL;

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

            WITH RECURSIVE ancestors AS (
                SELECT id, parent_location_id, 1 AS depth
                FROM public.tenant_locations
                WHERE id = p_parent_location_id
                  AND tenant_id = v_tenant_id
                UNION ALL
                SELECT tl.id, tl.parent_location_id, ancestors.depth + 1
                FROM public.tenant_locations tl
                INNER JOIN ancestors ON tl.id = ancestors.parent_location_id
                WHERE tl.tenant_id = v_tenant_id
                  AND ancestors.depth < 6
            )
            SELECT MAX(depth)
            INTO v_depth
            FROM ancestors;

            IF COALESCE(v_depth, 0) >= 5 THEN
                RAISE EXCEPTION 'location hierarchy cannot exceed five tiers';
            END IF;
        END IF;
    END IF;

    v_effective_meta := COALESCE(p_location_meta, COALESCE(v_existing_meta, '{}'::jsonb));

    PERFORM private.validate_virtual_location_configuration(
        v_resolved_presence,
        v_effective_meta
    );

    IF p_location_id IS NULL THEN
        INSERT INTO public.tenant_locations (
            tenant_id,
            parent_location_id,
            name,
            code,
            presence_type,
            is_administrative_office,
            is_commercial_storefront,
            is_manufacturing_floor,
            is_stock_holding,
            pos_terminal_count,
            address_line1,
            address_line2,
            city,
            state,
            zip_postal,
            country_code,
            manager_name,
            contact_email,
            contact_phone,
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
            v_resolved_presence,
            v_resolved_admin,
            v_resolved_storefront,
            v_resolved_manufacturing,
            v_resolved_stock,
            v_resolved_pos,
            btrim(p_address_line1),
            NULLIF(btrim(p_address_line2), ''),
            btrim(p_city),
            btrim(p_state),
            btrim(p_zip_postal),
            upper(btrim(p_country_code)),
            NULLIF(btrim(p_manager_name), ''),
            NULLIF(btrim(p_contact_email), ''),
            NULLIF(btrim(p_contact_phone), ''),
            NULLIF(btrim(p_location_tax_identifier), ''),
            NULLIF(btrim(p_tax_registered_name), ''),
            v_effective_meta,
            TRUE
        )
        RETURNING id INTO v_location_id;
    ELSE
        UPDATE public.tenant_locations
        SET
            parent_location_id = CASE WHEN v_regional_hqs THEN p_parent_location_id ELSE NULL END,
            name = v_trimmed_name,
            code = v_normalized_code,
            presence_type = v_resolved_presence,
            is_administrative_office = v_resolved_admin,
            is_commercial_storefront = v_resolved_storefront,
            is_manufacturing_floor = v_resolved_manufacturing,
            is_stock_holding = v_resolved_stock,
            pos_terminal_count = v_resolved_pos,
            address_line1 = btrim(p_address_line1),
            address_line2 = NULLIF(btrim(p_address_line2), ''),
            city = btrim(p_city),
            state = btrim(p_state),
            zip_postal = btrim(p_zip_postal),
            country_code = upper(btrim(p_country_code)),
            manager_name = NULLIF(btrim(p_manager_name), ''),
            contact_email = NULLIF(btrim(p_contact_email), ''),
            contact_phone = NULLIF(btrim(p_contact_phone), ''),
            location_tax_identifier = NULLIF(btrim(p_location_tax_identifier), ''),
            tax_registered_name = NULLIF(btrim(p_tax_registered_name), ''),
            location_meta = v_effective_meta,
            updated_at = NOW()
        WHERE id = p_location_id
          AND tenant_id = v_tenant_id
        RETURNING id INTO v_location_id;
    END IF;

    IF v_central_hq = v_location_id AND NOT v_resolved_admin THEN
        RAISE EXCEPTION 'central HQ location must remain an administrative office';
    END IF;

    RETURN v_location_id;
END;
$$;

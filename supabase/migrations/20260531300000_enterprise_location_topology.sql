-- ====================================================================
-- AIB SMART ERP - ENTERPRISE LOCATION TOPOLOGY & DOM ROUTING
-- Migration: 20260531300000_enterprise_location_topology.sql
-- ====================================================================

-- Drop RPCs that pin the legacy enum before replacing the type.
DROP FUNCTION IF EXISTS public.save_tenant_location(
    TEXT,
    TEXT,
    public.location_operational_type,
    UUID,
    UUID,
    TEXT,
    TEXT,
    TEXT,
    TEXT,
    TEXT,
    TEXT,
    TEXT,
    TEXT,
    TEXT,
    BOOLEAN,
    TEXT,
    TEXT,
    JSONB
);

DROP FUNCTION IF EXISTS private.save_tenant_location_core(
    UUID,
    TEXT,
    TEXT,
    public.location_operational_type,
    UUID,
    TEXT,
    TEXT,
    TEXT,
    TEXT,
    TEXT,
    TEXT,
    TEXT,
    TEXT,
    TEXT,
    BOOLEAN,
    TEXT,
    TEXT,
    JSONB
);

CREATE TYPE public.location_operational_type_extended AS ENUM (
    'HEAD_OFFICE',
    'REGIONAL_HQ',
    'WAREHOUSE',
    'MANUFACTURING_PLANT',
    'RETAIL_OUTLET',
    'GLOBAL_HQ',
    'SUBCONTINENTAL_HQ',
    'COUNTRY_HQ',
    'REGIONAL_ZONE',
    'STATE_HQ',
    'STORAGE_WAREHOUSE',
    'OFFICE_BRANCH',
    'VIRTUAL_STOREFRONT'
);

ALTER TABLE public.tenant_locations
    ALTER COLUMN location_type DROP DEFAULT;

ALTER TABLE public.tenant_locations
    ALTER COLUMN location_type TYPE public.location_operational_type_extended
    USING location_type::text::public.location_operational_type_extended;

DROP TYPE public.location_operational_type;

ALTER TYPE public.location_operational_type_extended
    RENAME TO location_operational_type;

ALTER TABLE public.tenant_locations
    ALTER COLUMN location_type SET DEFAULT 'STORAGE_WAREHOUSE';

UPDATE public.tenant_locations tl
SET location_type = 'COUNTRY_HQ'::public.location_operational_type
FROM public.tenants t
WHERE tl.tenant_id = t.id
  AND tl.id = NULLIF(t.location_governance_config ->> 'central_hq_location_id', '')::uuid
  AND tl.location_type = 'HEAD_OFFICE'::public.location_operational_type;

UPDATE public.tenant_locations
SET location_type = 'GLOBAL_HQ'::public.location_operational_type
WHERE location_type = 'HEAD_OFFICE'::public.location_operational_type;

UPDATE public.tenant_locations
SET location_type = 'REGIONAL_ZONE'::public.location_operational_type
WHERE location_type = 'REGIONAL_HQ'::public.location_operational_type;

UPDATE public.tenant_locations
SET location_type = 'STORAGE_WAREHOUSE'::public.location_operational_type,
    location_meta = COALESCE(location_meta, '{}'::jsonb)
        || jsonb_build_object('legacy_type', 'MANUFACTURING_PLANT')
WHERE location_type = 'MANUFACTURING_PLANT'::public.location_operational_type;

UPDATE public.tenant_locations
SET location_type = 'STORAGE_WAREHOUSE'::public.location_operational_type
WHERE location_type = 'WAREHOUSE'::public.location_operational_type;

UPDATE public.tenant_locations
SET location_type = 'OFFICE_BRANCH'::public.location_operational_type
WHERE location_type = 'RETAIL_OUTLET'::public.location_operational_type;

UPDATE public.tenant_locations
SET is_stock_holding = FALSE
WHERE location_type IN (
    'GLOBAL_HQ'::public.location_operational_type,
    'SUBCONTINENTAL_HQ'::public.location_operational_type,
    'COUNTRY_HQ'::public.location_operational_type,
    'REGIONAL_ZONE'::public.location_operational_type,
    'STATE_HQ'::public.location_operational_type,
    'OFFICE_BRANCH'::public.location_operational_type,
    'VIRTUAL_STOREFRONT'::public.location_operational_type
);

CREATE OR REPLACE FUNCTION private.default_stock_holding_for_location_type(
    p_location_type public.location_operational_type
)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT p_location_type IN (
        'STORAGE_WAREHOUSE'::public.location_operational_type,
        'WAREHOUSE'::public.location_operational_type,
        'MANUFACTURING_PLANT'::public.location_operational_type
    );
$$;

CREATE OR REPLACE FUNCTION private.validate_location_hierarchy_pair(
    p_parent_type public.location_operational_type,
    p_child_type public.location_operational_type
)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT CASE
        WHEN p_child_type = 'GLOBAL_HQ'::public.location_operational_type THEN FALSE
        WHEN p_child_type = 'SUBCONTINENTAL_HQ'::public.location_operational_type
            THEN p_parent_type = 'GLOBAL_HQ'::public.location_operational_type
        WHEN p_child_type = 'COUNTRY_HQ'::public.location_operational_type
            THEN p_parent_type IN (
                'GLOBAL_HQ'::public.location_operational_type,
                'SUBCONTINENTAL_HQ'::public.location_operational_type
            )
        WHEN p_child_type = 'REGIONAL_ZONE'::public.location_operational_type
            THEN p_parent_type = 'COUNTRY_HQ'::public.location_operational_type
        WHEN p_child_type IN (
            'STATE_HQ'::public.location_operational_type,
            'STORAGE_WAREHOUSE'::public.location_operational_type,
            'OFFICE_BRANCH'::public.location_operational_type
        ) THEN p_parent_type IN (
            'REGIONAL_ZONE'::public.location_operational_type,
            'STATE_HQ'::public.location_operational_type
        )
        WHEN p_child_type = 'VIRTUAL_STOREFRONT'::public.location_operational_type
            THEN p_parent_type IN (
                'COUNTRY_HQ'::public.location_operational_type,
                'REGIONAL_ZONE'::public.location_operational_type
            )
        ELSE FALSE
    END;
$$;

CREATE OR REPLACE FUNCTION private.validate_dom_routing_patch(p_patch JSONB)
RETURNS VOID
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    v_dom JSONB;
    v_strategy TEXT;
    v_threshold INTEGER;
    v_fallback UUID;
BEGIN
    IF p_patch IS NULL OR NOT (p_patch ? 'dom_routing') THEN
        RETURN;
    END IF;

    v_dom := p_patch -> 'dom_routing';
    IF v_dom IS NULL OR jsonb_typeof(v_dom) IS DISTINCT FROM 'object' THEN
        RAISE EXCEPTION 'dom_routing must be a JSON object';
    END IF;

    v_strategy := upper(btrim(COALESCE(v_dom ->> 'primary_fulfillment_strategy', '')));
    IF v_strategy <> ''
       AND v_strategy NOT IN ('NEAREST_BRANCH_ZIP', 'CENTRAL_FALLBACK_CDC') THEN
        RAISE EXCEPTION 'invalid primary fulfillment strategy';
    END IF;

    IF v_dom ? 'local_branch_safety_threshold' THEN
        v_threshold := (v_dom ->> 'local_branch_safety_threshold')::INTEGER;
        IF v_threshold IS NULL OR v_threshold < 0 THEN
            RAISE EXCEPTION 'local branch safety threshold must be a non-negative integer';
        END IF;
    END IF;

    IF v_dom ? 'central_fallback_location_id'
       AND v_dom ->> 'central_fallback_location_id' IS NOT NULL
       AND btrim(v_dom ->> 'central_fallback_location_id') <> '' THEN
        BEGIN
            v_fallback := (v_dom ->> 'central_fallback_location_id')::uuid;
        EXCEPTION
            WHEN others THEN
                RAISE EXCEPTION 'central fallback location id must be a valid UUID';
        END;
    END IF;
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

    PERFORM private.validate_dom_routing_patch(p_location_governance_config_patch);

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
    v_parent_type public.location_operational_type;
    v_resolved_stock_holding BOOLEAN;
    v_depth INTEGER;
    v_global_hq_count INTEGER;
    v_hq_types public.location_operational_type[] := ARRAY[
        'GLOBAL_HQ'::public.location_operational_type,
        'SUBCONTINENTAL_HQ'::public.location_operational_type,
        'COUNTRY_HQ'::public.location_operational_type,
        'HEAD_OFFICE'::public.location_operational_type,
        'REGIONAL_HQ'::public.location_operational_type,
        'REGIONAL_ZONE'::public.location_operational_type,
        'STATE_HQ'::public.location_operational_type
    ];
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

    v_resolved_stock_holding := COALESCE(
        p_is_stock_holding,
        private.default_stock_holding_for_location_type(p_location_type)
    );

    IF p_location_type IN (
        'OFFICE_BRANCH'::public.location_operational_type,
        'VIRTUAL_STOREFRONT'::public.location_operational_type
    ) AND v_resolved_stock_holding THEN
        RAISE EXCEPTION 'office branches and virtual storefronts cannot be stock-holding locations';
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

    IF p_location_type = 'GLOBAL_HQ'::public.location_operational_type THEN
        SELECT COUNT(*)
        INTO v_global_hq_count
        FROM public.tenant_locations
        WHERE tenant_id = v_tenant_id
          AND location_type = 'GLOBAL_HQ'::public.location_operational_type
          AND is_active = TRUE
          AND (p_location_id IS NULL OR id <> p_location_id);

        IF v_global_hq_count > 0 THEN
            RAISE EXCEPTION 'only one active Global HQ is permitted per tenant';
        END IF;

        IF p_parent_location_id IS NOT NULL THEN
            RAISE EXCEPTION 'Global HQ cannot have a parent location';
        END IF;
    ELSIF NOT v_regional_hqs THEN
        IF p_parent_location_id IS NOT NULL THEN
            RAISE EXCEPTION 'regional hierarchy is disabled; parent location must be empty';
        END IF;
    ELSE
        IF p_parent_location_id IS NULL
           AND p_location_type <> 'GLOBAL_HQ'::public.location_operational_type THEN
            RAISE EXCEPTION 'parent location is required for enterprise hierarchy nodes';
        END IF;

        IF p_parent_location_id IS NOT NULL THEN
            SELECT location_type
            INTO v_parent_type
            FROM public.tenant_locations
            WHERE id = p_parent_location_id
              AND tenant_id = v_tenant_id
              AND is_active = TRUE
              AND NOT private.is_system_tenant_location(code);

            IF v_parent_type IS NULL THEN
                RAISE EXCEPTION 'parent location not found for tenant';
            END IF;

            IF NOT private.validate_location_hierarchy_pair(v_parent_type, p_location_type) THEN
                RAISE EXCEPTION 'invalid parent and location type combination';
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
            v_resolved_stock_holding,
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
            is_stock_holding = v_resolved_stock_holding,
            location_tax_identifier = NULLIF(btrim(p_location_tax_identifier), ''),
            tax_registered_name = NULLIF(btrim(p_tax_registered_name), ''),
            location_meta = COALESCE(p_location_meta, location_meta),
            updated_at = NOW()
        WHERE id = p_location_id
          AND tenant_id = v_tenant_id
        RETURNING id INTO v_location_id;
    END IF;

    IF v_central_hq = v_location_id
       AND NOT (p_location_type = ANY(v_hq_types)) THEN
        RAISE EXCEPTION 'central HQ location must remain a headquarters type';
    END IF;

    RETURN v_location_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.save_tenant_location(
    p_name TEXT,
    p_code TEXT,
    p_location_type public.location_operational_type DEFAULT 'STORAGE_WAREHOUSE',
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

CREATE OR REPLACE FUNCTION public.get_tenant_location_topology()
RETURNS TABLE (
    id UUID,
    parent_location_id UUID,
    name TEXT,
    code TEXT,
    location_type public.location_operational_type,
    is_stock_holding BOOLEAN,
    is_active BOOLEAN,
    address_line1 TEXT,
    address_line2 TEXT,
    city TEXT,
    state TEXT,
    zip_postal VARCHAR(20),
    country_code VARCHAR(2),
    manager_name TEXT,
    contact_email TEXT,
    contact_phone VARCHAR(30),
    depth INTEGER,
    path UUID[],
    child_count BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
    WITH RECURSIVE tree AS (
        SELECT
            tl.id,
            tl.parent_location_id,
            tl.name,
            tl.code,
            tl.location_type,
            tl.is_stock_holding,
            tl.is_active,
            tl.address_line1,
            tl.address_line2,
            tl.city,
            tl.state,
            tl.zip_postal,
            tl.country_code,
            tl.manager_name,
            tl.contact_email,
            tl.contact_phone,
            0 AS depth,
            ARRAY[tl.id] AS path
        FROM public.tenant_locations tl
        WHERE tl.tenant_id = private.current_tenant_id()
          AND NOT private.is_system_tenant_location(tl.code)
          AND (
              tl.location_type = 'GLOBAL_HQ'::public.location_operational_type
              OR (
                  tl.parent_location_id IS NULL
                  AND NOT EXISTS (
                      SELECT 1
                      FROM public.tenant_locations root
                      WHERE root.tenant_id = tl.tenant_id
                        AND root.location_type = 'GLOBAL_HQ'::public.location_operational_type
                        AND NOT private.is_system_tenant_location(root.code)
                  )
              )
          )
        UNION ALL
        SELECT
            child.id,
            child.parent_location_id,
            child.name,
            child.code,
            child.location_type,
            child.is_stock_holding,
            child.is_active,
            child.address_line1,
            child.address_line2,
            child.city,
            child.state,
            child.zip_postal,
            child.country_code,
            child.manager_name,
            child.contact_email,
            child.contact_phone,
            tree.depth + 1,
            tree.path || child.id
        FROM public.tenant_locations child
        INNER JOIN tree ON child.parent_location_id = tree.id
        WHERE child.tenant_id = private.current_tenant_id()
          AND NOT private.is_system_tenant_location(child.code)
          AND tree.depth < 5
    ),
    counted AS (
        SELECT
            tree.*,
            (
                SELECT COUNT(*)
                FROM public.tenant_locations c
                WHERE c.tenant_id = private.current_tenant_id()
                  AND c.parent_location_id = tree.id
                  AND NOT private.is_system_tenant_location(c.code)
            ) AS child_count
        FROM tree
    )
    SELECT
        counted.id,
        counted.parent_location_id,
        counted.name,
        counted.code,
        counted.location_type,
        counted.is_stock_holding,
        counted.is_active,
        counted.address_line1,
        counted.address_line2,
        counted.city,
        counted.state,
        counted.zip_postal,
        counted.country_code,
        counted.manager_name,
        counted.contact_email,
        counted.contact_phone,
        counted.depth,
        counted.path,
        counted.child_count
    FROM counted
    ORDER BY counted.path;
$$;

REVOKE ALL ON FUNCTION public.save_tenant_location(
    TEXT, TEXT, public.location_operational_type, UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, TEXT, TEXT, JSONB
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.save_tenant_location(
    TEXT, TEXT, public.location_operational_type, UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, TEXT, TEXT, JSONB
) TO authenticated;

REVOKE ALL ON FUNCTION public.get_tenant_location_topology() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_tenant_location_topology() TO authenticated;

COMMENT ON FUNCTION public.get_tenant_location_topology IS
    'Returns tenant-scoped location hierarchy rows ordered by materialized path.';

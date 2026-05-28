-- ====================================================================
-- AIB SMART ERP - 4-AXIS LOCATION MANAGEMENT (MANUFACTURING FLOOR)
-- Migration: 20260531500000_tenant_locations_manufacturing_floor_axis.sql
-- ====================================================================
-- Extends the 3-axis model already deployed on sandbox with Axis 4:
--   is_manufacturing_floor — WIP tracking, work centers, production routines
-- Idempotent for environments that already received the updated 31400000 file.
-- ====================================================================

ALTER TABLE public.tenant_locations
    ADD COLUMN IF NOT EXISTS is_manufacturing_floor BOOLEAN NOT NULL DEFAULT FALSE;

-- Backfill manufacturing plants preserved in location_meta audit trail
UPDATE public.tenant_locations
SET
    is_manufacturing_floor = TRUE,
    is_stock_holding = TRUE
WHERE COALESCE(location_meta, '{}'::jsonb) ->> 'legacy_location_type' = 'MANUFACTURING_PLANT'
  AND is_manufacturing_floor = FALSE;

CREATE INDEX IF NOT EXISTS tenant_locations_manufacturing_floor_idx
    ON public.tenant_locations (tenant_id, is_manufacturing_floor)
    WHERE is_manufacturing_floor;

-- Drop 3-axis RPC signatures before recreating with manufacturing parameter
DROP FUNCTION IF EXISTS public.get_tenant_location_topology();

DROP FUNCTION IF EXISTS public.save_tenant_location(
    TEXT,
    TEXT,
    public.presence_environment,
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
    BOOLEAN,
    BOOLEAN,
    INT,
    TEXT,
    TEXT,
    JSONB
);

DROP FUNCTION IF EXISTS private.save_tenant_location_core(
    UUID,
    TEXT,
    TEXT,
    public.presence_environment,
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
    BOOLEAN,
    BOOLEAN,
    INT,
    TEXT,
    TEXT,
    JSONB
);

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
            location_meta = COALESCE(p_location_meta, location_meta),
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

CREATE OR REPLACE FUNCTION public.save_tenant_location(
    p_name TEXT,
    p_code TEXT,
    p_presence_type public.presence_environment DEFAULT 'PHYSICAL',
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
    p_is_administrative_office BOOLEAN DEFAULT FALSE,
    p_is_commercial_storefront BOOLEAN DEFAULT FALSE,
    p_is_manufacturing_floor BOOLEAN DEFAULT FALSE,
    p_is_stock_holding BOOLEAN DEFAULT FALSE,
    p_pos_terminal_count INT DEFAULT 0,
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
        p_presence_type,
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
        p_is_administrative_office,
        p_is_commercial_storefront,
        p_is_manufacturing_floor,
        p_is_stock_holding,
        p_pos_terminal_count,
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
    presence_type public.presence_environment,
    is_administrative_office BOOLEAN,
    is_commercial_storefront BOOLEAN,
    is_manufacturing_floor BOOLEAN,
    is_stock_holding BOOLEAN,
    pos_terminal_count INT,
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
            tl.presence_type,
            tl.is_administrative_office,
            tl.is_commercial_storefront,
            tl.is_manufacturing_floor,
            tl.is_stock_holding,
            tl.pos_terminal_count,
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
          AND tl.parent_location_id IS NULL
        UNION ALL
        SELECT
            child.id,
            child.parent_location_id,
            child.name,
            child.code,
            child.presence_type,
            child.is_administrative_office,
            child.is_commercial_storefront,
            child.is_manufacturing_floor,
            child.is_stock_holding,
            child.pos_terminal_count,
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
        counted.presence_type,
        counted.is_administrative_office,
        counted.is_commercial_storefront,
        counted.is_manufacturing_floor,
        counted.is_stock_holding,
        counted.pos_terminal_count,
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
    TEXT,
    TEXT,
    public.presence_environment,
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
    BOOLEAN,
    BOOLEAN,
    BOOLEAN,
    INT,
    TEXT,
    TEXT,
    JSONB
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.save_tenant_location(
    TEXT,
    TEXT,
    public.presence_environment,
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
    BOOLEAN,
    BOOLEAN,
    BOOLEAN,
    INT,
    TEXT,
    TEXT,
    JSONB
) TO authenticated;

REVOKE ALL ON FUNCTION public.get_tenant_location_topology() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_tenant_location_topology() TO authenticated;

COMMENT ON COLUMN public.tenant_locations.is_manufacturing_floor IS
    'Axis 4: manufacturing/WIP/work-center production capability flag.';

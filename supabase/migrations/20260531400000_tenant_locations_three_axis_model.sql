-- ====================================================================
-- AIB SMART ERP - 3-AXIS LOCATION MANAGEMENT MODEL
-- Migration: 20260531400000_tenant_locations_three_axis_model.sql
-- ====================================================================
-- Replaces rigid location_operational_type enum with decoupled axes:
--   Axis 1: presence_type (PHYSICAL | VIRTUAL)
--   Axis 2: is_administrative_office, is_commercial_storefront
--   Axis 3: is_stock_holding
-- ====================================================================

-- --------------------------------------------------------------------
-- 1. AXIS 1 — presence_environment enum + new columns
-- --------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_type t
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE n.nspname = 'public'
          AND t.typname = 'presence_environment'
    ) THEN
        CREATE TYPE public.presence_environment AS ENUM ('PHYSICAL', 'VIRTUAL');
    END IF;
END;
$$;

ALTER TABLE public.tenant_locations
    ADD COLUMN IF NOT EXISTS presence_type public.presence_environment NOT NULL DEFAULT 'PHYSICAL';

ALTER TABLE public.tenant_locations
    ADD COLUMN IF NOT EXISTS is_administrative_office BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.tenant_locations
    ADD COLUMN IF NOT EXISTS is_commercial_storefront BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.tenant_locations
    ADD COLUMN IF NOT EXISTS pos_terminal_count INT NOT NULL DEFAULT 0;

-- --------------------------------------------------------------------
-- 2. AXIS 3 — normalize is_stock_holding (default false, NOT NULL)
-- --------------------------------------------------------------------
UPDATE public.tenant_locations
SET is_stock_holding = FALSE
WHERE is_stock_holding IS NULL;

ALTER TABLE public.tenant_locations
    ALTER COLUMN is_stock_holding SET DEFAULT FALSE;

ALTER TABLE public.tenant_locations
    ALTER COLUMN is_stock_holding SET NOT NULL;

-- --------------------------------------------------------------------
-- 3. Backfill 3-axis values from legacy location_type (audit preserved)
-- --------------------------------------------------------------------
UPDATE public.tenant_locations
SET location_meta = COALESCE(location_meta, '{}'::jsonb)
    || jsonb_build_object('legacy_location_type', location_type::text)
WHERE location_type IS NOT NULL
  AND NOT (COALESCE(location_meta, '{}'::jsonb) ? 'legacy_location_type');

UPDATE public.tenant_locations
SET
    presence_type = 'PHYSICAL',
    is_administrative_office = TRUE,
    is_commercial_storefront = FALSE,
    is_stock_holding = FALSE,
    pos_terminal_count = 0
WHERE location_type::text IN (
    'GLOBAL_HQ',
    'SUBCONTINENTAL_HQ',
    'COUNTRY_HQ',
    'REGIONAL_ZONE',
    'STATE_HQ',
    'HEAD_OFFICE',
    'REGIONAL_HQ',
    'OFFICE_BRANCH'
);

UPDATE public.tenant_locations
SET
    presence_type = 'PHYSICAL',
    is_administrative_office = FALSE,
    is_commercial_storefront = FALSE,
    is_stock_holding = TRUE,
    pos_terminal_count = 0
WHERE location_type::text IN (
    'STORAGE_WAREHOUSE',
    'WAREHOUSE',
    'MANUFACTURING_PLANT'
);

UPDATE public.tenant_locations
SET
    presence_type = 'PHYSICAL',
    is_administrative_office = FALSE,
    is_commercial_storefront = TRUE,
    is_stock_holding = FALSE,
    pos_terminal_count = 0
WHERE location_type::text = 'RETAIL_OUTLET';

UPDATE public.tenant_locations
SET
    presence_type = 'VIRTUAL',
    is_administrative_office = FALSE,
    is_commercial_storefront = TRUE,
    is_stock_holding = FALSE,
    pos_terminal_count = 0
WHERE location_type::text = 'VIRTUAL_STOREFRONT';

-- --------------------------------------------------------------------
-- 4. Integrity constraints
-- --------------------------------------------------------------------
ALTER TABLE public.tenant_locations
    DROP CONSTRAINT IF EXISTS tenant_locations_pos_terminal_count_non_negative_chk;

ALTER TABLE public.tenant_locations
    ADD CONSTRAINT tenant_locations_pos_terminal_count_non_negative_chk
    CHECK (pos_terminal_count >= 0);

ALTER TABLE public.tenant_locations
    DROP CONSTRAINT IF EXISTS tenant_locations_storefront_pos_terminal_count_chk;

ALTER TABLE public.tenant_locations
    ADD CONSTRAINT tenant_locations_storefront_pos_terminal_count_chk
    CHECK (NOT is_commercial_storefront OR pos_terminal_count >= 0);

ALTER TABLE public.tenant_locations
    DROP CONSTRAINT IF EXISTS tenant_locations_virtual_not_stock_holding_chk;

ALTER TABLE public.tenant_locations
    ADD CONSTRAINT tenant_locations_virtual_not_stock_holding_chk
    CHECK (presence_type <> 'VIRTUAL' OR is_stock_holding = FALSE);

ALTER TABLE public.tenant_locations
    DROP CONSTRAINT IF EXISTS tenant_locations_non_storefront_zero_pos_chk;

ALTER TABLE public.tenant_locations
    ADD CONSTRAINT tenant_locations_non_storefront_zero_pos_chk
    CHECK (is_commercial_storefront OR pos_terminal_count = 0);

-- --------------------------------------------------------------------
-- 5. Performance indexes
-- --------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS tenant_locations_parent_location_id_idx
    ON public.tenant_locations (parent_location_id);

CREATE INDEX IF NOT EXISTS tenant_locations_presence_type_idx
    ON public.tenant_locations (tenant_id, presence_type);

CREATE INDEX IF NOT EXISTS tenant_locations_commercial_storefront_idx
    ON public.tenant_locations (tenant_id, is_commercial_storefront)
    WHERE is_commercial_storefront;

CREATE INDEX IF NOT EXISTS tenant_locations_stock_holding_idx
    ON public.tenant_locations (tenant_id, is_stock_holding)
    WHERE is_stock_holding;

-- --------------------------------------------------------------------
-- 6. Hierarchy FK — ON DELETE RESTRICT
-- --------------------------------------------------------------------
ALTER TABLE public.tenant_locations
    DROP CONSTRAINT IF EXISTS tenant_locations_parent_location_id_fkey;

ALTER TABLE public.tenant_locations
    ADD CONSTRAINT tenant_locations_parent_location_id_fkey
    FOREIGN KEY (parent_location_id)
    REFERENCES public.tenant_locations (id)
    ON DELETE RESTRICT;

-- --------------------------------------------------------------------
-- 7. Drop enum-dependent functions before removing location_type
-- --------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_tenant_location_topology();

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

DROP FUNCTION IF EXISTS private.default_stock_holding_for_location_type(public.location_operational_type);
DROP FUNCTION IF EXISTS private.validate_location_hierarchy_pair(
    public.location_operational_type,
    public.location_operational_type
);

ALTER TABLE public.tenant_locations
    DROP COLUMN IF EXISTS location_type;

DROP TYPE IF EXISTS public.location_operational_type;

-- --------------------------------------------------------------------
-- 8. System virtual location resolver (3-axis aware)
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.ensure_system_location(
    p_tenant_id UUID,
    p_code TEXT,
    p_name TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_location_id UUID;
BEGIN
    SELECT id
    INTO v_location_id
    FROM public.tenant_locations
    WHERE tenant_id = p_tenant_id
      AND code = p_code
    LIMIT 1;

    IF v_location_id IS NOT NULL THEN
        RETURN v_location_id;
    END IF;

    INSERT INTO public.tenant_locations (
        tenant_id,
        name,
        code,
        presence_type,
        is_administrative_office,
        is_commercial_storefront,
        is_stock_holding,
        pos_terminal_count,
        address_line1,
        city,
        state,
        zip_postal,
        country_code,
        is_active
    )
    VALUES (
        p_tenant_id,
        p_name,
        p_code,
        'PHYSICAL',
        FALSE,
        FALSE,
        FALSE,
        0,
        'System Virtual Node',
        'System',
        'NA',
        '00000',
        'US',
        TRUE
    )
    ON CONFLICT ON CONSTRAINT unique_tenant_location_code DO NOTHING;

    SELECT id
    INTO v_location_id
    FROM public.tenant_locations
    WHERE tenant_id = p_tenant_id
      AND code = p_code
    LIMIT 1;

    RETURN v_location_id;
END;
$$;

-- --------------------------------------------------------------------
-- 9. Location save RPC (3-axis parameters)
-- --------------------------------------------------------------------
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
    v_resolved_stock := COALESCE(p_is_stock_holding, FALSE);
    v_resolved_pos := COALESCE(p_pos_terminal_count, 0);

    IF v_resolved_pos < 0 THEN
        RAISE EXCEPTION 'pos terminal count cannot be negative';
    END IF;

    IF v_resolved_presence = 'VIRTUAL'::public.presence_environment AND v_resolved_stock THEN
        RAISE EXCEPTION 'virtual locations cannot be stock-holding locations';
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
        p_is_stock_holding,
        p_pos_terminal_count,
        p_location_tax_identifier,
        p_tax_registered_name,
        p_location_meta
    );
END;
$$;

-- --------------------------------------------------------------------
-- 10. Topology RPC (3-axis columns)
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_tenant_location_topology()
RETURNS TABLE (
    id UUID,
    parent_location_id UUID,
    name TEXT,
    code TEXT,
    presence_type public.presence_environment,
    is_administrative_office BOOLEAN,
    is_commercial_storefront BOOLEAN,
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

-- --------------------------------------------------------------------
-- 11. RLS re-verification (SELECT-only; writes via SECURITY DEFINER RPCs)
-- --------------------------------------------------------------------
ALTER TABLE public.tenant_locations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS location_isolation_policy ON public.tenant_locations;
DROP POLICY IF EXISTS tenant_locations_select_tenant ON public.tenant_locations;

CREATE POLICY tenant_locations_select_tenant
    ON public.tenant_locations
    FOR SELECT
    TO authenticated
    USING (tenant_id = private.current_tenant_id());

-- --------------------------------------------------------------------
-- 12. Grants
-- --------------------------------------------------------------------
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
    INT,
    TEXT,
    TEXT,
    JSONB
) TO authenticated;

REVOKE ALL ON FUNCTION public.get_tenant_location_topology() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_tenant_location_topology() TO authenticated;

COMMENT ON COLUMN public.tenant_locations.presence_type IS
    'Axis 1: PHYSICAL or VIRTUAL presence environment.';

COMMENT ON COLUMN public.tenant_locations.is_administrative_office IS
    'Axis 2: business/HQ/back-office capability flag.';

COMMENT ON COLUMN public.tenant_locations.is_commercial_storefront IS
    'Axis 2: retail/POS/commercial storefront capability flag.';

COMMENT ON COLUMN public.tenant_locations.is_stock_holding IS
    'Axis 3: inventory stock authority for this location.';

COMMENT ON COLUMN public.tenant_locations.pos_terminal_count IS
    'Active POS/billing terminals when is_commercial_storefront is true.';

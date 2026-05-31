-- ====================================================================
-- AIB SMART ERP - UNITS OF MEASURE MANAGEMENT (RPCs)
-- Migration: 20260547000000_uom_management_rpcs.sql
-- --------------------------------------------------------------------
-- Atomic management of the per-tenant uoms reference table, guarded by
-- an inventory-settings access check.
--
--   * private.can_manage_uom_settings()  -> OWNER or ADMIN
--   * save_uom(...)                       -> atomic upsert (code + family + factor)
--   * delete_uom(...)                     -> soft-deactivate if referenced, else delete
--   * seed_default_uoms()                 -> populate a standard cross-family set
--
-- The uoms table, its RLS policy, unique/check constraints, and the
-- updated_at trigger already exist (20260542000000_item_model_foundation).
-- ====================================================================

-- --------------------------------------------------------------------
-- 1. Access helper
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.can_manage_uom_settings()
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_tenant_id UUID;
    v_user_id UUID;
    v_role public.user_role;
BEGIN
    v_tenant_id := private.current_tenant_id();
    v_user_id := auth.uid();

    IF v_tenant_id IS NULL OR v_user_id IS NULL THEN
        RETURN FALSE;
    END IF;

    SELECT role INTO v_role
    FROM public.users
    WHERE id = v_user_id
      AND tenant_id = v_tenant_id
      AND is_active = TRUE;

    RETURN v_role IN ('OWNER'::public.user_role, 'ADMIN'::public.user_role);
END;
$$;

-- --------------------------------------------------------------------
-- 2. save_uom (atomic upsert)
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.save_uom(
    p_code TEXT,
    p_name TEXT,
    p_family TEXT,
    p_factor_to_base NUMERIC,
    p_is_family_base BOOLEAN,
    p_is_active BOOLEAN,
    p_uom_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_tenant_id UUID;
    v_uom_id UUID;
    v_code TEXT;
    v_name TEXT;
    v_family public.uom_family;
    v_factor NUMERIC(20, 8);
    v_is_base BOOLEAN;
BEGIN
    v_tenant_id := private.current_tenant_id();
    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'tenant context missing from session';
    END IF;

    IF NOT private.can_manage_uom_settings() THEN
        RAISE EXCEPTION 'insufficient privileges to manage units of measure';
    END IF;

    v_code := upper(btrim(p_code));
    IF v_code IS NULL OR v_code = '' THEN
        RAISE EXCEPTION 'unit code is required';
    END IF;

    v_name := btrim(p_name);
    IF v_name IS NULL OR v_name = '' THEN
        RAISE EXCEPTION 'unit name is required';
    END IF;

    BEGIN
        v_family := upper(btrim(p_family))::public.uom_family;
    EXCEPTION WHEN others THEN
        RAISE EXCEPTION 'invalid unit family';
    END;

    v_is_base := COALESCE(p_is_family_base, FALSE);

    -- A family base is, by definition, the unit with factor 1.
    IF v_is_base THEN
        v_factor := 1;
    ELSE
        v_factor := COALESCE(p_factor_to_base, 0);
        IF v_factor <= 0 THEN
            RAISE EXCEPTION 'conversion factor must be greater than zero';
        END IF;
    END IF;

    -- Upsert the unit header.
    IF p_uom_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.uoms
            WHERE id = p_uom_id AND tenant_id = v_tenant_id
        ) THEN
            RAISE EXCEPTION 'unit of measure not found for tenant';
        END IF;

        UPDATE public.uoms
        SET
            code = v_code,
            name = v_name,
            family = v_family,
            factor_to_base = v_factor,
            is_family_base = v_is_base,
            is_active = COALESCE(p_is_active, TRUE),
            updated_at = NOW()
        WHERE id = p_uom_id AND tenant_id = v_tenant_id
        RETURNING id INTO v_uom_id;
    ELSE
        INSERT INTO public.uoms (
            tenant_id, code, name, family, factor_to_base, is_family_base, is_active
        )
        VALUES (
            v_tenant_id, v_code, v_name, v_family, v_factor, v_is_base, COALESCE(p_is_active, TRUE)
        )
        RETURNING id INTO v_uom_id;
    END IF;

    -- Only one base unit may exist per family per tenant.
    IF v_is_base THEN
        UPDATE public.uoms
        SET is_family_base = FALSE, updated_at = NOW()
        WHERE tenant_id = v_tenant_id
          AND family = v_family
          AND id <> v_uom_id
          AND is_family_base = TRUE;
    END IF;

    RETURN v_uom_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.save_uom(
    p_code TEXT,
    p_name TEXT,
    p_family TEXT,
    p_factor_to_base NUMERIC,
    p_is_family_base BOOLEAN,
    p_is_active BOOLEAN,
    p_uom_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, private
AS $$
    SELECT private.save_uom(
        p_code, p_name, p_family, p_factor_to_base, p_is_family_base, p_is_active, p_uom_id
    );
$$;

-- --------------------------------------------------------------------
-- 3. delete_uom (soft-deactivate if referenced, else hard delete)
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.delete_uom(
    p_uom_id UUID
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_tenant_id UUID;
    v_in_use BOOLEAN;
BEGIN
    v_tenant_id := private.current_tenant_id();
    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'tenant context missing from session';
    END IF;

    IF NOT private.can_manage_uom_settings() THEN
        RAISE EXCEPTION 'insufficient privileges to manage units of measure';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.uoms
        WHERE id = p_uom_id AND tenant_id = v_tenant_id
    ) THEN
        RAISE EXCEPTION 'unit of measure not found for tenant';
    END IF;

    SELECT EXISTS (
        SELECT 1 FROM public.items
        WHERE tenant_id = v_tenant_id AND base_uom_id = p_uom_id
    ) INTO v_in_use;

    IF v_in_use THEN
        UPDATE public.uoms
        SET is_active = FALSE, updated_at = NOW()
        WHERE id = p_uom_id AND tenant_id = v_tenant_id;
        RETURN 'DEACTIVATED';
    END IF;

    DELETE FROM public.uoms
    WHERE id = p_uom_id AND tenant_id = v_tenant_id;
    RETURN 'DELETED';
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_uom(
    p_uom_id UUID
)
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, private
AS $$
    SELECT private.delete_uom(p_uom_id);
$$;

-- --------------------------------------------------------------------
-- 4. seed_default_uoms (standard cross-family set; idempotent)
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.seed_default_uoms()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_tenant_id UUID;
    v_inserted INTEGER := 0;
    v_defaults JSONB := '[
        {"code": "PCS",   "name": "Pieces",      "family": "COUNT",  "factor": 1,      "base": true},
        {"code": "DOZEN", "name": "Dozen",       "family": "COUNT",  "factor": 12,     "base": false},
        {"code": "BOX",   "name": "Box",         "family": "COUNT",  "factor": 1,      "base": false},
        {"code": "KG",    "name": "Kilogram",    "family": "WEIGHT", "factor": 1,      "base": true},
        {"code": "G",     "name": "Gram",        "family": "WEIGHT", "factor": 0.001,  "base": false},
        {"code": "TON",   "name": "Tonne",       "family": "WEIGHT", "factor": 1000,   "base": false},
        {"code": "LTR",   "name": "Litre",       "family": "VOLUME", "factor": 1,      "base": true},
        {"code": "ML",    "name": "Millilitre",  "family": "VOLUME", "factor": 0.001,  "base": false},
        {"code": "M",     "name": "Metre",       "family": "LENGTH", "factor": 1,      "base": true},
        {"code": "CM",    "name": "Centimetre",  "family": "LENGTH", "factor": 0.01,   "base": false}
    ]'::jsonb;
    v_row JSONB;
BEGIN
    v_tenant_id := private.current_tenant_id();
    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'tenant context missing from session';
    END IF;

    IF NOT private.can_manage_uom_settings() THEN
        RAISE EXCEPTION 'insufficient privileges to manage units of measure';
    END IF;

    FOR v_row IN SELECT value FROM jsonb_array_elements(v_defaults) AS value
    LOOP
        INSERT INTO public.uoms (
            tenant_id, code, name, family, factor_to_base, is_family_base, is_active
        )
        VALUES (
            v_tenant_id,
            v_row ->> 'code',
            v_row ->> 'name',
            (v_row ->> 'family')::public.uom_family,
            (v_row ->> 'factor')::numeric,
            (v_row ->> 'base')::boolean,
            TRUE
        )
        ON CONFLICT (tenant_id, code) DO NOTHING;

        IF FOUND THEN
            v_inserted := v_inserted + 1;
        END IF;
    END LOOP;

    RETURN v_inserted;
END;
$$;

CREATE OR REPLACE FUNCTION public.seed_default_uoms()
RETURNS INTEGER
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, private
AS $$
    SELECT private.seed_default_uoms();
$$;

-- --------------------------------------------------------------------
-- 5. Grants
-- --------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.save_uom(
    TEXT, TEXT, TEXT, NUMERIC, BOOLEAN, BOOLEAN, UUID
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_uom(
    TEXT, TEXT, TEXT, NUMERIC, BOOLEAN, BOOLEAN, UUID
) TO authenticated;

REVOKE ALL ON FUNCTION public.delete_uom(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_uom(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.seed_default_uoms() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.seed_default_uoms() TO authenticated;

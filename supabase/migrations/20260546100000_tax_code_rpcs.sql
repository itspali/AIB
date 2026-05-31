-- ====================================================================
-- AIB SMART ERP - TAX SETTINGS MODULE (Phase B: RPCs)
-- Migration: 20260546100000_tax_code_rpcs.sql
-- --------------------------------------------------------------------
-- Atomic management of tax codes + their components + their slab rules,
-- guarded by a role/delegate access check.
--
--   * private.can_edit_tax_settings()  -> OWNER or delegated editor
--   * save_tax_code(...)               -> atomic upsert (code+components+rules)
--   * delete_tax_code(...)             -> soft-deactivate if referenced, else delete
--
-- Access model: OWNER edits by default; any other role edits only if a
-- delegate row exists in workspace_control_registry with registry_key
-- 'allow_tax_settings_modification' targeting the user (mirrors the
-- organization-settings delegation pattern).
-- ====================================================================

-- --------------------------------------------------------------------
-- 1. Access helper
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.can_edit_tax_settings()
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

    IF v_role = 'OWNER'::public.user_role THEN
        RETURN TRUE;
    END IF;

    RETURN EXISTS (
        SELECT 1
        FROM public.workspace_control_registry
        WHERE tenant_id = v_tenant_id
          AND registry_key = 'allow_tax_settings_modification'
          AND target_reference_id = v_user_id
    );
END;
$$;

-- --------------------------------------------------------------------
-- 2. save_tax_code (atomic upsert of code + components + slab rules)
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.save_tax_code(
    p_code TEXT,
    p_name TEXT,
    p_kind TEXT,
    p_rate NUMERIC,
    p_is_inclusive BOOLEAN,
    p_is_variable BOOLEAN,
    p_effective_from DATE,
    p_effective_to DATE,
    p_is_active BOOLEAN,
    p_components JSONB DEFAULT '[]'::jsonb,
    p_rules JSONB DEFAULT '[]'::jsonb,
    p_tax_code_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_tenant_id UUID;
    v_tax_code_id UUID;
    v_code TEXT;
    v_name TEXT;
    v_kind public.tax_code_kind;
    v_rate NUMERIC(7, 4);
    v_prev_max NUMERIC(15, 4);
    v_rule JSONB;
    v_component JSONB;
    v_basis TEXT;
    v_min NUMERIC(15, 4);
    v_max NUMERIC(15, 4);
    v_rule_count INTEGER := 0;
BEGIN
    v_tenant_id := private.current_tenant_id();
    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'tenant context missing from session';
    END IF;

    IF NOT private.can_edit_tax_settings() THEN
        RAISE EXCEPTION 'insufficient privileges to edit tax settings';
    END IF;

    v_code := upper(btrim(p_code));
    IF v_code IS NULL OR v_code = '' THEN
        RAISE EXCEPTION 'tax code is required';
    END IF;

    v_name := btrim(p_name);
    IF v_name IS NULL OR v_name = '' THEN
        RAISE EXCEPTION 'tax code name is required';
    END IF;

    BEGIN
        v_kind := upper(btrim(p_kind))::public.tax_code_kind;
    EXCEPTION WHEN others THEN
        RAISE EXCEPTION 'invalid tax code kind';
    END;

    v_rate := COALESCE(p_rate, 0);
    IF v_rate < 0 THEN
        RAISE EXCEPTION 'tax rate cannot be negative';
    END IF;

    IF p_components IS NULL THEN
        p_components := '[]'::jsonb;
    END IF;
    IF jsonb_typeof(p_components) IS DISTINCT FROM 'array' THEN
        RAISE EXCEPTION 'components must be a JSON array';
    END IF;

    IF p_rules IS NULL THEN
        p_rules := '[]'::jsonb;
    END IF;
    IF jsonb_typeof(p_rules) IS DISTINCT FROM 'array' THEN
        RAISE EXCEPTION 'rules must be a JSON array';
    END IF;

    -- Variable codes must carry contiguous, gap-free, non-overlapping slabs
    -- starting at 0. Flat codes ignore any provided rules.
    IF p_is_variable THEN
        v_prev_max := 0;
        FOR v_rule IN
            SELECT value
            FROM jsonb_array_elements(p_rules) AS value
            ORDER BY (value ->> 'threshold_min')::numeric
        LOOP
            v_rule_count := v_rule_count + 1;
            v_basis := upper(btrim(COALESCE(v_rule ->> 'basis', 'UNIT_PRICE')));
            IF v_basis NOT IN ('UNIT_PRICE', 'LINE_VALUE', 'QTY') THEN
                RAISE EXCEPTION 'invalid slab basis: %', v_basis;
            END IF;

            v_min := COALESCE((v_rule ->> 'threshold_min')::numeric, 0);
            v_max := NULLIF(v_rule ->> 'threshold_max', '')::numeric;

            IF COALESCE((v_rule ->> 'rate')::numeric, 0) < 0 THEN
                RAISE EXCEPTION 'slab rate cannot be negative';
            END IF;

            IF v_min <> v_prev_max THEN
                RAISE EXCEPTION 'slab rules must be contiguous and start at 0 (gap/overlap at %)', v_min;
            END IF;

            IF v_max IS NOT NULL AND v_max <= v_min THEN
                RAISE EXCEPTION 'slab upper bound must exceed its lower bound';
            END IF;

            v_prev_max := v_max;
        END LOOP;

        IF v_rule_count = 0 THEN
            RAISE EXCEPTION 'a variable tax code requires at least one slab rule';
        END IF;
    END IF;

    -- Upsert the tax code header.
    IF p_tax_code_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.tax_codes
            WHERE id = p_tax_code_id AND tenant_id = v_tenant_id
        ) THEN
            RAISE EXCEPTION 'tax code not found for tenant';
        END IF;

        UPDATE public.tax_codes
        SET
            code = v_code,
            name = v_name,
            kind = v_kind,
            rate = v_rate,
            is_inclusive_default = COALESCE(p_is_inclusive, FALSE),
            is_variable = COALESCE(p_is_variable, FALSE),
            effective_from = p_effective_from,
            effective_to = p_effective_to,
            is_active = COALESCE(p_is_active, TRUE),
            updated_at = NOW()
        WHERE id = p_tax_code_id AND tenant_id = v_tenant_id
        RETURNING id INTO v_tax_code_id;
    ELSE
        INSERT INTO public.tax_codes (
            tenant_id, code, name, kind, rate, is_inclusive_default,
            is_variable, effective_from, effective_to, is_active
        )
        VALUES (
            v_tenant_id, v_code, v_name, v_kind, v_rate, COALESCE(p_is_inclusive, FALSE),
            COALESCE(p_is_variable, FALSE), p_effective_from, p_effective_to, COALESCE(p_is_active, TRUE)
        )
        RETURNING id INTO v_tax_code_id;
    END IF;

    -- Replace components.
    DELETE FROM public.tax_code_components
    WHERE tenant_id = v_tenant_id AND tax_code_id = v_tax_code_id;

    FOR v_component IN SELECT value FROM jsonb_array_elements(p_components) AS value
    LOOP
        IF btrim(COALESCE(v_component ->> 'name', '')) = '' THEN
            CONTINUE;
        END IF;
        INSERT INTO public.tax_code_components (
            tenant_id, tax_code_id, name, rate, sort_order
        )
        VALUES (
            v_tenant_id,
            v_tax_code_id,
            btrim(v_component ->> 'name'),
            COALESCE((v_component ->> 'rate')::numeric, 0),
            COALESCE((v_component ->> 'sort_order')::integer, 0)
        );
    END LOOP;

    -- Replace slab rules (cleared for flat codes).
    DELETE FROM public.tax_rate_rules
    WHERE tenant_id = v_tenant_id AND tax_code_id = v_tax_code_id;

    IF p_is_variable THEN
        FOR v_rule IN SELECT value FROM jsonb_array_elements(p_rules) AS value
        LOOP
            INSERT INTO public.tax_rate_rules (
                tenant_id, tax_code_id, basis, threshold_min, threshold_max,
                rate, effective_from, effective_to
            )
            VALUES (
                v_tenant_id,
                v_tax_code_id,
                upper(btrim(COALESCE(v_rule ->> 'basis', 'UNIT_PRICE'))),
                COALESCE((v_rule ->> 'threshold_min')::numeric, 0),
                NULLIF(v_rule ->> 'threshold_max', '')::numeric,
                COALESCE((v_rule ->> 'rate')::numeric, 0),
                NULLIF(v_rule ->> 'effective_from', '')::date,
                NULLIF(v_rule ->> 'effective_to', '')::date
            );
        END LOOP;
    END IF;

    RETURN v_tax_code_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.save_tax_code(
    p_code TEXT,
    p_name TEXT,
    p_kind TEXT,
    p_rate NUMERIC,
    p_is_inclusive BOOLEAN,
    p_is_variable BOOLEAN,
    p_effective_from DATE,
    p_effective_to DATE,
    p_is_active BOOLEAN,
    p_components JSONB DEFAULT '[]'::jsonb,
    p_rules JSONB DEFAULT '[]'::jsonb,
    p_tax_code_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, private
AS $$
    SELECT private.save_tax_code(
        p_code, p_name, p_kind, p_rate, p_is_inclusive, p_is_variable,
        p_effective_from, p_effective_to, p_is_active, p_components, p_rules, p_tax_code_id
    );
$$;

-- --------------------------------------------------------------------
-- 3. delete_tax_code (soft-deactivate if referenced, else hard delete)
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.delete_tax_code(
    p_tax_code_id UUID
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

    IF NOT private.can_edit_tax_settings() THEN
        RAISE EXCEPTION 'insufficient privileges to edit tax settings';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.tax_codes
        WHERE id = p_tax_code_id AND tenant_id = v_tenant_id
    ) THEN
        RAISE EXCEPTION 'tax code not found for tenant';
    END IF;

    SELECT EXISTS (
        SELECT 1 FROM public.items
        WHERE tenant_id = v_tenant_id AND tax_code_id = p_tax_code_id
    ) INTO v_in_use;

    IF v_in_use THEN
        UPDATE public.tax_codes
        SET is_active = FALSE, updated_at = NOW()
        WHERE id = p_tax_code_id AND tenant_id = v_tenant_id;
        RETURN 'DEACTIVATED';
    END IF;

    DELETE FROM public.tax_codes
    WHERE id = p_tax_code_id AND tenant_id = v_tenant_id;
    RETURN 'DELETED';
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_tax_code(
    p_tax_code_id UUID
)
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, private
AS $$
    SELECT private.delete_tax_code(p_tax_code_id);
$$;

-- --------------------------------------------------------------------
-- 4. Grants
-- --------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.save_tax_code(
    TEXT, TEXT, TEXT, NUMERIC, BOOLEAN, BOOLEAN, DATE, DATE, BOOLEAN, JSONB, JSONB, UUID
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_tax_code(
    TEXT, TEXT, TEXT, NUMERIC, BOOLEAN, BOOLEAN, DATE, DATE, BOOLEAN, JSONB, JSONB, UUID
) TO authenticated;

REVOKE ALL ON FUNCTION public.delete_tax_code(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_tax_code(UUID) TO authenticated;

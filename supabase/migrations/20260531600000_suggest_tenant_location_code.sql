-- ====================================================================
-- AIB SMART ERP - FACILITY LOCATION CODE SUGGESTION
-- Migration: 20260531600000_suggest_tenant_location_code.sql
-- ====================================================================
-- Semantic facility codes: {SCOPE}-{ROLE}-{SEQ}
-- Reads role tokens and padding from tenants.naming_sequences FACILITY_* keys.
-- ====================================================================

CREATE OR REPLACE FUNCTION private.slug_city_for_location_code(p_city TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT CASE
        WHEN p_city IS NULL OR btrim(p_city) = '' THEN 'NODE'
        ELSE COALESCE(
            NULLIF(
                left(
                    regexp_replace(upper(btrim(p_city)), '[^A-Z0-9]', '', 'g'),
                    5
                ),
                ''
            ),
            'NODE'
        )
    END;
$$;

CREATE OR REPLACE FUNCTION private.resolve_facility_code_role_key(
    p_presence_type public.presence_environment,
    p_is_administrative_office BOOLEAN,
    p_is_commercial_storefront BOOLEAN,
    p_is_manufacturing_floor BOOLEAN,
    p_is_stock_holding BOOLEAN
)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
    IF p_presence_type = 'VIRTUAL'::public.presence_environment THEN
        RETURN 'FACILITY_VIRTUAL';
    END IF;
    IF COALESCE(p_is_administrative_office, FALSE) THEN
        RETURN 'FACILITY_HQ';
    END IF;
    IF COALESCE(p_is_commercial_storefront, FALSE) THEN
        RETURN 'FACILITY_STORE';
    END IF;
    IF COALESCE(p_is_manufacturing_floor, FALSE) THEN
        RETURN 'FACILITY_PLANT';
    END IF;
    IF COALESCE(p_is_stock_holding, FALSE) THEN
        RETURN 'FACILITY_WH';
    END IF;
    RETURN 'FACILITY_NODE';
END;
$$;

CREATE OR REPLACE FUNCTION private.default_facility_role_token(p_role_key TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT CASE p_role_key
        WHEN 'FACILITY_HQ' THEN 'HQ'
        WHEN 'FACILITY_STORE' THEN 'STORE'
        WHEN 'FACILITY_PLANT' THEN 'PLANT'
        WHEN 'FACILITY_WH' THEN 'WH'
        WHEN 'FACILITY_VIRTUAL' THEN 'VRTL'
        ELSE 'NODE'
    END;
$$;

CREATE OR REPLACE FUNCTION private.get_facility_naming_entry(
    p_tenant_id UUID,
    p_role_key TEXT
)
RETURNS TABLE (
    role_token TEXT,
    padding_length INTEGER
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_sequences JSONB;
    v_entry JSONB;
    v_prefix TEXT;
    v_digits INTEGER;
BEGIN
    SELECT naming_sequences
    INTO v_sequences
    FROM public.tenants
    WHERE id = p_tenant_id;

    v_entry := COALESCE(v_sequences, '{}'::jsonb) -> p_role_key;
    v_prefix := NULLIF(btrim(v_entry ->> 'prefix'), '');
    v_digits := COALESCE(NULLIF(v_entry ->> 'digits', '')::INTEGER, 2);

    IF v_digits < 2 OR v_digits > 4 THEN
        v_digits := 2;
    END IF;

    role_token := COALESCE(v_prefix, private.default_facility_role_token(p_role_key));
    padding_length := v_digits;
    RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION private.resolve_facility_code_scope(
    p_tenant_id UUID,
    p_parent_location_id UUID,
    p_country_code TEXT,
    p_city TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_parent_code TEXT;
    v_country TEXT;
    v_city_slug TEXT;
BEGIN
    IF p_parent_location_id IS NOT NULL THEN
        SELECT upper(code)
        INTO v_parent_code
        FROM public.tenant_locations
        WHERE id = p_parent_location_id
          AND tenant_id = p_tenant_id;

        IF v_parent_code IS NOT NULL THEN
            RETURN left(v_parent_code, 18);
        END IF;
    END IF;

    v_country := upper(COALESCE(NULLIF(btrim(p_country_code), ''), 'XX'));
    v_city_slug := private.slug_city_for_location_code(p_city);
    RETURN v_country || '-' || v_city_slug;
END;
$$;

CREATE OR REPLACE FUNCTION private.peek_facility_code_sequence(
    p_tenant_id UUID,
    p_code_prefix TEXT,
    p_exclude_location_id UUID DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_max_seq INTEGER := 0;
    v_row RECORD;
    v_match TEXT;
BEGIN
    FOR v_row IN
        SELECT tl.code
        FROM public.tenant_locations tl
        WHERE tl.tenant_id = p_tenant_id
          AND tl.code LIKE p_code_prefix || '%'
          AND (p_exclude_location_id IS NULL OR tl.id <> p_exclude_location_id)
          AND NOT private.is_system_tenant_location(tl.code)
    LOOP
        v_match := substring(v_row.code from '([0-9]+)$');
        IF v_match IS NOT NULL THEN
            v_max_seq := GREATEST(v_max_seq, v_match::INTEGER);
        END IF;
    END LOOP;

    RETURN v_max_seq + 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.suggest_tenant_location_code(
    p_presence_type public.presence_environment DEFAULT 'PHYSICAL',
    p_is_administrative_office BOOLEAN DEFAULT FALSE,
    p_is_commercial_storefront BOOLEAN DEFAULT FALSE,
    p_is_manufacturing_floor BOOLEAN DEFAULT FALSE,
    p_is_stock_holding BOOLEAN DEFAULT FALSE,
    p_parent_location_id UUID DEFAULT NULL,
    p_country_code TEXT DEFAULT 'IN',
    p_city TEXT DEFAULT NULL,
    p_location_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_tenant_id UUID;
    v_role_key TEXT;
    v_role_token TEXT;
    v_padding INTEGER;
    v_scope TEXT;
    v_scope_candidate TEXT;
    v_prefix TEXT;
    v_seq INTEGER;
    v_code TEXT;
    v_attempt INTEGER;
    v_naming RECORD;
BEGIN
    v_tenant_id := private.current_tenant_id();
    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'tenant context missing from session';
    END IF;

    v_role_key := private.resolve_facility_code_role_key(
        p_presence_type,
        p_is_administrative_office,
        p_is_commercial_storefront,
        p_is_manufacturing_floor,
        p_is_stock_holding
    );

    SELECT *
    INTO v_naming
    FROM private.get_facility_naming_entry(v_tenant_id, v_role_key);

    v_role_token := v_naming.role_token;
    v_padding := v_naming.padding_length;
    v_scope := private.resolve_facility_code_scope(
        v_tenant_id,
        p_parent_location_id,
        p_country_code,
        p_city
    );

    FOR v_attempt IN 1..8 LOOP
        v_scope_candidate := left(v_scope, GREATEST(4, 22 - v_attempt * 2));
        v_prefix := v_scope_candidate || '-' || v_role_token || '-';
        v_seq := private.peek_facility_code_sequence(
            v_tenant_id,
            v_prefix,
            p_location_id
        );
        v_code := v_prefix || lpad(v_seq::text, v_padding, '0');

        IF length(v_code) <= 30
           AND NOT private.is_system_tenant_location(v_code)
           AND NOT EXISTS (
               SELECT 1
               FROM public.tenant_locations tl
               WHERE tl.tenant_id = v_tenant_id
                 AND upper(tl.code) = upper(v_code)
                 AND (p_location_id IS NULL OR tl.id <> p_location_id)
           ) THEN
            RETURN jsonb_build_object(
                'code', upper(v_code),
                'scope', v_scope_candidate,
                'role', v_role_token,
                'sequence', v_seq,
                'role_key', v_role_key
            );
        END IF;
    END LOOP;

    RAISE EXCEPTION 'unable to generate a unique facility code within length limits';
END;
$$;

REVOKE ALL ON FUNCTION public.suggest_tenant_location_code(
    public.presence_environment,
    BOOLEAN,
    BOOLEAN,
    BOOLEAN,
    BOOLEAN,
    UUID,
    TEXT,
    TEXT,
    UUID
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.suggest_tenant_location_code(
    public.presence_environment,
    BOOLEAN,
    BOOLEAN,
    BOOLEAN,
    BOOLEAN,
    UUID,
    TEXT,
    TEXT,
    UUID
) TO authenticated;

COMMENT ON FUNCTION public.suggest_tenant_location_code IS
    'Returns a tenant-scoped semantic facility code suggestion as JSON: code, scope, role, sequence, role_key.';

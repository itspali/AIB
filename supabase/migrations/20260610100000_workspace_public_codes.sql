-- ====================================================================
-- Workspace public codes (ORG-/GRP-) + invite by email or code
-- Migration: 20260610100000_workspace_public_codes.sql
-- ====================================================================

ALTER TABLE public.tenants
    ADD COLUMN IF NOT EXISTS organization_code VARCHAR(12);

ALTER TABLE public.tenant_groups
    ADD COLUMN IF NOT EXISTS group_code VARCHAR(12);

CREATE OR REPLACE FUNCTION private.generate_workspace_public_code(p_prefix TEXT)
RETURNS TEXT
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
    v_code TEXT;
    v_chars CONSTANT TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    v_attempt INT := 0;
    v_i INT;
BEGIN
    IF p_prefix NOT IN ('ORG', 'GRP') THEN
        RAISE EXCEPTION 'invalid workspace code prefix';
    END IF;

    LOOP
        v_code := p_prefix || '-';
        FOR v_i IN 1..6 LOOP
            v_code := v_code || substr(
                v_chars,
                1 + floor(random() * length(v_chars))::INT,
                1
            );
        END LOOP;

        IF p_prefix = 'ORG' THEN
            EXIT WHEN NOT EXISTS (
                SELECT 1 FROM public.tenants t WHERE t.organization_code = v_code
            );
        ELSE
            EXIT WHEN NOT EXISTS (
                SELECT 1 FROM public.tenant_groups g WHERE g.group_code = v_code
            );
        END IF;

        v_attempt := v_attempt + 1;
        IF v_attempt > 30 THEN
            RAISE EXCEPTION 'unable to generate unique workspace code';
        END IF;
    END LOOP;

    RETURN v_code;
END;
$$;

DO $$
DECLARE
    v_row RECORD;
BEGIN
    FOR v_row IN
        SELECT t.id
        FROM public.tenants t
        WHERE t.organization_code IS NULL
    LOOP
        UPDATE public.tenants
        SET organization_code = private.generate_workspace_public_code('ORG')
        WHERE id = v_row.id;
    END LOOP;

    FOR v_row IN
        SELECT g.id
        FROM public.tenant_groups g
        WHERE g.group_code IS NULL
    LOOP
        UPDATE public.tenant_groups
        SET group_code = private.generate_workspace_public_code('GRP')
        WHERE id = v_row.id;
    END LOOP;
END;
$$;

ALTER TABLE public.tenants
    ALTER COLUMN organization_code SET NOT NULL;

ALTER TABLE public.tenant_groups
    ALTER COLUMN group_code SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS tenants_organization_code_unique
    ON public.tenants (organization_code);

CREATE UNIQUE INDEX IF NOT EXISTS tenant_groups_group_code_unique
    ON public.tenant_groups (group_code);

CREATE OR REPLACE FUNCTION private.resolve_standalone_tenant_for_group_invite(p_identifier TEXT)
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_normalized TEXT;
    v_email TEXT;
    v_code TEXT;
    v_tenant_id UUID;
    v_match_count INT;
BEGIN
    v_normalized := btrim(p_identifier);
    IF v_normalized IS NULL OR v_normalized = '' THEN
        RAISE EXCEPTION 'organization email or workspace code is required';
    END IF;

    IF position('@' IN v_normalized) > 0 THEN
        v_email := lower(v_normalized);

        SELECT COUNT(*)::INT
        INTO v_match_count
        FROM public.tenants t
        WHERE t.group_id IS NULL
          AND lower(t.primary_email) = v_email;

        IF v_match_count = 0 THEN
            RAISE EXCEPTION 'standalone organization not found for this email';
        END IF;

        IF v_match_count > 1 THEN
            RAISE EXCEPTION 'multiple organizations share this email; use workspace code instead';
        END IF;

        SELECT t.id
        INTO v_tenant_id
        FROM public.tenants t
        WHERE t.group_id IS NULL
          AND lower(t.primary_email) = v_email;

        RETURN v_tenant_id;
    END IF;

    v_code := upper(v_normalized);
    IF v_code !~ '^ORG-[A-Z0-9]{6}$' THEN
        RAISE EXCEPTION 'use organization primary email or workspace code (e.g. ORG-AB12CD)';
    END IF;

    SELECT t.id
    INTO v_tenant_id
    FROM public.tenants t
    WHERE t.organization_code = v_code
      AND t.group_id IS NULL;

    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'standalone organization not found for workspace code';
    END IF;

    RETURN v_tenant_id;
END;
$$;

CREATE OR REPLACE FUNCTION private.invite_standalone_organization_to_group(
    p_group_id UUID,
    p_identifier TEXT,
    p_message TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, private
AS $$
DECLARE
    v_tenant_id UUID;
BEGIN
    v_tenant_id := private.resolve_standalone_tenant_for_group_invite(p_identifier);
    RETURN private.invite_organization_to_group(p_group_id, v_tenant_id, p_message);
END;
$$;

CREATE OR REPLACE FUNCTION public.invite_standalone_organization_to_group(
    p_group_id UUID,
    p_identifier TEXT,
    p_message TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, private
AS $$
    SELECT private.invite_standalone_organization_to_group(p_group_id, p_identifier, p_message);
$$;

REVOKE ALL ON FUNCTION public.invite_standalone_organization_to_group(UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.invite_standalone_organization_to_group(UUID, TEXT, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION private.initialize_new_tenant(
    company_name TEXT,
    admin_name TEXT,
    user_email TEXT,
    auth_user_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, private
AS $$
DECLARE
    v_tenant_id UUID;
    v_first_name TEXT;
    v_last_name TEXT;
    v_normalized_email TEXT;
    v_existing_tenant_id UUID;
BEGIN
    IF auth.uid() IS NULL OR auth.uid() IS DISTINCT FROM auth_user_id THEN
        RAISE EXCEPTION 'unauthorized: caller must match auth_user_id';
    END IF;

    IF company_name IS NULL OR btrim(company_name) = '' THEN
        RAISE EXCEPTION 'company_name is required';
    END IF;

    IF admin_name IS NULL OR btrim(admin_name) = '' THEN
        RAISE EXCEPTION 'admin_name is required';
    END IF;

    IF user_email IS NULL OR btrim(user_email) = '' THEN
        RAISE EXCEPTION 'user_email is required';
    END IF;

    v_normalized_email := lower(btrim(user_email));

    SELECT m.tenant_id
    INTO v_existing_tenant_id
    FROM public.user_tenant_memberships m
    WHERE m.user_id = auth_user_id
      AND m.is_active = TRUE
    ORDER BY m.created_at
    LIMIT 1;

    IF v_existing_tenant_id IS NOT NULL THEN
        RETURN v_existing_tenant_id;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = auth_user_id) THEN
        RAISE EXCEPTION 'auth user % does not exist', auth_user_id;
    END IF;

    v_first_name := btrim(split_part(btrim(admin_name), ' ', 1));
    v_last_name := NULLIF(btrim(substring(btrim(admin_name) FROM position(' ' IN btrim(admin_name)) + 1)), '');
    IF v_last_name IS NULL THEN
        v_last_name := v_first_name;
    END IF;

    INSERT INTO public.tenants (
        name,
        primary_email,
        primary_phone,
        onboarding_source,
        onboarding_status,
        organization_code
    )
    VALUES (
        btrim(company_name),
        v_normalized_email,
        'PENDING',
        'DIRECT_SAAS',
        'ACCOUNT_CREATED',
        private.generate_workspace_public_code('ORG')
    )
    RETURNING id INTO v_tenant_id;

    INSERT INTO public.users (id, first_name, last_name, email)
    VALUES (auth_user_id, v_first_name, v_last_name, v_normalized_email)
    ON CONFLICT (id) DO UPDATE
    SET first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name, email = EXCLUDED.email;

    INSERT INTO public.user_tenant_memberships (
        user_id, tenant_id, role, assigned_location_id, email
    )
    VALUES (auth_user_id, v_tenant_id, 'OWNER', NULL, v_normalized_email);

    PERFORM private.patch_auth_active_membership(
        auth_user_id, v_tenant_id, 'OWNER'::public.user_role, NULL, NULL
    );

    UPDATE auth.users
    SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object(
            'first_name', v_first_name,
            'last_name', v_last_name
        ),
        raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) - 'signup_pending'
    WHERE id = auth_user_id;

    UPDATE public.tenants
    SET created_by_user_id = auth_user_id
    WHERE id = v_tenant_id;

    RETURN v_tenant_id;
END;
$$;

CREATE OR REPLACE FUNCTION private.create_group_organization(
    p_group_id UUID,
    p_company_name TEXT,
    p_primary_email TEXT,
    p_primary_phone TEXT DEFAULT 'PENDING'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, private
AS $$
DECLARE
    v_tenant_id UUID;
    v_email TEXT;
BEGIN
    IF NOT private.user_is_group_admin(p_group_id) THEN
        RAISE EXCEPTION 'group admin access required';
    END IF;

    IF p_company_name IS NULL OR btrim(p_company_name) = '' THEN
        RAISE EXCEPTION 'company_name is required';
    END IF;

    v_email := lower(btrim(p_primary_email));
    IF v_email IS NULL OR v_email = '' THEN
        RAISE EXCEPTION 'primary_email is required';
    END IF;

    INSERT INTO public.tenants (
        name,
        primary_email,
        primary_phone,
        group_id,
        onboarding_source,
        onboarding_status,
        organization_code
    )
    VALUES (
        btrim(p_company_name),
        v_email,
        COALESCE(NULLIF(btrim(p_primary_phone), ''), 'PENDING'),
        p_group_id,
        'DIRECT_SAAS',
        'ACCOUNT_CREATED',
        private.generate_workspace_public_code('ORG')
    )
    RETURNING id INTO v_tenant_id;

    INSERT INTO public.tenant_group_memberships (
        group_id, tenant_id, status, joined_by_user_id
    )
    VALUES (p_group_id, v_tenant_id, 'ACTIVE', auth.uid());

    PERFORM private.log_group_membership_event(
        p_group_id,
        v_tenant_id,
        'ORGANIZATION_CREATED',
        jsonb_build_object('name', btrim(p_company_name))
    );

    RETURN v_tenant_id;
END;
$$;

CREATE OR REPLACE FUNCTION private.create_tenant_group(
    p_name TEXT,
    p_primary_email TEXT,
    p_primary_phone TEXT DEFAULT 'PENDING'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, private
AS $$
DECLARE
    v_group_id UUID;
    v_tenant_id UUID;
    v_email TEXT;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'authentication required';
    END IF;

    v_tenant_id := private.current_tenant_id();
    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'tenant context missing from session';
    END IF;

    IF p_name IS NULL OR btrim(p_name) = '' THEN
        RAISE EXCEPTION 'group name is required';
    END IF;

    v_email := lower(btrim(p_primary_email));
    IF v_email IS NULL OR v_email = '' THEN
        RAISE EXCEPTION 'primary_email is required';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.tenants t
        WHERE t.id = v_tenant_id
          AND t.group_id IS NOT NULL
    ) THEN
        RAISE EXCEPTION 'active organization already belongs to a group';
    END IF;

    INSERT INTO public.tenant_groups (name, primary_email, primary_phone, group_code)
    VALUES (
        btrim(p_name),
        v_email,
        COALESCE(NULLIF(btrim(p_primary_phone), ''), 'PENDING'),
        private.generate_workspace_public_code('GRP')
    )
    RETURNING id INTO v_group_id;

    INSERT INTO public.group_memberships (group_id, user_id, role)
    VALUES (v_group_id, auth.uid(), 'GROUP_OWNER');

    UPDATE public.tenants
    SET group_id = v_group_id, updated_at = NOW()
    WHERE id = v_tenant_id;

    INSERT INTO public.tenant_group_memberships (
        group_id, tenant_id, status, joined_by_user_id
    )
    VALUES (v_group_id, v_tenant_id, 'ACTIVE', auth.uid());

    PERFORM private.log_group_membership_event(
        v_group_id, v_tenant_id, 'ORG_JOINED', jsonb_build_object('source', 'group_creation')
    );

    PERFORM private.patch_auth_active_membership(
        auth.uid(),
        private.current_tenant_id(),
        private.current_user_role(),
        private.current_assigned_location_id(),
        v_group_id
    );

    PERFORM private.log_group_membership_event(v_group_id, NULL, 'GROUP_CREATED');

    RETURN v_group_id;
END;
$$;

-- RETURNS TABLE shape changed (added organization_code); REPLACE is not allowed.
DROP FUNCTION IF EXISTS public.list_group_organizations(UUID);
DROP FUNCTION IF EXISTS private.list_group_organizations(UUID);

CREATE OR REPLACE FUNCTION private.list_group_organizations(p_group_id UUID)
RETURNS TABLE (
    tenant_id UUID,
    organization_code TEXT,
    name TEXT,
    trade_name TEXT,
    membership_status public.tenant_group_membership_status,
    tenant_status public.tenant_account_status,
    onboarding_status public.tenant_onboarding_status,
    member_count BIGINT,
    joined_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
BEGIN
    IF NOT private.user_is_group_member(p_group_id) THEN
        RAISE EXCEPTION 'group membership required';
    END IF;

    RETURN QUERY
    SELECT
        t.id,
        t.organization_code,
        t.name,
        t.trade_name,
        tgm.status,
        t.status,
        t.onboarding_status,
        (
            SELECT COUNT(*)::BIGINT
            FROM public.user_tenant_memberships m
            WHERE m.tenant_id = t.id AND m.is_active = TRUE
        ),
        tgm.joined_at
    FROM public.tenant_group_memberships tgm
    JOIN public.tenants t ON t.id = tgm.tenant_id
    WHERE tgm.group_id = p_group_id
      AND tgm.status IN ('ACTIVE', 'SUSPENDED', 'EXIT_PENDING')
    ORDER BY t.name;
END;
$$;

CREATE OR REPLACE FUNCTION public.list_group_organizations(p_group_id UUID)
RETURNS TABLE (
    tenant_id UUID,
    organization_code TEXT,
    name TEXT,
    trade_name TEXT,
    membership_status public.tenant_group_membership_status,
    tenant_status public.tenant_account_status,
    onboarding_status public.tenant_onboarding_status,
    member_count BIGINT,
    joined_at TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, private
AS $$
    SELECT * FROM private.list_group_organizations(p_group_id);
$$;

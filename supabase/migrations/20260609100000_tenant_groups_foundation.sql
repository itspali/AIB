-- ====================================================================
-- AIB SMART ERP - TENANT GROUPS & MULTI-ORG MEMBERSHIPS (Task Sequence 22)
-- Migration: 20260609100000_tenant_groups_foundation.sql
-- ====================================================================

-- 1. ENUMS
CREATE TYPE public.group_account_status AS ENUM ('TRIAL', 'ACTIVE', 'PAST_DUE', 'SUSPENDED');
CREATE TYPE public.group_membership_role AS ENUM ('GROUP_OWNER', 'GROUP_ADMIN', 'GROUP_VIEWER');
CREATE TYPE public.tenant_group_membership_status AS ENUM (
    'ACTIVE', 'SUSPENDED', 'EXIT_PENDING', 'EXITED', 'DECOMMISSIONED'
);

-- 2. TENANT GROUPS
CREATE TABLE public.tenant_groups (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            TEXT NOT NULL,
    legal_name      TEXT,
    trade_name      TEXT,
    logo_url        TEXT,
    primary_email   TEXT NOT NULL,
    primary_phone   VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    status          public.group_account_status NOT NULL DEFAULT 'TRIAL',
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    metadata_json   JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER tenant_groups_set_updated_at
    BEFORE UPDATE ON public.tenant_groups
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

-- 3. TENANTS.GROUP_ID
ALTER TABLE public.tenants
    ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES public.tenant_groups (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS tenants_group_id_idx ON public.tenants (group_id);

-- 4. USER TENANT MEMBERSHIPS (create before backfill)
CREATE TABLE public.user_tenant_memberships (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                 UUID NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
    tenant_id               UUID NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
    role                    public.user_role NOT NULL DEFAULT 'STAFF',
    assigned_location_id    UUID,
    email                   TEXT NOT NULL,
    is_active               BOOLEAN NOT NULL DEFAULT TRUE,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT user_tenant_memberships_email_lowercase_chk
        CHECK (email = lower(email)),
    CONSTRAINT user_tenant_memberships_role_location_scope_chk
        CHECK (
            (role IN ('OWNER', 'ADMIN') AND assigned_location_id IS NULL)
            OR
            (role IN ('MANAGER', 'STAFF') AND assigned_location_id IS NOT NULL)
        ),
    CONSTRAINT user_tenant_memberships_user_tenant_unique
        UNIQUE (user_id, tenant_id),
    CONSTRAINT user_tenant_memberships_tenant_email_unique
        UNIQUE (tenant_id, email)
);

CREATE UNIQUE INDEX user_tenant_memberships_tenant_id_id_unique
    ON public.user_tenant_memberships (tenant_id, id);

ALTER TABLE public.user_tenant_memberships
    ADD CONSTRAINT user_tenant_memberships_assigned_location_tenant_fk
    FOREIGN KEY (tenant_id, assigned_location_id)
    REFERENCES public.tenant_locations (tenant_id, id)
    ON DELETE SET NULL
    DEFERRABLE INITIALLY DEFERRED;

CREATE TRIGGER user_tenant_memberships_set_updated_at
    BEFORE UPDATE ON public.user_tenant_memberships
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

-- 5. BACKFILL MEMBERSHIPS FROM LEGACY USERS
INSERT INTO public.user_tenant_memberships (
    user_id,
    tenant_id,
    role,
    assigned_location_id,
    email,
    is_active,
    created_at,
    updated_at
)
SELECT
    u.id,
    u.tenant_id,
    u.role,
    CASE
        WHEN u.role IN ('OWNER', 'ADMIN') THEN NULL
        ELSE COALESCE(
            u.assigned_location_id,
            (
                SELECT tl.id
                FROM public.tenant_locations tl
                WHERE tl.tenant_id = u.tenant_id
                  AND tl.is_active = TRUE
                ORDER BY tl.created_at
                LIMIT 1
            )
        )
    END,
    u.email,
    u.is_active,
    u.created_at,
    u.updated_at
FROM public.users u
WHERE u.tenant_id IS NOT NULL
  AND (
    u.role IN ('OWNER', 'ADMIN')
    OR u.assigned_location_id IS NOT NULL
    OR EXISTS (
        SELECT 1
        FROM public.tenant_locations tl
        WHERE tl.tenant_id = u.tenant_id
          AND tl.is_active = TRUE
    )
  )
ON CONFLICT (user_id, tenant_id) DO NOTHING;

-- 6. GROUP MEMBERSHIP TABLES
CREATE TABLE public.tenant_group_memberships (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id            UUID NOT NULL REFERENCES public.tenant_groups (id) ON DELETE CASCADE,
    tenant_id           UUID NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
    status              public.tenant_group_membership_status NOT NULL DEFAULT 'ACTIVE',
    joined_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    exited_at           TIMESTAMPTZ,
    joined_by_user_id   UUID REFERENCES public.users (id) ON DELETE SET NULL,
    exited_by_user_id   UUID REFERENCES public.users (id) ON DELETE SET NULL,
    exit_reason         TEXT,
    metadata_json       JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX tenant_group_memberships_active_unique
    ON public.tenant_group_memberships (group_id, tenant_id)
    WHERE status IN ('ACTIVE', 'SUSPENDED', 'EXIT_PENDING');

CREATE TRIGGER tenant_group_memberships_set_updated_at
    BEFORE UPDATE ON public.tenant_group_memberships
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.group_memberships (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id    UUID NOT NULL REFERENCES public.tenant_groups (id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
    role        public.group_membership_role NOT NULL DEFAULT 'GROUP_VIEWER',
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT group_memberships_group_user_unique UNIQUE (group_id, user_id)
);

CREATE TRIGGER group_memberships_set_updated_at
    BEFORE UPDATE ON public.group_memberships
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.group_membership_events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id        UUID NOT NULL REFERENCES public.tenant_groups (id) ON DELETE CASCADE,
    tenant_id       UUID REFERENCES public.tenants (id) ON DELETE SET NULL,
    event_type      TEXT NOT NULL,
    actor_user_id   UUID REFERENCES public.users (id) ON DELETE SET NULL,
    payload_json    JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. DROP LEGACY USERS TENANT BINDING
DROP TRIGGER IF EXISTS users_sync_app_metadata ON public.users;
DROP TRIGGER IF EXISTS users_enforce_self_update_guard ON public.users;

-- Consolidated policies from 20260548000000_rls_initplan_optimization.sql reference users.tenant_id.
DROP POLICY IF EXISTS users_select ON public.users;
DROP POLICY IF EXISTS users_update ON public.users;
DROP POLICY IF EXISTS users_delete_owner ON public.users;

-- Legacy policy names (pre-consolidation).
DROP POLICY IF EXISTS users_select_tenant ON public.users;
DROP POLICY IF EXISTS users_select_admin ON public.users;
DROP POLICY IF EXISTS users_select_self ON public.users;
DROP POLICY IF EXISTS users_insert_admin ON public.users;
DROP POLICY IF EXISTS users_update_admin ON public.users;
DROP POLICY IF EXISTS users_update_self ON public.users;

ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_assigned_location_tenant_fk;
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_location_scope_chk;
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_tenant_email_unique;

ALTER TABLE public.users DROP COLUMN IF EXISTS tenant_id;
ALTER TABLE public.users DROP COLUMN IF EXISTS role;
ALTER TABLE public.users DROP COLUMN IF EXISTS assigned_location_id;

-- 8. PRIVATE HELPERS
CREATE OR REPLACE FUNCTION private.current_group_id()
RETURNS UUID
LANGUAGE sql
STABLE
AS $$
    SELECT NULLIF(auth.jwt() -> 'app_metadata' ->> 'group_id', '')::uuid;
$$;

CREATE OR REPLACE FUNCTION private.user_has_tenant_membership(p_tenant_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.user_tenant_memberships m
        WHERE m.user_id = auth.uid()
          AND m.tenant_id = p_tenant_id
          AND m.is_active = TRUE
    );
$$;

CREATE OR REPLACE FUNCTION private.user_is_group_member(p_group_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.group_memberships gm
        WHERE gm.group_id = p_group_id
          AND gm.user_id = auth.uid()
          AND gm.is_active = TRUE
    );
$$;

CREATE OR REPLACE FUNCTION private.user_is_group_admin(p_group_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.group_memberships gm
        WHERE gm.group_id = p_group_id
          AND gm.user_id = auth.uid()
          AND gm.is_active = TRUE
          AND gm.role IN ('GROUP_OWNER'::public.group_membership_role, 'GROUP_ADMIN'::public.group_membership_role)
    );
$$;

CREATE OR REPLACE FUNCTION private.patch_auth_active_membership(
    p_user_id UUID,
    p_tenant_id UUID,
    p_role public.user_role,
    p_assigned_location_id UUID,
    p_group_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, private
AS $$
BEGIN
    UPDATE auth.users
    SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object(
        'tenant_id', p_tenant_id,
        'role', p_role,
        'assigned_location_id', p_assigned_location_id,
        'group_id', p_group_id
    )
    WHERE id = p_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION private.log_group_membership_event(
    p_group_id UUID,
    p_tenant_id UUID,
    p_event_type TEXT,
    p_payload JSONB DEFAULT '{}'::jsonb
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
BEGIN
    INSERT INTO public.group_membership_events (
        group_id,
        tenant_id,
        event_type,
        actor_user_id,
        payload_json
    )
    VALUES (
        p_group_id,
        p_tenant_id,
        p_event_type,
        auth.uid(),
        COALESCE(p_payload, '{}'::jsonb)
    );
END;
$$;

-- 9. USERS RLS (profile-only; membership-scoped, preserves 20260548000000 semantics)
CREATE POLICY users_select ON public.users
    FOR SELECT TO authenticated
    USING (
        (id = (SELECT auth.uid()))
        OR (
            EXISTS (
                SELECT 1
                FROM public.user_tenant_memberships actor
                WHERE actor.user_id = (SELECT auth.uid())
                  AND actor.tenant_id = private.current_tenant_id()
                  AND actor.is_active = TRUE
            )
            AND EXISTS (
                SELECT 1
                FROM public.user_tenant_memberships colleague
                WHERE colleague.user_id = users.id
                  AND colleague.tenant_id = private.current_tenant_id()
                  AND colleague.is_active = TRUE
            )
        )
    );

CREATE POLICY users_update ON public.users
    FOR UPDATE TO authenticated
    USING (
        (id = (SELECT auth.uid()))
        OR (
            private.current_user_role() = ANY (ARRAY['OWNER'::public.user_role, 'ADMIN'::public.user_role])
            AND EXISTS (
                SELECT 1
                FROM public.user_tenant_memberships m
                WHERE m.user_id = users.id
                  AND m.tenant_id = private.current_tenant_id()
                  AND m.is_active = TRUE
            )
        )
    )
    WITH CHECK (
        (id = (SELECT auth.uid()))
        OR (
            private.current_user_role() = ANY (ARRAY['OWNER'::public.user_role, 'ADMIN'::public.user_role])
            AND EXISTS (
                SELECT 1
                FROM public.user_tenant_memberships m
                WHERE m.user_id = users.id
                  AND m.tenant_id = private.current_tenant_id()
                  AND m.is_active = TRUE
            )
        )
    );

CREATE POLICY users_delete_owner ON public.users
    FOR DELETE TO authenticated
    USING (
        private.current_user_role() = 'OWNER'::public.user_role
        AND id <> (SELECT auth.uid())
        AND EXISTS (
            SELECT 1
            FROM public.user_tenant_memberships m
            WHERE m.user_id = users.id
              AND m.tenant_id = private.current_tenant_id()
              AND m.is_active = TRUE
        )
    );

-- 10. MEMBERSHIP RLS
ALTER TABLE public.user_tenant_memberships ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_tenant_memberships_select_tenant
    ON public.user_tenant_memberships
    FOR SELECT
    TO authenticated
    USING (tenant_id = private.current_tenant_id());

CREATE POLICY user_tenant_memberships_select_self
    ON public.user_tenant_memberships
    FOR SELECT
    TO authenticated
    USING (user_id = auth.uid() AND is_active = TRUE);

ALTER TABLE public.tenant_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_group_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_membership_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_groups_select_member
    ON public.tenant_groups
    FOR SELECT
    TO authenticated
    USING (
        private.user_is_group_member(id)
        OR EXISTS (
            SELECT 1
            FROM public.tenants t
            WHERE t.group_id = tenant_groups.id
              AND t.id = private.current_tenant_id()
        )
    );

CREATE POLICY group_memberships_select_self
    ON public.group_memberships
    FOR SELECT
    TO authenticated
    USING (user_id = auth.uid() AND is_active = TRUE);

CREATE POLICY tenant_group_memberships_select_scope
    ON public.tenant_group_memberships
    FOR SELECT
    TO authenticated
    USING (
        private.user_is_group_member(group_id)
        OR tenant_id = private.current_tenant_id()
    );

CREATE POLICY group_membership_events_select_scope
    ON public.group_membership_events
    FOR SELECT
    TO authenticated
    USING (private.user_is_group_member(group_id));

-- 11. SELF-UPDATE GUARDS
CREATE OR REPLACE FUNCTION private.enforce_users_self_update_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN NEW;
    END IF;

    IF OLD.id = auth.uid()
       AND private.current_user_role() NOT IN ('OWNER', 'ADMIN')
    THEN
        IF NEW.is_active IS DISTINCT FROM OLD.is_active
           OR NEW.email IS DISTINCT FROM OLD.email
           OR NEW.job_title IS DISTINCT FROM OLD.job_title
           OR NEW.last_login_at IS DISTINCT FROM OLD.last_login_at
        THEN
            RAISE EXCEPTION
                'users may only self-update first_name, last_name, phone_number, and avatar_url';
        END IF;

        IF NEW.metadata_json IS DISTINCT FROM OLD.metadata_json THEN
            IF current_setting('app.duty_status_update', true) = 'true'
               AND (NEW.metadata_json - 'duty_status') IS NOT DISTINCT FROM (OLD.metadata_json - 'duty_status')
            THEN
                NULL;
            ELSE
                RAISE EXCEPTION
                    'users may only self-update first_name, last_name, phone_number, and avatar_url';
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER users_enforce_self_update_guard
    BEFORE UPDATE ON public.users
    FOR EACH ROW
    EXECUTE FUNCTION private.enforce_users_self_update_guard();

CREATE OR REPLACE FUNCTION private.sync_membership_app_metadata()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, private
AS $$
DECLARE
    v_active_tenant_id UUID;
    v_group_id UUID;
BEGIN
    SELECT NULLIF(raw_app_meta_data ->> 'tenant_id', '')::uuid
    INTO v_active_tenant_id
    FROM auth.users
    WHERE id = NEW.user_id;

    IF v_active_tenant_id IS DISTINCT FROM NEW.tenant_id THEN
        RETURN NEW;
    END IF;

    SELECT t.group_id
    INTO v_group_id
    FROM public.tenants t
    WHERE t.id = NEW.tenant_id;

    PERFORM private.patch_auth_active_membership(
        NEW.user_id,
        NEW.tenant_id,
        NEW.role,
        NEW.assigned_location_id,
        v_group_id
    );

    RETURN NEW;
END;
$$;

CREATE TRIGGER user_tenant_memberships_sync_app_metadata
    AFTER INSERT OR UPDATE OF tenant_id, role, assigned_location_id, is_active
    ON public.user_tenant_memberships
    FOR EACH ROW
    WHEN (NEW.is_active = TRUE)
    EXECUTE FUNCTION private.sync_membership_app_metadata();

-- 12. AUTH PROVISIONING
CREATE OR REPLACE FUNCTION private.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, private
AS $$
DECLARE
    v_tenant_id UUID;
    v_role public.user_role;
    v_location_id UUID;
    v_first_name TEXT;
    v_last_name TEXT;
    v_email TEXT;
BEGIN
    v_tenant_id := NULLIF(NEW.raw_app_meta_data ->> 'tenant_id', '')::uuid;

    IF v_tenant_id IS NULL THEN
        IF NEW.raw_app_meta_data @> '{"provision_deferred": true}'::jsonb
           OR COALESCE(NEW.raw_app_meta_data ->> 'provision_deferred', '') = 'true'
           OR NEW.raw_user_meta_data @> '{"signup_pending": true}'::jsonb
           OR COALESCE(NEW.raw_user_meta_data ->> 'signup_pending', '') = 'true'
        THEN
            RETURN NEW;
        END IF;

        RAISE EXCEPTION
            'auth user % cannot be provisioned: app_metadata.tenant_id is required',
            NEW.id;
    END IF;

    v_role := COALESCE(
        NULLIF(NEW.raw_app_meta_data ->> 'role', '')::public.user_role,
        'STAFF'::public.user_role
    );
    v_location_id := NULLIF(NEW.raw_app_meta_data ->> 'assigned_location_id', '')::uuid;
    v_first_name := COALESCE(
        NULLIF(NEW.raw_app_meta_data ->> 'first_name', ''),
        NULLIF(NEW.raw_user_meta_data ->> 'first_name', ''),
        ''
    );
    v_last_name := COALESCE(
        NULLIF(NEW.raw_app_meta_data ->> 'last_name', ''),
        NULLIF(NEW.raw_user_meta_data ->> 'last_name', ''),
        ''
    );
    v_email := lower(NEW.email);

    INSERT INTO public.users (
        id, first_name, last_name, email, phone_number, avatar_url
    )
    VALUES (
        NEW.id,
        v_first_name,
        v_last_name,
        v_email,
        NULLIF(NEW.raw_app_meta_data ->> 'phone_number', ''),
        NULLIF(NEW.raw_app_meta_data ->> 'avatar_url', '')
    )
    ON CONFLICT (id) DO UPDATE
    SET
        first_name = EXCLUDED.first_name,
        last_name = EXCLUDED.last_name,
        email = EXCLUDED.email;

    INSERT INTO public.user_tenant_memberships (
        user_id, tenant_id, role, assigned_location_id, email
    )
    VALUES (
        NEW.id, v_tenant_id, v_role, v_location_id, v_email
    )
    ON CONFLICT (user_id, tenant_id) DO UPDATE
    SET
        role = EXCLUDED.role,
        assigned_location_id = EXCLUDED.assigned_location_id,
        email = EXCLUDED.email,
        is_active = TRUE,
        updated_at = NOW();

    RETURN NEW;
END;
$$;

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
        name, primary_email, primary_phone, onboarding_source, onboarding_status
    )
    VALUES (
        btrim(company_name), v_normalized_email, 'PENDING', 'DIRECT_SAAS', 'ACCOUNT_CREATED'
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

-- 13. PATCH RPCs THAT READ users.tenant_id
CREATE OR REPLACE FUNCTION private.update_user_duty_status(p_status TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_tenant_id UUID;
    v_status TEXT;
BEGIN
    v_tenant_id := private.current_tenant_id();
    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'tenant context missing from session';
    END IF;

    v_status := upper(btrim(p_status));
    IF v_status NOT IN ('AVAILABLE', 'IN_MEETING', 'AWAY_ON_BREAK') THEN
        RAISE EXCEPTION 'invalid duty status';
    END IF;

    IF NOT private.user_has_tenant_membership(v_tenant_id) THEN
        RAISE EXCEPTION 'user profile not found for tenant';
    END IF;

    PERFORM set_config('app.duty_status_update', 'true', true);

    UPDATE public.users
    SET metadata_json = COALESCE(metadata_json, '{}'::jsonb) || jsonb_build_object('duty_status', v_status)
    WHERE id = auth.uid()
      AND is_active = TRUE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'user profile not found for tenant';
    END IF;
END;
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
        FROM public.user_tenant_memberships m
        WHERE m.user_id = p_user_id
          AND m.tenant_id = v_tenant_id
          AND m.is_active = TRUE
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
            configuration_metadata = jsonb_build_object('granted_by', auth.uid(), 'granted_at', NOW()),
            updated_at = NOW()
        WHERE tenant_id = v_tenant_id
          AND scope_level = 'FUNCTIONAL_MODULE'
          AND registry_key = 'allow_organization_settings_modification'
          AND target_reference_id = p_user_id;
    ELSE
        INSERT INTO public.workspace_control_registry (
            tenant_id, scope_level, registry_key, target_reference_id, configuration_metadata
        )
        VALUES (
            v_tenant_id,
            'FUNCTIONAL_MODULE',
            'allow_organization_settings_modification',
            p_user_id,
            jsonb_build_object('granted_by', auth.uid(), 'granted_at', NOW())
        );
    END IF;
END;
$$;

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

    SELECT m.role INTO v_role
    FROM public.user_tenant_memberships m
    WHERE m.user_id = v_user_id
      AND m.tenant_id = v_tenant_id
      AND m.is_active = TRUE;

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

    SELECT m.role INTO v_role
    FROM public.user_tenant_memberships m
    WHERE m.user_id = v_user_id
      AND m.tenant_id = v_tenant_id
      AND m.is_active = TRUE;

    IF v_role IN ('OWNER'::public.user_role, 'ADMIN'::public.user_role) THEN
        RETURN TRUE;
    END IF;

    RETURN EXISTS (
        SELECT 1
        FROM public.workspace_control_registry
        WHERE tenant_id = v_tenant_id
          AND registry_key = 'allow_uom_settings_modification'
          AND target_reference_id = v_user_id
    );
END;
$$;

-- 14. GROUP RPCs
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

    INSERT INTO public.tenant_groups (name, primary_email, primary_phone)
    VALUES (btrim(p_name), v_email, COALESCE(NULLIF(btrim(p_primary_phone), ''), 'PENDING'))
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

CREATE OR REPLACE FUNCTION private.update_tenant_group_profile(
    p_group_id UUID,
    p_name TEXT,
    p_legal_name TEXT DEFAULT NULL,
    p_trade_name TEXT DEFAULT NULL,
    p_primary_email TEXT DEFAULT NULL,
    p_primary_phone TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
BEGIN
    IF NOT private.user_is_group_admin(p_group_id) THEN
        RAISE EXCEPTION 'group admin access required';
    END IF;

    UPDATE public.tenant_groups
    SET
        name = COALESCE(NULLIF(btrim(p_name), ''), name),
        legal_name = NULLIF(btrim(p_legal_name), ''),
        trade_name = NULLIF(btrim(p_trade_name), ''),
        primary_email = COALESCE(lower(NULLIF(btrim(p_primary_email), '')), primary_email),
        primary_phone = COALESCE(NULLIF(btrim(p_primary_phone), ''), primary_phone),
        updated_at = NOW()
    WHERE id = p_group_id;
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
        name, primary_email, primary_phone, group_id, onboarding_source, onboarding_status
    )
    VALUES (
        btrim(p_company_name),
        v_email,
        COALESCE(NULLIF(btrim(p_primary_phone), ''), 'PENDING'),
        p_group_id,
        'DIRECT_SAAS',
        'ACCOUNT_CREATED'
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

CREATE OR REPLACE FUNCTION private.list_group_organizations(p_group_id UUID)
RETURNS TABLE (
    tenant_id UUID,
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

CREATE OR REPLACE FUNCTION private.request_group_exit(
    p_tenant_id UUID,
    p_reason TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, private
AS $$
DECLARE
    v_group_id UUID;
    v_membership_id UUID;
BEGIN
    v_group_id := (SELECT group_id FROM public.tenants WHERE id = p_tenant_id);

    IF v_group_id IS NULL THEN
        RAISE EXCEPTION 'organization is not part of a group';
    END IF;

    IF NOT (
        private.user_is_group_admin(v_group_id)
        OR (
            private.current_tenant_id() = p_tenant_id
            AND private.current_user_role() = 'OWNER'::public.user_role
        )
    ) THEN
        RAISE EXCEPTION 'organization owner or group admin required';
    END IF;

    SELECT tgm.id
    INTO v_membership_id
    FROM public.tenant_group_memberships tgm
    WHERE tgm.group_id = v_group_id
      AND tgm.tenant_id = p_tenant_id
      AND tgm.status = 'ACTIVE';

    IF v_membership_id IS NULL THEN
        RAISE EXCEPTION 'active group membership not found';
    END IF;

    UPDATE public.tenant_group_memberships
    SET status = 'EXIT_PENDING', exit_reason = NULLIF(btrim(p_reason), ''), updated_at = NOW()
    WHERE id = v_membership_id;

    PERFORM private.log_group_membership_event(
        v_group_id, p_tenant_id, 'EXIT_REQUESTED', jsonb_build_object('reason', p_reason)
    );
END;
$$;

CREATE OR REPLACE FUNCTION private.complete_group_exit(
    p_tenant_id UUID,
    p_reason TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, private
AS $$
DECLARE
    v_group_id UUID;
    v_membership_id UUID;
BEGIN
    v_group_id := (SELECT group_id FROM public.tenants WHERE id = p_tenant_id);

    IF v_group_id IS NULL THEN
        RAISE EXCEPTION 'organization is not part of a group';
    END IF;

    IF NOT (
        private.user_is_group_admin(v_group_id)
        OR (
            private.current_tenant_id() = p_tenant_id
            AND private.current_user_role() = 'OWNER'::public.user_role
        )
    ) THEN
        RAISE EXCEPTION 'organization owner or group admin required';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.stock_transfers st
        WHERE st.tenant_id = p_tenant_id
          AND st.current_status = 'DISPATCHED_IN_TRANSIT'
    ) THEN
        RAISE EXCEPTION 'cannot exit group: organization has stock in transit';
    END IF;

    SELECT tgm.id
    INTO v_membership_id
    FROM public.tenant_group_memberships tgm
    WHERE tgm.group_id = v_group_id
      AND tgm.tenant_id = p_tenant_id
      AND tgm.status IN ('ACTIVE', 'EXIT_PENDING');

    IF v_membership_id IS NULL THEN
        RAISE EXCEPTION 'group membership not found';
    END IF;

    UPDATE public.tenant_group_memberships
    SET
        status = 'EXITED',
        exited_at = NOW(),
        exited_by_user_id = auth.uid(),
        exit_reason = NULLIF(btrim(p_reason), ''),
        updated_at = NOW()
    WHERE id = v_membership_id;

    UPDATE public.tenants
    SET group_id = NULL, updated_at = NOW()
    WHERE id = p_tenant_id;

    PERFORM private.log_group_membership_event(
        v_group_id, p_tenant_id, 'EXIT_COMPLETED', jsonb_build_object('reason', p_reason)
    );
END;
$$;

CREATE OR REPLACE FUNCTION private.switch_active_tenant_membership(p_tenant_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, private
AS $$
DECLARE
    v_membership public.user_tenant_memberships%ROWTYPE;
    v_group_id UUID;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'authentication required';
    END IF;

    SELECT *
    INTO v_membership
    FROM public.user_tenant_memberships m
    WHERE m.user_id = auth.uid()
      AND m.tenant_id = p_tenant_id
      AND m.is_active = TRUE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'tenant membership not found';
    END IF;

    SELECT t.group_id INTO v_group_id FROM public.tenants t WHERE t.id = p_tenant_id;

    PERFORM private.patch_auth_active_membership(
        auth.uid(),
        v_membership.tenant_id,
        v_membership.role,
        v_membership.assigned_location_id,
        v_group_id
    );

    RETURN jsonb_build_object(
        'tenant_id', v_membership.tenant_id,
        'role', v_membership.role,
        'group_id', v_group_id
    );
END;
$$;

-- 15. PUBLIC WRAPPERS
CREATE OR REPLACE FUNCTION public.create_tenant_group(
    p_name TEXT,
    p_primary_email TEXT,
    p_primary_phone TEXT DEFAULT 'PENDING'
)
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, private
AS $$
    SELECT private.create_tenant_group(p_name, p_primary_email, p_primary_phone);
$$;

CREATE OR REPLACE FUNCTION public.update_tenant_group_profile(
    p_group_id UUID,
    p_name TEXT,
    p_legal_name TEXT DEFAULT NULL,
    p_trade_name TEXT DEFAULT NULL,
    p_primary_email TEXT DEFAULT NULL,
    p_primary_phone TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, private
AS $$
    SELECT private.update_tenant_group_profile(
        p_group_id, p_name, p_legal_name, p_trade_name, p_primary_email, p_primary_phone
    );
$$;

CREATE OR REPLACE FUNCTION public.create_group_organization(
    p_group_id UUID,
    p_company_name TEXT,
    p_primary_email TEXT,
    p_primary_phone TEXT DEFAULT 'PENDING'
)
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, private
AS $$
    SELECT private.create_group_organization(
        p_group_id, p_company_name, p_primary_email, p_primary_phone
    );
$$;

CREATE OR REPLACE FUNCTION public.list_group_organizations(p_group_id UUID)
RETURNS TABLE (
    tenant_id UUID,
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

CREATE OR REPLACE FUNCTION public.request_group_exit(p_tenant_id UUID, p_reason TEXT DEFAULT NULL)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, private
AS $$
    SELECT private.request_group_exit(p_tenant_id, p_reason);
$$;

CREATE OR REPLACE FUNCTION public.complete_group_exit(p_tenant_id UUID, p_reason TEXT DEFAULT NULL)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, private
AS $$
    SELECT private.complete_group_exit(p_tenant_id, p_reason);
$$;

CREATE OR REPLACE FUNCTION public.switch_active_tenant_membership(p_tenant_id UUID)
RETURNS JSONB
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, private
AS $$
    SELECT private.switch_active_tenant_membership(p_tenant_id);
$$;

-- 16. GRANTS
GRANT EXECUTE ON FUNCTION private.current_group_id() TO authenticated;
GRANT EXECUTE ON FUNCTION private.user_has_tenant_membership(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION private.user_is_group_member(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION private.user_is_group_admin(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.create_tenant_group(TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_tenant_group(TEXT, TEXT, TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.update_tenant_group_profile(UUID, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_tenant_group_profile(UUID, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.create_group_organization(UUID, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_group_organization(UUID, TEXT, TEXT, TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.list_group_organizations(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_group_organizations(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.request_group_exit(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_group_exit(UUID, TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.complete_group_exit(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_group_exit(UUID, TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.switch_active_tenant_membership(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.switch_active_tenant_membership(UUID) TO authenticated;

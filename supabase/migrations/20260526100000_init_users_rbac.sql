-- ====================================================================
-- AIB SMART ERP - USER IDENTITY & RBAC (Milestone 1)
-- ====================================================================
-- Frozen decisions:
--   - Profile self-service: first_name, last_name, phone_number, avatar_url only
--   - Multiple OWNER roles permitted per tenant
--   - No seed rows; auth.users INSERT auto-provisions public.users
-- ====================================================================

-- 1. RBAC ENUM
CREATE TYPE user_role AS ENUM ('OWNER', 'ADMIN', 'MANAGER', 'STAFF');

-- 2. PRIVATE SCHEMA & JWT HELPERS
CREATE SCHEMA IF NOT EXISTS private;

CREATE OR REPLACE FUNCTION private.current_tenant_id()
RETURNS UUID
LANGUAGE sql
STABLE
AS $$
    SELECT NULLIF(auth.jwt() -> 'app_metadata' ->> 'tenant_id', '')::uuid;
$$;

CREATE OR REPLACE FUNCTION private.current_user_role()
RETURNS user_role
LANGUAGE sql
STABLE
AS $$
    SELECT NULLIF(auth.jwt() -> 'app_metadata' ->> 'role', '')::user_role;
$$;

CREATE OR REPLACE FUNCTION private.current_assigned_location_id()
RETURNS UUID
LANGUAGE sql
STABLE
AS $$
    SELECT NULLIF(auth.jwt() -> 'app_metadata' ->> 'assigned_location_id', '')::uuid;
$$;

CREATE OR REPLACE FUNCTION private.user_has_location_access(p_location_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
    SELECT CASE
        WHEN private.current_user_role() IN ('OWNER', 'ADMIN') THEN TRUE
        WHEN private.current_assigned_location_id() IS NULL THEN FALSE
        ELSE p_location_id = private.current_assigned_location_id()
    END;
$$;

-- 3. SUPPORTING INDEX FOR COMPOSITE TENANT/LOCATION FK
CREATE UNIQUE INDEX IF NOT EXISTS tenant_locations_tenant_id_id_unique
    ON public.tenant_locations (tenant_id, id);

-- 4. PUBLIC USERS TABLE
CREATE TABLE public.users (
    id                      UUID PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
    tenant_id               UUID NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
    role                    user_role NOT NULL DEFAULT 'STAFF',
    assigned_location_id    UUID,

    first_name              TEXT NOT NULL,
    last_name               TEXT NOT NULL,
    email                   TEXT NOT NULL,
    phone_number            VARCHAR(30),
    avatar_url              TEXT,
    job_title               TEXT,

    is_active               BOOLEAN NOT NULL DEFAULT TRUE,
    last_login_at           TIMESTAMPTZ,
    metadata_json           JSONB NOT NULL DEFAULT '{}'::jsonb,

    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT users_email_lowercase_chk
        CHECK (email = lower(email)),
    CONSTRAINT users_role_location_scope_chk
        CHECK (
            (role IN ('OWNER', 'ADMIN') AND assigned_location_id IS NULL)
            OR
            (role IN ('MANAGER', 'STAFF') AND assigned_location_id IS NOT NULL)
        ),
    CONSTRAINT users_tenant_email_unique
        UNIQUE (tenant_id, email)
);

ALTER TABLE public.users
    ADD CONSTRAINT users_assigned_location_tenant_fk
    FOREIGN KEY (tenant_id, assigned_location_id)
    REFERENCES public.tenant_locations (tenant_id, id)
    ON DELETE SET NULL
    DEFERRABLE INITIALLY DEFERRED;

-- 5. REUSABLE updated_at TRIGGER
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

CREATE TRIGGER users_set_updated_at
    BEFORE UPDATE ON public.users
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

-- 6. AUTH -> public.users AUTO-PROVISIONING
-- Provisioning contract (set via auth.admin.createUser app_metadata):
--   tenant_id              (required)
--   role                   (optional, defaults STAFF)
--   assigned_location_id   (required for MANAGER/STAFF; must be absent/null for OWNER/ADMIN)
--   first_name, last_name  (optional; falls back to user_metadata then empty string)
CREATE OR REPLACE FUNCTION private.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, private
AS $$
DECLARE
    v_tenant_id UUID;
    v_role user_role;
    v_location_id UUID;
    v_first_name TEXT;
    v_last_name TEXT;
BEGIN
    v_tenant_id := NULLIF(NEW.raw_app_meta_data ->> 'tenant_id', '')::uuid;

    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION
            'auth user % cannot be provisioned: app_metadata.tenant_id is required',
            NEW.id;
    END IF;

    v_role := COALESCE(
        NULLIF(NEW.raw_app_meta_data ->> 'role', '')::user_role,
        'STAFF'::user_role
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

    INSERT INTO public.users (
        id,
        tenant_id,
        role,
        assigned_location_id,
        first_name,
        last_name,
        email,
        phone_number,
        avatar_url
    )
    VALUES (
        NEW.id,
        v_tenant_id,
        v_role,
        v_location_id,
        v_first_name,
        v_last_name,
        lower(NEW.email),
        NULLIF(NEW.raw_app_meta_data ->> 'phone_number', ''),
        NULLIF(NEW.raw_app_meta_data ->> 'avatar_url', '')
    );

    RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION private.handle_new_auth_user();

-- 7. public.users -> auth.users app_metadata SYNC
CREATE OR REPLACE FUNCTION private.sync_user_app_metadata()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, private
AS $$
BEGIN
    UPDATE auth.users
    SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object(
        'tenant_id', NEW.tenant_id,
        'role', NEW.role,
        'assigned_location_id', NEW.assigned_location_id
    )
    WHERE id = NEW.id;

    RETURN NEW;
END;
$$;

CREATE TRIGGER users_sync_app_metadata
    AFTER INSERT OR UPDATE OF tenant_id, role, assigned_location_id, is_active
    ON public.users
    FOR EACH ROW
    EXECUTE FUNCTION private.sync_user_app_metadata();

-- 8. SELF-SERVICE UPDATE GUARD (blocks security-field mutation on own row)
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
        IF NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
           OR NEW.role IS DISTINCT FROM OLD.role
           OR NEW.assigned_location_id IS DISTINCT FROM OLD.assigned_location_id
           OR NEW.is_active IS DISTINCT FROM OLD.is_active
           OR NEW.email IS DISTINCT FROM OLD.email
           OR NEW.job_title IS DISTINCT FROM OLD.job_title
           OR NEW.metadata_json IS DISTINCT FROM OLD.metadata_json
           OR NEW.last_login_at IS DISTINCT FROM OLD.last_login_at
        THEN
            RAISE EXCEPTION
                'users may only self-update first_name, last_name, phone_number, and avatar_url';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER users_enforce_self_update_guard
    BEFORE UPDATE ON public.users
    FOR EACH ROW
    EXECUTE FUNCTION private.enforce_users_self_update_guard();

-- 9. WIRE tenants.created_by_user_id FK
ALTER TABLE public.tenants
    ADD CONSTRAINT tenants_created_by_user_id_fk
    FOREIGN KEY (created_by_user_id) REFERENCES public.users (id) ON DELETE SET NULL;

-- 10. ROW-LEVEL SECURITY
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY users_select_tenant
    ON public.users
    FOR SELECT
    TO authenticated
    USING (
        tenant_id = private.current_tenant_id()
        AND is_active = TRUE
    );

CREATE POLICY users_select_self
    ON public.users
    FOR SELECT
    TO authenticated
    USING (id = auth.uid());

CREATE POLICY users_select_admin
    ON public.users
    FOR SELECT
    TO authenticated
    USING (
        tenant_id = private.current_tenant_id()
        AND private.current_user_role() IN ('OWNER', 'ADMIN')
    );

CREATE POLICY users_insert_admin
    ON public.users
    FOR INSERT
    TO authenticated
    WITH CHECK (
        tenant_id = private.current_tenant_id()
        AND private.current_user_role() IN ('OWNER', 'ADMIN')
    );

CREATE POLICY users_update_admin
    ON public.users
    FOR UPDATE
    TO authenticated
    USING (
        tenant_id = private.current_tenant_id()
        AND private.current_user_role() IN ('OWNER', 'ADMIN')
    )
    WITH CHECK (
        tenant_id = private.current_tenant_id()
        AND private.current_user_role() IN ('OWNER', 'ADMIN')
    );

CREATE POLICY users_update_self
    ON public.users
    FOR UPDATE
    TO authenticated
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());

CREATE POLICY users_delete_owner
    ON public.users
    FOR DELETE
    TO authenticated
    USING (
        tenant_id = private.current_tenant_id()
        AND private.current_user_role() = 'OWNER'
        AND id <> auth.uid()
    );

-- 11. SCHEMA GRANTS (RLS policies reference private helpers)
GRANT USAGE ON SCHEMA private TO postgres, authenticated, service_role;

GRANT EXECUTE ON FUNCTION private.current_tenant_id() TO authenticated;
GRANT EXECUTE ON FUNCTION private.current_user_role() TO authenticated;
GRANT EXECUTE ON FUNCTION private.current_assigned_location_id() TO authenticated;
GRANT EXECUTE ON FUNCTION private.user_has_location_access(UUID) TO authenticated;

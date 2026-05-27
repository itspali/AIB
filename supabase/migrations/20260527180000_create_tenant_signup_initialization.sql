-- ====================================================================
-- AIB SMART ERP - PUBLIC TENANT SIGNUP INITIALIZATION (Task Sequence 9)
-- ====================================================================
-- Deferred auth provisioning for self-service B2B signup, plus atomic
-- tenant + OWNER user bootstrap via initialize_new_tenant RPC.
-- ====================================================================

-- 1. DEFER auto-provisioning when signup_pending flag is set on auth.users
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

-- 2. ATOMIC tenant + OWNER bootstrap (called after deferred signUp)
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

    SELECT tenant_id
    INTO v_existing_tenant_id
    FROM public.users
    WHERE id = auth_user_id;

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
        onboarding_status
    )
    VALUES (
        btrim(company_name),
        v_normalized_email,
        'PENDING',
        'DIRECT_SAAS',
        'ACCOUNT_CREATED'
    )
    RETURNING id INTO v_tenant_id;

    INSERT INTO public.users (
        id,
        tenant_id,
        role,
        assigned_location_id,
        first_name,
        last_name,
        email
    )
    VALUES (
        auth_user_id,
        v_tenant_id,
        'OWNER',
        NULL,
        v_first_name,
        v_last_name,
        v_normalized_email
    );

    UPDATE auth.users
    SET
        raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object(
            'tenant_id', v_tenant_id,
            'role', 'OWNER',
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

-- 3. PUBLIC RPC WRAPPER (Supabase JS client)
CREATE OR REPLACE FUNCTION public.initialize_new_tenant(
    company_name TEXT,
    admin_name TEXT,
    user_email TEXT,
    auth_user_id UUID
)
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth, private
AS $$
    SELECT private.initialize_new_tenant(
        company_name,
        admin_name,
        user_email,
        auth_user_id
    );
$$;

REVOKE ALL ON FUNCTION public.initialize_new_tenant(TEXT, TEXT, TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.initialize_new_tenant(TEXT, TEXT, TEXT, UUID) TO authenticated;

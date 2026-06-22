-- Console operator / service-role tenant provisioning (signup recovery)

CREATE OR REPLACE FUNCTION private.provision_new_tenant(
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

    PERFORM private.seed_tenant_trial_subscription(v_tenant_id);

    RETURN v_tenant_id;
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
BEGIN
    IF auth.uid() IS NULL OR auth.uid() IS DISTINCT FROM auth_user_id THEN
        RAISE EXCEPTION 'unauthorized: caller must match auth_user_id';
    END IF;

    RETURN private.provision_new_tenant(company_name, admin_name, user_email, auth_user_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.console_initialize_new_tenant(
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
BEGIN
    IF auth.uid() IS NOT NULL AND NOT private.is_app_console_operator() THEN
        RAISE EXCEPTION 'unauthorized: console operator required';
    END IF;

    RETURN private.provision_new_tenant(company_name, admin_name, user_email, auth_user_id);
END;
$$;

REVOKE ALL ON FUNCTION public.console_initialize_new_tenant(TEXT, TEXT, TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.console_initialize_new_tenant(TEXT, TEXT, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.console_initialize_new_tenant(TEXT, TEXT, TEXT, UUID) TO service_role;

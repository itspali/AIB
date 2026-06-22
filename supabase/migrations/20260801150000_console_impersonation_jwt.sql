-- Console impersonation: patch auth JWT tenant_id so RLS uses the impersonated tenant.
-- original_app_metadata is restored when impersonation ends.

ALTER TABLE public.app_console_impersonation_sessions
    ADD COLUMN IF NOT EXISTS original_app_metadata JSONB,
    ADD COLUMN IF NOT EXISTS jwt_applied_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION private.console_apply_impersonation_jwt(p_session_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, private
AS $$
DECLARE
    v_session public.app_console_impersonation_sessions%ROWTYPE;
    v_operator public.app_console_operators%ROWTYPE;
    v_current_meta JSONB;
    v_target_role public.user_role;
    v_group_id UUID;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'authentication required';
    END IF;

    SELECT *
    INTO v_operator
    FROM public.app_console_operators o
    WHERE o.user_id = auth.uid()
      AND o.is_active = TRUE
      AND o.revoked_at IS NULL;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'unauthorized: console operator required';
    END IF;

    SELECT *
    INTO v_session
    FROM public.app_console_impersonation_sessions s
    WHERE s.id = p_session_id
      AND s.operator_id = v_operator.id
      AND s.ended_at IS NULL
      AND s.expires_at > NOW();

    IF NOT FOUND THEN
        RAISE EXCEPTION 'impersonation session not found or expired';
    END IF;

    SELECT COALESCE(raw_app_meta_data, '{}'::jsonb)
    INTO v_current_meta
    FROM auth.users
    WHERE id = auth.uid();

    IF v_session.original_app_metadata IS NULL THEN
        UPDATE public.app_console_impersonation_sessions
        SET original_app_metadata = v_current_meta
        WHERE id = p_session_id;
    END IF;

    v_target_role := CASE
        WHEN v_session.mode = 'WRITE' THEN 'OWNER'::public.user_role
        ELSE 'ADMIN'::public.user_role
    END;

    SELECT t.group_id
    INTO v_group_id
    FROM public.tenants t
    WHERE t.id = v_session.target_tenant_id;

    PERFORM private.patch_auth_active_membership(
        auth.uid(),
        v_session.target_tenant_id,
        v_target_role,
        NULL,
        v_group_id
    );

    UPDATE auth.users
    SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object(
        'console_impersonation_session_id', p_session_id::text
    )
    WHERE id = auth.uid();

    UPDATE public.app_console_impersonation_sessions
    SET jwt_applied_at = NOW()
    WHERE id = p_session_id;
END;
$$;

CREATE OR REPLACE FUNCTION private.console_restore_impersonation_jwt(p_session_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, private
AS $$
DECLARE
    v_session public.app_console_impersonation_sessions%ROWTYPE;
    v_operator public.app_console_operators%ROWTYPE;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'authentication required';
    END IF;

    SELECT *
    INTO v_operator
    FROM public.app_console_operators o
    WHERE o.user_id = auth.uid()
      AND o.is_active = TRUE
      AND o.revoked_at IS NULL;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'unauthorized: console operator required';
    END IF;

    SELECT *
    INTO v_session
    FROM public.app_console_impersonation_sessions s
    WHERE s.id = p_session_id
      AND s.operator_id = v_operator.id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'impersonation session not found';
    END IF;

    IF v_session.original_app_metadata IS NOT NULL THEN
        UPDATE auth.users
        SET raw_app_meta_data = v_session.original_app_metadata
        WHERE id = auth.uid();
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.console_apply_impersonation_jwt(p_session_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, private
AS $$
BEGIN
    PERFORM private.console_apply_impersonation_jwt(p_session_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.console_restore_impersonation_jwt(p_session_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, private
AS $$
BEGIN
    PERFORM private.console_restore_impersonation_jwt(p_session_id);
END;
$$;

REVOKE ALL ON FUNCTION public.console_apply_impersonation_jwt(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.console_restore_impersonation_jwt(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.console_apply_impersonation_jwt(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.console_restore_impersonation_jwt(UUID) TO authenticated;

COMMENT ON FUNCTION public.console_apply_impersonation_jwt(UUID) IS
    'Patches auth JWT app_metadata to the impersonated tenant so RLS (private.current_tenant_id) matches the console session.';

COMMENT ON FUNCTION public.console_restore_impersonation_jwt(UUID) IS
    'Restores the operator JWT app_metadata snapshot taken when impersonation started.';

-- ====================================================================
-- AIB SMART ERP - USER AUTH SESSION TELEMETRY
-- Migration: 20260529130000_user_auth_sessions.sql
-- ====================================================================

CREATE TABLE public.user_auth_sessions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
    user_id             UUID NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
    auth_session_id     TEXT NOT NULL,
    os_browser          TEXT NOT NULL DEFAULT 'Unknown device',
    ip_address          TEXT,
    last_activity_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_current          BOOLEAN NOT NULL DEFAULT FALSE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT user_auth_sessions_user_session_unique UNIQUE (user_id, auth_session_id)
);

CREATE INDEX user_auth_sessions_tenant_user_idx
    ON public.user_auth_sessions (tenant_id, user_id, last_activity_at DESC);

CREATE TRIGGER user_auth_sessions_set_updated_at
    BEFORE UPDATE ON public.user_auth_sessions
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.user_auth_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_auth_sessions_select_self
    ON public.user_auth_sessions
    FOR SELECT
    TO authenticated
    USING (
        user_id = auth.uid()
        AND tenant_id = private.current_tenant_id()
    );

CREATE POLICY user_auth_sessions_insert_self
    ON public.user_auth_sessions
    FOR INSERT
    TO authenticated
    WITH CHECK (
        user_id = auth.uid()
        AND tenant_id = private.current_tenant_id()
    );

CREATE POLICY user_auth_sessions_update_self
    ON public.user_auth_sessions
    FOR UPDATE
    TO authenticated
    USING (
        user_id = auth.uid()
        AND tenant_id = private.current_tenant_id()
    )
    WITH CHECK (
        user_id = auth.uid()
        AND tenant_id = private.current_tenant_id()
    );

CREATE POLICY user_auth_sessions_delete_self
    ON public.user_auth_sessions
    FOR DELETE
    TO authenticated
    USING (
        user_id = auth.uid()
        AND tenant_id = private.current_tenant_id()
    );

CREATE OR REPLACE FUNCTION public.register_user_auth_session(
    p_auth_session_id TEXT,
    p_os_browser TEXT,
    p_ip_address TEXT DEFAULT NULL,
    p_is_current BOOLEAN DEFAULT FALSE
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_tenant_id UUID;
    v_row_id UUID;
BEGIN
    v_tenant_id := private.current_tenant_id();
    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'tenant context missing from session';
    END IF;

    IF btrim(p_auth_session_id) = '' THEN
        RAISE EXCEPTION 'auth session id is required';
    END IF;

    IF p_is_current THEN
        UPDATE public.user_auth_sessions
        SET is_current = FALSE
        WHERE user_id = auth.uid()
          AND tenant_id = v_tenant_id;
    END IF;

    INSERT INTO public.user_auth_sessions (
        tenant_id,
        user_id,
        auth_session_id,
        os_browser,
        ip_address,
        last_activity_at,
        is_current
    )
    VALUES (
        v_tenant_id,
        auth.uid(),
        btrim(p_auth_session_id),
        COALESCE(NULLIF(btrim(p_os_browser), ''), 'Unknown device'),
        NULLIF(btrim(p_ip_address), ''),
        NOW(),
        COALESCE(p_is_current, FALSE)
    )
    ON CONFLICT (user_id, auth_session_id)
    DO UPDATE SET
        os_browser = EXCLUDED.os_browser,
        ip_address = COALESCE(EXCLUDED.ip_address, public.user_auth_sessions.ip_address),
        last_activity_at = NOW(),
        is_current = EXCLUDED.is_current
    RETURNING id INTO v_row_id;

    RETURN v_row_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.revoke_other_auth_sessions(
    p_current_auth_session_id TEXT
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_tenant_id UUID;
    v_deleted INTEGER;
BEGIN
    v_tenant_id := private.current_tenant_id();
    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'tenant context missing from session';
    END IF;

    DELETE FROM public.user_auth_sessions
    WHERE user_id = auth.uid()
      AND tenant_id = v_tenant_id
      AND auth_session_id IS DISTINCT FROM btrim(p_current_auth_session_id);

    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    RETURN v_deleted;
END;
$$;

REVOKE ALL ON FUNCTION public.register_user_auth_session(TEXT, TEXT, TEXT, BOOLEAN) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.revoke_other_auth_sessions(TEXT) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.register_user_auth_session(TEXT, TEXT, TEXT, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_other_auth_sessions(TEXT) TO authenticated;

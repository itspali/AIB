-- ====================================================================
-- AIB SMART ERP - SCHEDULED TENANT WORKSPACE DELETION
-- Migration: 20260801140000_tenant_workspace_deletion_scheduling.sql
-- Grace period configurable via platform_config (App Console).
-- ====================================================================

CREATE TYPE public.tenant_deletion_request_status AS ENUM (
    'PENDING',
    'CANCELLED',
    'PURGED',
    'FAILED'
);

CREATE TABLE public.tenant_deletion_requests (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
    requested_by_user_id    UUID REFERENCES public.users (id) ON DELETE SET NULL,
    status                  public.tenant_deletion_request_status NOT NULL DEFAULT 'PENDING',
    confirmation_name       TEXT NOT NULL,
    backup_acknowledged     BOOLEAN NOT NULL DEFAULT FALSE,
    requested_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    scheduled_purge_at      TIMESTAMPTZ NOT NULL,
    grace_days              INTEGER NOT NULL,
    cancelled_at            TIMESTAMPTZ,
    cancelled_by_user_id    UUID REFERENCES public.users (id) ON DELETE SET NULL,
    purged_at               TIMESTAMPTZ,
    last_error              TEXT,
    metadata_json           JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT tenant_deletion_requests_grace_days_chk
        CHECK (grace_days >= 1 AND grace_days <= 365)
);

CREATE UNIQUE INDEX tenant_deletion_requests_pending_unique
    ON public.tenant_deletion_requests (tenant_id)
    WHERE status = 'PENDING';

CREATE INDEX tenant_deletion_requests_scheduled_purge_idx
    ON public.tenant_deletion_requests (scheduled_purge_at)
    WHERE status = 'PENDING';

CREATE TRIGGER tenant_deletion_requests_set_updated_at
    BEFORE UPDATE ON public.tenant_deletion_requests
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.platform_config (key, value) VALUES
    ('workspace_deletion_grace_days', '14'::jsonb)
ON CONFLICT (key) DO NOTHING;

ALTER TABLE public.tenant_deletion_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_deletion_requests_select_owner
    ON public.tenant_deletion_requests
    FOR SELECT
    TO authenticated
    USING (
        tenant_id = private.current_tenant_id()
        AND private.current_user_role() = 'OWNER'::public.user_role
    );

CREATE OR REPLACE FUNCTION private.platform_config_int(p_key TEXT, p_fallback INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_raw JSONB;
    v_value INTEGER;
BEGIN
    SELECT pc.value
    INTO v_raw
    FROM public.platform_config pc
    WHERE pc.key = p_key;

    IF v_raw IS NULL THEN
        RETURN p_fallback;
    END IF;

    IF jsonb_typeof(v_raw) = 'number' THEN
        v_value := (v_raw #>> '{}')::INTEGER;
    ELSIF jsonb_typeof(v_raw) = 'string' THEN
        v_value := NULLIF(btrim(v_raw #>> '{}'), '')::INTEGER;
    ELSE
        RETURN p_fallback;
    END IF;

    IF v_value IS NULL OR v_value < 1 OR v_value > 365 THEN
        RETURN p_fallback;
    END IF;

    RETURN v_value;
END;
$$;

CREATE OR REPLACE FUNCTION private.tenant_workspace_deletion_is_pending(p_tenant_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.tenant_deletion_requests r
        WHERE r.tenant_id = p_tenant_id
          AND r.status = 'PENDING'
    );
$$;

CREATE OR REPLACE FUNCTION private.assert_tenant_workspace_writable()
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
        RETURN;
    END IF;

    IF private.tenant_workspace_deletion_is_pending(v_tenant_id) THEN
        RAISE EXCEPTION
            'workspace is scheduled for deletion and is read-only; cancel the deletion from organization settings';
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION private.validate_workspace_deletion_eligibility(
    p_tenant_id UUID,
    p_confirmation_name TEXT
)
RETURNS TABLE (
    tenant_name TEXT,
    tenant_trade_name TEXT,
    tenant_legal_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, private
AS $$
DECLARE
    v_group_id UUID;
    v_confirmation TEXT;
    v_name TEXT;
    v_trade_name TEXT;
    v_legal_name TEXT;
BEGIN
    IF p_tenant_id IS NULL THEN
        RAISE EXCEPTION 'tenant id is required';
    END IF;

    IF private.current_user_role() <> 'OWNER'::public.user_role THEN
        RAISE EXCEPTION 'workspace owner privileges required';
    END IF;

    IF private.current_tenant_id() <> p_tenant_id THEN
        RAISE EXCEPTION 'tenant context mismatch';
    END IF;

    v_confirmation := lower(btrim(COALESCE(p_confirmation_name, '')));
    IF v_confirmation = '' THEN
        RAISE EXCEPTION 'workspace name confirmation is required';
    END IF;

    SELECT t.name, t.trade_name, t.legal_name, t.group_id
    INTO v_name, v_trade_name, v_legal_name, v_group_id
    FROM public.tenants t
    WHERE t.id = p_tenant_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'workspace not found';
    END IF;

    IF v_confirmation NOT IN (
        lower(btrim(v_name)),
        lower(btrim(COALESCE(v_trade_name, ''))),
        lower(btrim(COALESCE(v_legal_name, '')))
    ) THEN
        RAISE EXCEPTION 'workspace name confirmation does not match';
    END IF;

    IF v_group_id IS NOT NULL AND EXISTS (
        SELECT 1
        FROM public.tenant_group_memberships tgm
        WHERE tgm.group_id = v_group_id
          AND tgm.tenant_id = p_tenant_id
          AND tgm.status IN ('ACTIVE', 'SUSPENDED', 'EXIT_PENDING')
    ) THEN
        RAISE EXCEPTION 'leave the enterprise group before deleting this workspace';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.stock_transfers st
        WHERE st.tenant_id = p_tenant_id
          AND st.current_status = 'DISPATCHED_IN_TRANSIT'
    ) THEN
        RAISE EXCEPTION 'cannot delete workspace while stock is in transit';
    END IF;

    IF private.tenant_workspace_deletion_is_pending(p_tenant_id) THEN
        RAISE EXCEPTION 'workspace deletion is already scheduled';
    END IF;

    RETURN QUERY
    SELECT v_name, v_trade_name, v_legal_name;
END;
$$;

CREATE OR REPLACE FUNCTION private.purge_tenant_workspace_by_id(p_tenant_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, private
AS $$
DECLARE
    v_next_tenant_id UUID;
    v_user_id UUID;
BEGIN
    IF p_tenant_id IS NULL THEN
        RAISE EXCEPTION 'tenant id is required';
    END IF;

    v_user_id := auth.uid();

    IF v_user_id IS NOT NULL THEN
        SELECT m.tenant_id
        INTO v_next_tenant_id
        FROM public.user_tenant_memberships m
        WHERE m.user_id = v_user_id
          AND m.is_active = TRUE
          AND m.tenant_id <> p_tenant_id
        ORDER BY m.created_at
        LIMIT 1;
    END IF;

    DELETE FROM public.tenants
    WHERE id = p_tenant_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'workspace not found';
    END IF;

    IF v_user_id IS NOT NULL AND v_next_tenant_id IS NOT NULL THEN
        PERFORM private.switch_active_tenant_membership(v_next_tenant_id);
    END IF;

    RETURN jsonb_build_object(
        'deleted_tenant_id', p_tenant_id,
        'switched_to_tenant_id', v_next_tenant_id
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.request_tenant_workspace_deletion(
    p_confirmation_name TEXT,
    p_backup_acknowledged BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, private
AS $$
DECLARE
    v_tenant_id UUID;
    v_grace_days INTEGER;
    v_request_id UUID;
    v_scheduled_at TIMESTAMPTZ;
BEGIN
    v_tenant_id := private.current_tenant_id();
    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'tenant context missing from session';
    END IF;

    IF COALESCE(p_backup_acknowledged, FALSE) IS NOT TRUE THEN
        RAISE EXCEPTION 'data backup acknowledgment is required before scheduling workspace deletion';
    END IF;

    PERFORM 1
    FROM private.validate_workspace_deletion_eligibility(v_tenant_id, p_confirmation_name);

    v_grace_days := private.platform_config_int('workspace_deletion_grace_days', 14);
    v_scheduled_at := NOW() + make_interval(days => v_grace_days);

    INSERT INTO public.tenant_deletion_requests (
        tenant_id,
        requested_by_user_id,
        status,
        confirmation_name,
        backup_acknowledged,
        scheduled_purge_at,
        grace_days
    )
    VALUES (
        v_tenant_id,
        auth.uid(),
        'PENDING',
        btrim(p_confirmation_name),
        TRUE,
        v_scheduled_at,
        v_grace_days
    )
    RETURNING id INTO v_request_id;

    RETURN jsonb_build_object(
        'request_id', v_request_id,
        'tenant_id', v_tenant_id,
        'scheduled_purge_at', v_scheduled_at,
        'grace_days', v_grace_days
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_tenant_workspace_deletion()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, private
AS $$
DECLARE
    v_tenant_id UUID;
    v_request_id UUID;
BEGIN
    v_tenant_id := private.current_tenant_id();
    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'tenant context missing from session';
    END IF;

    IF private.current_user_role() <> 'OWNER'::public.user_role THEN
        RAISE EXCEPTION 'workspace owner privileges required';
    END IF;

    SELECT r.id
    INTO v_request_id
    FROM public.tenant_deletion_requests r
    WHERE r.tenant_id = v_tenant_id
      AND r.status = 'PENDING'
    FOR UPDATE;

    IF v_request_id IS NULL THEN
        RAISE EXCEPTION 'no pending workspace deletion request found';
    END IF;

    UPDATE public.tenant_deletion_requests
    SET
        status = 'CANCELLED',
        cancelled_at = NOW(),
        cancelled_by_user_id = auth.uid(),
        updated_at = NOW()
    WHERE id = v_request_id;

    RETURN jsonb_build_object(
        'request_id', v_request_id,
        'tenant_id', v_tenant_id,
        'status', 'CANCELLED'
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_tenant_workspace_deletion_status()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_tenant_id UUID;
    v_row public.tenant_deletion_requests%ROWTYPE;
BEGIN
    v_tenant_id := private.current_tenant_id();
    IF v_tenant_id IS NULL THEN
        RETURN NULL;
    END IF;

    IF private.current_user_role() <> 'OWNER'::public.user_role THEN
        RETURN NULL;
    END IF;

    SELECT *
    INTO v_row
    FROM public.tenant_deletion_requests r
    WHERE r.tenant_id = v_tenant_id
      AND r.status = 'PENDING'
    ORDER BY r.requested_at DESC
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN NULL;
    END IF;

    RETURN jsonb_build_object(
        'request_id', v_row.id,
        'tenant_id', v_row.tenant_id,
        'status', v_row.status,
        'requested_at', v_row.requested_at,
        'scheduled_purge_at', v_row.scheduled_purge_at,
        'grace_days', v_row.grace_days,
        'backup_acknowledged', v_row.backup_acknowledged
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.purge_due_tenant_workspace_deletions()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, private
AS $$
DECLARE
    v_request RECORD;
    v_purged INTEGER := 0;
    v_failed INTEGER := 0;
    v_results JSONB := '[]'::jsonb;
BEGIN
    IF NOT private.is_app_console_operator() THEN
        RAISE EXCEPTION 'app console operator privileges required';
    END IF;

    IF private.app_console_role() NOT IN ('ADMIN'::public.app_console_role, 'OPERATOR'::public.app_console_role) THEN
        RAISE EXCEPTION 'console operator role required';
    END IF;

    FOR v_request IN
        SELECT r.id, r.tenant_id
        FROM public.tenant_deletion_requests r
        WHERE r.status = 'PENDING'
          AND r.scheduled_purge_at <= NOW()
        ORDER BY r.scheduled_purge_at
        FOR UPDATE SKIP LOCKED
    LOOP
        BEGIN
            PERFORM private.purge_tenant_workspace_by_id(v_request.tenant_id);

            UPDATE public.tenant_deletion_requests
            SET
                status = 'PURGED',
                purged_at = NOW(),
                last_error = NULL,
                updated_at = NOW()
            WHERE id = v_request.id;

            v_purged := v_purged + 1;
            v_results := v_results || jsonb_build_array(
                jsonb_build_object('tenant_id', v_request.tenant_id, 'status', 'PURGED')
            );
        EXCEPTION
            WHEN OTHERS THEN
                UPDATE public.tenant_deletion_requests
                SET
                    status = 'FAILED',
                    last_error = SQLERRM,
                    updated_at = NOW()
                WHERE id = v_request.id;

                v_failed := v_failed + 1;
                v_results := v_results || jsonb_build_array(
                    jsonb_build_object(
                        'tenant_id', v_request.tenant_id,
                        'status', 'FAILED',
                        'error', SQLERRM
                    )
                );
        END;
    END LOOP;

    RETURN jsonb_build_object(
        'purged_count', v_purged,
        'failed_count', v_failed,
        'results', v_results
    );
END;
$$;

CREATE OR REPLACE FUNCTION private.delete_tenant_workspace(p_confirmation_name TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, private
AS $$
BEGIN
    RAISE EXCEPTION
        'immediate workspace deletion is disabled; schedule deletion from organization settings instead';
END;
$$;

REVOKE ALL ON FUNCTION public.request_tenant_workspace_deletion(TEXT, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_tenant_workspace_deletion(TEXT, BOOLEAN) TO authenticated;

REVOKE ALL ON FUNCTION public.cancel_tenant_workspace_deletion() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_tenant_workspace_deletion() TO authenticated;

REVOKE ALL ON FUNCTION public.get_tenant_workspace_deletion_status() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_tenant_workspace_deletion_status() TO authenticated;

REVOKE ALL ON FUNCTION public.purge_due_tenant_workspace_deletions() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.purge_due_tenant_workspace_deletions() TO authenticated;

GRANT EXECUTE ON FUNCTION private.platform_config_int(TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION private.tenant_workspace_deletion_is_pending(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION private.assert_tenant_workspace_writable() TO authenticated;

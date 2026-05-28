-- ====================================================================
-- AIB SMART ERP - USER DUTY STATUS RPC
-- Migration: 20260528120000_user_duty_status_rpc.sql
-- ====================================================================

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

    PERFORM set_config('app.duty_status_update', 'true', true);

    UPDATE public.users
    SET metadata_json = COALESCE(metadata_json, '{}'::jsonb) || jsonb_build_object('duty_status', v_status)
    WHERE id = auth.uid()
      AND tenant_id = v_tenant_id
      AND is_active = TRUE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'user profile not found for tenant';
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_user_duty_status(p_status TEXT)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, private
AS $$
    SELECT private.update_user_duty_status(p_status);
$$;

REVOKE ALL ON FUNCTION public.update_user_duty_status(TEXT) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.update_user_duty_status(TEXT) TO authenticated;

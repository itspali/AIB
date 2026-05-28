-- ====================================================================
-- AIB SMART ERP - USER PREFERENCES RPC (timezone + ui_density)
-- Migration: 20260529120000_user_preferences_rpc.sql
-- ====================================================================

CREATE OR REPLACE FUNCTION private.enforce_users_self_update_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_allowed_metadata_patch BOOLEAN;
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
            v_allowed_metadata_patch := FALSE;

            IF current_setting('app.duty_status_update', true) = 'true'
               AND (NEW.metadata_json - 'duty_status') IS NOT DISTINCT FROM (OLD.metadata_json - 'duty_status')
            THEN
                v_allowed_metadata_patch := TRUE;
            END IF;

            IF current_setting('app.preferences_update', true) = 'true'
               AND (NEW.metadata_json - 'timezone' - 'ui_density')
                   IS NOT DISTINCT FROM (OLD.metadata_json - 'timezone' - 'ui_density')
            THEN
                v_allowed_metadata_patch := TRUE;
            END IF;

            IF NOT v_allowed_metadata_patch THEN
                RAISE EXCEPTION
                    'users may only self-update first_name, last_name, phone_number, and avatar_url';
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION private.update_user_preferences(
    p_timezone TEXT,
    p_ui_density TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_tenant_id UUID;
    v_timezone TEXT;
    v_density TEXT;
BEGIN
    v_tenant_id := private.current_tenant_id();
    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'tenant context missing from session';
    END IF;

    v_timezone := btrim(p_timezone);
    IF v_timezone IS NULL OR v_timezone = '' THEN
        RAISE EXCEPTION 'timezone is required';
    END IF;

    v_density := upper(btrim(p_ui_density));
    IF v_density NOT IN ('DENSE', 'STANDARD') THEN
        RAISE EXCEPTION 'invalid ui density';
    END IF;

    PERFORM set_config('app.preferences_update', 'true', true);

    UPDATE public.users
    SET metadata_json = COALESCE(metadata_json, '{}'::jsonb)
        || jsonb_build_object('timezone', v_timezone, 'ui_density', v_density)
    WHERE id = auth.uid()
      AND tenant_id = v_tenant_id
      AND is_active = TRUE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'user profile not found for tenant';
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_user_preferences(
    p_timezone TEXT,
    p_ui_density TEXT
)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, private
AS $$
    SELECT private.update_user_preferences(p_timezone, p_ui_density);
$$;

REVOKE ALL ON FUNCTION public.update_user_preferences(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_user_preferences(TEXT, TEXT) TO authenticated;

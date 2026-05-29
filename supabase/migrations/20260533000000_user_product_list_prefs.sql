-- Per-user Items list preferences stored in users.metadata_json.product_list_prefs

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

            IF current_setting('app.product_list_prefs_update', true) = 'true'
               AND (NEW.metadata_json - 'product_list_prefs')
                   IS NOT DISTINCT FROM (OLD.metadata_json - 'product_list_prefs')
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

CREATE OR REPLACE FUNCTION private.save_user_product_list_prefs(p_prefs jsonb)
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

    IF p_prefs IS NULL OR jsonb_typeof(p_prefs) <> 'object' THEN
        RAISE EXCEPTION 'product list prefs must be a JSON object';
    END IF;

    IF NOT (p_prefs ? 'prefsVersion') THEN
        RAISE EXCEPTION 'product list prefs must include prefsVersion';
    END IF;

    PERFORM set_config('app.product_list_prefs_update', 'true', true);

    UPDATE public.users
    SET metadata_json = COALESCE(metadata_json, '{}'::jsonb)
        || jsonb_build_object('product_list_prefs', p_prefs)
    WHERE id = auth.uid()
      AND tenant_id = v_tenant_id
      AND is_active = TRUE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'user profile not found for tenant';
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.save_user_product_list_prefs(p_prefs jsonb)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, private
AS $$
    SELECT private.save_user_product_list_prefs(p_prefs);
$$;

REVOKE ALL ON FUNCTION public.save_user_product_list_prefs(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_user_product_list_prefs(jsonb) TO authenticated;

COMMENT ON FUNCTION public.save_user_product_list_prefs IS
    'Persist Items list preferences for the current user in users.metadata_json.product_list_prefs.';

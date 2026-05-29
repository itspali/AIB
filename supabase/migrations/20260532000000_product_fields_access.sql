-- Product field visibility matrix stored in tenants.metadata_json.product_fields_access
-- Shape: { "STAFF": { "purchase_price": false, ... }, "MANAGER": { ... } }
-- Defaults are enforced in application code when overrides are absent.

CREATE OR REPLACE FUNCTION public.patch_tenant_metadata_json(p_patch jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_tenant_id uuid;
    v_role text;
BEGIN
    v_tenant_id := private.current_tenant_id();
    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'tenant context missing from session';
    END IF;

    v_role := private.current_user_role();
    IF v_role IS DISTINCT FROM 'OWNER' THEN
        RAISE EXCEPTION 'only workspace owners can patch tenant metadata';
    END IF;

    IF p_patch IS NULL OR p_patch = '{}'::jsonb THEN
        RETURN;
    END IF;

    UPDATE public.tenants
    SET metadata_json = COALESCE(metadata_json, '{}'::jsonb) || p_patch,
        updated_at = NOW()
    WHERE id = v_tenant_id;
END;
$$;

REVOKE ALL ON FUNCTION public.patch_tenant_metadata_json(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.patch_tenant_metadata_json(jsonb) TO authenticated;

COMMENT ON FUNCTION public.patch_tenant_metadata_json IS
    'Merge a JSON patch into tenants.metadata_json for the current tenant (OWNER only).';

-- Allow SEARCH_SETTINGS in tenant workspace control upsert/clear for omnibar financial field RBAC.

CREATE OR REPLACE FUNCTION private.clear_tenant_workspace_control(p_registry_key TEXT)
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

    IF NOT private.user_can_modify_organization_settings() THEN
        RAISE EXCEPTION 'administrative privileges required to modify workspace controls';
    END IF;

    IF p_registry_key NOT IN ('SALES_SETTINGS', 'FINANCIAL_SETTINGS', 'SEARCH_SETTINGS') THEN
        RAISE EXCEPTION 'unsupported workspace control registry key';
    END IF;

    DELETE FROM public.workspace_control_registry
    WHERE tenant_id = v_tenant_id
      AND scope_level = 'TENANT_GLOBAL'
      AND registry_key = p_registry_key
      AND target_reference_id IS NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.clear_tenant_workspace_control(p_registry_key TEXT)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, private
AS $$
    SELECT private.clear_tenant_workspace_control(p_registry_key);
$$;

CREATE OR REPLACE FUNCTION private.upsert_tenant_workspace_control(
    p_registry_key TEXT,
    p_metadata_patch JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_tenant_id UUID;
    v_existing_id UUID;
    v_merged JSONB;
BEGIN
    v_tenant_id := private.current_tenant_id();
    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'tenant context missing from session';
    END IF;

    IF NOT private.user_can_modify_organization_settings() THEN
        RAISE EXCEPTION 'administrative privileges required to modify workspace controls';
    END IF;

    IF p_registry_key NOT IN ('SALES_SETTINGS', 'FINANCIAL_SETTINGS', 'SEARCH_SETTINGS') THEN
        RAISE EXCEPTION 'unsupported workspace control registry key';
    END IF;

    SELECT id, configuration_metadata
    INTO v_existing_id, v_merged
    FROM public.workspace_control_registry
    WHERE tenant_id = v_tenant_id
      AND scope_level = 'TENANT_GLOBAL'
      AND registry_key = p_registry_key
      AND target_reference_id IS NULL
    LIMIT 1;

    v_merged := private.merge_jsonb_objects(v_merged, p_metadata_patch);

    IF v_existing_id IS NULL THEN
        INSERT INTO public.workspace_control_registry (
            tenant_id,
            scope_level,
            registry_key,
            target_reference_id,
            configuration_metadata
        )
        VALUES (
            v_tenant_id,
            'TENANT_GLOBAL',
            p_registry_key,
            NULL,
            v_merged
        );
    ELSE
        UPDATE public.workspace_control_registry
        SET
            configuration_metadata = v_merged,
            updated_at = NOW()
        WHERE id = v_existing_id
          AND tenant_id = v_tenant_id;
    END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.clear_tenant_workspace_control(TEXT) TO authenticated;

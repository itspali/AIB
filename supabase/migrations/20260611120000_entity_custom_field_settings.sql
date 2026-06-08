-- ====================================================================
-- Entity custom field definitions — group metadata patch RPC
-- Org-level definitions live in tenants.metadata_json.entity_settings
-- Group-level definitions live in tenant_groups.metadata_json.entity_settings
-- ====================================================================

CREATE OR REPLACE FUNCTION public.patch_group_metadata_json(
    p_group_id UUID,
    p_patch JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_user_id UUID;
    v_role public.group_membership_role;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'authentication required';
    END IF;

    IF p_group_id IS NULL THEN
        RAISE EXCEPTION 'group id is required';
    END IF;

    IF p_patch IS NULL OR p_patch = '{}'::jsonb THEN
        RETURN;
    END IF;

    SELECT gm.role
    INTO v_role
    FROM public.group_memberships gm
    WHERE gm.group_id = p_group_id
      AND gm.user_id = v_user_id
      AND gm.is_active = TRUE;

    IF v_role IS NULL OR v_role NOT IN ('GROUP_OWNER'::public.group_membership_role, 'GROUP_ADMIN'::public.group_membership_role) THEN
        RAISE EXCEPTION 'group admin privileges required to patch group metadata';
    END IF;

    UPDATE public.tenant_groups
    SET
        metadata_json = COALESCE(metadata_json, '{}'::jsonb) || p_patch,
        updated_at = NOW()
    WHERE id = p_group_id;
END;
$$;

REVOKE ALL ON FUNCTION public.patch_group_metadata_json(UUID, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.patch_group_metadata_json(UUID, JSONB) TO authenticated;

COMMENT ON FUNCTION public.patch_group_metadata_json IS
    'Merge a JSON patch into tenant_groups.metadata_json (GROUP_OWNER / GROUP_ADMIN only).';

-- ====================================================================
-- DELETE SYSTEM CATEGORY — blocked when referenced by items or children
-- Migration: 20260603140000_delete_system_category_rpc.sql
-- ====================================================================

CREATE OR REPLACE FUNCTION private.delete_system_category(
    p_category_id UUID
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_tenant_id UUID;
    v_item_count BIGINT;
    v_child_count BIGINT;
BEGIN
    v_tenant_id := private.current_tenant_id();
    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'tenant context missing from session';
    END IF;

    IF p_category_id IS NULL THEN
        RAISE EXCEPTION 'category id is required';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.item_categories
        WHERE id = p_category_id
          AND tenant_id = v_tenant_id
    ) THEN
        RAISE EXCEPTION 'category not found for tenant';
    END IF;

    SELECT COUNT(*)::bigint
    INTO v_item_count
    FROM public.items
    WHERE tenant_id = v_tenant_id
      AND category_id = p_category_id;

    IF v_item_count > 0 THEN
        RAISE EXCEPTION
            'Cannot delete this category: % item(s) are assigned to it. Reassign those items to another category first.',
            v_item_count;
    END IF;

    SELECT COUNT(*)::bigint
    INTO v_child_count
    FROM public.item_categories
    WHERE tenant_id = v_tenant_id
      AND parent_id = p_category_id;

    IF v_child_count > 0 THEN
        RAISE EXCEPTION
            'Cannot delete this category: % child categor(ies) exist under it. Move or delete those categories first.',
            v_child_count;
    END IF;

    DELETE FROM public.item_categories
    WHERE id = p_category_id
      AND tenant_id = v_tenant_id;

    RETURN 'DELETED';
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_system_category(
    p_category_id UUID
)
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, private
AS $$
    SELECT private.delete_system_category(p_category_id);
$$;

REVOKE ALL ON FUNCTION public.delete_system_category(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_system_category(UUID) TO authenticated;

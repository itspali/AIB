-- ====================================================================
-- COUNT ITEMS BY CATEGORY — aggregated counts for category list UI
-- Migration: 20260606130000_count_items_by_category_rpc.sql
-- ====================================================================

CREATE OR REPLACE FUNCTION private.count_items_by_category()
RETURNS TABLE(category_id UUID, item_count BIGINT)
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

    RETURN QUERY
    SELECT i.category_id, COUNT(*)::bigint AS item_count
    FROM public.items i
    WHERE i.tenant_id = v_tenant_id
      AND i.category_id IS NOT NULL
    GROUP BY i.category_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.count_items_by_category()
RETURNS TABLE(category_id UUID, item_count BIGINT)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, private
AS $$
    SELECT * FROM private.count_items_by_category();
$$;

REVOKE ALL ON FUNCTION public.count_items_by_category() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.count_items_by_category() TO authenticated;

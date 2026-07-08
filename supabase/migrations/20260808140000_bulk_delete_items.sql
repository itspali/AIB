-- Bulk delete: permanently remove unused items; archive items with transaction history.

CREATE OR REPLACE FUNCTION private.permanent_delete_item_core(
    p_tenant_id UUID,
    p_item_id UUID
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM public.items WHERE id = p_item_id AND tenant_id = p_tenant_id
    ) THEN
        RETURN 'NOT_FOUND';
    END IF;

    IF private.item_has_transactional_history(p_tenant_id, p_item_id) THEN
        RETURN 'IN_USE';
    END IF;

    DELETE FROM public.supplier_items
    WHERE tenant_id = p_tenant_id
      AND item_id = p_item_id;

    DELETE FROM public.item_valuations
    WHERE tenant_id = p_tenant_id
      AND item_id = p_item_id
      AND COALESCE(total_quantity_on_hand, 0) = 0;

    IF EXISTS (
        SELECT 1 FROM public.item_valuations
        WHERE tenant_id = p_tenant_id
          AND item_id = p_item_id
    ) THEN
        RETURN 'HAS_BALANCE';
    END IF;

    DELETE FROM public.items
    WHERE id = p_item_id
      AND tenant_id = p_tenant_id;

    RETURN 'DELETED';
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_item(p_item_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_tenant_id UUID;
    v_result TEXT;
BEGIN
    v_tenant_id := private.current_tenant_id();
    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'tenant context missing from session';
    END IF;

    v_result := private.permanent_delete_item_core(v_tenant_id, p_item_id);

    IF v_result = 'NOT_FOUND' THEN
        RAISE EXCEPTION 'product not found for tenant';
    END IF;
    IF v_result = 'IN_USE' THEN
        RAISE EXCEPTION 'ITEM_IN_USE: item is referenced by transactions and cannot be permanently deleted';
    END IF;
    IF v_result = 'HAS_BALANCE' THEN
        RAISE EXCEPTION 'ITEM_IN_USE: item still has inventory valuation balances and cannot be permanently deleted';
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.bulk_delete_items(p_item_ids UUID[])
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_tenant_id UUID;
    v_item_id UUID;
    v_result TEXT;
    v_deleted_ids UUID[] := ARRAY[]::UUID[];
    v_archived_ids UUID[] := ARRAY[]::UUID[];
    v_skipped_ids UUID[] := ARRAY[]::UUID[];
BEGIN
    v_tenant_id := private.current_tenant_id();
    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'tenant context missing from session';
    END IF;

    IF p_item_ids IS NULL OR array_length(p_item_ids, 1) IS NULL THEN
        RETURN jsonb_build_object(
            'deleted_ids', to_jsonb(v_deleted_ids),
            'archived_ids', to_jsonb(v_archived_ids),
            'skipped_ids', to_jsonb(v_skipped_ids)
        );
    END IF;

    FOREACH v_item_id IN ARRAY p_item_ids LOOP
        IF NOT EXISTS (
            SELECT 1 FROM public.items WHERE id = v_item_id AND tenant_id = v_tenant_id
        ) THEN
            CONTINUE;
        END IF;

        IF private.item_has_transactional_history(v_tenant_id, v_item_id) THEN
            UPDATE public.items
            SET is_active = FALSE
            WHERE tenant_id = v_tenant_id
              AND id = v_item_id;

            UPDATE public.item_variants
            SET is_active = FALSE
            WHERE tenant_id = v_tenant_id
              AND item_id = v_item_id;

            v_archived_ids := array_append(v_archived_ids, v_item_id);
            CONTINUE;
        END IF;

        v_result := private.permanent_delete_item_core(v_tenant_id, v_item_id);

        IF v_result = 'DELETED' THEN
            v_deleted_ids := array_append(v_deleted_ids, v_item_id);
        ELSIF v_result = 'HAS_BALANCE' THEN
            v_skipped_ids := array_append(v_skipped_ids, v_item_id);
        END IF;
    END LOOP;

    RETURN jsonb_build_object(
        'deleted_ids', to_jsonb(v_deleted_ids),
        'archived_ids', to_jsonb(v_archived_ids),
        'skipped_ids', to_jsonb(v_skipped_ids)
    );
END;
$$;

REVOKE ALL ON FUNCTION public.bulk_delete_items(UUID[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bulk_delete_items(UUID[]) TO authenticated;

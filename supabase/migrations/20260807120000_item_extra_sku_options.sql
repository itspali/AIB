-- Product-scoped attribute templates for SKU composition (Phase 2).
-- Category templates suggest defaults; extra_sku_options are per-item only.

ALTER TABLE public.items
    ADD COLUMN IF NOT EXISTS extra_sku_options JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE OR REPLACE FUNCTION private.set_item_extra_sku_options(
    p_item_id UUID,
    p_extra_sku_options JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_tenant_id UUID;
    v_templates JSONB;
BEGIN
    v_tenant_id := private.current_tenant_id();
    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'tenant context missing from session';
    END IF;

    IF p_item_id IS NULL THEN
        RAISE EXCEPTION 'item id is required';
    END IF;

    v_templates := COALESCE(p_extra_sku_options, '[]'::jsonb);
    IF jsonb_typeof(v_templates) IS DISTINCT FROM 'array' THEN
        RAISE EXCEPTION 'extra_sku_options must be a JSON array';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.items
        WHERE id = p_item_id AND tenant_id = v_tenant_id
    ) THEN
        RAISE EXCEPTION 'item not found for tenant';
    END IF;

    UPDATE public.items
    SET extra_sku_options = v_templates,
        updated_at = NOW()
    WHERE id = p_item_id AND tenant_id = v_tenant_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_item_extra_sku_options(
    p_item_id UUID,
    p_extra_sku_options JSONB
)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, private
AS $$
    SELECT private.set_item_extra_sku_options(p_item_id, p_extra_sku_options);
$$;

REVOKE ALL ON FUNCTION public.set_item_extra_sku_options(UUID, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_item_extra_sku_options(UUID, JSONB) TO authenticated;

-- Retain variant attribute keys from category templates AND item extra options.
CREATE OR REPLACE FUNCTION private.reconcile_variant_attributes(
    p_tenant_id UUID,
    p_item_id UUID,
    p_category_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_allowed TEXT[];
BEGIN
    SELECT COALESCE(array_agg(DISTINCT keys.key), ARRAY[]::TEXT[])
    INTO v_allowed
    FROM (
        SELECT template ->> 'key' AS key
        FROM public.item_categories c
        CROSS JOIN LATERAL jsonb_array_elements(c.attribute_templates) AS template
        WHERE c.id = p_category_id
          AND c.tenant_id = p_tenant_id
          AND template ? 'key'
          AND btrim(template ->> 'key') <> ''
        UNION
        SELECT template ->> 'key' AS key
        FROM public.items i
        CROSS JOIN LATERAL jsonb_array_elements(i.extra_sku_options) AS template
        WHERE i.id = p_item_id
          AND i.tenant_id = p_tenant_id
          AND template ? 'key'
          AND btrim(template ->> 'key') <> ''
    ) AS keys;

    IF v_allowed IS NULL OR array_length(v_allowed, 1) IS NULL THEN
        UPDATE public.item_variants v
        SET variant_attributes = '{}'::jsonb
        WHERE v.item_id = p_item_id
          AND v.tenant_id = p_tenant_id
          AND v.variant_attributes <> '{}'::jsonb;
        RETURN;
    END IF;

    UPDATE public.item_variants v
    SET variant_attributes = (
        SELECT COALESCE(jsonb_object_agg(kv.key, kv.value), '{}'::jsonb)
        FROM jsonb_each(v.variant_attributes) AS kv
        WHERE kv.key = ANY(v_allowed)
    )
    WHERE v.item_id = p_item_id
      AND v.tenant_id = p_tenant_id
      AND v.variant_attributes <> '{}'::jsonb;
END;
$$;

-- ====================================================================
-- Category attribute template inheritance (default on, opt-out per node)
-- ====================================================================

ALTER TABLE public.item_categories
    ADD COLUMN IF NOT EXISTS inherit_parent_attributes BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN public.item_categories.inherit_parent_attributes IS
    'When true, effective attribute_templates merge ancestors then own rows (child overrides on key). When false, only own attribute_templates apply.';

-- --------------------------------------------------------------------
-- Resolve allowed attribute keys for a category (inheritance-aware).
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.effective_category_attribute_keys(
    p_tenant_id UUID,
    p_category_id UUID
)
RETURNS TEXT[]
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_parent_id UUID;
    v_inherit BOOLEAN;
    v_templates JSONB;
    v_parent_keys TEXT[];
    v_own_keys TEXT[];
BEGIN
    IF p_category_id IS NULL THEN
        RETURN ARRAY[]::TEXT[];
    END IF;

    SELECT parent_id, inherit_parent_attributes, attribute_templates
    INTO v_parent_id, v_inherit, v_templates
    FROM public.item_categories
    WHERE id = p_category_id
      AND tenant_id = p_tenant_id;

    IF NOT FOUND THEN
        RETURN ARRAY[]::TEXT[];
    END IF;

    SELECT COALESCE(array_agg(btrim(template ->> 'key')), ARRAY[]::TEXT[])
    INTO v_own_keys
    FROM jsonb_array_elements(COALESCE(v_templates, '[]'::jsonb)) AS template
    WHERE btrim(template ->> 'key') <> '';

    IF NOT COALESCE(v_inherit, TRUE) OR v_parent_id IS NULL THEN
        RETURN COALESCE(v_own_keys, ARRAY[]::TEXT[]);
    END IF;

    v_parent_keys := private.effective_category_attribute_keys(p_tenant_id, v_parent_id);

    RETURN ARRAY(
        SELECT DISTINCT unnest(COALESCE(v_parent_keys, ARRAY[]::TEXT[]) || COALESCE(v_own_keys, ARRAY[]::TEXT[]))
    );
END;
$$;

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
    IF p_category_id IS NULL THEN
        RETURN;
    END IF;

    v_allowed := private.effective_category_attribute_keys(p_tenant_id, p_category_id);

    IF v_allowed IS NULL OR array_length(v_allowed, 1) IS NULL THEN
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

-- --------------------------------------------------------------------
-- save_system_category: persist inherit_parent_attributes
-- --------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.save_system_category(TEXT, UUID, BOOLEAN, JSONB, UUID, TEXT);
DROP FUNCTION IF EXISTS private.save_system_category(TEXT, UUID, BOOLEAN, JSONB, UUID, TEXT);

CREATE OR REPLACE FUNCTION private.save_system_category(
    p_name TEXT,
    p_parent_id UUID DEFAULT NULL,
    p_is_active BOOLEAN DEFAULT TRUE,
    p_attribute_templates JSONB DEFAULT '[]'::jsonb,
    p_category_id UUID DEFAULT NULL,
    p_default_variant_strategy TEXT DEFAULT 'SINGLE_SKU',
    p_inherit_parent_attributes BOOLEAN DEFAULT TRUE
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_tenant_id UUID;
    v_category_id UUID;
    v_trimmed_name TEXT;
    v_strategy public.product_variant_strategy;
BEGIN
    v_tenant_id := private.current_tenant_id();
    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'tenant context missing from session';
    END IF;

    v_trimmed_name := btrim(p_name);
    IF v_trimmed_name IS NULL OR v_trimmed_name = '' THEN
        RAISE EXCEPTION 'category name is required';
    END IF;

    v_strategy := COALESCE(
        NULLIF(upper(btrim(p_default_variant_strategy)), '')::public.product_variant_strategy,
        'SINGLE_SKU'::public.product_variant_strategy
    );

    IF p_attribute_templates IS NULL THEN
        p_attribute_templates := '[]'::jsonb;
    END IF;

    IF jsonb_typeof(p_attribute_templates) IS DISTINCT FROM 'array' THEN
        RAISE EXCEPTION 'attribute_templates must be a JSON array';
    END IF;

    IF p_category_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.item_categories
            WHERE id = p_category_id AND tenant_id = v_tenant_id
        ) THEN
            RAISE EXCEPTION 'category not found for tenant';
        END IF;

        UPDATE public.item_categories
        SET
            name = v_trimmed_name,
            parent_id = p_parent_id,
            is_active = COALESCE(p_is_active, TRUE),
            attribute_templates = p_attribute_templates,
            default_variant_strategy = v_strategy,
            inherit_parent_attributes = COALESCE(p_inherit_parent_attributes, TRUE)
        WHERE id = p_category_id AND tenant_id = v_tenant_id;

        RETURN p_category_id;
    END IF;

    INSERT INTO public.item_categories (
        tenant_id,
        name,
        parent_id,
        is_active,
        attribute_templates,
        default_variant_strategy,
        inherit_parent_attributes
    )
    VALUES (
        v_tenant_id,
        v_trimmed_name,
        p_parent_id,
        COALESCE(p_is_active, TRUE),
        p_attribute_templates,
        v_strategy,
        COALESCE(p_inherit_parent_attributes, TRUE)
    )
    RETURNING id INTO v_category_id;

    RETURN v_category_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.save_system_category(
    p_name TEXT,
    p_parent_id UUID DEFAULT NULL,
    p_is_active BOOLEAN DEFAULT TRUE,
    p_attribute_templates JSONB DEFAULT '[]'::jsonb,
    p_category_id UUID DEFAULT NULL,
    p_default_variant_strategy TEXT DEFAULT 'SINGLE_SKU',
    p_inherit_parent_attributes BOOLEAN DEFAULT TRUE
)
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, private
AS $$
    SELECT private.save_system_category(
        p_name,
        p_parent_id,
        p_is_active,
        p_attribute_templates,
        p_category_id,
        p_default_variant_strategy,
        p_inherit_parent_attributes
    );
$$;

REVOKE ALL ON FUNCTION public.save_system_category(TEXT, UUID, BOOLEAN, JSONB, UUID, TEXT, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_system_category(TEXT, UUID, BOOLEAN, JSONB, UUID, TEXT, BOOLEAN) TO authenticated;

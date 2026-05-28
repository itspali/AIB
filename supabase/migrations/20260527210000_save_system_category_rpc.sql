-- ====================================================================
-- AIB SMART ERP - SAVE SYSTEM CATEGORY RPC (atomic category insert)
-- Migration: 20260527210000_save_system_category_rpc.sql
-- ====================================================================

CREATE OR REPLACE FUNCTION private.save_system_category(
    p_name TEXT,
    p_parent_id UUID DEFAULT NULL,
    p_is_active BOOLEAN DEFAULT TRUE,
    p_attribute_templates JSONB DEFAULT '[]'::jsonb
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
BEGIN
    v_tenant_id := private.current_tenant_id();
    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'tenant context missing from session';
    END IF;

    v_trimmed_name := btrim(p_name);
    IF v_trimmed_name IS NULL OR v_trimmed_name = '' THEN
        RAISE EXCEPTION 'category name is required';
    END IF;

    IF p_parent_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1
            FROM public.item_categories
            WHERE id = p_parent_id
              AND tenant_id = v_tenant_id
        ) THEN
            RAISE EXCEPTION 'parent category not found for tenant';
        END IF;
    END IF;

    IF p_attribute_templates IS NULL THEN
        p_attribute_templates := '[]'::jsonb;
    END IF;

    IF jsonb_typeof(p_attribute_templates) IS DISTINCT FROM 'array' THEN
        RAISE EXCEPTION 'attribute_templates must be a JSON array';
    END IF;

    INSERT INTO public.item_categories (
        tenant_id,
        name,
        parent_id,
        is_active,
        attribute_templates
    )
    VALUES (
        v_tenant_id,
        v_trimmed_name,
        p_parent_id,
        COALESCE(p_is_active, TRUE),
        p_attribute_templates
    )
    RETURNING id INTO v_category_id;

    RETURN v_category_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.save_system_category(
    p_name TEXT,
    p_parent_id UUID DEFAULT NULL,
    p_is_active BOOLEAN DEFAULT TRUE,
    p_attribute_templates JSONB DEFAULT '[]'::jsonb
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
        p_attribute_templates
    );
$$;

REVOKE ALL ON FUNCTION public.save_system_category(TEXT, UUID, BOOLEAN, JSONB) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.save_system_category(TEXT, UUID, BOOLEAN, JSONB) TO authenticated;

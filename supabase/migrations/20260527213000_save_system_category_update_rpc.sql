-- ====================================================================
-- AIB SMART ERP - SAVE SYSTEM CATEGORY RPC (insert + update)
-- Migration: 20260527213000_save_system_category_update_rpc.sql
-- ====================================================================

DROP FUNCTION IF EXISTS public.save_system_category(TEXT, UUID, BOOLEAN, JSONB);
DROP FUNCTION IF EXISTS private.save_system_category(TEXT, UUID, BOOLEAN, JSONB);

CREATE OR REPLACE FUNCTION private.save_system_category(
    p_name TEXT,
    p_parent_id UUID DEFAULT NULL,
    p_is_active BOOLEAN DEFAULT TRUE,
    p_attribute_templates JSONB DEFAULT '[]'::jsonb,
    p_category_id UUID DEFAULT NULL
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

    IF p_attribute_templates IS NULL THEN
        p_attribute_templates := '[]'::jsonb;
    END IF;

    IF jsonb_typeof(p_attribute_templates) IS DISTINCT FROM 'array' THEN
        RAISE EXCEPTION 'attribute_templates must be a JSON array';
    END IF;

    IF p_category_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1
            FROM public.item_categories
            WHERE id = p_category_id
              AND tenant_id = v_tenant_id
        ) THEN
            RAISE EXCEPTION 'category not found for tenant';
        END IF;

        IF p_parent_id IS NOT NULL THEN
            IF p_parent_id = p_category_id THEN
                RAISE EXCEPTION 'category cannot be its own parent';
            END IF;

            IF NOT EXISTS (
                SELECT 1
                FROM public.item_categories
                WHERE id = p_parent_id
                  AND tenant_id = v_tenant_id
            ) THEN
                RAISE EXCEPTION 'parent category not found for tenant';
            END IF;

            IF EXISTS (
                WITH RECURSIVE descendants AS (
                    SELECT id
                    FROM public.item_categories
                    WHERE id = p_category_id
                      AND tenant_id = v_tenant_id
                    UNION ALL
                    SELECT c.id
                    FROM public.item_categories c
                    INNER JOIN descendants d ON c.parent_id = d.id
                    WHERE c.tenant_id = v_tenant_id
                )
                SELECT 1
                FROM descendants
                WHERE id = p_parent_id
            ) THEN
                RAISE EXCEPTION 'parent category cannot be a descendant of this category';
            END IF;
        END IF;

        UPDATE public.item_categories
        SET
            name = v_trimmed_name,
            parent_id = p_parent_id,
            is_active = COALESCE(p_is_active, TRUE),
            attribute_templates = p_attribute_templates,
            updated_at = NOW()
        WHERE id = p_category_id
          AND tenant_id = v_tenant_id
        RETURNING id INTO v_category_id;

        RETURN v_category_id;
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
    p_attribute_templates JSONB DEFAULT '[]'::jsonb,
    p_category_id UUID DEFAULT NULL
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
        p_category_id
    );
$$;

REVOKE ALL ON FUNCTION public.save_system_category(TEXT, UUID, BOOLEAN, JSONB, UUID) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.save_system_category(TEXT, UUID, BOOLEAN, JSONB, UUID) TO authenticated;

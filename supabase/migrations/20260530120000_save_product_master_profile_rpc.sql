-- ====================================================================
-- AIB SMART ERP - SAVE PRODUCT MASTER PROFILE RPC
-- Migration: 20260530120000_save_product_master_profile_rpc.sql
-- ====================================================================

ALTER TYPE public.item_classification_type ADD VALUE IF NOT EXISTS 'PHYSICAL_GOOD';

CREATE OR REPLACE FUNCTION private.save_product_master_profile(
    p_item_id UUID DEFAULT NULL,
    p_name TEXT DEFAULT NULL,
    p_classification TEXT DEFAULT NULL,
    p_base_uom TEXT DEFAULT NULL,
    p_category_id UUID DEFAULT NULL,
    p_sku TEXT DEFAULT NULL,
    p_hsn_sac_code TEXT DEFAULT NULL,
    p_is_returnable BOOLEAN DEFAULT TRUE,
    p_dead_weight_kg NUMERIC DEFAULT 0,
    p_length_cm NUMERIC DEFAULT 0,
    p_width_cm NUMERIC DEFAULT 0,
    p_height_cm NUMERIC DEFAULT 0
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_tenant_id UUID;
    v_item_id UUID;
    v_variant_id UUID;
    v_trimmed_name TEXT;
    v_trimmed_sku TEXT;
    v_classification public.item_classification_type;
BEGIN
    v_tenant_id := private.current_tenant_id();
    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'tenant context missing from session';
    END IF;

    v_trimmed_name := btrim(p_name);
    IF v_trimmed_name IS NULL OR v_trimmed_name = '' THEN
        RAISE EXCEPTION 'product name is required';
    END IF;

    v_trimmed_sku := btrim(p_sku);
    IF v_trimmed_sku IS NULL OR v_trimmed_sku = '' THEN
        RAISE EXCEPTION 'master variant sku is required';
    END IF;

    IF p_base_uom IS NULL OR btrim(p_base_uom) = '' THEN
        RAISE EXCEPTION 'base unit of measure is required';
    END IF;

    BEGIN
        v_classification := upper(btrim(p_classification))::public.item_classification_type;
    EXCEPTION
        WHEN others THEN
            RAISE EXCEPTION 'invalid product classification';
    END;

    IF p_category_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1
            FROM public.item_categories
            WHERE id = p_category_id
              AND tenant_id = v_tenant_id
        ) THEN
            RAISE EXCEPTION 'category not found for tenant';
        END IF;
    END IF;

    IF p_item_id IS NULL THEN
        IF EXISTS (
            SELECT 1
            FROM public.item_variants
            WHERE tenant_id = v_tenant_id
              AND sku = v_trimmed_sku
        ) THEN
            RAISE EXCEPTION 'sku already exists for this tenant';
        END IF;

        INSERT INTO public.items (
            tenant_id,
            category_id,
            name,
            classification,
            base_unit_of_measure,
            hsn_sac_code,
            is_returnable,
            has_variants,
            is_active
        )
        VALUES (
            v_tenant_id,
            p_category_id,
            v_trimmed_name,
            v_classification,
            btrim(p_base_uom),
            NULLIF(btrim(p_hsn_sac_code), ''),
            COALESCE(p_is_returnable, TRUE),
            FALSE,
            TRUE
        )
        RETURNING id INTO v_item_id;

        INSERT INTO public.item_variants (
            item_id,
            tenant_id,
            sku,
            dead_weight_kg,
            length_cm,
            width_cm,
            height_cm,
            is_active
        )
        VALUES (
            v_item_id,
            v_tenant_id,
            v_trimmed_sku,
            COALESCE(p_dead_weight_kg, 0),
            COALESCE(p_length_cm, 0),
            COALESCE(p_width_cm, 0),
            COALESCE(p_height_cm, 0),
            TRUE
        )
        RETURNING id INTO v_variant_id;

        RETURN v_item_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.items
        WHERE id = p_item_id
          AND tenant_id = v_tenant_id
    ) THEN
        RAISE EXCEPTION 'product not found for tenant';
    END IF;

    SELECT id
    INTO v_variant_id
    FROM public.item_variants
    WHERE item_id = p_item_id
      AND tenant_id = v_tenant_id
    ORDER BY created_at ASC
    LIMIT 1;

    IF v_variant_id IS NULL THEN
        RAISE EXCEPTION 'master variant not found for product';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.item_variants
        WHERE tenant_id = v_tenant_id
          AND sku = v_trimmed_sku
          AND id IS DISTINCT FROM v_variant_id
    ) THEN
        RAISE EXCEPTION 'sku already exists for this tenant';
    END IF;

    UPDATE public.items
    SET
        category_id = p_category_id,
        name = v_trimmed_name,
        classification = v_classification,
        base_unit_of_measure = btrim(p_base_uom),
        hsn_sac_code = NULLIF(btrim(p_hsn_sac_code), ''),
        is_returnable = COALESCE(p_is_returnable, TRUE)
    WHERE id = p_item_id
      AND tenant_id = v_tenant_id;

    UPDATE public.item_variants
    SET
        sku = v_trimmed_sku,
        dead_weight_kg = COALESCE(p_dead_weight_kg, 0),
        length_cm = COALESCE(p_length_cm, 0),
        width_cm = COALESCE(p_width_cm, 0),
        height_cm = COALESCE(p_height_cm, 0)
    WHERE id = v_variant_id
      AND tenant_id = v_tenant_id;

    RETURN p_item_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.save_product_master_profile(
    p_item_id UUID DEFAULT NULL,
    p_name TEXT DEFAULT NULL,
    p_classification TEXT DEFAULT NULL,
    p_base_uom TEXT DEFAULT NULL,
    p_category_id UUID DEFAULT NULL,
    p_sku TEXT DEFAULT NULL,
    p_hsn_sac_code TEXT DEFAULT NULL,
    p_is_returnable BOOLEAN DEFAULT TRUE,
    p_dead_weight_kg NUMERIC DEFAULT 0,
    p_length_cm NUMERIC DEFAULT 0,
    p_width_cm NUMERIC DEFAULT 0,
    p_height_cm NUMERIC DEFAULT 0
)
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, private
AS $$
    SELECT private.save_product_master_profile(
        p_item_id,
        p_name,
        p_classification,
        p_base_uom,
        p_category_id,
        p_sku,
        p_hsn_sac_code,
        p_is_returnable,
        p_dead_weight_kg,
        p_length_cm,
        p_width_cm,
        p_height_cm
    );
$$;

REVOKE ALL ON FUNCTION public.save_product_master_profile(
    UUID, TEXT, TEXT, TEXT, UUID, TEXT, TEXT, BOOLEAN, NUMERIC, NUMERIC, NUMERIC, NUMERIC
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.save_product_master_profile(
    UUID, TEXT, TEXT, TEXT, UUID, TEXT, TEXT, BOOLEAN, NUMERIC, NUMERIC, NUMERIC, NUMERIC
) TO authenticated;

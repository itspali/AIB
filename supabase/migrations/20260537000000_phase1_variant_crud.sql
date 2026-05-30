-- ====================================================================
-- AIB SMART ERP - PHASE 1: DEEP VARIANT CRUD
-- Migration: 20260537000000_phase1_variant_crud.sql
-- --------------------------------------------------------------------
--   * save_item_variant gains a price field + attribute-combination
--     uniqueness, and stops writing has_variants (trigger owns it).
--   * save_item_variants_bulk powers the matrix generator.
--   * save_item_variant_axes persists the item-level variant axes.
-- ====================================================================

-- --------------------------------------------------------------------
-- Helper: reject duplicate attribute combinations within an item.
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.assert_variant_combo_unique(
    p_tenant_id UUID,
    p_item_id UUID,
    p_variant_id UUID,
    p_variant_attributes JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
BEGIN
    IF p_variant_attributes IS NULL OR p_variant_attributes = '{}'::jsonb THEN
        RETURN;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.item_variants
        WHERE tenant_id = p_tenant_id
          AND item_id = p_item_id
          AND id IS DISTINCT FROM p_variant_id
          AND variant_attributes = p_variant_attributes
    ) THEN
        RAISE EXCEPTION 'a variant with the same attribute combination already exists';
    END IF;
END;
$$;

DROP FUNCTION IF EXISTS public.save_item_variant(
    UUID, TEXT, UUID, TEXT, JSONB, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, BOOLEAN
);

CREATE OR REPLACE FUNCTION public.save_item_variant(
    p_item_id UUID,
    p_sku TEXT,
    p_variant_id UUID DEFAULT NULL,
    p_barcode TEXT DEFAULT NULL,
    p_variant_attributes JSONB DEFAULT '{}'::jsonb,
    p_dead_weight_kg NUMERIC DEFAULT 0,
    p_weight NUMERIC DEFAULT NULL,
    p_volume NUMERIC DEFAULT NULL,
    p_length_cm NUMERIC DEFAULT 0,
    p_width_cm NUMERIC DEFAULT 0,
    p_height_cm NUMERIC DEFAULT 0,
    p_is_active BOOLEAN DEFAULT TRUE,
    p_price NUMERIC DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_tenant_id UUID;
    v_trimmed_sku TEXT;
    v_result_id UUID;
BEGIN
    v_tenant_id := private.current_tenant_id();
    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'tenant context missing from session';
    END IF;

    IF p_item_id IS NULL THEN
        RAISE EXCEPTION 'item id is required';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.items
        WHERE id = p_item_id
          AND tenant_id = v_tenant_id
    ) THEN
        RAISE EXCEPTION 'product not found for tenant';
    END IF;

    v_trimmed_sku := btrim(p_sku);
    IF v_trimmed_sku IS NULL OR v_trimmed_sku = '' THEN
        RAISE EXCEPTION 'variant sku is required';
    END IF;

    IF p_variant_attributes IS NULL THEN
        p_variant_attributes := '{}'::jsonb;
    END IF;
    IF jsonb_typeof(p_variant_attributes) IS DISTINCT FROM 'object' THEN
        RAISE EXCEPTION 'variant_attributes must be a JSON object';
    END IF;

    IF p_price IS NOT NULL AND p_price < 0 THEN
        RAISE EXCEPTION 'price must be zero or greater';
    END IF;

    PERFORM private.assert_variant_combo_unique(
        v_tenant_id, p_item_id, p_variant_id, p_variant_attributes
    );

    IF p_variant_id IS NULL THEN
        IF EXISTS (
            SELECT 1
            FROM public.item_variants
            WHERE tenant_id = v_tenant_id
              AND sku = v_trimmed_sku
        ) THEN
            RAISE EXCEPTION 'sku already exists for this tenant';
        END IF;

        INSERT INTO public.item_variants (
            item_id, tenant_id, sku, barcode, variant_attributes,
            dead_weight_kg, weight, volume, length_cm, width_cm, height_cm,
            is_active, is_master, price
        )
        VALUES (
            p_item_id, v_tenant_id, v_trimmed_sku, NULLIF(btrim(p_barcode), ''), p_variant_attributes,
            COALESCE(p_dead_weight_kg, 0), p_weight, p_volume,
            COALESCE(p_length_cm, 0), COALESCE(p_width_cm, 0), COALESCE(p_height_cm, 0),
            COALESCE(p_is_active, TRUE), FALSE, p_price
        )
        RETURNING id INTO v_result_id;

        RETURN v_result_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.item_variants
        WHERE id = p_variant_id
          AND item_id = p_item_id
          AND tenant_id = v_tenant_id
    ) THEN
        RAISE EXCEPTION 'variant not found for product';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.item_variants
        WHERE tenant_id = v_tenant_id
          AND sku = v_trimmed_sku
          AND id IS DISTINCT FROM p_variant_id
    ) THEN
        RAISE EXCEPTION 'sku already exists for this tenant';
    END IF;

    UPDATE public.item_variants
    SET
        sku = v_trimmed_sku,
        barcode = NULLIF(btrim(p_barcode), ''),
        variant_attributes = p_variant_attributes,
        dead_weight_kg = COALESCE(p_dead_weight_kg, 0),
        weight = p_weight,
        volume = p_volume,
        length_cm = COALESCE(p_length_cm, 0),
        width_cm = COALESCE(p_width_cm, 0),
        height_cm = COALESCE(p_height_cm, 0),
        is_active = COALESCE(p_is_active, TRUE),
        price = COALESCE(p_price, price)
    WHERE id = p_variant_id
      AND tenant_id = v_tenant_id
    RETURNING id INTO v_result_id;

    RETURN v_result_id;
END;
$$;

REVOKE ALL ON FUNCTION public.save_item_variant(
    UUID, TEXT, UUID, TEXT, JSONB, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, BOOLEAN, NUMERIC
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_item_variant(
    UUID, TEXT, UUID, TEXT, JSONB, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, BOOLEAN, NUMERIC
) TO authenticated;

-- --------------------------------------------------------------------
-- save_item_variants_bulk: matrix generator backing RPC.
-- p_variants = JSON array of:
--   { sku, barcode, price, is_active, variant_attributes }
-- Inserted in array order so the existing master stays master.
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.save_item_variants_bulk(
    p_item_id UUID,
    p_variants JSONB
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_tenant_id UUID;
    v_entry JSONB;
    v_sku TEXT;
    v_attrs JSONB;
    v_price NUMERIC(15, 4);
    v_inserted INTEGER := 0;
    v_seen_skus TEXT[] := ARRAY[]::TEXT[];
BEGIN
    v_tenant_id := private.current_tenant_id();
    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'tenant context missing from session';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.items WHERE id = p_item_id AND tenant_id = v_tenant_id
    ) THEN
        RAISE EXCEPTION 'product not found for tenant';
    END IF;

    IF p_variants IS NULL OR jsonb_typeof(p_variants) IS DISTINCT FROM 'array' THEN
        RAISE EXCEPTION 'variants payload must be a JSON array';
    END IF;

    FOR v_entry IN SELECT value FROM jsonb_array_elements(p_variants)
    LOOP
        v_sku := btrim(v_entry ->> 'sku');
        IF v_sku IS NULL OR v_sku = '' THEN
            RAISE EXCEPTION 'every generated variant requires a sku';
        END IF;

        IF v_sku = ANY(v_seen_skus) THEN
            RAISE EXCEPTION 'duplicate sku % in generated batch', v_sku;
        END IF;
        v_seen_skus := array_append(v_seen_skus, v_sku);

        IF EXISTS (
            SELECT 1 FROM public.item_variants
            WHERE tenant_id = v_tenant_id AND sku = v_sku
        ) THEN
            RAISE EXCEPTION 'sku % already exists for this tenant', v_sku;
        END IF;

        v_attrs := COALESCE(v_entry -> 'variant_attributes', '{}'::jsonb);
        IF jsonb_typeof(v_attrs) IS DISTINCT FROM 'object' THEN
            v_attrs := '{}'::jsonb;
        END IF;

        PERFORM private.assert_variant_combo_unique(v_tenant_id, p_item_id, NULL, v_attrs);

        v_price := NULLIF(v_entry ->> 'price', '')::NUMERIC;
        IF v_price IS NOT NULL AND v_price < 0 THEN
            RAISE EXCEPTION 'price must be zero or greater';
        END IF;

        INSERT INTO public.item_variants (
            item_id, tenant_id, sku, barcode, variant_attributes,
            is_active, is_master, price
        )
        VALUES (
            p_item_id, v_tenant_id, v_sku,
            NULLIF(btrim(v_entry ->> 'barcode'), ''),
            v_attrs,
            COALESCE((v_entry ->> 'is_active')::BOOLEAN, TRUE),
            FALSE,
            v_price
        );

        v_inserted := v_inserted + 1;
    END LOOP;

    RETURN v_inserted;
END;
$$;

REVOKE ALL ON FUNCTION public.save_item_variants_bulk(UUID, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_item_variants_bulk(UUID, JSONB) TO authenticated;

-- --------------------------------------------------------------------
-- save_item_variant_axes: persist which attribute keys are variant-defining.
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.save_item_variant_axes(
    p_item_id UUID,
    p_axes JSONB
)
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

    IF p_axes IS NULL OR jsonb_typeof(p_axes) IS DISTINCT FROM 'array' THEN
        p_axes := '[]'::jsonb;
    END IF;

    UPDATE public.items
    SET variant_axes = p_axes
    WHERE id = p_item_id
      AND tenant_id = v_tenant_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'product not found for tenant';
    END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.save_item_variant_axes(UUID, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_item_variant_axes(UUID, JSONB) TO authenticated;

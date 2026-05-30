-- Extended bulk item catalog mutations (phase 2).

-- --------------------------------------------------------------------
-- bulk_reactivate_items
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.bulk_reactivate_items(p_item_ids UUID[])
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_tenant_id UUID;
    v_affected INTEGER;
BEGIN
    v_tenant_id := private.current_tenant_id();
    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'tenant context missing from session';
    END IF;

    IF p_item_ids IS NULL OR array_length(p_item_ids, 1) IS NULL THEN
        RETURN 0;
    END IF;

    UPDATE public.items
    SET is_active = TRUE
    WHERE tenant_id = v_tenant_id
      AND id = ANY(p_item_ids);

    GET DIAGNOSTICS v_affected = ROW_COUNT;

    UPDATE public.item_variants
    SET is_active = TRUE
    WHERE tenant_id = v_tenant_id
      AND item_id = ANY(p_item_ids);

    RETURN v_affected;
END;
$$;

-- --------------------------------------------------------------------
-- bulk_set_item_operational_flags
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.bulk_set_item_operational_flags(
    p_item_ids UUID[],
    p_is_purchasable BOOLEAN DEFAULT NULL,
    p_is_salable BOOLEAN DEFAULT NULL,
    p_is_returnable BOOLEAN DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_tenant_id UUID;
    v_affected INTEGER;
BEGIN
    v_tenant_id := private.current_tenant_id();
    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'tenant context missing from session';
    END IF;

    IF p_item_ids IS NULL OR array_length(p_item_ids, 1) IS NULL THEN
        RETURN 0;
    END IF;

    IF p_is_purchasable IS NULL AND p_is_salable IS NULL AND p_is_returnable IS NULL THEN
        RAISE EXCEPTION 'at least one operational flag must be provided';
    END IF;

    UPDATE public.items
    SET
        is_purchasable = COALESCE(p_is_purchasable, is_purchasable),
        is_salable = COALESCE(p_is_salable, is_salable),
        is_returnable = COALESCE(p_is_returnable, is_returnable)
    WHERE tenant_id = v_tenant_id
      AND id = ANY(p_item_ids);

    GET DIAGNOSTICS v_affected = ROW_COUNT;
    RETURN v_affected;
END;
$$;

-- --------------------------------------------------------------------
-- bulk_set_item_classification
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.bulk_set_item_classification(
    p_item_ids UUID[],
    p_classification TEXT
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_tenant_id UUID;
    v_classification public.item_classification_type;
    v_affected INTEGER;
BEGIN
    v_tenant_id := private.current_tenant_id();
    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'tenant context missing from session';
    END IF;

    IF p_item_ids IS NULL OR array_length(p_item_ids, 1) IS NULL THEN
        RETURN 0;
    END IF;

    BEGIN
        v_classification := upper(btrim(p_classification))::public.item_classification_type;
    EXCEPTION
        WHEN others THEN
            RAISE EXCEPTION 'invalid product classification';
    END;

    UPDATE public.items
    SET classification = v_classification
    WHERE tenant_id = v_tenant_id
      AND id = ANY(p_item_ids);

    GET DIAGNOSTICS v_affected = ROW_COUNT;
    RETURN v_affected;
END;
$$;

-- --------------------------------------------------------------------
-- bulk_set_item_category
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.bulk_set_item_category(
    p_item_ids UUID[],
    p_category_id UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_tenant_id UUID;
    v_affected INTEGER;
BEGIN
    v_tenant_id := private.current_tenant_id();
    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'tenant context missing from session';
    END IF;

    IF p_item_ids IS NULL OR array_length(p_item_ids, 1) IS NULL THEN
        RETURN 0;
    END IF;

    IF p_category_id IS NULL THEN
        RAISE EXCEPTION 'category is required';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.item_categories
        WHERE id = p_category_id
          AND tenant_id = v_tenant_id
          AND is_active = TRUE
    ) THEN
        RAISE EXCEPTION 'category not found for tenant';
    END IF;

    UPDATE public.items
    SET category_id = p_category_id
    WHERE tenant_id = v_tenant_id
      AND id = ANY(p_item_ids);

    GET DIAGNOSTICS v_affected = ROW_COUNT;
    RETURN v_affected;
END;
$$;

-- --------------------------------------------------------------------
-- bulk_set_item_tax_category
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.bulk_set_item_tax_category(
    p_item_ids UUID[],
    p_tax_category TEXT
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_tenant_id UUID;
    v_tax_category TEXT;
    v_affected INTEGER;
BEGIN
    v_tenant_id := private.current_tenant_id();
    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'tenant context missing from session';
    END IF;

    IF p_item_ids IS NULL OR array_length(p_item_ids, 1) IS NULL THEN
        RETURN 0;
    END IF;

    v_tax_category := upper(btrim(COALESCE(p_tax_category, 'STANDARD')));
    IF v_tax_category NOT IN ('STANDARD', 'REDUCED', 'ZERO_RATED', 'EXEMPT') THEN
        RAISE EXCEPTION 'invalid default tax category';
    END IF;

    UPDATE public.items
    SET default_tax_category = v_tax_category
    WHERE tenant_id = v_tenant_id
      AND id = ANY(p_item_ids);

    GET DIAGNOSTICS v_affected = ROW_COUNT;
    RETURN v_affected;
END;
$$;

-- --------------------------------------------------------------------
-- bulk_adjust_purchase_pricing
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.bulk_adjust_purchase_pricing(
    p_item_ids UUID[],
    p_mode TEXT,
    p_value NUMERIC
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_tenant_id UUID;
    v_item_id UUID;
    v_current_price NUMERIC(15, 4);
    v_new_price NUMERIC(15, 4);
    v_mode TEXT;
    v_affected INTEGER := 0;
BEGIN
    v_tenant_id := private.current_tenant_id();
    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'tenant context missing from session';
    END IF;

    IF p_item_ids IS NULL OR array_length(p_item_ids, 1) IS NULL THEN
        RETURN 0;
    END IF;

    v_mode := upper(btrim(p_mode));
    IF v_mode NOT IN ('PERCENTAGE', 'FIXED_OFFSET') THEN
        RAISE EXCEPTION 'invalid pricing adjustment mode';
    END IF;

    IF p_value IS NULL THEN
        RAISE EXCEPTION 'adjustment value is required';
    END IF;

    IF v_mode = 'PERCENTAGE' AND p_value <= 0 THEN
        RAISE EXCEPTION 'percentage adjustment must be greater than zero';
    END IF;

    IF v_mode = 'FIXED_OFFSET' AND p_value = 0 THEN
        RAISE EXCEPTION 'fixed offset must be non-zero';
    END IF;

    FOREACH v_item_id IN ARRAY p_item_ids
    LOOP
        IF NOT EXISTS (
            SELECT 1
            FROM public.items
            WHERE id = v_item_id
              AND tenant_id = v_tenant_id
        ) THEN
            CONTINUE;
        END IF;

        SELECT si.supplier_price
        INTO v_current_price
        FROM public.supplier_items si
        WHERE si.tenant_id = v_tenant_id
          AND si.item_id = v_item_id
        ORDER BY si.is_preferred DESC, si.supplier_id ASC
        LIMIT 1;

        v_current_price := COALESCE(v_current_price, 0);

        IF v_mode = 'PERCENTAGE' THEN
            v_new_price := ROUND(v_current_price * (1 + (p_value / 100)), 4);
        ELSE
            v_new_price := ROUND(v_current_price + p_value, 4);
        END IF;

        IF v_new_price < 0 THEN
            v_new_price := 0;
        END IF;

        UPDATE public.supplier_items si
        SET supplier_price = v_new_price
        FROM (
            SELECT id
            FROM public.supplier_items
            WHERE tenant_id = v_tenant_id
              AND item_id = v_item_id
            ORDER BY is_preferred DESC, supplier_id ASC
            LIMIT 1
        ) preferred
        WHERE si.id = preferred.id
          AND si.tenant_id = v_tenant_id;

        IF FOUND THEN
            v_affected := v_affected + 1;
        END IF;
    END LOOP;

    RETURN v_affected;
END;
$$;

-- --------------------------------------------------------------------
-- bulk_modify_item_tags
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.bulk_modify_item_tags(
    p_item_ids UUID[],
    p_tag_ids UUID[],
    p_mode TEXT
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_tenant_id UUID;
    v_item_id UUID;
    v_tag_id UUID;
    v_mode TEXT;
    v_affected INTEGER := 0;
BEGIN
    v_tenant_id := private.current_tenant_id();
    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'tenant context missing from session';
    END IF;

    IF p_item_ids IS NULL OR array_length(p_item_ids, 1) IS NULL THEN
        RETURN 0;
    END IF;

    IF p_tag_ids IS NULL OR array_length(p_tag_ids, 1) IS NULL THEN
        RAISE EXCEPTION 'at least one tag is required';
    END IF;

    v_mode := upper(btrim(p_mode));
    IF v_mode NOT IN ('ADD', 'REMOVE') THEN
        RAISE EXCEPTION 'invalid tag modification mode';
    END IF;

    FOREACH v_tag_id IN ARRAY p_tag_ids
    LOOP
        IF NOT EXISTS (
            SELECT 1
            FROM public.tags
            WHERE id = v_tag_id
              AND tenant_id = v_tenant_id
        ) THEN
            RAISE EXCEPTION 'tag not found for tenant';
        END IF;
    END LOOP;

    FOREACH v_item_id IN ARRAY p_item_ids
    LOOP
        IF NOT EXISTS (
            SELECT 1
            FROM public.items
            WHERE id = v_item_id
              AND tenant_id = v_tenant_id
        ) THEN
            CONTINUE;
        END IF;

        IF v_mode = 'ADD' THEN
            FOREACH v_tag_id IN ARRAY p_tag_ids
            LOOP
                INSERT INTO public.item_tag_assignments (tenant_id, item_id, tag_id)
                VALUES (v_tenant_id, v_item_id, v_tag_id)
                ON CONFLICT (item_id, tag_id) DO NOTHING;
            END LOOP;
        ELSE
            DELETE FROM public.item_tag_assignments
            WHERE tenant_id = v_tenant_id
              AND item_id = v_item_id
              AND tag_id = ANY(p_tag_ids);
        END IF;

        v_affected := v_affected + 1;
    END LOOP;

    RETURN v_affected;
END;
$$;

-- --------------------------------------------------------------------
-- bulk_set_storefront_visibility
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.bulk_set_storefront_visibility(
    p_item_ids UUID[],
    p_storefront_id UUID,
    p_is_visible BOOLEAN
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_tenant_id UUID;
    v_item_id UUID;
    v_affected INTEGER := 0;
BEGIN
    v_tenant_id := private.current_tenant_id();
    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'tenant context missing from session';
    END IF;

    IF p_item_ids IS NULL OR array_length(p_item_ids, 1) IS NULL THEN
        RETURN 0;
    END IF;

    IF p_storefront_id IS NULL THEN
        RAISE EXCEPTION 'storefront is required';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.storefront_channels
        WHERE id = p_storefront_id
          AND tenant_id = v_tenant_id
          AND is_active = TRUE
    ) THEN
        RAISE EXCEPTION 'storefront not found for tenant';
    END IF;

    FOREACH v_item_id IN ARRAY p_item_ids
    LOOP
        IF NOT EXISTS (
            SELECT 1
            FROM public.items
            WHERE id = v_item_id
              AND tenant_id = v_tenant_id
        ) THEN
            CONTINUE;
        END IF;

        INSERT INTO public.storefront_items (
            tenant_id,
            storefront_id,
            item_id,
            is_visible
        )
        VALUES (
            v_tenant_id,
            p_storefront_id,
            v_item_id,
            COALESCE(p_is_visible, TRUE)
        )
        ON CONFLICT (storefront_id, item_id)
        DO UPDATE SET is_visible = EXCLUDED.is_visible;

        v_affected := v_affected + 1;
    END LOOP;

    RETURN v_affected;
END;
$$;

REVOKE ALL ON FUNCTION public.bulk_reactivate_items(UUID[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bulk_reactivate_items(UUID[]) TO authenticated;

REVOKE ALL ON FUNCTION public.bulk_set_item_operational_flags(UUID[], BOOLEAN, BOOLEAN, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bulk_set_item_operational_flags(UUID[], BOOLEAN, BOOLEAN, BOOLEAN) TO authenticated;

REVOKE ALL ON FUNCTION public.bulk_set_item_classification(UUID[], TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bulk_set_item_classification(UUID[], TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.bulk_set_item_category(UUID[], UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bulk_set_item_category(UUID[], UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.bulk_set_item_tax_category(UUID[], TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bulk_set_item_tax_category(UUID[], TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.bulk_adjust_purchase_pricing(UUID[], TEXT, NUMERIC) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bulk_adjust_purchase_pricing(UUID[], TEXT, NUMERIC) TO authenticated;

REVOKE ALL ON FUNCTION public.bulk_modify_item_tags(UUID[], UUID[], TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bulk_modify_item_tags(UUID[], UUID[], TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.bulk_set_storefront_visibility(UUID[], UUID, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bulk_set_storefront_visibility(UUID[], UUID, BOOLEAN) TO authenticated;

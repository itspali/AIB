-- ====================================================================
-- AIB SMART ERP - PHASE 0: VARIANT FOUNDATION RPCS
-- Migration: 20260536100000_phase0_variant_rpcs.sql
-- --------------------------------------------------------------------
-- Rewrites save_product_master_profile to:
--   * write stable items.code on create (decoupled from master SKU)
--   * flag the master variant via is_master (no created_at re-derivation)
--   * stop writing has_variants (the trigger owns it now)
--   * guard base_unit_of_measure / classification changes once ledger
--     history exists, and reconcile orphaned variant_attributes when the
--     category changes
-- Rewrites delete_item_variant to discontinue (deactivate) instead of
-- hard-deleting variants that carry inventory_ledger history.
-- ====================================================================

-- --------------------------------------------------------------------
-- Helper: prune variant_attributes to the keys allowed by a category.
-- --------------------------------------------------------------------
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

    SELECT COALESCE(
        array_agg(template ->> 'key'),
        ARRAY[]::TEXT[]
    )
    INTO v_allowed
    FROM public.item_categories c
    CROSS JOIN LATERAL jsonb_array_elements(c.attribute_templates) AS template
    WHERE c.id = p_category_id
      AND c.tenant_id = p_tenant_id;

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

DROP FUNCTION IF EXISTS public.save_product_master_profile(
    UUID, TEXT, TEXT, TEXT, UUID, TEXT, TEXT, BOOLEAN, BOOLEAN, BOOLEAN, TEXT, BOOLEAN, TEXT, BOOLEAN, TEXT, JSONB,
    NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, BOOLEAN, NUMERIC, TEXT, TEXT, NUMERIC, NUMERIC, UUID,
    JSONB, JSONB, UUID[], JSONB
);

DROP FUNCTION IF EXISTS private.save_product_master_profile(
    UUID, TEXT, TEXT, TEXT, UUID, TEXT, TEXT, BOOLEAN, BOOLEAN, BOOLEAN, TEXT, BOOLEAN, TEXT, BOOLEAN, TEXT, JSONB,
    NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, BOOLEAN, NUMERIC, TEXT, TEXT, NUMERIC, NUMERIC, UUID,
    JSONB, JSONB, UUID[], JSONB
);

CREATE OR REPLACE FUNCTION private.save_product_master_profile(
    p_item_id UUID DEFAULT NULL,
    p_name TEXT DEFAULT NULL,
    p_classification TEXT DEFAULT NULL,
    p_base_uom TEXT DEFAULT NULL,
    p_category_id UUID DEFAULT NULL,
    p_sku TEXT DEFAULT NULL,
    p_description TEXT DEFAULT NULL,
    p_is_purchasable BOOLEAN DEFAULT TRUE,
    p_is_salable BOOLEAN DEFAULT TRUE,
    p_is_active BOOLEAN DEFAULT TRUE,
    p_hsn_sac_code TEXT DEFAULT NULL,
    p_has_variants BOOLEAN DEFAULT FALSE,   -- ignored: derived by trigger
    p_default_tax_category TEXT DEFAULT 'STANDARD',
    p_is_returnable BOOLEAN DEFAULT TRUE,
    p_barcode TEXT DEFAULT NULL,
    p_variant_attributes JSONB DEFAULT '{}'::jsonb,
    p_dead_weight_kg NUMERIC DEFAULT 0,
    p_weight NUMERIC DEFAULT NULL,
    p_volume NUMERIC DEFAULT NULL,
    p_length_cm NUMERIC DEFAULT 0,
    p_width_cm NUMERIC DEFAULT 0,
    p_height_cm NUMERIC DEFAULT 0,
    p_variant_is_active BOOLEAN DEFAULT TRUE,
    p_selling_price NUMERIC DEFAULT NULL,
    p_selling_uom TEXT DEFAULT NULL,
    p_purchase_uom TEXT DEFAULT NULL,
    p_purchase_uom_conversion NUMERIC DEFAULT NULL,
    p_purchase_price NUMERIC DEFAULT NULL,
    p_supplier_id UUID DEFAULT NULL,
    p_custom_fields JSONB DEFAULT '{}'::jsonb,
    p_alternate_uoms JSONB DEFAULT '[]'::jsonb,
    p_tag_ids UUID[] DEFAULT ARRAY[]::UUID[],
    p_storefront_items JSONB DEFAULT '[]'::jsonb
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
    v_trimmed_base_uom TEXT;
    v_tax_category TEXT;
    v_classification public.item_classification_type;
    v_old_category_id UUID;
    v_old_base_uom TEXT;
    v_old_classification public.item_classification_type;
    v_has_ledger BOOLEAN;
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
    v_trimmed_base_uom := btrim(p_base_uom);

    v_tax_category := upper(btrim(COALESCE(p_default_tax_category, 'STANDARD')));
    IF v_tax_category NOT IN ('STANDARD', 'REDUCED', 'ZERO_RATED', 'EXEMPT') THEN
        RAISE EXCEPTION 'invalid default tax category';
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

    IF p_variant_attributes IS NULL THEN
        p_variant_attributes := '{}'::jsonb;
    END IF;
    IF jsonb_typeof(p_variant_attributes) IS DISTINCT FROM 'object' THEN
        RAISE EXCEPTION 'variant_attributes must be a JSON object';
    END IF;

    IF p_custom_fields IS NULL THEN
        p_custom_fields := '{}'::jsonb;
    END IF;
    IF jsonb_typeof(p_custom_fields) IS DISTINCT FROM 'object' THEN
        RAISE EXCEPTION 'custom_fields must be a JSON object';
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
            code,
            name,
            description,
            classification,
            base_unit_of_measure,
            hsn_sac_code,
            is_purchasable,
            is_salable,
            default_tax_category,
            is_returnable,
            custom_fields,
            is_active
        )
        VALUES (
            v_tenant_id,
            p_category_id,
            v_trimmed_sku,
            v_trimmed_name,
            NULLIF(btrim(p_description), ''),
            v_classification,
            v_trimmed_base_uom,
            NULLIF(btrim(p_hsn_sac_code), ''),
            COALESCE(p_is_purchasable, TRUE),
            COALESCE(p_is_salable, TRUE),
            v_tax_category,
            COALESCE(p_is_returnable, TRUE),
            p_custom_fields,
            COALESCE(p_is_active, TRUE)
        )
        RETURNING id INTO v_item_id;

        INSERT INTO public.item_variants (
            item_id,
            tenant_id,
            sku,
            barcode,
            variant_attributes,
            dead_weight_kg,
            weight,
            volume,
            length_cm,
            width_cm,
            height_cm,
            is_active,
            is_master
        )
        VALUES (
            v_item_id,
            v_tenant_id,
            v_trimmed_sku,
            NULLIF(btrim(p_barcode), ''),
            p_variant_attributes,
            COALESCE(p_dead_weight_kg, 0),
            p_weight,
            p_volume,
            COALESCE(p_length_cm, 0),
            COALESCE(p_width_cm, 0),
            COALESCE(p_height_cm, 0),
            COALESCE(p_variant_is_active, TRUE),
            TRUE
        )
        RETURNING id INTO v_variant_id;
    ELSE
        v_item_id := p_item_id;

        SELECT category_id, base_unit_of_measure, classification
        INTO v_old_category_id, v_old_base_uom, v_old_classification
        FROM public.items
        WHERE id = p_item_id
          AND tenant_id = v_tenant_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'product not found for tenant';
        END IF;

        -- Guard structural changes once the item has posted inventory history.
        IF (v_old_base_uom IS DISTINCT FROM v_trimmed_base_uom
            OR v_old_classification IS DISTINCT FROM v_classification) THEN
            SELECT EXISTS (
                SELECT 1
                FROM public.inventory_ledger
                WHERE item_id = p_item_id
                  AND tenant_id = v_tenant_id
            )
            INTO v_has_ledger;

            IF v_has_ledger THEN
                RAISE EXCEPTION
                    'base unit of measure and classification cannot change after inventory movements exist for this item';
            END IF;
        END IF;

        SELECT id
        INTO v_variant_id
        FROM public.item_variants
        WHERE item_id = p_item_id
          AND tenant_id = v_tenant_id
          AND is_master = TRUE
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
            description = NULLIF(btrim(p_description), ''),
            classification = v_classification,
            base_unit_of_measure = v_trimmed_base_uom,
            hsn_sac_code = NULLIF(btrim(p_hsn_sac_code), ''),
            is_purchasable = COALESCE(p_is_purchasable, TRUE),
            is_salable = COALESCE(p_is_salable, TRUE),
            default_tax_category = v_tax_category,
            is_returnable = COALESCE(p_is_returnable, TRUE),
            custom_fields = p_custom_fields,
            is_active = COALESCE(p_is_active, TRUE),
            code = COALESCE(code, v_trimmed_sku)
        WHERE id = p_item_id
          AND tenant_id = v_tenant_id;

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
            is_active = COALESCE(p_variant_is_active, TRUE)
        WHERE id = v_variant_id
          AND tenant_id = v_tenant_id;

        -- Reconcile sibling variant attributes when the category changes.
        IF v_old_category_id IS DISTINCT FROM p_category_id THEN
            PERFORM private.reconcile_variant_attributes(v_tenant_id, v_item_id, p_category_id);
        END IF;
    END IF;

    PERFORM private.sync_product_master_commerce(
        v_tenant_id,
        v_item_id,
        v_trimmed_base_uom,
        p_selling_price,
        p_selling_uom,
        p_purchase_uom,
        p_purchase_uom_conversion,
        p_purchase_price,
        p_supplier_id
    );

    PERFORM private.sync_product_alternate_uoms(
        v_tenant_id,
        v_item_id,
        v_trimmed_base_uom,
        p_alternate_uoms
    );

    PERFORM private.sync_product_tag_assignments(
        v_tenant_id,
        v_item_id,
        p_tag_ids
    );

    PERFORM private.sync_product_storefront_items(
        v_tenant_id,
        v_item_id,
        p_storefront_items
    );

    RETURN v_item_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.save_product_master_profile(
    p_item_id UUID DEFAULT NULL,
    p_name TEXT DEFAULT NULL,
    p_classification TEXT DEFAULT NULL,
    p_base_uom TEXT DEFAULT NULL,
    p_category_id UUID DEFAULT NULL,
    p_sku TEXT DEFAULT NULL,
    p_description TEXT DEFAULT NULL,
    p_is_purchasable BOOLEAN DEFAULT TRUE,
    p_is_salable BOOLEAN DEFAULT TRUE,
    p_is_active BOOLEAN DEFAULT TRUE,
    p_hsn_sac_code TEXT DEFAULT NULL,
    p_has_variants BOOLEAN DEFAULT FALSE,
    p_default_tax_category TEXT DEFAULT 'STANDARD',
    p_is_returnable BOOLEAN DEFAULT TRUE,
    p_barcode TEXT DEFAULT NULL,
    p_variant_attributes JSONB DEFAULT '{}'::jsonb,
    p_dead_weight_kg NUMERIC DEFAULT 0,
    p_weight NUMERIC DEFAULT NULL,
    p_volume NUMERIC DEFAULT NULL,
    p_length_cm NUMERIC DEFAULT 0,
    p_width_cm NUMERIC DEFAULT 0,
    p_height_cm NUMERIC DEFAULT 0,
    p_variant_is_active BOOLEAN DEFAULT TRUE,
    p_selling_price NUMERIC DEFAULT NULL,
    p_selling_uom TEXT DEFAULT NULL,
    p_purchase_uom TEXT DEFAULT NULL,
    p_purchase_uom_conversion NUMERIC DEFAULT NULL,
    p_purchase_price NUMERIC DEFAULT NULL,
    p_supplier_id UUID DEFAULT NULL,
    p_custom_fields JSONB DEFAULT '{}'::jsonb,
    p_alternate_uoms JSONB DEFAULT '[]'::jsonb,
    p_tag_ids UUID[] DEFAULT ARRAY[]::UUID[],
    p_storefront_items JSONB DEFAULT '[]'::jsonb
)
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, private
AS $$
    SELECT private.save_product_master_profile(
        p_item_id, p_name, p_classification, p_base_uom, p_category_id, p_sku, p_description,
        p_is_purchasable, p_is_salable, p_is_active, p_hsn_sac_code, p_has_variants,
        p_default_tax_category, p_is_returnable, p_barcode, p_variant_attributes,
        p_dead_weight_kg, p_weight, p_volume, p_length_cm, p_width_cm, p_height_cm,
        p_variant_is_active, p_selling_price, p_selling_uom, p_purchase_uom,
        p_purchase_uom_conversion, p_purchase_price, p_supplier_id, p_custom_fields,
        p_alternate_uoms, p_tag_ids, p_storefront_items
    );
$$;

REVOKE ALL ON FUNCTION public.save_product_master_profile(
    UUID, TEXT, TEXT, TEXT, UUID, TEXT, TEXT, BOOLEAN, BOOLEAN, BOOLEAN, TEXT, BOOLEAN, TEXT, BOOLEAN, TEXT, JSONB,
    NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, BOOLEAN, NUMERIC, TEXT, TEXT, NUMERIC, NUMERIC, UUID,
    JSONB, JSONB, UUID[], JSONB
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.save_product_master_profile(
    UUID, TEXT, TEXT, TEXT, UUID, TEXT, TEXT, BOOLEAN, BOOLEAN, BOOLEAN, TEXT, BOOLEAN, TEXT, BOOLEAN, TEXT, JSONB,
    NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, BOOLEAN, NUMERIC, TEXT, TEXT, NUMERIC, NUMERIC, UUID,
    JSONB, JSONB, UUID[], JSONB
) TO authenticated;

-- --------------------------------------------------------------------
-- delete_item_variant: discontinue when ledger history exists.
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.delete_item_variant(p_variant_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_tenant_id UUID;
    v_item_id UUID;
    v_is_master BOOLEAN;
    v_variant_count INTEGER;
    v_has_ledger BOOLEAN;
BEGIN
    v_tenant_id := private.current_tenant_id();
    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'tenant context missing from session';
    END IF;

    SELECT item_id, is_master
    INTO v_item_id, v_is_master
    FROM public.item_variants
    WHERE id = p_variant_id
      AND tenant_id = v_tenant_id;

    IF v_item_id IS NULL THEN
        RAISE EXCEPTION 'variant not found for tenant';
    END IF;

    IF v_is_master THEN
        RAISE EXCEPTION 'cannot delete the master variant; edit it from the product profile instead';
    END IF;

    SELECT COUNT(*)
    INTO v_variant_count
    FROM public.item_variants
    WHERE item_id = v_item_id
      AND tenant_id = v_tenant_id;

    IF v_variant_count <= 1 THEN
        RAISE EXCEPTION 'cannot delete the only variant for this product';
    END IF;

    SELECT EXISTS (
        SELECT 1
        FROM public.inventory_ledger
        WHERE variant_id = p_variant_id
          AND tenant_id = v_tenant_id
    )
    INTO v_has_ledger;

    IF v_has_ledger THEN
        -- Cannot remove a variant with posted inventory history; discontinue it.
        UPDATE public.item_variants
        SET is_active = FALSE
        WHERE id = p_variant_id
          AND tenant_id = v_tenant_id;
        RETURN;
    END IF;

    DELETE FROM public.item_variants
    WHERE id = p_variant_id
      AND tenant_id = v_tenant_id;
    -- has_variants is recomputed by item_variants_sync_has_variants trigger.
END;
$$;

REVOKE ALL ON FUNCTION public.delete_item_variant(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_item_variant(UUID) TO authenticated;

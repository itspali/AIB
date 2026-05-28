-- ====================================================================
-- AIB SMART ERP - PRODUCT CATALOG EXTENSIONS (TAGS, UOMS, STOREFRONT)
-- Migration: 20260531910000_product_catalog_extensions_rpc.sql
-- ====================================================================

CREATE OR REPLACE FUNCTION private.slugify_tag_name(p_name TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT NULLIF(
        regexp_replace(lower(btrim(p_name)), '[^a-z0-9]+', '-', 'g'),
        ''
    );
$$;

CREATE OR REPLACE FUNCTION public.ensure_tag(
    p_name TEXT,
    p_tag_group TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_tenant_id UUID;
    v_trimmed_name TEXT;
    v_slug TEXT;
    v_tag_id UUID;
BEGIN
    v_tenant_id := private.current_tenant_id();
    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'tenant context missing from session';
    END IF;

    v_trimmed_name := btrim(p_name);
    IF v_trimmed_name IS NULL OR v_trimmed_name = '' THEN
        RAISE EXCEPTION 'tag name is required';
    END IF;

    v_slug := private.slugify_tag_name(v_trimmed_name);
    IF v_slug IS NULL THEN
        RAISE EXCEPTION 'tag name must contain alphanumeric characters';
    END IF;

    SELECT id
    INTO v_tag_id
    FROM public.tags
    WHERE tenant_id = v_tenant_id
      AND slug = v_slug
    LIMIT 1;

    IF v_tag_id IS NOT NULL THEN
        RETURN v_tag_id;
    END IF;

    INSERT INTO public.tags (tenant_id, name, slug, tag_group)
    VALUES (
        v_tenant_id,
        v_trimmed_name,
        v_slug,
        NULLIF(btrim(p_tag_group), '')
    )
    RETURNING id INTO v_tag_id;

    RETURN v_tag_id;
END;
$$;

CREATE OR REPLACE FUNCTION private.sync_product_alternate_uoms(
    p_tenant_id UUID,
    p_item_id UUID,
    p_base_uom TEXT,
    p_alternate_uoms JSONB DEFAULT '[]'::jsonb
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_entry JSONB;
    v_uom_code TEXT;
    v_conversion NUMERIC;
    v_base_uom TEXT;
BEGIN
    v_base_uom := btrim(p_base_uom);

    IF p_alternate_uoms IS NULL THEN
        p_alternate_uoms := '[]'::jsonb;
    END IF;

    IF jsonb_typeof(p_alternate_uoms) IS DISTINCT FROM 'array' THEN
        RAISE EXCEPTION 'alternate uoms must be a JSON array';
    END IF;

    DELETE FROM public.item_uoms
    WHERE tenant_id = p_tenant_id
      AND item_id = p_item_id;

    FOR v_entry IN SELECT value FROM jsonb_array_elements(p_alternate_uoms)
    LOOP
        v_uom_code := NULLIF(btrim(v_entry ->> 'uom_code'), '');
        v_conversion := NULLIF(v_entry ->> 'conversion_factor', '')::NUMERIC;

        IF v_uom_code IS NULL OR v_uom_code = v_base_uom THEN
            CONTINUE;
        END IF;

        IF v_conversion IS NULL OR v_conversion <= 0 THEN
            RAISE EXCEPTION 'alternate uom conversion factor must be positive';
        END IF;

        INSERT INTO public.item_uoms (tenant_id, item_id, uom_code, conversion_factor)
        VALUES (p_tenant_id, p_item_id, v_uom_code, v_conversion)
        ON CONFLICT (item_id, uom_code)
        DO UPDATE SET conversion_factor = EXCLUDED.conversion_factor;
    END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION private.sync_product_tag_assignments(
    p_tenant_id UUID,
    p_item_id UUID,
    p_tag_ids UUID[] DEFAULT ARRAY[]::UUID[]
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_tag_id UUID;
BEGIN
    DELETE FROM public.item_tag_assignments
    WHERE tenant_id = p_tenant_id
      AND item_id = p_item_id;

    IF p_tag_ids IS NULL OR array_length(p_tag_ids, 1) IS NULL THEN
        RETURN;
    END IF;

    FOREACH v_tag_id IN ARRAY p_tag_ids
    LOOP
        IF NOT EXISTS (
            SELECT 1
            FROM public.tags
            WHERE id = v_tag_id
              AND tenant_id = p_tenant_id
        ) THEN
            RAISE EXCEPTION 'tag not found for tenant';
        END IF;

        INSERT INTO public.item_tag_assignments (tenant_id, item_id, tag_id)
        VALUES (p_tenant_id, p_item_id, v_tag_id)
        ON CONFLICT (item_id, tag_id) DO NOTHING;
    END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION private.sync_product_storefront_items(
    p_tenant_id UUID,
    p_item_id UUID,
    p_storefront_items JSONB DEFAULT '[]'::jsonb
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_entry JSONB;
    v_storefront_id UUID;
    v_is_visible BOOLEAN;
    v_custom_name TEXT;
    v_price_book_id UUID;
BEGIN
    IF p_storefront_items IS NULL THEN
        p_storefront_items := '[]'::jsonb;
    END IF;

    IF jsonb_typeof(p_storefront_items) IS DISTINCT FROM 'array' THEN
        RAISE EXCEPTION 'storefront items must be a JSON array';
    END IF;

    DELETE FROM public.storefront_items
    WHERE tenant_id = p_tenant_id
      AND item_id = p_item_id;

    FOR v_entry IN SELECT value FROM jsonb_array_elements(p_storefront_items)
    LOOP
        v_storefront_id := NULLIF(v_entry ->> 'storefront_id', '')::UUID;
        IF v_storefront_id IS NULL THEN
            CONTINUE;
        END IF;

        IF NOT EXISTS (
            SELECT 1
            FROM public.storefront_channels
            WHERE id = v_storefront_id
              AND tenant_id = p_tenant_id
        ) THEN
            RAISE EXCEPTION 'storefront channel not found for tenant';
        END IF;

        v_is_visible := COALESCE((v_entry ->> 'is_visible')::BOOLEAN, TRUE);
        v_custom_name := NULLIF(btrim(v_entry ->> 'store_custom_name'), '');
        v_price_book_id := NULLIF(v_entry ->> 'store_price_book_id', '')::UUID;

        IF v_price_book_id IS NOT NULL AND NOT EXISTS (
            SELECT 1
            FROM public.price_books
            WHERE id = v_price_book_id
              AND tenant_id = p_tenant_id
        ) THEN
            RAISE EXCEPTION 'price book not found for tenant';
        END IF;

        INSERT INTO public.storefront_items (
            tenant_id,
            storefront_id,
            item_id,
            is_visible,
            store_custom_name,
            store_price_book_id
        )
        VALUES (
            p_tenant_id,
            v_storefront_id,
            p_item_id,
            v_is_visible,
            v_custom_name,
            v_price_book_id
        );
    END LOOP;
END;
$$;

DROP FUNCTION IF EXISTS public.save_product_master_profile(
    UUID, TEXT, TEXT, TEXT, UUID, TEXT, TEXT, BOOLEAN, BOOLEAN, BOOLEAN, TEXT, BOOLEAN, TEXT, BOOLEAN, TEXT, JSONB,
    NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, BOOLEAN, NUMERIC, TEXT, TEXT, NUMERIC, NUMERIC, UUID
);

DROP FUNCTION IF EXISTS private.save_product_master_profile(
    UUID, TEXT, TEXT, TEXT, UUID, TEXT, TEXT, BOOLEAN, BOOLEAN, BOOLEAN, TEXT, BOOLEAN, TEXT, BOOLEAN, TEXT, JSONB,
    NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, BOOLEAN, NUMERIC, TEXT, TEXT, NUMERIC, NUMERIC, UUID
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
    v_tax_category TEXT;
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
            name,
            description,
            classification,
            base_unit_of_measure,
            hsn_sac_code,
            is_purchasable,
            is_salable,
            has_variants,
            default_tax_category,
            is_returnable,
            custom_fields,
            is_active
        )
        VALUES (
            v_tenant_id,
            p_category_id,
            v_trimmed_name,
            NULLIF(btrim(p_description), ''),
            v_classification,
            btrim(p_base_uom),
            NULLIF(btrim(p_hsn_sac_code), ''),
            COALESCE(p_is_purchasable, TRUE),
            COALESCE(p_is_salable, TRUE),
            COALESCE(p_has_variants, FALSE),
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
            is_active
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
            COALESCE(p_variant_is_active, TRUE)
        )
        RETURNING id INTO v_variant_id;
    ELSE
        v_item_id := p_item_id;

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
            description = NULLIF(btrim(p_description), ''),
            classification = v_classification,
            base_unit_of_measure = btrim(p_base_uom),
            hsn_sac_code = NULLIF(btrim(p_hsn_sac_code), ''),
            is_purchasable = COALESCE(p_is_purchasable, TRUE),
            is_salable = COALESCE(p_is_salable, TRUE),
            has_variants = COALESCE(p_has_variants, FALSE),
            default_tax_category = v_tax_category,
            is_returnable = COALESCE(p_is_returnable, TRUE),
            custom_fields = p_custom_fields,
            is_active = COALESCE(p_is_active, TRUE)
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
    END IF;

    PERFORM private.sync_product_master_commerce(
        v_tenant_id,
        v_item_id,
        btrim(p_base_uom),
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
        btrim(p_base_uom),
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
        p_item_id,
        p_name,
        p_classification,
        p_base_uom,
        p_category_id,
        p_sku,
        p_description,
        p_is_purchasable,
        p_is_salable,
        p_is_active,
        p_hsn_sac_code,
        p_has_variants,
        p_default_tax_category,
        p_is_returnable,
        p_barcode,
        p_variant_attributes,
        p_dead_weight_kg,
        p_weight,
        p_volume,
        p_length_cm,
        p_width_cm,
        p_height_cm,
        p_variant_is_active,
        p_selling_price,
        p_selling_uom,
        p_purchase_uom,
        p_purchase_uom_conversion,
        p_purchase_price,
        p_supplier_id,
        p_custom_fields,
        p_alternate_uoms,
        p_tag_ids,
        p_storefront_items
    );
$$;

REVOKE ALL ON FUNCTION public.ensure_tag(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_tag(TEXT, TEXT) TO authenticated;

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

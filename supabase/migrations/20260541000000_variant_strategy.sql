-- ====================================================================
-- AIB SMART ERP - VARIANT STRATEGY (SINGLE_SKU vs MULTI_SKU)
-- Migration: 20260541000000_variant_strategy.sql
-- --------------------------------------------------------------------
--   * items.variant_strategy + item_categories.default_variant_strategy
--   * item_variants.is_sellable (style anchor = false for MULTI_SKU)
--   * save_product_master_profile honours strategy on create/update
--   * default_line_variant_to_master prefers sellable variants
--   * inventory guard blocks non-sellable variants
--   * list views expose strategy + filter non-sellable style anchors
-- ====================================================================

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'product_variant_strategy') THEN
        CREATE TYPE public.product_variant_strategy AS ENUM ('SINGLE_SKU', 'MULTI_SKU');
    END IF;
END;
$$;

ALTER TABLE public.items
    ADD COLUMN IF NOT EXISTS variant_strategy public.product_variant_strategy NOT NULL DEFAULT 'SINGLE_SKU';

ALTER TABLE public.item_categories
    ADD COLUMN IF NOT EXISTS default_variant_strategy public.product_variant_strategy NOT NULL DEFAULT 'SINGLE_SKU';

ALTER TABLE public.item_variants
    ADD COLUMN IF NOT EXISTS is_sellable BOOLEAN NOT NULL DEFAULT TRUE;

UPDATE public.item_variants SET is_sellable = TRUE WHERE is_sellable IS NULL;

-- --------------------------------------------------------------------
-- default_line_variant_to_master: prefer sellable SKUs
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.default_line_variant_to_master()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
BEGIN
    IF NEW.variant_id IS NULL THEN
        SELECT id
        INTO NEW.variant_id
        FROM public.item_variants
        WHERE item_id = NEW.item_id
          AND tenant_id = NEW.tenant_id
          AND is_sellable = TRUE
        ORDER BY is_master DESC, created_at ASC
        LIMIT 1;

        IF NEW.variant_id IS NULL THEN
            SELECT id
            INTO NEW.variant_id
            FROM public.item_variants
            WHERE item_id = NEW.item_id
              AND tenant_id = NEW.tenant_id
              AND is_master = TRUE
            LIMIT 1;
        END IF;

        IF NEW.variant_id IS NULL THEN
            RAISE EXCEPTION 'item % has no sellable variant', NEW.item_id;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

-- --------------------------------------------------------------------
-- Block inventory on non-sellable (style anchor) variants
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.inventory_ledger_variant_required_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_is_sellable BOOLEAN;
BEGIN
    IF NEW.variant_id IS NULL THEN
        RAISE EXCEPTION
            'inventory_ledger requires variant_id (item %). Every item has a master variant.',
            NEW.item_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.item_variants v
        WHERE v.id = NEW.variant_id
          AND v.item_id = NEW.item_id
          AND v.tenant_id = NEW.tenant_id
    ) THEN
        RAISE EXCEPTION
            'variant % does not belong to item % for this tenant',
            NEW.variant_id, NEW.item_id;
    END IF;

    SELECT is_sellable
    INTO v_is_sellable
    FROM public.item_variants
    WHERE id = NEW.variant_id
      AND tenant_id = NEW.tenant_id;

    IF NOT COALESCE(v_is_sellable, FALSE) THEN
        RAISE EXCEPTION
            'variant % is a non-sellable style anchor and cannot receive inventory',
            NEW.variant_id;
    END IF;

    RETURN NEW;
END;
$$;

-- --------------------------------------------------------------------
-- save_product_master_profile (+ p_variant_strategy)
-- --------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.save_product_master_profile(
    UUID, TEXT, TEXT, TEXT, UUID, TEXT, TEXT, BOOLEAN, BOOLEAN, BOOLEAN, TEXT, BOOLEAN, TEXT, BOOLEAN, TEXT, JSONB,
    NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, BOOLEAN, NUMERIC, TEXT, TEXT, NUMERIC, NUMERIC, UUID,
    JSONB, JSONB, UUID[], JSONB, TEXT
);

DROP FUNCTION IF EXISTS public.save_product_master_profile(
    UUID, TEXT, TEXT, TEXT, UUID, TEXT, TEXT, BOOLEAN, BOOLEAN, BOOLEAN, TEXT, BOOLEAN, TEXT, BOOLEAN, TEXT, JSONB,
    NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, BOOLEAN, NUMERIC, TEXT, TEXT, NUMERIC, NUMERIC, UUID,
    JSONB, JSONB, UUID[], JSONB
);

DROP FUNCTION IF EXISTS private.save_product_master_profile(
    UUID, TEXT, TEXT, TEXT, UUID, TEXT, TEXT, BOOLEAN, BOOLEAN, BOOLEAN, TEXT, BOOLEAN, TEXT, BOOLEAN, TEXT, JSONB,
    NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, BOOLEAN, NUMERIC, TEXT, TEXT, NUMERIC, NUMERIC, UUID,
    JSONB, JSONB, UUID[], JSONB, TEXT
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
    p_storefront_items JSONB DEFAULT '[]'::jsonb,
    p_variant_strategy TEXT DEFAULT NULL
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
    v_strategy public.product_variant_strategy;
    v_master_is_sellable BOOLEAN;
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
        RAISE EXCEPTION 'product code is required';
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
            SELECT 1 FROM public.item_categories
            WHERE id = p_category_id AND tenant_id = v_tenant_id
        ) THEN
            RAISE EXCEPTION 'category not found for tenant';
        END IF;
    END IF;

    v_strategy := COALESCE(
        NULLIF(upper(btrim(p_variant_strategy)), '')::public.product_variant_strategy,
        NULL
    );

    IF v_strategy IS NULL AND p_category_id IS NOT NULL THEN
        SELECT default_variant_strategy INTO v_strategy
        FROM public.item_categories
        WHERE id = p_category_id AND tenant_id = v_tenant_id;
    END IF;

    v_strategy := COALESCE(v_strategy, 'SINGLE_SKU'::public.product_variant_strategy);
    v_master_is_sellable := (v_strategy = 'SINGLE_SKU'::public.product_variant_strategy);

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
            SELECT 1 FROM public.item_variants
            WHERE tenant_id = v_tenant_id AND sku = v_trimmed_sku
        ) THEN
            RAISE EXCEPTION 'sku already exists for this tenant';
        END IF;

        INSERT INTO public.items (
            tenant_id, category_id, code, name, description, classification,
            base_unit_of_measure, hsn_sac_code, is_purchasable, is_salable,
            default_tax_category, is_returnable, custom_fields, is_active, variant_strategy
        )
        VALUES (
            v_tenant_id, p_category_id, v_trimmed_sku, v_trimmed_name,
            NULLIF(btrim(p_description), ''), v_classification, v_trimmed_base_uom,
            NULLIF(btrim(p_hsn_sac_code), ''), COALESCE(p_is_purchasable, TRUE),
            COALESCE(p_is_salable, TRUE), v_tax_category, COALESCE(p_is_returnable, TRUE),
            p_custom_fields, COALESCE(p_is_active, TRUE), v_strategy
        )
        RETURNING id INTO v_item_id;

        INSERT INTO public.item_variants (
            item_id, tenant_id, sku, barcode, variant_attributes,
            dead_weight_kg, weight, volume, length_cm, width_cm, height_cm,
            is_active, is_master, is_sellable
        )
        VALUES (
            v_item_id, v_tenant_id, v_trimmed_sku,
            CASE WHEN v_master_is_sellable THEN NULLIF(btrim(p_barcode), '') ELSE NULL END,
            CASE WHEN v_master_is_sellable THEN p_variant_attributes ELSE '{}'::jsonb END,
            COALESCE(p_dead_weight_kg, 0), p_weight, p_volume,
            COALESCE(p_length_cm, 0), COALESCE(p_width_cm, 0), COALESCE(p_height_cm, 0),
            COALESCE(p_variant_is_active, TRUE), TRUE, v_master_is_sellable
        )
        RETURNING id INTO v_variant_id;
    ELSE
        v_item_id := p_item_id;

        SELECT category_id, base_unit_of_measure, classification, variant_strategy
        INTO v_old_category_id, v_old_base_uom, v_old_classification, v_strategy
        FROM public.items
        WHERE id = p_item_id AND tenant_id = v_tenant_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'product not found for tenant';
        END IF;

        IF p_variant_strategy IS NOT NULL AND NULLIF(upper(btrim(p_variant_strategy)), '') IS NOT NULL THEN
            v_strategy := upper(btrim(p_variant_strategy))::public.product_variant_strategy;
            v_master_is_sellable := (v_strategy = 'SINGLE_SKU'::public.product_variant_strategy);
        ELSE
            v_master_is_sellable := (v_strategy = 'SINGLE_SKU'::public.product_variant_strategy);
        END IF;

        IF (v_old_base_uom IS DISTINCT FROM v_trimmed_base_uom
            OR v_old_classification IS DISTINCT FROM v_classification) THEN
            SELECT EXISTS (
                SELECT 1 FROM public.inventory_ledger
                WHERE item_id = p_item_id AND tenant_id = v_tenant_id
            ) INTO v_has_ledger;

            IF v_has_ledger THEN
                RAISE EXCEPTION
                    'base unit of measure and classification cannot change after inventory movements exist for this item';
            END IF;
        END IF;

        SELECT id INTO v_variant_id
        FROM public.item_variants
        WHERE item_id = p_item_id AND tenant_id = v_tenant_id AND is_master = TRUE
        LIMIT 1;

        IF v_variant_id IS NULL THEN
            RAISE EXCEPTION 'master variant not found for product';
        END IF;

        IF EXISTS (
            SELECT 1 FROM public.item_variants
            WHERE tenant_id = v_tenant_id AND sku = v_trimmed_sku
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
            code = COALESCE(code, v_trimmed_sku),
            variant_strategy = v_strategy
        WHERE id = p_item_id AND tenant_id = v_tenant_id;

        UPDATE public.item_variants
        SET
            sku = v_trimmed_sku,
            barcode = CASE WHEN v_master_is_sellable THEN NULLIF(btrim(p_barcode), '') ELSE NULL END,
            variant_attributes = CASE WHEN v_master_is_sellable THEN p_variant_attributes ELSE '{}'::jsonb END,
            dead_weight_kg = COALESCE(p_dead_weight_kg, 0),
            weight = p_weight,
            volume = p_volume,
            length_cm = COALESCE(p_length_cm, 0),
            width_cm = COALESCE(p_width_cm, 0),
            height_cm = COALESCE(p_height_cm, 0),
            is_active = COALESCE(p_variant_is_active, TRUE),
            is_sellable = v_master_is_sellable
        WHERE id = v_variant_id AND tenant_id = v_tenant_id;

        IF v_old_category_id IS DISTINCT FROM p_category_id THEN
            PERFORM private.reconcile_variant_attributes(v_tenant_id, v_item_id, p_category_id);
        END IF;
    END IF;

    IF v_master_is_sellable THEN
        PERFORM private.sync_product_master_commerce(
            v_tenant_id, v_item_id, v_trimmed_base_uom,
            p_selling_price, p_selling_uom, p_purchase_uom,
            p_purchase_uom_conversion, p_purchase_price, p_supplier_id
        );
    END IF;

    PERFORM private.sync_product_alternate_uoms(v_tenant_id, v_item_id, v_trimmed_base_uom, p_alternate_uoms);
    PERFORM private.sync_product_tag_assignments(v_tenant_id, v_item_id, p_tag_ids);
    PERFORM private.sync_product_storefront_items(v_tenant_id, v_item_id, p_storefront_items);

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
    p_storefront_items JSONB DEFAULT '[]'::jsonb,
    p_variant_strategy TEXT DEFAULT NULL
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
        p_alternate_uoms, p_tag_ids, p_storefront_items, p_variant_strategy
    );
$$;

REVOKE ALL ON FUNCTION public.save_product_master_profile(
    UUID, TEXT, TEXT, TEXT, UUID, TEXT, TEXT, BOOLEAN, BOOLEAN, BOOLEAN, TEXT, BOOLEAN, TEXT, BOOLEAN, TEXT, JSONB,
    NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, BOOLEAN, NUMERIC, TEXT, TEXT, NUMERIC, NUMERIC, UUID,
    JSONB, JSONB, UUID[], JSONB, TEXT
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.save_product_master_profile(
    UUID, TEXT, TEXT, TEXT, UUID, TEXT, TEXT, BOOLEAN, BOOLEAN, BOOLEAN, TEXT, BOOLEAN, TEXT, BOOLEAN, TEXT, JSONB,
    NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, BOOLEAN, NUMERIC, TEXT, TEXT, NUMERIC, NUMERIC, UUID,
    JSONB, JSONB, UUID[], JSONB, TEXT
) TO authenticated;

-- save_item_variant / bulk: new variants are always sellable
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
        SELECT 1 FROM public.items WHERE id = p_item_id AND tenant_id = v_tenant_id
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
            SELECT 1 FROM public.item_variants
            WHERE tenant_id = v_tenant_id AND sku = v_trimmed_sku
        ) THEN
            RAISE EXCEPTION 'sku already exists for this tenant';
        END IF;

        INSERT INTO public.item_variants (
            item_id, tenant_id, sku, barcode, variant_attributes,
            dead_weight_kg, weight, volume, length_cm, width_cm, height_cm,
            is_active, is_master, is_sellable, price
        )
        VALUES (
            p_item_id, v_tenant_id, v_trimmed_sku, NULLIF(btrim(p_barcode), ''), p_variant_attributes,
            COALESCE(p_dead_weight_kg, 0), p_weight, p_volume,
            COALESCE(p_length_cm, 0), COALESCE(p_width_cm, 0), COALESCE(p_height_cm, 0),
            COALESCE(p_is_active, TRUE), FALSE, TRUE, p_price
        )
        RETURNING id INTO v_result_id;

        RETURN v_result_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.item_variants
        WHERE id = p_variant_id AND item_id = p_item_id AND tenant_id = v_tenant_id
    ) THEN
        RAISE EXCEPTION 'variant not found for product';
    END IF;

    IF EXISTS (
        SELECT 1 FROM public.item_variants
        WHERE tenant_id = v_tenant_id AND sku = v_trimmed_sku
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
        price = p_price
    WHERE id = p_variant_id AND tenant_id = v_tenant_id;

    RETURN p_variant_id;
END;
$$;

-- Patch bulk insert for is_sellable
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
    v_price NUMERIC;
    v_seen_skus TEXT[] := ARRAY[]::TEXT[];
    v_inserted INTEGER := 0;
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
            CONTINUE;
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
            is_active, is_master, is_sellable, price
        )
        VALUES (
            p_item_id, v_tenant_id, v_sku,
            NULLIF(btrim(v_entry ->> 'barcode'), ''),
            v_attrs,
            COALESCE((v_entry ->> 'is_active')::BOOLEAN, TRUE),
            FALSE, TRUE, v_price
        );

        v_inserted := v_inserted + 1;
    END LOOP;

    RETURN v_inserted;
END;
$$;

-- category RPC: default_variant_strategy
DROP FUNCTION IF EXISTS public.save_system_category(TEXT, UUID, BOOLEAN, JSONB, UUID, TEXT);
DROP FUNCTION IF EXISTS private.save_system_category(TEXT, UUID, BOOLEAN, JSONB, UUID, TEXT);
DROP FUNCTION IF EXISTS public.save_system_category(TEXT, UUID, BOOLEAN, JSONB, UUID);
DROP FUNCTION IF EXISTS private.save_system_category(TEXT, UUID, BOOLEAN, JSONB, UUID);

CREATE OR REPLACE FUNCTION private.save_system_category(
    p_name TEXT,
    p_parent_id UUID DEFAULT NULL,
    p_is_active BOOLEAN DEFAULT TRUE,
    p_attribute_templates JSONB DEFAULT '[]'::jsonb,
    p_category_id UUID DEFAULT NULL,
    p_default_variant_strategy TEXT DEFAULT 'SINGLE_SKU'
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
            default_variant_strategy = v_strategy
        WHERE id = p_category_id AND tenant_id = v_tenant_id;

        RETURN p_category_id;
    END IF;

    INSERT INTO public.item_categories (
        tenant_id, name, parent_id, is_active, attribute_templates, default_variant_strategy
    )
    VALUES (
        v_tenant_id, v_trimmed_name, p_parent_id,
        COALESCE(p_is_active, TRUE), p_attribute_templates, v_strategy
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
    p_default_variant_strategy TEXT DEFAULT 'SINGLE_SKU'
)
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, private
AS $$
    SELECT private.save_system_category(
        p_name, p_parent_id, p_is_active, p_attribute_templates, p_category_id, p_default_variant_strategy
    );
$$;

REVOKE ALL ON FUNCTION public.save_system_category(TEXT, UUID, BOOLEAN, JSONB, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_system_category(TEXT, UUID, BOOLEAN, JSONB, UUID, TEXT) TO authenticated;

-- --------------------------------------------------------------------
-- List views: expose strategy + style code; hide non-sellable anchors
-- --------------------------------------------------------------------
CREATE OR REPLACE VIEW public.product_list_workspace_rows
WITH (security_invoker = true) AS
SELECT
    i.id,
    i.tenant_id,
    i.name,
    i.description,
    i.classification,
    i.base_unit_of_measure,
    i.category_id,
    ic.name AS category_name,
    i.hsn_sac_code,
    i.has_variants,
    i.default_tax_category,
    i.is_active,
    i.is_purchasable,
    i.is_salable,
    i.is_returnable,
    i.created_at,
    i.updated_at,
    dv.id AS default_variant_id,
    COALESCE(i.code, dv.sku) AS default_sku,
    dv.barcode,
    COALESCE(
        dv.price,
        (
            SELECT pbe.price
            FROM public.price_book_entries pbe
            INNER JOIN public.price_books pb
                ON pb.id = pbe.price_book_id
                AND pb.tenant_id = pbe.tenant_id
            WHERE pbe.tenant_id = i.tenant_id
              AND pbe.item_id = i.id
              AND (pbe.variant_id = dv.id OR pbe.variant_id IS NULL)
              AND pb.is_active = TRUE
              AND pbe.min_quantity = 1
            ORDER BY (pbe.variant_id = dv.id) DESC NULLS LAST, pb.created_at ASC
            LIMIT 1
        )
    ) AS selling_price,
    (
        SELECT si.supplier_price
        FROM public.supplier_items si
        WHERE si.tenant_id = i.tenant_id
          AND si.item_id = i.id
        ORDER BY si.is_preferred DESC, si.supplier_id ASC
        LIMIT 1
    ) AS purchase_price,
    (
        SELECT e.name
        FROM public.entities e
        INNER JOIN public.supplier_items si
            ON si.supplier_id = e.id
            AND si.tenant_id = e.tenant_id
        WHERE si.tenant_id = i.tenant_id
          AND si.item_id = i.id
        ORDER BY si.is_preferred DESC, si.supplier_id ASC
        LIMIT 1
    ) AS supplier_name,
    COALESCE(stock.total_quantity_on_hand, 0) AS stock_on_hand,
    primary_media.storage_url AS primary_image_storage_path,
    i.variant_strategy::TEXT AS variant_strategy,
    i.code AS style_code,
    dv.is_master AS variant_is_master,
    dv.is_sellable AS variant_is_sellable
FROM public.items i
LEFT JOIN public.item_categories ic
    ON ic.tenant_id = i.tenant_id
    AND ic.id = i.category_id
LEFT JOIN LATERAL (
    SELECT v.id, v.sku, v.barcode, v.price, v.is_master, v.is_sellable
    FROM public.item_variants v
    WHERE v.tenant_id = i.tenant_id
      AND v.item_id = i.id
    ORDER BY v.is_sellable DESC, v.is_master DESC, v.created_at ASC
    LIMIT 1
) dv ON TRUE
LEFT JOIN LATERAL (
    SELECT SUM(iv.total_quantity_on_hand) AS total_quantity_on_hand
    FROM public.item_valuations iv
    INNER JOIN public.item_variants vv
        ON vv.id = iv.variant_id
        AND vv.tenant_id = iv.tenant_id
    WHERE iv.tenant_id = i.tenant_id
      AND iv.item_id = i.id
      AND vv.is_sellable = TRUE
) stock ON TRUE
LEFT JOIN LATERAL (
    SELECT im.storage_url
    FROM public.item_media im
    WHERE im.tenant_id = i.tenant_id
      AND im.item_id = i.id
      AND (
          im.variant_id IS NULL
          OR im.variant_id = dv.id
      )
    ORDER BY
        im.is_primary DESC,
        CASE WHEN im.variant_id IS NULL THEN 0 ELSE 1 END,
        im.sort_order ASC,
        im.created_at ASC
    LIMIT 1
) primary_media ON TRUE;

GRANT SELECT ON public.product_list_workspace_rows TO authenticated;

CREATE OR REPLACE VIEW public.product_list_workspace_variant_rows
WITH (security_invoker = true) AS
SELECT
    i.id,
    i.tenant_id,
    i.name,
    i.description,
    i.classification,
    i.base_unit_of_measure,
    i.category_id,
    ic.name AS category_name,
    i.hsn_sac_code,
    i.has_variants,
    i.default_tax_category,
    i.is_active,
    i.is_purchasable,
    i.is_salable,
    i.is_returnable,
    i.created_at,
    i.updated_at,
    v.id AS variant_id,
    v.id AS default_variant_id,
    v.sku AS default_sku,
    v.barcode,
    v.variant_attributes,
    v.is_active AS variant_is_active,
    COALESCE(
        v.price,
        (
            SELECT pbe.price
            FROM public.price_book_entries pbe
            INNER JOIN public.price_books pb
                ON pb.id = pbe.price_book_id
                AND pb.tenant_id = pbe.tenant_id
            WHERE pbe.tenant_id = i.tenant_id
              AND pbe.item_id = i.id
              AND (pbe.variant_id = v.id OR pbe.variant_id IS NULL)
              AND pb.is_active = TRUE
              AND pbe.min_quantity = 1
            ORDER BY (pbe.variant_id = v.id) DESC NULLS LAST, pb.created_at ASC
            LIMIT 1
        )
    ) AS selling_price,
    (
        SELECT si.supplier_price
        FROM public.supplier_items si
        WHERE si.tenant_id = i.tenant_id
          AND si.item_id = i.id
        ORDER BY si.is_preferred DESC, si.supplier_id ASC
        LIMIT 1
    ) AS purchase_price,
    (
        SELECT e.name
        FROM public.entities e
        INNER JOIN public.supplier_items si
            ON si.supplier_id = e.id
            AND si.tenant_id = e.tenant_id
        WHERE si.tenant_id = i.tenant_id
          AND si.item_id = i.id
        ORDER BY si.is_preferred DESC, si.supplier_id ASC
        LIMIT 1
    ) AS supplier_name,
    COALESCE(variant_stock.total_quantity_on_hand, 0) AS stock_on_hand,
    variant_media.storage_url AS primary_image_storage_path,
    i.variant_strategy::TEXT AS variant_strategy,
    i.code AS style_code,
    v.is_master AS variant_is_master,
    v.is_sellable AS variant_is_sellable
FROM public.items i
LEFT JOIN public.item_categories ic
    ON ic.tenant_id = i.tenant_id
    AND ic.id = i.category_id
INNER JOIN public.item_variants v
    ON v.tenant_id = i.tenant_id
    AND v.item_id = i.id
LEFT JOIN LATERAL (
    SELECT SUM(iv.total_quantity_on_hand) AS total_quantity_on_hand
    FROM public.item_valuations iv
    WHERE iv.tenant_id = i.tenant_id
      AND iv.item_id = i.id
      AND iv.variant_id = v.id
) variant_stock ON TRUE
LEFT JOIN LATERAL (
    SELECT im.storage_url
    FROM public.item_media im
    WHERE im.tenant_id = i.tenant_id
      AND im.item_id = i.id
      AND (
          im.variant_id = v.id
          OR im.variant_id IS NULL
      )
    ORDER BY
        (im.variant_id = v.id) DESC,
        im.is_primary DESC,
        CASE WHEN im.variant_id IS NULL THEN 0 ELSE 1 END,
        im.sort_order ASC,
        im.created_at ASC
    LIMIT 1
) variant_media ON TRUE
WHERE i.has_variants = TRUE
  AND v.is_sellable = TRUE

UNION ALL

SELECT
    i.id,
    i.tenant_id,
    i.name,
    i.description,
    i.classification,
    i.base_unit_of_measure,
    i.category_id,
    ic.name AS category_name,
    i.hsn_sac_code,
    i.has_variants,
    i.default_tax_category,
    i.is_active,
    i.is_purchasable,
    i.is_salable,
    i.is_returnable,
    i.created_at,
    i.updated_at,
    dv.id AS variant_id,
    dv.id AS default_variant_id,
    dv.sku AS default_sku,
    dv.barcode,
    COALESCE(dv.variant_attributes, '{}'::jsonb) AS variant_attributes,
    dv.is_active AS variant_is_active,
    COALESCE(
        dv.price,
        (
            SELECT pbe.price
            FROM public.price_book_entries pbe
            INNER JOIN public.price_books pb
                ON pb.id = pbe.price_book_id
                AND pb.tenant_id = pbe.tenant_id
            WHERE pbe.tenant_id = i.tenant_id
              AND pbe.item_id = i.id
              AND (pbe.variant_id = dv.id OR pbe.variant_id IS NULL)
              AND pb.is_active = TRUE
              AND pbe.min_quantity = 1
            ORDER BY (pbe.variant_id = dv.id) DESC NULLS LAST, pb.created_at ASC
            LIMIT 1
        )
    ) AS selling_price,
    (
        SELECT si.supplier_price
        FROM public.supplier_items si
        WHERE si.tenant_id = i.tenant_id
          AND si.item_id = i.id
        ORDER BY si.is_preferred DESC, si.supplier_id ASC
        LIMIT 1
    ) AS purchase_price,
    (
        SELECT e.name
        FROM public.entities e
        INNER JOIN public.supplier_items si
            ON si.supplier_id = e.id
            AND si.tenant_id = e.tenant_id
        WHERE si.tenant_id = i.tenant_id
          AND si.item_id = i.id
        ORDER BY si.is_preferred DESC, si.supplier_id ASC
        LIMIT 1
    ) AS supplier_name,
    COALESCE(stock.total_quantity_on_hand, 0) AS stock_on_hand,
    primary_media.storage_url AS primary_image_storage_path,
    i.variant_strategy::TEXT AS variant_strategy,
    i.code AS style_code,
    dv.is_master AS variant_is_master,
    dv.is_sellable AS variant_is_sellable
FROM public.items i
LEFT JOIN public.item_categories ic
    ON ic.tenant_id = i.tenant_id
    AND ic.id = i.category_id
LEFT JOIN LATERAL (
    SELECT v.id, v.sku, v.barcode, v.price, v.variant_attributes, v.is_active, v.is_master, v.is_sellable
    FROM public.item_variants v
    WHERE v.tenant_id = i.tenant_id
      AND v.item_id = i.id
    ORDER BY v.is_sellable DESC, v.is_master DESC, v.created_at ASC
    LIMIT 1
) dv ON TRUE
LEFT JOIN LATERAL (
    SELECT SUM(iv.total_quantity_on_hand) AS total_quantity_on_hand
    FROM public.item_valuations iv
    WHERE iv.tenant_id = i.tenant_id
      AND iv.item_id = i.id
      AND (dv.id IS NULL OR iv.variant_id = dv.id)
) stock ON TRUE
LEFT JOIN LATERAL (
    SELECT im.storage_url
    FROM public.item_media im
    WHERE im.tenant_id = i.tenant_id
      AND im.item_id = i.id
      AND (
          im.variant_id IS NULL
          OR im.variant_id = dv.id
      )
    ORDER BY
        im.is_primary DESC,
        CASE WHEN im.variant_id IS NULL THEN 0 ELSE 1 END,
        im.sort_order ASC,
        im.created_at ASC
    LIMIT 1
) primary_media ON TRUE
WHERE i.has_variants = FALSE;

GRANT SELECT ON public.product_list_workspace_variant_rows TO authenticated;

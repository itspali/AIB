-- ====================================================================
-- AIB SMART ERP - ITEM RPC GUARDS & DEDUPE (Phase 1)
-- Migration: 20260543000000_item_rpc_guards.sql
-- --------------------------------------------------------------------
--   * private.item_has_transactional_history() shared helper
--   * public.item_editability() -> { has_history, locked_fields[] }
--   * pg_trgm + public.find_similar_items() for dedupe
--   * save_product_master_profile extended:
--       item_type, track_inventory, status, source, needs_review,
--       costing_method, standard_cost, tracking_mode, is_bundle,
--       tax_code_id, price_is_tax_inclusive, + optimistic lock
--       (p_expected_updated_at) and broadened immutability guard.
-- ====================================================================

CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

CREATE INDEX IF NOT EXISTS items_name_trgm_idx
    ON public.items USING gin (name extensions.gin_trgm_ops);

-- --------------------------------------------------------------------
-- 1. Transactional history helper (drives immutability + UI locking)
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.item_has_transactional_history(
    p_tenant_id UUID,
    p_item_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
    SELECT
        EXISTS (SELECT 1 FROM public.inventory_ledger
                WHERE tenant_id = p_tenant_id AND item_id = p_item_id)
        OR EXISTS (SELECT 1 FROM public.sales_order_items
                   WHERE tenant_id = p_tenant_id AND item_id = p_item_id)
        OR EXISTS (SELECT 1 FROM public.sales_invoice_items
                   WHERE tenant_id = p_tenant_id AND item_id = p_item_id)
        OR EXISTS (SELECT 1 FROM public.purchase_order_items
                   WHERE tenant_id = p_tenant_id AND item_id = p_item_id)
        OR EXISTS (SELECT 1 FROM public.purchase_invoice_items
                   WHERE tenant_id = p_tenant_id AND item_id = p_item_id);
$$;

-- --------------------------------------------------------------------
-- 2. item_editability: locked fields for the edit UI + guard reuse
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.item_editability(p_item_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_tenant_id UUID;
    v_has_history BOOLEAN;
    v_locked TEXT[] := ARRAY[]::TEXT[];
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

    v_has_history := private.item_has_transactional_history(v_tenant_id, p_item_id);

    IF v_has_history THEN
        v_locked := ARRAY[
            'base_unit_of_measure',
            'base_uom_id',
            'item_type',
            'classification',
            'track_inventory',
            'variant_strategy',
            'tracking_mode'
        ];
    END IF;

    RETURN jsonb_build_object(
        'has_history', v_has_history,
        'locked_fields', to_jsonb(v_locked)
    );
END;
$$;

REVOKE ALL ON FUNCTION public.item_editability(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.item_editability(UUID) TO authenticated;

-- --------------------------------------------------------------------
-- 3. find_similar_items: dedupe support for quick-create / AI
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.find_similar_items(
    p_name TEXT,
    p_category_id UUID DEFAULT NULL,
    p_limit INTEGER DEFAULT 5
)
RETURNS TABLE (
    id UUID,
    name TEXT,
    code TEXT,
    category_id UUID,
    similarity REAL
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private, extensions
AS $$
    SELECT
        i.id,
        i.name,
        i.code,
        i.category_id,
        extensions.similarity(i.name, p_name) AS similarity
    FROM public.items i
    WHERE i.tenant_id = private.current_tenant_id()
      AND p_name IS NOT NULL
      AND btrim(p_name) <> ''
      AND extensions.similarity(i.name, p_name) > 0.3
      AND (p_category_id IS NULL OR i.category_id = p_category_id)
    ORDER BY extensions.similarity(i.name, p_name) DESC, i.name ASC
    LIMIT GREATEST(COALESCE(p_limit, 5), 1);
$$;

REVOKE ALL ON FUNCTION public.find_similar_items(TEXT, UUID, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.find_similar_items(TEXT, UUID, INTEGER) TO authenticated;

-- --------------------------------------------------------------------
-- 4. save_product_master_profile (+ item model fields, guards, lock)
-- --------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.save_product_master_profile(
    UUID, TEXT, TEXT, TEXT, UUID, TEXT, TEXT, BOOLEAN, BOOLEAN, BOOLEAN, TEXT, BOOLEAN, TEXT, BOOLEAN, TEXT, JSONB,
    NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, BOOLEAN, NUMERIC, TEXT, TEXT, NUMERIC, NUMERIC, UUID,
    JSONB, JSONB, UUID[], JSONB, TEXT
);

DROP FUNCTION IF EXISTS private.save_product_master_profile(
    UUID, TEXT, TEXT, TEXT, UUID, TEXT, TEXT, BOOLEAN, BOOLEAN, BOOLEAN, TEXT, BOOLEAN, TEXT, BOOLEAN, TEXT, JSONB,
    NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, BOOLEAN, NUMERIC, TEXT, TEXT, NUMERIC, NUMERIC, UUID,
    JSONB, JSONB, UUID[], JSONB, TEXT
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
    p_variant_strategy TEXT DEFAULT NULL,
    p_item_type TEXT DEFAULT NULL,
    p_track_inventory BOOLEAN DEFAULT NULL,
    p_status TEXT DEFAULT NULL,
    p_source TEXT DEFAULT NULL,
    p_needs_review BOOLEAN DEFAULT NULL,
    p_costing_method TEXT DEFAULT NULL,
    p_standard_cost NUMERIC DEFAULT NULL,
    p_tracking_mode TEXT DEFAULT NULL,
    p_is_bundle BOOLEAN DEFAULT NULL,
    p_tax_code_id UUID DEFAULT NULL,
    p_price_is_tax_inclusive BOOLEAN DEFAULT NULL,
    p_expected_updated_at TIMESTAMPTZ DEFAULT NULL
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
    v_old_item_type public.item_type;
    v_old_updated_at TIMESTAMPTZ;
    v_has_history BOOLEAN;
    v_strategy public.product_variant_strategy;
    v_master_is_sellable BOOLEAN;
    v_item_type public.item_type;
    v_track_inventory BOOLEAN;
    v_status public.item_status;
    v_source public.item_source;
    v_costing public.item_costing_method;
    v_tracking public.item_tracking_mode;
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

    IF p_tax_code_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.tax_codes
            WHERE id = p_tax_code_id AND tenant_id = v_tenant_id
        ) THEN
            RAISE EXCEPTION 'tax code not found for tenant';
        END IF;
    END IF;

    -- item_type resolution (param -> category default -> PHYSICAL)
    BEGIN
        v_item_type := NULLIF(upper(btrim(p_item_type)), '')::public.item_type;
    EXCEPTION
        WHEN others THEN
            RAISE EXCEPTION 'invalid item type';
    END;

    IF v_item_type IS NULL AND p_category_id IS NOT NULL THEN
        SELECT default_item_type INTO v_item_type
        FROM public.item_categories
        WHERE id = p_category_id AND tenant_id = v_tenant_id;
    END IF;
    v_item_type := COALESCE(v_item_type, 'PHYSICAL'::public.item_type);

    -- variant strategy resolution (param -> category default -> SINGLE_SKU)
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

    -- Non-physical items cannot carry variants or stock.
    IF v_item_type <> 'PHYSICAL'::public.item_type THEN
        v_strategy := 'SINGLE_SKU'::public.product_variant_strategy;
        v_track_inventory := FALSE;
    ELSE
        v_track_inventory := COALESCE(p_track_inventory, TRUE);
    END IF;

    v_master_is_sellable := (v_strategy = 'SINGLE_SKU'::public.product_variant_strategy);

    -- status / source / costing / tracking enums (NULL = keep/default)
    BEGIN
        v_status := NULLIF(upper(btrim(p_status)), '')::public.item_status;
    EXCEPTION WHEN others THEN RAISE EXCEPTION 'invalid item status';
    END;

    BEGIN
        v_source := NULLIF(upper(btrim(p_source)), '')::public.item_source;
    EXCEPTION WHEN others THEN RAISE EXCEPTION 'invalid item source';
    END;

    BEGIN
        v_costing := NULLIF(upper(btrim(p_costing_method)), '')::public.item_costing_method;
    EXCEPTION WHEN others THEN RAISE EXCEPTION 'invalid costing method';
    END;

    BEGIN
        v_tracking := NULLIF(upper(btrim(p_tracking_mode)), '')::public.item_tracking_mode;
    EXCEPTION WHEN others THEN RAISE EXCEPTION 'invalid tracking mode';
    END;
    IF v_item_type <> 'PHYSICAL'::public.item_type THEN
        v_tracking := 'NONE'::public.item_tracking_mode;
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
            SELECT 1 FROM public.item_variants
            WHERE tenant_id = v_tenant_id AND sku = v_trimmed_sku
        ) THEN
            RAISE EXCEPTION 'sku already exists for this tenant';
        END IF;

        INSERT INTO public.items (
            tenant_id, category_id, code, name, description, classification,
            base_unit_of_measure, hsn_sac_code, is_purchasable, is_salable,
            default_tax_category, is_returnable, custom_fields, is_active, variant_strategy,
            item_type, track_inventory, status, source, needs_review,
            costing_method, standard_cost, tracking_mode, is_bundle,
            price_is_tax_inclusive, tax_code_id
        )
        VALUES (
            v_tenant_id, p_category_id, v_trimmed_sku, v_trimmed_name,
            NULLIF(btrim(p_description), ''), v_classification, v_trimmed_base_uom,
            NULLIF(btrim(p_hsn_sac_code), ''), COALESCE(p_is_purchasable, TRUE),
            COALESCE(p_is_salable, TRUE), v_tax_category, COALESCE(p_is_returnable, TRUE),
            p_custom_fields, COALESCE(p_is_active, TRUE), v_strategy,
            v_item_type, v_track_inventory, COALESCE(v_status, 'ACTIVE'::public.item_status),
            COALESCE(v_source, 'MANUAL'::public.item_source), COALESCE(p_needs_review, FALSE),
            COALESCE(v_costing, 'WEIGHTED_AVG'::public.item_costing_method), p_standard_cost,
            COALESCE(v_tracking, 'NONE'::public.item_tracking_mode), COALESCE(p_is_bundle, FALSE),
            COALESCE(p_price_is_tax_inclusive, FALSE), p_tax_code_id
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

        SELECT category_id, base_unit_of_measure, classification, variant_strategy,
               item_type, updated_at
        INTO v_old_category_id, v_old_base_uom, v_old_classification, v_strategy,
             v_old_item_type, v_old_updated_at
        FROM public.items
        WHERE id = p_item_id AND tenant_id = v_tenant_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'product not found for tenant';
        END IF;

        -- Optimistic lock: reject stale overwrites.
        IF p_expected_updated_at IS NOT NULL
           AND v_old_updated_at IS DISTINCT FROM p_expected_updated_at THEN
            RAISE EXCEPTION 'product was modified by another session; reload and retry';
        END IF;

        -- item_type: when not supplied, retain the existing nature (no silent reset).
        IF NULLIF(upper(btrim(p_item_type)), '') IS NULL THEN
            v_item_type := v_old_item_type;
            IF v_item_type <> 'PHYSICAL'::public.item_type THEN
                v_track_inventory := FALSE;
                v_tracking := 'NONE'::public.item_tracking_mode;
            ELSE
                v_track_inventory := COALESCE(p_track_inventory, TRUE);
            END IF;
        END IF;

        -- variant strategy: explicit param overrides; non-physical forces single.
        IF p_variant_strategy IS NOT NULL AND NULLIF(upper(btrim(p_variant_strategy)), '') IS NOT NULL THEN
            v_strategy := upper(btrim(p_variant_strategy))::public.product_variant_strategy;
        END IF;
        IF v_item_type <> 'PHYSICAL'::public.item_type THEN
            v_strategy := 'SINGLE_SKU'::public.product_variant_strategy;
        END IF;
        v_master_is_sellable := (v_strategy = 'SINGLE_SKU'::public.product_variant_strategy);

        -- Immutability: lock structural fields once transactions exist.
        IF (v_old_base_uom IS DISTINCT FROM v_trimmed_base_uom
            OR v_old_classification IS DISTINCT FROM v_classification
            OR v_old_item_type IS DISTINCT FROM v_item_type) THEN
            v_has_history := private.item_has_transactional_history(v_tenant_id, p_item_id);
            IF v_has_history THEN
                RAISE EXCEPTION
                    'base unit of measure, classification, and item type cannot change after transactions exist for this item';
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
            variant_strategy = v_strategy,
            item_type = v_item_type,
            track_inventory = v_track_inventory,
            status = COALESCE(v_status, status),
            needs_review = COALESCE(p_needs_review, needs_review),
            costing_method = COALESCE(v_costing, costing_method),
            standard_cost = COALESCE(p_standard_cost, standard_cost),
            tracking_mode = COALESCE(v_tracking, tracking_mode),
            is_bundle = COALESCE(p_is_bundle, is_bundle),
            price_is_tax_inclusive = COALESCE(p_price_is_tax_inclusive, price_is_tax_inclusive),
            tax_code_id = p_tax_code_id
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
    p_variant_strategy TEXT DEFAULT NULL,
    p_item_type TEXT DEFAULT NULL,
    p_track_inventory BOOLEAN DEFAULT NULL,
    p_status TEXT DEFAULT NULL,
    p_source TEXT DEFAULT NULL,
    p_needs_review BOOLEAN DEFAULT NULL,
    p_costing_method TEXT DEFAULT NULL,
    p_standard_cost NUMERIC DEFAULT NULL,
    p_tracking_mode TEXT DEFAULT NULL,
    p_is_bundle BOOLEAN DEFAULT NULL,
    p_tax_code_id UUID DEFAULT NULL,
    p_price_is_tax_inclusive BOOLEAN DEFAULT NULL,
    p_expected_updated_at TIMESTAMPTZ DEFAULT NULL
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
        p_alternate_uoms, p_tag_ids, p_storefront_items, p_variant_strategy,
        p_item_type, p_track_inventory, p_status, p_source, p_needs_review,
        p_costing_method, p_standard_cost, p_tracking_mode, p_is_bundle,
        p_tax_code_id, p_price_is_tax_inclusive, p_expected_updated_at
    );
$$;

REVOKE ALL ON FUNCTION public.save_product_master_profile(
    UUID, TEXT, TEXT, TEXT, UUID, TEXT, TEXT, BOOLEAN, BOOLEAN, BOOLEAN, TEXT, BOOLEAN, TEXT, BOOLEAN, TEXT, JSONB,
    NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, BOOLEAN, NUMERIC, TEXT, TEXT, NUMERIC, NUMERIC, UUID,
    JSONB, JSONB, UUID[], JSONB, TEXT,
    TEXT, BOOLEAN, TEXT, TEXT, BOOLEAN, TEXT, NUMERIC, TEXT, BOOLEAN, UUID, BOOLEAN, TIMESTAMPTZ
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.save_product_master_profile(
    UUID, TEXT, TEXT, TEXT, UUID, TEXT, TEXT, BOOLEAN, BOOLEAN, BOOLEAN, TEXT, BOOLEAN, TEXT, BOOLEAN, TEXT, JSONB,
    NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, BOOLEAN, NUMERIC, TEXT, TEXT, NUMERIC, NUMERIC, UUID,
    JSONB, JSONB, UUID[], JSONB, TEXT,
    TEXT, BOOLEAN, TEXT, TEXT, BOOLEAN, TEXT, NUMERIC, TEXT, BOOLEAN, UUID, BOOLEAN, TIMESTAMPTZ
) TO authenticated;

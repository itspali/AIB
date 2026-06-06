-- Fix track_inventory resolution on product UPDATE (honour payload; preserve when omitted).
-- Migration: 20260606120000_save_product_track_inventory_update.sql

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
    p_default_tax_category TEXT DEFAULT 'TAXABLE',
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
    v_old_is_bundle BOOLEAN;
    v_has_history BOOLEAN;
    v_strategy public.product_variant_strategy;
    v_master_is_sellable BOOLEAN;
    v_item_type public.item_type;
    v_track_inventory BOOLEAN;
    v_status public.item_status;
    v_source public.item_source;
    v_costing public.item_costing_method;
    v_tracking public.item_tracking_mode;
    v_is_bundle BOOLEAN;
    v_dead_weight_kg NUMERIC;
BEGIN
    v_tenant_id := private.current_tenant_id();
    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'tenant context missing from session';
    END IF;

    v_dead_weight_kg := COALESCE(p_dead_weight_kg, 0);
    IF v_dead_weight_kg = 0 AND p_weight IS NOT NULL AND p_weight > 0 THEN
        v_dead_weight_kg := p_weight;
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

    v_tax_category := private.normalize_item_tax_supply_category(p_default_tax_category);

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

    IF v_item_type <> 'PHYSICAL'::public.item_type THEN
        v_strategy := 'SINGLE_SKU'::public.product_variant_strategy;
        v_track_inventory := FALSE;
    ELSE
        v_track_inventory := COALESCE(p_track_inventory, TRUE);
    END IF;

    v_master_is_sellable := (v_strategy = 'SINGLE_SKU'::public.product_variant_strategy);

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

        v_is_bundle := COALESCE(p_is_bundle, FALSE);
        IF v_is_bundle THEN
            v_track_inventory := FALSE;
        END IF;
        PERFORM private.validate_item_type_classification(v_item_type, v_classification, v_is_bundle);

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
            COALESCE(v_tracking, 'NONE'::public.item_tracking_mode), v_is_bundle,
            COALESCE(p_price_is_tax_inclusive, FALSE), p_tax_code_id
        )
        RETURNING id INTO v_item_id;

        INSERT INTO public.item_variants (
            item_id, tenant_id, sku, barcode, variant_attributes,
            dead_weight_kg, volume, length_cm, width_cm, height_cm,
            is_active, is_master, is_sellable
        )
        VALUES (
            v_item_id, v_tenant_id, v_trimmed_sku,
            CASE WHEN v_master_is_sellable THEN NULLIF(btrim(p_barcode), '') ELSE NULL END,
            CASE WHEN v_master_is_sellable THEN p_variant_attributes ELSE '{}'::jsonb END,
            v_dead_weight_kg, p_volume,
            COALESCE(p_length_cm, 0), COALESCE(p_width_cm, 0), COALESCE(p_height_cm, 0),
            COALESCE(p_variant_is_active, TRUE), TRUE, v_master_is_sellable
        )
        RETURNING id INTO v_variant_id;
    ELSE
        v_item_id := p_item_id;

        SELECT category_id, base_unit_of_measure, classification, variant_strategy,
               item_type, updated_at, is_bundle
        INTO v_old_category_id, v_old_base_uom, v_old_classification, v_strategy,
             v_old_item_type, v_old_updated_at, v_old_is_bundle
        FROM public.items
        WHERE id = p_item_id AND tenant_id = v_tenant_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'product not found for tenant';
        END IF;

        IF p_expected_updated_at IS NOT NULL
           AND v_old_updated_at IS DISTINCT FROM p_expected_updated_at THEN
            RAISE EXCEPTION 'product was modified by another session; reload and retry';
        END IF;

        IF NULLIF(upper(btrim(p_item_type)), '') IS NULL THEN
            v_item_type := v_old_item_type;
        END IF;

        IF v_item_type <> 'PHYSICAL'::public.item_type THEN
            v_track_inventory := FALSE;
            v_tracking := 'NONE'::public.item_tracking_mode;
        ELSIF p_track_inventory IS NOT NULL THEN
            v_track_inventory := p_track_inventory;
        ELSE
            SELECT i.track_inventory
            INTO v_track_inventory
            FROM public.items i
            WHERE i.id = v_item_id AND i.tenant_id = v_tenant_id;
            v_track_inventory := COALESCE(v_track_inventory, TRUE);
        END IF;

        IF p_variant_strategy IS NOT NULL AND NULLIF(upper(btrim(p_variant_strategy)), '') IS NOT NULL THEN
            v_strategy := upper(btrim(p_variant_strategy))::public.product_variant_strategy;
        END IF;
        IF v_item_type <> 'PHYSICAL'::public.item_type THEN
            v_strategy := 'SINGLE_SKU'::public.product_variant_strategy;
        END IF;
        v_master_is_sellable := (v_strategy = 'SINGLE_SKU'::public.product_variant_strategy);

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

        v_is_bundle := COALESCE(p_is_bundle, v_old_is_bundle);
        IF v_is_bundle THEN
            v_track_inventory := FALSE;
        END IF;
        PERFORM private.validate_item_type_classification(v_item_type, v_classification, v_is_bundle);

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
            is_bundle = v_is_bundle,
            price_is_tax_inclusive = COALESCE(p_price_is_tax_inclusive, price_is_tax_inclusive),
            tax_code_id = p_tax_code_id
        WHERE id = p_item_id AND tenant_id = v_tenant_id;

        UPDATE public.item_variants
        SET
            sku = v_trimmed_sku,
            barcode = CASE WHEN v_master_is_sellable THEN NULLIF(btrim(p_barcode), '') ELSE NULL END,
            variant_attributes = CASE WHEN v_master_is_sellable THEN p_variant_attributes ELSE '{}'::jsonb END,
            dead_weight_kg = v_dead_weight_kg,
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

    PERFORM private.sync_product_master_commerce(
            v_tenant_id, v_item_id, v_trimmed_base_uom,
            p_selling_price, p_selling_uom, p_purchase_uom,
            p_purchase_uom_conversion, p_purchase_price, p_supplier_id
        );

    PERFORM private.sync_product_alternate_uoms(v_tenant_id, v_item_id, v_trimmed_base_uom, p_alternate_uoms);
    PERFORM private.sync_product_tag_assignments(v_tenant_id, v_item_id, p_tag_ids);
    PERFORM private.sync_product_storefront_items(v_tenant_id, v_item_id, p_storefront_items);

    RETURN v_item_id;
END;
$$;


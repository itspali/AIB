-- ====================================================================
-- AIB SMART ERP - PRODUCT MASTER COMMERCE & COSTING RPC EXTENSION
-- Migration: 20260530150000_product_master_commerce_rpc.sql
-- ====================================================================

DROP FUNCTION IF EXISTS public.save_product_master_profile(
    UUID, TEXT, TEXT, TEXT, UUID, TEXT, TEXT, BOOLEAN, BOOLEAN, BOOLEAN, TEXT, BOOLEAN, TEXT, BOOLEAN, TEXT, JSONB,
    NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, BOOLEAN
);

DROP FUNCTION IF EXISTS private.save_product_master_profile(
    UUID, TEXT, TEXT, TEXT, UUID, TEXT, TEXT, BOOLEAN, BOOLEAN, BOOLEAN, TEXT, BOOLEAN, TEXT, BOOLEAN, TEXT, JSONB,
    NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, BOOLEAN
);

CREATE OR REPLACE FUNCTION private.ensure_default_price_book(p_tenant_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_price_book_id UUID;
    v_currency VARCHAR(3);
BEGIN
    SELECT id
    INTO v_price_book_id
    FROM public.price_books
    WHERE tenant_id = p_tenant_id
      AND is_active = TRUE
    ORDER BY created_at ASC
    LIMIT 1;

    IF v_price_book_id IS NOT NULL THEN
        RETURN v_price_book_id;
    END IF;

    SELECT COALESCE(base_currency, 'USD')
    INTO v_currency
    FROM public.tenants
    WHERE id = p_tenant_id;

    INSERT INTO public.price_books (tenant_id, name, currency_code, is_active)
    VALUES (p_tenant_id, 'Standard Catalog', v_currency, TRUE)
    RETURNING id INTO v_price_book_id;

    RETURN v_price_book_id;
END;
$$;

CREATE OR REPLACE FUNCTION private.sync_product_master_commerce(
    p_tenant_id UUID,
    p_item_id UUID,
    p_base_uom TEXT,
    p_selling_price NUMERIC DEFAULT NULL,
    p_selling_uom TEXT DEFAULT NULL,
    p_purchase_uom TEXT DEFAULT NULL,
    p_purchase_uom_conversion NUMERIC DEFAULT NULL,
    p_purchase_price NUMERIC DEFAULT NULL,
    p_supplier_id UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_price_book_id UUID;
    v_selling_uom TEXT;
    v_purchase_uom TEXT;
    v_base_uom TEXT;
BEGIN
    v_base_uom := btrim(p_base_uom);
    v_selling_uom := NULLIF(btrim(p_selling_uom), '');
    v_purchase_uom := NULLIF(btrim(p_purchase_uom), '');

    IF p_selling_price IS NOT NULL AND p_selling_price >= 0 THEN
        v_price_book_id := private.ensure_default_price_book(p_tenant_id);

        DELETE FROM public.price_book_entries
        WHERE tenant_id = p_tenant_id
          AND item_id = p_item_id
          AND price_book_id = v_price_book_id
          AND min_quantity = 1.0000;

        INSERT INTO public.price_book_entries (
            tenant_id,
            price_book_id,
            item_id,
            uom_code,
            min_quantity,
            price
        )
        VALUES (
            p_tenant_id,
            v_price_book_id,
            p_item_id,
            COALESCE(v_selling_uom, v_base_uom),
            1.0000,
            p_selling_price
        );
    END IF;

    IF v_purchase_uom IS NOT NULL AND v_purchase_uom <> v_base_uom THEN
        IF p_purchase_uom_conversion IS NULL OR p_purchase_uom_conversion <= 0 THEN
            RAISE EXCEPTION 'purchase unit conversion factor must be positive';
        END IF;

        INSERT INTO public.item_uoms (
            tenant_id,
            item_id,
            uom_code,
            conversion_factor
        )
        VALUES (
            p_tenant_id,
            p_item_id,
            v_purchase_uom,
            p_purchase_uom_conversion
        )
        ON CONFLICT (item_id, uom_code)
        DO UPDATE SET conversion_factor = EXCLUDED.conversion_factor;
    END IF;

    IF p_supplier_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1
            FROM public.entities
            WHERE id = p_supplier_id
              AND tenant_id = p_tenant_id
              AND type IN ('SUPPLIER', 'MUTUAL_PARTNER')
              AND is_active = TRUE
        ) THEN
            RAISE EXCEPTION 'preferred supplier not found for tenant';
        END IF;

        IF p_purchase_price IS NOT NULL AND p_purchase_price >= 0 THEN
            UPDATE public.supplier_items
            SET is_preferred = FALSE
            WHERE item_id = p_item_id
              AND tenant_id = p_tenant_id
              AND supplier_id IS DISTINCT FROM p_supplier_id;

            INSERT INTO public.supplier_items (
                tenant_id,
                item_id,
                supplier_id,
                supplier_price,
                supplier_currency,
                is_preferred
            )
            SELECT
                p_tenant_id,
                p_item_id,
                p_supplier_id,
                p_purchase_price,
                COALESCE(t.base_currency, 'USD'),
                TRUE
            FROM public.tenants t
            WHERE t.id = p_tenant_id
            ON CONFLICT (item_id, supplier_id)
            DO UPDATE SET
                supplier_price = EXCLUDED.supplier_price,
                is_preferred = TRUE;
        END IF;
    END IF;
END;
$$;

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
    p_supplier_id UUID DEFAULT NULL
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
    p_supplier_id UUID DEFAULT NULL
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
        p_supplier_id
    );
$$;

REVOKE ALL ON FUNCTION public.save_product_master_profile(
    UUID, TEXT, TEXT, TEXT, UUID, TEXT, TEXT, BOOLEAN, BOOLEAN, BOOLEAN, TEXT, BOOLEAN, TEXT, BOOLEAN, TEXT, JSONB,
    NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, BOOLEAN, NUMERIC, TEXT, TEXT, NUMERIC, NUMERIC, UUID
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.save_product_master_profile(
    UUID, TEXT, TEXT, TEXT, UUID, TEXT, TEXT, BOOLEAN, BOOLEAN, BOOLEAN, TEXT, BOOLEAN, TEXT, BOOLEAN, TEXT, JSONB,
    NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, BOOLEAN, NUMERIC, TEXT, TEXT, NUMERIC, NUMERIC, UUID
) TO authenticated;

REVOKE ALL ON FUNCTION private.ensure_default_price_book(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.sync_product_master_commerce(UUID, UUID, TEXT, NUMERIC, TEXT, TEXT, NUMERIC, NUMERIC, UUID) FROM PUBLIC;

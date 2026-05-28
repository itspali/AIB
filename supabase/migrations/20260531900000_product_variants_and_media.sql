-- ====================================================================
-- AIB SMART ERP - PRODUCT VARIANT MANAGEMENT & MEDIA ENGINE
-- Migration: 20260531900000_product_variants_and_media.sql
-- ====================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'product-media',
    'product-media',
    FALSE,
    5242880,
    ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS product_media_select_tenant ON storage.objects;
CREATE POLICY product_media_select_tenant
    ON storage.objects
    FOR SELECT
    TO authenticated
    USING (
        bucket_id = 'product-media'
        AND (storage.foldername(name))[1] = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')
    );

DROP POLICY IF EXISTS product_media_insert_tenant ON storage.objects;
CREATE POLICY product_media_insert_tenant
    ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (
        bucket_id = 'product-media'
        AND (storage.foldername(name))[1] = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')
    );

DROP POLICY IF EXISTS product_media_update_tenant ON storage.objects;
CREATE POLICY product_media_update_tenant
    ON storage.objects
    FOR UPDATE
    TO authenticated
    USING (
        bucket_id = 'product-media'
        AND (storage.foldername(name))[1] = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')
    )
    WITH CHECK (
        bucket_id = 'product-media'
        AND (storage.foldername(name))[1] = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')
    );

DROP POLICY IF EXISTS product_media_delete_tenant ON storage.objects;
CREATE POLICY product_media_delete_tenant
    ON storage.objects
    FOR DELETE
    TO authenticated
    USING (
        bucket_id = 'product-media'
        AND (storage.foldername(name))[1] = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')
    );

CREATE OR REPLACE FUNCTION private.clear_item_media_primary(
    p_tenant_id UUID,
    p_item_id UUID,
    p_variant_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
BEGIN
    IF p_variant_id IS NULL THEN
        UPDATE public.item_media
        SET is_primary = FALSE
        WHERE tenant_id = p_tenant_id
          AND item_id = p_item_id
          AND variant_id IS NULL
          AND is_primary = TRUE;
    ELSE
        UPDATE public.item_media
        SET is_primary = FALSE
        WHERE tenant_id = p_tenant_id
          AND variant_id = p_variant_id
          AND is_primary = TRUE;
    END IF;
END;
$$;

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
    p_is_active BOOLEAN DEFAULT TRUE
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
    v_variant_count INTEGER;
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
            p_item_id,
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
            COALESCE(p_is_active, TRUE)
        )
        RETURNING id INTO v_result_id;

        SELECT COUNT(*)
        INTO v_variant_count
        FROM public.item_variants
        WHERE item_id = p_item_id
          AND tenant_id = v_tenant_id;

        IF v_variant_count > 1 THEN
            UPDATE public.items
            SET has_variants = TRUE
            WHERE id = p_item_id
              AND tenant_id = v_tenant_id;
        END IF;

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
        is_active = COALESCE(p_is_active, TRUE)
    WHERE id = p_variant_id
      AND tenant_id = v_tenant_id
    RETURNING id INTO v_result_id;

    RETURN v_result_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_item_variant(p_variant_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_tenant_id UUID;
    v_item_id UUID;
    v_master_variant_id UUID;
    v_variant_count INTEGER;
BEGIN
    v_tenant_id := private.current_tenant_id();
    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'tenant context missing from session';
    END IF;

    SELECT item_id
    INTO v_item_id
    FROM public.item_variants
    WHERE id = p_variant_id
      AND tenant_id = v_tenant_id;

    IF v_item_id IS NULL THEN
        RAISE EXCEPTION 'variant not found for tenant';
    END IF;

    SELECT id
    INTO v_master_variant_id
    FROM public.item_variants
    WHERE item_id = v_item_id
      AND tenant_id = v_tenant_id
    ORDER BY created_at ASC
    LIMIT 1;

    IF p_variant_id = v_master_variant_id THEN
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

    DELETE FROM public.item_variants
    WHERE id = p_variant_id
      AND tenant_id = v_tenant_id;

    SELECT COUNT(*)
    INTO v_variant_count
    FROM public.item_variants
    WHERE item_id = v_item_id
      AND tenant_id = v_tenant_id;

    IF v_variant_count <= 1 THEN
        UPDATE public.items
        SET has_variants = FALSE
        WHERE id = v_item_id
          AND tenant_id = v_tenant_id;
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.save_item_media(
    p_item_id UUID,
    p_storage_url TEXT,
    p_media_id UUID DEFAULT NULL,
    p_variant_id UUID DEFAULT NULL,
    p_sort_order INTEGER DEFAULT 0,
    p_is_primary BOOLEAN DEFAULT FALSE,
    p_show_on_storefront BOOLEAN DEFAULT TRUE,
    p_show_in_digital_catalog BOOLEAN DEFAULT TRUE,
    p_show_on_internal_transactions BOOLEAN DEFAULT FALSE
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_tenant_id UUID;
    v_trimmed_url TEXT;
    v_result_id UUID;
BEGIN
    v_tenant_id := private.current_tenant_id();
    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'tenant context missing from session';
    END IF;

    IF p_item_id IS NULL THEN
        RAISE EXCEPTION 'item id is required';
    END IF;

    v_trimmed_url := btrim(p_storage_url);
    IF v_trimmed_url IS NULL OR v_trimmed_url = '' THEN
        RAISE EXCEPTION 'storage url is required';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.items
        WHERE id = p_item_id
          AND tenant_id = v_tenant_id
    ) THEN
        RAISE EXCEPTION 'product not found for tenant';
    END IF;

    IF p_variant_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1
            FROM public.item_variants
            WHERE id = p_variant_id
              AND item_id = p_item_id
              AND tenant_id = v_tenant_id
        ) THEN
            RAISE EXCEPTION 'variant not found for product';
        END IF;
    END IF;

    IF p_media_id IS NULL THEN
        IF COALESCE(p_is_primary, FALSE) THEN
            PERFORM private.clear_item_media_primary(v_tenant_id, p_item_id, p_variant_id);
        END IF;

        INSERT INTO public.item_media (
            tenant_id,
            item_id,
            variant_id,
            storage_url,
            sort_order,
            is_primary,
            show_on_storefront,
            show_in_digital_catalog,
            show_on_internal_transactions
        )
        VALUES (
            v_tenant_id,
            p_item_id,
            p_variant_id,
            v_trimmed_url,
            COALESCE(p_sort_order, 0),
            COALESCE(p_is_primary, FALSE),
            COALESCE(p_show_on_storefront, TRUE),
            COALESCE(p_show_in_digital_catalog, TRUE),
            COALESCE(p_show_on_internal_transactions, FALSE)
        )
        RETURNING id INTO v_result_id;

        RETURN v_result_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.item_media
        WHERE id = p_media_id
          AND item_id = p_item_id
          AND tenant_id = v_tenant_id
    ) THEN
        RAISE EXCEPTION 'media record not found for product';
    END IF;

    IF COALESCE(p_is_primary, FALSE) THEN
        PERFORM private.clear_item_media_primary(v_tenant_id, p_item_id, p_variant_id);
    END IF;

    UPDATE public.item_media
    SET
        variant_id = p_variant_id,
        storage_url = v_trimmed_url,
        sort_order = COALESCE(p_sort_order, 0),
        is_primary = COALESCE(p_is_primary, FALSE),
        show_on_storefront = COALESCE(p_show_on_storefront, TRUE),
        show_in_digital_catalog = COALESCE(p_show_in_digital_catalog, TRUE),
        show_on_internal_transactions = COALESCE(p_show_on_internal_transactions, FALSE)
    WHERE id = p_media_id
      AND tenant_id = v_tenant_id
    RETURNING id INTO v_result_id;

    RETURN v_result_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_item_media(p_media_id UUID)
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

    DELETE FROM public.item_media
    WHERE id = p_media_id
      AND tenant_id = v_tenant_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'media record not found for tenant';
    END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.save_item_variant(
    UUID, TEXT, UUID, TEXT, JSONB, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, BOOLEAN
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_item_variant(
    UUID, TEXT, UUID, TEXT, JSONB, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, BOOLEAN
) TO authenticated;

REVOKE ALL ON FUNCTION public.delete_item_variant(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_item_variant(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.save_item_media(
    UUID, TEXT, UUID, UUID, INTEGER, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_item_media(
    UUID, TEXT, UUID, UUID, INTEGER, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN
) TO authenticated;

REVOKE ALL ON FUNCTION public.delete_item_media(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_item_media(UUID) TO authenticated;

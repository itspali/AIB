-- ====================================================================
-- AIB SMART ERP - BULK ITEM CATALOG MUTATIONS
-- Migration: 20260535000000_bulk_item_mutations.sql
-- Adds item_variants.price, bulk RPCs, and view COALESCE for selling_price.
-- ====================================================================

-- --------------------------------------------------------------------
-- 1. item_variants.price column
-- --------------------------------------------------------------------
ALTER TABLE public.item_variants
    ADD COLUMN IF NOT EXISTS price NUMERIC(15, 4);

ALTER TABLE public.item_variants
    DROP CONSTRAINT IF EXISTS item_variants_price_non_negative_chk;

ALTER TABLE public.item_variants
    ADD CONSTRAINT item_variants_price_non_negative_chk
        CHECK (price IS NULL OR price >= 0);

-- Backfill from default price book entry (min_quantity = 1)
UPDATE public.item_variants v
SET price = sub.price
FROM (
    SELECT
        pbe.item_id,
        pbe.tenant_id,
        pbe.price,
        ROW_NUMBER() OVER (
            PARTITION BY pbe.tenant_id, pbe.item_id
            ORDER BY pb.created_at ASC
        ) AS rn
    FROM public.price_book_entries pbe
    INNER JOIN public.price_books pb
        ON pb.id = pbe.price_book_id
        AND pb.tenant_id = pbe.tenant_id
    WHERE pb.is_active = TRUE
      AND pbe.min_quantity = 1.0000
) sub
INNER JOIN public.item_variants iv
    ON iv.item_id = sub.item_id
    AND iv.tenant_id = sub.tenant_id
WHERE sub.rn = 1
  AND v.id = (
      SELECT id
      FROM public.item_variants
      WHERE item_id = sub.item_id
        AND tenant_id = sub.tenant_id
      ORDER BY created_at ASC
      LIMIT 1
  )
  AND v.price IS NULL;

-- --------------------------------------------------------------------
-- 2. sync_product_master_commerce — also write item_variants.price
-- --------------------------------------------------------------------
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
    v_master_variant_id UUID;
BEGIN
    v_base_uom := btrim(p_base_uom);
    v_selling_uom := NULLIF(btrim(p_selling_uom), '');
    v_purchase_uom := NULLIF(btrim(p_purchase_uom), '');

    IF p_selling_price IS NOT NULL AND p_selling_price >= 0 THEN
        SELECT id
        INTO v_master_variant_id
        FROM public.item_variants
        WHERE tenant_id = p_tenant_id
          AND item_id = p_item_id
        ORDER BY created_at ASC
        LIMIT 1;

        IF v_master_variant_id IS NOT NULL THEN
            UPDATE public.item_variants
            SET price = p_selling_price
            WHERE id = v_master_variant_id
              AND tenant_id = p_tenant_id;
        END IF;

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

-- --------------------------------------------------------------------
-- 3. product_list_workspace_rows — COALESCE variant price with price book
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
    dv.sku AS default_sku,
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
              AND pb.is_active = TRUE
              AND pbe.min_quantity = 1
            ORDER BY pb.created_at ASC
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
        FROM public.supplier_items si
        INNER JOIN public.entities e
            ON e.id = si.supplier_id
            AND e.tenant_id = si.tenant_id
        WHERE si.tenant_id = i.tenant_id
          AND si.item_id = i.id
        ORDER BY si.is_preferred DESC, si.supplier_id ASC
        LIMIT 1
    ) AS supplier_name,
    COALESCE(stock.total_quantity_on_hand, 0) AS stock_on_hand,
    primary_media.storage_url AS primary_image_storage_path
FROM public.items i
LEFT JOIN public.item_categories ic
    ON ic.tenant_id = i.tenant_id
    AND ic.id = i.category_id
LEFT JOIN LATERAL (
    SELECT v.id, v.sku, v.barcode, v.price
    FROM public.item_variants v
    WHERE v.tenant_id = i.tenant_id
      AND v.item_id = i.id
    ORDER BY v.created_at ASC
    LIMIT 1
) dv ON TRUE
LEFT JOIN LATERAL (
    SELECT SUM(iv.total_quantity_on_hand) AS total_quantity_on_hand
    FROM public.item_valuations iv
    WHERE iv.tenant_id = i.tenant_id
      AND iv.item_id = i.id
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

COMMENT ON VIEW public.product_list_workspace_rows IS
    'Workspace Items list projection with default variant, pricing (variant + price book), stock, and primary media path.';

GRANT SELECT ON public.product_list_workspace_rows TO authenticated;

-- --------------------------------------------------------------------
-- 4. Helper: resolve current selling price for an item
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.resolve_item_selling_price(
    p_tenant_id UUID,
    p_item_id UUID,
    p_variant_id UUID,
    p_base_uom TEXT
)
RETURNS NUMERIC
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_price NUMERIC(15, 4);
    v_price_book_id UUID;
BEGIN
    SELECT price
    INTO v_price
    FROM public.item_variants
    WHERE id = p_variant_id
      AND tenant_id = p_tenant_id;

    IF v_price IS NOT NULL THEN
        RETURN v_price;
    END IF;

    v_price_book_id := private.ensure_default_price_book(p_tenant_id);

    SELECT pbe.price
    INTO v_price
    FROM public.price_book_entries pbe
    WHERE pbe.tenant_id = p_tenant_id
      AND pbe.item_id = p_item_id
      AND pbe.price_book_id = v_price_book_id
      AND pbe.min_quantity = 1.0000
    LIMIT 1;

    RETURN COALESCE(v_price, 0);
END;
$$;

-- --------------------------------------------------------------------
-- 5. bulk_adjust_item_pricing
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.bulk_adjust_item_pricing(
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
    v_variant_id UUID;
    v_base_uom TEXT;
    v_current_price NUMERIC(15, 4);
    v_new_price NUMERIC(15, 4);
    v_price_book_id UUID;
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

    v_price_book_id := private.ensure_default_price_book(v_tenant_id);

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

        SELECT base_unit_of_measure
        INTO v_base_uom
        FROM public.items
        WHERE id = v_item_id
          AND tenant_id = v_tenant_id;

        SELECT id
        INTO v_variant_id
        FROM public.item_variants
        WHERE item_id = v_item_id
          AND tenant_id = v_tenant_id
        ORDER BY created_at ASC
        LIMIT 1;

        IF v_variant_id IS NULL THEN
            CONTINUE;
        END IF;

        v_current_price := private.resolve_item_selling_price(
            v_tenant_id,
            v_item_id,
            v_variant_id,
            v_base_uom
        );

        IF v_mode = 'PERCENTAGE' THEN
            v_new_price := ROUND(v_current_price * (1 + (p_value / 100)), 4);
        ELSE
            v_new_price := ROUND(v_current_price + p_value, 4);
        END IF;

        IF v_new_price < 0 THEN
            v_new_price := 0;
        END IF;

        UPDATE public.item_variants
        SET price = v_new_price
        WHERE id = v_variant_id
          AND tenant_id = v_tenant_id;

        DELETE FROM public.price_book_entries
        WHERE tenant_id = v_tenant_id
          AND item_id = v_item_id
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
            v_tenant_id,
            v_price_book_id,
            v_item_id,
            v_base_uom,
            1.0000,
            v_new_price
        );

        v_affected := v_affected + 1;
    END LOOP;

    RETURN v_affected;
END;
$$;

-- --------------------------------------------------------------------
-- 6. bulk_sync_item_jurisdiction
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.bulk_sync_item_jurisdiction(
    p_item_ids UUID[],
    p_category_id UUID,
    p_tax_rate_id UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_tenant_id UUID;
    v_hsn_code TEXT;
    v_tax_pct NUMERIC(5, 2);
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

    IF p_category_id IS NULL THEN
        RAISE EXCEPTION 'category is required';
    END IF;

    IF p_tax_rate_id IS NULL THEN
        RAISE EXCEPTION 'tax rate registry entry is required';
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

    SELECT
        NULLIF(btrim(legal_compliance_code), ''),
        tax_percentage
    INTO v_hsn_code, v_tax_pct
    FROM public.tax_rate_registry
    WHERE id = p_tax_rate_id
      AND tenant_id = v_tenant_id
      AND (active_to_date IS NULL OR active_to_date > NOW());

    IF NOT FOUND THEN
        RAISE EXCEPTION 'active tax rate registry entry not found for tenant';
    END IF;

    IF v_hsn_code IS NULL
       OR length(v_hsn_code) < 4
       OR upper(v_hsn_code) IN ('HSN', 'SAC') THEN
        RAISE EXCEPTION 'tax rate registry row must have a valid statutory code (HSN/SAC) of at least 4 characters';
    END IF;

    IF v_tax_pct = 0 THEN
        v_tax_category := 'ZERO_RATED';
    ELSIF v_tax_pct > 0 AND v_tax_pct < 18 THEN
        v_tax_category := 'REDUCED';
    ELSE
        v_tax_category := 'STANDARD';
    END IF;

    UPDATE public.items
    SET
        category_id = p_category_id,
        hsn_sac_code = v_hsn_code,
        default_tax_category = v_tax_category
    WHERE tenant_id = v_tenant_id
      AND id = ANY(p_item_ids);

    GET DIAGNOSTICS v_affected = ROW_COUNT;
    RETURN v_affected;
END;
$$;

-- --------------------------------------------------------------------
-- 7. bulk_archive_items
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.bulk_archive_items(p_item_ids UUID[])
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
    SET is_active = FALSE
    WHERE tenant_id = v_tenant_id
      AND id = ANY(p_item_ids);

    GET DIAGNOSTICS v_affected = ROW_COUNT;

    UPDATE public.item_variants
    SET is_active = FALSE
    WHERE tenant_id = v_tenant_id
      AND item_id = ANY(p_item_ids);

    RETURN v_affected;
END;
$$;

REVOKE ALL ON FUNCTION public.bulk_adjust_item_pricing(UUID[], TEXT, NUMERIC) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bulk_adjust_item_pricing(UUID[], TEXT, NUMERIC) TO authenticated;

REVOKE ALL ON FUNCTION public.bulk_sync_item_jurisdiction(UUID[], UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bulk_sync_item_jurisdiction(UUID[], UUID, UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.bulk_archive_items(UUID[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bulk_archive_items(UUID[]) TO authenticated;

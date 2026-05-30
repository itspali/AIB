-- ====================================================================
-- AIB SMART ERP - PHASE 2: UNIFIED PRICE RESOLVER
-- Migration: 20260538100000_phase2_resolver.sql
-- --------------------------------------------------------------------
--   * resolve_price(item, variant, channel, qty, uom, currency)
--     precedence: book(item override -> channel default -> tenant) then
--     variant-specific entry -> item-level entry -> greatest qty break
--     -> variant.price cache -> 0.
--   * resolve_item_selling_price becomes a thin wrapper (callers intact).
--   * sync_product_master_commerce re-keyed for variant-aware uniques.
--   * product_list_workspace_rows prefers the master variant + variant price.
-- ====================================================================

CREATE OR REPLACE FUNCTION private.resolve_price(
    p_tenant_id UUID,
    p_item_id UUID,
    p_variant_id UUID DEFAULT NULL,
    p_channel_id UUID DEFAULT NULL,
    p_quantity NUMERIC DEFAULT 1,
    p_uom TEXT DEFAULT NULL,
    p_currency TEXT DEFAULT NULL
)
RETURNS NUMERIC
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_book_id UUID;
    v_qty NUMERIC := COALESCE(NULLIF(p_quantity, 0), 1);
    v_uom TEXT := NULLIF(btrim(p_uom), '');
    v_price NUMERIC(15, 4);
BEGIN
    -- 1. Resolve the applicable price book.
    IF p_channel_id IS NOT NULL THEN
        SELECT store_price_book_id
        INTO v_book_id
        FROM public.storefront_items
        WHERE tenant_id = p_tenant_id
          AND item_id = p_item_id
          AND storefront_id = p_channel_id;

        IF v_book_id IS NULL THEN
            SELECT default_price_book_id
            INTO v_book_id
            FROM public.storefront_channels
            WHERE tenant_id = p_tenant_id
              AND id = p_channel_id;
        END IF;
    END IF;

    IF v_book_id IS NULL AND p_currency IS NOT NULL THEN
        SELECT id
        INTO v_book_id
        FROM public.price_books
        WHERE tenant_id = p_tenant_id
          AND is_active = TRUE
          AND currency_code = upper(btrim(p_currency))
        ORDER BY created_at ASC
        LIMIT 1;
    END IF;

    IF v_book_id IS NULL THEN
        v_book_id := private.ensure_default_price_book(p_tenant_id);
    END IF;

    -- 2. Best matching entry within the book.
    SELECT pbe.price
    INTO v_price
    FROM public.price_book_entries pbe
    WHERE pbe.tenant_id = p_tenant_id
      AND pbe.price_book_id = v_book_id
      AND pbe.item_id = p_item_id
      AND (pbe.variant_id = p_variant_id OR pbe.variant_id IS NULL)
      AND (v_uom IS NULL OR pbe.uom_code = v_uom OR pbe.uom_code IS NULL)
      AND pbe.min_quantity <= v_qty
    ORDER BY
        (pbe.variant_id = p_variant_id) DESC NULLS LAST,
        pbe.min_quantity DESC,
        (pbe.uom_code = v_uom) DESC NULLS LAST
    LIMIT 1;

    IF v_price IS NOT NULL THEN
        RETURN v_price;
    END IF;

    -- 3. Fallback to the denormalized variant price cache.
    IF p_variant_id IS NOT NULL THEN
        SELECT price
        INTO v_price
        FROM public.item_variants
        WHERE id = p_variant_id
          AND tenant_id = p_tenant_id;

        IF v_price IS NOT NULL THEN
            RETURN v_price;
        END IF;
    END IF;

    RETURN 0;
END;
$$;

REVOKE ALL ON FUNCTION private.resolve_price(UUID, UUID, UUID, UUID, NUMERIC, TEXT, TEXT) FROM PUBLIC;

-- Backward-compatible wrapper used by bulk pricing.
CREATE OR REPLACE FUNCTION private.resolve_item_selling_price(
    p_tenant_id UUID,
    p_item_id UUID,
    p_variant_id UUID,
    p_base_uom TEXT
)
RETURNS NUMERIC
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
    SELECT private.resolve_price(p_tenant_id, p_item_id, p_variant_id, NULL, 1, p_base_uom, NULL);
$$;

-- --------------------------------------------------------------------
-- sync_product_master_commerce: scope writes to the item-level
-- (variant_id IS NULL) bucket and re-key the supplier upsert.
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
          AND is_master = TRUE
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
          AND variant_id IS NULL
          AND min_quantity = 1.0000;

        INSERT INTO public.price_book_entries (
            tenant_id, price_book_id, item_id, variant_id, uom_code, min_quantity, price
        )
        VALUES (
            p_tenant_id, v_price_book_id, p_item_id, NULL,
            COALESCE(v_selling_uom, v_base_uom), 1.0000, p_selling_price
        );
    END IF;

    IF v_purchase_uom IS NOT NULL AND v_purchase_uom <> v_base_uom THEN
        IF p_purchase_uom_conversion IS NULL OR p_purchase_uom_conversion <= 0 THEN
            RAISE EXCEPTION 'purchase unit conversion factor must be positive';
        END IF;

        INSERT INTO public.item_uoms (tenant_id, item_id, uom_code, conversion_factor)
        VALUES (p_tenant_id, p_item_id, v_purchase_uom, p_purchase_uom_conversion)
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
              AND variant_id IS NULL
              AND supplier_id IS DISTINCT FROM p_supplier_id;

            INSERT INTO public.supplier_items (
                tenant_id, item_id, variant_id, supplier_id,
                supplier_price, supplier_currency, is_preferred
            )
            SELECT
                p_tenant_id, p_item_id, NULL, p_supplier_id,
                p_purchase_price, COALESCE(t.base_currency, 'USD'), TRUE
            FROM public.tenants t
            WHERE t.id = p_tenant_id
            ON CONFLICT (item_id, supplier_id, COALESCE(variant_id, '00000000-0000-0000-0000-000000000000'::uuid))
            DO UPDATE SET
                supplier_price = EXCLUDED.supplier_price,
                is_preferred = TRUE;
        END IF;
    END IF;
END;
$$;

-- --------------------------------------------------------------------
-- product_list_workspace_rows: master variant + variant-aware price.
-- (Identical column list/order; only the LATERAL + price logic change.)
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
    ORDER BY v.is_master DESC, v.created_at ASC
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

GRANT SELECT ON public.product_list_workspace_rows TO authenticated;

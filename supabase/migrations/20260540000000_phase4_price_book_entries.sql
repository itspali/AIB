-- ====================================================================
-- AIB SMART ERP - PHASE 4: PRICE BOOK ENTRY EDITOR
-- Migration: 20260540000000_phase4_price_book_entries.sql
-- --------------------------------------------------------------------
--   * save_price_book_entries(item, book, rows): manage per-variant,
--     per-UOM, quantity-break price entries for a single (item, book).
--   * Replace-all semantics scoped to one (tenant, item, price_book):
--     the grid loads every existing row, so a full replace is safe and
--     keeps the unique key (book, item, variant-bucket, uom-bucket,
--     min_quantity) intact.
--   * variant_id IS NULL  => applies to all variants.
--     uom_code   IS NULL  => applies to any UOM.
-- ====================================================================

CREATE OR REPLACE FUNCTION public.save_price_book_entries(
    p_item_id UUID,
    p_price_book_id UUID,
    p_rows JSONB
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_tenant_id UUID;
    v_entry JSONB;
    v_variant_id UUID;
    v_uom TEXT;
    v_min_qty NUMERIC(15, 4);
    v_price NUMERIC(15, 4);
    v_count INTEGER := 0;
    v_seen TEXT[] := ARRAY[]::TEXT[];
    v_combo TEXT;
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

    IF NOT EXISTS (
        SELECT 1 FROM public.price_books WHERE id = p_price_book_id AND tenant_id = v_tenant_id
    ) THEN
        RAISE EXCEPTION 'price book not found for tenant';
    END IF;

    IF p_rows IS NULL OR jsonb_typeof(p_rows) IS DISTINCT FROM 'array' THEN
        RAISE EXCEPTION 'rows payload must be a JSON array';
    END IF;

    -- Replace-all for this (tenant, item, book). The grid loads every row,
    -- so anything not re-submitted is intentionally removed.
    DELETE FROM public.price_book_entries
    WHERE tenant_id = v_tenant_id
      AND item_id = p_item_id
      AND price_book_id = p_price_book_id;

    FOR v_entry IN SELECT value FROM jsonb_array_elements(p_rows)
    LOOP
        v_variant_id := NULLIF(v_entry ->> 'variant_id', '')::UUID;
        v_uom := NULLIF(btrim(v_entry ->> 'uom_code'), '');
        v_min_qty := COALESCE(NULLIF(v_entry ->> 'min_quantity', '')::NUMERIC, 1);
        v_price := NULLIF(v_entry ->> 'price', '')::NUMERIC;

        IF v_price IS NULL THEN
            RAISE EXCEPTION 'price is required for every entry';
        END IF;

        IF v_price < 0 THEN
            RAISE EXCEPTION 'price must be zero or greater';
        END IF;

        IF v_min_qty <= 0 THEN
            RAISE EXCEPTION 'minimum quantity must be greater than zero';
        END IF;

        IF v_variant_id IS NOT NULL AND NOT EXISTS (
            SELECT 1 FROM public.item_variants
            WHERE id = v_variant_id AND item_id = p_item_id AND tenant_id = v_tenant_id
        ) THEN
            RAISE EXCEPTION 'variant % does not belong to this product', v_variant_id;
        END IF;

        -- In-batch duplicate guard mirroring the unique index buckets.
        v_combo := COALESCE(v_variant_id::TEXT, '*') || '|'
                || COALESCE(v_uom, '*') || '|'
                || v_min_qty::TEXT;

        IF v_combo = ANY (v_seen) THEN
            RAISE EXCEPTION 'duplicate entry for the same variant, unit, and minimum quantity';
        END IF;
        v_seen := array_append(v_seen, v_combo);

        INSERT INTO public.price_book_entries (
            tenant_id, price_book_id, item_id, variant_id, uom_code, min_quantity, price
        )
        VALUES (
            v_tenant_id, p_price_book_id, p_item_id, v_variant_id, v_uom, v_min_qty, v_price
        );

        v_count := v_count + 1;
    END LOOP;

    RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.save_price_book_entries(UUID, UUID, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_price_book_entries(UUID, UUID, JSONB) TO authenticated;

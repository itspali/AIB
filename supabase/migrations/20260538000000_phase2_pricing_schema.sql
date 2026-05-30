-- ====================================================================
-- AIB SMART ERP - PHASE 2: VARIANT + CHANNEL PRICING SCHEMA
-- Migration: 20260538000000_phase2_pricing_schema.sql
-- --------------------------------------------------------------------
--   * price_book_entries gains variant_id (NULL = applies to all variants)
--   * supplier_items gains variant_id (per-variant purchase cost)
--   * storefront_channels gains default_price_book_id (channel->book binding)
-- The zero-uuid sentinel keeps NULL ("all variants") a single unique bucket.
-- ====================================================================

-- --------------------------------------------------------------------
-- 1. price_book_entries.variant_id
-- --------------------------------------------------------------------
ALTER TABLE public.price_book_entries
    ADD COLUMN IF NOT EXISTS variant_id UUID REFERENCES public.item_variants (id) ON DELETE CASCADE;

ALTER TABLE public.price_book_entries
    DROP CONSTRAINT IF EXISTS price_book_entries_unique_key;

DROP INDEX IF EXISTS price_book_entries_unique_key;
CREATE UNIQUE INDEX price_book_entries_unique_key
    ON public.price_book_entries (
        price_book_id,
        item_id,
        COALESCE(variant_id, '00000000-0000-0000-0000-000000000000'::uuid),
        COALESCE(uom_code, '*'),
        min_quantity
    );

CREATE INDEX IF NOT EXISTS price_book_entries_variant_idx
    ON public.price_book_entries (tenant_id, variant_id)
    WHERE variant_id IS NOT NULL;

-- --------------------------------------------------------------------
-- 2. supplier_items.variant_id
-- --------------------------------------------------------------------
ALTER TABLE public.supplier_items
    ADD COLUMN IF NOT EXISTS variant_id UUID REFERENCES public.item_variants (id) ON DELETE CASCADE;

ALTER TABLE public.supplier_items
    DROP CONSTRAINT IF EXISTS supplier_items_item_supplier_unique;

DROP INDEX IF EXISTS supplier_items_item_supplier_unique;
CREATE UNIQUE INDEX supplier_items_item_supplier_unique
    ON public.supplier_items (
        item_id,
        supplier_id,
        COALESCE(variant_id, '00000000-0000-0000-0000-000000000000'::uuid)
    );

-- Preferred supplier is unique per (item, variant-bucket).
DROP INDEX IF EXISTS supplier_items_one_preferred_per_item;
CREATE UNIQUE INDEX supplier_items_one_preferred_per_item
    ON public.supplier_items (
        item_id,
        COALESCE(variant_id, '00000000-0000-0000-0000-000000000000'::uuid)
    )
    WHERE is_preferred = TRUE;

-- --------------------------------------------------------------------
-- 3. storefront_channels.default_price_book_id (channel -> book binding)
-- --------------------------------------------------------------------
ALTER TABLE public.storefront_channels
    ADD COLUMN IF NOT EXISTS default_price_book_id UUID;

ALTER TABLE public.storefront_channels
    DROP CONSTRAINT IF EXISTS storefront_channels_default_book_fk;

ALTER TABLE public.storefront_channels
    ADD CONSTRAINT storefront_channels_default_book_fk
    FOREIGN KEY (tenant_id, default_price_book_id)
    REFERENCES public.price_books (tenant_id, id)
    ON DELETE SET NULL;

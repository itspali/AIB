-- ====================================================================
-- AIB SMART ERP - PHASE 0: VARIANT FOUNDATION
-- Migration: 20260536000000_phase0_variant_foundation.sql
-- --------------------------------------------------------------------
-- Closes the item<->variant "split-brain" foundation:
--   * Explicit item_variants.is_master flag (kills created_at re-derivation)
--   * Stable items.code identity (decoupled from master SKU)
--   * Item-level variant axes definition (input for matrix generation)
--   * Stock is ALWAYS attributed to a variant (no variant_id NULL branch)
--   * has_variants becomes a single derived source of truth (trigger)
-- ====================================================================

-- --------------------------------------------------------------------
-- 1. items.code (stable identity) + items.variant_axes
-- --------------------------------------------------------------------
ALTER TABLE public.items
    ADD COLUMN IF NOT EXISTS code TEXT;

ALTER TABLE public.items
    ADD COLUMN IF NOT EXISTS variant_axes JSONB NOT NULL DEFAULT '[]'::jsonb;

-- --------------------------------------------------------------------
-- 2. item_variants.is_master (explicit master flag)
-- --------------------------------------------------------------------
ALTER TABLE public.item_variants
    ADD COLUMN IF NOT EXISTS is_master BOOLEAN NOT NULL DEFAULT FALSE;

-- Backfill: the oldest variant per item becomes master (deterministic tiebreak on id).
UPDATE public.item_variants v
SET is_master = TRUE
WHERE v.id = (
    SELECT iv.id
    FROM public.item_variants iv
    WHERE iv.item_id = v.item_id
      AND iv.tenant_id = v.tenant_id
    ORDER BY iv.created_at ASC, iv.id ASC
    LIMIT 1
);

-- At most one master per item.
CREATE UNIQUE INDEX IF NOT EXISTS item_variants_one_master_per_item
    ON public.item_variants (item_id)
    WHERE is_master = TRUE;

-- Backfill items.code from the master variant SKU (master SKU is already tenant-unique).
UPDATE public.items i
SET code = v.sku
FROM public.item_variants v
WHERE v.item_id = i.id
  AND v.tenant_id = i.tenant_id
  AND v.is_master = TRUE
  AND i.code IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS items_tenant_code_unique
    ON public.items (tenant_id, code)
    WHERE code IS NOT NULL;

-- --------------------------------------------------------------------
-- 3. Always attribute stock to a variant
--    Backfill historical NULL variant_id rows to the master variant.
-- --------------------------------------------------------------------

-- inventory_ledger is append-only (UPDATE is blocked by a guard trigger);
-- disable the block only for this backfill.
ALTER TABLE public.inventory_ledger DISABLE TRIGGER inventory_ledger_block_update;

UPDATE public.inventory_ledger l
SET variant_id = mv.id
FROM public.item_variants mv
WHERE mv.item_id = l.item_id
  AND mv.tenant_id = l.tenant_id
  AND mv.is_master = TRUE
  AND l.variant_id IS NULL;

ALTER TABLE public.inventory_ledger ENABLE TRIGGER inventory_ledger_block_update;

UPDATE public.item_valuations iv
SET variant_id = mv.id
FROM public.item_variants mv
WHERE mv.item_id = iv.item_id
  AND mv.tenant_id = iv.tenant_id
  AND mv.is_master = TRUE
  AND iv.variant_id IS NULL;

UPDATE public.inventory_buffer_thresholds bt
SET variant_id = mv.id
FROM public.item_variants mv
WHERE mv.item_id = bt.item_id
  AND mv.tenant_id = bt.tenant_id
  AND mv.is_master = TRUE
  AND bt.variant_id IS NULL;

-- Collapse the COALESCE(variant_id, zero-uuid) sentinel: variant_id is now mandatory.
ALTER TABLE public.inventory_ledger
    ALTER COLUMN variant_id SET NOT NULL;

ALTER TABLE public.item_valuations
    ALTER COLUMN variant_id SET NOT NULL;

ALTER TABLE public.inventory_buffer_thresholds
    ALTER COLUMN variant_id SET NOT NULL;

DROP INDEX IF EXISTS item_valuations_location_item_variant_unique;
CREATE UNIQUE INDEX item_valuations_location_item_variant_unique
    ON public.item_valuations (location_id, item_id, variant_id);

DROP INDEX IF EXISTS inventory_buffer_thresholds_location_item_variant_unique;
CREATE UNIQUE INDEX inventory_buffer_thresholds_location_item_variant_unique
    ON public.inventory_buffer_thresholds (location_id, item_id, variant_id);

-- --------------------------------------------------------------------
-- 4. Variant-required guard: variant_id is now always required and must
--    belong to the same item (has_variants no longer gates this).
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.inventory_ledger_variant_required_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
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

    RETURN NEW;
END;
$$;

-- --------------------------------------------------------------------
-- 5. has_variants as a single derived source of truth
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.sync_item_has_variants(
    p_tenant_id UUID,
    p_item_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
BEGIN
    UPDATE public.items i
    SET has_variants = (
        SELECT COUNT(*) > 1
        FROM public.item_variants v
        WHERE v.item_id = p_item_id
          AND v.tenant_id = p_tenant_id
    )
    WHERE i.id = p_item_id
      AND i.tenant_id = p_tenant_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.item_variants_sync_has_variants()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        PERFORM private.sync_item_has_variants(OLD.tenant_id, OLD.item_id);
        RETURN OLD;
    END IF;

    PERFORM private.sync_item_has_variants(NEW.tenant_id, NEW.item_id);
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS item_variants_sync_has_variants ON public.item_variants;
CREATE TRIGGER item_variants_sync_has_variants
    AFTER INSERT OR DELETE ON public.item_variants
    FOR EACH ROW
    EXECUTE FUNCTION public.item_variants_sync_has_variants();

-- Reconcile existing rows so the derived flag is correct from the start.
UPDATE public.items i
SET has_variants = (
    SELECT COUNT(*) > 1
    FROM public.item_variants v
    WHERE v.item_id = i.id
      AND v.tenant_id = i.tenant_id
);

-- ====================================================================
-- AIB SMART ERP - PHASE 0: DEFAULT TRANSACTION LINES TO MASTER VARIANT
-- Migration: 20260536050000_phase0_line_variant_default.sql
-- --------------------------------------------------------------------
-- Now that stock is always variant-attributed (the inventory_ledger
-- guard rejects NULL variant_id), every transaction line that can feed
-- the ledger must carry a variant. This trigger defaults variant_id to
-- the item's master variant whenever a caller omits it, keeping single-
-- variant flows working without forcing every caller to resolve master.
-- ====================================================================

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
          AND is_master = TRUE
        LIMIT 1;

        IF NEW.variant_id IS NULL THEN
            RAISE EXCEPTION 'item % has no master variant', NEW.item_id;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DO $$
DECLARE
    v_table TEXT;
    v_tables TEXT[] := ARRAY[
        'purchase_order_items',
        'goods_receipt_items',
        'purchase_invoice_items',
        'stock_transfer_items',
        'sales_quotation_items',
        'sales_order_items',
        'sales_invoice_items',
        'sales_return_items'
    ];
BEGIN
    FOREACH v_table IN ARRAY v_tables
    LOOP
        EXECUTE format(
            'DROP TRIGGER IF EXISTS %I ON public.%I',
            v_table || '_default_variant', v_table
        );
        EXECUTE format(
            'CREATE TRIGGER %I BEFORE INSERT ON public.%I '
            || 'FOR EACH ROW EXECUTE FUNCTION private.default_line_variant_to_master()',
            v_table || '_default_variant', v_table
        );
    END LOOP;
END;
$$;

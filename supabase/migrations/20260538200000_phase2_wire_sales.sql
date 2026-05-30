-- ====================================================================
-- AIB SMART ERP - PHASE 2: WIRE SALES LINES TO THE PRICE RESOLVER
-- Migration: 20260538200000_phase2_wire_sales.sql
-- --------------------------------------------------------------------
-- When a sales/quotation/invoice line is inserted with unit_price_selling
-- = 0 (the "auto-price" sentinel), resolve the unit price from the unified
-- resolver using the order's storefront channel, the line's variant, and
-- the line quantity. A non-zero caller-supplied price is always respected
-- (manual override). Runs after the master-variant default trigger.
-- ====================================================================

CREATE OR REPLACE FUNCTION private.resolve_sales_line_price()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_row JSONB;
    v_qty NUMERIC;
    v_channel UUID;
BEGIN
    IF NEW.unit_price_selling IS NOT NULL AND NEW.unit_price_selling <> 0 THEN
        RETURN NEW;
    END IF;

    v_row := to_jsonb(NEW);
    v_qty := COALESCE(
        (v_row ->> 'quantity_ordered')::NUMERIC,
        (v_row ->> 'quantity_quoted')::NUMERIC,
        (v_row ->> 'quantity_invoiced')::NUMERIC,
        1
    );

    IF TG_TABLE_NAME = 'sales_order_items' THEN
        SELECT storefront_channel_id
        INTO v_channel
        FROM public.sales_orders
        WHERE id = NEW.sales_order_id;
    END IF;

    NEW.unit_price_selling := private.resolve_price(
        NEW.tenant_id,
        NEW.item_id,
        NEW.variant_id,
        v_channel,
        v_qty,
        NULL,
        NULL
    );

    RETURN NEW;
END;
$$;

DO $$
DECLARE
    v_table TEXT;
    v_tables TEXT[] := ARRAY[
        'sales_quotation_items',
        'sales_order_items',
        'sales_invoice_items'
    ];
BEGIN
    FOREACH v_table IN ARRAY v_tables
    LOOP
        EXECUTE format(
            'DROP TRIGGER IF EXISTS %I ON public.%I',
            v_table || '_resolve_price', v_table
        );
        EXECUTE format(
            'CREATE TRIGGER %I BEFORE INSERT ON public.%I '
            || 'FOR EACH ROW EXECUTE FUNCTION private.resolve_sales_line_price()',
            v_table || '_resolve_price', v_table
        );
    END LOOP;
END;
$$;

COMMENT ON COLUMN public.item_variants.price IS
    'Denormalized cache of the variant''s default-book list price. Source of truth is price_book_entries via private.resolve_price().';

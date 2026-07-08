-- ====================================================================
-- Permanent item delete when unused in transactions
-- --------------------------------------------------------------------
-- Hard-delete items that have no transactional references. Catalog
-- children (variants, media, tags, assortment) cascade. Soft archive
-- (bulk_archive_items) remains for items with history.
-- ====================================================================

-- Expand transactional history: anything with RESTRICT FKs / posted docs.
CREATE OR REPLACE FUNCTION private.item_has_transactional_history(
    p_tenant_id UUID,
    p_item_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
    SELECT
        EXISTS (
            SELECT 1 FROM public.inventory_ledger
            WHERE tenant_id = p_tenant_id AND item_id = p_item_id
        )
        OR EXISTS (
            SELECT 1 FROM public.sales_quotation_items
            WHERE tenant_id = p_tenant_id AND item_id = p_item_id
        )
        OR EXISTS (
            SELECT 1 FROM public.sales_order_items
            WHERE tenant_id = p_tenant_id AND item_id = p_item_id
        )
        OR EXISTS (
            SELECT 1 FROM public.sales_invoice_items
            WHERE tenant_id = p_tenant_id AND item_id = p_item_id
        )
        OR EXISTS (
            SELECT 1 FROM public.sales_return_items
            WHERE tenant_id = p_tenant_id AND item_id = p_item_id
        )
        OR EXISTS (
            SELECT 1 FROM public.purchase_order_items
            WHERE tenant_id = p_tenant_id AND item_id = p_item_id
        )
        OR EXISTS (
            SELECT 1 FROM public.purchase_invoice_items
            WHERE tenant_id = p_tenant_id AND item_id = p_item_id
        )
        OR EXISTS (
            SELECT 1 FROM public.goods_receipt_items
            WHERE tenant_id = p_tenant_id AND item_id = p_item_id
        )
        OR EXISTS (
            SELECT 1 FROM public.stock_transfer_items
            WHERE tenant_id = p_tenant_id AND item_id = p_item_id
        )
        OR EXISTS (
            SELECT 1 FROM public.stock_adjustment_lines
            WHERE tenant_id = p_tenant_id AND item_id = p_item_id
        )
        OR EXISTS (
            SELECT 1 FROM public.goods_in_transit_voucher_items
            WHERE tenant_id = p_tenant_id AND item_id = p_item_id
        )
        OR EXISTS (
            SELECT 1 FROM public.import_shipment_lines
            WHERE tenant_id = p_tenant_id AND item_id = p_item_id
        )
        OR EXISTS (
            SELECT 1 FROM public.inventory_reservations
            WHERE tenant_id = p_tenant_id AND item_id = p_item_id
        );
$$;

CREATE OR REPLACE FUNCTION public.item_editability(p_item_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_tenant_id UUID;
    v_has_history BOOLEAN;
    v_locked TEXT[] := ARRAY[]::TEXT[];
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

    v_has_history := private.item_has_transactional_history(v_tenant_id, p_item_id);

    IF v_has_history THEN
        v_locked := ARRAY[
            'base_unit_of_measure',
            'base_uom_id',
            'item_type',
            'classification',
            'track_inventory',
            'variant_strategy',
            'tracking_mode'
        ];
    END IF;

    RETURN jsonb_build_object(
        'has_history', v_has_history,
        'can_permanently_delete', NOT v_has_history,
        'locked_fields', to_jsonb(v_locked)
    );
END;
$$;

REVOKE ALL ON FUNCTION public.item_editability(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.item_editability(UUID) TO authenticated;

-- Permanent delete for unused items only.
CREATE OR REPLACE FUNCTION public.delete_item(p_item_id UUID)
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

    IF NOT EXISTS (
        SELECT 1 FROM public.items WHERE id = p_item_id AND tenant_id = v_tenant_id
    ) THEN
        RAISE EXCEPTION 'product not found for tenant';
    END IF;

    IF private.item_has_transactional_history(v_tenant_id, p_item_id) THEN
        RAISE EXCEPTION 'ITEM_IN_USE: item is referenced by transactions and cannot be permanently deleted';
    END IF;

    -- Catalog rows that RESTRICT delete but are not transactional history.
    DELETE FROM public.supplier_items
    WHERE tenant_id = v_tenant_id
      AND item_id = p_item_id;

    DELETE FROM public.item_valuations
    WHERE tenant_id = v_tenant_id
      AND item_id = p_item_id
      AND COALESCE(total_quantity_on_hand, 0) = 0;

    IF EXISTS (
        SELECT 1 FROM public.item_valuations
        WHERE tenant_id = v_tenant_id
          AND item_id = p_item_id
    ) THEN
        RAISE EXCEPTION 'ITEM_IN_USE: item still has inventory valuation balances and cannot be permanently deleted';
    END IF;

    DELETE FROM public.items
    WHERE id = p_item_id
      AND tenant_id = v_tenant_id;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_item(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_item(UUID) TO authenticated;

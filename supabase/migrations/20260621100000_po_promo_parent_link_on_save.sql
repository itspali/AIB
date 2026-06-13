-- Fix free-goods parent linkage on PO save: lines are deleted and re-inserted on edit,
-- so linked_parent_line_id from the client refers to stale ids and violates
-- purchase_order_items_linked_parent_tenant_fk. Resolve parent by variant after insert.

CREATE OR REPLACE FUNCTION private.apply_po_save_promo_lines(
    p_po_id UUID,
    p_lines JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_tenant_id UUID;
    v_entry JSONB;
    v_ord INT;
    v_promo RECORD;
    v_line_id UUID;
    v_parent_variant UUID;
    v_parent_line_id UUID;
    v_default_category TEXT;
BEGIN
    v_tenant_id := private.current_tenant_id();
    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'tenant context missing from session';
    END IF;

    v_default_category := COALESCE(
        private.get_procurement_control_text(v_tenant_id, 'promo_default_category', 'FREE_GOODS'),
        'FREE_GOODS'
    );

    FOR v_entry, v_ord IN
        SELECT t.entry, t.ord::INT
        FROM jsonb_array_elements(p_lines) WITH ORDINALITY AS t(entry, ord)
    LOOP
        SELECT * INTO v_promo FROM private.po_line_promo_from_json(v_entry);

        SELECT poi.id
        INTO v_line_id
        FROM public.purchase_order_items poi
        WHERE poi.purchase_order_id = p_po_id
          AND poi.tenant_id = v_tenant_id
          AND poi.variant_id = NULLIF(v_entry ->> 'variant_id', '')::UUID
          AND poi.quantity_ordered = NULLIF(v_entry ->> 'quantity_ordered', '')::NUMERIC
          AND poi.unit_price_contractual = COALESCE(NULLIF(v_entry ->> 'unit_price_contractual', '')::NUMERIC, 0)
        ORDER BY poi.created_at, poi.id
        LIMIT 1;

        IF v_line_id IS NULL THEN
            CONTINUE;
        END IF;

        UPDATE public.purchase_order_items poi
        SET is_promotional = v_promo.is_promotional,
            promo_group_id = CASE
                WHEN v_promo.is_promotional THEN COALESCE(v_promo.promo_group_id, poi.promo_group_id, gen_random_uuid())
                ELSE NULL
            END,
            cost_allocation_method = COALESCE(v_promo.cost_allocation_method, poi.cost_allocation_method),
            promotional_category = COALESCE(v_promo.promotional_category, v_default_category),
            linked_parent_line_id = NULL,
            updated_at = NOW()
        WHERE poi.id = v_line_id
          AND poi.tenant_id = v_tenant_id;
    END LOOP;

    FOR v_entry IN SELECT value FROM jsonb_array_elements(p_lines)
    LOOP
        v_parent_variant := NULLIF(v_entry ->> 'linked_parent_variant_id', '')::UUID;
        IF v_parent_variant IS NULL THEN
            CONTINUE;
        END IF;

        SELECT poi.id INTO v_line_id
        FROM public.purchase_order_items poi
        WHERE poi.purchase_order_id = p_po_id
          AND poi.tenant_id = v_tenant_id
          AND poi.variant_id = NULLIF(v_entry ->> 'variant_id', '')::UUID
          AND poi.is_promotional = TRUE
          AND poi.quantity_ordered = NULLIF(v_entry ->> 'quantity_ordered', '')::NUMERIC
          AND poi.unit_price_contractual = COALESCE(NULLIF(v_entry ->> 'unit_price_contractual', '')::NUMERIC, 0)
        ORDER BY poi.created_at, poi.id
        LIMIT 1;

        SELECT poi.id INTO v_parent_line_id
        FROM public.purchase_order_items poi
        WHERE poi.purchase_order_id = p_po_id
          AND poi.tenant_id = v_tenant_id
          AND poi.variant_id = v_parent_variant
          AND COALESCE(poi.is_promotional, FALSE) = FALSE
        ORDER BY poi.created_at, poi.id
        LIMIT 1;

        IF v_line_id IS NOT NULL AND v_parent_line_id IS NOT NULL THEN
            UPDATE public.purchase_order_items
            SET linked_parent_line_id = v_parent_line_id,
                updated_at = NOW()
            WHERE id = v_line_id
              AND tenant_id = v_tenant_id;
        END IF;
    END LOOP;
END;
$$;

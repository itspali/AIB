-- Track buffer rows copied from the product default vs explicit per-cell overrides.
-- Master reorder saves clear default-synced rows so cells inherit the new default.

ALTER TABLE public.inventory_buffer_thresholds
    ADD COLUMN IF NOT EXISTS inherits_product_default BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.inventory_buffer_thresholds.inherits_product_default IS
    'TRUE when reorder_point_qty mirrors items.custom_fields default; cleared on master default change.';

UPDATE public.inventory_buffer_thresholds bt
SET inherits_product_default = TRUE
FROM public.items i
WHERE i.id = bt.item_id
  AND i.tenant_id = bt.tenant_id
  AND GREATEST(
        COALESCE(
            NULLIF(TRIM(i.custom_fields ->> 'reorder_point'), '')::NUMERIC,
            NULLIF(TRIM(i.custom_fields ->> 'reorder_point_qty'), '')::NUMERIC,
            0::NUMERIC
        ),
        0::NUMERIC
    ) > 0
  AND bt.reorder_point_qty = COALESCE(
        NULLIF(TRIM(i.custom_fields ->> 'reorder_point'), '')::NUMERIC,
        NULLIF(TRIM(i.custom_fields ->> 'reorder_point_qty'), '')::NUMERIC,
        0::NUMERIC
    );

-- Re-save RPC: explicit grid edits are never default-synced copies.
CREATE OR REPLACE FUNCTION public.save_item_buffer_thresholds(
    p_item_id UUID,
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
    v_location_id UUID;
    v_qty_text TEXT;
    v_qty NUMERIC(15, 4);
    v_count INTEGER := 0;
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

    IF p_rows IS NULL OR jsonb_typeof(p_rows) IS DISTINCT FROM 'array' THEN
        RAISE EXCEPTION 'rows payload must be a JSON array';
    END IF;

    FOR v_entry IN SELECT value FROM jsonb_array_elements(p_rows)
    LOOP
        v_variant_id := NULLIF(v_entry ->> 'variant_id', '')::UUID;
        v_location_id := NULLIF(v_entry ->> 'location_id', '')::UUID;

        IF v_variant_id IS NULL OR v_location_id IS NULL THEN
            CONTINUE;
        END IF;

        IF NOT EXISTS (
            SELECT 1 FROM public.item_variants
            WHERE id = v_variant_id AND item_id = p_item_id AND tenant_id = v_tenant_id
        ) THEN
            RAISE EXCEPTION 'variant % does not belong to this product', v_variant_id;
        END IF;

        IF NOT EXISTS (
            SELECT 1 FROM public.tenant_locations
            WHERE id = v_location_id
              AND tenant_id = v_tenant_id
              AND is_active = TRUE
              AND is_stock_holding = TRUE
              AND presence_type IS DISTINCT FROM 'VIRTUAL'
        ) THEN
            RAISE EXCEPTION 'location % is not an active stock-holding location', v_location_id;
        END IF;

        IF NOT (v_entry ? 'reorder_point_qty') THEN
            CONTINUE;
        END IF;

        v_qty_text := NULLIF(TRIM(v_entry ->> 'reorder_point_qty'), '');

        IF v_qty_text IS NULL THEN
            DELETE FROM public.inventory_buffer_thresholds
            WHERE tenant_id = v_tenant_id
              AND item_id = p_item_id
              AND variant_id = v_variant_id
              AND location_id = v_location_id;
            v_count := v_count + 1;
            CONTINUE;
        END IF;

        v_qty := v_qty_text::NUMERIC(15, 4);
        IF v_qty < 0 THEN
            RAISE EXCEPTION 'reorder_point_qty must be non-negative';
        END IF;

        INSERT INTO public.inventory_buffer_thresholds (
            tenant_id,
            location_id,
            item_id,
            variant_id,
            reorder_point_qty,
            inherits_product_default
        )
        VALUES (
            v_tenant_id,
            v_location_id,
            p_item_id,
            v_variant_id,
            v_qty,
            FALSE
        )
        ON CONFLICT (location_id, item_id, variant_id)
        DO UPDATE SET
            reorder_point_qty = EXCLUDED.reorder_point_qty,
            inherits_product_default = FALSE,
            updated_at = NOW();

        v_count := v_count + 1;
    END LOOP;

    RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.save_item_buffer_thresholds(UUID, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_item_buffer_thresholds(UUID, JSONB) TO authenticated;

-- Drop default-synced buffer rows after the product default reorder changes.
CREATE OR REPLACE FUNCTION public.propagate_item_reorder_default(
    p_item_id UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_tenant_id UUID;
    v_deleted INTEGER;
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

    DELETE FROM public.inventory_buffer_thresholds
    WHERE tenant_id = v_tenant_id
      AND item_id = p_item_id
      AND inherits_product_default = TRUE;

    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    RETURN v_deleted;
END;
$$;

REVOKE ALL ON FUNCTION public.propagate_item_reorder_default(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.propagate_item_reorder_default(UUID) TO authenticated;

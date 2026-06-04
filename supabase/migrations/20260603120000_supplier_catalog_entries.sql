-- ====================================================================
-- Supplier catalog: replace-all per item for supplier_items rows.
-- variant_id NULL = default for all variants; non-null = override.
-- ====================================================================

CREATE OR REPLACE FUNCTION public.save_supplier_catalog_entries(
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
    v_supplier_id UUID;
    v_price NUMERIC(15, 4);
    v_part_number TEXT;
    v_is_preferred BOOLEAN;
    v_moq NUMERIC(15, 4);
    v_lead_time INTEGER;
    v_count INTEGER := 0;
    v_seen TEXT[] := ARRAY[]::TEXT[];
    v_preferred_buckets TEXT[] := ARRAY[]::TEXT[];
    v_combo TEXT;
    v_pref_bucket TEXT;
    v_currency VARCHAR(3);
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

    SELECT COALESCE(t.base_currency, 'USD')
    INTO v_currency
    FROM public.tenants t
    WHERE t.id = v_tenant_id;

    DELETE FROM public.supplier_items
    WHERE tenant_id = v_tenant_id
      AND item_id = p_item_id;

    FOR v_entry IN SELECT value FROM jsonb_array_elements(p_rows)
    LOOP
        v_supplier_id := NULLIF(v_entry ->> 'supplier_id', '')::UUID;
        v_variant_id := NULLIF(v_entry ->> 'variant_id', '')::UUID;
        v_price := NULLIF(v_entry ->> 'supplier_price', '')::NUMERIC;
        v_part_number := NULLIF(btrim(v_entry ->> 'supplier_part_number'), '');
        v_is_preferred := COALESCE((v_entry ->> 'is_preferred')::BOOLEAN, FALSE);
        v_moq := COALESCE(NULLIF(v_entry ->> 'minimum_order_quantity', '')::NUMERIC, 1);
        v_lead_time := NULLIF(v_entry ->> 'lead_time_days', '')::INTEGER;

        IF v_supplier_id IS NULL THEN
            RAISE EXCEPTION 'supplier_id is required for every entry';
        END IF;

        IF v_price IS NULL OR v_price < 0 THEN
            RAISE EXCEPTION 'supplier_price must be zero or greater';
        END IF;

        IF v_moq <= 0 THEN
            RAISE EXCEPTION 'minimum_order_quantity must be greater than zero';
        END IF;

        IF NOT EXISTS (
            SELECT 1
            FROM public.entities
            WHERE id = v_supplier_id
              AND tenant_id = v_tenant_id
              AND type IN ('SUPPLIER', 'MUTUAL_PARTNER')
              AND is_active = TRUE
        ) THEN
            RAISE EXCEPTION 'supplier not found for tenant';
        END IF;

        IF v_variant_id IS NOT NULL AND NOT EXISTS (
            SELECT 1 FROM public.item_variants
            WHERE id = v_variant_id AND item_id = p_item_id AND tenant_id = v_tenant_id
        ) THEN
            RAISE EXCEPTION 'variant does not belong to this product';
        END IF;

        v_combo := COALESCE(v_variant_id::TEXT, '*') || '|' || v_supplier_id::TEXT;
        IF v_combo = ANY (v_seen) THEN
            RAISE EXCEPTION 'duplicate supplier for the same variant bucket';
        END IF;
        v_seen := array_append(v_seen, v_combo);

        v_pref_bucket := COALESCE(v_variant_id::TEXT, '*');
        IF v_is_preferred THEN
            IF v_pref_bucket = ANY (v_preferred_buckets) THEN
                RAISE EXCEPTION 'only one preferred supplier per variant bucket';
            END IF;
            v_preferred_buckets := array_append(v_preferred_buckets, v_pref_bucket);
        END IF;

        INSERT INTO public.supplier_items (
            tenant_id,
            item_id,
            variant_id,
            supplier_id,
            supplier_part_number,
            supplier_price,
            supplier_currency,
            minimum_order_quantity,
            lead_time_days,
            is_preferred
        )
        VALUES (
            v_tenant_id,
            p_item_id,
            v_variant_id,
            v_supplier_id,
            v_part_number,
            v_price,
            v_currency,
            v_moq,
            v_lead_time,
            v_is_preferred
        );

        v_count := v_count + 1;
    END LOOP;

    RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.save_supplier_catalog_entries(UUID, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_supplier_catalog_entries(UUID, JSONB) TO authenticated;

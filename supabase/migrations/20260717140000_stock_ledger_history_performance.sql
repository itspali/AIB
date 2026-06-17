-- Stock history peek: per-variant ledger slice + on-hand in one indexed read.

CREATE INDEX IF NOT EXISTS inventory_ledger_tenant_location_variant_created_idx
    ON public.inventory_ledger (tenant_id, location_id, variant_id, created_at DESC, id DESC);

COMMENT ON INDEX public.inventory_ledger_tenant_location_variant_created_idx IS
    'Peek stock history: filter by tenant/location/variant and read newest ledger rows.';

CREATE INDEX IF NOT EXISTS item_valuations_tenant_location_variant_idx
    ON public.item_valuations (tenant_id, location_id, variant_id);

COMMENT ON INDEX public.item_valuations_tenant_location_variant_idx IS
    'Stock history balance: on-hand lookup by tenant, location, and variant.';

CREATE OR REPLACE FUNCTION public.get_variant_stock_ledger_history(
    p_location_id UUID,
    p_variant_ids UUID[],
    p_limit_per_variant INT DEFAULT 15
)
RETURNS TABLE (
    id UUID,
    variant_id UUID,
    transaction_type public.inventory_transaction_type,
    quantity NUMERIC(15, 4),
    cost_at_transaction NUMERIC(15, 4),
    reference_document TEXT,
    created_at TIMESTAMPTZ,
    quantity_on_hand NUMERIC(15, 4)
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_tenant_id UUID;
    v_limit INT;
BEGIN
    v_tenant_id := private.current_tenant_id();
    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'tenant context missing from session';
    END IF;

    v_limit := GREATEST(1, LEAST(COALESCE(p_limit_per_variant, 15), 50));

    RETURN QUERY
    WITH ids AS (
        SELECT DISTINCT unnest(p_variant_ids) AS variant_id
    ),
    on_hand AS (
        SELECT
            i.variant_id,
            COALESCE(iv.total_quantity_on_hand, 0.0000) AS quantity_on_hand
        FROM ids i
        LEFT JOIN public.item_valuations iv
            ON iv.tenant_id = v_tenant_id
           AND iv.location_id = p_location_id
           AND iv.variant_id = i.variant_id
    ),
    ranked AS (
        SELECT
            il.id,
            il.variant_id,
            il.transaction_type,
            il.quantity,
            il.cost_at_transaction,
            il.reference_document,
            il.created_at,
            ROW_NUMBER() OVER (
                PARTITION BY il.variant_id
                ORDER BY il.created_at DESC, il.id DESC
            ) AS rn
        FROM public.inventory_ledger il
        INNER JOIN ids ON ids.variant_id = il.variant_id
        WHERE il.tenant_id = v_tenant_id
          AND il.location_id = p_location_id
    )
    SELECT
        r.id,
        r.variant_id,
        r.transaction_type,
        r.quantity,
        r.cost_at_transaction,
        r.reference_document,
        r.created_at,
        oh.quantity_on_hand
    FROM ranked r
    INNER JOIN on_hand oh ON oh.variant_id = r.variant_id
    WHERE r.rn <= v_limit
    ORDER BY r.variant_id, r.created_at DESC, r.id DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_variant_stock_ledger_history(UUID, UUID[], INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_variant_stock_ledger_history(UUID, UUID[], INT) TO authenticated;

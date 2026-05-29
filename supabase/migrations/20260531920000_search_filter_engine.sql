-- Migration: search_filter_engine (20260531920000 — after product catalog extensions)
-- Native filter search view, RPC executor, telemetry tables, and SEARCH_SETTINGS registry seed.

CREATE OR REPLACE VIEW public.product_catalog_search_rows
WITH (security_invoker = true) AS
SELECT
    i.id AS item_id,
    i.tenant_id,
    i.name,
    i.description,
    i.category_id,
    ic.name AS category_name,
    i.hsn_sac_code,
    i.base_unit_of_measure,
    i.created_at,
    iv.sku AS default_sku,
    (
        SELECT pbe.price
        FROM public.price_book_entries pbe
        INNER JOIN public.price_books pb
            ON pb.id = pbe.price_book_id
            AND pb.tenant_id = pbe.tenant_id
        WHERE pbe.tenant_id = i.tenant_id
          AND pbe.item_id = i.id
          AND pb.is_active = TRUE
          AND pbe.min_quantity = 1
        ORDER BY pb.created_at ASC
        LIMIT 1
    ) AS selling_price,
    (
        SELECT si.supplier_price
        FROM public.supplier_items si
        WHERE si.tenant_id = i.tenant_id
          AND si.item_id = i.id
        ORDER BY si.is_preferred DESC, si.supplier_id ASC
        LIMIT 1
    ) AS purchase_price
FROM public.items i
LEFT JOIN public.item_categories ic
    ON ic.tenant_id = i.tenant_id
    AND ic.id = i.category_id
LEFT JOIN LATERAL (
    SELECT v.sku
    FROM public.item_variants v
    WHERE v.tenant_id = i.tenant_id
      AND v.item_id = i.id
    ORDER BY v.created_at ASC
    LIMIT 1
) iv ON TRUE;

CREATE INDEX IF NOT EXISTS product_catalog_search_rows_tenant_created_idx
    ON public.items (tenant_id, created_at);

CREATE INDEX IF NOT EXISTS product_catalog_search_rows_tenant_hsn_idx
    ON public.items (tenant_id, hsn_sac_code);

CREATE INDEX IF NOT EXISTS product_catalog_search_rows_tenant_uom_idx
    ON public.items (tenant_id, base_unit_of_measure);

CREATE TABLE IF NOT EXISTS public.search_telemetry_logs (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
    user_id             UUID NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
    scope               TEXT NOT NULL,
    raw_query           TEXT NOT NULL DEFAULT '',
    unparsed_tokens     TEXT[] NOT NULL DEFAULT '{}'::text[],
    ast_json            JSONB NOT NULL DEFAULT '[]'::jsonb,
    compile_micros      INTEGER NOT NULL DEFAULT 0,
    execution_ms        INTEGER,
    performance_warning BOOLEAN NOT NULL DEFAULT FALSE,
    security_flag       BOOLEAN NOT NULL DEFAULT FALSE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS search_telemetry_logs_tenant_created_idx
    ON public.search_telemetry_logs (tenant_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.search_filter_violations (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
    user_id             UUID NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
    scope               TEXT NOT NULL,
    raw_query_hash      TEXT NOT NULL,
    attempted_fields    TEXT[] NOT NULL DEFAULT '{}'::text[],
    severity            TEXT NOT NULL CHECK (severity IN ('reject', 'throttle')),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS search_filter_violations_tenant_created_idx
    ON public.search_filter_violations (tenant_id, created_at DESC);

ALTER TABLE public.search_telemetry_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.search_filter_violations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS search_telemetry_logs_tenant_insert ON public.search_telemetry_logs;
DROP POLICY IF EXISTS search_telemetry_logs_tenant_select ON public.search_telemetry_logs;
DROP POLICY IF EXISTS search_filter_violations_tenant_insert ON public.search_filter_violations;
DROP POLICY IF EXISTS search_filter_violations_tenant_select ON public.search_filter_violations;

CREATE POLICY search_telemetry_logs_tenant_insert
    ON public.search_telemetry_logs FOR INSERT TO authenticated
    WITH CHECK (
        tenant_id = private.current_tenant_id()
        AND user_id = auth.uid()
    );

CREATE POLICY search_telemetry_logs_tenant_select
    ON public.search_telemetry_logs FOR SELECT TO authenticated
    USING (
        tenant_id = private.current_tenant_id()
        AND (
            user_id = auth.uid()
            OR private.current_user_role() IN ('OWNER'::public.user_role, 'ADMIN'::public.user_role)
        )
    );

CREATE POLICY search_filter_violations_tenant_insert
    ON public.search_filter_violations FOR INSERT TO authenticated
    WITH CHECK (
        tenant_id = private.current_tenant_id()
        AND user_id = auth.uid()
    );

CREATE POLICY search_filter_violations_tenant_select
    ON public.search_filter_violations FOR SELECT TO authenticated
    USING (
        tenant_id = private.current_tenant_id()
        AND private.current_user_role() IN ('OWNER'::public.user_role, 'ADMIN'::public.user_role)
    );

CREATE OR REPLACE FUNCTION public.execute_product_filter(p_ast jsonb)
RETURNS TABLE(item_id uuid)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
    v_tenant_id uuid;
BEGIN
    v_tenant_id := (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid;
    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'tenant context missing from session';
    END IF;

    RETURN QUERY
    SELECT pcsr.item_id
    FROM public.product_catalog_search_rows pcsr
    WHERE pcsr.tenant_id = v_tenant_id
      AND (
        COALESCE(jsonb_array_length(p_ast), 0) = 0
        OR NOT EXISTS (
            SELECT 1
            FROM jsonb_array_elements(p_ast) AS clause
            WHERE clause ->> 'kind' IN ('predicate', 'field_compare')
              AND NOT (
                CASE
                    WHEN clause ->> 'kind' = 'field_compare' THEN
                        CASE clause ->> 'operator'
                            WHEN 'FIELD_GT' THEN
                                CASE clause ->> 'left'
                                    WHEN 'purchase_price' THEN
                                        CASE clause ->> 'right'
                                            WHEN 'selling_price' THEN
                                                pcsr.purchase_price IS NOT NULL
                                                AND pcsr.selling_price IS NOT NULL
                                                AND pcsr.purchase_price > pcsr.selling_price
                                            ELSE FALSE
                                        END
                                    ELSE FALSE
                                END
                            WHEN 'FIELD_GTE' THEN
                                CASE clause ->> 'left'
                                    WHEN 'purchase_price' THEN
                                        CASE clause ->> 'right'
                                            WHEN 'selling_price' THEN
                                                pcsr.purchase_price IS NOT NULL
                                                AND pcsr.selling_price IS NOT NULL
                                                AND pcsr.purchase_price >= pcsr.selling_price
                                            ELSE FALSE
                                        END
                                    ELSE FALSE
                                END
                            WHEN 'FIELD_LT' THEN
                                CASE clause ->> 'left'
                                    WHEN 'purchase_price' THEN
                                        CASE clause ->> 'right'
                                            WHEN 'selling_price' THEN
                                                pcsr.purchase_price IS NOT NULL
                                                AND pcsr.selling_price IS NOT NULL
                                                AND pcsr.purchase_price < pcsr.selling_price
                                            ELSE FALSE
                                        END
                                    ELSE FALSE
                                END
                            WHEN 'FIELD_LTE' THEN
                                CASE clause ->> 'left'
                                    WHEN 'purchase_price' THEN
                                        CASE clause ->> 'right'
                                            WHEN 'selling_price' THEN
                                                pcsr.purchase_price IS NOT NULL
                                                AND pcsr.selling_price IS NOT NULL
                                                AND pcsr.purchase_price <= pcsr.selling_price
                                            ELSE FALSE
                                        END
                                    ELSE FALSE
                                END
                            ELSE FALSE
                        END
                    WHEN clause ->> 'kind' = 'predicate' THEN
                        CASE clause ->> 'field'
                            WHEN 'hsn_sac_code' THEN
                                pcsr.hsn_sac_code = (clause ->> 'value')
                            WHEN 'category_id' THEN
                                pcsr.category_id = (clause ->> 'value')::uuid
                            WHEN 'category_name' THEN
                                lower(pcsr.category_name) = lower(clause ->> 'value')
                            WHEN 'base_unit_of_measure' THEN
                                CASE clause ->> 'operator'
                                    WHEN 'IN' THEN lower(pcsr.base_unit_of_measure) = ANY (
                                        ARRAY(SELECT lower(jsonb_array_elements_text(clause -> 'value')))
                                    )
                                    ELSE lower(pcsr.base_unit_of_measure) = lower(clause ->> 'value')
                                END
                            WHEN 'created_at' THEN
                                CASE clause ->> 'operator'
                                    WHEN 'BETWEEN' THEN
                                        pcsr.created_at >= ((clause -> 'value' ->> 0)::timestamptz)
                                        AND pcsr.created_at <= ((clause -> 'value' ->> 1)::timestamptz)
                                    WHEN 'GTE' THEN pcsr.created_at >= (clause ->> 'value')::timestamptz
                                    WHEN 'LTE' THEN pcsr.created_at <= (clause ->> 'value')::timestamptz
                                    ELSE TRUE
                                END
                            WHEN 'name' THEN lower(pcsr.name) LIKE '%' || lower(clause ->> 'value') || '%'
                            WHEN 'default_sku' THEN lower(pcsr.default_sku) LIKE '%' || lower(clause ->> 'value') || '%'
                            ELSE TRUE
                        END
                    ELSE TRUE
                END
              )
        )
      );
END;
$$;

GRANT SELECT ON public.product_catalog_search_rows TO authenticated;
GRANT EXECUTE ON FUNCTION public.execute_product_filter(jsonb) TO authenticated;

COMMENT ON FUNCTION public.execute_product_filter IS
    'Parameterized native filter executor for product catalog AST clauses.';

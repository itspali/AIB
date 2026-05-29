-- Expose item active status in native product catalog search filters.

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
    i.is_active,
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
                            WHEN 'is_active' THEN
                                CASE clause ->> 'operator'
                                    WHEN 'EQ' THEN
                                        pcsr.is_active = CASE lower(clause ->> 'value')
                                            WHEN 'true' THEN TRUE
                                            WHEN 'false' THEN FALSE
                                            WHEN 'active' THEN TRUE
                                            WHEN 'inactive' THEN FALSE
                                            WHEN 'yes' THEN TRUE
                                            WHEN 'no' THEN FALSE
                                            ELSE COALESCE((clause ->> 'value')::boolean, FALSE)
                                        END
                                    ELSE TRUE
                                END
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
                            WHEN 'purchase_price' THEN
                                CASE clause ->> 'operator'
                                    WHEN 'GT' THEN
                                        pcsr.purchase_price IS NOT NULL
                                        AND pcsr.purchase_price > (clause ->> 'value')::numeric
                                    WHEN 'GTE' THEN
                                        pcsr.purchase_price IS NOT NULL
                                        AND pcsr.purchase_price >= (clause ->> 'value')::numeric
                                    WHEN 'LT' THEN
                                        pcsr.purchase_price IS NOT NULL
                                        AND pcsr.purchase_price < (clause ->> 'value')::numeric
                                    WHEN 'LTE' THEN
                                        pcsr.purchase_price IS NOT NULL
                                        AND pcsr.purchase_price <= (clause ->> 'value')::numeric
                                    WHEN 'BETWEEN' THEN
                                        pcsr.purchase_price IS NOT NULL
                                        AND pcsr.purchase_price >= ((clause -> 'value' ->> 0)::numeric)
                                        AND pcsr.purchase_price <= ((clause -> 'value' ->> 1)::numeric)
                                    ELSE TRUE
                                END
                            WHEN 'selling_price' THEN
                                CASE clause ->> 'operator'
                                    WHEN 'GT' THEN
                                        pcsr.selling_price IS NOT NULL
                                        AND pcsr.selling_price > (clause ->> 'value')::numeric
                                    WHEN 'GTE' THEN
                                        pcsr.selling_price IS NOT NULL
                                        AND pcsr.selling_price >= (clause ->> 'value')::numeric
                                    WHEN 'LT' THEN
                                        pcsr.selling_price IS NOT NULL
                                        AND pcsr.selling_price < (clause ->> 'value')::numeric
                                    WHEN 'LTE' THEN
                                        pcsr.selling_price IS NOT NULL
                                        AND pcsr.selling_price <= (clause ->> 'value')::numeric
                                    WHEN 'BETWEEN' THEN
                                        pcsr.selling_price IS NOT NULL
                                        AND pcsr.selling_price >= ((clause -> 'value' ->> 0)::numeric)
                                        AND pcsr.selling_price <= ((clause -> 'value' ->> 1)::numeric)
                                    ELSE TRUE
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
                            WHEN 'name' THEN
                                CASE clause ->> 'operator'
                                    WHEN 'ILIKE' THEN
                                        CASE
                                            WHEN (clause ->> 'value') LIKE '^%' THEN
                                                lower(pcsr.name) LIKE lower(substring(clause ->> 'value' from 2)) || '%'
                                            ELSE
                                                lower(pcsr.name) LIKE '%' || lower(clause ->> 'value') || '%'
                                        END
                                    WHEN 'EQ' THEN
                                        lower(pcsr.name) LIKE '%' || lower(clause ->> 'value') || '%'
                                    ELSE TRUE
                                END
                            WHEN 'default_sku' THEN
                                CASE clause ->> 'operator'
                                    WHEN 'ILIKE' THEN
                                        CASE
                                            WHEN (clause ->> 'value') LIKE '^%' THEN
                                                lower(pcsr.default_sku) LIKE lower(substring(clause ->> 'value' from 2)) || '%'
                                            ELSE
                                                lower(pcsr.default_sku) LIKE '%' || lower(clause ->> 'value') || '%'
                                        END
                                    WHEN 'EQ' THEN
                                        lower(pcsr.default_sku) LIKE '%' || lower(clause ->> 'value') || '%'
                                    ELSE TRUE
                                END
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

COMMENT ON FUNCTION public.execute_product_filter(jsonb) IS
    'Parameterized native filter executor for product catalog AST clauses.';

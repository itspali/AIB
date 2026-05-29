-- Fix field-compare filters to treat NULL prices as non-matching (not pass-through).

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

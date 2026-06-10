-- ====================================================================
-- Synthesize CGST/SGST/IGST from flat tax_codes.rate when components are missing
-- Migration: 20260617150000_purchase_order_line_tax_component_fallback.sql
-- ====================================================================

CREATE OR REPLACE FUNCTION private.resolve_line_tax(
    p_item_id UUID,
    p_qty NUMERIC,
    p_unit_price NUMERIC,
    p_discount_per_unit NUMERIC DEFAULT 0,
    p_price_tax_inclusive BOOLEAN DEFAULT NULL,
    p_tax_supply_nature TEXT DEFAULT 'INTERSTATE'
)
RETURNS TABLE (
    tax_code_id     UUID,
    rate            NUMERIC,
    is_inclusive    BOOLEAN,
    taxable_base    NUMERIC,
    tax_amount      NUMERIC,
    line_total      NUMERIC,
    tax_components  JSONB
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_tenant_id UUID;
    v_tax_code_id UUID;
    v_is_inclusive BOOLEAN := FALSE;
    v_is_variable BOOLEAN := FALSE;
    v_rate NUMERIC(7, 4) := 0;
    v_net_unit NUMERIC(15, 4);
    v_qty NUMERIC(15, 4);
    v_basis_value NUMERIC(15, 4);
    v_gross NUMERIC(15, 4);
    v_base NUMERIC(15, 4);
    v_tax NUMERIC(15, 4);
    v_rule RECORD;
    v_components JSONB := '[]'::jsonb;
    v_component_sum NUMERIC(15, 4) := 0;
    v_drift NUMERIC(15, 4) := 0;
    v_last_index INTEGER;
    v_last_amount NUMERIC(15, 4);
    v_cgst_amount NUMERIC(15, 4);
BEGIN
    v_tenant_id := private.current_tenant_id();
    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'tenant context missing from session';
    END IF;

    v_qty := GREATEST(COALESCE(p_qty, 0), 0);
    v_net_unit := GREATEST(COALESCE(p_unit_price, 0) - COALESCE(p_discount_per_unit, 0), 0);

    SELECT i.tax_code_id, COALESCE(i.price_is_tax_inclusive, FALSE)
    INTO v_tax_code_id, v_is_inclusive
    FROM public.items i
    WHERE i.id = p_item_id
      AND i.tenant_id = v_tenant_id;

    IF v_tax_code_id IS NOT NULL THEN
        SELECT tc.rate, COALESCE(tc.is_variable, FALSE),
               COALESCE(tc.is_inclusive_default, v_is_inclusive)
        INTO v_rate, v_is_variable, v_is_inclusive
        FROM public.tax_codes tc
        WHERE tc.id = v_tax_code_id
          AND tc.tenant_id = v_tenant_id
          AND tc.is_active = TRUE;

        IF NOT FOUND THEN
            v_tax_code_id := NULL;
            v_rate := 0;
            v_is_variable := FALSE;
        END IF;
    END IF;

    IF p_price_tax_inclusive IS NOT NULL THEN
        v_is_inclusive := p_price_tax_inclusive;
    END IF;

    IF v_tax_code_id IS NOT NULL AND v_is_variable THEN
        v_rate := 0;
        FOR v_rule IN
            SELECT basis, threshold_min, threshold_max, rate
            FROM public.tax_rate_rules
            WHERE tenant_id = v_tenant_id
              AND tax_code_id = v_tax_code_id
            ORDER BY threshold_min ASC
        LOOP
            v_basis_value := CASE upper(v_rule.basis)
                WHEN 'LINE_VALUE' THEN v_net_unit * v_qty
                WHEN 'QTY' THEN v_qty
                ELSE v_net_unit
            END;

            IF v_basis_value >= v_rule.threshold_min
               AND (v_rule.threshold_max IS NULL OR v_basis_value < v_rule.threshold_max) THEN
                v_rate := v_rule.rate;
                EXIT;
            END IF;
        END LOOP;
    END IF;

    v_gross := ROUND(v_net_unit * v_qty, 4);

    IF COALESCE(v_rate, 0) = 0 THEN
        v_base := v_gross;
        v_tax := 0;
    ELSIF v_is_inclusive THEN
        v_base := ROUND(v_gross / (1 + (v_rate / 100)), 4);
        v_tax := v_gross - v_base;
    ELSE
        v_base := v_gross;
        v_tax := ROUND(v_gross * (v_rate / 100), 4);
    END IF;

    IF v_tax > 0 AND COALESCE(v_rate, 0) > 0 THEN
        IF v_tax_code_id IS NOT NULL THEN
            SELECT COALESCE(
                jsonb_agg(
                    jsonb_build_object(
                        'name', tcc.name,
                        'rate', tcc.rate,
                        'amount', ROUND(v_base * tcc.rate / 100, 4)
                    )
                    ORDER BY tcc.sort_order, tcc.name
                ),
                '[]'::jsonb
            )
            INTO v_components
            FROM public.tax_code_components tcc
            WHERE tcc.tenant_id = v_tenant_id
              AND tcc.tax_code_id = v_tax_code_id
              AND private.tax_component_matches_supply(tcc.name, p_tax_supply_nature);
        END IF;

        IF jsonb_array_length(v_components) = 0 THEN
            IF upper(trim(COALESCE(p_tax_supply_nature, ''))) = 'INTRASTATE' THEN
                v_cgst_amount := ROUND(v_base * v_rate / 200, 4);
                v_components := jsonb_build_array(
                    jsonb_build_object(
                        'name', 'CGST',
                        'rate', ROUND(v_rate / 2, 4),
                        'amount', v_cgst_amount
                    ),
                    jsonb_build_object(
                        'name', 'SGST',
                        'rate', ROUND(v_rate / 2, 4),
                        'amount', ROUND(v_tax - v_cgst_amount, 4)
                    )
                );
            ELSE
                v_components := jsonb_build_array(
                    jsonb_build_object(
                        'name', 'IGST',
                        'rate', v_rate,
                        'amount', v_tax
                    )
                );
            END IF;
        ELSE
            SELECT COALESCE(
                SUM((entry.value ->> 'amount')::NUMERIC),
                0
            )
            INTO v_component_sum
            FROM jsonb_array_elements(v_components) AS entry(value);

            v_drift := ROUND(v_tax - v_component_sum, 4);
            v_last_index := jsonb_array_length(v_components) - 1;

            IF v_drift <> 0 AND v_last_index >= 0 THEN
                v_last_amount := COALESCE(
                    (v_components -> v_last_index ->> 'amount')::NUMERIC,
                    0
                );
                v_components := jsonb_set(
                    v_components,
                    ARRAY[v_last_index::TEXT, 'amount'],
                    to_jsonb(ROUND(v_last_amount + v_drift, 4)),
                    FALSE
                );
            END IF;
        END IF;
    END IF;

    tax_code_id := v_tax_code_id;
    rate := v_rate;
    is_inclusive := v_is_inclusive;
    taxable_base := v_base;
    tax_amount := v_tax;
    line_total := CASE WHEN v_is_inclusive THEN v_gross ELSE v_base + v_tax END;
    tax_components := v_components;
    RETURN NEXT;
END;
$$;

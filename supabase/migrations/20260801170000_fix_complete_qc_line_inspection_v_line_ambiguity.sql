-- Fix ambiguous v_line reference in complete_qc_line_inspection (PL/pgSQL variable vs SQL alias).

CREATE OR REPLACE FUNCTION public.complete_qc_line_inspection(
    p_goods_receipt_item_id UUID,
    p_quantity_released NUMERIC,
    p_quantity_failed NUMERIC DEFAULT 0,
    p_failed_disposition public.grn_reject_disposition DEFAULT 'SCRAP',
    p_notes TEXT DEFAULT NULL,
    p_result_lines JSONB DEFAULT '[]'::jsonb,
    p_inspected_by UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_tenant_id UUID;
    v_gri public.goods_receipt_items%ROWTYPE;
    v_qc_row public.qc_inventory_balances%ROWTYPE;
    v_inspection_id UUID;
    v_overall public.qc_parameter_result;
    v_result_entry JSONB;
    v_has_mandatory_fail BOOLEAN := FALSE;
    v_release JSONB;
BEGIN
    v_tenant_id := private.current_tenant_id();
    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'tenant context missing from session';
    END IF;

    SELECT * INTO v_gri
    FROM public.goods_receipt_items
    WHERE id = p_goods_receipt_item_id AND tenant_id = v_tenant_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'goods receipt line not found';
    END IF;

    SELECT * INTO v_qc_row
    FROM public.qc_inventory_balances
    WHERE tenant_id = v_tenant_id AND goods_receipt_item_id = p_goods_receipt_item_id;

    IF jsonb_array_length(COALESCE(p_result_lines, '[]'::jsonb)) > 0 THEN
        FOR v_result_entry IN
            SELECT value FROM jsonb_array_elements(COALESCE(p_result_lines, '[]'::jsonb))
        LOOP
            IF COALESCE(v_result_entry ->> 'is_mandatory', 'false')::boolean
               AND COALESCE(v_result_entry ->> 'result', 'NA') = 'FAIL'
            THEN
                v_has_mandatory_fail := TRUE;
            END IF;
        END LOOP;
    END IF;

    IF COALESCE(p_quantity_failed, 0) > 0 THEN
        v_overall := 'FAIL';
    ELSIF v_has_mandatory_fail THEN
        v_overall := 'FAIL';
    ELSIF COALESCE(p_quantity_released, 0) > 0 THEN
        v_overall := 'PASS';
    ELSE
        v_overall := 'NA';
    END IF;

    INSERT INTO public.qc_inspections (
        tenant_id,
        goods_receipt_id,
        goods_receipt_item_id,
        qc_inventory_balance_id,
        status,
        overall_result,
        pass_quantity,
        reject_quantity,
        reject_disposition,
        notes,
        inspected_by
    )
    VALUES (
        v_tenant_id,
        v_gri.goods_receipt_id,
        v_gri.id,
        v_qc_row.id,
        'COMPLETED',
        v_overall,
        GREATEST(COALESCE(p_quantity_released, 0), 0),
        GREATEST(COALESCE(p_quantity_failed, 0), 0),
        CASE WHEN COALESCE(p_quantity_failed, 0) > 0 THEN p_failed_disposition ELSE NULL END,
        NULLIF(trim(COALESCE(p_notes, '')), ''),
        p_inspected_by
    )
    RETURNING id INTO v_inspection_id;

    IF jsonb_array_length(COALESCE(p_result_lines, '[]'::jsonb)) > 0 THEN
        INSERT INTO public.qc_inspection_result_lines (
            tenant_id,
            inspection_id,
            parameter_id,
            parameter_name,
            parameter_type,
            min_value,
            max_value,
            expected_text,
            choice_options,
            measured_value,
            result,
            sort_order
        )
        SELECT
            v_tenant_id,
            v_inspection_id,
            NULLIF(result_line.value ->> 'parameter_id', '')::uuid,
            COALESCE(result_line.value ->> 'parameter_name', 'Parameter'),
            COALESCE(result_line.value ->> 'parameter_type', 'TEXT')::public.qc_test_parameter_type,
            NULLIF(result_line.value ->> 'min_value', '')::numeric,
            NULLIF(result_line.value ->> 'max_value', '')::numeric,
            NULLIF(result_line.value ->> 'expected_text', ''),
            COALESCE(result_line.value -> 'choice_options', '[]'::jsonb),
            NULLIF(result_line.value ->> 'measured_value', ''),
            COALESCE(result_line.value ->> 'result', 'NA')::public.qc_parameter_result,
            COALESCE((result_line.value ->> 'sort_order')::int, 0)
        FROM jsonb_array_elements(COALESCE(p_result_lines, '[]'::jsonb)) AS result_line(value);
    END IF;

    v_release := public.release_goods_receipt_line_from_qc(
        p_goods_receipt_item_id,
        p_quantity_released,
        p_quantity_failed,
        p_failed_disposition,
        p_inspected_by
    );

    RETURN jsonb_build_object(
        'inspection_id', v_inspection_id,
        'overall_result', v_overall,
        'release', v_release
    );
END;
$$;

REVOKE ALL ON FUNCTION public.complete_qc_line_inspection(UUID, NUMERIC, NUMERIC, public.grn_reject_disposition, TEXT, JSONB, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_qc_line_inspection(UUID, NUMERIC, NUMERIC, public.grn_reject_disposition, TEXT, JSONB, UUID) TO authenticated;

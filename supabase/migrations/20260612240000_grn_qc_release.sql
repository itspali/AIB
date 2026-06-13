-- GRN quality inspection release: clear QC pending flag and normalize ledger references

CREATE OR REPLACE FUNCTION public.release_goods_receipt_from_qc(
    p_goods_receipt_id UUID,
    p_released_by UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_tenant_id UUID;
    v_gr public.goods_receipts%ROWTYPE;
    v_quarantine_ref TEXT;
    v_steps JSONB := '[]'::jsonb;
    v_updated_ledger INTEGER := 0;
BEGIN
    v_tenant_id := private.current_tenant_id();
    IF v_tenant_id IS NULL THEN RAISE EXCEPTION 'tenant context missing from session'; END IF;
    IF p_goods_receipt_id IS NULL THEN RAISE EXCEPTION 'goods receipt id is required'; END IF;

    SELECT * INTO v_gr
    FROM public.goods_receipts
    WHERE id = p_goods_receipt_id AND tenant_id = v_tenant_id
    FOR UPDATE;

    IF NOT FOUND THEN RAISE EXCEPTION 'goods receipt not found'; END IF;

    IF NOT COALESCE(v_gr.is_qc_pending, FALSE) THEN
        RAISE EXCEPTION 'goods receipt is not awaiting quality inspection';
    END IF;

    v_quarantine_ref := v_gr.voucher_number || '|QC-QUARANTINE';

    UPDATE public.inventory_ledger il
    SET reference_document = v_gr.voucher_number
    WHERE il.tenant_id = v_tenant_id
      AND il.reference_document = v_quarantine_ref
      AND EXISTS (
          SELECT 1
          FROM public.goods_receipt_items gri
          WHERE gri.goods_receipt_id = p_goods_receipt_id
            AND gri.tenant_id = v_tenant_id
            AND gri.item_id = il.item_id
            AND gri.variant_id IS NOT DISTINCT FROM il.variant_id
      );

    GET DIAGNOSTICS v_updated_ledger = ROW_COUNT;

    UPDATE public.goods_receipts
    SET is_qc_pending = FALSE,
        updated_at = NOW()
    WHERE id = p_goods_receipt_id;

    v_steps := private.append_posting_step(
        v_steps,
        'grn_qc_released',
        'success',
        CASE WHEN v_updated_ledger > 0 THEN v_updated_ledger::TEXT ELSE NULL END
    );

    INSERT INTO public.document_posting_runs (
        tenant_id, document_type, document_id, overall_status, steps, posted_by
    )
    VALUES (
        v_tenant_id,
        'GRN'::public.document_posting_document_type,
        p_goods_receipt_id,
        'success',
        v_steps,
        p_released_by
    );

    RETURN jsonb_build_object(
        'goods_receipt_id', p_goods_receipt_id,
        'ledger_rows_updated', v_updated_ledger,
        'steps', v_steps
    );
END;
$$;

REVOKE ALL ON FUNCTION public.release_goods_receipt_from_qc(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.release_goods_receipt_from_qc(UUID, UUID) TO authenticated;

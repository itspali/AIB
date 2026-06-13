-- Fix QC release: inventory_ledger is append-only; clear GRN header flag only.

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
    v_steps JSONB := '[]'::jsonb;
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

    UPDATE public.goods_receipts
    SET is_qc_pending = FALSE,
        updated_at = NOW()
    WHERE id = p_goods_receipt_id;

    v_steps := private.append_posting_step(v_steps, 'grn_qc_released', 'success', NULL);

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
        'steps', v_steps
    );
END;
$$;

REVOKE ALL ON FUNCTION public.release_goods_receipt_from_qc(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.release_goods_receipt_from_qc(UUID, UUID) TO authenticated;

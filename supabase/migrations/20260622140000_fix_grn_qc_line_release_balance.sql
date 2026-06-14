-- Fix partial QC release: never UPDATE quantity_on_hand to 0 (CHECK requires > 0),
-- reduce hold by both pass and reject, and backfill missing QC hold rows on apply.

CREATE OR REPLACE FUNCTION public.release_goods_receipt_line_from_qc(
    p_goods_receipt_item_id UUID,
    p_quantity_released NUMERIC,
    p_quantity_failed NUMERIC DEFAULT 0,
    p_failed_disposition public.grn_reject_disposition DEFAULT 'SCRAP',
    p_released_by UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_tenant_id UUID;
    v_row public.qc_inventory_balances%ROWTYPE;
    v_gr public.goods_receipts%ROWTYPE;
    v_gri public.goods_receipt_items%ROWTYPE;
    v_release NUMERIC(15, 4);
    v_fail NUMERIC(15, 4);
    v_new_hold NUMERIC(15, 4);
    v_steps JSONB := '[]'::jsonb;
BEGIN
    v_tenant_id := private.current_tenant_id();
    IF v_tenant_id IS NULL THEN RAISE EXCEPTION 'tenant context missing from session'; END IF;
    IF p_goods_receipt_item_id IS NULL THEN RAISE EXCEPTION 'goods receipt item id is required'; END IF;

    v_release := GREATEST(COALESCE(p_quantity_released, 0), 0);
    v_fail := GREATEST(COALESCE(p_quantity_failed, 0), 0);
    IF v_release <= 0 AND v_fail <= 0 THEN RAISE EXCEPTION 'release or fail quantity required'; END IF;

    SELECT * INTO v_row
    FROM public.qc_inventory_balances
    WHERE tenant_id = v_tenant_id AND goods_receipt_item_id = p_goods_receipt_item_id
    FOR UPDATE;

    IF NOT FOUND THEN
        SELECT * INTO v_gri
        FROM public.goods_receipt_items
        WHERE id = p_goods_receipt_item_id AND tenant_id = v_tenant_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'goods receipt line not found';
        END IF;

        IF NOT COALESCE(v_gri.route_to_qc, FALSE) THEN
            RAISE EXCEPTION 'line is not routed to quality inspection';
        END IF;

        IF GREATEST(COALESCE(v_gri.quantity_accepted, 0), 0) <= 0 THEN
            RAISE EXCEPTION 'no accepted quantity on line for QC release';
        END IF;

        SELECT * INTO v_gr FROM public.goods_receipts WHERE id = v_gri.goods_receipt_id;

        PERFORM private.upsert_qc_inventory_balance(
            v_tenant_id,
            v_gr.destination_location_id,
            v_gri.item_id,
            v_gri.variant_id,
            v_gri.goods_receipt_id,
            v_gri.id,
            GREATEST(COALESCE(v_gri.quantity_accepted, 0), 0),
            v_gri.total_final_landed_cost
        );

        SELECT * INTO v_row
        FROM public.qc_inventory_balances
        WHERE tenant_id = v_tenant_id AND goods_receipt_item_id = p_goods_receipt_item_id
        FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'QC hold row not found for line';
        END IF;
    END IF;

    IF v_release + v_fail > v_row.quantity_on_hand + 0.0001 THEN
        RAISE EXCEPTION 'release plus failed exceeds QC hold quantity';
    END IF;

    SELECT * INTO v_gr FROM public.goods_receipts WHERE id = v_row.goods_receipt_id;

    IF v_release > 0 THEN
        INSERT INTO public.inventory_ledger (
            tenant_id, item_id, variant_id, location_id,
            transaction_type, quantity, cost_at_transaction,
            reference_document, created_by
        )
        VALUES (
            v_tenant_id, v_row.item_id, v_row.variant_id, v_row.location_id,
            'PURCHASE_RECEIPT', v_release, v_row.unit_cost,
            v_gr.voucher_number || '|QC-RELEASED', COALESCE(p_released_by, v_gr.created_by)
        );
    END IF;

    IF v_fail > 0 THEN
        UPDATE public.goods_receipt_items
        SET quantity_rejected = quantity_rejected + v_fail,
            reject_disposition = COALESCE(p_failed_disposition, reject_disposition, 'SCRAP'::public.grn_reject_disposition),
            updated_at = NOW()
        WHERE id = p_goods_receipt_item_id AND tenant_id = v_tenant_id;
    END IF;

    v_new_hold := v_row.quantity_on_hand - v_release - v_fail;

    IF v_new_hold <= 0.0001 THEN
        DELETE FROM public.qc_inventory_balances WHERE id = v_row.id;
    ELSE
        UPDATE public.qc_inventory_balances
        SET quantity_on_hand = v_new_hold,
            updated_at = NOW()
        WHERE id = v_row.id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.qc_inventory_balances
        WHERE tenant_id = v_tenant_id AND goods_receipt_id = v_row.goods_receipt_id AND quantity_on_hand > 0
    ) THEN
        UPDATE public.goods_receipts SET is_qc_pending = FALSE, updated_at = NOW()
        WHERE id = v_row.goods_receipt_id;
    END IF;

    v_steps := private.append_posting_step(
        v_steps, 'grn_qc_released', 'success',
        v_release::TEXT || ' released' || CASE WHEN v_fail > 0 THEN ', ' || v_fail::TEXT || ' failed' ELSE '' END
    );

    INSERT INTO public.document_posting_runs (
        tenant_id, document_type, document_id, overall_status, steps, posted_by
    )
    VALUES (
        v_tenant_id, 'GRN'::public.document_posting_document_type, v_row.goods_receipt_id,
        'success', v_steps, p_released_by
    );

    RETURN jsonb_build_object('goods_receipt_item_id', p_goods_receipt_item_id, 'steps', v_steps);
END;
$$;

REVOKE ALL ON FUNCTION public.release_goods_receipt_line_from_qc(UUID, NUMERIC, NUMERIC, public.grn_reject_disposition, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.release_goods_receipt_line_from_qc(UUID, NUMERIC, NUMERIC, public.grn_reject_disposition, UUID) TO authenticated;

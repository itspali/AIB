-- QC Design A: hold paid receipt qty in qc_inventory_balances until inspection release posts to MWAC.

CREATE TABLE IF NOT EXISTS public.qc_inventory_balances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    location_id UUID NOT NULL REFERENCES public.tenant_locations(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
    variant_id UUID REFERENCES public.item_variants(id) ON DELETE SET NULL,
    goods_receipt_id UUID NOT NULL REFERENCES public.goods_receipts(id) ON DELETE CASCADE,
    goods_receipt_item_id UUID NOT NULL REFERENCES public.goods_receipt_items(id) ON DELETE CASCADE,
    quantity_on_hand NUMERIC(15, 4) NOT NULL CHECK (quantity_on_hand > 0),
    unit_cost NUMERIC(15, 4) NOT NULL CHECK (unit_cost >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, goods_receipt_item_id)
);

CREATE INDEX IF NOT EXISTS qc_inventory_balances_tenant_gr_idx
    ON public.qc_inventory_balances (tenant_id, goods_receipt_id);

ALTER TABLE public.qc_inventory_balances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS qc_inventory_balances_tenant_isolation ON public.qc_inventory_balances;
CREATE POLICY qc_inventory_balances_tenant_isolation ON public.qc_inventory_balances
    FOR ALL TO authenticated
    USING (tenant_id = private.current_tenant_id())
    WITH CHECK (tenant_id = private.current_tenant_id());

CREATE OR REPLACE FUNCTION private.upsert_qc_inventory_balance(
    p_tenant_id UUID,
    p_location_id UUID,
    p_item_id UUID,
    p_variant_id UUID,
    p_goods_receipt_id UUID,
    p_goods_receipt_item_id UUID,
    p_quantity NUMERIC,
    p_unit_cost NUMERIC
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
BEGIN
    IF p_quantity IS NULL OR p_quantity <= 0 THEN
        RETURN;
    END IF;

    INSERT INTO public.qc_inventory_balances (
        tenant_id,
        location_id,
        item_id,
        variant_id,
        goods_receipt_id,
        goods_receipt_item_id,
        quantity_on_hand,
        unit_cost
    )
    VALUES (
        p_tenant_id,
        p_location_id,
        p_item_id,
        p_variant_id,
        p_goods_receipt_id,
        p_goods_receipt_item_id,
        p_quantity,
        COALESCE(p_unit_cost, 0)
    )
    ON CONFLICT (tenant_id, goods_receipt_item_id)
    DO UPDATE SET
        quantity_on_hand = public.qc_inventory_balances.quantity_on_hand + EXCLUDED.quantity_on_hand,
        unit_cost = EXCLUDED.unit_cost,
        updated_at = NOW();
END;
$$;

CREATE OR REPLACE FUNCTION public.goods_receipt_items_post_stocking()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_gr public.goods_receipts%ROWTYPE;
    v_qc_required BOOLEAN;
    v_stock_qty NUMERIC(15, 4);
    v_quarantine public.promo_quarantine_type;
BEGIN
    SELECT * INTO v_gr
    FROM public.goods_receipts
    WHERE id = NEW.goods_receipt_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'goods receipt % not found for line item', NEW.goods_receipt_id;
    END IF;

    v_qc_required := private.get_procurement_control_flag(NEW.tenant_id, 'is_qc_required_before_stocking');

    v_stock_qty := CASE
        WHEN COALESCE(NEW.quantity_accepted, 0) > 0 THEN NEW.quantity_accepted
        ELSE NEW.quantity_received
    END;

    IF v_stock_qty <= 0 THEN
        RETURN NEW;
    END IF;

    IF NEW.is_promotional OR (v_gr.purchase_order_id IS NULL AND NEW.raw_unit_cost = 0) THEN
        v_quarantine := CASE
            WHEN v_gr.purchase_order_id IS NULL THEN 'NOT_FOR_RESALE_SAMPLE'::public.promo_quarantine_type
            ELSE 'PROMOTIONAL_HOLD'::public.promo_quarantine_type
        END;

        PERFORM private.upsert_promo_inventory_balance(
            NEW.tenant_id,
            v_gr.destination_location_id,
            NEW.item_id,
            NEW.variant_id,
            v_quarantine,
            v_stock_qty,
            NEW.entitlement_id
        );

        RETURN NEW;
    END IF;

    IF v_qc_required THEN
        PERFORM private.upsert_qc_inventory_balance(
            NEW.tenant_id,
            v_gr.destination_location_id,
            NEW.item_id,
            NEW.variant_id,
            v_gr.id,
            NEW.id,
            v_stock_qty,
            NEW.total_final_landed_cost
        );

        INSERT INTO public.item_variant_locations (
            tenant_id, item_id, variant_id, location_id, is_stocked, is_sellable, is_orderable
        )
        VALUES (NEW.tenant_id, NEW.item_id, NEW.variant_id, v_gr.destination_location_id, TRUE, FALSE, FALSE)
        ON CONFLICT (variant_id, location_id)
        DO UPDATE SET is_stocked = TRUE, is_sellable = FALSE, is_orderable = FALSE, updated_at = NOW();

        RETURN NEW;
    END IF;

    INSERT INTO public.inventory_ledger (
        tenant_id,
        item_id,
        variant_id,
        location_id,
        transaction_type,
        quantity,
        cost_at_transaction,
        reference_document,
        created_by
    )
    VALUES (
        NEW.tenant_id,
        NEW.item_id,
        NEW.variant_id,
        v_gr.destination_location_id,
        'PURCHASE_RECEIPT',
        v_stock_qty,
        NEW.total_final_landed_cost,
        v_gr.voucher_number,
        v_gr.created_by
    );

    INSERT INTO public.item_variant_locations (
        tenant_id, item_id, variant_id, location_id, is_stocked, is_sellable, is_orderable
    )
    VALUES (NEW.tenant_id, NEW.item_id, NEW.variant_id, v_gr.destination_location_id, TRUE, TRUE, TRUE)
    ON CONFLICT (variant_id, location_id)
    DO UPDATE SET is_stocked = TRUE, is_sellable = TRUE, is_orderable = TRUE, updated_at = NOW();

    RETURN NEW;
END;
$$;

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
    v_row public.qc_inventory_balances%ROWTYPE;
    v_steps JSONB := '[]'::jsonb;
    v_released_qty NUMERIC(15, 4) := 0;
    v_released_lines INTEGER := 0;
    v_legacy_only BOOLEAN := FALSE;
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

    FOR v_row IN
        SELECT *
        FROM public.qc_inventory_balances
        WHERE tenant_id = v_tenant_id
          AND goods_receipt_id = p_goods_receipt_id
          AND quantity_on_hand > 0
        FOR UPDATE
    LOOP
        INSERT INTO public.inventory_ledger (
            tenant_id,
            item_id,
            variant_id,
            location_id,
            transaction_type,
            quantity,
            cost_at_transaction,
            reference_document,
            created_by
        )
        VALUES (
            v_tenant_id,
            v_row.item_id,
            v_row.variant_id,
            v_row.location_id,
            'PURCHASE_RECEIPT',
            v_row.quantity_on_hand,
            v_row.unit_cost,
            v_gr.voucher_number || '|QC-RELEASED',
            COALESCE(p_released_by, v_gr.created_by)
        );

        INSERT INTO public.item_variant_locations (
            tenant_id, item_id, variant_id, location_id, is_stocked, is_sellable, is_orderable
        )
        VALUES (
            v_tenant_id, v_row.item_id, v_row.variant_id, v_row.location_id, TRUE, TRUE, TRUE
        )
        ON CONFLICT (variant_id, location_id)
        DO UPDATE SET is_stocked = TRUE, is_sellable = TRUE, is_orderable = TRUE, updated_at = NOW();

        v_released_qty := v_released_qty + v_row.quantity_on_hand;
        v_released_lines := v_released_lines + 1;

        DELETE FROM public.qc_inventory_balances WHERE id = v_row.id;
    END LOOP;

    IF v_released_lines = 0 THEN
        v_legacy_only := EXISTS (
            SELECT 1
            FROM public.inventory_ledger il
            WHERE il.tenant_id = v_tenant_id
              AND il.reference_document = v_gr.voucher_number || '|QC-QUARANTINE'
        );

        IF NOT v_legacy_only THEN
            RAISE EXCEPTION 'no QC hold balances found for this goods receipt';
        END IF;
    END IF;

    UPDATE public.goods_receipts
    SET is_qc_pending = FALSE,
        updated_at = NOW()
    WHERE id = p_goods_receipt_id;

    v_steps := private.append_posting_step(
        v_steps,
        'grn_qc_released',
        'success',
        CASE
            WHEN v_released_lines > 0 THEN v_released_qty::TEXT || ' units · ' || v_released_lines::TEXT || ' line(s)'
            ELSE 'legacy receipt cleared'
        END
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
        'released_quantity', v_released_qty,
        'released_lines', v_released_lines,
        'legacy_only', v_legacy_only,
        'steps', v_steps
    );
END;
$$;

REVOKE ALL ON FUNCTION public.release_goods_receipt_from_qc(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.release_goods_receipt_from_qc(UUID, UUID) TO authenticated;

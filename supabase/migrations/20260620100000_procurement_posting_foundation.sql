-- ====================================================================
-- Procurement posting foundation: audit tables, enum extensions, MWAC cost restatement
-- Migration: 20260620100000_procurement_posting_foundation.sql
-- ====================================================================

ALTER TYPE public.inventory_transaction_type ADD VALUE IF NOT EXISTS 'COST_RESTATEMENT';
ALTER TYPE public.inventory_transaction_type ADD VALUE IF NOT EXISTS 'COST_CORRECTION';

CREATE TYPE public.document_posting_document_type AS ENUM ('PO', 'GRN', 'BILL');

CREATE TABLE IF NOT EXISTS public.document_posting_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    document_type public.document_posting_document_type NOT NULL,
    document_id UUID NOT NULL,
    overall_status TEXT NOT NULL CHECK (overall_status IN ('success', 'failure')),
    steps JSONB NOT NULL DEFAULT '[]'::jsonb,
    posted_by UUID,
    posted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS document_posting_runs_tenant_doc_idx
    ON public.document_posting_runs (tenant_id, document_type, document_id, posted_at DESC);

CREATE TABLE IF NOT EXISTS public.inventory_valuation_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    location_id UUID NOT NULL REFERENCES public.tenant_locations(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
    variant_id UUID REFERENCES public.item_variants(id) ON DELETE SET NULL,
    step_id TEXT,
    transaction_type public.inventory_transaction_type,
    quantity_before NUMERIC(15, 4),
    quantity_after NUMERIC(15, 4),
    cost_before NUMERIC(15, 4),
    cost_after NUMERIC(15, 4),
    reference_document TEXT,
    document_type public.document_posting_document_type,
    document_id UUID,
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS inventory_valuation_audit_log_tenant_doc_idx
    ON public.inventory_valuation_audit_log (tenant_id, document_type, document_id, created_at DESC);

ALTER TABLE public.document_posting_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_valuation_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY document_posting_runs_tenant_isolation ON public.document_posting_runs
    FOR ALL USING (tenant_id = private.current_tenant_id())
    WITH CHECK (tenant_id = private.current_tenant_id());

CREATE POLICY inventory_valuation_audit_log_tenant_isolation ON public.inventory_valuation_audit_log
    FOR ALL USING (tenant_id = private.current_tenant_id())
    WITH CHECK (tenant_id = private.current_tenant_id());

CREATE OR REPLACE FUNCTION private.append_posting_step(
    p_steps JSONB,
    p_id TEXT,
    p_status TEXT,
    p_detail TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT COALESCE(p_steps, '[]'::jsonb) || jsonb_build_array(
        jsonb_build_object(
            'id', p_id,
            'status', p_status,
            'detail', CASE WHEN p_detail IS NULL OR btrim(p_detail) = '' THEN NULL ELSE p_detail END
        )
    );
$$;

CREATE OR REPLACE FUNCTION private.record_valuation_audit(
    p_tenant_id UUID,
    p_location_id UUID,
    p_item_id UUID,
    p_variant_id UUID,
    p_step_id TEXT,
    p_transaction_type public.inventory_transaction_type,
    p_quantity_before NUMERIC,
    p_quantity_after NUMERIC,
    p_cost_before NUMERIC,
    p_cost_after NUMERIC,
    p_reference_document TEXT,
    p_document_type public.document_posting_document_type,
    p_document_id UUID,
    p_created_by UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
BEGIN
    INSERT INTO public.inventory_valuation_audit_log (
        tenant_id, location_id, item_id, variant_id, step_id, transaction_type,
        quantity_before, quantity_after, cost_before, cost_after,
        reference_document, document_type, document_id, created_by
    ) VALUES (
        p_tenant_id, p_location_id, p_item_id, p_variant_id, p_step_id, p_transaction_type,
        p_quantity_before, p_quantity_after, p_cost_before, p_cost_after,
        p_reference_document, p_document_type, p_document_id, p_created_by
    );
END;
$$;

CREATE OR REPLACE FUNCTION private.money_round(p_value NUMERIC)
RETURNS NUMERIC(15, 4)
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT ROUND(COALESCE(p_value, 0), 4)::NUMERIC(15, 4);
$$;

CREATE OR REPLACE FUNCTION public.fetch_document_posting_runs(
    p_document_type public.document_posting_document_type,
    p_document_id UUID
)
RETURNS SETOF public.document_posting_runs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_tenant_id UUID;
BEGIN
    v_tenant_id := private.current_tenant_id();
    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'tenant context missing from session';
    END IF;

    RETURN QUERY
    SELECT *
    FROM public.document_posting_runs
    WHERE tenant_id = v_tenant_id
      AND document_type = p_document_type
      AND document_id = p_document_id
    ORDER BY posted_at DESC;
END;
$$;

-- MWAC: allow quantity = 0 with cost update for COST_RESTATEMENT rows
CREATE OR REPLACE FUNCTION private.inventory_ledger_apply_mwac_core(
    p_tenant_id UUID,
    p_location_id UUID,
    p_item_id UUID,
    p_variant_id UUID,
    p_quantity NUMERIC,
    p_cost_at_transaction NUMERIC
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_existing_qty NUMERIC(15, 4);
    v_existing_cost NUMERIC(15, 4);
    v_new_avg NUMERIC(15, 4);
    v_new_qty NUMERIC(15, 4);
BEGIN
    IF p_quantity = 0 THEN
        IF p_cost_at_transaction IS NOT NULL AND p_cost_at_transaction >= 0 THEN
            UPDATE public.item_valuations
            SET current_average_cost = private.money_round(p_cost_at_transaction),
                updated_at = NOW()
            WHERE tenant_id = p_tenant_id
              AND location_id = p_location_id
              AND item_id = p_item_id
              AND variant_id IS NOT DISTINCT FROM p_variant_id;

            IF NOT FOUND THEN
                INSERT INTO public.item_valuations (
                    tenant_id, location_id, item_id, variant_id,
                    current_average_cost, total_quantity_on_hand
                )
                VALUES (
                    p_tenant_id, p_location_id, p_item_id, p_variant_id,
                    private.money_round(p_cost_at_transaction), 0.0000
                );
            END IF;
        END IF;
        RETURN;
    END IF;

    IF p_quantity < 0 THEN
        UPDATE public.item_valuations
        SET total_quantity_on_hand = GREATEST(total_quantity_on_hand + p_quantity, 0.0000),
            updated_at = NOW()
        WHERE tenant_id = p_tenant_id
          AND location_id = p_location_id
          AND item_id = p_item_id
          AND variant_id IS NOT DISTINCT FROM p_variant_id;

        IF NOT FOUND THEN
            INSERT INTO public.item_valuations (
                tenant_id, location_id, item_id, variant_id,
                current_average_cost, total_quantity_on_hand
            )
            VALUES (
                p_tenant_id, p_location_id, p_item_id, p_variant_id,
                0.0000, 0.0000
            );
        END IF;
        RETURN;
    END IF;

    SELECT current_average_cost, total_quantity_on_hand
    INTO v_existing_cost, v_existing_qty
    FROM public.item_valuations
    WHERE tenant_id = p_tenant_id
      AND location_id = p_location_id
      AND item_id = p_item_id
      AND variant_id IS NOT DISTINCT FROM p_variant_id
    FOR UPDATE;

    IF NOT FOUND THEN
        INSERT INTO public.item_valuations (
            tenant_id, location_id, item_id, variant_id,
            current_average_cost, total_quantity_on_hand
        )
        VALUES (
            p_tenant_id, p_location_id, p_item_id, p_variant_id,
            private.money_round(p_cost_at_transaction), p_quantity
        );
        RETURN;
    END IF;

    IF v_existing_qty + p_quantity = 0 THEN
        v_new_avg := 0.0000;
        v_new_qty := 0.0000;
    ELSE
        v_new_qty := v_existing_qty + p_quantity;
        v_new_avg := private.money_round(
            ((v_existing_qty * v_existing_cost) + (p_quantity * p_cost_at_transaction)) / v_new_qty
        );
    END IF;

    UPDATE public.item_valuations
    SET current_average_cost = v_new_avg,
        total_quantity_on_hand = v_new_qty,
        updated_at = NOW()
    WHERE tenant_id = p_tenant_id
      AND location_id = p_location_id
      AND item_id = p_item_id
      AND variant_id IS NOT DISTINCT FROM p_variant_id;
END;
$$;

REVOKE ALL ON FUNCTION public.fetch_document_posting_runs(public.document_posting_document_type, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fetch_document_posting_runs(public.document_posting_document_type, UUID) TO authenticated;

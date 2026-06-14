-- ====================================================================
-- Activity events: append-only forensic projection + timeline read model
-- Migration: 20260624100000_activity_events_foundation.sql
-- ====================================================================

CREATE TYPE public.activity_entity_type AS ENUM (
    'PURCHASE_ORDER',
    'GOODS_RECEIPT',
    'PURCHASE_INVOICE',
    'GOODS_IN_TRANSIT',
    'STOCK_ADJUSTMENT',
    'STOCK_TRANSFER',
    'SALES_ORDER',
    'SALES_INVOICE'
);

CREATE TABLE public.activity_events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
    entity_type     public.activity_entity_type NOT NULL,
    entity_id       UUID NOT NULL,
    event_kind      TEXT NOT NULL,
    event_code      TEXT NOT NULL,
    title           TEXT NOT NULL,
    detail          JSONB NOT NULL DEFAULT '{}'::jsonb,
    actor_id        UUID REFERENCES public.users (id) ON DELETE SET NULL,
    occurred_at     TIMESTAMPTZ NOT NULL,
    source_kind     TEXT,
    source_id       UUID,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX activity_events_entity_timeline_idx
    ON public.activity_events (tenant_id, entity_type, entity_id, occurred_at DESC);

CREATE UNIQUE INDEX activity_events_source_dedup_idx
    ON public.activity_events (tenant_id, source_kind, source_id)
    WHERE source_kind IS NOT NULL AND source_id IS NOT NULL;

CREATE TABLE public.activity_event_outbox (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
    entity_type     public.activity_entity_type NOT NULL,
    entity_id       UUID NOT NULL,
    event_kind      TEXT NOT NULL,
    event_code      TEXT NOT NULL,
    payload         JSONB NOT NULL DEFAULT '{}'::jsonb,
    actor_id        UUID REFERENCES public.users (id) ON DELETE SET NULL,
    occurred_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    enqueued_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at    TIMESTAMPTZ
);

CREATE INDEX activity_event_outbox_pending_idx
    ON public.activity_event_outbox (enqueued_at)
    WHERE processed_at IS NULL;

ALTER TABLE public.activity_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_event_outbox ENABLE ROW LEVEL SECURITY;

CREATE POLICY activity_events_tenant_select
    ON public.activity_events
    FOR SELECT
    TO authenticated
    USING (tenant_id = (SELECT private.current_tenant_id()));

CREATE POLICY activity_event_outbox_tenant_select
    ON public.activity_event_outbox
    FOR SELECT
    TO authenticated
    USING (tenant_id = (SELECT private.current_tenant_id()));

REVOKE INSERT, UPDATE, DELETE ON public.activity_events FROM PUBLIC, anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.activity_event_outbox FROM PUBLIC, anon, authenticated;

REVOKE UPDATE, DELETE ON public.document_posting_runs FROM PUBLIC, anon, authenticated;
REVOKE UPDATE, DELETE ON public.document_approvals FROM PUBLIC, anon, authenticated;
REVOKE UPDATE, DELETE ON public.inventory_valuation_audit_log FROM PUBLIC, anon, authenticated;

-- --------------------------------------------------------------------
-- Core projection helpers
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.map_posting_document_type(
    p_document_type public.document_posting_document_type
)
RETURNS public.activity_entity_type
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT CASE p_document_type
        WHEN 'PO' THEN 'PURCHASE_ORDER'::public.activity_entity_type
        WHEN 'GRN' THEN 'GOODS_RECEIPT'::public.activity_entity_type
        WHEN 'BILL' THEN 'PURCHASE_INVOICE'::public.activity_entity_type
    END;
$$;

CREATE OR REPLACE FUNCTION private.activity_dominant_step_code(p_steps JSONB)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    v_step JSONB;
BEGIN
    IF p_steps IS NULL OR jsonb_typeof(p_steps) <> 'array' THEN
        RETURN 'posting_run';
    END IF;

    FOR v_step IN SELECT value FROM jsonb_array_elements(p_steps)
    LOOP
        IF v_step ->> 'status' = 'success' AND NULLIF(btrim(v_step ->> 'id'), '') IS NOT NULL THEN
            RETURN v_step ->> 'id';
        END IF;
    END LOOP;

    FOR v_step IN SELECT value FROM jsonb_array_elements(p_steps)
    LOOP
        IF NULLIF(btrim(v_step ->> 'id'), '') IS NOT NULL THEN
            RETURN v_step ->> 'id';
        END IF;
    END LOOP;

    RETURN 'posting_run';
END;
$$;

CREATE OR REPLACE FUNCTION private.activity_event_title(
    p_event_code TEXT,
    p_event_kind TEXT,
    p_detail JSONB DEFAULT '{}'::jsonb
)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
    RETURN CASE p_event_code
        WHEN 'created' THEN 'Document created'
        WHEN 'linked' THEN 'Bill linked to goods receipt'
        WHEN 'po_submitted_for_approval' THEN 'Submitted for approval'
        WHEN 'po_approved' THEN 'Approval granted'
        WHEN 'po_rejected' THEN 'Approval rejected'
        WHEN 'po_status_issued' THEN 'Order sent to supplier'
        WHEN 'grn_receipt_recorded' THEN 'Receipt recorded'
        WHEN 'grn_qc_released' THEN 'QC hold released'
        WHEN 'bill_invoice_recorded' THEN 'Bill recorded'
        WHEN 'bill_voided' THEN 'Bill voided'
        WHEN 'vendor_payment_posted' THEN 'Payment posted'
        WHEN 'bill_advance_applied' THEN 'Vendor advance applied'
        WHEN 'status_changed' THEN
            COALESCE(
                'Status changed to ' || NULLIF(p_detail ->> 'new_status', ''),
                'Status updated'
            )
        WHEN 'paid' THEN 'Marked as paid'
        WHEN 'valuation_changed' THEN 'Inventory valuation updated'
        WHEN 'promo_entitlement' THEN 'Promotional entitlement updated'
        WHEN 'posting_run' THEN 'Posting completed'
        ELSE replace(initcap(replace(p_event_code, '_', ' ')), 'Po ', 'PO ')
    END;
END;
$$;

CREATE OR REPLACE FUNCTION private.insert_activity_event(
    p_tenant_id UUID,
    p_entity_type public.activity_entity_type,
    p_entity_id UUID,
    p_event_kind TEXT,
    p_event_code TEXT,
    p_title TEXT DEFAULT NULL,
    p_detail JSONB DEFAULT '{}'::jsonb,
    p_actor_id UUID DEFAULT NULL,
    p_occurred_at TIMESTAMPTZ DEFAULT NOW(),
    p_source_kind TEXT DEFAULT NULL,
    p_source_id UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
BEGIN
    INSERT INTO public.activity_events (
        tenant_id,
        entity_type,
        entity_id,
        event_kind,
        event_code,
        title,
        detail,
        actor_id,
        occurred_at,
        source_kind,
        source_id
    )
    VALUES (
        p_tenant_id,
        p_entity_type,
        p_entity_id,
        p_event_kind,
        p_event_code,
        COALESCE(
            NULLIF(btrim(p_title), ''),
            private.activity_event_title(p_event_code, p_event_kind, p_detail)
        ),
        COALESCE(p_detail, '{}'::jsonb),
        p_actor_id,
        COALESCE(p_occurred_at, NOW()),
        p_source_kind,
        p_source_id
    )
    ON CONFLICT (tenant_id, source_kind, source_id)
    WHERE source_kind IS NOT NULL AND source_id IS NOT NULL
    DO NOTHING;
END;
$$;

-- --------------------------------------------------------------------
-- Outbox drain (also invoked per-row after enqueue)
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.process_activity_outbox_row(p_outbox_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_row public.activity_event_outbox%ROWTYPE;
    v_title TEXT;
BEGIN
    SELECT * INTO v_row
    FROM public.activity_event_outbox
    WHERE id = p_outbox_id
      AND processed_at IS NULL
    FOR UPDATE SKIP LOCKED;

    IF NOT FOUND THEN
        RETURN;
    END IF;

    v_title := private.activity_event_title(v_row.event_code, v_row.event_kind, v_row.payload);

    PERFORM private.insert_activity_event(
        v_row.tenant_id,
        v_row.entity_type,
        v_row.entity_id,
        v_row.event_kind,
        v_row.event_code,
        v_title,
        v_row.payload,
        v_row.actor_id,
        v_row.occurred_at,
        'outbox',
        v_row.id
    );

    UPDATE public.activity_event_outbox
    SET processed_at = NOW()
    WHERE id = v_row.id;
END;
$$;

CREATE OR REPLACE FUNCTION private.drain_activity_event_outbox(p_limit INT DEFAULT 100)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_row RECORD;
    v_count INT := 0;
BEGIN
    FOR v_row IN
        SELECT id
        FROM public.activity_event_outbox
        WHERE processed_at IS NULL
        ORDER BY enqueued_at
        LIMIT GREATEST(COALESCE(p_limit, 100), 1)
        FOR UPDATE SKIP LOCKED
    LOOP
        PERFORM private.process_activity_outbox_row(v_row.id);
        v_count := v_count + 1;
    END LOOP;

    RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION private.enqueue_activity_outbox(
    p_tenant_id UUID,
    p_entity_type public.activity_entity_type,
    p_entity_id UUID,
    p_event_kind TEXT,
    p_event_code TEXT,
    p_payload JSONB,
    p_actor_id UUID,
    p_occurred_at TIMESTAMPTZ DEFAULT NOW()
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_id UUID;
BEGIN
    INSERT INTO public.activity_event_outbox (
        tenant_id,
        entity_type,
        entity_id,
        event_kind,
        event_code,
        payload,
        actor_id,
        occurred_at
    )
    VALUES (
        p_tenant_id,
        p_entity_type,
        p_entity_id,
        p_event_kind,
        p_event_code,
        COALESCE(p_payload, '{}'::jsonb),
        p_actor_id,
        COALESCE(p_occurred_at, NOW())
    )
    RETURNING id INTO v_id;

    PERFORM private.process_activity_outbox_row(v_id);
    RETURN v_id;
END;
$$;

-- --------------------------------------------------------------------
-- Source registry triggers
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.trg_activity_from_posting_run()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_entity_type public.activity_entity_type;
    v_event_code TEXT;
    v_event_kind TEXT := 'posted';
BEGIN
    v_entity_type := private.map_posting_document_type(NEW.document_type);
    v_event_code := private.activity_dominant_step_code(NEW.steps);

    IF v_event_code IN ('po_submitted_for_approval', 'po_approved', 'po_rejected') THEN
        RETURN NEW;
    END IF;

    PERFORM private.insert_activity_event(
        NEW.tenant_id,
        v_entity_type,
        NEW.document_id,
        v_event_kind,
        v_event_code,
        NULL,
        jsonb_build_object(
            'overall_status', NEW.overall_status,
            'steps', NEW.steps
        ),
        NEW.posted_by,
        NEW.posted_at,
        'posting_run',
        NEW.id
    );

    RETURN NEW;
END;
$$;

CREATE TRIGGER document_posting_runs_activity_projection
    AFTER INSERT ON public.document_posting_runs
    FOR EACH ROW
    EXECUTE FUNCTION private.trg_activity_from_posting_run();

CREATE OR REPLACE FUNCTION private.trg_activity_from_document_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_entity_type public.activity_entity_type;
BEGIN
    IF NEW.document_type = 'PURCHASE_ORDER' THEN
        IF EXISTS (
            SELECT 1
            FROM public.document_approval_requests dar
            WHERE dar.tenant_id = NEW.tenant_id
              AND dar.document_type = 'PURCHASE_ORDER'
              AND dar.document_id = NEW.document_id
              AND dar.status = 'APPROVED'
        ) THEN
            RETURN NEW;
        END IF;
        v_entity_type := 'PURCHASE_ORDER'::public.activity_entity_type;
    ELSE
        RETURN NEW;
    END IF;

    PERFORM private.insert_activity_event(
        NEW.tenant_id,
        v_entity_type,
        NEW.document_id,
        'approved',
        'po_approved',
        NULL,
        jsonb_build_object('notes', NEW.notes),
        NEW.approved_by,
        NEW.approved_at,
        'document_approval',
        NEW.id
    );

    RETURN NEW;
END;
$$;

CREATE TRIGGER document_approvals_activity_projection
    AFTER INSERT ON public.document_approvals
    FOR EACH ROW
    EXECUTE FUNCTION private.trg_activity_from_document_approval();

CREATE OR REPLACE FUNCTION private.trg_activity_from_invoice_receipt_link()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
BEGIN
    PERFORM private.insert_activity_event(
        NEW.tenant_id,
        'PURCHASE_INVOICE'::public.activity_entity_type,
        NEW.purchase_invoice_id,
        'linked',
        'linked',
        NULL,
        jsonb_build_object('goods_receipt_id', NEW.goods_receipt_id),
        NEW.linked_by,
        NEW.linked_at,
        'purchase_invoice_receipt_bill',
        NEW.goods_receipt_id
    );

    PERFORM private.insert_activity_event(
        NEW.tenant_id,
        'GOODS_RECEIPT'::public.activity_entity_type,
        NEW.goods_receipt_id,
        'linked',
        'linked',
        NULL,
        jsonb_build_object('purchase_invoice_id', NEW.purchase_invoice_id),
        NEW.linked_by,
        NEW.linked_at,
        'purchase_invoice_receipt_grn',
        NEW.purchase_invoice_id
    );

    RETURN NEW;
END;
$$;

CREATE TRIGGER purchase_invoice_receipts_activity_projection
    AFTER INSERT ON public.purchase_invoice_receipts
    FOR EACH ROW
    EXECUTE FUNCTION private.trg_activity_from_invoice_receipt_link();

CREATE OR REPLACE FUNCTION private.trg_activity_header_created()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_entity_type public.activity_entity_type;
    v_actor UUID;
BEGIN
    v_entity_type := CASE TG_TABLE_NAME
        WHEN 'purchase_orders' THEN 'PURCHASE_ORDER'::public.activity_entity_type
        WHEN 'goods_receipts' THEN 'GOODS_RECEIPT'::public.activity_entity_type
        WHEN 'purchase_invoices' THEN 'PURCHASE_INVOICE'::public.activity_entity_type
        WHEN 'stock_adjustments' THEN 'STOCK_ADJUSTMENT'::public.activity_entity_type
        WHEN 'stock_transfers' THEN 'STOCK_TRANSFER'::public.activity_entity_type
        WHEN 'goods_in_transit_vouchers' THEN 'GOODS_IN_TRANSIT'::public.activity_entity_type
        WHEN 'sales_orders' THEN 'SALES_ORDER'::public.activity_entity_type
        WHEN 'sales_invoices' THEN 'SALES_INVOICE'::public.activity_entity_type
        ELSE NULL
    END;

    IF v_entity_type IS NULL THEN
        RETURN NEW;
    END IF;

    v_actor := NEW.created_by;

    PERFORM private.insert_activity_event(
        NEW.tenant_id,
        v_entity_type,
        NEW.id,
        'created',
        'created',
        NULL,
        '{}'::jsonb,
        v_actor,
        NEW.created_at,
        TG_TABLE_NAME || '_header',
        NEW.id
    );

    RETURN NEW;
END;
$$;

CREATE TRIGGER purchase_orders_activity_created
    AFTER INSERT ON public.purchase_orders
    FOR EACH ROW
    EXECUTE FUNCTION private.trg_activity_header_created();

CREATE TRIGGER goods_receipts_activity_created
    AFTER INSERT ON public.goods_receipts
    FOR EACH ROW
    EXECUTE FUNCTION private.trg_activity_header_created();

CREATE TRIGGER purchase_invoices_activity_created
    AFTER INSERT ON public.purchase_invoices
    FOR EACH ROW
    EXECUTE FUNCTION private.trg_activity_header_created();

CREATE TRIGGER stock_adjustments_activity_created
    AFTER INSERT ON public.stock_adjustments
    FOR EACH ROW
    EXECUTE FUNCTION private.trg_activity_header_created();

CREATE TRIGGER stock_transfers_activity_created
    AFTER INSERT ON public.stock_transfers
    FOR EACH ROW
    EXECUTE FUNCTION private.trg_activity_header_created();

CREATE TRIGGER goods_in_transit_vouchers_activity_created
    AFTER INSERT ON public.goods_in_transit_vouchers
    FOR EACH ROW
    EXECUTE FUNCTION private.trg_activity_header_created();

CREATE TRIGGER sales_orders_activity_created
    AFTER INSERT ON public.sales_orders
    FOR EACH ROW
    EXECUTE FUNCTION private.trg_activity_header_created();

CREATE TRIGGER sales_invoices_activity_created
    AFTER INSERT ON public.sales_invoices
    FOR EACH ROW
    EXECUTE FUNCTION private.trg_activity_header_created();

-- --------------------------------------------------------------------
-- Outbox triggers for status transitions
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.trg_activity_approval_request_outbox()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_event_kind TEXT;
    v_event_code TEXT;
BEGIN
    IF TG_OP = 'INSERT' AND NEW.status = 'PENDING' THEN
        v_event_kind := 'submitted';
        v_event_code := 'po_submitted_for_approval';
        PERFORM private.enqueue_activity_outbox(
            NEW.tenant_id,
            'PURCHASE_ORDER'::public.activity_entity_type,
            NEW.document_id,
            v_event_kind,
            v_event_code,
            jsonb_build_object('decision_notes', NEW.decision_notes),
            NEW.submitted_by,
            NEW.submitted_at
        );
        RETURN NEW;
    END IF;

    IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
        IF NEW.status = 'APPROVED' THEN
            v_event_kind := 'approved';
            v_event_code := 'po_approved';
        ELSIF NEW.status = 'REJECTED' THEN
            v_event_kind := 'rejected';
            v_event_code := 'po_rejected';
        ELSE
            RETURN NEW;
        END IF;

        PERFORM private.enqueue_activity_outbox(
            NEW.tenant_id,
            'PURCHASE_ORDER'::public.activity_entity_type,
            NEW.document_id,
            v_event_kind,
            v_event_code,
            jsonb_build_object('decision_notes', NEW.decision_notes),
            NEW.decided_by,
            COALESCE(NEW.decided_at, NOW())
        );
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER document_approval_requests_activity_outbox
    AFTER INSERT OR UPDATE OF status ON public.document_approval_requests
    FOR EACH ROW
    EXECUTE FUNCTION private.trg_activity_approval_request_outbox();

CREATE OR REPLACE FUNCTION private.trg_activity_po_status_outbox()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
BEGIN
    IF NEW.document_status IS NOT DISTINCT FROM OLD.document_status THEN
        RETURN NEW;
    END IF;

    PERFORM private.enqueue_activity_outbox(
        NEW.tenant_id,
        'PURCHASE_ORDER'::public.activity_entity_type,
        NEW.id,
        'status_changed',
        'status_changed',
        jsonb_build_object(
            'old_status', OLD.document_status::text,
            'new_status', NEW.document_status::text
        ),
        COALESCE(auth.uid(), NEW.created_by),
        NOW()
    );

    RETURN NEW;
END;
$$;

CREATE TRIGGER purchase_orders_activity_status_outbox
    AFTER UPDATE OF document_status ON public.purchase_orders
    FOR EACH ROW
    EXECUTE FUNCTION private.trg_activity_po_status_outbox();

CREATE OR REPLACE FUNCTION private.trg_activity_transfer_status_outbox()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
BEGIN
    IF NEW.current_status IS NOT DISTINCT FROM OLD.current_status THEN
        RETURN NEW;
    END IF;

    PERFORM private.enqueue_activity_outbox(
        NEW.tenant_id,
        'STOCK_TRANSFER'::public.activity_entity_type,
        NEW.id,
        'status_changed',
        'status_changed',
        jsonb_build_object(
            'old_status', OLD.current_status::text,
            'new_status', NEW.current_status::text
        ),
        COALESCE(auth.uid(), NEW.created_by),
        COALESCE(NEW.received_at, NEW.dispatched_at, NOW())
    );

    RETURN NEW;
END;
$$;

CREATE TRIGGER stock_transfers_activity_status_outbox
    AFTER UPDATE OF current_status ON public.stock_transfers
    FOR EACH ROW
    EXECUTE FUNCTION private.trg_activity_transfer_status_outbox();

CREATE OR REPLACE FUNCTION private.trg_activity_bill_status_outbox()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
BEGIN
    IF TG_OP = 'UPDATE' THEN
        IF NEW.document_status IS DISTINCT FROM OLD.document_status
           AND NEW.document_status = 'CANCELLED'
        THEN
            PERFORM private.enqueue_activity_outbox(
                NEW.tenant_id,
                'PURCHASE_INVOICE'::public.activity_entity_type,
                NEW.id,
                'voided',
                'bill_voided',
                jsonb_build_object('old_status', OLD.document_status, 'new_status', NEW.document_status),
                COALESCE(auth.uid(), NEW.created_by),
                NOW()
            );
        END IF;

        IF NEW.is_paid IS DISTINCT FROM OLD.is_paid AND NEW.is_paid THEN
            PERFORM private.enqueue_activity_outbox(
                NEW.tenant_id,
                'PURCHASE_INVOICE'::public.activity_entity_type,
                NEW.id,
                'payment',
                'paid',
                '{}'::jsonb,
                COALESCE(auth.uid(), NEW.created_by),
                NOW()
            );
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER purchase_invoices_activity_status_outbox
    AFTER UPDATE OF document_status, is_paid ON public.purchase_invoices
    FOR EACH ROW
    EXECUTE FUNCTION private.trg_activity_bill_status_outbox();

CREATE OR REPLACE FUNCTION private.trg_activity_from_promo_entitlement_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_po_id UUID;
BEGIN
    SELECT pfe.purchase_order_id
    INTO v_po_id
    FROM public.promo_fulfillment_entitlements pfe
    WHERE pfe.id = NEW.entitlement_id;

    IF v_po_id IS NULL THEN
        RETURN NEW;
    END IF;

    PERFORM private.insert_activity_event(
        NEW.tenant_id,
        'PURCHASE_ORDER'::public.activity_entity_type,
        v_po_id,
        'posted',
        'promo_entitlement',
        NULL,
        jsonb_build_object(
            'event_type', NEW.event_type,
            'entitlement_id', NEW.entitlement_id,
            'goods_receipt_id', NEW.goods_receipt_id,
            'prior_status', NEW.prior_status,
            'new_status', NEW.new_status,
            'detail', NEW.detail
        ),
        NEW.created_by,
        NEW.created_at,
        'promo_entitlement_event',
        NEW.id
    );

    IF NEW.goods_receipt_id IS NOT NULL THEN
        PERFORM private.insert_activity_event(
            NEW.tenant_id,
            'GOODS_RECEIPT'::public.activity_entity_type,
            NEW.goods_receipt_id,
            'posted',
            'promo_entitlement',
            NULL,
            jsonb_build_object(
                'event_type', NEW.event_type,
                'entitlement_id', NEW.entitlement_id,
                'purchase_order_id', v_po_id
            ),
            NEW.created_by,
            NEW.created_at,
            'promo_entitlement_event_grn',
            NEW.id
        );
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER promo_entitlement_events_activity_projection
    AFTER INSERT ON public.promo_entitlement_events
    FOR EACH ROW
    EXECUTE FUNCTION private.trg_activity_from_promo_entitlement_event();

-- --------------------------------------------------------------------
-- Read RPC
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fetch_entity_activity_timeline(
    p_entity_type public.activity_entity_type,
    p_entity_id UUID,
    p_limit INT DEFAULT 50,
    p_before TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    event_kind TEXT,
    event_code TEXT,
    title TEXT,
    detail JSONB,
    actor_id UUID,
    actor_name TEXT,
    occurred_at TIMESTAMPTZ
)
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
    SELECT
        ae.id,
        ae.event_kind,
        ae.event_code,
        ae.title,
        ae.detail,
        ae.actor_id,
        NULLIF(btrim(concat_ws(' ', u.first_name, u.last_name)), '') AS actor_name,
        ae.occurred_at
    FROM public.activity_events ae
    LEFT JOIN public.users u ON u.id = ae.actor_id
    WHERE ae.tenant_id = v_tenant_id
      AND ae.entity_type = p_entity_type
      AND ae.entity_id = p_entity_id
      AND (p_before IS NULL OR ae.occurred_at < p_before)
    ORDER BY ae.occurred_at DESC, ae.id DESC
    LIMIT GREATEST(LEAST(COALESCE(p_limit, 50), 100), 1);
END;
$$;

REVOKE ALL ON FUNCTION public.fetch_entity_activity_timeline(
    public.activity_entity_type, UUID, INT, TIMESTAMPTZ
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fetch_entity_activity_timeline(
    public.activity_entity_type, UUID, INT, TIMESTAMPTZ
) TO authenticated;

REVOKE ALL ON FUNCTION private.drain_activity_event_outbox(INT) FROM PUBLIC;

-- ====================================================================
-- Backfill activity_events from existing forensic sources (idempotent)
-- Migration: 20260624110000_activity_events_backfill.sql
-- ====================================================================

-- Purchase orders created
INSERT INTO public.activity_events (
    tenant_id, entity_type, entity_id, event_kind, event_code, title, detail,
    actor_id, occurred_at, source_kind, source_id
)
SELECT
    po.tenant_id,
    'PURCHASE_ORDER'::public.activity_entity_type,
    po.id,
    'created',
    'created',
    private.activity_event_title('created', 'created', '{}'::jsonb),
    '{}'::jsonb,
    po.created_by,
    po.created_at,
    'purchase_orders_header',
    po.id
FROM public.purchase_orders po
ON CONFLICT (tenant_id, source_kind, source_id)
WHERE source_kind IS NOT NULL AND source_id IS NOT NULL
DO NOTHING;

INSERT INTO public.activity_events (
    tenant_id, entity_type, entity_id, event_kind, event_code, title, detail,
    actor_id, occurred_at, source_kind, source_id
)
SELECT
    gr.tenant_id,
    'GOODS_RECEIPT'::public.activity_entity_type,
    gr.id,
    'created',
    'created',
    private.activity_event_title('created', 'created', '{}'::jsonb),
    '{}'::jsonb,
    gr.created_by,
    gr.created_at,
    'goods_receipts_header',
    gr.id
FROM public.goods_receipts gr
ON CONFLICT (tenant_id, source_kind, source_id)
WHERE source_kind IS NOT NULL AND source_id IS NOT NULL
DO NOTHING;

INSERT INTO public.activity_events (
    tenant_id, entity_type, entity_id, event_kind, event_code, title, detail,
    actor_id, occurred_at, source_kind, source_id
)
SELECT
    pi.tenant_id,
    'PURCHASE_INVOICE'::public.activity_entity_type,
    pi.id,
    'created',
    'created',
    private.activity_event_title('created', 'created', '{}'::jsonb),
    '{}'::jsonb,
    pi.created_by,
    pi.created_at,
    'purchase_invoices_header',
    pi.id
FROM public.purchase_invoices pi
ON CONFLICT (tenant_id, source_kind, source_id)
WHERE source_kind IS NOT NULL AND source_id IS NOT NULL
DO NOTHING;

INSERT INTO public.activity_events (
    tenant_id, entity_type, entity_id, event_kind, event_code, title, detail,
    actor_id, occurred_at, source_kind, source_id
)
SELECT
    sa.tenant_id,
    'STOCK_ADJUSTMENT'::public.activity_entity_type,
    sa.id,
    'created',
    'created',
    private.activity_event_title('created', 'created', '{}'::jsonb),
    '{}'::jsonb,
    sa.created_by,
    sa.created_at,
    'stock_adjustments_header',
    sa.id
FROM public.stock_adjustments sa
ON CONFLICT (tenant_id, source_kind, source_id)
WHERE source_kind IS NOT NULL AND source_id IS NOT NULL
DO NOTHING;

INSERT INTO public.activity_events (
    tenant_id, entity_type, entity_id, event_kind, event_code, title, detail,
    actor_id, occurred_at, source_kind, source_id
)
SELECT
    st.tenant_id,
    'STOCK_TRANSFER'::public.activity_entity_type,
    st.id,
    'created',
    'created',
    private.activity_event_title('created', 'created', '{}'::jsonb),
    '{}'::jsonb,
    st.created_by,
    st.created_at,
    'stock_transfers_header',
    st.id
FROM public.stock_transfers st
ON CONFLICT (tenant_id, source_kind, source_id)
WHERE source_kind IS NOT NULL AND source_id IS NOT NULL
DO NOTHING;

INSERT INTO public.activity_events (
    tenant_id, entity_type, entity_id, event_kind, event_code, title, detail,
    actor_id, occurred_at, source_kind, source_id
)
SELECT
    git.tenant_id,
    'GOODS_IN_TRANSIT'::public.activity_entity_type,
    git.id,
    'created',
    'created',
    private.activity_event_title('created', 'created', '{}'::jsonb),
    '{}'::jsonb,
    git.created_by,
    git.created_at,
    'goods_in_transit_vouchers_header',
    git.id
FROM public.goods_in_transit_vouchers git
ON CONFLICT (tenant_id, source_kind, source_id)
WHERE source_kind IS NOT NULL AND source_id IS NOT NULL
DO NOTHING;

INSERT INTO public.activity_events (
    tenant_id, entity_type, entity_id, event_kind, event_code, title, detail,
    actor_id, occurred_at, source_kind, source_id
)
SELECT
    so.tenant_id,
    'SALES_ORDER'::public.activity_entity_type,
    so.id,
    'created',
    'created',
    private.activity_event_title('created', 'created', '{}'::jsonb),
    '{}'::jsonb,
    so.created_by,
    so.created_at,
    'sales_orders_header',
    so.id
FROM public.sales_orders so
ON CONFLICT (tenant_id, source_kind, source_id)
WHERE source_kind IS NOT NULL AND source_id IS NOT NULL
DO NOTHING;

INSERT INTO public.activity_events (
    tenant_id, entity_type, entity_id, event_kind, event_code, title, detail,
    actor_id, occurred_at, source_kind, source_id
)
SELECT
    si.tenant_id,
    'SALES_INVOICE'::public.activity_entity_type,
    si.id,
    'created',
    'created',
    private.activity_event_title('created', 'created', '{}'::jsonb),
    '{}'::jsonb,
    si.created_by,
    si.created_at,
    'sales_invoices_header',
    si.id
FROM public.sales_invoices si
ON CONFLICT (tenant_id, source_kind, source_id)
WHERE source_kind IS NOT NULL AND source_id IS NOT NULL
DO NOTHING;

-- Posting runs (skip workflow codes handled by approval requests)
INSERT INTO public.activity_events (
    tenant_id, entity_type, entity_id, event_kind, event_code, title, detail,
    actor_id, occurred_at, source_kind, source_id
)
SELECT
    dpr.tenant_id,
    private.map_posting_document_type(dpr.document_type),
    dpr.document_id,
    'posted',
    private.activity_dominant_step_code(dpr.steps),
    private.activity_event_title(
        private.activity_dominant_step_code(dpr.steps),
        'posted',
        jsonb_build_object('overall_status', dpr.overall_status, 'steps', dpr.steps)
    ),
    jsonb_build_object('overall_status', dpr.overall_status, 'steps', dpr.steps),
    dpr.posted_by,
    dpr.posted_at,
    'posting_run',
    dpr.id
FROM public.document_posting_runs dpr
WHERE private.activity_dominant_step_code(dpr.steps) NOT IN (
    'po_submitted_for_approval', 'po_approved', 'po_rejected'
)
ON CONFLICT (tenant_id, source_kind, source_id)
WHERE source_kind IS NOT NULL AND source_id IS NOT NULL
DO NOTHING;

-- Approval workflow (submit + final decision as separate forensic rows)
INSERT INTO public.activity_events (
    tenant_id, entity_type, entity_id, event_kind, event_code, title, detail,
    actor_id, occurred_at, source_kind, source_id
)
SELECT
    dar.tenant_id,
    'PURCHASE_ORDER'::public.activity_entity_type,
    dar.document_id,
    'submitted',
    'po_submitted_for_approval',
    private.activity_event_title(
        'po_submitted_for_approval',
        'submitted',
        jsonb_build_object('decision_notes', dar.decision_notes)
    ),
    jsonb_build_object('decision_notes', dar.decision_notes),
    dar.submitted_by,
    dar.submitted_at,
    'document_approval_request_submit',
    dar.id
FROM public.document_approval_requests dar
ON CONFLICT (tenant_id, source_kind, source_id)
WHERE source_kind IS NOT NULL AND source_id IS NOT NULL
DO NOTHING;

INSERT INTO public.activity_events (
    tenant_id, entity_type, entity_id, event_kind, event_code, title, detail,
    actor_id, occurred_at, source_kind, source_id
)
SELECT
    dar.tenant_id,
    'PURCHASE_ORDER'::public.activity_entity_type,
    dar.document_id,
    'approved',
    'po_approved',
    private.activity_event_title(
        'po_approved',
        'approved',
        jsonb_build_object('decision_notes', dar.decision_notes)
    ),
    jsonb_build_object('decision_notes', dar.decision_notes),
    dar.decided_by,
    COALESCE(dar.decided_at, dar.updated_at),
    'document_approval_request_approved',
    dar.id
FROM public.document_approval_requests dar
WHERE dar.status = 'APPROVED'
ON CONFLICT (tenant_id, source_kind, source_id)
WHERE source_kind IS NOT NULL AND source_id IS NOT NULL
DO NOTHING;

INSERT INTO public.activity_events (
    tenant_id, entity_type, entity_id, event_kind, event_code, title, detail,
    actor_id, occurred_at, source_kind, source_id
)
SELECT
    dar.tenant_id,
    'PURCHASE_ORDER'::public.activity_entity_type,
    dar.document_id,
    'rejected',
    'po_rejected',
    private.activity_event_title(
        'po_rejected',
        'rejected',
        jsonb_build_object('decision_notes', dar.decision_notes)
    ),
    jsonb_build_object('decision_notes', dar.decision_notes),
    dar.decided_by,
    COALESCE(dar.decided_at, dar.updated_at),
    'document_approval_request_rejected',
    dar.id
FROM public.document_approval_requests dar
WHERE dar.status = 'REJECTED'
ON CONFLICT (tenant_id, source_kind, source_id)
WHERE source_kind IS NOT NULL AND source_id IS NOT NULL
DO NOTHING;

-- Bill ↔ GRN links
INSERT INTO public.activity_events (
    tenant_id, entity_type, entity_id, event_kind, event_code, title, detail,
    actor_id, occurred_at, source_kind, source_id
)
SELECT
    pir.tenant_id,
    'PURCHASE_INVOICE'::public.activity_entity_type,
    pir.purchase_invoice_id,
    'linked',
    'linked',
    private.activity_event_title('linked', 'linked', '{}'::jsonb),
    jsonb_build_object('goods_receipt_id', pir.goods_receipt_id),
    pir.linked_by,
    pir.linked_at,
    'purchase_invoice_receipt_bill',
    pir.goods_receipt_id
FROM public.purchase_invoice_receipts pir
ON CONFLICT (tenant_id, source_kind, source_id)
WHERE source_kind IS NOT NULL AND source_id IS NOT NULL
DO NOTHING;

INSERT INTO public.activity_events (
    tenant_id, entity_type, entity_id, event_kind, event_code, title, detail,
    actor_id, occurred_at, source_kind, source_id
)
SELECT
    pir.tenant_id,
    'GOODS_RECEIPT'::public.activity_entity_type,
    pir.goods_receipt_id,
    'linked',
    'linked',
    private.activity_event_title('linked', 'linked', '{}'::jsonb),
    jsonb_build_object('purchase_invoice_id', pir.purchase_invoice_id),
    pir.linked_by,
    pir.linked_at,
    'purchase_invoice_receipt_grn',
    pir.purchase_invoice_id
FROM public.purchase_invoice_receipts pir
ON CONFLICT (tenant_id, source_kind, source_id)
WHERE source_kind IS NOT NULL AND source_id IS NOT NULL
DO NOTHING;

-- Optional pg_cron drain for stranded outbox rows
DO $cron$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
        PERFORM cron.unschedule(jobid)
        FROM cron.job
        WHERE jobname = 'drain-activity-event-outbox';

        PERFORM cron.schedule(
            'drain-activity-event-outbox',
            '30 seconds',
            $job$SELECT private.drain_activity_event_outbox(200)$job$
        );
    END IF;
EXCEPTION
    WHEN undefined_table THEN
        NULL;
    WHEN undefined_function THEN
        NULL;
    WHEN OTHERS THEN
        RAISE NOTICE 'pg_cron schedule skipped: %', SQLERRM;
END;
$cron$;

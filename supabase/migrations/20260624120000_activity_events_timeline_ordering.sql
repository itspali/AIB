-- ====================================================================
-- Activity timeline ordering: wall-clock timestamps + monotonic sequence
-- Migration: 20260624120000_activity_events_timeline_ordering.sql
-- ====================================================================

-- Workflow rank: higher = later in the business lifecycle (tie-breaker when clocks match)
CREATE OR REPLACE FUNCTION private.activity_event_workflow_rank(
    p_event_code TEXT,
    p_event_kind TEXT
)
RETURNS INT
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT CASE p_event_code
        WHEN 'created' THEN 100
        WHEN 'po_submitted_for_approval' THEN 200
        WHEN 'po_rejected' THEN 250
        WHEN 'po_approved' THEN 300
        WHEN 'status_changed' THEN 350
        WHEN 'po_status_issued' THEN 400
        WHEN 'po_promo_commitments_created' THEN 410
        WHEN 'po_receipt_eligibility_opened' THEN 420
        WHEN 'grn_receipt_recorded' THEN 400
        WHEN 'grn_paid_stock_valued' THEN 410
        WHEN 'grn_qc_released' THEN 450
        WHEN 'bill_invoice_recorded' THEN 400
        WHEN 'bill_voided' THEN 500
        WHEN 'paid' THEN 450
        WHEN 'vendor_payment_posted' THEN 460
        WHEN 'bill_advance_applied' THEN 440
        WHEN 'linked' THEN 430
        WHEN 'promo_entitlement' THEN 440
        WHEN 'valuation_changed' THEN 440
        WHEN 'posting_run' THEN 450
        ELSE CASE p_event_kind
            WHEN 'created' THEN 100
            WHEN 'submitted' THEN 200
            WHEN 'rejected' THEN 250
            WHEN 'approved' THEN 300
            WHEN 'status_changed' THEN 350
            WHEN 'posted' THEN 400
            WHEN 'linked' THEN 430
            WHEN 'voided' THEN 500
            WHEN 'payment' THEN 450
            ELSE 500
        END
    END;
$$;

CREATE SEQUENCE IF NOT EXISTS public.activity_events_sequence_no_seq;

ALTER TABLE public.activity_events
    ADD COLUMN IF NOT EXISTS sequence_no BIGINT;

WITH ranked AS (
    SELECT
        ae.id,
        ROW_NUMBER() OVER (
            ORDER BY
                ae.occurred_at ASC,
                private.activity_event_workflow_rank(ae.event_code, ae.event_kind) ASC,
                ae.created_at ASC,
                ae.id ASC
        ) AS rn
    FROM public.activity_events ae
)
UPDATE public.activity_events ae
SET sequence_no = ranked.rn
FROM ranked
WHERE ae.id = ranked.id
  AND ae.sequence_no IS NULL;

WITH tied AS (
    SELECT
        ae.id,
        ae.occurred_at,
        ROW_NUMBER() OVER (
            PARTITION BY ae.tenant_id, ae.entity_type, ae.entity_id, ae.occurred_at
            ORDER BY
                private.activity_event_workflow_rank(ae.event_code, ae.event_kind) ASC,
                ae.created_at ASC,
                ae.id ASC
        ) AS tie_pos,
        COUNT(*) OVER (
            PARTITION BY ae.tenant_id, ae.entity_type, ae.entity_id, ae.occurred_at
        ) AS tie_count
    FROM public.activity_events ae
)
UPDATE public.activity_events ae
SET occurred_at = tied.occurred_at + ((tied.tie_pos - 1) * INTERVAL '1 microsecond')
FROM tied
WHERE ae.id = tied.id
  AND tied.tie_count > 1;

SELECT setval(
    'public.activity_events_sequence_no_seq',
    COALESCE((SELECT MAX(sequence_no) FROM public.activity_events), 1),
    COALESCE((SELECT MAX(sequence_no) FROM public.activity_events), 0) > 0
);

ALTER TABLE public.activity_events
    ALTER COLUMN sequence_no SET DEFAULT nextval('public.activity_events_sequence_no_seq');

ALTER TABLE public.activity_events
    ALTER COLUMN sequence_no SET NOT NULL;

DROP INDEX IF EXISTS public.activity_events_entity_timeline_idx;

CREATE INDEX activity_events_entity_timeline_idx
    ON public.activity_events (
        tenant_id,
        entity_type,
        entity_id,
        occurred_at DESC,
        sequence_no DESC
    );

CREATE OR REPLACE FUNCTION private.insert_activity_event(
    p_tenant_id UUID,
    p_entity_type public.activity_entity_type,
    p_entity_id UUID,
    p_event_kind TEXT,
    p_event_code TEXT,
    p_title TEXT DEFAULT NULL,
    p_detail JSONB DEFAULT '{}'::jsonb,
    p_actor_id UUID DEFAULT NULL,
    p_occurred_at TIMESTAMPTZ DEFAULT NULL,
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
        source_id,
        sequence_no
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
        COALESCE(p_occurred_at, clock_timestamp()),
        p_source_kind,
        p_source_id,
        nextval('public.activity_events_sequence_no_seq')
    )
    ON CONFLICT (tenant_id, source_kind, source_id)
    WHERE source_kind IS NOT NULL AND source_id IS NOT NULL
    DO NOTHING;
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
    p_occurred_at TIMESTAMPTZ DEFAULT NULL
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
        COALESCE(p_occurred_at, clock_timestamp())
    )
    RETURNING id INTO v_id;

    PERFORM private.process_activity_outbox_row(v_id);
    RETURN v_id;
END;
$$;

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
        NULL,
        'outbox',
        v_row.id
    );

    UPDATE public.activity_event_outbox
    SET processed_at = clock_timestamp()
    WHERE id = v_row.id;
END;
$$;

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
        NULL,
        'posting_run',
        NEW.id
    );

    RETURN NEW;
END;
$$;

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
            NULL
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
            NULL
        );
    END IF;

    RETURN NEW;
END;
$$;

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
        NULL
    );

    RETURN NEW;
END;
$$;

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
        NULL
    );

    RETURN NEW;
END;
$$;

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
                NULL
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
                NULL
            );
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP FUNCTION IF EXISTS public.fetch_entity_activity_timeline(
    public.activity_entity_type, UUID, INT, TIMESTAMPTZ
);

CREATE OR REPLACE FUNCTION public.fetch_entity_activity_timeline(
    p_entity_type public.activity_entity_type,
    p_entity_id UUID,
    p_limit INT DEFAULT 50,
    p_before_occurred_at TIMESTAMPTZ DEFAULT NULL,
    p_before_sequence_no BIGINT DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    event_kind TEXT,
    event_code TEXT,
    title TEXT,
    detail JSONB,
    actor_id UUID,
    actor_name TEXT,
    occurred_at TIMESTAMPTZ,
    sequence_no BIGINT
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
        ae.occurred_at,
        ae.sequence_no
    FROM public.activity_events ae
    LEFT JOIN public.users u ON u.id = ae.actor_id
    WHERE ae.tenant_id = v_tenant_id
      AND ae.entity_type = p_entity_type
      AND ae.entity_id = p_entity_id
      AND (
          p_before_occurred_at IS NULL
          OR p_before_sequence_no IS NULL
          OR (ae.occurred_at, ae.sequence_no) < (p_before_occurred_at, p_before_sequence_no)
      )
    ORDER BY ae.occurred_at DESC, ae.sequence_no DESC
    LIMIT GREATEST(LEAST(COALESCE(p_limit, 50), 100), 1);
END;
$$;

REVOKE ALL ON FUNCTION public.fetch_entity_activity_timeline(
    public.activity_entity_type, UUID, INT, TIMESTAMPTZ, BIGINT
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fetch_entity_activity_timeline(
    public.activity_entity_type, UUID, INT, TIMESTAMPTZ, BIGINT
) TO authenticated;

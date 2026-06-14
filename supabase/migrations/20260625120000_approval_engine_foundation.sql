-- ====================================================================
-- Multi-level approval engine + in-app notifications
-- Migration: 20260625120000_approval_engine_foundation.sql
-- ====================================================================

-- --------------------------------------------------------------------
-- 1. Approval run tables
-- --------------------------------------------------------------------
CREATE TABLE public.document_approval_runs (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
    document_type       TEXT NOT NULL,
    document_id         UUID NOT NULL,
    status              TEXT NOT NULL DEFAULT 'PENDING',
    policy_snapshot     JSONB NOT NULL DEFAULT '{}'::jsonb,
    amount_basis        NUMERIC(15, 4) NOT NULL DEFAULT 0,
    currency_code       VARCHAR(3) NOT NULL DEFAULT 'USD',
    submitted_by        UUID NOT NULL REFERENCES public.users (id) ON DELETE RESTRICT,
    submitted_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at        TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT document_approval_runs_status_chk
        CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED')),
    CONSTRAINT document_approval_runs_document_type_chk
        CHECK (document_type IN ('PURCHASE_ORDER', 'SALES_ORDER', 'STOCK_TRANSFER'))
);

CREATE INDEX document_approval_runs_tenant_document_idx
    ON public.document_approval_runs (tenant_id, document_type, document_id);

CREATE INDEX document_approval_runs_tenant_status_idx
    ON public.document_approval_runs (tenant_id, status);

CREATE TABLE public.document_approval_run_steps (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
    run_id              UUID NOT NULL REFERENCES public.document_approval_runs (id) ON DELETE CASCADE,
    level_index         INTEGER NOT NULL,
    step_index          INTEGER NOT NULL,
    step_label          TEXT NOT NULL DEFAULT '',
    quorum_mode         TEXT NOT NULL DEFAULT 'ANY',
    min_approvals       INTEGER NOT NULL DEFAULT 1,
    status              TEXT NOT NULL DEFAULT 'LOCKED',
    opened_at           TIMESTAMPTZ,
    satisfied_at        TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT document_approval_run_steps_status_chk
        CHECK (status IN ('LOCKED', 'PENDING', 'SATISFIED', 'REJECTED', 'SKIPPED')),
    CONSTRAINT document_approval_run_steps_quorum_chk
        CHECK (quorum_mode IN ('ANY', 'ALL')),
    CONSTRAINT document_approval_run_steps_level_step_uniq
        UNIQUE (run_id, level_index, step_index)
);

CREATE INDEX document_approval_run_steps_run_idx
    ON public.document_approval_run_steps (tenant_id, run_id);

CREATE TABLE public.document_approval_run_step_assignees (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
    step_id             UUID NOT NULL REFERENCES public.document_approval_run_steps (id) ON DELETE CASCADE,
    user_id             UUID NOT NULL REFERENCES public.users (id) ON DELETE RESTRICT,
    is_required         BOOLEAN NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT document_approval_run_step_assignees_uniq
        UNIQUE (step_id, user_id)
);

CREATE INDEX document_approval_run_step_assignees_user_idx
    ON public.document_approval_run_step_assignees (tenant_id, user_id);

CREATE TABLE public.document_approval_step_decisions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
    step_id             UUID NOT NULL REFERENCES public.document_approval_run_steps (id) ON DELETE CASCADE,
    user_id             UUID NOT NULL REFERENCES public.users (id) ON DELETE RESTRICT,
    decision            TEXT NOT NULL,
    notes               TEXT,
    decided_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT document_approval_step_decisions_decision_chk
        CHECK (decision IN ('APPROVED', 'REJECTED')),
    CONSTRAINT document_approval_step_decisions_uniq
        UNIQUE (step_id, user_id)
);

-- --------------------------------------------------------------------
-- 2. In-app notifications
-- --------------------------------------------------------------------
CREATE TABLE public.user_notifications (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
    user_id             UUID NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
    event_code          TEXT NOT NULL,
    title               TEXT NOT NULL,
    body                TEXT NOT NULL,
    action_url          TEXT,
    document_type       TEXT,
    document_id         UUID,
    run_id              UUID REFERENCES public.document_approval_runs (id) ON DELETE SET NULL,
    is_read             BOOLEAN NOT NULL DEFAULT FALSE,
    read_at             TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX user_notifications_user_feed_idx
    ON public.user_notifications (tenant_id, user_id, is_read, created_at DESC);

ALTER TABLE public.document_approval_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_approval_run_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_approval_run_step_assignees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_approval_step_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY document_approval_runs_tenant_isolation
    ON public.document_approval_runs FOR ALL TO authenticated
    USING (tenant_id = private.current_tenant_id())
    WITH CHECK (tenant_id = private.current_tenant_id());

CREATE POLICY document_approval_run_steps_tenant_isolation
    ON public.document_approval_run_steps FOR ALL TO authenticated
    USING (tenant_id = private.current_tenant_id())
    WITH CHECK (tenant_id = private.current_tenant_id());

CREATE POLICY document_approval_run_step_assignees_tenant_isolation
    ON public.document_approval_run_step_assignees FOR ALL TO authenticated
    USING (tenant_id = private.current_tenant_id())
    WITH CHECK (tenant_id = private.current_tenant_id());

CREATE POLICY document_approval_step_decisions_tenant_isolation
    ON public.document_approval_step_decisions FOR ALL TO authenticated
    USING (tenant_id = private.current_tenant_id())
    WITH CHECK (tenant_id = private.current_tenant_id());

CREATE POLICY user_notifications_tenant_select
    ON public.user_notifications FOR SELECT TO authenticated
    USING (
        tenant_id = private.current_tenant_id()
        AND user_id = auth.uid()
    );

CREATE POLICY user_notifications_tenant_update
    ON public.user_notifications FOR UPDATE TO authenticated
    USING (
        tenant_id = private.current_tenant_id()
        AND user_id = auth.uid()
    )
    WITH CHECK (
        tenant_id = private.current_tenant_id()
        AND user_id = auth.uid()
    );

REVOKE INSERT, DELETE ON public.user_notifications FROM PUBLIC, anon, authenticated;

-- --------------------------------------------------------------------
-- 3. Policy resolution helpers
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.resolve_po_approval_policy(p_tenant_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_settings JSONB;
    v_bands JSONB;
    v_threshold NUMERIC;
    v_approver_ids JSONB;
    v_allow_self BOOLEAN;
BEGIN
    v_settings := private.fetch_approval_settings_metadata(p_tenant_id);
    v_bands := v_settings -> 'po_approval_bands';

    IF v_bands IS NOT NULL AND jsonb_typeof(v_bands) = 'array' AND jsonb_array_length(v_bands) > 0 THEN
        RETURN jsonb_build_object(
            'source', 'bands',
            'bands', v_bands,
            'pools', COALESCE(v_settings -> 'po_approver_pools', '{}'::jsonb)
        );
    END IF;

    v_threshold := NULLIF(v_settings ->> 'po_approval_threshold_amount', '')::numeric;
    v_allow_self := COALESCE((v_settings ->> 'allow_submitter_self_approve_below_threshold')::boolean, FALSE);
    v_approver_ids := COALESCE(v_settings -> 'po_approver_user_ids', '[]'::jsonb);

    IF v_threshold IS NOT NULL THEN
        v_bands := jsonb_build_array(
            jsonb_build_object(
                'min_amount', 0,
                'max_amount', v_threshold,
                'skip', TRUE,
                'self_approve', v_allow_self
            ),
            jsonb_build_object(
                'min_amount', v_threshold,
                'max_amount', NULL,
                'levels', jsonb_build_array(
                    jsonb_build_object(
                        'steps', jsonb_build_array(
                            jsonb_build_object(
                                'label', 'Approvers',
                                'quorum', 'ANY',
                                'pool', 'default'
                            )
                        )
                    )
                )
            )
        );
    ELSE
        v_bands := jsonb_build_array(
            jsonb_build_object(
                'min_amount', 0,
                'max_amount', NULL,
                'levels', jsonb_build_array(
                    jsonb_build_object(
                        'steps', jsonb_build_array(
                            jsonb_build_object(
                                'label', 'Approvers',
                                'quorum', 'ANY',
                                'pool', 'default'
                            )
                        )
                    )
                )
            )
        );
    END IF;

    RETURN jsonb_build_object(
        'source', 'legacy',
        'bands', v_bands,
        'pools', jsonb_build_object(
            'default', jsonb_build_object('user_ids', v_approver_ids)
        )
    );
END;
$$;

CREATE OR REPLACE FUNCTION private.resolve_po_approval_band(
    p_amount NUMERIC,
    p_policy JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    v_band JSONB;
    v_min NUMERIC;
    v_max NUMERIC;
BEGIN
    FOR v_band IN
        SELECT value
        FROM jsonb_array_elements(COALESCE(p_policy -> 'bands', '[]'::jsonb)) AS value
        ORDER BY COALESCE((value ->> 'min_amount')::numeric, 0)
    LOOP
        v_min := COALESCE((v_band ->> 'min_amount')::numeric, 0);
        v_max := NULLIF(v_band ->> 'max_amount', '')::numeric;

        IF COALESCE(p_amount, 0) >= v_min
           AND (v_max IS NULL OR COALESCE(p_amount, 0) <= v_max)
        THEN
            RETURN v_band;
        END IF;
    END LOOP;

    RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION private.pool_user_ids(
    p_policy JSONB,
    p_pool_key TEXT
)
RETURNS UUID[]
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    v_ids JSONB;
    v_result UUID[] := ARRAY[]::uuid[];
    v_text TEXT;
BEGIN
    v_ids := COALESCE(p_policy -> 'pools' -> p_pool_key -> 'user_ids', '[]'::jsonb);
    IF jsonb_typeof(v_ids) <> 'array' THEN
        RETURN v_result;
    END IF;

    FOR v_text IN
        SELECT jsonb_array_elements_text(v_ids)
    LOOP
        BEGIN
            v_result := array_append(v_result, v_text::uuid);
        EXCEPTION WHEN invalid_text_representation THEN
            CONTINUE;
        END;
    END LOOP;

    RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION private.create_in_app_notification(
    p_tenant_id UUID,
    p_user_id UUID,
    p_event_code TEXT,
    p_title TEXT,
    p_body TEXT,
    p_action_url TEXT DEFAULT NULL,
    p_document_type TEXT DEFAULT NULL,
    p_document_id UUID DEFAULT NULL,
    p_run_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_id UUID;
BEGIN
    IF p_user_id IS NULL THEN
        RETURN NULL;
    END IF;

    INSERT INTO public.user_notifications (
        tenant_id, user_id, event_code, title, body,
        action_url, document_type, document_id, run_id
    )
    VALUES (
        p_tenant_id, p_user_id, p_event_code, p_title, p_body,
        p_action_url, p_document_type, p_document_id, p_run_id
    )
    RETURNING id INTO v_id;

    RETURN v_id;
END;
$$;

-- --------------------------------------------------------------------
-- 4. Materialize approval run from policy band
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.materialize_po_approval_run(
    p_tenant_id UUID,
    p_po_id UUID,
    p_submitter_id UUID,
    p_amount NUMERIC,
    p_currency TEXT,
    p_policy JSONB,
    p_band JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_run_id UUID;
    v_level JSONB;
    v_step JSONB;
    v_level_idx INTEGER := 0;
    v_step_idx INTEGER;
    v_step_id UUID;
    v_quorum TEXT;
    v_pool TEXT;
    v_user_id UUID;
    v_user_ids UUID[];
    v_first_level_opened BOOLEAN := FALSE;
BEGIN
    INSERT INTO public.document_approval_runs (
        tenant_id, document_type, document_id, status,
        policy_snapshot, amount_basis, currency_code, submitted_by
    )
    VALUES (
        p_tenant_id, 'PURCHASE_ORDER', p_po_id, 'PENDING',
        p_policy, COALESCE(p_amount, 0), COALESCE(p_currency, 'USD'), p_submitter_id
    )
    RETURNING id INTO v_run_id;

    FOR v_level IN
        SELECT value
        FROM jsonb_array_elements(COALESCE(p_band -> 'levels', '[]'::jsonb)) AS value
    LOOP
        v_step_idx := 0;
        FOR v_step IN
            SELECT value
            FROM jsonb_array_elements(COALESCE(v_level -> 'steps', '[]'::jsonb)) AS value
        LOOP
            v_quorum := COALESCE(v_step ->> 'quorum', 'ANY');
            v_pool := COALESCE(v_step ->> 'pool', 'default');

            INSERT INTO public.document_approval_run_steps (
                tenant_id, run_id, level_index, step_index, step_label,
                quorum_mode, min_approvals, status, opened_at
            )
            VALUES (
                p_tenant_id,
                v_run_id,
                v_level_idx,
                v_step_idx,
                COALESCE(v_step ->> 'label', 'Approval'),
                v_quorum,
                CASE WHEN v_quorum = 'ALL' THEN 1 ELSE 1 END,
                CASE
                    WHEN NOT v_first_level_opened AND v_level_idx = 0 THEN 'PENDING'
                    WHEN NOT v_first_level_opened THEN 'PENDING'
                    ELSE 'LOCKED'
                END,
                CASE
                    WHEN v_level_idx = 0 THEN NOW()
                    ELSE NULL
                END
            )
            RETURNING id INTO v_step_id;

            IF v_level_idx = 0 THEN
                v_first_level_opened := TRUE;
            END IF;

            v_user_ids := private.pool_user_ids(p_policy, v_pool);

            IF COALESCE(array_length(v_user_ids, 1), 0) = 0 THEN
                SELECT COALESCE(array_agg(m.user_id), ARRAY[]::uuid[])
                INTO v_user_ids
                FROM public.user_tenant_memberships m
                WHERE m.tenant_id = p_tenant_id
                  AND m.is_active = TRUE
                  AND m.role = 'OWNER'::public.user_role;
            END IF;

            FOREACH v_user_id IN ARRAY v_user_ids
            LOOP
                INSERT INTO public.document_approval_run_step_assignees (
                    tenant_id, step_id, user_id, is_required
                )
                VALUES (
                    p_tenant_id,
                    v_step_id,
                    v_user_id,
                    v_quorum = 'ALL'
                )
                ON CONFLICT (step_id, user_id) DO NOTHING;
            END LOOP;

            IF v_quorum = 'ALL' THEN
                UPDATE public.document_approval_run_steps
                SET min_approvals = (
                    SELECT COUNT(*)
                    FROM public.document_approval_run_step_assignees a
                    WHERE a.step_id = v_step_id AND a.is_required
                )
                WHERE id = v_step_id;
            END IF;

            v_step_idx := v_step_idx + 1;
        END LOOP;

        v_level_idx := v_level_idx + 1;
    END LOOP;

    IF NOT EXISTS (
        SELECT 1 FROM public.document_approval_run_steps s WHERE s.run_id = v_run_id
    ) THEN
        INSERT INTO public.document_approval_run_steps (
            tenant_id, run_id, level_index, step_index, step_label,
            quorum_mode, min_approvals, status, opened_at
        )
        VALUES (
            p_tenant_id, v_run_id, 0, 0, 'Approvers', 'ANY', 1, 'PENDING', NOW()
        )
        RETURNING id INTO v_step_id;

        v_user_ids := private.pool_user_ids(p_policy, 'default');
        FOREACH v_user_id IN ARRAY v_user_ids
        LOOP
            INSERT INTO public.document_approval_run_step_assignees (
                tenant_id, step_id, user_id, is_required
            )
            VALUES (p_tenant_id, v_step_id, v_user_id, FALSE)
            ON CONFLICT DO NOTHING;
        END LOOP;
    END IF;

    RETURN v_run_id;
END;
$$;

CREATE OR REPLACE FUNCTION private.notify_po_approval_step_assignees(
    p_tenant_id UUID,
    p_run_id UUID,
    p_po_id UUID,
    p_voucher TEXT,
    p_event_code TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_assignee RECORD;
    v_title TEXT;
    v_body TEXT;
    v_url TEXT;
BEGIN
    v_url := '/procurement/purchase-orders?id=' || p_po_id::text;

    FOR v_assignee IN
        SELECT DISTINCT a.user_id
        FROM public.document_approval_run_steps s
        JOIN public.document_approval_run_step_assignees a ON a.step_id = s.id
        WHERE s.run_id = p_run_id
          AND s.tenant_id = p_tenant_id
          AND s.status = 'PENDING'
    LOOP
        IF p_event_code = 'approval.step_opened' THEN
            v_title := 'Approval required — ' || COALESCE(p_voucher, 'PO');
            v_body := 'A purchase order needs your approval.';
        ELSE
            v_title := COALESCE(p_voucher, 'PO') || ' submitted for approval';
            v_body := 'Your purchase order was submitted for approval.';
        END IF;

        PERFORM private.create_in_app_notification(
            p_tenant_id,
            v_assignee.user_id,
            p_event_code,
            v_title,
            v_body,
            v_url,
            'PURCHASE_ORDER',
            p_po_id,
            p_run_id
        );
    END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION private.advance_approval_run(p_run_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_run RECORD;
    v_level INTEGER;
    v_level_complete BOOLEAN;
    v_next_level INTEGER;
    v_all_complete BOOLEAN;
BEGIN
    SELECT * INTO v_run
    FROM public.document_approval_runs
    WHERE id = p_run_id;

    IF NOT FOUND OR v_run.status <> 'PENDING' THEN
        RETURN FALSE;
    END IF;

    SELECT NOT EXISTS (
        SELECT 1
        FROM public.document_approval_run_steps s
        WHERE s.run_id = p_run_id
          AND s.status NOT IN ('SATISFIED', 'SKIPPED')
    )
    INTO v_all_complete;

    IF v_all_complete THEN
        UPDATE public.document_approval_runs
        SET status = 'APPROVED', completed_at = NOW(), updated_at = NOW()
        WHERE id = p_run_id;

        RETURN TRUE;
    END IF;

    SELECT MIN(s.level_index)
    INTO v_level
    FROM public.document_approval_run_steps s
    WHERE s.run_id = p_run_id
      AND s.status IN ('PENDING', 'LOCKED');

    IF v_level IS NULL THEN
        RETURN FALSE;
    END IF;

    SELECT NOT EXISTS (
        SELECT 1
        FROM public.document_approval_run_steps s
        WHERE s.run_id = p_run_id
          AND s.level_index = v_level
          AND s.status <> 'SATISFIED'
    )
    INTO v_level_complete;

    IF v_level_complete THEN
        v_next_level := v_level + 1;

        UPDATE public.document_approval_run_steps
        SET status = 'PENDING', opened_at = COALESCE(opened_at, NOW()), updated_at = NOW()
        WHERE run_id = p_run_id
          AND level_index = v_next_level
          AND status = 'LOCKED';

        SELECT NOT EXISTS (
            SELECT 1
            FROM public.document_approval_run_steps s
            WHERE s.run_id = p_run_id
              AND s.status NOT IN ('SATISFIED', 'SKIPPED')
        )
        INTO v_all_complete;

        IF v_all_complete THEN
            UPDATE public.document_approval_runs
            SET status = 'APPROVED', completed_at = NOW(), updated_at = NOW()
            WHERE id = p_run_id;

            RETURN TRUE;
        END IF;
    END IF;

    RETURN FALSE;
END;
$$;

CREATE OR REPLACE FUNCTION private.satisfy_approval_step_if_quorum_met(p_step_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_step RECORD;
    v_approval_count INTEGER;
BEGIN
    SELECT * INTO v_step
    FROM public.document_approval_run_steps
    WHERE id = p_step_id;

    IF NOT FOUND OR v_step.status <> 'PENDING' THEN
        RETURN FALSE;
    END IF;

    SELECT COUNT(*)
    INTO v_approval_count
    FROM public.document_approval_step_decisions d
    WHERE d.step_id = p_step_id AND d.decision = 'APPROVED';

    IF v_step.quorum_mode = 'ALL' THEN
        IF v_approval_count < v_step.min_approvals THEN
            RETURN FALSE;
        END IF;
    ELSIF v_approval_count < 1 THEN
        RETURN FALSE;
    END IF;

    UPDATE public.document_approval_run_steps
    SET status = 'SATISFIED', satisfied_at = NOW(), updated_at = NOW()
    WHERE id = p_step_id;

    RETURN TRUE;
END;
$$;

-- --------------------------------------------------------------------
-- 5. Read model for UI
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_document_approval_run(
    p_document_type TEXT,
    p_document_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_tenant_id UUID;
    v_run RECORD;
    v_steps JSONB;
BEGIN
    v_tenant_id := private.current_tenant_id();
    IF v_tenant_id IS NULL THEN
        RETURN NULL;
    END IF;

    SELECT *
    INTO v_run
    FROM public.document_approval_runs r
    WHERE r.tenant_id = v_tenant_id
      AND r.document_type = p_document_type
      AND r.document_id = p_document_id
      AND r.status IN ('PENDING', 'APPROVED', 'REJECTED')
    ORDER BY r.submitted_at DESC
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN NULL;
    END IF;

    SELECT COALESCE(jsonb_agg(step_row ORDER BY level_index, step_index), '[]'::jsonb)
    INTO v_steps
    FROM (
        SELECT jsonb_build_object(
            'id', s.id,
            'level_index', s.level_index,
            'step_index', s.step_index,
            'step_label', s.step_label,
            'quorum_mode', s.quorum_mode,
            'min_approvals', s.min_approvals,
            'status', s.status,
            'opened_at', s.opened_at,
            'satisfied_at', s.satisfied_at,
            'assignees', (
                SELECT COALESCE(jsonb_agg(jsonb_build_object(
                    'user_id', a.user_id,
                    'is_required', a.is_required,
                    'decision', (
                        SELECT d.decision
                        FROM public.document_approval_step_decisions d
                        WHERE d.step_id = s.id AND d.user_id = a.user_id
                        LIMIT 1
                    )
                )), '[]'::jsonb)
                FROM public.document_approval_run_step_assignees a
                WHERE a.step_id = s.id
            )
        ) AS step_row,
        s.level_index,
        s.step_index
        FROM public.document_approval_run_steps s
        WHERE s.run_id = v_run.id
    ) sub;

    RETURN jsonb_build_object(
        'run_id', v_run.id,
        'status', v_run.status,
        'submitted_by', v_run.submitted_by,
        'submitted_at', v_run.submitted_at,
        'amount_basis', v_run.amount_basis,
        'currency_code', v_run.currency_code,
        'completed_at', v_run.completed_at,
        'steps', v_steps
    );
END;
$$;

REVOKE ALL ON FUNCTION public.get_document_approval_run(TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_document_approval_run(TEXT, UUID) TO authenticated;

-- --------------------------------------------------------------------
-- 6. Patch submit_purchase_order_for_approval
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.submit_purchase_order_for_approval(p_purchase_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_tenant_id UUID;
    v_user_id UUID;
    v_po RECORD;
    v_line_count INTEGER;
    v_request_id UUID;
    v_run_id UUID;
    v_policy JSONB;
    v_band JSONB;
    v_steps JSONB := '[]'::jsonb;
BEGIN
    v_tenant_id := private.current_tenant_id();
    v_user_id := auth.uid();

    IF v_tenant_id IS NULL OR v_user_id IS NULL THEN
        RAISE EXCEPTION 'tenant context missing from session';
    END IF;

    IF NOT private.can_edit_purchase_orders() THEN
        RAISE EXCEPTION 'purchase order edit permission required';
    END IF;

    IF p_purchase_order_id IS NULL THEN
        RAISE EXCEPTION 'purchase order id is required';
    END IF;

    SELECT * INTO v_po
    FROM public.purchase_orders
    WHERE id = p_purchase_order_id AND tenant_id = v_tenant_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'purchase order not found';
    END IF;

    IF v_po.document_status <> 'DRAFT'::public.purchase_document_status THEN
        RAISE EXCEPTION 'only draft purchase orders can be submitted for approval';
    END IF;

    SELECT COUNT(*) INTO v_line_count
    FROM public.purchase_order_items
    WHERE purchase_order_id = p_purchase_order_id AND tenant_id = v_tenant_id;

    IF v_line_count < 1 THEN
        RAISE EXCEPTION 'purchase order must have at least one line before submission';
    END IF;

    IF NOT private.po_approval_required(v_tenant_id, v_po.total_net_amount, v_user_id) THEN
        RAISE EXCEPTION 'approval is not required for this purchase order; issue it directly';
    END IF;

    v_policy := private.resolve_po_approval_policy(v_tenant_id);
    v_band := private.resolve_po_approval_band(v_po.total_net_amount, v_policy);

    IF v_band IS NULL OR COALESCE((v_band ->> 'skip')::boolean, FALSE) THEN
        RAISE EXCEPTION 'approval is not required for this purchase order; issue it directly';
    END IF;

    v_run_id := private.materialize_po_approval_run(
        v_tenant_id,
        p_purchase_order_id,
        v_user_id,
        v_po.total_net_amount,
        v_po.currency_code,
        v_policy,
        v_band
    );

    INSERT INTO public.document_approval_requests (
        tenant_id, document_type, document_id, status, submitted_by
    )
    VALUES (
        v_tenant_id, 'PURCHASE_ORDER', p_purchase_order_id, 'PENDING', v_user_id
    )
    RETURNING id INTO v_request_id;

    UPDATE public.purchase_orders
    SET document_status = 'PENDING_APPROVAL'::public.purchase_document_status,
        updated_at = NOW()
    WHERE id = p_purchase_order_id;

    PERFORM private.create_in_app_notification(
        v_tenant_id,
        v_user_id,
        'approval.submitted',
        'Submitted — ' || v_po.voucher_number,
        'Your purchase order was submitted for approval.',
        '/procurement/purchase-orders?id=' || p_purchase_order_id::text,
        'PURCHASE_ORDER',
        p_purchase_order_id,
        v_run_id
    );

    PERFORM private.notify_po_approval_step_assignees(
        v_tenant_id, v_run_id, p_purchase_order_id, v_po.voucher_number, 'approval.step_opened'
    );

    v_steps := private.append_posting_step(v_steps, 'po_submitted_for_approval', 'success', v_po.voucher_number);

    INSERT INTO public.document_posting_runs (
        tenant_id, document_type, document_id, overall_status, steps, posted_by
    )
    VALUES (
        v_tenant_id, 'PO'::public.document_posting_document_type, p_purchase_order_id, 'success', v_steps, v_user_id
    );

    RETURN jsonb_build_object(
        'purchase_order_id', p_purchase_order_id,
        'approval_request_id', v_request_id,
        'approval_run_id', v_run_id,
        'steps', v_steps
    );
END;
$$;

-- --------------------------------------------------------------------
-- 7. Patch approve / reject to use run steps when present
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.approve_purchase_order(
    p_purchase_order_id UUID,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_tenant_id UUID;
    v_user_id UUID;
    v_po RECORD;
    v_request_id UUID;
    v_submitter_id UUID;
    v_run RECORD;
    v_step RECORD;
    v_steps JSONB := '[]'::jsonb;
    v_issue_result JSONB;
    v_issue_steps JSONB;
    v_notes TEXT;
    v_run_complete BOOLEAN;
BEGIN
    v_tenant_id := private.current_tenant_id();
    v_user_id := auth.uid();

    IF v_tenant_id IS NULL OR v_user_id IS NULL THEN
        RAISE EXCEPTION 'tenant context missing from session';
    END IF;

    IF p_purchase_order_id IS NULL THEN
        RAISE EXCEPTION 'purchase order id is required';
    END IF;

    SELECT * INTO v_po
    FROM public.purchase_orders
    WHERE id = p_purchase_order_id AND tenant_id = v_tenant_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'purchase order not found';
    END IF;

    IF NOT private.user_can_approve_purchase_order_amount(v_user_id, v_tenant_id, v_po.total_net_amount) THEN
        RAISE EXCEPTION 'purchase order approver permission required for this amount';
    END IF;

    IF v_po.document_status <> 'PENDING_APPROVAL'::public.purchase_document_status THEN
        RAISE EXCEPTION 'only pending-approval purchase orders can be approved';
    END IF;

    SELECT dar.id, dar.submitted_by
    INTO v_request_id, v_submitter_id
    FROM public.document_approval_requests dar
    WHERE dar.tenant_id = v_tenant_id
      AND dar.document_type = 'PURCHASE_ORDER'
      AND dar.document_id = p_purchase_order_id
      AND dar.status = 'PENDING'
    ORDER BY dar.submitted_at DESC
    LIMIT 1;

    IF v_request_id IS NULL THEN
        RAISE EXCEPTION 'pending approval request not found';
    END IF;

    IF v_submitter_id = v_user_id
       AND NOT private.user_is_po_super_approver(v_user_id)
       AND NOT private.po_self_approve_allowed(v_tenant_id, v_po.total_net_amount, v_user_id)
    THEN
        RAISE EXCEPTION 'submitter cannot self-approve this purchase order';
    END IF;

    SELECT * INTO v_run
    FROM public.document_approval_runs r
    WHERE r.tenant_id = v_tenant_id
      AND r.document_type = 'PURCHASE_ORDER'
      AND r.document_id = p_purchase_order_id
      AND r.status = 'PENDING'
    ORDER BY r.submitted_at DESC
    LIMIT 1;

    v_notes := NULLIF(BTRIM(p_notes), '');

    IF FOUND THEN
        SELECT s.* INTO v_step
        FROM public.document_approval_run_steps s
        JOIN public.document_approval_run_step_assignees a
          ON a.step_id = s.id AND a.user_id = v_user_id
        WHERE s.run_id = v_run.id
          AND s.status = 'PENDING'
        ORDER BY s.level_index, s.step_index
        LIMIT 1;

        IF v_step.id IS NULL AND NOT private.user_is_po_super_approver(v_user_id) THEN
            RAISE EXCEPTION 'no pending approval step assigned to you';
        END IF;

        IF v_step.id IS NOT NULL THEN
            INSERT INTO public.document_approval_step_decisions (
                tenant_id, step_id, user_id, decision, notes
            )
            VALUES (v_tenant_id, v_step.id, v_user_id, 'APPROVED', v_notes)
            ON CONFLICT (step_id, user_id) DO UPDATE
            SET decision = 'APPROVED', notes = EXCLUDED.notes, decided_at = NOW();

            PERFORM private.satisfy_approval_step_if_quorum_met(v_step.id);
            PERFORM private.advance_approval_run(v_run.id);
        ELSIF private.user_is_po_super_approver(v_user_id) THEN
            UPDATE public.document_approval_run_steps
            SET status = 'SATISFIED', satisfied_at = NOW(), updated_at = NOW()
            WHERE run_id = v_run.id AND status IN ('PENDING', 'LOCKED');

            UPDATE public.document_approval_runs
            SET status = 'APPROVED', completed_at = NOW(), updated_at = NOW()
            WHERE id = v_run.id;
        END IF;

        SELECT status = 'APPROVED' INTO v_run_complete
        FROM public.document_approval_runs WHERE id = v_run.id;

        IF NOT v_run_complete THEN
            PERFORM private.notify_po_approval_step_assignees(
                v_tenant_id, v_run.id, p_purchase_order_id, v_po.voucher_number, 'approval.step_opened'
            );

            RETURN jsonb_build_object(
                'purchase_order_id', p_purchase_order_id,
                'approval_request_id', v_request_id,
                'approval_run_id', v_run.id,
                'issued', FALSE,
                'pending_next_step', TRUE
            );
        END IF;
    END IF;

    UPDATE public.document_approval_requests
    SET status = 'APPROVED',
        decided_by = v_user_id,
        decided_at = NOW(),
        decision_notes = v_notes,
        updated_at = NOW()
    WHERE id = v_request_id;

    INSERT INTO public.document_approvals (
        tenant_id, document_type, document_id, approved_by, approved_at, notes
    )
    VALUES (
        v_tenant_id, 'PURCHASE_ORDER', p_purchase_order_id, v_user_id, NOW(), v_notes
    );

    PERFORM private.create_in_app_notification(
        v_tenant_id,
        v_submitter_id,
        'approval.approved',
        'Approved — ' || v_po.voucher_number,
        'Your purchase order was fully approved.',
        '/procurement/purchase-orders?id=' || p_purchase_order_id::text,
        'PURCHASE_ORDER',
        p_purchase_order_id,
        v_run.id
    );

    v_steps := private.append_posting_step(v_steps, 'po_approved', 'success', v_po.voucher_number);

    INSERT INTO public.document_posting_runs (
        tenant_id, document_type, document_id, overall_status, steps, posted_by
    )
    VALUES (
        v_tenant_id, 'PO'::public.document_posting_document_type, p_purchase_order_id, 'success', v_steps, v_user_id
    );

    v_issue_result := public.issue_purchase_order(p_purchase_order_id);
    v_issue_steps := COALESCE(v_issue_result -> 'steps', '[]'::jsonb);
    v_steps := v_steps || v_issue_steps;

    RETURN jsonb_build_object(
        'purchase_order_id', p_purchase_order_id,
        'approval_request_id', v_request_id,
        'approval_run_id', v_run.id,
        'steps', v_steps,
        'issued', TRUE
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_purchase_order(
    p_purchase_order_id UUID,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_tenant_id UUID;
    v_user_id UUID;
    v_po RECORD;
    v_request_id UUID;
    v_submitter_id UUID;
    v_run RECORD;
    v_step RECORD;
    v_steps JSONB := '[]'::jsonb;
    v_notes TEXT;
BEGIN
    v_tenant_id := private.current_tenant_id();
    v_user_id := auth.uid();

    IF v_tenant_id IS NULL OR v_user_id IS NULL THEN
        RAISE EXCEPTION 'tenant context missing from session';
    END IF;

    IF p_purchase_order_id IS NULL THEN
        RAISE EXCEPTION 'purchase order id is required';
    END IF;

    SELECT * INTO v_po
    FROM public.purchase_orders
    WHERE id = p_purchase_order_id AND tenant_id = v_tenant_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'purchase order not found';
    END IF;

    IF NOT private.user_can_approve_purchase_order_amount(v_user_id, v_tenant_id, v_po.total_net_amount) THEN
        RAISE EXCEPTION 'purchase order approver permission required for this amount';
    END IF;

    v_notes := NULLIF(BTRIM(p_notes), '');
    IF v_notes IS NULL THEN
        RAISE EXCEPTION 'rejection reason is required';
    END IF;

    IF v_po.document_status <> 'PENDING_APPROVAL'::public.purchase_document_status THEN
        RAISE EXCEPTION 'only pending-approval purchase orders can be rejected';
    END IF;

    SELECT dar.id, dar.submitted_by
    INTO v_request_id, v_submitter_id
    FROM public.document_approval_requests dar
    WHERE dar.tenant_id = v_tenant_id
      AND dar.document_type = 'PURCHASE_ORDER'
      AND dar.document_id = p_purchase_order_id
      AND dar.status = 'PENDING'
    ORDER BY dar.submitted_at DESC
    LIMIT 1;

    IF v_request_id IS NULL THEN
        RAISE EXCEPTION 'pending approval request not found';
    END IF;

    SELECT * INTO v_run
    FROM public.document_approval_runs r
    WHERE r.tenant_id = v_tenant_id
      AND r.document_type = 'PURCHASE_ORDER'
      AND r.document_id = p_purchase_order_id
      AND r.status = 'PENDING'
    ORDER BY r.submitted_at DESC
    LIMIT 1;

    IF FOUND THEN
        SELECT s.* INTO v_step
        FROM public.document_approval_run_steps s
        JOIN public.document_approval_run_step_assignees a
          ON a.step_id = s.id AND a.user_id = v_user_id
        WHERE s.run_id = v_run.id AND s.status = 'PENDING'
        ORDER BY s.level_index, s.step_index
        LIMIT 1;

        IF v_step.id IS NULL AND NOT private.user_is_po_super_approver(v_user_id) THEN
            RAISE EXCEPTION 'no pending approval step assigned to you';
        END IF;

        UPDATE public.document_approval_runs
        SET status = 'REJECTED', completed_at = NOW(), updated_at = NOW()
        WHERE id = v_run.id;

        UPDATE public.document_approval_run_steps
        SET status = 'REJECTED', updated_at = NOW()
        WHERE run_id = v_run.id AND status IN ('PENDING', 'LOCKED');
    END IF;

    UPDATE public.document_approval_requests
    SET status = 'REJECTED',
        decided_by = v_user_id,
        decided_at = NOW(),
        decision_notes = v_notes,
        updated_at = NOW()
    WHERE id = v_request_id;

    UPDATE public.purchase_orders
    SET document_status = 'DRAFT'::public.purchase_document_status,
        updated_at = NOW()
    WHERE id = p_purchase_order_id;

    PERFORM private.create_in_app_notification(
        v_tenant_id,
        v_submitter_id,
        'approval.rejected',
        'Rejected — ' || v_po.voucher_number,
        'Reason: ' || v_notes,
        '/procurement/purchase-orders?id=' || p_purchase_order_id::text,
        'PURCHASE_ORDER',
        p_purchase_order_id,
        v_run.id
    );

    v_steps := private.append_posting_step(v_steps, 'po_rejected', 'success', v_notes);

    INSERT INTO public.document_posting_runs (
        tenant_id, document_type, document_id, overall_status, steps, posted_by
    )
    VALUES (
        v_tenant_id, 'PO'::public.document_posting_document_type, p_purchase_order_id, 'success', v_steps, v_user_id
    );

    RETURN jsonb_build_object(
        'purchase_order_id', p_purchase_order_id,
        'approval_request_id', v_request_id,
        'steps', v_steps
    );
END;
$$;

-- --------------------------------------------------------------------
-- 8. User notification RPCs
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fetch_user_notifications(
    p_limit INTEGER DEFAULT 20,
    p_unread_only BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_tenant_id UUID;
    v_user_id UUID;
    v_rows JSONB;
    v_unread INTEGER;
BEGIN
    v_tenant_id := private.current_tenant_id();
    v_user_id := auth.uid();

    IF v_tenant_id IS NULL OR v_user_id IS NULL THEN
        RETURN jsonb_build_object('items', '[]'::jsonb, 'unread_count', 0);
    END IF;

    SELECT COUNT(*) INTO v_unread
    FROM public.user_notifications n
    WHERE n.tenant_id = v_tenant_id
      AND n.user_id = v_user_id
      AND NOT n.is_read;

    SELECT COALESCE(jsonb_agg(row_json ORDER BY created_at DESC), '[]'::jsonb)
    INTO v_rows
    FROM (
        SELECT jsonb_build_object(
            'id', n.id,
            'event_code', n.event_code,
            'title', n.title,
            'body', n.body,
            'action_url', n.action_url,
            'document_type', n.document_type,
            'document_id', n.document_id,
            'is_read', n.is_read,
            'created_at', n.created_at
        ) AS row_json,
        n.created_at
        FROM public.user_notifications n
        WHERE n.tenant_id = v_tenant_id
          AND n.user_id = v_user_id
          AND (NOT p_unread_only OR NOT n.is_read)
        ORDER BY n.created_at DESC
        LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 20), 100))
    ) sub;

    RETURN jsonb_build_object('items', v_rows, 'unread_count', v_unread);
END;
$$;

REVOKE ALL ON FUNCTION public.fetch_user_notifications(INTEGER, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fetch_user_notifications(INTEGER, BOOLEAN) TO authenticated;

CREATE OR REPLACE FUNCTION public.mark_user_notifications_read(
    p_notification_ids UUID[] DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_tenant_id UUID;
    v_user_id UUID;
    v_count INTEGER;
BEGIN
    v_tenant_id := private.current_tenant_id();
    v_user_id := auth.uid();

    IF v_tenant_id IS NULL OR v_user_id IS NULL THEN
        RETURN 0;
    END IF;

    UPDATE public.user_notifications n
    SET is_read = TRUE, read_at = NOW()
    WHERE n.tenant_id = v_tenant_id
      AND n.user_id = v_user_id
      AND NOT n.is_read
      AND (p_notification_ids IS NULL OR n.id = ANY(p_notification_ids));

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_user_notifications_read(UUID[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_user_notifications_read(UUID[]) TO authenticated;

-- --------------------------------------------------------------------
-- 9. Approval queue for command center
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fetch_my_approval_tasks(
    p_limit INTEGER DEFAULT 50
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_tenant_id UUID;
    v_user_id UUID;
    v_rows JSONB;
BEGIN
    v_tenant_id := private.current_tenant_id();
    v_user_id := auth.uid();

    IF v_tenant_id IS NULL OR v_user_id IS NULL THEN
        RETURN '[]'::jsonb;
    END IF;

    SELECT COALESCE(jsonb_agg(task_row ORDER BY submitted_at DESC), '[]'::jsonb)
    INTO v_rows
    FROM (
        SELECT jsonb_build_object(
            'run_id', r.id,
            'document_type', r.document_type,
            'document_id', r.document_id,
            'step_id', s.id,
            'step_label', s.step_label,
            'level_index', s.level_index,
            'quorum_mode', s.quorum_mode,
            'amount_basis', r.amount_basis,
            'currency_code', r.currency_code,
            'submitted_at', r.submitted_at,
            'submitted_by', r.submitted_by,
            'voucher_number', po.voucher_number,
            'party_name', e.name
        ) AS task_row,
        r.submitted_at
        FROM public.document_approval_runs r
        JOIN public.document_approval_run_steps s ON s.run_id = r.id AND s.status = 'PENDING'
        JOIN public.document_approval_run_step_assignees a ON a.step_id = s.id AND a.user_id = v_user_id
        LEFT JOIN public.purchase_orders po
          ON r.document_type = 'PURCHASE_ORDER' AND po.id = r.document_id
        LEFT JOIN public.entities e ON po.supplier_id = e.id
        WHERE r.tenant_id = v_tenant_id
          AND r.status = 'PENDING'
        ORDER BY r.submitted_at DESC
        LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 50), 100))
    ) sub;

    RETURN v_rows;
END;
$$;

REVOKE ALL ON FUNCTION public.fetch_my_approval_tasks(INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fetch_my_approval_tasks(INTEGER) TO authenticated;

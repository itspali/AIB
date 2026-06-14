-- ====================================================================
-- Sales approval engine (SO, quotation, invoice)
-- Migration: 20260627120000_sales_approval_engine.sql
-- ====================================================================

-- --------------------------------------------------------------------
-- 1. Extend approval document type constraints
-- --------------------------------------------------------------------
ALTER TABLE public.document_approval_runs
    DROP CONSTRAINT IF EXISTS document_approval_runs_document_type_chk;

ALTER TABLE public.document_approval_runs
    ADD CONSTRAINT document_approval_runs_document_type_chk
        CHECK (document_type IN (
            'PURCHASE_ORDER', 'SALES_ORDER', 'SALES_QUOTATION', 'SALES_INVOICE', 'STOCK_TRANSFER'
        ));

ALTER TABLE public.document_approval_requests
    DROP CONSTRAINT IF EXISTS document_approval_requests_document_type_chk;

ALTER TABLE public.document_approval_requests
    ADD CONSTRAINT document_approval_requests_document_type_chk
        CHECK (document_type IN (
            'PURCHASE_ORDER', 'SALES_ORDER', 'SALES_QUOTATION', 'SALES_INVOICE'
        ));

-- --------------------------------------------------------------------
-- 2. Generic sales policy resolution
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.resolve_sales_approval_policy(
    p_tenant_id UUID,
    p_prefix TEXT
)
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
    v_allow_self BOOLEAN;
    v_approver_ids JSONB;
    v_bands_key TEXT;
    v_pools_key TEXT;
    v_threshold_key TEXT;
    v_self_key TEXT;
    v_approver_key TEXT;
BEGIN
    v_settings := private.fetch_approval_settings_metadata(p_tenant_id);
    v_bands_key := p_prefix || '_approval_bands';
    v_pools_key := p_prefix || '_approver_pools';
    v_threshold_key := p_prefix || '_approval_threshold_amount';
    v_self_key := p_prefix || '_allow_submitter_self_approve_below_threshold';
    v_approver_key := p_prefix || '_approver_user_ids';

    v_bands := v_settings -> v_bands_key;

    IF v_bands IS NOT NULL AND jsonb_typeof(v_bands) = 'array' AND jsonb_array_length(v_bands) > 0 THEN
        RETURN jsonb_build_object(
            'source', 'bands',
            'bands', v_bands,
            'pools', COALESCE(v_settings -> v_pools_key, '{}'::jsonb)
        );
    END IF;

    v_threshold := NULLIF(v_settings ->> v_threshold_key, '')::numeric;
    v_allow_self := COALESCE((v_settings ->> v_self_key)::boolean, FALSE);
    v_approver_ids := COALESCE(v_settings -> v_approver_key, '[]'::jsonb);

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

CREATE OR REPLACE FUNCTION private.resolve_so_approval_policy(p_tenant_id UUID)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
    SELECT private.resolve_sales_approval_policy(p_tenant_id, 'so');
$$;

CREATE OR REPLACE FUNCTION private.resolve_quote_approval_policy(p_tenant_id UUID)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
    SELECT private.resolve_sales_approval_policy(p_tenant_id, 'quote');
$$;

CREATE OR REPLACE FUNCTION private.resolve_invoice_approval_policy(p_tenant_id UUID)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
    SELECT private.resolve_sales_approval_policy(p_tenant_id, 'invoice');
$$;

CREATE OR REPLACE FUNCTION private.sales_self_approve_allowed(
    p_tenant_id UUID,
    p_total_net_amount NUMERIC,
    p_submitter_id UUID,
    p_prefix TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_settings JSONB;
    v_threshold NUMERIC;
    v_allow_self BOOLEAN;
    v_approver_ids JSONB;
    v_require_key TEXT;
    v_threshold_key TEXT;
    v_self_key TEXT;
    v_approver_key TEXT;
BEGIN
    IF p_submitter_id IS NULL THEN
        RETURN FALSE;
    END IF;

    IF private.user_is_po_super_approver(p_submitter_id) THEN
        RETURN TRUE;
    END IF;

    v_settings := private.fetch_approval_settings_metadata(p_tenant_id);
    v_self_key := p_prefix || '_allow_submitter_self_approve_below_threshold';
    v_threshold_key := p_prefix || '_approval_threshold_amount';
    v_approver_key := p_prefix || '_approver_user_ids';

    v_allow_self := COALESCE((v_settings ->> v_self_key)::boolean, FALSE);
    IF NOT v_allow_self THEN
        RETURN FALSE;
    END IF;

    v_approver_ids := v_settings -> v_approver_key;
    IF v_approver_ids IS NULL OR jsonb_typeof(v_approver_ids) <> 'array' THEN
        RETURN FALSE;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM jsonb_array_elements_text(v_approver_ids) AS approver(id_text)
        WHERE approver.id_text::uuid = p_submitter_id
    ) THEN
        RETURN FALSE;
    END IF;

    v_threshold := NULLIF(v_settings ->> v_threshold_key, '')::numeric;
    IF v_threshold IS NULL THEN
        RETURN FALSE;
    END IF;

    RETURN COALESCE(p_total_net_amount, 0) <= v_threshold;
END;
$$;

CREATE OR REPLACE FUNCTION private.so_approval_required(
    p_tenant_id UUID,
    p_total_net_amount NUMERIC,
    p_submitter_id UUID,
    p_sales_order_id UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_settings JSONB;
    v_require BOOLEAN;
    v_policy JSONB;
    v_band JSONB;
BEGIN
    v_settings := private.fetch_approval_settings_metadata(p_tenant_id);
    v_require := COALESCE((v_settings ->> 'require_so_approval_before_confirm')::boolean, FALSE);

    IF NOT v_require THEN
        RETURN FALSE;
    END IF;

    IF private.sales_self_approve_allowed(p_tenant_id, p_total_net_amount, p_submitter_id, 'so') THEN
        RETURN FALSE;
    END IF;

    v_policy := private.resolve_so_approval_policy(p_tenant_id);
    v_band := private.resolve_po_approval_band(p_total_net_amount, v_policy);

    IF v_band IS NOT NULL AND COALESCE((v_band ->> 'skip')::boolean, FALSE) THEN
        RETURN FALSE;
    END IF;

    RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION private.quote_approval_required(
    p_tenant_id UUID,
    p_total_net_amount NUMERIC,
    p_submitter_id UUID,
    p_quotation_id UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_settings JSONB;
    v_require BOOLEAN;
    v_policy JSONB;
    v_band JSONB;
BEGIN
    v_settings := private.fetch_approval_settings_metadata(p_tenant_id);
    v_require := COALESCE((v_settings ->> 'require_quote_approval_before_convert')::boolean, FALSE);

    IF NOT v_require THEN
        RETURN FALSE;
    END IF;

    IF private.sales_self_approve_allowed(p_tenant_id, p_total_net_amount, p_submitter_id, 'quote') THEN
        RETURN FALSE;
    END IF;

    v_policy := private.resolve_quote_approval_policy(p_tenant_id);
    v_band := private.resolve_po_approval_band(p_total_net_amount, v_policy);

    IF v_band IS NOT NULL AND COALESCE((v_band ->> 'skip')::boolean, FALSE) THEN
        RETURN FALSE;
    END IF;

    RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION private.invoice_approval_required(
    p_tenant_id UUID,
    p_total_net_amount NUMERIC,
    p_submitter_id UUID,
    p_sales_invoice_id UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_settings JSONB;
    v_require BOOLEAN;
    v_policy JSONB;
    v_band JSONB;
BEGIN
    v_settings := private.fetch_approval_settings_metadata(p_tenant_id);
    v_require := COALESCE((v_settings ->> 'require_invoice_approval_before_post')::boolean, FALSE);

    IF NOT v_require THEN
        RETURN FALSE;
    END IF;

    IF private.sales_self_approve_allowed(p_tenant_id, p_total_net_amount, p_submitter_id, 'invoice') THEN
        RETURN FALSE;
    END IF;

    v_policy := private.resolve_invoice_approval_policy(p_tenant_id);
    v_band := private.resolve_po_approval_band(p_total_net_amount, v_policy);

    IF v_band IS NOT NULL AND COALESCE((v_band ->> 'skip')::boolean, FALSE) THEN
        RETURN FALSE;
    END IF;

    RETURN TRUE;
END;
$$;

-- --------------------------------------------------------------------
-- 3. Materialize approval runs + notifications
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.materialize_sales_approval_run(
    p_tenant_id UUID,
    p_document_type TEXT,
    p_document_id UUID,
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
    v_user_id UUID;
    v_user_ids UUID[];
BEGIN
    INSERT INTO public.document_approval_runs (
        tenant_id, document_type, document_id, status,
        policy_snapshot, amount_basis, currency_code, submitted_by
    )
    VALUES (
        p_tenant_id, p_document_type, p_document_id, 'PENDING',
        p_policy, COALESCE(p_amount, 0), COALESCE(p_currency, 'INR'), p_submitter_id
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

            INSERT INTO public.document_approval_run_steps (
                tenant_id, run_id, level_index, step_index, step_label,
                quorum_mode, min_approvals, status, opened_at
            )
            VALUES (
                p_tenant_id, v_run_id, v_level_idx, v_step_idx,
                COALESCE(v_step ->> 'label', 'Approval'),
                v_quorum, 1,
                CASE WHEN v_level_idx = 0 THEN 'PENDING' ELSE 'LOCKED' END,
                CASE WHEN v_level_idx = 0 THEN NOW() ELSE NULL END
            )
            RETURNING id INTO v_step_id;

            v_user_ids := private.resolve_approval_step_user_ids(
                p_tenant_id, p_submitter_id, v_step, p_policy
            );

            IF COALESCE(array_length(v_user_ids, 1), 0) = 0 THEN
                v_user_ids := private.pool_user_ids(p_policy, COALESCE(v_step ->> 'pool', 'default'));
            END IF;

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
                VALUES (p_tenant_id, v_step_id, v_user_id, v_quorum = 'ALL')
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

    RETURN v_run_id;
END;
$$;

CREATE OR REPLACE FUNCTION private.materialize_so_approval_run(
    p_tenant_id UUID, p_so_id UUID, p_submitter_id UUID,
    p_amount NUMERIC, p_currency TEXT, p_policy JSONB, p_band JSONB
)
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, private
AS $$
    SELECT private.materialize_sales_approval_run(
        p_tenant_id, 'SALES_ORDER', p_so_id, p_submitter_id,
        p_amount, p_currency, p_policy, p_band
    );
$$;

CREATE OR REPLACE FUNCTION private.materialize_quote_approval_run(
    p_tenant_id UUID, p_quotation_id UUID, p_submitter_id UUID,
    p_amount NUMERIC, p_currency TEXT, p_policy JSONB, p_band JSONB
)
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, private
AS $$
    SELECT private.materialize_sales_approval_run(
        p_tenant_id, 'SALES_QUOTATION', p_quotation_id, p_submitter_id,
        p_amount, p_currency, p_policy, p_band
    );
$$;

CREATE OR REPLACE FUNCTION private.materialize_invoice_approval_run(
    p_tenant_id UUID, p_invoice_id UUID, p_submitter_id UUID,
    p_amount NUMERIC, p_currency TEXT, p_policy JSONB, p_band JSONB
)
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, private
AS $$
    SELECT private.materialize_sales_approval_run(
        p_tenant_id, 'SALES_INVOICE', p_invoice_id, p_submitter_id,
        p_amount, p_currency, p_policy, p_band
    );
$$;

CREATE OR REPLACE FUNCTION private.notify_sales_approval_step_assignees(
    p_tenant_id UUID,
    p_run_id UUID,
    p_document_type TEXT,
    p_document_id UUID,
    p_voucher TEXT,
    p_event_code TEXT,
    p_action_path TEXT,
    p_doc_label TEXT
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
    v_url := p_action_path || p_document_id::text;

    FOR v_assignee IN
        SELECT DISTINCT a.user_id
        FROM public.document_approval_run_steps s
        JOIN public.document_approval_run_step_assignees a ON a.step_id = s.id
        WHERE s.run_id = p_run_id
          AND s.tenant_id = p_tenant_id
          AND s.status = 'PENDING'
    LOOP
        IF p_event_code = 'approval.step_opened' THEN
            v_title := 'Approval required — ' || COALESCE(p_voucher, p_doc_label);
            v_body := 'A ' || lower(p_doc_label) || ' needs your approval.';
        ELSE
            v_title := COALESCE(p_voucher, p_doc_label) || ' submitted for approval';
            v_body := 'Your ' || lower(p_doc_label) || ' was submitted for approval.';
        END IF;

        PERFORM private.create_in_app_notification(
            p_tenant_id, v_assignee.user_id, p_event_code,
            v_title, v_body, v_url, p_document_type, p_document_id, p_run_id
        );
    END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION private.notify_so_approval_step_assignees(
    p_tenant_id UUID, p_run_id UUID, p_so_id UUID, p_voucher TEXT, p_event_code TEXT
)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, private
AS $$
    SELECT private.notify_sales_approval_step_assignees(
        p_tenant_id, p_run_id, 'SALES_ORDER', p_so_id, p_voucher, p_event_code,
        '/sales/orders?id=', 'sales order'
    );
$$;

CREATE OR REPLACE FUNCTION private.notify_quote_approval_step_assignees(
    p_tenant_id UUID, p_run_id UUID, p_quotation_id UUID, p_voucher TEXT, p_event_code TEXT
)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, private
AS $$
    SELECT private.notify_sales_approval_step_assignees(
        p_tenant_id, p_run_id, 'SALES_QUOTATION', p_quotation_id, p_voucher, p_event_code,
        '/sales/quotations?id=', 'sales quotation'
    );
$$;

CREATE OR REPLACE FUNCTION private.notify_invoice_approval_step_assignees(
    p_tenant_id UUID, p_run_id UUID, p_invoice_id UUID, p_voucher TEXT, p_event_code TEXT
)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, private
AS $$
    SELECT private.notify_sales_approval_step_assignees(
        p_tenant_id, p_run_id, 'SALES_INVOICE', p_invoice_id, p_voucher, p_event_code,
        '/sales/invoices?id=', 'sales invoice'
    );
$$;

CREATE OR REPLACE FUNCTION private.user_can_approve_sales_document_amount(
    p_user_id UUID,
    p_tenant_id UUID,
    p_total_net_amount NUMERIC,
    p_prefix TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_settings JSONB;
    v_threshold NUMERIC;
    v_approver_ids JSONB;
    v_threshold_key TEXT;
    v_approver_key TEXT;
BEGIN
    IF p_user_id IS NULL OR p_tenant_id IS NULL THEN
        RETURN FALSE;
    END IF;

    IF private.user_is_po_super_approver(p_user_id) THEN
        RETURN TRUE;
    END IF;

    v_settings := private.fetch_approval_settings_metadata(p_tenant_id);
    v_threshold_key := p_prefix || '_approval_threshold_amount';
    v_approver_key := p_prefix || '_approver_user_ids';
    v_approver_ids := v_settings -> v_approver_key;

    IF v_approver_ids IS NULL OR jsonb_typeof(v_approver_ids) <> 'array' THEN
        RETURN FALSE;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM jsonb_array_elements_text(v_approver_ids) AS approver(id_text)
        WHERE approver.id_text::uuid = p_user_id
    ) THEN
        RETURN FALSE;
    END IF;

    v_threshold := NULLIF(v_settings ->> v_threshold_key, '')::numeric;
    IF v_threshold IS NULL THEN
        RETURN TRUE;
    END IF;

    RETURN COALESCE(p_total_net_amount, 0) <= v_threshold;
END;
$$;

-- --------------------------------------------------------------------
-- 4. Sales order approval trio
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.submit_sales_order_for_approval(p_sales_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_tenant_id UUID;
    v_user_id UUID;
    v_so RECORD;
    v_request_id UUID;
    v_run_id UUID;
    v_policy JSONB;
    v_band JSONB;
BEGIN
    v_tenant_id := private.current_tenant_id();
    v_user_id := auth.uid();

    IF v_tenant_id IS NULL OR v_user_id IS NULL THEN
        RAISE EXCEPTION 'tenant context missing from session';
    END IF;

    IF NOT private.can_edit_sales_orders() THEN
        RAISE EXCEPTION 'sales order edit permission required';
    END IF;

    SELECT * INTO v_so
    FROM public.sales_orders
    WHERE id = p_sales_order_id AND tenant_id = v_tenant_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'sales order not found';
    END IF;

    IF v_so.commercial_status <> 'DRAFT'::public.sales_document_status THEN
        RAISE EXCEPTION 'only draft sales orders can be submitted for approval';
    END IF;

    IF NOT private.so_approval_required(v_tenant_id, v_so.total_net_amount, v_user_id, p_sales_order_id) THEN
        RAISE EXCEPTION 'approval is not required for this sales order; confirm it directly';
    END IF;

    v_policy := private.resolve_so_approval_policy(v_tenant_id);
    v_band := private.resolve_po_approval_band(v_so.total_net_amount, v_policy);

    IF v_band IS NULL OR COALESCE((v_band ->> 'skip')::boolean, FALSE) THEN
        RAISE EXCEPTION 'approval is not required for this sales order; confirm it directly';
    END IF;

    IF COALESCE((v_band ->> 'skip')::boolean, FALSE) THEN
        v_band := private.resolve_po_approval_non_skip_band(v_so.total_net_amount, v_policy);
    END IF;

    v_run_id := private.materialize_so_approval_run(
        v_tenant_id, p_sales_order_id, v_user_id,
        v_so.total_net_amount, v_so.currency_code, v_policy, v_band
    );

    INSERT INTO public.document_approval_requests (
        tenant_id, document_type, document_id, status, submitted_by
    )
    VALUES (v_tenant_id, 'SALES_ORDER', p_sales_order_id, 'PENDING', v_user_id)
    RETURNING id INTO v_request_id;

    UPDATE public.sales_orders
    SET commercial_status = 'PENDING_APPROVAL'::public.sales_document_status,
        updated_at = NOW()
    WHERE id = p_sales_order_id;

    PERFORM private.create_in_app_notification(
        v_tenant_id, v_user_id, 'approval.submitted',
        'Submitted — ' || v_so.voucher_number,
        'Your sales order was submitted for approval.',
        '/sales/orders?id=' || p_sales_order_id::text,
        'SALES_ORDER', p_sales_order_id, v_run_id
    );

    PERFORM private.notify_so_approval_step_assignees(
        v_tenant_id, v_run_id, p_sales_order_id, v_so.voucher_number, 'approval.step_opened'
    );

    RETURN jsonb_build_object(
        'sales_order_id', p_sales_order_id,
        'approval_request_id', v_request_id,
        'approval_run_id', v_run_id
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.approve_sales_order(p_sales_order_id UUID, p_notes TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_tenant_id UUID; v_user_id UUID; v_so RECORD; v_request_id UUID; v_submitter_id UUID;
    v_run RECORD; v_step RECORD; v_notes TEXT; v_run_complete BOOLEAN;
BEGIN
    v_tenant_id := private.current_tenant_id(); v_user_id := auth.uid();
    IF v_tenant_id IS NULL OR v_user_id IS NULL THEN RAISE EXCEPTION 'tenant context missing from session'; END IF;
    SELECT * INTO v_so FROM public.sales_orders WHERE id = p_sales_order_id AND tenant_id = v_tenant_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'sales order not found'; END IF;
    IF NOT private.user_can_approve_sales_document_amount(v_user_id, v_tenant_id, v_so.total_net_amount, 'so') THEN
        RAISE EXCEPTION 'sales order approver permission required for this amount';
    END IF;
    IF v_so.commercial_status <> 'PENDING_APPROVAL'::public.sales_document_status THEN
        RAISE EXCEPTION 'only pending-approval sales orders can be approved';
    END IF;
    SELECT dar.id, dar.submitted_by INTO v_request_id, v_submitter_id
    FROM public.document_approval_requests dar
    WHERE dar.tenant_id = v_tenant_id AND dar.document_type = 'SALES_ORDER'
      AND dar.document_id = p_sales_order_id AND dar.status = 'PENDING'
    ORDER BY dar.submitted_at DESC LIMIT 1;
    IF v_request_id IS NULL THEN RAISE EXCEPTION 'pending approval request not found'; END IF;
    SELECT * INTO v_run FROM public.document_approval_runs r
    WHERE r.tenant_id = v_tenant_id AND r.document_type = 'SALES_ORDER'
      AND r.document_id = p_sales_order_id AND r.status = 'PENDING'
    ORDER BY r.submitted_at DESC LIMIT 1;
    v_notes := NULLIF(BTRIM(p_notes), '');
    IF FOUND THEN
        SELECT s.* INTO v_step FROM public.document_approval_run_steps s
        JOIN public.document_approval_run_step_assignees a ON a.step_id = s.id AND a.user_id = v_user_id
        WHERE s.run_id = v_run.id AND s.status = 'PENDING'
        ORDER BY s.level_index, s.step_index LIMIT 1;
        IF v_step.id IS NULL AND NOT private.user_is_po_super_approver(v_user_id) THEN
            RAISE EXCEPTION 'no pending approval step assigned to you';
        END IF;
        IF v_step.id IS NOT NULL THEN
            INSERT INTO public.document_approval_step_decisions (tenant_id, step_id, user_id, decision, notes)
            VALUES (v_tenant_id, v_step.id, v_user_id, 'APPROVED', v_notes)
            ON CONFLICT (step_id, user_id) DO UPDATE SET decision = 'APPROVED', notes = EXCLUDED.notes, decided_at = NOW();
            PERFORM private.satisfy_approval_step_if_quorum_met(v_step.id);
            PERFORM private.advance_approval_run(v_run.id);
        ELSIF private.user_is_po_super_approver(v_user_id) THEN
            UPDATE public.document_approval_run_steps SET status = 'SATISFIED', satisfied_at = NOW(), updated_at = NOW()
            WHERE run_id = v_run.id AND status IN ('PENDING', 'LOCKED');
            UPDATE public.document_approval_runs SET status = 'APPROVED', completed_at = NOW(), updated_at = NOW() WHERE id = v_run.id;
        END IF;
        SELECT status = 'APPROVED' INTO v_run_complete FROM public.document_approval_runs WHERE id = v_run.id;
        IF NOT v_run_complete THEN
            PERFORM private.notify_so_approval_step_assignees(v_tenant_id, v_run.id, p_sales_order_id, v_so.voucher_number, 'approval.step_opened');
            RETURN jsonb_build_object('sales_order_id', p_sales_order_id, 'pending_next_step', TRUE);
        END IF;
    END IF;
    UPDATE public.document_approval_requests SET status = 'APPROVED', decided_by = v_user_id, decided_at = NOW(), decision_notes = v_notes, updated_at = NOW() WHERE id = v_request_id;
    INSERT INTO public.document_approvals (tenant_id, document_type, document_id, approved_by, approved_at, notes)
    VALUES (v_tenant_id, 'SALES_ORDER', p_sales_order_id, v_user_id, NOW(), v_notes);
    PERFORM private.create_in_app_notification(v_tenant_id, v_submitter_id, 'approval.approved', 'Approved — ' || v_so.voucher_number,
        'Your sales order was fully approved.', '/sales/orders?id=' || p_sales_order_id::text, 'SALES_ORDER', p_sales_order_id, v_run.id);
    RETURN jsonb_build_object('sales_order_id', p_sales_order_id, 'approved', TRUE);
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_sales_order(p_sales_order_id UUID, p_notes TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_tenant_id UUID; v_user_id UUID; v_so RECORD; v_request_id UUID; v_submitter_id UUID; v_run RECORD; v_notes TEXT;
BEGIN
    v_tenant_id := private.current_tenant_id(); v_user_id := auth.uid();
    IF v_tenant_id IS NULL OR v_user_id IS NULL THEN RAISE EXCEPTION 'tenant context missing from session'; END IF;
    SELECT * INTO v_so FROM public.sales_orders WHERE id = p_sales_order_id AND tenant_id = v_tenant_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'sales order not found'; END IF;
    v_notes := NULLIF(BTRIM(p_notes), '');
    IF v_notes IS NULL THEN RAISE EXCEPTION 'rejection reason is required'; END IF;
    SELECT dar.id, dar.submitted_by INTO v_request_id, v_submitter_id
    FROM public.document_approval_requests dar
    WHERE dar.tenant_id = v_tenant_id AND dar.document_type = 'SALES_ORDER'
      AND dar.document_id = p_sales_order_id AND dar.status = 'PENDING'
    ORDER BY dar.submitted_at DESC LIMIT 1;
    IF v_request_id IS NULL THEN RAISE EXCEPTION 'pending approval request not found'; END IF;
    SELECT * INTO v_run FROM public.document_approval_runs r
    WHERE r.tenant_id = v_tenant_id AND r.document_type = 'SALES_ORDER'
      AND r.document_id = p_sales_order_id AND r.status = 'PENDING'
    ORDER BY r.submitted_at DESC LIMIT 1;
    IF FOUND THEN
        UPDATE public.document_approval_runs SET status = 'REJECTED', completed_at = NOW(), updated_at = NOW() WHERE id = v_run.id;
        UPDATE public.document_approval_run_steps SET status = 'REJECTED', updated_at = NOW()
        WHERE run_id = v_run.id AND status IN ('PENDING', 'LOCKED');
    END IF;
    UPDATE public.document_approval_requests SET status = 'REJECTED', decided_by = v_user_id, decided_at = NOW(), decision_notes = v_notes, updated_at = NOW() WHERE id = v_request_id;
    UPDATE public.sales_orders SET commercial_status = 'DRAFT'::public.sales_document_status, updated_at = NOW() WHERE id = p_sales_order_id;
    PERFORM private.create_in_app_notification(v_tenant_id, v_submitter_id, 'approval.rejected', 'Rejected — ' || v_so.voucher_number,
        'Reason: ' || v_notes, '/sales/orders?id=' || p_sales_order_id::text, 'SALES_ORDER', p_sales_order_id, v_run.id);
    RETURN jsonb_build_object('sales_order_id', p_sales_order_id);
END;
$$;

-- --------------------------------------------------------------------
-- 5. Quotation approval trio
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.submit_sales_quotation_for_approval(p_quotation_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE v_tenant_id UUID; v_user_id UUID; v_doc RECORD; v_request_id UUID; v_run_id UUID; v_policy JSONB; v_band JSONB;
BEGIN
    v_tenant_id := private.current_tenant_id(); v_user_id := auth.uid();
    IF v_tenant_id IS NULL OR v_user_id IS NULL THEN RAISE EXCEPTION 'tenant context missing from session'; END IF;
    IF NOT private.can_edit_sales_orders() THEN RAISE EXCEPTION 'sales quotation edit permission required'; END IF;
    SELECT * INTO v_doc FROM public.sales_quotations WHERE id = p_quotation_id AND tenant_id = v_tenant_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'sales quotation not found'; END IF;
    IF v_doc.commercial_status <> 'DRAFT'::public.sales_document_status THEN RAISE EXCEPTION 'only draft quotations can be submitted for approval'; END IF;
    IF NOT private.quote_approval_required(v_tenant_id, v_doc.total_net_amount, v_user_id, p_quotation_id) THEN
        RAISE EXCEPTION 'approval is not required for this quotation';
    END IF;
    v_policy := private.resolve_quote_approval_policy(v_tenant_id);
    v_band := private.resolve_po_approval_band(v_doc.total_net_amount, v_policy);
    IF v_band IS NULL OR COALESCE((v_band ->> 'skip')::boolean, FALSE) THEN RAISE EXCEPTION 'approval is not required for this quotation'; END IF;
    v_run_id := private.materialize_quote_approval_run(v_tenant_id, p_quotation_id, v_user_id, v_doc.total_net_amount, v_doc.currency_code, v_policy, v_band);
    INSERT INTO public.document_approval_requests (tenant_id, document_type, document_id, status, submitted_by)
    VALUES (v_tenant_id, 'SALES_QUOTATION', p_quotation_id, 'PENDING', v_user_id) RETURNING id INTO v_request_id;
    UPDATE public.sales_quotations SET commercial_status = 'PENDING_APPROVAL'::public.sales_document_status, updated_at = NOW() WHERE id = p_quotation_id;
    PERFORM private.notify_quote_approval_step_assignees(v_tenant_id, v_run_id, p_quotation_id, v_doc.quotation_number, 'approval.step_opened');
    RETURN jsonb_build_object('quotation_id', p_quotation_id, 'approval_request_id', v_request_id, 'approval_run_id', v_run_id);
END; $$;

CREATE OR REPLACE FUNCTION public.approve_sales_quotation(p_quotation_id UUID, p_notes TEXT DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE v_tenant_id UUID; v_user_id UUID; v_doc RECORD; v_request_id UUID; v_run RECORD; v_step RECORD; v_notes TEXT; v_run_complete BOOLEAN;
BEGIN
    v_tenant_id := private.current_tenant_id(); v_user_id := auth.uid();
    SELECT * INTO v_doc FROM public.sales_quotations WHERE id = p_quotation_id AND tenant_id = v_tenant_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'sales quotation not found'; END IF;
    IF NOT private.user_can_approve_sales_document_amount(v_user_id, v_tenant_id, v_doc.total_net_amount, 'quote') THEN
        RAISE EXCEPTION 'quotation approver permission required';
    END IF;
    SELECT dar.id INTO v_request_id FROM public.document_approval_requests dar
    WHERE dar.tenant_id = v_tenant_id AND dar.document_type = 'SALES_QUOTATION' AND dar.document_id = p_quotation_id AND dar.status = 'PENDING'
    ORDER BY dar.submitted_at DESC LIMIT 1;
    SELECT * INTO v_run FROM public.document_approval_runs r
    WHERE r.tenant_id = v_tenant_id AND r.document_type = 'SALES_QUOTATION' AND r.document_id = p_quotation_id AND r.status = 'PENDING'
    ORDER BY r.submitted_at DESC LIMIT 1;
    v_notes := NULLIF(BTRIM(p_notes), '');
    IF FOUND THEN
        SELECT s.* INTO v_step FROM public.document_approval_run_steps s
        JOIN public.document_approval_run_step_assignees a ON a.step_id = s.id AND a.user_id = v_user_id
        WHERE s.run_id = v_run.id AND s.status = 'PENDING' ORDER BY s.level_index, s.step_index LIMIT 1;
        IF v_step.id IS NOT NULL THEN
            INSERT INTO public.document_approval_step_decisions (tenant_id, step_id, user_id, decision, notes)
            VALUES (v_tenant_id, v_step.id, v_user_id, 'APPROVED', v_notes)
            ON CONFLICT (step_id, user_id) DO UPDATE SET decision = 'APPROVED', notes = EXCLUDED.notes, decided_at = NOW();
            PERFORM private.satisfy_approval_step_if_quorum_met(v_step.id);
            PERFORM private.advance_approval_run(v_run.id);
        ELSIF private.user_is_po_super_approver(v_user_id) THEN
            UPDATE public.document_approval_run_steps SET status = 'SATISFIED', satisfied_at = NOW(), updated_at = NOW()
            WHERE run_id = v_run.id AND status IN ('PENDING', 'LOCKED');
            UPDATE public.document_approval_runs SET status = 'APPROVED', completed_at = NOW(), updated_at = NOW() WHERE id = v_run.id;
        ELSE RAISE EXCEPTION 'no pending approval step assigned to you'; END IF;
        SELECT status = 'APPROVED' INTO v_run_complete FROM public.document_approval_runs WHERE id = v_run.id;
        IF NOT v_run_complete THEN
            PERFORM private.notify_quote_approval_step_assignees(v_tenant_id, v_run.id, p_quotation_id, v_doc.quotation_number, 'approval.step_opened');
            RETURN jsonb_build_object('quotation_id', p_quotation_id, 'pending_next_step', TRUE);
        END IF;
    END IF;
    UPDATE public.document_approval_requests SET status = 'APPROVED', decided_by = v_user_id, decided_at = NOW(), decision_notes = v_notes, updated_at = NOW() WHERE id = v_request_id;
    UPDATE public.sales_quotations SET commercial_status = 'APPROVED_ACTIVE'::public.sales_document_status, updated_at = NOW() WHERE id = p_quotation_id;
    RETURN jsonb_build_object('quotation_id', p_quotation_id, 'approved', TRUE);
END; $$;

CREATE OR REPLACE FUNCTION public.reject_sales_quotation(p_quotation_id UUID, p_notes TEXT DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE v_tenant_id UUID; v_user_id UUID; v_doc RECORD; v_request_id UUID; v_run RECORD; v_notes TEXT;
BEGIN
    v_tenant_id := private.current_tenant_id(); v_user_id := auth.uid();
    v_notes := NULLIF(BTRIM(p_notes), '');
    IF v_notes IS NULL THEN RAISE EXCEPTION 'rejection reason is required'; END IF;
    SELECT * INTO v_doc FROM public.sales_quotations WHERE id = p_quotation_id AND tenant_id = v_tenant_id;
    SELECT dar.id INTO v_request_id FROM public.document_approval_requests dar
    WHERE dar.tenant_id = v_tenant_id AND dar.document_type = 'SALES_QUOTATION' AND dar.document_id = p_quotation_id AND dar.status = 'PENDING'
    ORDER BY dar.submitted_at DESC LIMIT 1;
    SELECT * INTO v_run FROM public.document_approval_runs r
    WHERE r.tenant_id = v_tenant_id AND r.document_type = 'SALES_QUOTATION' AND r.document_id = p_quotation_id AND r.status = 'PENDING'
    ORDER BY r.submitted_at DESC LIMIT 1;
    IF FOUND THEN
        UPDATE public.document_approval_runs SET status = 'REJECTED', completed_at = NOW(), updated_at = NOW() WHERE id = v_run.id;
        UPDATE public.document_approval_run_steps SET status = 'REJECTED', updated_at = NOW() WHERE run_id = v_run.id AND status IN ('PENDING', 'LOCKED');
    END IF;
    UPDATE public.document_approval_requests SET status = 'REJECTED', decided_by = v_user_id, decided_at = NOW(), decision_notes = v_notes, updated_at = NOW() WHERE id = v_request_id;
    UPDATE public.sales_quotations SET commercial_status = 'DRAFT'::public.sales_document_status, updated_at = NOW() WHERE id = p_quotation_id;
    RETURN jsonb_build_object('quotation_id', p_quotation_id);
END; $$;

-- --------------------------------------------------------------------
-- 6. Invoice approval trio
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.submit_sales_invoice_for_approval(p_sales_invoice_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE v_tenant_id UUID; v_user_id UUID; v_doc RECORD; v_request_id UUID; v_run_id UUID; v_policy JSONB; v_band JSONB;
BEGIN
    v_tenant_id := private.current_tenant_id(); v_user_id := auth.uid();
    IF NOT private.can_edit_sales_orders() THEN RAISE EXCEPTION 'sales invoice edit permission required'; END IF;
    SELECT * INTO v_doc FROM public.sales_invoices WHERE id = p_sales_invoice_id AND tenant_id = v_tenant_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'sales invoice not found'; END IF;
    IF v_doc.commercial_status <> 'DRAFT'::public.sales_document_status THEN RAISE EXCEPTION 'only draft invoices can be submitted for approval'; END IF;
    IF NOT private.invoice_approval_required(v_tenant_id, v_doc.total_net_amount, v_user_id, p_sales_invoice_id) THEN
        RAISE EXCEPTION 'approval is not required for this invoice; post it directly';
    END IF;
    v_policy := private.resolve_invoice_approval_policy(v_tenant_id);
    v_band := private.resolve_po_approval_band(v_doc.total_net_amount, v_policy);
    IF v_band IS NULL OR COALESCE((v_band ->> 'skip')::boolean, FALSE) THEN RAISE EXCEPTION 'approval is not required for this invoice'; END IF;
    v_run_id := private.materialize_invoice_approval_run(v_tenant_id, p_sales_invoice_id, v_user_id, v_doc.total_net_amount, v_doc.currency_code, v_policy, v_band);
    INSERT INTO public.document_approval_requests (tenant_id, document_type, document_id, status, submitted_by)
    VALUES (v_tenant_id, 'SALES_INVOICE', p_sales_invoice_id, 'PENDING', v_user_id) RETURNING id INTO v_request_id;
    UPDATE public.sales_invoices SET commercial_status = 'PENDING_APPROVAL'::public.sales_document_status, updated_at = NOW() WHERE id = p_sales_invoice_id;
    PERFORM private.notify_invoice_approval_step_assignees(v_tenant_id, v_run_id, p_sales_invoice_id, v_doc.invoice_number, 'approval.step_opened');
    RETURN jsonb_build_object('sales_invoice_id', p_sales_invoice_id, 'approval_request_id', v_request_id, 'approval_run_id', v_run_id);
END; $$;

CREATE OR REPLACE FUNCTION public.approve_sales_invoice(p_sales_invoice_id UUID, p_notes TEXT DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE v_tenant_id UUID; v_user_id UUID; v_doc RECORD; v_request_id UUID; v_run RECORD; v_step RECORD; v_notes TEXT; v_run_complete BOOLEAN;
BEGIN
    v_tenant_id := private.current_tenant_id(); v_user_id := auth.uid();
    SELECT * INTO v_doc FROM public.sales_invoices WHERE id = p_sales_invoice_id AND tenant_id = v_tenant_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'sales invoice not found'; END IF;
    IF NOT private.user_can_approve_sales_document_amount(v_user_id, v_tenant_id, v_doc.total_net_amount, 'invoice') THEN
        RAISE EXCEPTION 'invoice approver permission required';
    END IF;
    SELECT dar.id INTO v_request_id FROM public.document_approval_requests dar
    WHERE dar.tenant_id = v_tenant_id AND dar.document_type = 'SALES_INVOICE' AND dar.document_id = p_sales_invoice_id AND dar.status = 'PENDING'
    ORDER BY dar.submitted_at DESC LIMIT 1;
    SELECT * INTO v_run FROM public.document_approval_runs r
    WHERE r.tenant_id = v_tenant_id AND r.document_type = 'SALES_INVOICE' AND r.document_id = p_sales_invoice_id AND r.status = 'PENDING'
    ORDER BY r.submitted_at DESC LIMIT 1;
    v_notes := NULLIF(BTRIM(p_notes), '');
    IF FOUND THEN
        SELECT s.* INTO v_step FROM public.document_approval_run_steps s
        JOIN public.document_approval_run_step_assignees a ON a.step_id = s.id AND a.user_id = v_user_id
        WHERE s.run_id = v_run.id AND s.status = 'PENDING' ORDER BY s.level_index, s.step_index LIMIT 1;
        IF v_step.id IS NOT NULL THEN
            INSERT INTO public.document_approval_step_decisions (tenant_id, step_id, user_id, decision, notes)
            VALUES (v_tenant_id, v_step.id, v_user_id, 'APPROVED', v_notes)
            ON CONFLICT (step_id, user_id) DO UPDATE SET decision = 'APPROVED', notes = EXCLUDED.notes, decided_at = NOW();
            PERFORM private.satisfy_approval_step_if_quorum_met(v_step.id);
            PERFORM private.advance_approval_run(v_run.id);
        ELSIF private.user_is_po_super_approver(v_user_id) THEN
            UPDATE public.document_approval_run_steps SET status = 'SATISFIED', satisfied_at = NOW(), updated_at = NOW()
            WHERE run_id = v_run.id AND status IN ('PENDING', 'LOCKED');
            UPDATE public.document_approval_runs SET status = 'APPROVED', completed_at = NOW(), updated_at = NOW() WHERE id = v_run.id;
        ELSE RAISE EXCEPTION 'no pending approval step assigned to you'; END IF;
        SELECT status = 'APPROVED' INTO v_run_complete FROM public.document_approval_runs WHERE id = v_run.id;
        IF NOT v_run_complete THEN
            PERFORM private.notify_invoice_approval_step_assignees(v_tenant_id, v_run.id, p_sales_invoice_id, v_doc.invoice_number, 'approval.step_opened');
            RETURN jsonb_build_object('sales_invoice_id', p_sales_invoice_id, 'pending_next_step', TRUE);
        END IF;
    END IF;
    UPDATE public.document_approval_requests SET status = 'APPROVED', decided_by = v_user_id, decided_at = NOW(), decision_notes = v_notes, updated_at = NOW() WHERE id = v_request_id;
    RETURN jsonb_build_object('sales_invoice_id', p_sales_invoice_id, 'approved', TRUE);
END; $$;

CREATE OR REPLACE FUNCTION public.reject_sales_invoice(p_sales_invoice_id UUID, p_notes TEXT DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE v_tenant_id UUID; v_user_id UUID; v_request_id UUID; v_run RECORD; v_notes TEXT;
BEGIN
    v_tenant_id := private.current_tenant_id(); v_user_id := auth.uid();
    v_notes := NULLIF(BTRIM(p_notes), '');
    IF v_notes IS NULL THEN RAISE EXCEPTION 'rejection reason is required'; END IF;
    SELECT dar.id INTO v_request_id FROM public.document_approval_requests dar
    WHERE dar.tenant_id = v_tenant_id AND dar.document_type = 'SALES_INVOICE' AND dar.document_id = p_sales_invoice_id AND dar.status = 'PENDING'
    ORDER BY dar.submitted_at DESC LIMIT 1;
    SELECT * INTO v_run FROM public.document_approval_runs r
    WHERE r.tenant_id = v_tenant_id AND r.document_type = 'SALES_INVOICE' AND r.document_id = p_sales_invoice_id AND r.status = 'PENDING'
    ORDER BY r.submitted_at DESC LIMIT 1;
    IF FOUND THEN
        UPDATE public.document_approval_runs SET status = 'REJECTED', completed_at = NOW(), updated_at = NOW() WHERE id = v_run.id;
        UPDATE public.document_approval_run_steps SET status = 'REJECTED', updated_at = NOW() WHERE run_id = v_run.id AND status IN ('PENDING', 'LOCKED');
    END IF;
    UPDATE public.document_approval_requests SET status = 'REJECTED', decided_by = v_user_id, decided_at = NOW(), decision_notes = v_notes, updated_at = NOW() WHERE id = v_request_id;
    UPDATE public.sales_invoices SET commercial_status = 'DRAFT'::public.sales_document_status, updated_at = NOW() WHERE id = p_sales_invoice_id;
    RETURN jsonb_build_object('sales_invoice_id', p_sales_invoice_id);
END; $$;

-- --------------------------------------------------------------------
-- 7. Approval task queue (sales + PO)
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fetch_my_approval_tasks(p_limit INTEGER DEFAULT 50)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, private AS $$
DECLARE v_tenant_id UUID; v_user_id UUID; v_rows JSONB;
BEGIN
    v_tenant_id := private.current_tenant_id(); v_user_id := auth.uid();
    IF v_tenant_id IS NULL OR v_user_id IS NULL THEN RETURN '[]'::jsonb; END IF;
    SELECT COALESCE(jsonb_agg(task_row ORDER BY submitted_at DESC), '[]'::jsonb) INTO v_rows
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
            'voucher_number', COALESCE(po.voucher_number, so.voucher_number, sq.quotation_number, si.invoice_number),
            'party_name', COALESCE(e_po.name, e_so.name, e_sq.name, e_si.name)
        ) AS task_row, r.submitted_at
        FROM public.document_approval_runs r
        JOIN public.document_approval_run_steps s ON s.run_id = r.id AND s.status = 'PENDING'
        JOIN public.document_approval_run_step_assignees a ON a.step_id = s.id AND a.user_id = v_user_id
        LEFT JOIN public.purchase_orders po ON r.document_type = 'PURCHASE_ORDER' AND po.id = r.document_id
        LEFT JOIN public.entities e_po ON po.supplier_id = e_po.id
        LEFT JOIN public.sales_orders so ON r.document_type = 'SALES_ORDER' AND so.id = r.document_id
        LEFT JOIN public.entities e_so ON so.customer_id = e_so.id
        LEFT JOIN public.sales_quotations sq ON r.document_type = 'SALES_QUOTATION' AND sq.id = r.document_id
        LEFT JOIN public.entities e_sq ON sq.customer_id = e_sq.id
        LEFT JOIN public.sales_invoices si ON r.document_type = 'SALES_INVOICE' AND si.id = r.document_id
        LEFT JOIN public.entities e_si ON si.customer_id = e_si.id
        WHERE r.tenant_id = v_tenant_id AND r.status = 'PENDING'
        ORDER BY r.submitted_at DESC
        LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 50), 100))
    ) sub;
    RETURN v_rows;
END; $$;

REVOKE ALL ON FUNCTION public.fetch_my_approval_tasks(INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fetch_my_approval_tasks(INTEGER) TO authenticated;

REVOKE ALL ON FUNCTION public.submit_sales_order_for_approval(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_sales_order_for_approval(UUID) TO authenticated;
REVOKE ALL ON FUNCTION public.approve_sales_order(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.approve_sales_order(UUID, TEXT) TO authenticated;
REVOKE ALL ON FUNCTION public.reject_sales_order(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reject_sales_order(UUID, TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.submit_sales_quotation_for_approval(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_sales_quotation_for_approval(UUID) TO authenticated;
REVOKE ALL ON FUNCTION public.approve_sales_quotation(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.approve_sales_quotation(UUID, TEXT) TO authenticated;
REVOKE ALL ON FUNCTION public.reject_sales_quotation(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reject_sales_quotation(UUID, TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.submit_sales_invoice_for_approval(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_sales_invoice_for_approval(UUID) TO authenticated;
REVOKE ALL ON FUNCTION public.approve_sales_invoice(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.approve_sales_invoice(UUID, TEXT) TO authenticated;
REVOKE ALL ON FUNCTION public.reject_sales_invoice(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reject_sales_invoice(UUID, TEXT) TO authenticated;


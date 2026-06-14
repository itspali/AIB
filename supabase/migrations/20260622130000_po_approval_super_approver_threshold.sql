-- ====================================================================
-- PO approval: workspace owners (super approvers) may approve above threshold
-- Migration: 20260622130000_po_approval_super_approver_threshold.sql
-- ====================================================================

CREATE OR REPLACE FUNCTION private.user_is_po_super_approver(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_tenant_id UUID;
    v_role public.user_role;
BEGIN
    v_tenant_id := private.current_tenant_id();
    IF v_tenant_id IS NULL OR p_user_id IS NULL THEN
        RETURN FALSE;
    END IF;

    SELECT m.role
    INTO v_role
    FROM public.user_tenant_memberships m
    WHERE m.user_id = p_user_id
      AND m.tenant_id = v_tenant_id
      AND m.is_active = TRUE;

    RETURN v_role = 'OWNER'::public.user_role;
END;
$$;

CREATE OR REPLACE FUNCTION private.user_is_named_po_approver(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_tenant_id UUID;
    v_settings JSONB;
    v_approver_ids JSONB;
BEGIN
    v_tenant_id := private.current_tenant_id();
    IF v_tenant_id IS NULL OR p_user_id IS NULL THEN
        RETURN FALSE;
    END IF;

    v_settings := private.fetch_approval_settings_metadata(v_tenant_id);
    v_approver_ids := v_settings -> 'po_approver_user_ids';

    IF v_approver_ids IS NULL OR jsonb_typeof(v_approver_ids) <> 'array' THEN
        RETURN FALSE;
    END IF;

    RETURN EXISTS (
        SELECT 1
        FROM jsonb_array_elements_text(v_approver_ids) AS approver(id_text)
        WHERE approver.id_text::uuid = p_user_id
    );
END;
$$;

CREATE OR REPLACE FUNCTION private.user_is_po_approver(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
    SELECT
        private.user_is_po_super_approver(p_user_id)
        OR private.user_is_named_po_approver(p_user_id);
$$;

CREATE OR REPLACE FUNCTION private.user_can_approve_purchase_order_amount(
    p_user_id UUID,
    p_tenant_id UUID,
    p_total_net_amount NUMERIC
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
BEGIN
    IF p_user_id IS NULL OR p_tenant_id IS NULL THEN
        RETURN FALSE;
    END IF;

    IF private.user_is_po_super_approver(p_user_id) THEN
        RETURN TRUE;
    END IF;

    IF NOT private.user_is_named_po_approver(p_user_id) THEN
        RETURN FALSE;
    END IF;

    v_settings := private.fetch_approval_settings_metadata(p_tenant_id);
    v_threshold := NULLIF(v_settings ->> 'po_approval_threshold_amount', '')::numeric;

    IF v_threshold IS NULL THEN
        RETURN TRUE;
    END IF;

    RETURN COALESCE(p_total_net_amount, 0) <= v_threshold;
END;
$$;

CREATE OR REPLACE FUNCTION private.user_can_approve_purchase_orders(p_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
    SELECT private.user_is_po_approver(p_user_id);
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

    SELECT dar.id
    INTO v_request_id
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
    v_steps JSONB := '[]'::jsonb;
    v_issue_result JSONB;
    v_issue_steps JSONB;
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

    v_notes := NULLIF(BTRIM(p_notes), '');

    UPDATE public.document_approval_requests
    SET status = 'APPROVED',
        decided_by = v_user_id,
        decided_at = NOW(),
        decision_notes = v_notes,
        updated_at = NOW()
    WHERE id = v_request_id;

    INSERT INTO public.document_approvals (
        tenant_id,
        document_type,
        document_id,
        approved_by,
        approved_at,
        notes
    )
    VALUES (
        v_tenant_id,
        'PURCHASE_ORDER',
        p_purchase_order_id,
        v_user_id,
        NOW(),
        v_notes
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
        'steps', v_steps,
        'issued', TRUE
    );
END;
$$;

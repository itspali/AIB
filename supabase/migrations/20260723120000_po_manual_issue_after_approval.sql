-- PO manual issue after approval: tenant setting + RPC gates
-- Migration: 20260723120000_po_manual_issue_after_approval.sql

CREATE OR REPLACE FUNCTION private.po_auto_issue_after_approval(p_tenant_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
    SELECT COALESCE(
        (private.fetch_approval_settings_metadata(p_tenant_id) ->> 'po_auto_issue_after_approval')::boolean,
        TRUE
    );
$$;

CREATE OR REPLACE FUNCTION private.po_manual_issue_allowed(
    p_tenant_id UUID,
    p_user_id UUID,
    p_po_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_settings JSONB;
    v_actor TEXT;
    v_submitter_id UUID;
BEGIN
    IF p_tenant_id IS NULL OR p_user_id IS NULL OR p_po_id IS NULL THEN
        RETURN FALSE;
    END IF;

    IF private.po_auto_issue_after_approval(p_tenant_id) THEN
        RETURN private.can_edit_purchase_orders();
    END IF;

    v_settings := private.fetch_approval_settings_metadata(p_tenant_id);
    v_actor := COALESCE(NULLIF(BTRIM(v_settings ->> 'po_manual_issue_actor'), ''), 'submitter');

    SELECT dar.submitted_by
    INTO v_submitter_id
    FROM public.document_approval_requests dar
    WHERE dar.tenant_id = p_tenant_id
      AND dar.document_type = 'PURCHASE_ORDER'
      AND dar.document_id = p_po_id
      AND dar.status = 'APPROVED'
    ORDER BY dar.submitted_at DESC
    LIMIT 1;

    IF v_actor = 'editors' THEN
        RETURN private.can_edit_purchase_orders();
    END IF;

    IF v_actor = 'submitter_or_owner' THEN
        RETURN private.user_is_po_super_approver(p_user_id)
            OR (v_submitter_id IS NOT NULL AND v_submitter_id = p_user_id);
    END IF;

    RETURN v_submitter_id IS NOT NULL AND v_submitter_id = p_user_id;
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
    v_run RECORD;
    v_step RECORD;
    v_steps JSONB := '[]'::jsonb;
    v_issue_result JSONB;
    v_issue_steps JSONB;
    v_notes TEXT;
    v_run_complete BOOLEAN;
    v_auto_issue BOOLEAN;
    v_notify_body TEXT;
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
        WHERE s.run_id = v_run.id
          AND s.status = 'PENDING'
          AND private.user_can_act_on_po_approval_step(v_user_id, s.id)
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

    v_auto_issue := private.po_auto_issue_after_approval(v_tenant_id);
    v_notify_body := CASE
        WHEN v_auto_issue THEN 'Your purchase order was fully approved.'
        ELSE 'Your purchase order was approved. Issue it to the supplier when ready.'
    END;

    PERFORM private.create_in_app_notification(
        v_tenant_id,
        v_submitter_id,
        'approval.approved',
        'Approved — ' || v_po.voucher_number,
        v_notify_body,
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

    IF NOT v_auto_issue THEN
        RETURN jsonb_build_object(
            'purchase_order_id', p_purchase_order_id,
            'approval_request_id', v_request_id,
            'approval_run_id', v_run.id,
            'steps', v_steps,
            'issued', FALSE,
            'approved', TRUE
        );
    END IF;

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

CREATE OR REPLACE FUNCTION public.issue_purchase_order(p_purchase_order_id UUID)
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
    v_promo_line RECORD;
    v_paid_line_id UUID;
    v_entitlement_count INTEGER := 0;
    v_inserted_entitlements INTEGER := 0;
    v_steps JSONB := '[]'::jsonb;
    v_is_approved_pending BOOLEAN := FALSE;
BEGIN
    v_tenant_id := private.current_tenant_id();
    v_user_id := auth.uid();

    IF v_tenant_id IS NULL THEN
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

    IF v_po.document_status = 'DRAFT'::public.purchase_document_status THEN
        IF private.po_approval_required(
            v_tenant_id,
            v_po.total_net_amount,
            v_user_id,
            p_purchase_order_id
        ) THEN
            RAISE EXCEPTION 'purchase order approval is required before issue';
        END IF;
    ELSIF v_po.document_status = 'PENDING_APPROVAL'::public.purchase_document_status THEN
        v_is_approved_pending := EXISTS (
            SELECT 1
            FROM public.document_approval_requests dar
            WHERE dar.tenant_id = v_tenant_id
              AND dar.document_type = 'PURCHASE_ORDER'
              AND dar.document_id = p_purchase_order_id
              AND dar.status = 'APPROVED'
        )
        OR EXISTS (
            SELECT 1
            FROM public.document_approval_runs r
            WHERE r.tenant_id = v_tenant_id
              AND r.document_type = 'PURCHASE_ORDER'
              AND r.document_id = p_purchase_order_id
              AND r.status = 'APPROVED'
        );

        IF NOT v_is_approved_pending THEN
            RAISE EXCEPTION 'purchase order must be approved before issue';
        END IF;

        IF NOT private.po_manual_issue_allowed(v_tenant_id, v_user_id, p_purchase_order_id) THEN
            RAISE EXCEPTION 'you are not allowed to issue this approved purchase order';
        END IF;
    ELSE
        RAISE EXCEPTION 'only draft or pending-approval purchase orders can be issued';
    END IF;

    SELECT COUNT(*) INTO v_line_count
    FROM public.purchase_order_items
    WHERE purchase_order_id = p_purchase_order_id AND tenant_id = v_tenant_id;

    IF v_line_count < 1 THEN
        RAISE EXCEPTION 'purchase order must have at least one line before issue';
    END IF;

    UPDATE public.purchase_orders
    SET document_status = 'ISSUED_ACTIVE'::public.purchase_document_status,
        updated_at = NOW()
    WHERE id = p_purchase_order_id;

    v_steps := private.append_posting_step(v_steps, 'po_status_issued', 'success', v_po.voucher_number);

    FOR v_promo_line IN
        SELECT poi.*
        FROM public.purchase_order_items poi
        WHERE poi.purchase_order_id = p_purchase_order_id
          AND poi.tenant_id = v_tenant_id
          AND COALESCE(poi.is_promotional, FALSE) = TRUE
    LOOP
        v_paid_line_id := v_promo_line.linked_parent_line_id;

        IF v_paid_line_id IS NULL THEN
            SELECT poi.id INTO v_paid_line_id
            FROM public.purchase_order_items poi
            WHERE poi.purchase_order_id = p_purchase_order_id
              AND poi.tenant_id = v_tenant_id
              AND poi.promo_group_id IS NOT DISTINCT FROM v_promo_line.promo_group_id
              AND COALESCE(poi.is_promotional, FALSE) = FALSE
            LIMIT 1;
        END IF;

        IF v_paid_line_id IS NULL THEN
            CONTINUE;
        END IF;

        WITH ins AS (
            INSERT INTO public.promo_fulfillment_entitlements (
                tenant_id, purchase_order_id, paid_line_id, promo_line_id,
                promo_group_id, expected_qty, received_qty, status
            )
            VALUES (
                v_tenant_id, p_purchase_order_id, v_paid_line_id, v_promo_line.id,
                COALESCE(v_promo_line.promo_group_id, gen_random_uuid()),
                v_promo_line.quantity_ordered, 0,
                'OPEN'::public.promo_entitlement_status
            )
            ON CONFLICT (tenant_id, promo_line_id) DO NOTHING
            RETURNING 1
        )
        SELECT COUNT(*) INTO v_inserted_entitlements FROM ins;

        v_entitlement_count := v_entitlement_count + COALESCE(v_inserted_entitlements, 0);
    END LOOP;

    IF v_entitlement_count > 0 THEN
        v_steps := private.append_posting_step(
            v_steps, 'po_promo_commitments_created', 'success', v_entitlement_count::TEXT || ' entitlement(s)'
        );
    ELSE
        v_steps := private.append_posting_step(v_steps, 'po_promo_commitments_created', 'skipped', NULL);
    END IF;

    v_steps := private.append_posting_step(v_steps, 'po_receipt_eligibility_opened', 'success', NULL);

    INSERT INTO public.document_posting_runs (
        tenant_id, document_type, document_id, overall_status, steps, posted_by
    )
    VALUES (
        v_tenant_id, 'PO'::public.document_posting_document_type, p_purchase_order_id, 'success', v_steps, v_user_id
    );

    RETURN jsonb_build_object('purchase_order_id', p_purchase_order_id, 'steps', v_steps);
END;
$$;

REVOKE ALL ON FUNCTION private.po_auto_issue_after_approval(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.po_manual_issue_allowed(UUID, UUID, UUID) FROM PUBLIC;

REVOKE ALL ON FUNCTION public.approve_purchase_order(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.approve_purchase_order(UUID, TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.issue_purchase_order(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.issue_purchase_order(UUID) TO authenticated;

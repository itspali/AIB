-- ====================================================================
-- Procurement purchase-order approval workflow (Phase 3)
-- Migration: 20260622120000_procurement_po_approval.sql
-- ====================================================================

-- --------------------------------------------------------------------
-- 1. document_approval_requests
-- --------------------------------------------------------------------
CREATE TABLE public.document_approval_requests (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
    document_type   TEXT NOT NULL,
    document_id     UUID NOT NULL,
    status          TEXT NOT NULL,
    submitted_by    UUID NOT NULL REFERENCES public.users (id) ON DELETE RESTRICT,
    submitted_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    decided_by      UUID REFERENCES public.users (id) ON DELETE RESTRICT,
    decided_at      TIMESTAMPTZ,
    decision_notes  TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT document_approval_requests_status_chk
        CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
    CONSTRAINT document_approval_requests_document_type_chk
        CHECK (document_type IN ('PURCHASE_ORDER'))
);

CREATE INDEX document_approval_requests_tenant_document_idx
    ON public.document_approval_requests (tenant_id, document_type, document_id);

CREATE INDEX document_approval_requests_tenant_status_idx
    ON public.document_approval_requests (tenant_id, status);

ALTER TABLE public.document_approval_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY document_approval_requests_tenant_isolation
    ON public.document_approval_requests
    FOR ALL
    TO authenticated
    USING (tenant_id = private.current_tenant_id())
    WITH CHECK (tenant_id = private.current_tenant_id());

-- --------------------------------------------------------------------
-- 2. APPROVAL_SETTINGS registry allowlist
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.clear_tenant_workspace_control(p_registry_key TEXT)
RETURNS VOID
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

    IF NOT private.user_can_modify_organization_settings() THEN
        RAISE EXCEPTION 'administrative privileges required to modify workspace controls';
    END IF;

    IF p_registry_key NOT IN (
        'SALES_SETTINGS',
        'FINANCIAL_SETTINGS',
        'SEARCH_SETTINGS',
        'PROCUREMENT_SETTINGS',
        'THEME_SETTINGS',
        'APPROVAL_SETTINGS'
    ) THEN
        RAISE EXCEPTION 'unsupported workspace control registry key';
    END IF;

    DELETE FROM public.workspace_control_registry
    WHERE tenant_id = v_tenant_id
      AND scope_level = 'TENANT_GLOBAL'
      AND registry_key = p_registry_key
      AND target_reference_id IS NULL;
END;
$$;

CREATE OR REPLACE FUNCTION private.upsert_tenant_workspace_control(
    p_registry_key TEXT,
    p_metadata_patch JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_tenant_id UUID;
    v_existing_id UUID;
    v_merged JSONB;
BEGIN
    v_tenant_id := private.current_tenant_id();
    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'tenant context missing from session';
    END IF;

    IF NOT private.user_can_modify_organization_settings() THEN
        RAISE EXCEPTION 'administrative privileges required to modify workspace controls';
    END IF;

    IF p_registry_key NOT IN (
        'SALES_SETTINGS',
        'FINANCIAL_SETTINGS',
        'SEARCH_SETTINGS',
        'PROCUREMENT_SETTINGS',
        'THEME_SETTINGS',
        'APPROVAL_SETTINGS'
    ) THEN
        RAISE EXCEPTION 'unsupported workspace control registry key';
    END IF;

    SELECT id, configuration_metadata
    INTO v_existing_id, v_merged
    FROM public.workspace_control_registry
    WHERE tenant_id = v_tenant_id
      AND scope_level = 'TENANT_GLOBAL'
      AND registry_key = p_registry_key
      AND target_reference_id IS NULL
    LIMIT 1;

    v_merged := private.merge_jsonb_objects(v_merged, p_metadata_patch);

    IF v_existing_id IS NULL THEN
        INSERT INTO public.workspace_control_registry (
            tenant_id,
            scope_level,
            registry_key,
            target_reference_id,
            configuration_metadata
        )
        VALUES (
            v_tenant_id,
            'TENANT_GLOBAL',
            p_registry_key,
            NULL,
            v_merged
        );
    ELSE
        UPDATE public.workspace_control_registry
        SET
            configuration_metadata = v_merged,
            updated_at = NOW()
        WHERE id = v_existing_id
          AND tenant_id = v_tenant_id;
    END IF;
END;
$$;

-- --------------------------------------------------------------------
-- 3. Approval helpers
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.fetch_approval_settings_metadata(p_tenant_id UUID)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
    SELECT COALESCE(wcr.configuration_metadata, '{}'::jsonb)
    FROM public.workspace_control_registry wcr
    WHERE wcr.tenant_id = p_tenant_id
      AND wcr.registry_key = 'APPROVAL_SETTINGS'
      AND wcr.scope_level = 'TENANT_GLOBAL'
      AND wcr.target_reference_id IS NULL
    LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION private.user_is_po_approver(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_tenant_id UUID;
    v_role public.user_role;
    v_settings JSONB;
    v_approver_ids JSONB;
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

    IF v_role = 'OWNER'::public.user_role THEN
        RETURN TRUE;
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

CREATE OR REPLACE FUNCTION private.po_self_approve_allowed(
    p_tenant_id UUID,
    p_total_net_amount NUMERIC,
    p_submitter_id UUID
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
BEGIN
    IF p_submitter_id IS NULL THEN
        RETURN FALSE;
    END IF;

    IF NOT private.user_is_po_approver(p_submitter_id) THEN
        RETURN FALSE;
    END IF;

    v_settings := private.fetch_approval_settings_metadata(p_tenant_id);
    v_allow_self := COALESCE((v_settings ->> 'allow_submitter_self_approve_below_threshold')::boolean, FALSE);

    IF NOT v_allow_self THEN
        RETURN FALSE;
    END IF;

    v_threshold := NULLIF(v_settings ->> 'po_approval_threshold_amount', '')::numeric;
    IF v_threshold IS NULL THEN
        RETURN FALSE;
    END IF;

    RETURN COALESCE(p_total_net_amount, 0) <= v_threshold;
END;
$$;

CREATE OR REPLACE FUNCTION private.po_approval_required(
    p_tenant_id UUID,
    p_total_net_amount NUMERIC,
    p_submitter_id UUID
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
BEGIN
    v_settings := private.fetch_approval_settings_metadata(p_tenant_id);
    v_require := COALESCE((v_settings ->> 'require_po_approval_before_issue')::boolean, FALSE);

    IF NOT v_require THEN
        RETURN FALSE;
    END IF;

    IF private.po_self_approve_allowed(p_tenant_id, p_total_net_amount, p_submitter_id) THEN
        RETURN FALSE;
    END IF;

    RETURN TRUE;
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

-- --------------------------------------------------------------------
-- 4. submit_purchase_order_for_approval
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

    INSERT INTO public.document_approval_requests (
        tenant_id,
        document_type,
        document_id,
        status,
        submitted_by,
        submitted_at
    )
    VALUES (
        v_tenant_id,
        'PURCHASE_ORDER',
        p_purchase_order_id,
        'PENDING',
        v_user_id,
        NOW()
    )
    RETURNING id INTO v_request_id;

    UPDATE public.purchase_orders
    SET document_status = 'PENDING_APPROVAL'::public.purchase_document_status,
        updated_at = NOW()
    WHERE id = p_purchase_order_id;

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
        'steps', v_steps
    );
END;
$$;

REVOKE ALL ON FUNCTION public.submit_purchase_order_for_approval(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_purchase_order_for_approval(UUID) TO authenticated;

-- --------------------------------------------------------------------
-- 5. reject_purchase_order
-- --------------------------------------------------------------------
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

    IF NOT private.user_can_approve_purchase_orders(v_user_id) THEN
        RAISE EXCEPTION 'purchase order approver permission required';
    END IF;

    IF p_purchase_order_id IS NULL THEN
        RAISE EXCEPTION 'purchase order id is required';
    END IF;

    v_notes := NULLIF(BTRIM(p_notes), '');
    IF v_notes IS NULL THEN
        RAISE EXCEPTION 'rejection reason is required';
    END IF;

    SELECT * INTO v_po
    FROM public.purchase_orders
    WHERE id = p_purchase_order_id AND tenant_id = v_tenant_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'purchase order not found';
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

REVOKE ALL ON FUNCTION public.reject_purchase_order(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reject_purchase_order(UUID, TEXT) TO authenticated;

-- --------------------------------------------------------------------
-- 6. approve_purchase_order (chains issue_purchase_order)
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

    IF NOT private.user_can_approve_purchase_orders(v_user_id) THEN
        RAISE EXCEPTION 'purchase order approver permission required';
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

REVOKE ALL ON FUNCTION public.approve_purchase_order(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.approve_purchase_order(UUID, TEXT) TO authenticated;

-- --------------------------------------------------------------------
-- 7. issue_purchase_order (approval gate)
-- --------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.issue_purchase_order(UUID);

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
        IF private.po_approval_required(v_tenant_id, v_po.total_net_amount, v_user_id) THEN
            RAISE EXCEPTION 'purchase order approval is required before issue';
        END IF;
    ELSIF v_po.document_status = 'PENDING_APPROVAL'::public.purchase_document_status THEN
        IF NOT EXISTS (
            SELECT 1
            FROM public.document_approval_requests dar
            WHERE dar.tenant_id = v_tenant_id
              AND dar.document_type = 'PURCHASE_ORDER'
              AND dar.document_id = p_purchase_order_id
              AND dar.status = 'APPROVED'
        ) THEN
            RAISE EXCEPTION 'purchase order must be approved before issue';
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

REVOKE ALL ON FUNCTION public.issue_purchase_order(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.issue_purchase_order(UUID) TO authenticated;

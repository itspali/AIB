-- ====================================================================
-- Location-scoped approvers, approval delegation, SLA reminders
-- Migration: 20260626160000_approval_location_delegation_sla.sql
-- ====================================================================

ALTER TABLE public.document_approval_run_steps
    ADD COLUMN IF NOT EXISTS last_reminder_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS escalated_at TIMESTAMPTZ;

-- --------------------------------------------------------------------
-- 1. Location access for arbitrary workspace user
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.user_can_access_po_destination_for(
    p_user_id UUID,
    p_tenant_id UUID,
    p_location_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_role public.user_role;
    v_assigned_location_id UUID;
    v_allowed_location_ids JSONB;
BEGIN
    IF p_user_id IS NULL OR p_tenant_id IS NULL OR p_location_id IS NULL THEN
        RETURN FALSE;
    END IF;

    SELECT m.role, m.assigned_location_id
    INTO v_role, v_assigned_location_id
    FROM public.user_tenant_memberships m
    WHERE m.user_id = p_user_id
      AND m.tenant_id = p_tenant_id
      AND m.is_active = TRUE;

    IF v_role IS NULL THEN
        RETURN FALSE;
    END IF;

    IF v_role IN ('OWNER'::public.user_role, 'ADMIN'::public.user_role) THEN
        RETURN TRUE;
    END IF;

    SELECT wcr.configuration_metadata -> 'allowed_location_ids'
    INTO v_allowed_location_ids
    FROM public.workspace_control_registry wcr
    WHERE wcr.tenant_id = p_tenant_id
      AND wcr.registry_key = 'allow_purchase_order_modification'
      AND wcr.target_reference_id = p_user_id
    LIMIT 1;

    IF FOUND THEN
        IF v_allowed_location_ids IS NULL
           OR jsonb_typeof(v_allowed_location_ids) <> 'array'
           OR jsonb_array_length(v_allowed_location_ids) = 0
        THEN
            RETURN TRUE;
        END IF;

        RETURN EXISTS (
            SELECT 1
            FROM jsonb_array_elements_text(v_allowed_location_ids) AS allowed(id_text)
            WHERE allowed.id_text::uuid = p_location_id
        );
    END IF;

    IF v_role IN ('MANAGER'::public.user_role, 'STAFF'::public.user_role)
       AND v_assigned_location_id IS NOT NULL
    THEN
        RETURN p_location_id = v_assigned_location_id;
    END IF;

    RETURN FALSE;
END;
$$;

CREATE OR REPLACE FUNCTION private.filter_approval_user_ids_by_po_location(
    p_user_ids UUID[],
    p_tenant_id UUID,
    p_location_id UUID,
    p_respect_location BOOLEAN
)
RETURNS UUID[]
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_uid UUID;
    v_result UUID[] := ARRAY[]::uuid[];
    v_role public.user_role;
BEGIN
    IF NOT COALESCE(p_respect_location, TRUE)
       OR p_location_id IS NULL
       OR COALESCE(array_length(p_user_ids, 1), 0) = 0
    THEN
        RETURN p_user_ids;
    END IF;

    FOREACH v_uid IN ARRAY p_user_ids
    LOOP
        SELECT m.role
        INTO v_role
        FROM public.user_tenant_memberships m
        WHERE m.tenant_id = p_tenant_id
          AND m.user_id = v_uid
          AND m.is_active = TRUE;

        IF v_role IN ('OWNER'::public.user_role, 'ADMIN'::public.user_role) THEN
            v_result := array_append(v_result, v_uid);
        ELSIF private.user_can_access_po_destination_for(v_uid, p_tenant_id, p_location_id) THEN
            v_result := array_append(v_result, v_uid);
        END IF;
    END LOOP;

    RETURN COALESCE(v_result, ARRAY[]::uuid[]);
END;
$$;

-- --------------------------------------------------------------------
-- 2. Policy snapshot includes location + SLA settings
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
    v_respect_location BOOLEAN;
    v_reminder_hours INTEGER;
    v_escalation_hours INTEGER;
    v_common JSONB;
BEGIN
    v_settings := private.fetch_approval_settings_metadata(p_tenant_id);
    v_respect_location := COALESCE(
        (v_settings ->> 'po_approval_respect_destination_location')::boolean,
        TRUE
    );
    v_reminder_hours := NULLIF(v_settings ->> 'po_approval_reminder_hours', '')::integer;
    v_escalation_hours := NULLIF(v_settings ->> 'po_approval_escalation_hours', '')::integer;

    v_common := jsonb_build_object(
        'respect_destination_location', v_respect_location,
        'reminder_hours', COALESCE(v_reminder_hours, 24),
        'escalation_hours', v_escalation_hours
    );

    v_bands := v_settings -> 'po_approval_bands';

    IF v_bands IS NOT NULL AND jsonb_typeof(v_bands) = 'array' AND jsonb_array_length(v_bands) > 0 THEN
        RETURN v_common || jsonb_build_object(
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

    RETURN v_common || jsonb_build_object(
        'source', 'legacy',
        'bands', v_bands,
        'pools', jsonb_build_object(
            'default', jsonb_build_object('user_ids', v_approver_ids)
        )
    );
END;
$$;

-- --------------------------------------------------------------------
-- 3. Resolve assignees with optional location filter
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.resolve_approval_step_user_ids(
    p_tenant_id UUID,
    p_submitter_id UUID,
    p_step JSONB,
    p_policy JSONB,
    p_location_id UUID DEFAULT NULL,
    p_respect_location BOOLEAN DEFAULT TRUE
)
RETURNS UUID[]
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_assignee TEXT;
    v_pool TEXT;
    v_manager UUID;
    v_skip UUID;
    v_user_ids UUID[];
BEGIN
    v_assignee := upper(COALESCE(p_step ->> 'assignee', 'POOL'));
    v_pool := COALESCE(p_step ->> 'pool', 'default');

    IF v_assignee IN ('SUBMITTER_MANAGER', 'MANAGER') THEN
        SELECT m.reports_to_user_id
        INTO v_manager
        FROM public.user_tenant_memberships m
        WHERE m.tenant_id = p_tenant_id
          AND m.user_id = p_submitter_id
          AND m.is_active = TRUE;

        IF v_manager IS NOT NULL THEN
            v_user_ids := ARRAY[v_manager];
        ELSE
            v_user_ids := ARRAY[]::uuid[];
        END IF;
    ELSIF v_assignee IN ('SUBMITTER_SKIP_MANAGER', 'SKIP_MANAGER') THEN
        SELECT m.reports_to_user_id
        INTO v_manager
        FROM public.user_tenant_memberships m
        WHERE m.tenant_id = p_tenant_id
          AND m.user_id = p_submitter_id
          AND m.is_active = TRUE;

        IF v_manager IS NULL THEN
            v_user_ids := ARRAY[]::uuid[];
        ELSE
            SELECT m.reports_to_user_id
            INTO v_skip
            FROM public.user_tenant_memberships m
            WHERE m.tenant_id = p_tenant_id
              AND m.user_id = v_manager
              AND m.is_active = TRUE;

            IF v_skip IS NOT NULL THEN
                v_user_ids := ARRAY[v_skip];
            ELSE
                v_user_ids := ARRAY[]::uuid[];
            END IF;
        END IF;
    ELSE
        v_user_ids := private.pool_user_ids(p_policy, v_pool);
    END IF;

    RETURN private.filter_approval_user_ids_by_po_location(
        v_user_ids,
        p_tenant_id,
        p_location_id,
        p_respect_location
    );
END;
$$;

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
    v_user_id UUID;
    v_user_ids UUID[];
    v_destination_location_id UUID;
    v_respect_location BOOLEAN;
BEGIN
    SELECT po.destination_location_id
    INTO v_destination_location_id
    FROM public.purchase_orders po
    WHERE po.id = p_po_id
      AND po.tenant_id = p_tenant_id;

    v_respect_location := COALESCE((p_policy ->> 'respect_destination_location')::boolean, TRUE);

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
                1,
                CASE WHEN v_level_idx = 0 THEN 'PENDING' ELSE 'LOCKED' END,
                CASE WHEN v_level_idx = 0 THEN NOW() ELSE NULL END
            )
            RETURNING id INTO v_step_id;

            v_user_ids := private.resolve_approval_step_user_ids(
                p_tenant_id,
                p_submitter_id,
                v_step,
                p_policy,
                v_destination_location_id,
                v_respect_location
            );

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

        v_user_ids := private.filter_approval_user_ids_by_po_location(
            private.pool_user_ids(p_policy, 'default'),
            p_tenant_id,
            v_destination_location_id,
            v_respect_location
        );

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
            VALUES (p_tenant_id, v_step_id, v_user_id, FALSE)
            ON CONFLICT DO NOTHING;
        END LOOP;
    END IF;

    RETURN v_run_id;
END;
$$;

-- --------------------------------------------------------------------
-- 4. Approval delegation
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.po_approval_delegate_user_id(
    p_delegator_user_id UUID,
    p_tenant_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_delegate_id UUID;
    v_valid_until TIMESTAMPTZ;
BEGIN
    IF p_delegator_user_id IS NULL OR p_tenant_id IS NULL THEN
        RETURN NULL;
    END IF;

    SELECT
        NULLIF(wcr.configuration_metadata ->> 'delegate_user_id', '')::uuid,
        NULLIF(wcr.configuration_metadata ->> 'valid_until', '')::timestamptz
    INTO v_delegate_id, v_valid_until
    FROM public.workspace_control_registry wcr
    WHERE wcr.tenant_id = p_tenant_id
      AND wcr.scope_level = 'FUNCTIONAL_MODULE'
      AND wcr.registry_key = 'allow_po_approval_delegation'
      AND wcr.target_reference_id = p_delegator_user_id
    LIMIT 1;

    IF v_delegate_id IS NULL THEN
        RETURN NULL;
    END IF;

    IF v_valid_until IS NOT NULL AND v_valid_until <= NOW() THEN
        RETURN NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.users u
        WHERE u.id = v_delegate_id
          AND u.tenant_id = p_tenant_id
          AND u.is_active = TRUE
    ) THEN
        RETURN NULL;
    END IF;

    RETURN v_delegate_id;
END;
$$;

CREATE OR REPLACE FUNCTION private.user_can_act_on_po_approval_step(
    p_user_id UUID,
    p_step_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_tenant_id UUID;
BEGIN
    v_tenant_id := private.current_tenant_id();
    IF v_tenant_id IS NULL OR p_user_id IS NULL OR p_step_id IS NULL THEN
        RETURN FALSE;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.document_approval_run_step_assignees a
        WHERE a.step_id = p_step_id
          AND a.tenant_id = v_tenant_id
          AND a.user_id = p_user_id
    ) THEN
        RETURN TRUE;
    END IF;

    RETURN EXISTS (
        SELECT 1
        FROM public.document_approval_run_step_assignees a
        WHERE a.step_id = p_step_id
          AND a.tenant_id = v_tenant_id
          AND private.po_approval_delegate_user_id(a.user_id, v_tenant_id) = p_user_id
    );
END;
$$;

CREATE OR REPLACE FUNCTION private.user_is_po_approval_eligible_delegator(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
BEGIN
    IF p_user_id IS NULL THEN
        RETURN FALSE;
    END IF;

    IF private.user_is_po_super_approver(p_user_id) THEN
        RETURN TRUE;
    END IF;

    IF private.user_is_named_po_approver(p_user_id) THEN
        RETURN TRUE;
    END IF;

    RETURN EXISTS (
        SELECT 1
        FROM public.user_tenant_memberships m
        CROSS JOIN LATERAL (
            SELECT private.fetch_approval_settings_metadata(m.tenant_id) AS settings
        ) cfg
        CROSS JOIN jsonb_array_elements_text(
            COALESCE(cfg.settings -> 'po_approver_roles', '[]'::jsonb)
        ) AS configured(role_text)
        WHERE m.user_id = p_user_id
          AND m.tenant_id = private.current_tenant_id()
          AND m.is_active = TRUE
          AND m.role = configured.role_text::public.user_role
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.grant_po_approval_delegate(
    p_delegate_user_id UUID,
    p_delegator_user_id UUID DEFAULT NULL,
    p_valid_until TIMESTAMPTZ DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_tenant_id UUID;
    v_delegator UUID;
BEGIN
    v_tenant_id := private.current_tenant_id();
    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'tenant context missing from session';
    END IF;

    v_delegator := COALESCE(p_delegator_user_id, auth.uid());

    IF v_delegator <> auth.uid() AND NOT private.user_is_organization_owner() THEN
        RAISE EXCEPTION 'only workspace owners can delegate approval authority for other users';
    END IF;

    IF v_delegator = auth.uid()
       AND NOT private.user_is_organization_owner()
       AND NOT private.user_is_po_approval_eligible_delegator(v_delegator)
    THEN
        RAISE EXCEPTION 'only configured approvers can delegate their approval authority';
    END IF;

    IF p_delegate_user_id IS NULL OR p_delegate_user_id = v_delegator THEN
        RAISE EXCEPTION 'delegate user must be another active workspace user';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.users u
        WHERE u.id = p_delegate_user_id
          AND u.tenant_id = v_tenant_id
          AND u.is_active = TRUE
    ) THEN
        RAISE EXCEPTION 'active delegate user not found in workspace';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.user_tenant_memberships m
        WHERE m.user_id = v_delegator
          AND m.tenant_id = v_tenant_id
          AND m.is_active = TRUE
    ) THEN
        RAISE EXCEPTION 'delegator must be an active workspace member';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.workspace_control_registry wcr
        WHERE wcr.tenant_id = v_tenant_id
          AND wcr.scope_level = 'FUNCTIONAL_MODULE'
          AND wcr.registry_key = 'allow_po_approval_delegation'
          AND wcr.target_reference_id = v_delegator
    ) THEN
        UPDATE public.workspace_control_registry
        SET
            configuration_metadata = jsonb_build_object(
                'delegate_user_id', p_delegate_user_id,
                'valid_until', p_valid_until,
                'granted_by', auth.uid(),
                'granted_at', NOW()
            ),
            updated_at = NOW()
        WHERE tenant_id = v_tenant_id
          AND scope_level = 'FUNCTIONAL_MODULE'
          AND registry_key = 'allow_po_approval_delegation'
          AND target_reference_id = v_delegator;
    ELSE
        INSERT INTO public.workspace_control_registry (
            tenant_id,
            scope_level,
            registry_key,
            target_reference_id,
            configuration_metadata
        )
        VALUES (
            v_tenant_id,
            'FUNCTIONAL_MODULE',
            'allow_po_approval_delegation',
            v_delegator,
            jsonb_build_object(
                'delegate_user_id', p_delegate_user_id,
                'valid_until', p_valid_until,
                'granted_by', auth.uid(),
                'granted_at', NOW()
            )
        );
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.revoke_po_approval_delegate(
    p_delegator_user_id UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_tenant_id UUID;
    v_delegator UUID;
BEGIN
    v_tenant_id := private.current_tenant_id();
    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'tenant context missing from session';
    END IF;

    v_delegator := COALESCE(p_delegator_user_id, auth.uid());

    IF v_delegator <> auth.uid() AND NOT private.user_is_organization_owner() THEN
        RAISE EXCEPTION 'only workspace owners can revoke approval delegation for other users';
    END IF;

    DELETE FROM public.workspace_control_registry
    WHERE tenant_id = v_tenant_id
      AND scope_level = 'FUNCTIONAL_MODULE'
      AND registry_key = 'allow_po_approval_delegation'
      AND target_reference_id = v_delegator;
END;
$$;

-- --------------------------------------------------------------------
-- 5. Approve / reject / queue with delegation
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
        WHERE s.run_id = v_run.id
          AND s.status = 'PENDING'
          AND private.user_can_act_on_po_approval_step(v_user_id, s.id)
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
        COALESCE(v_notes, 'Your purchase order was rejected.'),
        '/procurement/purchase-orders?id=' || p_purchase_order_id::text,
        'PURCHASE_ORDER',
        p_purchase_order_id,
        v_run.id
    );

    v_steps := private.append_posting_step(v_steps, 'po_rejected', 'success', v_po.voucher_number);

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
            'party_name', e.name,
            'acting_as_delegate', CASE
                WHEN a.user_id = v_user_id THEN FALSE
                ELSE TRUE
            END
        ) AS task_row,
        r.submitted_at
        FROM public.document_approval_runs r
        JOIN public.document_approval_run_steps s ON s.run_id = r.id AND s.status = 'PENDING'
        JOIN public.document_approval_run_step_assignees a ON a.step_id = s.id
        LEFT JOIN public.purchase_orders po
          ON r.document_type = 'PURCHASE_ORDER' AND po.id = r.document_id
        LEFT JOIN public.entities e ON po.supplier_id = e.id
        WHERE r.tenant_id = v_tenant_id
          AND r.status = 'PENDING'
          AND (
              a.user_id = v_user_id
              OR private.po_approval_delegate_user_id(a.user_id, v_tenant_id) = v_user_id
          )
        ORDER BY r.submitted_at DESC
        LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 50), 100))
    ) sub;

    RETURN v_rows;
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
    v_recipient RECORD;
    v_title TEXT;
    v_body TEXT;
    v_url TEXT;
BEGIN
    v_url := '/procurement/purchase-orders?id=' || p_po_id::text;

    FOR v_recipient IN
        SELECT DISTINCT recipient_id AS user_id
        FROM (
            SELECT a.user_id AS recipient_id
            FROM public.document_approval_run_steps s
            JOIN public.document_approval_run_step_assignees a ON a.step_id = s.id
            WHERE s.run_id = p_run_id
              AND s.tenant_id = p_tenant_id
              AND s.status = 'PENDING'
            UNION
            SELECT private.po_approval_delegate_user_id(a.user_id, p_tenant_id) AS recipient_id
            FROM public.document_approval_run_steps s
            JOIN public.document_approval_run_step_assignees a ON a.step_id = s.id
            WHERE s.run_id = p_run_id
              AND s.tenant_id = p_tenant_id
              AND s.status = 'PENDING'
        ) recipients
        WHERE recipient_id IS NOT NULL
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
            v_recipient.user_id,
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

-- --------------------------------------------------------------------
-- 6. SLA reminders + escalation
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.run_po_approval_sla_reminders()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_tenant_id UUID;
    v_settings JSONB;
    v_reminder_hours INTEGER;
    v_escalation_hours INTEGER;
    v_step RECORD;
    v_po RECORD;
    v_recipient RECORD;
    v_reminders_sent INTEGER := 0;
    v_escalations_sent INTEGER := 0;
    v_url TEXT;
BEGIN
    v_tenant_id := private.current_tenant_id();
    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'tenant context missing from session';
    END IF;

    IF NOT private.user_is_organization_owner() THEN
        RAISE EXCEPTION 'only workspace owners can run approval SLA reminders';
    END IF;

    v_settings := private.fetch_approval_settings_metadata(v_tenant_id);
    v_reminder_hours := COALESCE(NULLIF(v_settings ->> 'po_approval_reminder_hours', '')::integer, 24);
    v_escalation_hours := NULLIF(v_settings ->> 'po_approval_escalation_hours', '')::integer;

    FOR v_step IN
        SELECT s.*, r.document_id, r.submitted_by
        FROM public.document_approval_run_steps s
        JOIN public.document_approval_runs r ON r.id = s.run_id
        JOIN public.purchase_orders po
          ON r.document_type = 'PURCHASE_ORDER'
         AND po.id = r.document_id
         AND po.tenant_id = r.tenant_id
        WHERE s.tenant_id = v_tenant_id
          AND r.status = 'PENDING'
          AND s.status = 'PENDING'
          AND s.opened_at IS NOT NULL
    LOOP
        SELECT * INTO v_po
        FROM public.purchase_orders
        WHERE id = v_step.document_id AND tenant_id = v_tenant_id;

        v_url := '/procurement/purchase-orders?id=' || v_step.document_id::text;

        IF v_reminder_hours > 0
           AND v_step.opened_at + (v_reminder_hours || ' hours')::interval <= NOW()
           AND (
               v_step.last_reminder_at IS NULL
               OR v_step.last_reminder_at + (v_reminder_hours || ' hours')::interval <= NOW()
           )
        THEN
            FOR v_recipient IN
                SELECT DISTINCT recipient_id AS user_id
                FROM (
                    SELECT a.user_id AS recipient_id
                    FROM public.document_approval_run_step_assignees a
                    WHERE a.step_id = v_step.id
                    UNION
                    SELECT private.po_approval_delegate_user_id(a.user_id, v_tenant_id) AS recipient_id
                    FROM public.document_approval_run_step_assignees a
                    WHERE a.step_id = v_step.id
                ) recipients
                WHERE recipient_id IS NOT NULL
            LOOP
                PERFORM private.create_in_app_notification(
                    v_tenant_id,
                    v_recipient.user_id,
                    'approval.po.reminder',
                    'Reminder — ' || COALESCE(v_po.voucher_number, 'PO'),
                    'This purchase order is still waiting for your approval.',
                    v_url,
                    'PURCHASE_ORDER',
                    v_step.document_id,
                    v_step.run_id
                );
            END LOOP;

            UPDATE public.document_approval_run_steps
            SET last_reminder_at = NOW(), updated_at = NOW()
            WHERE id = v_step.id;

            v_reminders_sent := v_reminders_sent + 1;
        END IF;

        IF v_escalation_hours IS NOT NULL
           AND v_escalation_hours > 0
           AND v_step.escalated_at IS NULL
           AND v_step.opened_at + (v_escalation_hours || ' hours')::interval <= NOW()
        THEN
            FOR v_recipient IN
                SELECT m.user_id
                FROM public.user_tenant_memberships m
                WHERE m.tenant_id = v_tenant_id
                  AND m.is_active = TRUE
                  AND m.role = 'OWNER'::public.user_role
            LOOP
                PERFORM private.create_in_app_notification(
                    v_tenant_id,
                    v_recipient.user_id,
                    'approval.po.reminder',
                    'Escalation — ' || COALESCE(v_po.voucher_number, 'PO'),
                    'An approval step is overdue and needs owner attention.',
                    v_url,
                    'PURCHASE_ORDER',
                    v_step.document_id,
                    v_step.run_id
                );
            END LOOP;

            UPDATE public.document_approval_run_steps
            SET escalated_at = NOW(), updated_at = NOW()
            WHERE id = v_step.id;

            v_escalations_sent := v_escalations_sent + 1;
        END IF;
    END LOOP;

    RETURN jsonb_build_object(
        'reminders_sent', v_reminders_sent,
        'escalations_sent', v_escalations_sent
    );
END;
$$;

REVOKE ALL ON FUNCTION private.user_can_access_po_destination_for(UUID, UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.grant_po_approval_delegate(UUID, UUID, TIMESTAMPTZ) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.revoke_po_approval_delegate(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.run_po_approval_sla_reminders() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.grant_po_approval_delegate(UUID, UUID, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_po_approval_delegate(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.run_po_approval_sla_reminders() TO authenticated;

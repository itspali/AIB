-- ====================================================================
-- PO approval: business rules, approver roles, pending-run reroute
-- Migration: 20260626140000_po_approval_rules_reroute_roles.sql
-- ====================================================================

-- --------------------------------------------------------------------
-- 1. Rule evaluation
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.evaluate_po_approval_rules(
    p_tenant_id UUID,
    p_po_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_settings JSONB;
    v_rules JSONB;
    v_rule JSONB;
    v_matched JSONB := '[]'::jsonb;
    v_type TEXT;
    v_enabled BOOLEAN;
    v_threshold NUMERIC;
    v_tolerance NUMERIC;
    v_line RECORD;
BEGIN
    IF p_tenant_id IS NULL OR p_po_id IS NULL THEN
        RETURN jsonb_build_object('required', FALSE, 'matched_rules', '[]'::jsonb);
    END IF;

    v_settings := private.fetch_approval_settings_metadata(p_tenant_id);
    v_rules := COALESCE(v_settings -> 'po_approval_rules', '[]'::jsonb);

    IF jsonb_typeof(v_rules) <> 'array' OR jsonb_array_length(v_rules) = 0 THEN
        RETURN jsonb_build_object('required', FALSE, 'matched_rules', '[]'::jsonb);
    END IF;

    FOR v_rule IN SELECT value FROM jsonb_array_elements(v_rules) AS value
    LOOP
        v_type := COALESCE(v_rule ->> 'type', '');
        v_enabled := COALESCE((v_rule ->> 'enabled')::boolean, FALSE);
        v_threshold := NULLIF(v_rule ->> 'threshold', '')::numeric;
        v_tolerance := COALESCE(NULLIF(v_rule ->> 'tolerance_percent', '')::numeric, 0);

        IF NOT v_enabled THEN
            CONTINUE;
        END IF;

        IF v_type = 'LINE_QTY_ABOVE' AND v_threshold IS NOT NULL THEN
            FOR v_line IN
                SELECT poi.id, poi.quantity_ordered
                FROM public.purchase_order_items poi
                WHERE poi.tenant_id = p_tenant_id
                  AND poi.purchase_order_id = p_po_id
                  AND NOT COALESCE(poi.is_promotional, FALSE)
                  AND poi.quantity_ordered > v_threshold
            LOOP
                v_matched := v_matched || jsonb_build_array(
                    jsonb_build_object(
                        'type', v_type,
                        'line_id', v_line.id,
                        'quantity_ordered', v_line.quantity_ordered,
                        'threshold', v_threshold
                    )
                );
            END LOOP;

        ELSIF v_type = 'LINE_PRICE_ABOVE_SUPPLIER' THEN
            FOR v_line IN
                SELECT
                    poi.id,
                    poi.unit_price_contractual,
                    si.supplier_price AS baseline_price
                FROM public.purchase_order_items poi
                INNER JOIN public.purchase_orders po
                    ON po.id = poi.purchase_order_id
                   AND po.tenant_id = poi.tenant_id
                INNER JOIN public.supplier_items si
                    ON si.tenant_id = poi.tenant_id
                   AND si.item_id = poi.item_id
                   AND si.supplier_id = po.supplier_id
                WHERE poi.tenant_id = p_tenant_id
                  AND poi.purchase_order_id = p_po_id
                  AND NOT COALESCE(poi.is_promotional, FALSE)
                  AND si.supplier_price IS NOT NULL
                  AND poi.unit_price_contractual > si.supplier_price * (1 + (v_tolerance / 100.0))
            LOOP
                v_matched := v_matched || jsonb_build_array(
                    jsonb_build_object(
                        'type', v_type,
                        'line_id', v_line.id,
                        'unit_price', v_line.unit_price_contractual,
                        'baseline_price', v_line.baseline_price,
                        'tolerance_percent', v_tolerance
                    )
                );
            END LOOP;

        ELSIF v_type = 'LINE_PRICE_ABOVE_CATALOG' THEN
            FOR v_line IN
                SELECT
                    poi.id,
                    poi.unit_price_contractual,
                    pcsr.purchase_price AS baseline_price
                FROM public.purchase_order_items poi
                LEFT JOIN public.product_catalog_search_rows pcsr
                    ON pcsr.tenant_id = poi.tenant_id
                   AND pcsr.item_id = poi.item_id
                WHERE poi.tenant_id = p_tenant_id
                  AND poi.purchase_order_id = p_po_id
                  AND NOT COALESCE(poi.is_promotional, FALSE)
                  AND pcsr.purchase_price IS NOT NULL
                  AND poi.unit_price_contractual > pcsr.purchase_price * (1 + (v_tolerance / 100.0))
            LOOP
                v_matched := v_matched || jsonb_build_array(
                    jsonb_build_object(
                        'type', v_type,
                        'line_id', v_line.id,
                        'unit_price', v_line.unit_price_contractual,
                        'baseline_price', v_line.baseline_price,
                        'tolerance_percent', v_tolerance
                    )
                );
            END LOOP;
        END IF;
    END LOOP;

    RETURN jsonb_build_object(
        'required', jsonb_array_length(v_matched) > 0,
        'matched_rules', v_matched
    );
END;
$$;

CREATE OR REPLACE FUNCTION private.resolve_po_approval_non_skip_band(
    p_amount NUMERIC,
    p_policy JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    v_band JSONB;
BEGIN
    FOR v_band IN
        SELECT value
        FROM jsonb_array_elements(COALESCE(p_policy -> 'bands', '[]'::jsonb)) AS value
    LOOP
        IF COALESCE((v_band ->> 'skip')::boolean, FALSE) THEN
            CONTINUE;
        END IF;

        IF COALESCE(p_amount, 0) >= COALESCE((v_band ->> 'min_amount')::numeric, 0)
           AND (
               NULLIF(v_band ->> 'max_amount', '') IS NULL
               OR COALESCE(p_amount, 0) <= NULLIF(v_band ->> 'max_amount', '')::numeric
           )
        THEN
            RETURN v_band;
        END IF;
    END LOOP;

    FOR v_band IN
        SELECT value
        FROM jsonb_array_elements(COALESCE(p_policy -> 'bands', '[]'::jsonb)) AS value
    LOOP
        IF NOT COALESCE((v_band ->> 'skip')::boolean, FALSE) THEN
            RETURN v_band;
        END IF;
    END LOOP;

    RETURN jsonb_build_object(
        'min_amount', 0,
        'max_amount', NULL,
        'levels', jsonb_build_array(
            jsonb_build_object(
                'steps', jsonb_build_array(
                    jsonb_build_object('label', 'Approvers', 'quorum', 'ANY', 'pool', 'default')
                )
            )
        )
    );
END;
$$;

-- --------------------------------------------------------------------
-- 2. Approver roles + expanded pools
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.user_has_po_approver_role(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_tenant_id UUID;
    v_settings JSONB;
    v_roles JSONB;
    v_role public.user_role;
BEGIN
    v_tenant_id := private.current_tenant_id();
    IF v_tenant_id IS NULL OR p_user_id IS NULL THEN
        RETURN FALSE;
    END IF;

    v_settings := private.fetch_approval_settings_metadata(v_tenant_id);
    v_roles := COALESCE(v_settings -> 'po_approver_roles', '[]'::jsonb);

    IF jsonb_typeof(v_roles) <> 'array' OR jsonb_array_length(v_roles) = 0 THEN
        RETURN FALSE;
    END IF;

    SELECT m.role
    INTO v_role
    FROM public.user_tenant_memberships m
    WHERE m.user_id = p_user_id
      AND m.tenant_id = v_tenant_id
      AND m.is_active = TRUE;

    IF v_role IS NULL THEN
        RETURN FALSE;
    END IF;

    RETURN EXISTS (
        SELECT 1
        FROM jsonb_array_elements_text(v_roles) AS configured(role_text)
        WHERE configured.role_text::public.user_role = v_role
    );
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

    IF private.user_has_po_approver_role(p_user_id) THEN
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

CREATE OR REPLACE FUNCTION private.pool_user_ids(
    p_policy JSONB,
    p_pool_key TEXT
)
RETURNS UUID[]
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_ids JSONB;
    v_roles JSONB;
    v_settings_roles JSONB;
    v_result UUID[] := ARRAY[]::uuid[];
    v_role_users UUID[];
    v_text TEXT;
    v_tenant_id UUID;
BEGIN
    v_tenant_id := private.current_tenant_id();
    v_ids := COALESCE(p_policy -> 'pools' -> p_pool_key -> 'user_ids', '[]'::jsonb);
    v_roles := COALESCE(p_policy -> 'pools' -> p_pool_key -> 'roles', '[]'::jsonb);

    IF jsonb_typeof(v_ids) = 'array' THEN
        FOR v_text IN SELECT jsonb_array_elements_text(v_ids)
        LOOP
            BEGIN
                v_result := array_append(v_result, v_text::uuid);
            EXCEPTION WHEN invalid_text_representation THEN
                CONTINUE;
            END;
        END LOOP;
    END IF;

    IF v_tenant_id IS NOT NULL AND jsonb_typeof(v_roles) = 'array' AND jsonb_array_length(v_roles) > 0 THEN
        SELECT COALESCE(array_agg(DISTINCT m.user_id), ARRAY[]::uuid[])
        INTO v_role_users
        FROM public.user_tenant_memberships m
        CROSS JOIN jsonb_array_elements_text(v_roles) AS configured(role_text)
        WHERE m.tenant_id = v_tenant_id
          AND m.is_active = TRUE
          AND m.role = configured.role_text::public.user_role;

        IF v_role_users IS NOT NULL THEN
            SELECT COALESCE(array_agg(DISTINCT uid), ARRAY[]::uuid[])
            INTO v_result
            FROM unnest(v_result || v_role_users) AS uid;
        END IF;
    END IF;

    IF COALESCE(array_length(v_result, 1), 0) = 0
       AND p_pool_key = 'default'
       AND v_tenant_id IS NOT NULL
    THEN
        v_settings_roles := COALESCE(
            private.fetch_approval_settings_metadata(v_tenant_id) -> 'po_approver_roles',
            '[]'::jsonb
        );

        IF jsonb_typeof(v_settings_roles) = 'array' AND jsonb_array_length(v_settings_roles) > 0 THEN
            SELECT COALESCE(array_agg(DISTINCT m.user_id), ARRAY[]::uuid[])
            INTO v_result
            FROM public.user_tenant_memberships m
            CROSS JOIN jsonb_array_elements_text(v_settings_roles) AS configured(role_text)
            WHERE m.tenant_id = v_tenant_id
              AND m.is_active = TRUE
              AND m.role = configured.role_text::public.user_role;
        END IF;
    END IF;

    RETURN COALESCE(v_result, ARRAY[]::uuid[]);
END;
$$;

-- --------------------------------------------------------------------
-- 3. Approval required gate (rules + amount)
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.po_approval_required(
    p_tenant_id UUID,
    p_total_net_amount NUMERIC,
    p_submitter_id UUID,
    p_po_id UUID DEFAULT NULL
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
    v_eval JSONB;
    v_rules_match BOOLEAN := FALSE;
    v_policy JSONB;
    v_band JSONB;
BEGIN
    v_settings := private.fetch_approval_settings_metadata(p_tenant_id);
    v_require := COALESCE((v_settings ->> 'require_po_approval_before_issue')::boolean, FALSE);

    IF NOT v_require THEN
        RETURN FALSE;
    END IF;

    IF p_po_id IS NOT NULL THEN
        v_eval := private.evaluate_po_approval_rules(p_tenant_id, p_po_id);
        v_rules_match := COALESCE((v_eval ->> 'required')::boolean, FALSE);
    END IF;

    IF v_rules_match THEN
        RETURN TRUE;
    END IF;

    IF private.po_self_approve_allowed(p_tenant_id, p_total_net_amount, p_submitter_id) THEN
        RETURN FALSE;
    END IF;

    v_policy := private.resolve_po_approval_policy(p_tenant_id);
    v_band := private.resolve_po_approval_band(p_total_net_amount, v_policy);

    IF v_band IS NOT NULL AND COALESCE((v_band ->> 'skip')::boolean, FALSE) THEN
        RETURN FALSE;
    END IF;

    RETURN TRUE;
END;
$$;

-- --------------------------------------------------------------------
-- 4. Submit with rules + matched_rules snapshot
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
    v_eval JSONB;
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

    IF NOT private.po_approval_required(
        v_tenant_id,
        v_po.total_net_amount,
        v_user_id,
        p_purchase_order_id
    ) THEN
        RAISE EXCEPTION 'approval is not required for this purchase order; issue it directly';
    END IF;

    v_policy := private.resolve_po_approval_policy(v_tenant_id);
    v_eval := private.evaluate_po_approval_rules(v_tenant_id, p_purchase_order_id);
    v_band := private.resolve_po_approval_band(v_po.total_net_amount, v_policy);

    IF v_band IS NULL OR (
        COALESCE((v_band ->> 'skip')::boolean, FALSE)
        AND NOT COALESCE((v_eval ->> 'required')::boolean, FALSE)
    ) THEN
        RAISE EXCEPTION 'approval is not required for this purchase order; issue it directly';
    END IF;

    IF COALESCE((v_band ->> 'skip')::boolean, FALSE)
       AND COALESCE((v_eval ->> 'required')::boolean, FALSE)
    THEN
        v_band := private.resolve_po_approval_non_skip_band(v_po.total_net_amount, v_policy);
    END IF;

    v_policy := v_policy || jsonb_build_object('matched_rules', COALESCE(v_eval -> 'matched_rules', '[]'::jsonb));

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
        'matched_rules', COALESCE(v_eval -> 'matched_rules', '[]'::jsonb),
        'steps', v_steps
    );
END;
$$;

-- --------------------------------------------------------------------
-- 5. Issue gate uses PO id for rule evaluation
-- --------------------------------------------------------------------
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
        IF private.po_approval_required(
            v_tenant_id,
            v_po.total_net_amount,
            v_user_id,
            p_purchase_order_id
        ) THEN
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
        )
        AND NOT EXISTS (
            SELECT 1
            FROM public.document_approval_runs r
            WHERE r.tenant_id = v_tenant_id
              AND r.document_type = 'PURCHASE_ORDER'
              AND r.document_id = p_purchase_order_id
              AND r.status = 'APPROVED'
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

-- --------------------------------------------------------------------
-- 6. Pending count + reroute
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.count_pending_po_approval_runs()
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
    SELECT COUNT(*)::integer
    FROM public.document_approval_runs r
    WHERE r.tenant_id = private.current_tenant_id()
      AND r.document_type = 'PURCHASE_ORDER'
      AND r.status = 'PENDING';
$$;

CREATE OR REPLACE FUNCTION public.reroute_pending_po_approval_runs()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_tenant_id UUID;
    v_user_id UUID;
    v_run RECORD;
    v_po RECORD;
    v_policy JSONB;
    v_band JSONB;
    v_eval JSONB;
    v_new_run_id UUID;
    v_rerouted INTEGER := 0;
    v_released INTEGER := 0;
BEGIN
    v_tenant_id := private.current_tenant_id();
    v_user_id := auth.uid();

    IF v_tenant_id IS NULL OR v_user_id IS NULL THEN
        RAISE EXCEPTION 'tenant context missing from session';
    END IF;

    IF NOT private.user_can_modify_organization_settings() THEN
        RAISE EXCEPTION 'administrative privileges required to reroute approvals';
    END IF;

    FOR v_run IN
        SELECT r.*
        FROM public.document_approval_runs r
        INNER JOIN public.purchase_orders po
            ON po.id = r.document_id
           AND po.tenant_id = r.tenant_id
        WHERE r.tenant_id = v_tenant_id
          AND r.document_type = 'PURCHASE_ORDER'
          AND r.status = 'PENDING'
          AND po.document_status = 'PENDING_APPROVAL'::public.purchase_document_status
        ORDER BY r.submitted_at
    LOOP
        SELECT * INTO v_po
        FROM public.purchase_orders
        WHERE id = v_run.document_id AND tenant_id = v_tenant_id;

        IF NOT private.po_approval_required(
            v_tenant_id,
            v_po.total_net_amount,
            v_run.submitted_by,
            v_po.id
        ) THEN
            UPDATE public.document_approval_runs
            SET status = 'CANCELLED', updated_at = NOW()
            WHERE id = v_run.id;

            UPDATE public.document_approval_requests
            SET status = 'REJECTED',
                decided_by = v_user_id,
                decided_at = NOW(),
                decision_notes = 'Approval no longer required after settings change.',
                updated_at = NOW()
            WHERE tenant_id = v_tenant_id
              AND document_type = 'PURCHASE_ORDER'
              AND document_id = v_po.id
              AND status = 'PENDING';

            UPDATE public.purchase_orders
            SET document_status = 'DRAFT'::public.purchase_document_status,
                updated_at = NOW()
            WHERE id = v_po.id;

            v_released := v_released + 1;
            CONTINUE;
        END IF;

        v_policy := private.resolve_po_approval_policy(v_tenant_id);
        v_eval := private.evaluate_po_approval_rules(v_tenant_id, v_po.id);
        v_band := private.resolve_po_approval_band(v_po.total_net_amount, v_policy);

        IF v_band IS NULL THEN
            v_band := private.resolve_po_approval_non_skip_band(v_po.total_net_amount, v_policy);
        ELSIF COALESCE((v_band ->> 'skip')::boolean, FALSE) THEN
            v_band := private.resolve_po_approval_non_skip_band(v_po.total_net_amount, v_policy);
        END IF;

        v_policy := v_policy || jsonb_build_object(
            'matched_rules', COALESCE(v_eval -> 'matched_rules', '[]'::jsonb)
        );

        UPDATE public.document_approval_runs
        SET status = 'CANCELLED', updated_at = NOW()
        WHERE id = v_run.id;

        v_new_run_id := private.materialize_po_approval_run(
            v_tenant_id,
            v_po.id,
            v_run.submitted_by,
            v_po.total_net_amount,
            v_po.currency_code,
            v_policy,
            v_band
        );

        PERFORM private.notify_po_approval_step_assignees(
            v_tenant_id,
            v_new_run_id,
            v_po.id,
            v_po.voucher_number,
            'approval.step_opened'
        );

        v_rerouted := v_rerouted + 1;
    END LOOP;

    RETURN jsonb_build_object(
        'rerouted', v_rerouted,
        'released_to_draft', v_released
    );
END;
$$;

REVOKE ALL ON FUNCTION public.count_pending_po_approval_runs() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.count_pending_po_approval_runs() TO authenticated;

REVOKE ALL ON FUNCTION public.reroute_pending_po_approval_runs() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reroute_pending_po_approval_runs() TO authenticated;

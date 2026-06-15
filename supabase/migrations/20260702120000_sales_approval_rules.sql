-- ====================================================================
-- Sales approval business rules (qty, list price, discount)
-- Migration: 20260702120000_sales_approval_rules.sql
-- ====================================================================

-- --------------------------------------------------------------------
-- 1. Rule evaluation
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.evaluate_sales_approval_rules(
    p_tenant_id UUID,
    p_prefix TEXT,
    p_document_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_settings JSONB;
    v_rules_key TEXT;
    v_rules JSONB;
    v_rule JSONB;
    v_matched JSONB := '[]'::jsonb;
    v_type TEXT;
    v_enabled BOOLEAN;
    v_threshold NUMERIC;
    v_tolerance NUMERIC;
    v_line RECORD;
    v_line_table TEXT;
    v_parent_col TEXT;
    v_qty_col TEXT;
BEGIN
    IF p_tenant_id IS NULL OR p_document_id IS NULL OR p_prefix IS NULL THEN
        RETURN jsonb_build_object('required', FALSE, 'matched_rules', '[]'::jsonb);
    END IF;

    IF p_prefix = 'so' THEN
        v_line_table := 'sales_order_items';
        v_parent_col := 'sales_order_id';
        v_qty_col := 'quantity_ordered';
    ELSIF p_prefix = 'quote' THEN
        v_line_table := 'sales_quotation_items';
        v_parent_col := 'sales_quotation_id';
        v_qty_col := 'quantity_quoted';
    ELSIF p_prefix = 'invoice' THEN
        v_line_table := 'sales_invoice_items';
        v_parent_col := 'sales_invoice_id';
        v_qty_col := 'quantity_invoiced';
    ELSE
        RETURN jsonb_build_object('required', FALSE, 'matched_rules', '[]'::jsonb);
    END IF;

    v_settings := private.fetch_approval_settings_metadata(p_tenant_id);
    v_rules_key := p_prefix || '_approval_rules';
    v_rules := COALESCE(v_settings -> v_rules_key, '[]'::jsonb);

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
            FOR v_line IN EXECUTE format(
                'SELECT li.id, li.%I AS line_quantity
                 FROM public.%I li
                 WHERE li.tenant_id = $1
                   AND li.%I = $2
                   AND li.%I > $3',
                v_qty_col, v_line_table, v_parent_col, v_qty_col
            ) USING p_tenant_id, p_document_id, v_threshold
            LOOP
                v_matched := v_matched || jsonb_build_array(
                    jsonb_build_object(
                        'type', v_type,
                        'line_id', v_line.id,
                        'quantity', v_line.line_quantity,
                        'threshold', v_threshold
                    )
                );
            END LOOP;

        ELSIF v_type = 'LINE_PRICE_BELOW_LIST' THEN
            FOR v_line IN EXECUTE format(
                'SELECT
                    li.id,
                    li.unit_price_selling,
                    pcsr.selling_price AS list_price
                 FROM public.%I li
                 LEFT JOIN public.product_catalog_search_rows pcsr
                    ON pcsr.tenant_id = li.tenant_id
                   AND pcsr.item_id = li.item_id
                 WHERE li.tenant_id = $1
                   AND li.%I = $2
                   AND pcsr.selling_price IS NOT NULL
                   AND li.unit_price_selling < pcsr.selling_price * (1 - ($3 / 100.0))',
                v_line_table, v_parent_col
            ) USING p_tenant_id, p_document_id, v_tolerance
            LOOP
                v_matched := v_matched || jsonb_build_array(
                    jsonb_build_object(
                        'type', v_type,
                        'line_id', v_line.id,
                        'unit_price', v_line.unit_price_selling,
                        'list_price', v_line.list_price,
                        'tolerance_percent', v_tolerance
                    )
                );
            END LOOP;

        ELSIF v_type = 'LINE_DISCOUNT_ABOVE' AND v_threshold IS NOT NULL THEN
            FOR v_line IN EXECUTE format(
                'SELECT li.id, li.discount_percentage
                 FROM public.%I li
                 WHERE li.tenant_id = $1
                   AND li.%I = $2
                   AND li.discount_percentage > $3',
                v_line_table, v_parent_col
            ) USING p_tenant_id, p_document_id, v_threshold
            LOOP
                v_matched := v_matched || jsonb_build_array(
                    jsonb_build_object(
                        'type', v_type,
                        'line_id', v_line.id,
                        'discount_percentage', v_line.discount_percentage,
                        'threshold', v_threshold
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

-- --------------------------------------------------------------------
-- 2. Self-approve uses global sales setting
-- --------------------------------------------------------------------
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
    v_threshold_key TEXT;
    v_approver_key TEXT;
BEGIN
    IF p_submitter_id IS NULL THEN
        RETURN FALSE;
    END IF;

    IF private.user_is_po_super_approver(p_submitter_id) THEN
        RETURN TRUE;
    END IF;

    v_settings := private.fetch_approval_settings_metadata(p_tenant_id);
    v_threshold_key := p_prefix || '_approval_threshold_amount';
    v_approver_key := p_prefix || '_approver_user_ids';

    v_allow_self := COALESCE((v_settings ->> 'allow_submitter_self_approve_below_threshold')::boolean, FALSE);
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

-- --------------------------------------------------------------------
-- 3. Approval required gate (rules override amount exemption)
-- --------------------------------------------------------------------
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
    v_eval JSONB;
    v_rules_match BOOLEAN := FALSE;
    v_policy JSONB;
    v_band JSONB;
BEGIN
    v_settings := private.fetch_approval_settings_metadata(p_tenant_id);
    v_require := COALESCE((v_settings ->> 'require_so_approval_before_confirm')::boolean, FALSE);

    IF NOT v_require THEN
        RETURN FALSE;
    END IF;

    IF p_sales_order_id IS NOT NULL THEN
        v_eval := private.evaluate_sales_approval_rules(p_tenant_id, 'so', p_sales_order_id);
        v_rules_match := COALESCE((v_eval ->> 'required')::boolean, FALSE);
    END IF;

    IF v_rules_match THEN
        RETURN TRUE;
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
    v_eval JSONB;
    v_rules_match BOOLEAN := FALSE;
    v_policy JSONB;
    v_band JSONB;
BEGIN
    v_settings := private.fetch_approval_settings_metadata(p_tenant_id);
    v_require := COALESCE((v_settings ->> 'require_quote_approval_before_confirm')::boolean, FALSE);

    IF NOT v_require THEN
        RETURN FALSE;
    END IF;

    IF p_quotation_id IS NOT NULL THEN
        v_eval := private.evaluate_sales_approval_rules(p_tenant_id, 'quote', p_quotation_id);
        v_rules_match := COALESCE((v_eval ->> 'required')::boolean, FALSE);
    END IF;

    IF v_rules_match THEN
        RETURN TRUE;
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
    v_eval JSONB;
    v_rules_match BOOLEAN := FALSE;
    v_policy JSONB;
    v_band JSONB;
BEGIN
    v_settings := private.fetch_approval_settings_metadata(p_tenant_id);
    v_require := COALESCE((v_settings ->> 'require_invoice_approval_before_post')::boolean, FALSE);

    IF NOT v_require THEN
        RETURN FALSE;
    END IF;

    IF p_sales_invoice_id IS NOT NULL THEN
        v_eval := private.evaluate_sales_approval_rules(p_tenant_id, 'invoice', p_sales_invoice_id);
        v_rules_match := COALESCE((v_eval ->> 'required')::boolean, FALSE);
    END IF;

    IF v_rules_match THEN
        RETURN TRUE;
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
-- 4. Submit RPCs — rules override skip band + matched_rules snapshot
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
    v_eval JSONB;
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
    v_eval := private.evaluate_sales_approval_rules(v_tenant_id, 'so', p_sales_order_id);
    v_band := private.resolve_po_approval_band(v_so.total_net_amount, v_policy);

    IF v_band IS NULL OR (
        COALESCE((v_band ->> 'skip')::boolean, FALSE)
        AND NOT COALESCE((v_eval ->> 'required')::boolean, FALSE)
    ) THEN
        RAISE EXCEPTION 'approval is not required for this sales order; confirm it directly';
    END IF;

    IF COALESCE((v_band ->> 'skip')::boolean, FALSE)
       AND COALESCE((v_eval ->> 'required')::boolean, FALSE)
    THEN
        v_band := private.resolve_po_approval_non_skip_band(v_so.total_net_amount, v_policy);
    END IF;

    v_policy := v_policy || jsonb_build_object('matched_rules', COALESCE(v_eval -> 'matched_rules', '[]'::jsonb));

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

CREATE OR REPLACE FUNCTION public.submit_sales_quotation_for_approval(p_quotation_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_tenant_id UUID;
    v_user_id UUID;
    v_doc RECORD;
    v_request_id UUID;
    v_run_id UUID;
    v_policy JSONB;
    v_band JSONB;
    v_eval JSONB;
BEGIN
    v_tenant_id := private.current_tenant_id();
    v_user_id := auth.uid();

    IF v_tenant_id IS NULL OR v_user_id IS NULL THEN
        RAISE EXCEPTION 'tenant context missing from session';
    END IF;

    IF NOT private.can_edit_sales_orders() THEN
        RAISE EXCEPTION 'sales quotation edit permission required';
    END IF;

    SELECT * INTO v_doc
    FROM public.sales_quotations
    WHERE id = p_quotation_id AND tenant_id = v_tenant_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'sales quotation not found';
    END IF;

    IF v_doc.commercial_status <> 'DRAFT'::public.sales_document_status THEN
        RAISE EXCEPTION 'only draft quotations can be submitted for approval';
    END IF;

    IF NOT private.quote_approval_required(v_tenant_id, v_doc.total_net_amount, v_user_id, p_quotation_id) THEN
        RAISE EXCEPTION 'approval is not required for this quotation';
    END IF;

    v_policy := private.resolve_quote_approval_policy(v_tenant_id);
    v_eval := private.evaluate_sales_approval_rules(v_tenant_id, 'quote', p_quotation_id);
    v_band := private.resolve_po_approval_band(v_doc.total_net_amount, v_policy);

    IF v_band IS NULL OR (
        COALESCE((v_band ->> 'skip')::boolean, FALSE)
        AND NOT COALESCE((v_eval ->> 'required')::boolean, FALSE)
    ) THEN
        RAISE EXCEPTION 'approval is not required for this quotation';
    END IF;

    IF COALESCE((v_band ->> 'skip')::boolean, FALSE)
       AND COALESCE((v_eval ->> 'required')::boolean, FALSE)
    THEN
        v_band := private.resolve_po_approval_non_skip_band(v_doc.total_net_amount, v_policy);
    END IF;

    v_policy := v_policy || jsonb_build_object('matched_rules', COALESCE(v_eval -> 'matched_rules', '[]'::jsonb));

    v_run_id := private.materialize_quote_approval_run(
        v_tenant_id, p_quotation_id, v_user_id,
        v_doc.total_net_amount, v_doc.currency_code, v_policy, v_band
    );

    INSERT INTO public.document_approval_requests (tenant_id, document_type, document_id, status, submitted_by)
    VALUES (v_tenant_id, 'SALES_QUOTATION', p_quotation_id, 'PENDING', v_user_id)
    RETURNING id INTO v_request_id;

    UPDATE public.sales_quotations
    SET commercial_status = 'PENDING_APPROVAL'::public.sales_document_status,
        updated_at = NOW()
    WHERE id = p_quotation_id;

    PERFORM private.notify_quote_approval_step_assignees(
        v_tenant_id, v_run_id, p_quotation_id, v_doc.quotation_number, 'approval.step_opened'
    );

    RETURN jsonb_build_object(
        'quotation_id', p_quotation_id,
        'approval_request_id', v_request_id,
        'approval_run_id', v_run_id
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_sales_invoice_for_approval(p_sales_invoice_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_tenant_id UUID;
    v_user_id UUID;
    v_doc RECORD;
    v_request_id UUID;
    v_run_id UUID;
    v_policy JSONB;
    v_band JSONB;
    v_eval JSONB;
BEGIN
    v_tenant_id := private.current_tenant_id();
    v_user_id := auth.uid();

    IF v_tenant_id IS NULL OR v_user_id IS NULL THEN
        RAISE EXCEPTION 'tenant context missing from session';
    END IF;

    IF NOT private.can_edit_sales_orders() THEN
        RAISE EXCEPTION 'sales invoice edit permission required';
    END IF;

    SELECT * INTO v_doc
    FROM public.sales_invoices
    WHERE id = p_sales_invoice_id AND tenant_id = v_tenant_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'sales invoice not found';
    END IF;

    IF v_doc.commercial_status <> 'DRAFT'::public.sales_document_status THEN
        RAISE EXCEPTION 'only draft invoices can be submitted for approval';
    END IF;

    IF NOT private.invoice_approval_required(v_tenant_id, v_doc.total_net_amount, v_user_id, p_sales_invoice_id) THEN
        RAISE EXCEPTION 'approval is not required for this invoice; post it directly';
    END IF;

    v_policy := private.resolve_invoice_approval_policy(v_tenant_id);
    v_eval := private.evaluate_sales_approval_rules(v_tenant_id, 'invoice', p_sales_invoice_id);
    v_band := private.resolve_po_approval_band(v_doc.total_net_amount, v_policy);

    IF v_band IS NULL OR (
        COALESCE((v_band ->> 'skip')::boolean, FALSE)
        AND NOT COALESCE((v_eval ->> 'required')::boolean, FALSE)
    ) THEN
        RAISE EXCEPTION 'approval is not required for this invoice; post it directly';
    END IF;

    IF COALESCE((v_band ->> 'skip')::boolean, FALSE)
       AND COALESCE((v_eval ->> 'required')::boolean, FALSE)
    THEN
        v_band := private.resolve_po_approval_non_skip_band(v_doc.total_net_amount, v_policy);
    END IF;

    v_policy := v_policy || jsonb_build_object('matched_rules', COALESCE(v_eval -> 'matched_rules', '[]'::jsonb));

    v_run_id := private.materialize_invoice_approval_run(
        v_tenant_id, p_sales_invoice_id, v_user_id,
        v_doc.total_net_amount, v_doc.currency_code, v_policy, v_band
    );

    INSERT INTO public.document_approval_requests (tenant_id, document_type, document_id, status, submitted_by)
    VALUES (v_tenant_id, 'SALES_INVOICE', p_sales_invoice_id, 'PENDING', v_user_id)
    RETURNING id INTO v_request_id;

    UPDATE public.sales_invoices
    SET commercial_status = 'PENDING_APPROVAL'::public.sales_document_status,
        updated_at = NOW()
    WHERE id = p_sales_invoice_id;

    PERFORM private.notify_invoice_approval_step_assignees(
        v_tenant_id, v_run_id, p_sales_invoice_id, v_doc.invoice_number, 'approval.step_opened'
    );

    RETURN jsonb_build_object(
        'sales_invoice_id', p_sales_invoice_id,
        'approval_request_id', v_request_id,
        'approval_run_id', v_run_id
    );
END;
$$;

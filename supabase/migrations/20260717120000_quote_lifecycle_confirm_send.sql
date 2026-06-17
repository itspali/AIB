-- ====================================================================
-- Quote lifecycle: Confirm / Approve / Send + activity timeline
-- Migration: 20260717120000_quote_lifecycle_confirm_send.sql
-- ====================================================================

-- --------------------------------------------------------------------
-- 1. Sent tracking columns
-- --------------------------------------------------------------------
ALTER TABLE public.sales_quotations
    ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS sent_by UUID REFERENCES public.users (id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS send_channel TEXT,
    ADD COLUMN IF NOT EXISTS sent_to_email TEXT;

-- --------------------------------------------------------------------
-- 2. Activity helpers: workflow rank + titles
-- --------------------------------------------------------------------
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
        WHEN 'so_submitted_for_approval' THEN 200
        WHEN 'quote_submitted_for_approval' THEN 200
        WHEN 'invoice_submitted_for_approval' THEN 200
        WHEN 'po_rejected' THEN 250
        WHEN 'so_rejected' THEN 250
        WHEN 'quote_rejected' THEN 250
        WHEN 'invoice_rejected' THEN 250
        WHEN 'po_approved' THEN 300
        WHEN 'so_approved' THEN 300
        WHEN 'quote_approved' THEN 300
        WHEN 'invoice_approved' THEN 300
        WHEN 'status_changed' THEN 350
        WHEN 'so_status_confirmed' THEN 380
        WHEN 'quote_status_confirmed' THEN 380
        WHEN 'po_status_issued' THEN 400
        WHEN 'quote_status_sent' THEN 420
        WHEN 'invoice_posted' THEN 400
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

CREATE OR REPLACE FUNCTION private.activity_event_title(
    p_event_code TEXT,
    p_event_kind TEXT,
    p_detail JSONB DEFAULT '{}'::jsonb
)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
    RETURN CASE p_event_code
        WHEN 'created' THEN 'Document created'
        WHEN 'linked' THEN 'Bill linked to goods receipt'
        WHEN 'po_submitted_for_approval' THEN 'Submitted for approval'
        WHEN 'so_submitted_for_approval' THEN 'Submitted for approval'
        WHEN 'quote_submitted_for_approval' THEN 'Submitted for approval'
        WHEN 'invoice_submitted_for_approval' THEN 'Submitted for approval'
        WHEN 'po_approved' THEN 'Approval granted'
        WHEN 'so_approved' THEN 'Approval granted'
        WHEN 'quote_approved' THEN 'Approval granted'
        WHEN 'invoice_approved' THEN 'Approval granted'
        WHEN 'po_rejected' THEN 'Approval rejected'
        WHEN 'so_rejected' THEN 'Approval rejected'
        WHEN 'quote_rejected' THEN 'Approval rejected'
        WHEN 'invoice_rejected' THEN 'Approval rejected'
        WHEN 'po_status_issued' THEN 'Order sent to supplier'
        WHEN 'so_status_confirmed' THEN 'Sales order confirmed'
        WHEN 'quote_status_confirmed' THEN 'Quotation confirmed'
        WHEN 'quote_status_sent' THEN 'Quotation sent'
        WHEN 'invoice_posted' THEN 'Invoice posted'
        WHEN 'grn_receipt_recorded' THEN 'Receipt recorded'
        WHEN 'grn_qc_released' THEN 'QC hold released'
        WHEN 'bill_invoice_recorded' THEN 'Bill recorded'
        WHEN 'bill_voided' THEN 'Bill voided'
        WHEN 'vendor_payment_posted' THEN 'Payment posted'
        WHEN 'bill_advance_applied' THEN 'Vendor advance applied'
        WHEN 'status_changed' THEN
            COALESCE(
                'Status changed to ' || NULLIF(p_detail ->> 'new_status', ''),
                'Status updated'
            )
        WHEN 'paid' THEN 'Marked as paid'
        WHEN 'valuation_changed' THEN 'Inventory valuation updated'
        WHEN 'promo_entitlement' THEN 'Promotional entitlement updated'
        WHEN 'posting_run' THEN 'Posting completed'
        ELSE replace(initcap(replace(p_event_code, '_', ' ')), 'Po ', 'PO ')
    END;
END;
$$;

-- --------------------------------------------------------------------
-- 3. Approval request outbox — map document_type correctly
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.trg_activity_approval_request_outbox()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_event_kind TEXT;
    v_event_code TEXT;
    v_entity_type public.activity_entity_type;
BEGIN
    v_entity_type := CASE NEW.document_type
        WHEN 'PURCHASE_ORDER' THEN 'PURCHASE_ORDER'::public.activity_entity_type
        WHEN 'SALES_QUOTATION' THEN 'SALES_QUOTATION'::public.activity_entity_type
        WHEN 'SALES_ORDER' THEN 'SALES_ORDER'::public.activity_entity_type
        WHEN 'SALES_INVOICE' THEN 'SALES_INVOICE'::public.activity_entity_type
        ELSE NULL
    END;

    IF v_entity_type IS NULL THEN
        RETURN NEW;
    END IF;

    IF TG_OP = 'INSERT' AND NEW.status = 'PENDING' THEN
        v_event_kind := 'submitted';
        v_event_code := CASE NEW.document_type
            WHEN 'PURCHASE_ORDER' THEN 'po_submitted_for_approval'
            WHEN 'SALES_QUOTATION' THEN 'quote_submitted_for_approval'
            WHEN 'SALES_ORDER' THEN 'so_submitted_for_approval'
            WHEN 'SALES_INVOICE' THEN 'invoice_submitted_for_approval'
        END;
        PERFORM private.enqueue_activity_outbox(
            NEW.tenant_id,
            v_entity_type,
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
            v_event_code := CASE NEW.document_type
                WHEN 'PURCHASE_ORDER' THEN 'po_approved'
                WHEN 'SALES_QUOTATION' THEN 'quote_approved'
                WHEN 'SALES_ORDER' THEN 'so_approved'
                WHEN 'SALES_INVOICE' THEN 'invoice_approved'
            END;
        ELSIF NEW.status = 'REJECTED' THEN
            v_event_kind := 'rejected';
            v_event_code := CASE NEW.document_type
                WHEN 'PURCHASE_ORDER' THEN 'po_rejected'
                WHEN 'SALES_QUOTATION' THEN 'quote_rejected'
                WHEN 'SALES_ORDER' THEN 'so_rejected'
                WHEN 'SALES_INVOICE' THEN 'invoice_rejected'
            END;
        ELSE
            RETURN NEW;
        END IF;

        PERFORM private.enqueue_activity_outbox(
            NEW.tenant_id,
            v_entity_type,
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

-- --------------------------------------------------------------------
-- 4. save_sales_quotation — block edits after send
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.save_sales_quotation(
    p_sales_quotation_id UUID,
    p_customer_id UUID,
    p_lines JSONB,
    p_created_by UUID,
    p_billing_state TEXT,
    p_shipping_state TEXT,
    p_valid_until TIMESTAMPTZ,
    p_origin_location_id UUID DEFAULT NULL,
    p_payment_terms_days INTEGER DEFAULT NULL,
    p_custom_fields JSONB DEFAULT NULL,
    p_currency_code VARCHAR(3) DEFAULT NULL,
    p_exchange_rate NUMERIC DEFAULT NULL,
    p_prices_tax_inclusive BOOLEAN DEFAULT NULL,
    p_shipping_amount NUMERIC DEFAULT NULL,
    p_shipping_tax_rate_pct NUMERIC DEFAULT NULL,
    p_round_off_amount NUMERIC DEFAULT NULL,
    p_additional_charges_amount NUMERIC DEFAULT NULL,
    p_transaction_discount_percentage NUMERIC DEFAULT NULL,
    p_transaction_discount_amount NUMERIC DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_tenant_id UUID;
    v_customer RECORD;
    v_gst RECORD;
    v_quote_id UUID;
    v_quote_status public.sales_document_status;
    v_quote_sent_at TIMESTAMPTZ;
    v_quote_number TEXT;
    v_entry JSONB;
    v_line RECORD;
    v_line_count INTEGER := 0;
    v_total_gross NUMERIC(15, 4) := 0;
    v_total_tax NUMERIC(15, 4) := 0;
    v_subtotal NUMERIC(15, 4) := 0;
    v_txn_discount NUMERIC(15, 4) := 0;
    v_payment_terms INTEGER := GREATEST(COALESCE(p_payment_terms_days, 0), 0);
    v_custom_fields JSONB := COALESCE(p_custom_fields, '{}'::jsonb);
    v_currency_code VARCHAR(3);
    v_exchange_rate NUMERIC(15, 4) := GREATEST(COALESCE(p_exchange_rate, 1), 0.0001);
    v_prices_tax_inclusive BOOLEAN := COALESCE(p_prices_tax_inclusive, FALSE);
    v_shipping_amount NUMERIC(15, 4) := GREATEST(COALESCE(p_shipping_amount, 0), 0);
    v_shipping_tax_rate_pct NUMERIC(15, 4) := GREATEST(COALESCE(p_shipping_tax_rate_pct, 0), 0);
    v_shipping_tax_amount NUMERIC(15, 4) := ROUND(v_shipping_amount * v_shipping_tax_rate_pct / 100, 4);
    v_round_off_amount NUMERIC(15, 4) := COALESCE(p_round_off_amount, 0);
    v_additional_charges_amount NUMERIC(15, 4) := GREATEST(COALESCE(p_additional_charges_amount, 0), 0);
    v_txn_discount_pct NUMERIC(5, 2) := GREATEST(COALESCE(p_transaction_discount_percentage, 0), 0);
    v_txn_discount_amt NUMERIC(15, 4) := GREATEST(COALESCE(p_transaction_discount_amount, 0), 0);
    v_total_net NUMERIC(15, 4);
BEGIN
    v_tenant_id := private.current_tenant_id();
    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'tenant context missing from session';
    END IF;

    IF NOT private.can_edit_sales_orders() THEN
        RAISE EXCEPTION 'sales quotation edit permission required';
    END IF;

    IF p_created_by IS NULL OR p_customer_id IS NULL OR p_valid_until IS NULL THEN
        RAISE EXCEPTION 'created_by, customer_id, and valid_until are required';
    END IF;

    IF p_valid_until <= NOW() THEN
        RAISE EXCEPTION 'valid_until must be in the future';
    END IF;

    IF p_lines IS NULL OR jsonb_typeof(p_lines) <> 'array' OR jsonb_array_length(p_lines) = 0 THEN
        RAISE EXCEPTION 'at least one quotation line is required';
    END IF;

    SELECT upper(btrim(COALESCE(
        p_currency_code,
        (SELECT t.base_currency FROM public.tenants t WHERE t.id = v_tenant_id),
        'INR'
    ))) INTO v_currency_code;

    SELECT * INTO v_customer
    FROM public.entities
    WHERE id = p_customer_id AND tenant_id = v_tenant_id AND is_active = TRUE;

    IF NOT FOUND OR v_customer.type NOT IN ('CUSTOMER'::public.entity_commercial_type, 'MUTUAL_PARTNER'::public.entity_commercial_type) THEN
        RAISE EXCEPTION 'customer not found';
    END IF;

    SELECT * INTO v_gst
    FROM private.resolve_sales_document_gst_context(
        v_tenant_id, p_customer_id, p_billing_state, p_shipping_state, p_origin_location_id
    );

    IF p_sales_quotation_id IS NOT NULL THEN
        SELECT id, commercial_status, sent_at
        INTO v_quote_id, v_quote_status, v_quote_sent_at
        FROM public.sales_quotations
        WHERE id = p_sales_quotation_id AND tenant_id = v_tenant_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'sales quotation not found';
        END IF;

        IF v_quote_sent_at IS NOT NULL THEN
            RAISE EXCEPTION 'this sales quotation cannot be edited after it has been sent';
        END IF;

        IF v_quote_status NOT IN ('DRAFT'::public.sales_document_status, 'PENDING_APPROVAL'::public.sales_document_status) THEN
            RAISE EXCEPTION 'this sales quotation cannot be edited';
        END IF;

        UPDATE public.sales_quotations
        SET customer_id = p_customer_id,
            origin_location_id = p_origin_location_id,
            valid_until = p_valid_until,
            billing_state = p_billing_state,
            shipping_state = p_shipping_state,
            payment_terms_days = v_payment_terms,
            currency_code = v_currency_code,
            exchange_rate = v_exchange_rate,
            prices_tax_inclusive = v_prices_tax_inclusive,
            tax_supply_nature = v_gst.tax_supply_nature,
            tax_mechanism = v_gst.tax_mechanism,
            customer_tax_treatment = v_gst.customer_tax_treatment,
            customer_country_code = v_gst.customer_country_code,
            rcm_applicable = v_gst.rcm_applicable,
            shipping_amount = v_shipping_amount,
            shipping_tax_rate_pct = v_shipping_tax_rate_pct,
            shipping_tax_amount = v_shipping_tax_amount,
            round_off_amount = v_round_off_amount,
            additional_charges_amount = v_additional_charges_amount,
            transaction_discount_percentage = v_txn_discount_pct,
            transaction_discount_amount = v_txn_discount_amt,
            custom_fields = v_custom_fields,
            updated_at = NOW()
        WHERE id = p_sales_quotation_id;

        DELETE FROM public.sales_quotation_items
        WHERE sales_quotation_id = p_sales_quotation_id AND tenant_id = v_tenant_id;

        v_quote_id := p_sales_quotation_id;
    ELSE
        v_quote_number := public.generate_next_voucher_string(
            v_tenant_id, 'SALES_QUOTATION'::public.document_voucher_type, NULL, p_origin_location_id
        );

        INSERT INTO public.sales_quotations (
            tenant_id, customer_id, origin_location_id, quotation_number,
            commercial_status, valid_until, billing_state, shipping_state,
            payment_terms_days, currency_code, exchange_rate, prices_tax_inclusive,
            tax_supply_nature, tax_mechanism, customer_tax_treatment, customer_country_code,
            rcm_applicable, shipping_amount, shipping_tax_rate_pct, shipping_tax_amount,
            round_off_amount, additional_charges_amount,
            transaction_discount_percentage, transaction_discount_amount,
            custom_fields, created_by
        )
        VALUES (
            v_tenant_id, p_customer_id, p_origin_location_id, v_quote_number,
            'DRAFT'::public.sales_document_status, p_valid_until, p_billing_state, p_shipping_state,
            v_payment_terms, v_currency_code, v_exchange_rate, v_prices_tax_inclusive,
            v_gst.tax_supply_nature, v_gst.tax_mechanism, v_gst.customer_tax_treatment,
            v_gst.customer_country_code, v_gst.rcm_applicable,
            v_shipping_amount, v_shipping_tax_rate_pct, v_shipping_tax_amount,
            v_round_off_amount, v_additional_charges_amount,
            v_txn_discount_pct, v_txn_discount_amt,
            v_custom_fields, p_created_by
        )
        RETURNING id INTO v_quote_id;
    END IF;

    FOR v_entry IN SELECT value FROM jsonb_array_elements(p_lines)
    LOOP
        SELECT * INTO v_line
        FROM private.compute_sales_line_amounts(
            v_entry, v_tenant_id, v_prices_tax_inclusive,
            v_gst.tax_supply_nature, v_gst.tax_mechanism
        );

        v_subtotal := v_subtotal + v_line.line_total_gross;
        v_total_gross := v_total_gross + v_line.line_total_gross;
        v_total_tax := v_total_tax + v_line.line_tax_amount;

        INSERT INTO public.sales_quotation_items (
            tenant_id, sales_quotation_id, item_id, variant_id,
            uom_code, uom_conversion_factor, quantity_quoted,
            unit_price_selling, discount_percentage, discount_amount,
            tax_rate_percentage, tax_components_json,
            line_tax_amount, line_total_gross
        )
        VALUES (
            v_tenant_id, v_quote_id, v_line.item_id, v_line.variant_id,
            v_line.uom_code, v_line.uom_conversion_factor, v_line.quantity,
            v_line.unit_price, v_line.discount_percentage, v_line.discount_amount,
            v_line.tax_rate_percentage, v_line.tax_components_json,
            v_line.line_tax_amount, v_line.line_total_gross
        );

        v_line_count := v_line_count + 1;
    END LOOP;

    IF v_line_count = 0 THEN
        RAISE EXCEPTION 'no valid quotation lines were saved';
    END IF;

    IF v_txn_discount_amt > 0 THEN
        v_txn_discount := LEAST(v_txn_discount_amt, v_subtotal);
    ELSIF v_txn_discount_pct > 0 THEN
        v_txn_discount := LEAST(v_subtotal, ROUND(v_subtotal * v_txn_discount_pct / 100, 4));
    END IF;

    v_total_gross := GREATEST(v_total_gross - v_txn_discount, 0);
    v_total_tax := v_total_tax + v_shipping_tax_amount;
    v_total_net := v_total_gross + v_total_tax + v_shipping_amount + v_additional_charges_amount + v_round_off_amount;

    UPDATE public.sales_quotations
    SET total_gross_amount = v_total_gross,
        total_tax_amount = v_total_tax,
        total_net_amount = v_total_net,
        transaction_discount_amount = v_txn_discount,
        updated_at = NOW()
    WHERE id = v_quote_id;

    RETURN v_quote_id;
END;
$$;

-- --------------------------------------------------------------------
-- 5. confirm_sales_quotation
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.confirm_sales_quotation(p_quotation_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_tenant_id UUID;
    v_user_id UUID;
    v_quote RECORD;
    v_line_count INTEGER;
BEGIN
    v_tenant_id := private.current_tenant_id();
    v_user_id := auth.uid();

    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'tenant context missing from session';
    END IF;

    IF NOT private.can_edit_sales_orders() THEN
        RAISE EXCEPTION 'sales quotation edit permission required';
    END IF;

    SELECT * INTO v_quote
    FROM public.sales_quotations
    WHERE id = p_quotation_id AND tenant_id = v_tenant_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'sales quotation not found';
    END IF;

    IF v_quote.commercial_status = 'DRAFT'::public.sales_document_status THEN
        IF private.quote_approval_required(v_tenant_id, v_quote.total_net_amount, v_user_id, p_quotation_id) THEN
            RAISE EXCEPTION 'quotation approval is required before confirmation';
        END IF;
    ELSIF v_quote.commercial_status = 'PENDING_APPROVAL'::public.sales_document_status THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.document_approval_requests dar
            WHERE dar.tenant_id = v_tenant_id
              AND dar.document_type = 'SALES_QUOTATION'
              AND dar.document_id = p_quotation_id
              AND dar.status = 'APPROVED'
        )
        AND NOT EXISTS (
            SELECT 1 FROM public.document_approval_runs r
            WHERE r.tenant_id = v_tenant_id
              AND r.document_type = 'SALES_QUOTATION'
              AND r.document_id = p_quotation_id
              AND r.status = 'APPROVED'
        ) THEN
            RAISE EXCEPTION 'quotation must be approved before confirmation';
        END IF;
    ELSE
        RAISE EXCEPTION 'only draft or pending-approval quotations can be confirmed';
    END IF;

    IF v_quote.valid_until <= NOW() THEN
        RAISE EXCEPTION 'quotation has expired; update valid until before confirming';
    END IF;

    SELECT COUNT(*) INTO v_line_count
    FROM public.sales_quotation_items
    WHERE sales_quotation_id = p_quotation_id AND tenant_id = v_tenant_id;

    IF v_line_count < 1 THEN
        RAISE EXCEPTION 'quotation must have at least one line before confirmation';
    END IF;

    UPDATE public.sales_quotations
    SET commercial_status = 'APPROVED_ACTIVE'::public.sales_document_status,
        updated_at = NOW()
    WHERE id = p_quotation_id;

    PERFORM private.enqueue_activity_outbox(
        v_tenant_id,
        'SALES_QUOTATION'::public.activity_entity_type,
        p_quotation_id,
        'status_changed',
        'quote_status_confirmed',
        jsonb_build_object('quotation_number', v_quote.quotation_number),
        COALESCE(v_user_id, v_quote.created_by),
        NULL
    );

    RETURN jsonb_build_object(
        'quotation_id', p_quotation_id,
        'commercial_status', 'APPROVED_ACTIVE'
    );
END;
$$;

-- --------------------------------------------------------------------
-- 6. send_sales_quotation
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.send_sales_quotation(
    p_quotation_id UUID,
    p_sent_to_email TEXT DEFAULT NULL,
    p_send_channel TEXT DEFAULT 'EMAIL'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_tenant_id UUID;
    v_user_id UUID;
    v_quote RECORD;
    v_channel TEXT;
    v_email TEXT;
BEGIN
    v_tenant_id := private.current_tenant_id();
    v_user_id := auth.uid();

    IF v_tenant_id IS NULL OR v_user_id IS NULL THEN
        RAISE EXCEPTION 'tenant context missing from session';
    END IF;

    IF NOT private.can_edit_sales_orders() THEN
        RAISE EXCEPTION 'sales quotation edit permission required';
    END IF;

    SELECT * INTO v_quote
    FROM public.sales_quotations
    WHERE id = p_quotation_id AND tenant_id = v_tenant_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'sales quotation not found';
    END IF;

    IF v_quote.commercial_status <> 'APPROVED_ACTIVE'::public.sales_document_status THEN
        RAISE EXCEPTION 'only confirmed quotations can be sent';
    END IF;

    IF v_quote.valid_until <= NOW() THEN
        RAISE EXCEPTION 'quotation has expired; cannot send';
    END IF;

    v_channel := UPPER(COALESCE(NULLIF(BTRIM(p_send_channel), ''), 'EMAIL'));
    IF v_channel NOT IN ('EMAIL', 'MANUAL') THEN
        RAISE EXCEPTION 'invalid send channel';
    END IF;

    v_email := NULLIF(BTRIM(p_sent_to_email), '');

    UPDATE public.sales_quotations
    SET sent_at = NOW(),
        sent_by = v_user_id,
        send_channel = v_channel,
        sent_to_email = v_email,
        updated_at = NOW()
    WHERE id = p_quotation_id;

    PERFORM private.enqueue_activity_outbox(
        v_tenant_id,
        'SALES_QUOTATION'::public.activity_entity_type,
        p_quotation_id,
        'posted',
        'quote_status_sent',
        jsonb_build_object(
            'quotation_number', v_quote.quotation_number,
            'sent_to_email', v_email,
            'send_channel', v_channel
        ),
        v_user_id,
        NULL
    );

    RETURN jsonb_build_object(
        'quotation_id', p_quotation_id,
        'sent_at', (SELECT sent_at FROM public.sales_quotations WHERE id = p_quotation_id),
        'send_channel', v_channel
    );
END;
$$;

-- --------------------------------------------------------------------
-- 7. approve_sales_quotation (workflow only — no status jump)
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.approve_sales_quotation(p_quotation_id UUID, p_notes TEXT DEFAULT NULL)
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
    v_submitter_id UUID;
    v_run RECORD;
    v_step RECORD;
    v_notes TEXT;
    v_run_complete BOOLEAN;
BEGIN
    v_tenant_id := private.current_tenant_id();
    v_user_id := auth.uid();

    IF v_tenant_id IS NULL OR v_user_id IS NULL THEN
        RAISE EXCEPTION 'tenant context missing from session';
    END IF;

    SELECT * INTO v_doc
    FROM public.sales_quotations
    WHERE id = p_quotation_id AND tenant_id = v_tenant_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'sales quotation not found';
    END IF;

    IF NOT private.user_can_approve_sales_document_amount(v_user_id, v_tenant_id, v_doc.total_net_amount, 'quote') THEN
        RAISE EXCEPTION 'quotation approver permission required';
    END IF;

    IF v_doc.commercial_status <> 'PENDING_APPROVAL'::public.sales_document_status THEN
        RAISE EXCEPTION 'only pending-approval quotations can be approved';
    END IF;

    SELECT dar.id, dar.submitted_by INTO v_request_id, v_submitter_id
    FROM public.document_approval_requests dar
    WHERE dar.tenant_id = v_tenant_id
      AND dar.document_type = 'SALES_QUOTATION'
      AND dar.document_id = p_quotation_id
      AND dar.status = 'PENDING'
    ORDER BY dar.submitted_at DESC
    LIMIT 1;

    IF v_request_id IS NULL THEN
        RAISE EXCEPTION 'pending approval request not found';
    END IF;

    SELECT * INTO v_run
    FROM public.document_approval_runs r
    WHERE r.tenant_id = v_tenant_id
      AND r.document_type = 'SALES_QUOTATION'
      AND r.document_id = p_quotation_id
      AND r.status = 'PENDING'
    ORDER BY r.submitted_at DESC
    LIMIT 1;

    v_notes := NULLIF(BTRIM(p_notes), '');

    IF FOUND THEN
        SELECT s.* INTO v_step
        FROM public.document_approval_run_steps s
        JOIN public.document_approval_run_step_assignees a ON a.step_id = s.id AND a.user_id = v_user_id
        WHERE s.run_id = v_run.id AND s.status = 'PENDING'
        ORDER BY s.level_index, s.step_index
        LIMIT 1;

        IF v_step.id IS NULL AND NOT private.user_is_po_super_approver(v_user_id) THEN
            RAISE EXCEPTION 'no pending approval step assigned to you';
        END IF;

        IF v_step.id IS NOT NULL THEN
            INSERT INTO public.document_approval_step_decisions (tenant_id, step_id, user_id, decision, notes)
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
            PERFORM private.notify_quote_approval_step_assignees(
                v_tenant_id, v_run.id, p_quotation_id, v_doc.quotation_number, 'approval.step_opened'
            );
            RETURN jsonb_build_object('quotation_id', p_quotation_id, 'pending_next_step', TRUE);
        END IF;
    END IF;

    UPDATE public.document_approval_requests
    SET status = 'APPROVED', decided_by = v_user_id, decided_at = NOW(),
        decision_notes = v_notes, updated_at = NOW()
    WHERE id = v_request_id;

    INSERT INTO public.document_approvals (tenant_id, document_type, document_id, approved_by, approved_at, notes)
    VALUES (v_tenant_id, 'SALES_QUOTATION', p_quotation_id, v_user_id, NOW(), v_notes);

    PERFORM private.create_in_app_notification(
        v_tenant_id, v_submitter_id, 'approval.approved',
        'Approved — ' || v_doc.quotation_number,
        'Your quotation was fully approved. Confirm and send it to your customer.',
        '/sales/quotes?id=' || p_quotation_id::text,
        'SALES_QUOTATION', p_quotation_id, v_run.id
    );

    RETURN jsonb_build_object('quotation_id', p_quotation_id, 'approved', TRUE);
END;
$$;

-- --------------------------------------------------------------------
-- 8. reject_sales_quotation
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reject_sales_quotation(p_quotation_id UUID, p_notes TEXT DEFAULT NULL)
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
    v_submitter_id UUID;
    v_run RECORD;
    v_notes TEXT;
BEGIN
    v_tenant_id := private.current_tenant_id();
    v_user_id := auth.uid();

    IF v_tenant_id IS NULL OR v_user_id IS NULL THEN
        RAISE EXCEPTION 'tenant context missing from session';
    END IF;

    SELECT * INTO v_doc
    FROM public.sales_quotations
    WHERE id = p_quotation_id AND tenant_id = v_tenant_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'sales quotation not found';
    END IF;

    IF v_doc.commercial_status <> 'PENDING_APPROVAL'::public.sales_document_status THEN
        RAISE EXCEPTION 'only pending-approval quotations can be rejected';
    END IF;

    IF NOT private.user_can_approve_sales_document_amount(v_user_id, v_tenant_id, v_doc.total_net_amount, 'quote') THEN
        RAISE EXCEPTION 'quotation approver permission required';
    END IF;

    v_notes := NULLIF(BTRIM(p_notes), '');
    IF v_notes IS NULL THEN
        RAISE EXCEPTION 'rejection reason is required';
    END IF;

    SELECT dar.id, dar.submitted_by INTO v_request_id, v_submitter_id
    FROM public.document_approval_requests dar
    WHERE dar.tenant_id = v_tenant_id
      AND dar.document_type = 'SALES_QUOTATION'
      AND dar.document_id = p_quotation_id
      AND dar.status = 'PENDING'
    ORDER BY dar.submitted_at DESC
    LIMIT 1;

    IF v_request_id IS NULL THEN
        RAISE EXCEPTION 'pending approval request not found';
    END IF;

    SELECT * INTO v_run
    FROM public.document_approval_runs r
    WHERE r.tenant_id = v_tenant_id
      AND r.document_type = 'SALES_QUOTATION'
      AND r.document_id = p_quotation_id
      AND r.status = 'PENDING'
    ORDER BY r.submitted_at DESC
    LIMIT 1;

    IF FOUND THEN
        UPDATE public.document_approval_runs
        SET status = 'REJECTED', completed_at = NOW(), updated_at = NOW()
        WHERE id = v_run.id;
        UPDATE public.document_approval_run_steps
        SET status = 'REJECTED', updated_at = NOW()
        WHERE run_id = v_run.id AND status IN ('PENDING', 'LOCKED');
    END IF;

    UPDATE public.document_approval_requests
    SET status = 'REJECTED', decided_by = v_user_id, decided_at = NOW(),
        decision_notes = v_notes, updated_at = NOW()
    WHERE id = v_request_id;

    UPDATE public.sales_quotations
    SET commercial_status = 'DRAFT'::public.sales_document_status,
        updated_at = NOW()
    WHERE id = p_quotation_id;

    PERFORM private.create_in_app_notification(
        v_tenant_id, v_submitter_id, 'approval.rejected',
        'Rejected — ' || v_doc.quotation_number,
        'Reason: ' || v_notes,
        '/sales/quotes?id=' || p_quotation_id::text,
        'SALES_QUOTATION', p_quotation_id, v_run.id
    );

    RETURN jsonb_build_object('quotation_id', p_quotation_id);
END;
$$;

-- --------------------------------------------------------------------
-- 9. Grants
-- --------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.confirm_sales_quotation(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.confirm_sales_quotation(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.send_sales_quotation(UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.send_sales_quotation(UUID, TEXT, TEXT) TO authenticated;

-- --------------------------------------------------------------------
-- 10. Notification template: sales.quotation.sent
-- --------------------------------------------------------------------
INSERT INTO public.notification_template_system_defaults (
    template_key, channel, locale, event_code, document_domain, label, description,
    subject_template, body_template, body_template_html,
    whatsapp_provider_template_name, whatsapp_param_mapping
) VALUES (
    'sales.quotation.sent', 'EMAIL', 'en-US', 'sales.quotation.sent', 'SALES',
    'Quotation sent to customer',
    'Sent to the customer when a sales quotation is emailed.',
    'Quotation {{quotation_number}} from {{sender_name}}',
    E'Hello,\n\nPlease find attached our quotation {{quotation_number}}.\n\nValid until: {{valid_until}}\nTotal: {{total_net_amount}}\n\n{{sender_name}}',
    E'<p>Hello,</p><p>Please find attached our quotation <strong>{{quotation_number}}</strong>.</p><p><strong>Valid until:</strong> {{valid_until}}<br/><strong>Total:</strong> {{total_net_amount}}</p><p>{{sender_name}}</p>',
    NULL, '[]'::jsonb
)
ON CONFLICT (template_key, channel, locale) DO NOTHING;

INSERT INTO public.notification_templates (
    tenant_id, template_key, channel, locale, event_code, document_domain,
    label, description, subject_template, body_template, body_template_html,
    whatsapp_provider_template_name, whatsapp_param_mapping, is_active, is_customized
)
SELECT
    t.id,
    std.template_key,
    std.channel,
    std.locale,
    std.event_code,
    std.document_domain,
    std.label,
    std.description,
    std.subject_template,
    std.body_template,
    std.body_template_html,
    std.whatsapp_provider_template_name,
    std.whatsapp_param_mapping,
    TRUE,
    FALSE
FROM public.tenants t
CROSS JOIN public.notification_template_system_defaults std
WHERE std.template_key = 'sales.quotation.sent'
  AND std.channel = 'EMAIL'
  AND std.locale = 'en-US'
ON CONFLICT (tenant_id, template_key, channel, locale) DO NOTHING;

-- ====================================================================
-- Procurement billing Phase 2: three-way qty validation, PO invoiced qty,
-- deferred AP/GL payables posting, PPV expense GL, void bill RPC
-- Migration: 20260622110000_procurement_billing_three_way_gl.sql
-- ====================================================================

ALTER TABLE public.purchase_invoices
    ADD COLUMN IF NOT EXISTS payables_posted_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS document_status TEXT NOT NULL DEFAULT 'ACTIVE'
        CHECK (document_status IN ('ACTIVE', 'CANCELLED'));

-- --------------------------------------------------------------------
-- 1. Financial settings UUID helper (ppv_expense_account_id, etc.)
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.get_financial_control_uuid(
    p_tenant_id UUID,
    p_key TEXT
)
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_value TEXT;
BEGIN
    SELECT NULLIF(btrim(configuration_metadata ->> p_key), '')
    INTO v_value
    FROM public.workspace_control_registry
    WHERE tenant_id = p_tenant_id
      AND scope_level = 'TENANT_GLOBAL'
      AND registry_key = 'FINANCIAL_SETTINGS'
      AND target_reference_id IS NULL
    ORDER BY updated_at DESC
    LIMIT 1;

    IF v_value IS NULL OR btrim(v_value) = '' THEN
        RETURN NULL;
    END IF;

    RETURN v_value::UUID;
EXCEPTION
    WHEN invalid_text_representation THEN
        RETURN NULL;
END;
$$;

-- --------------------------------------------------------------------
-- 2. GRN accepted quantity helper for three-way match
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.grn_accepted_quantity_for_po_item(
    p_tenant_id UUID,
    p_po_item_id UUID,
    p_grn_ids UUID[]
)
RETURNS NUMERIC(15, 4)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
    SELECT COALESCE(
        SUM(
            CASE
                WHEN COALESCE(gri.quantity_accepted, 0) > 0 THEN gri.quantity_accepted
                ELSE gri.quantity_received
            END
        ),
        0
    )::NUMERIC(15, 4)
    FROM public.goods_receipt_items gri
    WHERE gri.tenant_id = p_tenant_id
      AND gri.po_item_id = p_po_item_id
      AND gri.goods_receipt_id = ANY(p_grn_ids)
      AND COALESCE(gri.is_promotional, FALSE) = FALSE;
$$;

-- --------------------------------------------------------------------
-- 3. GL helpers
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.post_gl_line_by_account_id(
    p_tenant_id UUID,
    p_gl_header_id UUID,
    p_account_id UUID,
    p_debit NUMERIC(15, 4),
    p_credit NUMERIC(15, 4)
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
BEGIN
    IF p_account_id IS NULL THEN
        RAISE EXCEPTION 'account id required for GL line';
    END IF;

    INSERT INTO public.general_ledger_entries (
        tenant_id, gl_header_id, account_id, debit_amount, credit_amount
    )
    VALUES (
        p_tenant_id,
        p_gl_header_id,
        p_account_id,
        p_debit,
        p_credit
    );
END;
$$;

CREATE OR REPLACE FUNCTION private.purchase_invoice_payables_already_posted(
    p_tenant_id UUID,
    p_invoice_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
    SELECT
        EXISTS (
            SELECT 1
            FROM public.purchase_invoices pi
            WHERE pi.id = p_invoice_id
              AND pi.tenant_id = p_tenant_id
              AND pi.payables_posted_at IS NOT NULL
        )
        OR EXISTS (
            SELECT 1
            FROM public.document_posting_runs dpr
            CROSS JOIN LATERAL jsonb_array_elements(dpr.steps) step(value)
            WHERE dpr.tenant_id = p_tenant_id
              AND dpr.document_type = 'BILL'::public.document_posting_document_type
              AND dpr.document_id = p_invoice_id
              AND step.value ->> 'id' = 'bill_payables_posted'
              AND step.value ->> 'status' = 'success'
        );
$$;

CREATE OR REPLACE FUNCTION private.post_purchase_invoice_payables(p_invoice_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_invoice public.purchase_invoices%ROWTYPE;
    v_header_id UUID;
    v_voucher TEXT;
    v_half_tax NUMERIC(15, 4);
    v_components JSONB;
    v_cgst NUMERIC(15, 4) := 0;
    v_sgst NUMERIC(15, 4) := 0;
    v_igst NUMERIC(15, 4) := 0;
    v_entry JSONB;
    v_steps JSONB := '[]'::jsonb;
BEGIN
    SELECT * INTO v_invoice
    FROM public.purchase_invoices
    WHERE id = p_invoice_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'purchase invoice not found';
    END IF;

    IF v_invoice.document_status = 'CANCELLED' THEN
        RETURN jsonb_build_object(
            'posted', FALSE,
            'skipped', TRUE,
            'reason', 'cancelled',
            'steps', v_steps
        );
    END IF;

    IF v_invoice.match_status = 'PPV_HOLD'::public.purchase_invoice_match_status THEN
        RETURN jsonb_build_object(
            'posted', FALSE,
            'skipped', TRUE,
            'reason', 'PPV_HOLD',
            'steps', v_steps
        );
    END IF;

    IF private.purchase_invoice_payables_already_posted(v_invoice.tenant_id, p_invoice_id) THEN
        RETURN jsonb_build_object(
            'posted', FALSE,
            'skipped', TRUE,
            'reason', 'already_posted',
            'steps', v_steps
        );
    END IF;

    IF v_invoice.total_liability_amount <= 0 AND v_invoice.total_tax_amount <= 0 THEN
        RETURN jsonb_build_object(
            'posted', FALSE,
            'skipped', TRUE,
            'reason', 'zero_liability',
            'steps', v_steps
        );
    END IF;

    v_voucher := 'GL-AP-TAX-' || v_invoice.system_voucher_number;
    v_header_id := private.create_gl_voucher(
        v_invoice.tenant_id,
        v_voucher,
        NOW(),
        'PURCHASE_INVOICE',
        v_invoice.id,
        'Input tax on purchase invoice ' || v_invoice.invoice_number_vendor
    );

    PERFORM private.post_gl_line(
        v_invoice.tenant_id,
        v_header_id,
        '2100-AP',
        v_invoice.total_liability_amount,
        0.0000
    );

    IF v_invoice.tax_mechanism = 'IMPORT_IGST'::public.gst_tax_mechanism THEN
        PERFORM private.post_gl_line(
            v_invoice.tenant_id, v_header_id, '1380-INPUT-IGST', v_invoice.total_tax_amount, 0.0000
        );
        PERFORM private.post_gl_line(
            v_invoice.tenant_id, v_header_id, '2120-IMPORT-IGST-PAYABLE', 0.0000, v_invoice.total_tax_amount
        );
        PERFORM private.post_gl_line(
            v_invoice.tenant_id, v_header_id, '2100-AP', 0.0000, v_invoice.total_gross_amount
        );
    ELSIF v_invoice.tax_mechanism = 'REVERSE_CHARGE'::public.gst_tax_mechanism THEN
        PERFORM private.post_gl_line(
            v_invoice.tenant_id, v_header_id, '1380-INPUT-IGST', v_invoice.total_tax_amount, 0.0000
        );
        PERFORM private.post_gl_line(
            v_invoice.tenant_id, v_header_id, '2115-RCM-LIABILITY', 0.0000, v_invoice.total_tax_amount
        );
        PERFORM private.post_gl_line(
            v_invoice.tenant_id, v_header_id, '2100-AP', 0.0000, v_invoice.total_gross_amount
        );
    ELSE
        SELECT COALESCE(jsonb_agg(pii.tax_components_json), '[]'::jsonb)
        INTO v_components
        FROM public.purchase_invoice_items pii
        WHERE pii.purchase_invoice_id = v_invoice.id
          AND pii.tenant_id = v_invoice.tenant_id;

        FOR v_entry IN SELECT value FROM jsonb_array_elements(v_components)
        LOOP
            IF upper(v_entry ->> 'name') LIKE 'CGST%' THEN
                v_cgst := v_cgst + COALESCE((v_entry ->> 'amount')::NUMERIC, 0);
            ELSIF upper(v_entry ->> 'name') LIKE 'SGST%' THEN
                v_sgst := v_sgst + COALESCE((v_entry ->> 'amount')::NUMERIC, 0);
            ELSIF upper(v_entry ->> 'name') LIKE 'IGST%' THEN
                v_igst := v_igst + COALESCE((v_entry ->> 'amount')::NUMERIC, 0);
            END IF;
        END LOOP;

        IF v_cgst + v_sgst + v_igst = 0 THEN
            IF v_invoice.tax_supply_nature = 'INTRASTATE' THEN
                v_half_tax := v_invoice.total_tax_amount / 2;
                v_cgst := v_half_tax;
                v_sgst := v_invoice.total_tax_amount - v_half_tax;
            ELSE
                v_igst := v_invoice.total_tax_amount;
            END IF;
        END IF;

        IF v_cgst > 0 THEN
            PERFORM private.post_gl_line(
                v_invoice.tenant_id, v_header_id, '1381-INPUT-CGST', v_cgst, 0.0000
            );
        END IF;
        IF v_sgst > 0 THEN
            PERFORM private.post_gl_line(
                v_invoice.tenant_id, v_header_id, '1382-INPUT-SGST', v_sgst, 0.0000
            );
        END IF;
        IF v_igst > 0 THEN
            PERFORM private.post_gl_line(
                v_invoice.tenant_id, v_header_id, '1380-INPUT-IGST', v_igst, 0.0000
            );
        END IF;
        PERFORM private.post_gl_line(
            v_invoice.tenant_id, v_header_id, '2100-AP', 0.0000, v_invoice.total_gross_amount
        );
    END IF;

    UPDATE public.purchase_invoices
    SET payables_posted_at = NOW(),
        updated_at = NOW()
    WHERE id = p_invoice_id;

    v_steps := private.append_posting_step(
        v_steps,
        'bill_payables_posted',
        'success',
        v_voucher
    );

    RETURN jsonb_build_object(
        'posted', TRUE,
        'skipped', FALSE,
        'voucher_number', v_voucher,
        'steps', v_steps
    );
END;
$$;

-- --------------------------------------------------------------------
-- 4. Guarded trigger — delegates to post_purchase_invoice_payables
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.purchase_invoices_post_input_tax()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_result JSONB;
BEGIN
    IF NEW.total_tax_amount <= 0 AND NEW.total_liability_amount <= 0 THEN
        RETURN NEW;
    END IF;

    IF NEW.payables_posted_at IS NOT NULL THEN
        RETURN NEW;
    END IF;

    IF private.purchase_invoice_payables_already_posted(NEW.tenant_id, NEW.id) THEN
        RETURN NEW;
    END IF;

    IF NEW.match_status = 'PPV_HOLD'::public.purchase_invoice_match_status THEN
        RETURN NEW;
    END IF;

    v_result := private.post_purchase_invoice_payables(NEW.id);
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS purchase_invoices_post_input_tax ON public.purchase_invoices;
CREATE TRIGGER purchase_invoices_post_input_tax
    AFTER INSERT ON public.purchase_invoices
    FOR EACH ROW
    EXECUTE FUNCTION public.purchase_invoices_post_input_tax();

-- --------------------------------------------------------------------
-- 5. save_purchase_invoice — qty validation, quantity_invoiced, payables
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.save_purchase_invoice(
    p_purchase_invoice_id UUID,
    p_supplier_id UUID,
    p_billing_location_id UUID,
    p_invoice_number_vendor TEXT,
    p_lines JSONB,
    p_created_by UUID,
    p_purchase_order_id UUID DEFAULT NULL,
    p_currency_code VARCHAR(3) DEFAULT NULL,
    p_exchange_rate NUMERIC(15, 6) DEFAULT NULL,
    p_bill_of_entry_number TEXT DEFAULT NULL,
    p_bill_of_entry_date DATE DEFAULT NULL,
    p_port_code VARCHAR(10) DEFAULT NULL,
    p_custom_fields JSONB DEFAULT '{}'::jsonb,
    p_goods_receipt_ids UUID[] DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_tenant_id UUID;
    v_tenant_country TEXT;
    v_supplier RECORD;
    v_location RECORD;
    v_po RECORD;
    v_gst_ctx RECORD;
    v_invoice_id UUID;
    v_voucher TEXT;
    v_entry JSONB;
    v_item_id UUID;
    v_variant_id UUID;
    v_po_item_id UUID;
    v_qty NUMERIC(15, 4);
    v_unit_price NUMERIC(15, 4);
    v_line_gross NUMERIC(15, 4);
    v_line_tax NUMERIC(15, 4);
    v_tax_rate NUMERIC(15, 4);
    v_tax_components JSONB;
    v_total_gross NUMERIC(15, 4) := 0;
    v_total_tax NUMERIC(15, 4) := 0;
    v_supply_nature TEXT;
    v_mechanism public.gst_tax_mechanism;
    v_gr_id UUID;
    v_grn_ids UUID[];
    v_tolerance NUMERIC(15, 4);
    v_match_variance NUMERIC(15, 4) := 0;
    v_match_status public.purchase_invoice_match_status := 'MATCHED';
    v_po_rate NUMERIC(15, 4);
    v_grn_accepted NUMERIC(15, 4);
    v_already_invoiced NUMERIC(15, 4);
    v_payables_result JSONB;
    v_steps JSONB := '[]'::jsonb;
BEGIN
    v_tenant_id := private.current_tenant_id();
    IF v_tenant_id IS NULL THEN RAISE EXCEPTION 'tenant context missing from session'; END IF;
    IF p_supplier_id IS NULL OR p_billing_location_id IS NULL THEN RAISE EXCEPTION 'supplier and billing location are required'; END IF;
    IF p_invoice_number_vendor IS NULL OR btrim(p_invoice_number_vendor) = '' THEN RAISE EXCEPTION 'vendor invoice number is required'; END IF;
    IF p_lines IS NULL OR jsonb_array_length(p_lines) = 0 THEN RAISE EXCEPTION 'at least one bill line is required'; END IF;

    v_tolerance := GREATEST(
        COALESCE(
            NULLIF(private.get_procurement_control_text(v_tenant_id, 'matching_tolerance_percentage', '2'), '')::NUMERIC,
            2
        ),
        0
    );

    SELECT upper(btrim(COALESCE(country_code, 'IN'))) INTO v_tenant_country FROM public.tenants WHERE id = v_tenant_id;

    SELECT id, type, tax_treatment, billing_country_code, billing_state
    INTO v_supplier FROM public.entities
    WHERE id = p_supplier_id AND tenant_id = v_tenant_id AND is_active = TRUE;
    IF NOT FOUND THEN RAISE EXCEPTION 'supplier not found'; END IF;

    SELECT id, state INTO v_location FROM public.tenant_locations
    WHERE id = p_billing_location_id AND tenant_id = v_tenant_id AND is_active = TRUE;
    IF NOT FOUND THEN RAISE EXCEPTION 'billing location not found'; END IF;

    IF p_purchase_order_id IS NOT NULL THEN
        SELECT tax_supply_nature, tax_mechanism, supplier_tax_treatment, supplier_country_code
        INTO v_po FROM public.purchase_orders
        WHERE id = p_purchase_order_id AND tenant_id = v_tenant_id;
        IF NOT FOUND THEN RAISE EXCEPTION 'purchase order not found'; END IF;
        v_supply_nature := v_po.tax_supply_nature;
        v_mechanism := v_po.tax_mechanism;
    ELSE
        SELECT * INTO v_gst_ctx FROM private.gst_resolve_supply_context(
            v_tenant_country, v_supplier.tax_treatment, v_supplier.billing_country_code,
            v_supplier.billing_state, v_location.state, 'PURCHASE', 'GOODS'
        ) LIMIT 1;
        v_supply_nature := v_gst_ctx.supply_nature;
        v_mechanism := v_gst_ctx.tax_mechanism;
    END IF;

    IF p_purchase_invoice_id IS NOT NULL THEN
        SELECT id INTO v_invoice_id FROM public.purchase_invoices
        WHERE id = p_purchase_invoice_id
          AND tenant_id = v_tenant_id
          AND document_status = 'ACTIVE';
        IF NOT FOUND THEN RAISE EXCEPTION 'purchase invoice not found or cancelled'; END IF;

        IF p_goods_receipt_ids IS NOT NULL THEN
            v_grn_ids := p_goods_receipt_ids;
        ELSE
            SELECT COALESCE(array_agg(pir.goods_receipt_id), ARRAY[]::UUID[])
            INTO v_grn_ids
            FROM public.purchase_invoice_receipts pir
            WHERE pir.purchase_invoice_id = p_purchase_invoice_id
              AND pir.tenant_id = v_tenant_id;
        END IF;

        UPDATE public.purchase_order_items poi
        SET quantity_invoiced = GREATEST(poi.quantity_invoiced - sub.old_qty, 0),
            updated_at = NOW()
        FROM (
            SELECT pii.purchase_order_item_id, SUM(pii.quantity_billed) AS old_qty
            FROM public.purchase_invoice_items pii
            WHERE pii.purchase_invoice_id = p_purchase_invoice_id
              AND pii.tenant_id = v_tenant_id
              AND pii.purchase_order_item_id IS NOT NULL
            GROUP BY pii.purchase_order_item_id
        ) sub
        WHERE poi.id = sub.purchase_order_item_id
          AND poi.tenant_id = v_tenant_id;

        DELETE FROM public.purchase_invoice_items
        WHERE purchase_invoice_id = p_purchase_invoice_id AND tenant_id = v_tenant_id;

        IF p_goods_receipt_ids IS NOT NULL THEN
            DELETE FROM public.purchase_invoice_receipts
            WHERE purchase_invoice_id = p_purchase_invoice_id AND tenant_id = v_tenant_id;
        END IF;
    ELSE
        v_grn_ids := p_goods_receipt_ids;

        v_voucher := public.generate_next_voucher_string(
            v_tenant_id, 'PURCHASE_INVOICE'::public.document_voucher_type, NULL, p_billing_location_id
        );
        INSERT INTO public.purchase_invoices (
            tenant_id, supplier_id, purchase_order_id, invoice_number_vendor, system_voucher_number,
            tax_treatment, tax_supply_nature, tax_mechanism,
            supplier_tax_treatment, supplier_country_code,
            billing_location_id, currency_code, exchange_rate,
            bill_of_entry_number, bill_of_entry_date, port_code,
            place_of_supply, rcm_applicable, custom_fields, created_by
        ) VALUES (
            v_tenant_id, p_supplier_id, p_purchase_order_id, btrim(p_invoice_number_vendor), v_voucher,
            v_supplier.tax_treatment, v_supply_nature, v_mechanism,
            v_supplier.tax_treatment, upper(btrim(v_supplier.billing_country_code)),
            p_billing_location_id,
            upper(btrim(COALESCE(p_currency_code, (SELECT base_currency FROM public.tenants WHERE id = v_tenant_id), 'INR'))),
            GREATEST(COALESCE(p_exchange_rate, 1), 0.000001),
            NULLIF(btrim(p_bill_of_entry_number), ''), p_bill_of_entry_date, NULLIF(btrim(p_port_code), ''),
            v_location.state,
            (v_mechanism = 'REVERSE_CHARGE'::public.gst_tax_mechanism),
            COALESCE(p_custom_fields, '{}'::jsonb), p_created_by
        ) RETURNING id INTO v_invoice_id;
    END IF;

    IF v_grn_ids IS NOT NULL AND array_length(v_grn_ids, 1) > 0 THEN
        FOR v_entry IN SELECT value FROM jsonb_array_elements(p_lines)
        LOOP
            v_po_item_id := NULLIF(v_entry ->> 'purchase_order_item_id', '')::UUID;
            v_qty := NULLIF(v_entry ->> 'quantity_billed', '')::NUMERIC;
            IF v_po_item_id IS NULL OR v_qty IS NULL OR v_qty <= 0 THEN
                CONTINUE;
            END IF;

            v_grn_accepted := private.grn_accepted_quantity_for_po_item(
                v_tenant_id, v_po_item_id, v_grn_ids
            );
            SELECT poi.quantity_invoiced
            INTO v_already_invoiced
            FROM public.purchase_order_items poi
            WHERE poi.id = v_po_item_id AND poi.tenant_id = v_tenant_id;

            IF v_qty + COALESCE(v_already_invoiced, 0) > v_grn_accepted THEN
                RAISE EXCEPTION
                    'quantity billed % exceeds accepted receipt quantity % for purchase order line',
                    v_qty + COALESCE(v_already_invoiced, 0),
                    v_grn_accepted;
            END IF;
        END LOOP;
    END IF;

    IF p_goods_receipt_ids IS NOT NULL THEN
        FOREACH v_gr_id IN ARRAY p_goods_receipt_ids
        LOOP
            INSERT INTO public.purchase_invoice_receipts (
                tenant_id, purchase_invoice_id, goods_receipt_id, linked_by
            )
            VALUES (v_tenant_id, v_invoice_id, v_gr_id, p_created_by)
            ON CONFLICT (tenant_id, purchase_invoice_id, goods_receipt_id) DO NOTHING;
        END LOOP;
    END IF;

    FOR v_entry IN SELECT value FROM jsonb_array_elements(p_lines)
    LOOP
        v_variant_id := NULLIF(v_entry ->> 'variant_id', '')::UUID;
        v_po_item_id := NULLIF(v_entry ->> 'purchase_order_item_id', '')::UUID;
        v_qty := NULLIF(v_entry ->> 'quantity_billed', '')::NUMERIC;
        v_unit_price := COALESCE(NULLIF(v_entry ->> 'unit_price_billed', '')::NUMERIC, 0);
        IF v_variant_id IS NULL OR v_qty IS NULL OR v_qty <= 0 THEN RAISE EXCEPTION 'invalid bill line'; END IF;

        SELECT iv.item_id INTO v_item_id FROM public.item_variants iv
        WHERE iv.id = v_variant_id AND iv.tenant_id = v_tenant_id;
        IF NOT FOUND THEN RAISE EXCEPTION 'variant not found'; END IF;

        IF v_po_item_id IS NOT NULL THEN
            SELECT poi.unit_price_contractual INTO v_po_rate
            FROM public.purchase_order_items poi
            WHERE poi.id = v_po_item_id AND poi.tenant_id = v_tenant_id;
            IF v_po_rate IS NOT NULL AND v_po_rate > 0 THEN
                v_match_variance := GREATEST(
                    v_match_variance,
                    ABS((v_unit_price - v_po_rate) / v_po_rate * 100)
                );
            END IF;
        END IF;

        SELECT rate, tax_amount, taxable_base, tax_components
        INTO v_tax_rate, v_line_tax, v_line_gross, v_tax_components
        FROM private.resolve_line_tax(
            v_item_id, v_qty, v_unit_price, 0, FALSE, v_supply_nature, v_mechanism
        ) LIMIT 1;

        v_total_gross := v_total_gross + COALESCE(v_line_gross, v_qty * v_unit_price);
        v_total_tax := v_total_tax + COALESCE(v_line_tax, 0);

        INSERT INTO public.purchase_invoice_items (
            tenant_id, purchase_invoice_id, item_id, variant_id,
            purchase_order_item_id, quantity_billed, unit_price_billed,
            line_tax_computed, tax_components_json, reverse_charge
        ) VALUES (
            v_tenant_id, v_invoice_id, v_item_id, v_variant_id,
            v_po_item_id, v_qty, v_unit_price,
            COALESCE(v_line_tax, 0), COALESCE(v_tax_components, '[]'::jsonb),
            (v_mechanism = 'REVERSE_CHARGE'::public.gst_tax_mechanism)
        );
    END LOOP;

    UPDATE public.purchase_order_items poi
    SET quantity_invoiced = poi.quantity_invoiced + sub.new_qty,
        updated_at = NOW()
    FROM (
        SELECT pii.purchase_order_item_id, SUM(pii.quantity_billed) AS new_qty
        FROM public.purchase_invoice_items pii
        WHERE pii.purchase_invoice_id = v_invoice_id
          AND pii.tenant_id = v_tenant_id
          AND pii.purchase_order_item_id IS NOT NULL
        GROUP BY pii.purchase_order_item_id
    ) sub
    WHERE poi.id = sub.purchase_order_item_id
      AND poi.tenant_id = v_tenant_id;

    IF v_match_variance > v_tolerance THEN
        v_match_status := 'PPV_HOLD'::public.purchase_invoice_match_status;
    ELSIF v_match_variance > 0 THEN
        v_match_status := 'VARIANCE'::public.purchase_invoice_match_status;
    ELSE
        v_match_status := 'MATCHED'::public.purchase_invoice_match_status;
    END IF;

    UPDATE public.purchase_invoices SET
        total_gross_amount = v_total_gross,
        total_tax_amount = v_total_tax,
        total_liability_amount = v_total_gross + v_total_tax,
        match_status = v_match_status,
        updated_at = NOW()
    WHERE id = v_invoice_id;

    v_steps := private.append_posting_step(v_steps, 'bill_invoice_recorded', 'success', btrim(p_invoice_number_vendor));

    IF v_grn_ids IS NOT NULL AND array_length(v_grn_ids, 1) > 0 THEN
        v_steps := private.append_posting_step(
            v_steps, 'bill_grn_linked', 'success', array_length(v_grn_ids, 1)::TEXT || ' receipt(s)'
        );
    ELSE
        v_steps := private.append_posting_step(v_steps, 'bill_grn_linked', 'skipped', NULL);
    END IF;

    IF v_match_status = 'MATCHED'::public.purchase_invoice_match_status THEN
        v_steps := private.append_posting_step(v_steps, 'bill_three_way_match', 'success', NULL);
    ELSIF v_match_status = 'PPV_HOLD'::public.purchase_invoice_match_status THEN
        v_steps := private.append_posting_step(v_steps, 'bill_three_way_match', 'failure', 'Tolerance exceeded');
        v_steps := private.append_posting_step(v_steps, 'bill_on_hold', 'success', NULL);
    ELSE
        v_steps := private.append_posting_step(v_steps, 'bill_three_way_match', 'success', 'Within tolerance');
    END IF;

    IF v_match_status <> 'PPV_HOLD'::public.purchase_invoice_match_status THEN
        v_payables_result := private.post_purchase_invoice_payables(v_invoice_id);
        IF COALESCE((v_payables_result ->> 'posted')::BOOLEAN, FALSE) THEN
            v_steps := v_steps || COALESCE(v_payables_result -> 'steps', '[]'::jsonb);
        ELSIF v_payables_result ->> 'reason' = 'already_posted' THEN
            v_steps := private.append_posting_step(v_steps, 'bill_payables_posted', 'skipped', 'Already posted');
        END IF;
    ELSE
        v_steps := private.append_posting_step(v_steps, 'bill_payables_posted', 'skipped', 'PPV hold');
    END IF;

    INSERT INTO public.document_posting_runs (
        tenant_id, document_type, document_id, overall_status, steps, posted_by
    )
    VALUES (
        v_tenant_id, 'BILL'::public.document_posting_document_type, v_invoice_id,
        CASE WHEN v_match_status = 'PPV_HOLD'::public.purchase_invoice_match_status THEN 'failure' ELSE 'success' END,
        v_steps, p_created_by
    );

    RETURN v_invoice_id;
END;
$$;

REVOKE ALL ON FUNCTION public.save_purchase_invoice(UUID, UUID, UUID, TEXT, JSONB, UUID, UUID, VARCHAR, NUMERIC, TEXT, DATE, VARCHAR, JSONB, UUID[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_purchase_invoice(UUID, UUID, UUID, TEXT, JSONB, UUID, UUID, VARCHAR, NUMERIC, TEXT, DATE, VARCHAR, JSONB, UUID[]) TO authenticated;

-- --------------------------------------------------------------------
-- 6. apply_purchase_price_variance — expense GL + deferred payables
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.apply_purchase_price_variance(p_invoice_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_tenant_id UUID;
    v_invoice public.purchase_invoices%ROWTYPE;
    v_line RECORD;
    v_po_rate NUMERIC(15, 4);
    v_gr_rate NUMERIC(15, 4);
    v_variance_per_unit NUMERIC(15, 4);
    v_on_hand NUMERIC(15, 4);
    v_adjust_qty NUMERIC(15, 4);
    v_expense_qty NUMERIC(15, 4);
    v_expense_amount NUMERIC(15, 4);
    v_total_adjustment NUMERIC(15, 4) := 0;
    v_total_expense NUMERIC(15, 4) := 0;
    v_cost_before NUMERIC(15, 4);
    v_new_cost NUMERIC(15, 4);
    v_reference TEXT;
    v_ppv_expense_account_id UUID;
    v_gl_header_id UUID;
    v_gl_voucher TEXT;
    v_payables_result JSONB;
    v_steps JSONB := '[]'::jsonb;
BEGIN
    v_tenant_id := private.current_tenant_id();
    IF v_tenant_id IS NULL THEN RAISE EXCEPTION 'tenant context missing from session'; END IF;

    SELECT * INTO v_invoice
    FROM public.purchase_invoices
    WHERE id = p_invoice_id AND tenant_id = v_tenant_id
    FOR UPDATE;

    IF NOT FOUND THEN RAISE EXCEPTION 'purchase invoice not found'; END IF;

    IF v_invoice.document_status = 'CANCELLED' THEN
        RAISE EXCEPTION 'cancelled purchase invoices cannot be adjusted';
    END IF;

    IF v_invoice.match_status = 'MATCHED'::public.purchase_invoice_match_status THEN
        RETURN jsonb_build_object('invoice_id', p_invoice_id, 'adjustment', 0, 'steps', '[]'::jsonb);
    END IF;

    v_ppv_expense_account_id := private.get_financial_control_uuid(v_tenant_id, 'ppv_expense_account_id');
    v_reference := v_invoice.system_voucher_number || '|PPV';

    FOR v_line IN
        SELECT pii.*
        FROM public.purchase_invoice_items pii
        WHERE pii.purchase_invoice_id = p_invoice_id AND pii.tenant_id = v_tenant_id
    LOOP
        IF v_line.purchase_order_item_id IS NULL THEN
            CONTINUE;
        END IF;

        SELECT poi.unit_price_contractual INTO v_po_rate
        FROM public.purchase_order_items poi
        WHERE poi.id = v_line.purchase_order_item_id AND poi.tenant_id = v_tenant_id;

        SELECT COALESCE(
            SUM(gri.total_final_landed_cost * gri.quantity_received)
            / NULLIF(SUM(gri.quantity_received), 0),
            v_po_rate
        )
        INTO v_gr_rate
        FROM public.goods_receipt_items gri
        WHERE gri.tenant_id = v_tenant_id
          AND gri.po_item_id = v_line.purchase_order_item_id
          AND COALESCE(gri.is_promotional, FALSE) = FALSE;

        v_variance_per_unit := COALESCE(v_line.unit_price_billed, 0) - COALESCE(v_gr_rate, v_po_rate, 0);
        IF v_variance_per_unit = 0 THEN
            CONTINUE;
        END IF;

        SELECT COALESCE(iv.total_quantity_on_hand, 0), COALESCE(iv.current_average_cost, 0)
        INTO v_on_hand, v_cost_before
        FROM public.item_valuations iv
        WHERE iv.tenant_id = v_tenant_id
          AND iv.item_id = v_line.item_id
          AND iv.variant_id IS NOT DISTINCT FROM v_line.variant_id
        ORDER BY iv.total_quantity_on_hand DESC
        LIMIT 1;

        v_adjust_qty := LEAST(COALESCE(v_on_hand, 0), v_line.quantity_billed);

        IF v_adjust_qty > 0 THEN
            v_new_cost := private.money_round(GREATEST(v_cost_before + v_variance_per_unit, 0));

            INSERT INTO public.inventory_ledger (
                tenant_id, item_id, variant_id, location_id,
                transaction_type, quantity, cost_at_transaction,
                reference_document, created_by
            )
            SELECT
                v_tenant_id, v_line.item_id, v_line.variant_id, iv.location_id,
                'COST_CORRECTION', 0, v_new_cost,
                v_reference, v_invoice.created_by
            FROM public.item_valuations iv
            WHERE iv.tenant_id = v_tenant_id
              AND iv.item_id = v_line.item_id
              AND iv.variant_id IS NOT DISTINCT FROM v_line.variant_id
              AND iv.total_quantity_on_hand > 0
            ORDER BY iv.total_quantity_on_hand DESC
            LIMIT 1;

            v_total_adjustment := v_total_adjustment + private.money_round(v_variance_per_unit * v_adjust_qty);
        END IF;

        v_expense_qty := GREATEST(v_line.quantity_billed - COALESCE(v_adjust_qty, 0), 0);
        IF v_expense_qty > 0 THEN
            v_expense_amount := private.money_round(v_variance_per_unit * v_expense_qty);
            v_total_expense := v_total_expense + v_expense_amount;

            IF v_ppv_expense_account_id IS NOT NULL AND v_expense_amount <> 0 THEN
                IF v_gl_header_id IS NULL THEN
                    v_gl_voucher := 'GL-PPV-' || v_invoice.system_voucher_number;
                    v_gl_header_id := private.create_gl_voucher(
                        v_tenant_id,
                        v_gl_voucher,
                        NOW(),
                        'PURCHASE_INVOICE',
                        p_invoice_id,
                        'Purchase price variance expense on ' || v_invoice.invoice_number_vendor
                    );
                END IF;

                IF v_expense_amount > 0 THEN
                    PERFORM private.post_gl_line_by_account_id(
                        v_tenant_id, v_gl_header_id, v_ppv_expense_account_id, v_expense_amount, 0.0000
                    );
                    PERFORM private.post_gl_line(
                        v_tenant_id, v_gl_header_id, '1400-INVENTORY', 0.0000, v_expense_amount
                    );
                ELSE
                    PERFORM private.post_gl_line_by_account_id(
                        v_tenant_id, v_gl_header_id, v_ppv_expense_account_id, 0.0000, ABS(v_expense_amount)
                    );
                    PERFORM private.post_gl_line(
                        v_tenant_id, v_gl_header_id, '1400-INVENTORY', ABS(v_expense_amount), 0.0000
                    );
                END IF;
            END IF;
        END IF;
    END LOOP;

    UPDATE public.purchase_invoices
    SET match_status = 'MATCHED'::public.purchase_invoice_match_status,
        updated_at = NOW()
    WHERE id = p_invoice_id;

    v_steps := private.append_posting_step(
        v_steps,
        'bill_cost_variance_applied',
        'success',
        private.money_round(v_total_adjustment + v_total_expense)::TEXT
    );

    IF v_total_expense <> 0 AND v_ppv_expense_account_id IS NULL THEN
        v_steps := private.append_posting_step(
            v_steps,
            'bill_ppv_expense_gl',
            'skipped',
            'ppv_expense_account_id not configured'
        );
    ELSIF v_total_expense <> 0 THEN
        v_steps := private.append_posting_step(
            v_steps,
            'bill_ppv_expense_gl',
            'success',
            private.money_round(v_total_expense)::TEXT
        );
    END IF;

    IF NOT private.purchase_invoice_payables_already_posted(v_tenant_id, p_invoice_id) THEN
        v_payables_result := private.post_purchase_invoice_payables(p_invoice_id);
        IF COALESCE((v_payables_result ->> 'posted')::BOOLEAN, FALSE) THEN
            v_steps := v_steps || COALESCE(v_payables_result -> 'steps', '[]'::jsonb);
        END IF;
    END IF;

    INSERT INTO public.document_posting_runs (
        tenant_id, document_type, document_id, overall_status, steps, posted_by
    )
    VALUES (
        v_tenant_id, 'BILL'::public.document_posting_document_type, p_invoice_id, 'success', v_steps, v_invoice.created_by
    );

    RETURN jsonb_build_object(
        'invoice_id', p_invoice_id,
        'adjustment', private.money_round(v_total_adjustment),
        'expense', private.money_round(v_total_expense),
        'steps', v_steps
    );
END;
$$;

REVOKE ALL ON FUNCTION public.apply_purchase_price_variance(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_purchase_price_variance(UUID) TO authenticated;

-- --------------------------------------------------------------------
-- 7. void_purchase_invoice
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.void_purchase_invoice(p_invoice_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_tenant_id UUID;
    v_invoice public.purchase_invoices%ROWTYPE;
    v_draft_like BOOLEAN;
    v_action TEXT;
    v_steps JSONB := '[]'::jsonb;
BEGIN
    v_tenant_id := private.current_tenant_id();
    IF v_tenant_id IS NULL THEN RAISE EXCEPTION 'tenant context missing from session'; END IF;
    IF p_invoice_id IS NULL THEN RAISE EXCEPTION 'invoice id is required'; END IF;

    SELECT * INTO v_invoice
    FROM public.purchase_invoices
    WHERE id = p_invoice_id AND tenant_id = v_tenant_id
    FOR UPDATE;

    IF NOT FOUND THEN RAISE EXCEPTION 'purchase invoice not found'; END IF;

    IF v_invoice.document_status = 'CANCELLED' THEN
        RAISE EXCEPTION 'purchase invoice is already cancelled';
    END IF;

    IF v_invoice.is_paid THEN
        RAISE EXCEPTION 'paid purchase invoices cannot be voided';
    END IF;

    UPDATE public.purchase_order_items poi
    SET quantity_invoiced = GREATEST(poi.quantity_invoiced - sub.billed_qty, 0),
        updated_at = NOW()
    FROM (
        SELECT pii.purchase_order_item_id, SUM(pii.quantity_billed) AS billed_qty
        FROM public.purchase_invoice_items pii
        WHERE pii.purchase_invoice_id = p_invoice_id
          AND pii.tenant_id = v_tenant_id
          AND pii.purchase_order_item_id IS NOT NULL
        GROUP BY pii.purchase_order_item_id
    ) sub
    WHERE poi.id = sub.purchase_order_item_id
      AND poi.tenant_id = v_tenant_id;

    DELETE FROM public.purchase_invoice_receipts
    WHERE purchase_invoice_id = p_invoice_id AND tenant_id = v_tenant_id;

    v_draft_like := (
        v_invoice.payables_posted_at IS NULL
        AND NOT EXISTS (
            SELECT 1
            FROM public.purchase_invoice_advance_applications piaa
            WHERE piaa.purchase_invoice_id = p_invoice_id
              AND piaa.tenant_id = v_tenant_id
        )
    );

    IF v_draft_like THEN
        DELETE FROM public.purchase_invoice_items
        WHERE purchase_invoice_id = p_invoice_id AND tenant_id = v_tenant_id;

        DELETE FROM public.purchase_invoices
        WHERE id = p_invoice_id AND tenant_id = v_tenant_id;

        v_action := 'deleted';
        v_steps := private.append_posting_step(v_steps, 'bill_voided', 'success', 'Draft bill removed');
    ELSE
        UPDATE public.purchase_invoices
        SET document_status = 'CANCELLED',
            updated_at = NOW()
        WHERE id = p_invoice_id AND tenant_id = v_tenant_id;

        v_action := 'cancelled';
        v_steps := private.append_posting_step(v_steps, 'bill_voided', 'success', 'Bill cancelled');
    END IF;

    IF v_action = 'cancelled' THEN
        INSERT INTO public.document_posting_runs (
            tenant_id, document_type, document_id, overall_status, steps, posted_by
        )
        VALUES (
            v_tenant_id,
            'BILL'::public.document_posting_document_type,
            p_invoice_id,
            'success',
            v_steps,
            v_invoice.created_by
        );
    END IF;

    RETURN jsonb_build_object(
        'invoice_id', p_invoice_id,
        'action', v_action,
        'steps', v_steps
    );
END;
$$;

REVOKE ALL ON FUNCTION public.void_purchase_invoice(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.void_purchase_invoice(UUID) TO authenticated;

-- --------------------------------------------------------------------
-- 8. post_vendor_payment
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.post_vendor_payment(
    p_invoice_id UUID,
    p_payment_reference TEXT,
    p_amount NUMERIC(15, 4),
    p_payment_date DATE DEFAULT CURRENT_DATE,
    p_posted_by UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_tenant_id UUID;
    v_invoice public.purchase_invoices%ROWTYPE;
    v_applied NUMERIC(15, 4) := 0;
    v_remaining NUMERIC(15, 4);
    v_steps JSONB := '[]'::jsonb;
BEGIN
    v_tenant_id := private.current_tenant_id();
    IF v_tenant_id IS NULL THEN RAISE EXCEPTION 'tenant context missing from session'; END IF;
    IF p_invoice_id IS NULL THEN RAISE EXCEPTION 'invoice id is required'; END IF;
    IF NULLIF(btrim(p_payment_reference), '') IS NULL THEN
        RAISE EXCEPTION 'payment reference is required';
    END IF;
    IF p_amount IS NULL OR p_amount <= 0 THEN
        RAISE EXCEPTION 'payment amount must be positive';
    END IF;

    SELECT * INTO v_invoice
    FROM public.purchase_invoices
    WHERE id = p_invoice_id AND tenant_id = v_tenant_id
    FOR UPDATE;

    IF NOT FOUND THEN RAISE EXCEPTION 'purchase invoice not found'; END IF;

    IF COALESCE(v_invoice.document_status, 'ACTIVE') = 'CANCELLED' THEN
        RAISE EXCEPTION 'cancelled purchase invoices cannot be paid';
    END IF;

    IF v_invoice.is_paid THEN
        RAISE EXCEPTION 'purchase invoice is already paid';
    END IF;

    IF v_invoice.match_status = 'PPV_HOLD'::public.purchase_invoice_match_status THEN
        RAISE EXCEPTION 'purchase invoices on PPV hold cannot be paid';
    END IF;

    SELECT COALESCE(SUM(piaa.amount_applied), 0)
    INTO v_applied
    FROM public.purchase_invoice_advance_applications piaa
    WHERE piaa.purchase_invoice_id = p_invoice_id
      AND piaa.tenant_id = v_tenant_id;

    v_remaining := GREATEST(v_invoice.total_liability_amount - v_applied, 0);

    IF p_amount + 0.0001 < v_remaining THEN
        RAISE EXCEPTION 'payment amount % is less than remaining due %', p_amount, v_remaining;
    END IF;

    UPDATE public.purchase_invoices
    SET is_paid = TRUE,
        updated_at = NOW()
    WHERE id = p_invoice_id
      AND tenant_id = v_tenant_id;

    v_steps := private.append_posting_step(
        v_steps,
        'vendor_payment_posted',
        'success',
        btrim(p_payment_reference)
    );

    INSERT INTO public.document_posting_runs (
        tenant_id, document_type, document_id, overall_status, steps, posted_by
    )
    VALUES (
        v_tenant_id,
        'BILL'::public.document_posting_document_type,
        p_invoice_id,
        'success',
        v_steps,
        COALESCE(p_posted_by, v_invoice.created_by)
    );

    RETURN jsonb_build_object(
        'invoice_id', p_invoice_id,
        'is_paid', TRUE,
        'payment_reference', btrim(p_payment_reference),
        'amount', private.money_round(p_amount),
        'payment_date', COALESCE(p_payment_date, CURRENT_DATE),
        'steps', v_steps
    );
END;
$$;

REVOKE ALL ON FUNCTION public.post_vendor_payment(UUID, TEXT, NUMERIC, DATE, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.post_vendor_payment(UUID, TEXT, NUMERIC, DATE, UUID) TO authenticated;

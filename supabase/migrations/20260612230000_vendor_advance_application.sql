-- Vendor advance payments: record prepayments and apply to purchase invoices

CREATE OR REPLACE FUNCTION public.save_vendor_advance_payment(
    p_advance_id UUID,
    p_supplier_id UUID,
    p_payment_reference TEXT,
    p_amount NUMERIC,
    p_currency_code VARCHAR(3) DEFAULT 'USD',
    p_payment_date DATE DEFAULT CURRENT_DATE,
    p_notes TEXT DEFAULT NULL,
    p_created_by UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_tenant_id UUID;
    v_amount NUMERIC(15, 4);
    v_id UUID;
BEGIN
    v_tenant_id := private.current_tenant_id();
    IF v_tenant_id IS NULL THEN RAISE EXCEPTION 'tenant context missing from session'; END IF;
    IF p_supplier_id IS NULL THEN RAISE EXCEPTION 'supplier is required'; END IF;
    IF p_payment_reference IS NULL OR btrim(p_payment_reference) = '' THEN
        RAISE EXCEPTION 'payment reference is required';
    END IF;

    v_amount := private.money_round(COALESCE(p_amount, 0));
    IF v_amount <= 0 THEN RAISE EXCEPTION 'advance amount must be positive'; END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.entities
        WHERE id = p_supplier_id AND tenant_id = v_tenant_id AND is_active = TRUE
    ) THEN
        RAISE EXCEPTION 'supplier not found';
    END IF;

    IF p_advance_id IS NULL THEN
        INSERT INTO public.vendor_advance_payments (
            tenant_id,
            supplier_id,
            payment_reference,
            amount,
            unapplied_balance,
            currency_code,
            payment_date,
            notes,
            created_by
        )
        VALUES (
            v_tenant_id,
            p_supplier_id,
            btrim(p_payment_reference),
            v_amount,
            v_amount,
            COALESCE(NULLIF(btrim(p_currency_code), ''), 'USD'),
            COALESCE(p_payment_date, CURRENT_DATE),
            NULLIF(btrim(p_notes), ''),
            p_created_by
        )
        RETURNING id INTO v_id;
    ELSE
        UPDATE public.vendor_advance_payments vap
        SET payment_reference = btrim(p_payment_reference),
            currency_code = COALESCE(NULLIF(btrim(p_currency_code), ''), 'USD'),
            payment_date = COALESCE(p_payment_date, CURRENT_DATE),
            notes = NULLIF(btrim(p_notes), ''),
            updated_at = NOW()
        WHERE vap.id = p_advance_id
          AND vap.tenant_id = v_tenant_id
          AND vap.unapplied_balance = vap.amount;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'advance not found or already partially applied';
        END IF;

        UPDATE public.vendor_advance_payments
        SET amount = v_amount,
            unapplied_balance = v_amount,
            updated_at = NOW()
        WHERE id = p_advance_id AND tenant_id = v_tenant_id;

        v_id := p_advance_id;
    END IF;

    RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.save_vendor_advance_payment(UUID, UUID, TEXT, NUMERIC, VARCHAR, DATE, TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_vendor_advance_payment(UUID, UUID, TEXT, NUMERIC, VARCHAR, DATE, TEXT, UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.apply_vendor_advance_to_invoice(
    p_invoice_id UUID,
    p_advance_payment_id UUID,
    p_amount NUMERIC,
    p_applied_by UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_tenant_id UUID;
    v_invoice public.purchase_invoices%ROWTYPE;
    v_advance public.vendor_advance_payments%ROWTYPE;
    v_amount NUMERIC(15, 4);
    v_steps JSONB := '[]'::jsonb;
BEGIN
    v_tenant_id := private.current_tenant_id();
    IF v_tenant_id IS NULL THEN RAISE EXCEPTION 'tenant context missing from session'; END IF;
    IF p_invoice_id IS NULL OR p_advance_payment_id IS NULL THEN
        RAISE EXCEPTION 'invoice and advance payment are required';
    END IF;

    v_amount := private.money_round(COALESCE(p_amount, 0));
    IF v_amount <= 0 THEN RAISE EXCEPTION 'application amount must be positive'; END IF;

    SELECT * INTO v_invoice
    FROM public.purchase_invoices
    WHERE id = p_invoice_id AND tenant_id = v_tenant_id
    FOR UPDATE;

    IF NOT FOUND THEN RAISE EXCEPTION 'purchase invoice not found'; END IF;

    SELECT * INTO v_advance
    FROM public.vendor_advance_payments
    WHERE id = p_advance_payment_id AND tenant_id = v_tenant_id
    FOR UPDATE;

    IF NOT FOUND THEN RAISE EXCEPTION 'vendor advance not found'; END IF;

    IF v_advance.supplier_id <> v_invoice.supplier_id THEN
        RAISE EXCEPTION 'advance supplier must match invoice supplier';
    END IF;

    IF v_advance.unapplied_balance < v_amount THEN
        RAISE EXCEPTION 'application exceeds unapplied advance balance';
    END IF;

    IF v_amount > v_invoice.total_liability_amount THEN
        RAISE EXCEPTION 'application exceeds invoice liability';
    END IF;

    INSERT INTO public.purchase_invoice_advance_applications (
        tenant_id,
        purchase_invoice_id,
        vendor_advance_payment_id,
        amount_applied,
        applied_by
    )
    VALUES (
        v_tenant_id,
        p_invoice_id,
        p_advance_payment_id,
        v_amount,
        p_applied_by
    );

    UPDATE public.vendor_advance_payments
    SET unapplied_balance = unapplied_balance - v_amount,
        updated_at = NOW()
    WHERE id = p_advance_payment_id;

    v_steps := private.append_posting_step(
        v_steps,
        'bill_advance_applied',
        'success',
        v_amount::TEXT
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
        p_applied_by
    );

    RETURN jsonb_build_object(
        'invoice_id', p_invoice_id,
        'advance_payment_id', p_advance_payment_id,
        'amount_applied', v_amount,
        'steps', v_steps
    );
END;
$$;

REVOKE ALL ON FUNCTION public.apply_vendor_advance_to_invoice(UUID, UUID, NUMERIC, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_vendor_advance_to_invoice(UUID, UUID, NUMERIC, UUID) TO authenticated;

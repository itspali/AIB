-- ====================================================================
-- E-invoice / IRN readiness
-- Migration: 20260618180000_gst_einvoice_readiness.sql
-- ====================================================================

ALTER TABLE public.tenants
    ADD COLUMN IF NOT EXISTS einvoice_enabled BOOLEAN NOT NULL DEFAULT FALSE;

CREATE OR REPLACE FUNCTION public.validate_sales_invoice_einvoice(p_sales_invoice_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_tenant_id UUID;
    v_invoice public.sales_invoices%ROWTYPE;
    v_errors JSONB := '[]'::jsonb;
    v_line_count INTEGER;
    v_missing_hsn INTEGER;
BEGIN
    v_tenant_id := private.current_tenant_id();
    IF v_tenant_id IS NULL THEN RAISE EXCEPTION 'tenant context missing from session'; END IF;

    SELECT * INTO v_invoice FROM public.sales_invoices
    WHERE id = p_sales_invoice_id AND tenant_id = v_tenant_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'sales invoice not found'; END IF;

    IF v_invoice.customer_tax_treatment = 'OVERSEAS_EXPORT'::public.tax_treatment_type
       AND (v_invoice.shipping_bill_number IS NULL OR btrim(v_invoice.shipping_bill_number) = '') THEN
        v_errors := v_errors || jsonb_build_array('shipping_bill_number required for export invoices');
    END IF;

    SELECT COUNT(*), COUNT(*) FILTER (WHERE i.hsn_sac_code IS NULL OR btrim(i.hsn_sac_code) = '')
    INTO v_line_count, v_missing_hsn
    FROM public.sales_invoice_items sii
    INNER JOIN public.items i ON i.id = sii.item_id AND i.tenant_id = sii.tenant_id
    WHERE sii.sales_invoice_id = p_sales_invoice_id AND sii.tenant_id = v_tenant_id;

    IF v_line_count = 0 THEN
        v_errors := v_errors || jsonb_build_array('invoice must have at least one line');
    ELSIF v_missing_hsn > 0 THEN
        v_errors := v_errors || jsonb_build_array('all lines require HSN/SAC on item master');
    END IF;

    RETURN jsonb_build_object('valid', jsonb_array_length(v_errors) = 0, 'errors', v_errors);
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_einvoice_irn(p_sales_invoice_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_tenant_id UUID;
    v_enabled BOOLEAN;
    v_validation JSONB;
BEGIN
    v_tenant_id := private.current_tenant_id();
    IF v_tenant_id IS NULL THEN RAISE EXCEPTION 'tenant context missing from session'; END IF;

    SELECT einvoice_enabled INTO v_enabled FROM public.tenants WHERE id = v_tenant_id;
    IF NOT COALESCE(v_enabled, FALSE) THEN
        RETURN jsonb_build_object('status', 'DISABLED', 'message', 'E-invoice is not enabled for this tenant');
    END IF;

    v_validation := public.validate_sales_invoice_einvoice(p_sales_invoice_id);
    IF NOT (v_validation ->> 'valid')::boolean THEN
        UPDATE public.sales_invoices SET
            einvoice_status = 'VALIDATION_FAILED',
            einvoice_error = v_validation ->> 'errors',
            updated_at = NOW()
        WHERE id = p_sales_invoice_id AND tenant_id = v_tenant_id;
        RETURN jsonb_build_object('status', 'VALIDATION_FAILED', 'errors', v_validation -> 'errors');
    END IF;

    UPDATE public.sales_invoices SET
        einvoice_status = 'NOT_IMPLEMENTED',
        einvoice_error = 'NIC IRP API integration pending',
        updated_at = NOW()
    WHERE id = p_sales_invoice_id AND tenant_id = v_tenant_id;

    RETURN jsonb_build_object(
        'status', 'NOT_IMPLEMENTED',
        'message', 'IRN generation API is not connected yet; invoice data validated successfully'
    );
END;
$$;

REVOKE ALL ON FUNCTION public.validate_sales_invoice_einvoice(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validate_sales_invoice_einvoice(UUID) TO authenticated;
REVOKE ALL ON FUNCTION public.generate_einvoice_irn(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.generate_einvoice_irn(UUID) TO authenticated;

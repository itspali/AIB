-- ====================================================================
-- Sales GST context from entity tax_treatment
-- Migration: 20260618160000_gst_sales_context.sql
-- ====================================================================

CREATE OR REPLACE FUNCTION public.sales_invoices_apply_gst_context()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_tenant_country TEXT;
    v_customer RECORD;
    v_origin_state TEXT;
    v_gst_ctx RECORD;
BEGIN
    SELECT upper(btrim(COALESCE(country_code, 'IN')))
    INTO v_tenant_country
    FROM public.tenants
    WHERE id = NEW.tenant_id;

    SELECT tax_treatment, billing_country_code, billing_state
    INTO v_customer
    FROM public.entities
    WHERE id = NEW.customer_id;

    SELECT state INTO v_origin_state
    FROM public.tenant_locations
    WHERE id = NEW.origin_location_id;

    SELECT * INTO v_gst_ctx FROM private.gst_resolve_supply_context(
        v_tenant_country,
        COALESCE(v_customer.tax_treatment, 'REGULAR_B2B'::public.tax_treatment_type),
        v_customer.billing_country_code,
        v_customer.billing_state,
        COALESCE(NEW.shipping_state, v_origin_state),
        'SALE',
        'GOODS'
    ) LIMIT 1;

    NEW.customer_tax_treatment := v_customer.tax_treatment;
    NEW.tax_mechanism := v_gst_ctx.tax_mechanism;
    NEW.place_of_supply := COALESCE(NEW.shipping_state, v_origin_state);

    IF v_gst_ctx.tax_mechanism = 'ZERO_RATED'::public.gst_tax_mechanism THEN
        NEW.tax_treatment_applied := 'ZERO_RATED';
        NEW.total_tax_amount := 0;
    ELSIF v_gst_ctx.tax_mechanism = 'COMPOSITION'::public.gst_tax_mechanism THEN
        NEW.tax_treatment_applied := 'COMPOSITION';
    ELSE
        NEW.tax_treatment_applied := v_gst_ctx.tax_treatment_applied;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sales_invoices_apply_tax_nexus ON public.sales_invoices;
DROP TRIGGER IF EXISTS sales_invoices_apply_gst_context ON public.sales_invoices;
CREATE TRIGGER sales_invoices_apply_gst_context
    BEFORE INSERT ON public.sales_invoices
    FOR EACH ROW
    EXECUTE FUNCTION public.sales_invoices_apply_gst_context();

CREATE OR REPLACE FUNCTION public.sales_invoices_post_gl_tax_split()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_header_id UUID;
    v_voucher TEXT;
    v_half_tax NUMERIC(15, 4);
BEGIN
    IF NEW.total_tax_amount <= 0 OR NEW.tax_treatment_applied = 'ZERO_RATED' THEN
        RETURN NEW;
    END IF;

    v_voucher := 'GL-TAX-' || NEW.invoice_number;
    v_header_id := private.create_gl_voucher(
        NEW.tenant_id, v_voucher, NOW(), 'SALES_INVOICE', NEW.id,
        'Output tax liability for invoice ' || NEW.invoice_number
    );

    PERFORM private.post_gl_line(NEW.tenant_id, v_header_id, '1390-OUTPUT-TAX-RECEIVABLE', NEW.total_tax_amount, 0.0000);

    IF NEW.tax_treatment_applied = 'CGST_SGST' THEN
        v_half_tax := NEW.total_tax_amount / 2.0000;
        PERFORM private.post_gl_line(NEW.tenant_id, v_header_id, '2111-CGST-LIABILITY', 0.0000, v_half_tax);
        PERFORM private.post_gl_line(NEW.tenant_id, v_header_id, '2112-SGST-LIABILITY', 0.0000, NEW.total_tax_amount - v_half_tax);
    ELSIF NEW.tax_treatment_applied = 'COMPOSITION' THEN
        PERFORM private.post_gl_line(NEW.tenant_id, v_header_id, '2110-IGST-LIABILITY', 0.0000, NEW.total_tax_amount);
    ELSE
        PERFORM private.post_gl_line(NEW.tenant_id, v_header_id, '2110-IGST-LIABILITY', 0.0000, NEW.total_tax_amount);
    END IF;

    RETURN NEW;
END;
$$;

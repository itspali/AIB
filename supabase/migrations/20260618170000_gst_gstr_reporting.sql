-- ====================================================================
-- GSTR reporting views (read-only hooks)
-- Migration: 20260618170000_gst_gstr_reporting.sql
-- ====================================================================

CREATE OR REPLACE VIEW public.gstr1_outward_supplies AS
SELECT
    si.tenant_id,
    si.id AS document_id,
    si.invoice_number,
    si.document_type,
    si.created_at AS invoice_date,
    si.customer_id,
    e.tax_registration_number AS customer_gstin,
    e.tax_treatment AS customer_tax_treatment,
    si.place_of_supply,
    si.tax_treatment_applied,
    si.tax_mechanism,
    si.total_gross_amount,
    si.total_tax_amount,
    si.total_net_amount,
    si.shipping_bill_number,
    si.port_code
FROM public.sales_invoices si
INNER JOIN public.entities e ON e.id = si.customer_id AND e.tenant_id = si.tenant_id;

CREATE OR REPLACE VIEW public.gstr2_inward_supplies AS
SELECT
    pi.tenant_id,
    pi.id AS document_id,
    pi.invoice_number_vendor,
    pi.system_voucher_number,
    pi.document_type,
    pi.created_at AS invoice_date,
    pi.supplier_id,
    e.tax_registration_number AS supplier_gstin,
    pi.supplier_tax_treatment,
    pi.tax_supply_nature,
    pi.tax_mechanism,
    pi.rcm_applicable,
    pi.place_of_supply,
    pi.bill_of_entry_number,
    pi.bill_of_entry_date,
    pi.port_code,
    pi.total_gross_amount,
    pi.total_tax_amount,
    pi.total_liability_amount
FROM public.purchase_invoices pi
INNER JOIN public.entities e ON e.id = pi.supplier_id AND e.tenant_id = pi.tenant_id;

CREATE OR REPLACE VIEW public.gstr3b_summary AS
SELECT
    tenant_id,
    date_trunc('month', invoice_date)::date AS tax_period_month,
    SUM(CASE WHEN source = 'OUTWARD' THEN total_tax_amount ELSE 0 END) AS output_tax,
    SUM(CASE WHEN source = 'INWARD' AND tax_mechanism <> 'REVERSE_CHARGE' THEN total_tax_amount ELSE 0 END) AS input_tax_itc,
    SUM(CASE WHEN source = 'INWARD' AND tax_mechanism = 'REVERSE_CHARGE' THEN total_tax_amount ELSE 0 END) AS rcm_tax,
    SUM(CASE WHEN source = 'INWARD' AND tax_mechanism = 'IMPORT_IGST' THEN total_tax_amount ELSE 0 END) AS import_igst
FROM (
    SELECT tenant_id, invoice_date, total_tax_amount, tax_mechanism::text AS tax_mechanism, 'OUTWARD' AS source
    FROM public.gstr1_outward_supplies
    UNION ALL
    SELECT tenant_id, invoice_date, total_tax_amount, tax_mechanism::text, 'INWARD'
    FROM public.gstr2_inward_supplies
) combined
GROUP BY tenant_id, date_trunc('month', invoice_date);

CREATE OR REPLACE FUNCTION public.fetch_gstr_export(
    p_period_start DATE,
    p_period_end DATE,
    p_report TEXT DEFAULT 'GSTR1'
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_tenant_id UUID;
    v_result JSONB;
BEGIN
    v_tenant_id := private.current_tenant_id();
    IF v_tenant_id IS NULL THEN RAISE EXCEPTION 'tenant context missing from session'; END IF;

    IF upper(p_report) = 'GSTR2' THEN
        SELECT COALESCE(jsonb_agg(to_jsonb(g)), '[]'::jsonb) INTO v_result
        FROM public.gstr2_inward_supplies g
        WHERE g.tenant_id = v_tenant_id
          AND g.invoice_date::date >= p_period_start
          AND g.invoice_date::date <= p_period_end;
    ELSIF upper(p_report) = 'GSTR3B' THEN
        SELECT COALESCE(jsonb_agg(to_jsonb(g)), '[]'::jsonb) INTO v_result
        FROM public.gstr3b_summary g
        WHERE g.tenant_id = v_tenant_id
          AND g.tax_period_month >= date_trunc('month', p_period_start)::date
          AND g.tax_period_month <= date_trunc('month', p_period_end)::date;
    ELSE
        SELECT COALESCE(jsonb_agg(to_jsonb(g)), '[]'::jsonb) INTO v_result
        FROM public.gstr1_outward_supplies g
        WHERE g.tenant_id = v_tenant_id
          AND g.invoice_date::date >= p_period_start
          AND g.invoice_date::date <= p_period_end;
    END IF;

    RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.fetch_gstr_export(DATE, DATE, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fetch_gstr_export(DATE, DATE, TEXT) TO authenticated;

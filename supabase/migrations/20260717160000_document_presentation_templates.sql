-- ====================================================================
-- Document presentation templates (print/PDF shell)
-- Migration: 20260717160000_document_presentation_templates.sql
-- ====================================================================

-- --------------------------------------------------------------------
-- 1. System default catalog
-- --------------------------------------------------------------------
CREATE TABLE public.document_presentation_system_defaults (
    template_key    TEXT NOT NULL,
    module_key      TEXT NOT NULL,
    view_context    TEXT NOT NULL,
    label           TEXT NOT NULL,
    description     TEXT,
    shell_config    JSONB NOT NULL DEFAULT '{}'::jsonb,
    style_config    JSONB NOT NULL DEFAULT '{}'::jsonb,
    PRIMARY KEY (template_key, view_context),
    CONSTRAINT document_presentation_system_defaults_view_context_chk
        CHECK (view_context IN ('PDF_PRINT', 'EMAIL_HTML'))
);

-- --------------------------------------------------------------------
-- 2. Tenant-customizable presentation templates
-- --------------------------------------------------------------------
CREATE TABLE public.document_presentation_templates (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
    template_key    TEXT NOT NULL,
    module_key      TEXT NOT NULL,
    view_context    TEXT NOT NULL,
    location_id     UUID NULL REFERENCES public.tenant_locations (id) ON DELETE CASCADE,
    label           TEXT NOT NULL,
    description     TEXT,
    shell_config    JSONB NOT NULL DEFAULT '{}'::jsonb,
    style_config    JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_default      BOOLEAN NOT NULL DEFAULT TRUE,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    is_customized   BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT document_presentation_templates_view_context_chk
        CHECK (view_context IN ('PDF_PRINT', 'EMAIL_HTML'))
);

CREATE UNIQUE INDEX document_presentation_templates_tenant_default_unique
    ON public.document_presentation_templates (tenant_id, module_key, view_context)
    WHERE location_id IS NULL;

CREATE UNIQUE INDEX document_presentation_templates_location_override_unique
    ON public.document_presentation_templates (tenant_id, module_key, view_context, location_id)
    WHERE location_id IS NOT NULL;

CREATE INDEX document_presentation_templates_tenant_module_idx
    ON public.document_presentation_templates (tenant_id, module_key, view_context);

-- --------------------------------------------------------------------
-- 3. Seed system defaults
-- --------------------------------------------------------------------
INSERT INTO public.document_presentation_system_defaults (
    template_key, module_key, view_context, label, description, shell_config, style_config
) VALUES
(
    'procurement.po.standard', 'PURCHASE_ORDER', 'PDF_PRINT',
    'Standard purchase order',
    'Default print layout for purchase orders.',
    '{"version":1,"page":{"size":"A4","orientation":"portrait"},"margins":{"top":"12mm","bottom":"12mm","left":"10mm","right":"10mm"},"header":{"showLogo":true,"showOrgName":true,"showOrgAddress":true,"showDocumentTitle":true,"titleOverride":null},"footer":{"showPageNumbers":false,"legalText":""},"sections":{"showHeaderFields":true,"showLineTable":true,"showTotals":true,"showTerms":false,"termsText":""}}'::jsonb,
    '{"fontFamily":"system-ui, sans-serif","fontSizePx":12}'::jsonb
),
(
    'procurement.po.standard', 'PURCHASE_ORDER', 'EMAIL_HTML',
    'Standard purchase order (email)',
    'Default email attachment layout for purchase orders.',
    '{"version":1,"page":{"size":"A4","orientation":"portrait"},"margins":{"top":"12mm","bottom":"12mm","left":"10mm","right":"10mm"},"header":{"showLogo":true,"showOrgName":true,"showOrgAddress":true,"showDocumentTitle":true,"titleOverride":null},"footer":{"showPageNumbers":false,"legalText":""},"sections":{"showHeaderFields":true,"showLineTable":true,"showTotals":true,"showTerms":false,"termsText":""}}'::jsonb,
    '{"fontFamily":"system-ui, sans-serif","fontSizePx":12}'::jsonb
),
(
    'procurement.grn.standard', 'GOODS_RECEIPT_NOTE', 'PDF_PRINT',
    'Standard goods receipt',
    'Default print layout for goods receipts.',
    '{"version":1,"page":{"size":"A4","orientation":"portrait"},"margins":{"top":"12mm","bottom":"12mm","left":"10mm","right":"10mm"},"header":{"showLogo":true,"showOrgName":true,"showOrgAddress":true,"showDocumentTitle":true,"titleOverride":null},"footer":{"showPageNumbers":false,"legalText":""},"sections":{"showHeaderFields":true,"showLineTable":true,"showTotals":false,"showTerms":false,"termsText":""}}'::jsonb,
    '{"fontFamily":"system-ui, sans-serif","fontSizePx":12}'::jsonb
),
(
    'procurement.grn.standard', 'GOODS_RECEIPT_NOTE', 'EMAIL_HTML',
    'Standard goods receipt (email)',
    'Default email attachment layout for goods receipts.',
    '{"version":1,"page":{"size":"A4","orientation":"portrait"},"margins":{"top":"12mm","bottom":"12mm","left":"10mm","right":"10mm"},"header":{"showLogo":true,"showOrgName":true,"showOrgAddress":true,"showDocumentTitle":true,"titleOverride":null},"footer":{"showPageNumbers":false,"legalText":""},"sections":{"showHeaderFields":true,"showLineTable":true,"showTotals":false,"showTerms":false,"termsText":""}}'::jsonb,
    '{"fontFamily":"system-ui, sans-serif","fontSizePx":12}'::jsonb
),
(
    'procurement.bill.standard', 'PURCHASE_INVOICE', 'PDF_PRINT',
    'Standard supplier bill',
    'Default print layout for supplier bills.',
    '{"version":1,"page":{"size":"A4","orientation":"portrait"},"margins":{"top":"12mm","bottom":"12mm","left":"10mm","right":"10mm"},"header":{"showLogo":true,"showOrgName":true,"showOrgAddress":true,"showDocumentTitle":true,"titleOverride":null},"footer":{"showPageNumbers":false,"legalText":""},"sections":{"showHeaderFields":true,"showLineTable":true,"showTotals":true,"showTerms":false,"termsText":""}}'::jsonb,
    '{"fontFamily":"system-ui, sans-serif","fontSizePx":12}'::jsonb
),
(
    'procurement.bill.standard', 'PURCHASE_INVOICE', 'EMAIL_HTML',
    'Standard supplier bill (email)',
    'Default email attachment layout for supplier bills.',
    '{"version":1,"page":{"size":"A4","orientation":"portrait"},"margins":{"top":"12mm","bottom":"12mm","left":"10mm","right":"10mm"},"header":{"showLogo":true,"showOrgName":true,"showOrgAddress":true,"showDocumentTitle":true,"titleOverride":null},"footer":{"showPageNumbers":false,"legalText":""},"sections":{"showHeaderFields":true,"showLineTable":true,"showTotals":true,"showTerms":false,"termsText":""}}'::jsonb,
    '{"fontFamily":"system-ui, sans-serif","fontSizePx":12}'::jsonb
),
(
    'sales.quotation.standard', 'SALES_QUOTATION', 'PDF_PRINT',
    'Standard quotation',
    'Default print layout for sales quotations.',
    '{"version":1,"page":{"size":"A4","orientation":"portrait"},"margins":{"top":"12mm","bottom":"12mm","left":"10mm","right":"10mm"},"header":{"showLogo":true,"showOrgName":true,"showOrgAddress":true,"showDocumentTitle":true,"titleOverride":"Quotation"},"footer":{"showPageNumbers":false,"legalText":""},"sections":{"showHeaderFields":true,"showLineTable":true,"showTotals":true,"showTerms":false,"termsText":""}}'::jsonb,
    '{"fontFamily":"system-ui, sans-serif","fontSizePx":12}'::jsonb
),
(
    'sales.quotation.standard', 'SALES_QUOTATION', 'EMAIL_HTML',
    'Standard quotation (email)',
    'Default email attachment layout for sales quotations.',
    '{"version":1,"page":{"size":"A4","orientation":"portrait"},"margins":{"top":"12mm","bottom":"12mm","left":"10mm","right":"10mm"},"header":{"showLogo":true,"showOrgName":true,"showOrgAddress":true,"showDocumentTitle":true,"titleOverride":"Quotation"},"footer":{"showPageNumbers":false,"legalText":""},"sections":{"showHeaderFields":true,"showLineTable":true,"showTotals":true,"showTerms":false,"termsText":""}}'::jsonb,
    '{"fontFamily":"system-ui, sans-serif","fontSizePx":12}'::jsonb
),
(
    'sales.order.standard', 'SALES_ORDER', 'PDF_PRINT',
    'Standard sales order',
    'Default print layout for sales orders.',
    '{"version":1,"page":{"size":"A4","orientation":"portrait"},"margins":{"top":"12mm","bottom":"12mm","left":"10mm","right":"10mm"},"header":{"showLogo":true,"showOrgName":true,"showOrgAddress":true,"showDocumentTitle":true,"titleOverride":null},"footer":{"showPageNumbers":false,"legalText":""},"sections":{"showHeaderFields":true,"showLineTable":true,"showTotals":true,"showTerms":false,"termsText":""}}'::jsonb,
    '{"fontFamily":"system-ui, sans-serif","fontSizePx":12}'::jsonb
),
(
    'sales.invoice.standard', 'SALES_INVOICE', 'PDF_PRINT',
    'Standard sales invoice',
    'Default print layout for sales invoices.',
    '{"version":1,"page":{"size":"A4","orientation":"portrait"},"margins":{"top":"12mm","bottom":"12mm","left":"10mm","right":"10mm"},"header":{"showLogo":true,"showOrgName":true,"showOrgAddress":true,"showDocumentTitle":true,"titleOverride":null},"footer":{"showPageNumbers":false,"legalText":""},"sections":{"showHeaderFields":true,"showLineTable":true,"showTotals":true,"showTerms":false,"termsText":""}}'::jsonb,
    '{"fontFamily":"system-ui, sans-serif","fontSizePx":12}'::jsonb
);

-- --------------------------------------------------------------------
-- 4. RLS
-- --------------------------------------------------------------------
ALTER TABLE public.document_presentation_system_defaults ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_presentation_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY document_presentation_system_defaults_select
    ON public.document_presentation_system_defaults
    FOR SELECT
    TO authenticated
    USING (TRUE);

CREATE POLICY document_presentation_templates_tenant_isolation
    ON public.document_presentation_templates
    FOR ALL
    TO authenticated
    USING (tenant_id = private.current_tenant_id())
    WITH CHECK (tenant_id = private.current_tenant_id());

REVOKE INSERT, UPDATE, DELETE ON public.document_presentation_system_defaults
    FROM PUBLIC, anon, authenticated;

-- --------------------------------------------------------------------
-- 5. updated_at trigger
-- --------------------------------------------------------------------
CREATE TRIGGER document_presentation_templates_set_updated_at
    BEFORE UPDATE ON public.document_presentation_templates
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

-- --------------------------------------------------------------------
-- 6. RPC — seed tenant templates from system defaults
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ensure_tenant_presentation_templates()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_tenant_id UUID;
    v_inserted INTEGER;
BEGIN
    v_tenant_id := private.current_tenant_id();
    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'tenant context missing from session';
    END IF;

    INSERT INTO public.document_presentation_templates (
        tenant_id,
        template_key,
        module_key,
        view_context,
        location_id,
        label,
        description,
        shell_config,
        style_config,
        is_default,
        is_active,
        is_customized
    )
    SELECT
        v_tenant_id,
        std.template_key,
        std.module_key,
        std.view_context,
        NULL,
        std.label,
        std.description,
        std.shell_config,
        std.style_config,
        TRUE,
        TRUE,
        FALSE
    FROM public.document_presentation_system_defaults std
    ON CONFLICT (tenant_id, module_key, view_context) WHERE location_id IS NULL DO NOTHING;

    GET DIAGNOSTICS v_inserted = ROW_COUNT;
    RETURN v_inserted;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_tenant_presentation_templates() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_tenant_presentation_templates() TO authenticated;

-- GST tax invoice presentation defaults for sales invoices + email template seed

INSERT INTO public.document_presentation_system_defaults (
    template_key, module_key, view_context, label, description, shell_config, style_config
) VALUES
(
    'sales.invoice.standard', 'SALES_INVOICE', 'EMAIL_HTML',
    'Standard sales invoice (email)',
    'Default email attachment layout for sales invoices.',
    '{"version":1,"page":{"size":"A4","orientation":"portrait"},"margins":{"top":"12mm","bottom":"12mm","left":"10mm","right":"10mm"},"header":{"showLogo":true,"showOrgName":true,"showOrgAddress":true,"showDocumentTitle":true,"titleOverride":"Tax Invoice"},"footer":{"showPageNumbers":false,"legalText":""},"sections":{"showHeaderFields":true,"showLineTable":true,"showTotals":true,"showTerms":false,"termsText":""},"compliance":{"pack":"gst_tax_invoice","showPlaceOfSupply":true,"showIrnPlaceholder":true,"statutoryNote":"This is a computer-generated tax invoice. E-invoice IRN will appear when integrated."}}'::jsonb,
    '{"fontFamily":"system-ui, sans-serif","fontSizePx":12}'::jsonb
)
ON CONFLICT (template_key, view_context) DO UPDATE
SET
    label = EXCLUDED.label,
    description = EXCLUDED.description,
    shell_config = EXCLUDED.shell_config,
    style_config = EXCLUDED.style_config;

UPDATE public.document_presentation_system_defaults
SET
    shell_config = '{"version":1,"page":{"size":"A4","orientation":"portrait"},"margins":{"top":"12mm","bottom":"12mm","left":"10mm","right":"10mm"},"header":{"showLogo":true,"showOrgName":true,"showOrgAddress":true,"showDocumentTitle":true,"titleOverride":"Tax Invoice"},"footer":{"showPageNumbers":false,"legalText":""},"sections":{"showHeaderFields":true,"showLineTable":true,"showTotals":true,"showTerms":false,"termsText":""},"compliance":{"pack":"gst_tax_invoice","showPlaceOfSupply":true,"showIrnPlaceholder":true,"statutoryNote":"This is a computer-generated tax invoice. E-invoice IRN will appear when integrated."}}'::jsonb
WHERE template_key = 'sales.invoice.standard'
  AND view_context = 'PDF_PRINT';

UPDATE public.document_presentation_templates
SET shell_config = '{"version":1,"page":{"size":"A4","orientation":"portrait"},"margins":{"top":"12mm","bottom":"12mm","left":"10mm","right":"10mm"},"header":{"showLogo":true,"showOrgName":true,"showOrgAddress":true,"showDocumentTitle":true,"titleOverride":"Tax Invoice"},"footer":{"showPageNumbers":false,"legalText":""},"sections":{"showHeaderFields":true,"showLineTable":true,"showTotals":true,"showTerms":false,"termsText":""},"compliance":{"pack":"gst_tax_invoice","showPlaceOfSupply":true,"showIrnPlaceholder":true,"statutoryNote":"This is a computer-generated tax invoice. E-invoice IRN will appear when integrated."}}'::jsonb
WHERE module_key = 'SALES_INVOICE'
  AND is_customized = FALSE;

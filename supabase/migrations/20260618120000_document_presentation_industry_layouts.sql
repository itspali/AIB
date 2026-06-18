-- ====================================================================
-- Industry-focused document presentation layout defaults
-- Migration: 20260618120000_document_presentation_industry_layouts.sql
-- ====================================================================

-- Sales documents → trade & wholesale layout (Bill/Ship, amount in words)
UPDATE public.document_presentation_system_defaults
SET
    style_config = '{"fontFamily":"system-ui, -apple-system, sans-serif","fontSizePx":11,"layoutTheme":"trade"}'::jsonb,
    label = CASE
        WHEN module_key = 'SALES_ORDER' THEN 'Trade sales order'
        WHEN module_key = 'SALES_QUOTATION' THEN 'Trade quotation'
        WHEN module_key = 'SALES_INVOICE' THEN 'Trade sales invoice'
        ELSE label
    END,
    description = CASE
        WHEN module_key IN ('SALES_ORDER', 'SALES_QUOTATION', 'SALES_INVOICE')
            THEN 'Commercial trading layout with Bill/Ship blocks, order metadata, and amount in words.'
        ELSE description
    END
WHERE module_key IN ('SALES_ORDER', 'SALES_QUOTATION', 'SALES_INVOICE');

-- Procurement PO / GRN → industrial layout
UPDATE public.document_presentation_system_defaults
SET
    style_config = '{"fontFamily":"Segoe UI, system-ui, sans-serif","fontSizePx":10,"layoutTheme":"industrial"}'::jsonb,
    label = CASE
        WHEN module_key = 'PURCHASE_ORDER' THEN 'Industrial purchase order'
        WHEN module_key = 'GOODS_RECEIPT_NOTE' THEN 'Industrial goods receipt'
        ELSE label
    END,
    description = CASE
        WHEN module_key IN ('PURCHASE_ORDER', 'GOODS_RECEIPT_NOTE')
            THEN 'Manufacturing and warehouse layout with dense metadata and monospace references.'
        ELSE description
    END
WHERE module_key IN ('PURCHASE_ORDER', 'GOODS_RECEIPT_NOTE');

-- Supplier bills → classic tax invoice layout
UPDATE public.document_presentation_system_defaults
SET
    style_config = '{"fontFamily":"Georgia, Times New Roman, serif","fontSizePx":11,"layoutTheme":"classic"}'::jsonb,
    label = 'Classic supplier bill',
    description = 'Statutory invoice style with bordered party blocks and amount in words.'
WHERE module_key = 'PURCHASE_INVOICE';

-- Propagate to non-customized tenant templates
UPDATE public.document_presentation_templates AS tenant
SET
    style_config = std.style_config,
    label = std.label,
    description = std.description,
    updated_at = NOW()
FROM public.document_presentation_system_defaults AS std
WHERE tenant.template_key = std.template_key
  AND tenant.view_context = std.view_context
  AND tenant.is_customized = FALSE
  AND tenant.location_id IS NULL;

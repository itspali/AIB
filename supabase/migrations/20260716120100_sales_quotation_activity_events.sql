-- Sales quotation activity timeline: trigger + backfill (runs after enum value is committed).

CREATE OR REPLACE FUNCTION private.trg_activity_header_created()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_entity_type public.activity_entity_type;
    v_actor UUID;
BEGIN
    v_entity_type := CASE TG_TABLE_NAME
        WHEN 'purchase_orders' THEN 'PURCHASE_ORDER'::public.activity_entity_type
        WHEN 'goods_receipts' THEN 'GOODS_RECEIPT'::public.activity_entity_type
        WHEN 'purchase_invoices' THEN 'PURCHASE_INVOICE'::public.activity_entity_type
        WHEN 'stock_adjustments' THEN 'STOCK_ADJUSTMENT'::public.activity_entity_type
        WHEN 'stock_transfers' THEN 'STOCK_TRANSFER'::public.activity_entity_type
        WHEN 'goods_in_transit_vouchers' THEN 'GOODS_IN_TRANSIT'::public.activity_entity_type
        WHEN 'sales_quotations' THEN 'SALES_QUOTATION'::public.activity_entity_type
        WHEN 'sales_orders' THEN 'SALES_ORDER'::public.activity_entity_type
        WHEN 'sales_invoices' THEN 'SALES_INVOICE'::public.activity_entity_type
        ELSE NULL
    END;

    IF v_entity_type IS NULL THEN
        RETURN NEW;
    END IF;

    v_actor := NEW.created_by;

    PERFORM private.insert_activity_event(
        NEW.tenant_id,
        v_entity_type,
        NEW.id,
        'created',
        'created',
        NULL,
        '{}'::jsonb,
        v_actor,
        NEW.created_at,
        TG_TABLE_NAME || '_header',
        NEW.id
    );

    RETURN NEW;
END;
$$;

CREATE TRIGGER sales_quotations_activity_created
    AFTER INSERT ON public.sales_quotations
    FOR EACH ROW
    EXECUTE FUNCTION private.trg_activity_header_created();

INSERT INTO public.activity_events (
    tenant_id, entity_type, entity_id, event_kind, event_code, title, detail,
    actor_id, occurred_at, source_kind, source_id
)
SELECT
    sq.tenant_id,
    'SALES_QUOTATION'::public.activity_entity_type,
    sq.id,
    'created',
    'created',
    private.activity_event_title('created', 'created', '{}'::jsonb),
    '{}'::jsonb,
    sq.created_by,
    sq.created_at,
    'sales_quotations_header',
    sq.id
FROM public.sales_quotations sq
ON CONFLICT (tenant_id, source_kind, source_id)
WHERE source_kind IS NOT NULL AND source_id IS NOT NULL
DO NOTHING;

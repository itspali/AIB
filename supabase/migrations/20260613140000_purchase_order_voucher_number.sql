-- Allow draft purchase order voucher number override (unique per tenant).

CREATE OR REPLACE FUNCTION public.update_purchase_order_voucher_number(
    p_purchase_order_id UUID,
    p_voucher_number TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_tenant_id UUID;
    v_voucher_number TEXT;
    v_status public.purchase_document_status;
BEGIN
    v_tenant_id := private.current_tenant_id();
    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'tenant context missing from session';
    END IF;

    IF NOT private.can_edit_purchase_orders() THEN
        RAISE EXCEPTION 'purchase order edit permission required';
    END IF;

    IF p_purchase_order_id IS NULL THEN
        RAISE EXCEPTION 'purchase order id is required';
    END IF;

    v_voucher_number := btrim(COALESCE(p_voucher_number, ''));
    IF v_voucher_number = '' THEN
        RAISE EXCEPTION 'PO number is required';
    END IF;

    IF length(v_voucher_number) > 64 THEN
        RAISE EXCEPTION 'PO number must be 64 characters or fewer';
    END IF;

    SELECT document_status
    INTO v_status
    FROM public.purchase_orders
    WHERE id = p_purchase_order_id
      AND tenant_id = v_tenant_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'purchase order not found';
    END IF;

    IF v_status <> 'DRAFT'::public.purchase_document_status THEN
        RAISE EXCEPTION 'only draft purchase orders can change PO number';
    END IF;

    UPDATE public.purchase_orders
    SET voucher_number = v_voucher_number,
        updated_at = NOW()
    WHERE id = p_purchase_order_id
      AND tenant_id = v_tenant_id;

    RETURN p_purchase_order_id;
END;
$$;

REVOKE ALL ON FUNCTION public.update_purchase_order_voucher_number(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_purchase_order_voucher_number(UUID, TEXT) TO authenticated;

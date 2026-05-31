-- ====================================================================
-- AIB SMART ERP - TAX SETTINGS MODULE (item tax-code binding)
-- Migration: 20260546400000_set_item_tax_code_rpc.sql
-- --------------------------------------------------------------------
-- Lightweight, isolated RPC to bind (or clear) an item's tax_code_id
-- without re-deploying the large save_product_master_profile signature.
-- The item editor calls this immediately after a successful profile
-- save so the product picks up its canonical tax rule.
-- ====================================================================

CREATE OR REPLACE FUNCTION private.set_item_tax_code(
    p_item_id UUID,
    p_tax_code_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_tenant_id UUID;
BEGIN
    v_tenant_id := private.current_tenant_id();
    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'tenant context missing from session';
    END IF;

    IF p_item_id IS NULL THEN
        RAISE EXCEPTION 'item id is required';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.items
        WHERE id = p_item_id AND tenant_id = v_tenant_id
    ) THEN
        RAISE EXCEPTION 'item not found for tenant';
    END IF;

    IF p_tax_code_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM public.tax_codes
        WHERE id = p_tax_code_id AND tenant_id = v_tenant_id
    ) THEN
        RAISE EXCEPTION 'tax code not found for tenant';
    END IF;

    UPDATE public.items
    SET tax_code_id = p_tax_code_id,
        updated_at = NOW()
    WHERE id = p_item_id AND tenant_id = v_tenant_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_item_tax_code(
    p_item_id UUID,
    p_tax_code_id UUID
)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, private
AS $$
    SELECT private.set_item_tax_code(p_item_id, p_tax_code_id);
$$;

REVOKE ALL ON FUNCTION public.set_item_tax_code(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_item_tax_code(UUID, UUID) TO authenticated;

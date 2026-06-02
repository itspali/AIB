-- ====================================================================
-- AIB SMART ERP - ITEM VARIANT COMPOSITION (variant axes)
-- Migration: 20260604000000_item_variant_axes.sql
-- --------------------------------------------------------------------
-- Persists which category attribute keys an item actually varies on
-- (e.g. ["size"]) versus those that merely describe it (e.g. brand).
-- The category only *suggests* a default; this is the item's decision
-- and drives the variant matrix generator.
--
-- Mirrors set_item_tax_code: a small, isolated RPC so we don't have to
-- re-deploy the large save_product_master_profile signature. The item
-- editor calls it immediately after a successful profile save.
-- ====================================================================

ALTER TABLE public.items
    ADD COLUMN IF NOT EXISTS variant_axes JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE OR REPLACE FUNCTION private.set_item_variant_axes(
    p_item_id UUID,
    p_variant_axes JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_tenant_id UUID;
    v_axes JSONB;
BEGIN
    v_tenant_id := private.current_tenant_id();
    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'tenant context missing from session';
    END IF;

    IF p_item_id IS NULL THEN
        RAISE EXCEPTION 'item id is required';
    END IF;

    v_axes := COALESCE(p_variant_axes, '[]'::jsonb);
    IF jsonb_typeof(v_axes) IS DISTINCT FROM 'array' THEN
        RAISE EXCEPTION 'variant_axes must be a JSON array';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.items
        WHERE id = p_item_id AND tenant_id = v_tenant_id
    ) THEN
        RAISE EXCEPTION 'item not found for tenant';
    END IF;

    UPDATE public.items
    SET variant_axes = v_axes,
        updated_at = NOW()
    WHERE id = p_item_id AND tenant_id = v_tenant_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_item_variant_axes(
    p_item_id UUID,
    p_variant_axes JSONB
)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, private
AS $$
    SELECT private.set_item_variant_axes(p_item_id, p_variant_axes);
$$;

REVOKE ALL ON FUNCTION public.set_item_variant_axes(UUID, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_item_variant_axes(UUID, JSONB) TO authenticated;

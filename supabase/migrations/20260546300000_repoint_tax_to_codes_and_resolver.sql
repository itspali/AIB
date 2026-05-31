-- ====================================================================
-- AIB SMART ERP - TAX SETTINGS MODULE (Phase F: repoint + resolver)
-- Migration: 20260546300000_repoint_tax_to_codes_and_resolver.sql
-- --------------------------------------------------------------------
-- Moves the live tax engine off the legacy tax_rate_registry and onto
-- the canonical tax_codes model:
--
--   * bulk_sync_item_jurisdiction(...)  -> now binds items.tax_code_id
--     (and derives default_tax_category) from a chosen tax code instead
--     of a registry row. HSN/SAC stays a per-item attribute.
--   * resolve_line_tax(...)             -> single source of truth that
--     resolves the effective rate (flat OR slab/variable) for a sale or
--     purchase line, honouring per-unit discounts and inclusive pricing.
--
-- Additive + replacement only; no data is dropped here. The legacy
-- tax_rate_registry table itself is removed in a later, gated migration.
-- ====================================================================

-- --------------------------------------------------------------------
-- 0. Helpful index for tax-code-driven item lookups
-- --------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS items_tenant_tax_code_idx
    ON public.items (tenant_id, tax_code_id);

-- --------------------------------------------------------------------
-- 1. bulk_sync_item_jurisdiction -> tax_codes
--    (param rename requires DROP first; CREATE OR REPLACE cannot rename
--     an input parameter)
-- --------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.bulk_sync_item_jurisdiction(UUID[], UUID, UUID);

CREATE OR REPLACE FUNCTION public.bulk_sync_item_jurisdiction(
    p_item_ids UUID[],
    p_category_id UUID,
    p_tax_code_id UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_tenant_id UUID;
    v_rate NUMERIC(7, 4);
    v_kind public.tax_code_kind;
    v_is_variable BOOLEAN;
    v_min_rate NUMERIC(7, 4);
    v_tax_category TEXT;
    v_affected INTEGER;
BEGIN
    v_tenant_id := private.current_tenant_id();
    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'tenant context missing from session';
    END IF;

    IF p_item_ids IS NULL OR array_length(p_item_ids, 1) IS NULL THEN
        RETURN 0;
    END IF;

    IF p_category_id IS NULL THEN
        RAISE EXCEPTION 'category is required';
    END IF;

    IF p_tax_code_id IS NULL THEN
        RAISE EXCEPTION 'tax code is required';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.item_categories
        WHERE id = p_category_id
          AND tenant_id = v_tenant_id
          AND is_active = TRUE
    ) THEN
        RAISE EXCEPTION 'category not found for tenant';
    END IF;

    SELECT rate, kind, is_variable
    INTO v_rate, v_kind, v_is_variable
    FROM public.tax_codes
    WHERE id = p_tax_code_id
      AND tenant_id = v_tenant_id
      AND is_active = TRUE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'active tax code not found for tenant';
    END IF;

    -- For variable codes the headline rate is the lowest configured slab.
    IF v_is_variable THEN
        SELECT MIN(rate) INTO v_min_rate
        FROM public.tax_rate_rules
        WHERE tenant_id = v_tenant_id
          AND tax_code_id = p_tax_code_id;
        v_rate := COALESCE(v_min_rate, v_rate);
    END IF;

    -- Derive the coarse product tax bucket from the resolved rate/kind so
    -- legacy default_tax_category readers stay meaningful during transition.
    IF v_kind IN ('EXEMPT') THEN
        v_tax_category := 'EXEMPT';
    ELSIF v_kind IN ('ZERO', 'NIL') OR COALESCE(v_rate, 0) = 0 THEN
        v_tax_category := 'ZERO_RATED';
    ELSIF v_rate > 0 AND v_rate < 18 THEN
        v_tax_category := 'REDUCED';
    ELSE
        v_tax_category := 'STANDARD';
    END IF;

    UPDATE public.items
    SET
        category_id = p_category_id,
        tax_code_id = p_tax_code_id,
        default_tax_category = v_tax_category
    WHERE tenant_id = v_tenant_id
      AND id = ANY(p_item_ids);

    GET DIAGNOSTICS v_affected = ROW_COUNT;
    RETURN v_affected;
END;
$$;

REVOKE ALL ON FUNCTION public.bulk_sync_item_jurisdiction(UUID[], UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bulk_sync_item_jurisdiction(UUID[], UUID, UUID) TO authenticated;

-- --------------------------------------------------------------------
-- 2. resolve_line_tax — canonical line-level tax resolver
-- --------------------------------------------------------------------
-- Resolves the effective tax for a single order line:
--   * looks up the item's bound tax_code (+ inclusive flag)
--   * applies a per-unit discount to derive the taxable unit price
--   * for variable codes, selects the slab whose threshold band contains
--     the chosen basis value (UNIT_PRICE / LINE_VALUE / QTY)
--   * splits inclusive vs exclusive pricing to return base + tax
--
-- Returns a single row; rate 0 / zero tax when no tax code is bound.
-- --------------------------------------------------------------------
DROP FUNCTION IF EXISTS private.resolve_line_tax(UUID, NUMERIC, NUMERIC, NUMERIC);

CREATE OR REPLACE FUNCTION private.resolve_line_tax(
    p_item_id UUID,
    p_qty NUMERIC,
    p_unit_price NUMERIC,
    p_discount_per_unit NUMERIC DEFAULT 0
)
RETURNS TABLE (
    tax_code_id     UUID,
    rate            NUMERIC,
    is_inclusive    BOOLEAN,
    taxable_base    NUMERIC,
    tax_amount      NUMERIC,
    line_total      NUMERIC
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_tenant_id UUID;
    v_tax_code_id UUID;
    v_is_inclusive BOOLEAN := FALSE;
    v_is_variable BOOLEAN := FALSE;
    v_rate NUMERIC(7, 4) := 0;
    v_net_unit NUMERIC(15, 4);
    v_qty NUMERIC(15, 4);
    v_basis_value NUMERIC(15, 4);
    v_gross NUMERIC(15, 4);
    v_base NUMERIC(15, 4);
    v_tax NUMERIC(15, 4);
    v_rule RECORD;
BEGIN
    v_tenant_id := private.current_tenant_id();
    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'tenant context missing from session';
    END IF;

    v_qty := GREATEST(COALESCE(p_qty, 0), 0);
    v_net_unit := GREATEST(COALESCE(p_unit_price, 0) - COALESCE(p_discount_per_unit, 0), 0);

    SELECT i.tax_code_id, COALESCE(i.price_is_tax_inclusive, FALSE)
    INTO v_tax_code_id, v_is_inclusive
    FROM public.items i
    WHERE i.id = p_item_id
      AND i.tenant_id = v_tenant_id;

    IF v_tax_code_id IS NOT NULL THEN
        SELECT tc.rate, COALESCE(tc.is_variable, FALSE),
               COALESCE(tc.is_inclusive_default, v_is_inclusive)
        INTO v_rate, v_is_variable, v_is_inclusive
        FROM public.tax_codes tc
        WHERE tc.id = v_tax_code_id
          AND tc.tenant_id = v_tenant_id
          AND tc.is_active = TRUE;

        IF NOT FOUND THEN
            v_tax_code_id := NULL;
            v_rate := 0;
            v_is_variable := FALSE;
        END IF;
    END IF;

    -- Variable (slab) codes: resolve the rate from the matching tier.
    IF v_tax_code_id IS NOT NULL AND v_is_variable THEN
        v_rate := 0;
        FOR v_rule IN
            SELECT basis, threshold_min, threshold_max, rate
            FROM public.tax_rate_rules
            WHERE tenant_id = v_tenant_id
              AND tax_code_id = v_tax_code_id
            ORDER BY threshold_min ASC
        LOOP
            v_basis_value := CASE upper(v_rule.basis)
                WHEN 'LINE_VALUE' THEN v_net_unit * v_qty
                WHEN 'QTY' THEN v_qty
                ELSE v_net_unit
            END;

            IF v_basis_value >= v_rule.threshold_min
               AND (v_rule.threshold_max IS NULL OR v_basis_value < v_rule.threshold_max) THEN
                v_rate := v_rule.rate;
                EXIT;
            END IF;
        END LOOP;
    END IF;

    v_gross := ROUND(v_net_unit * v_qty, 4);

    IF COALESCE(v_rate, 0) = 0 THEN
        v_base := v_gross;
        v_tax := 0;
    ELSIF v_is_inclusive THEN
        v_base := ROUND(v_gross / (1 + (v_rate / 100)), 4);
        v_tax := v_gross - v_base;
    ELSE
        v_base := v_gross;
        v_tax := ROUND(v_gross * (v_rate / 100), 4);
    END IF;

    tax_code_id := v_tax_code_id;
    rate := v_rate;
    is_inclusive := v_is_inclusive;
    taxable_base := v_base;
    tax_amount := v_tax;
    line_total := CASE WHEN v_is_inclusive THEN v_gross ELSE v_base + v_tax END;
    RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.resolve_line_tax(
    p_item_id UUID,
    p_qty NUMERIC,
    p_unit_price NUMERIC,
    p_discount_per_unit NUMERIC DEFAULT 0
)
RETURNS TABLE (
    tax_code_id     UUID,
    rate            NUMERIC,
    is_inclusive    BOOLEAN,
    taxable_base    NUMERIC,
    tax_amount      NUMERIC,
    line_total      NUMERIC
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
    SELECT * FROM private.resolve_line_tax(p_item_id, p_qty, p_unit_price, p_discount_per_unit);
$$;

REVOKE ALL ON FUNCTION public.resolve_line_tax(UUID, NUMERIC, NUMERIC, NUMERIC) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_line_tax(UUID, NUMERIC, NUMERIC, NUMERIC) TO authenticated;

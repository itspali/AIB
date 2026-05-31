-- ====================================================================
-- AIB SMART ERP - TAX SETTINGS MODULE (Phase A: schema)
-- Migration: 20260546000000_tax_rate_rules_and_variable_flag.sql
-- --------------------------------------------------------------------
-- Establishes the slab/threshold layer for the tax engine and marks
-- which tax codes resolve their rate from tiered rules ("variable")
-- versus a single flat rate.
--
--   * tax_codes.is_variable                -> flat vs slab-driven code
--   * tax_rate_rules (tenant-scoped)        -> tiered rate rules per code
--
-- Purely additive: existing flat tax codes keep working unchanged.
-- ====================================================================

-- --------------------------------------------------------------------
-- 1. tax_codes: variable (slab-driven) flag
-- --------------------------------------------------------------------
ALTER TABLE public.tax_codes
    ADD COLUMN IF NOT EXISTS is_variable BOOLEAN NOT NULL DEFAULT FALSE;

-- --------------------------------------------------------------------
-- 2. tax_rate_rules: tiered rate resolution (e.g. apparel 5% / 12%)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tax_rate_rules (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
    tax_code_id     UUID NOT NULL,
    basis           TEXT NOT NULL DEFAULT 'UNIT_PRICE',
    threshold_min   NUMERIC(15, 4) NOT NULL DEFAULT 0,
    threshold_max   NUMERIC(15, 4),
    rate            NUMERIC(7, 4) NOT NULL DEFAULT 0,
    effective_from  DATE,
    effective_to    DATE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT tax_rate_rules_basis_chk
        CHECK (basis IN ('UNIT_PRICE', 'LINE_VALUE', 'QTY')),
    CONSTRAINT tax_rate_rules_rate_non_negative_chk
        CHECK (rate >= 0),
    CONSTRAINT tax_rate_rules_threshold_min_non_negative_chk
        CHECK (threshold_min >= 0),
    CONSTRAINT tax_rate_rules_threshold_range_chk
        CHECK (threshold_max IS NULL OR threshold_max > threshold_min)
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'tax_rate_rules_tax_code_tenant_fk'
    ) THEN
        ALTER TABLE public.tax_rate_rules
            ADD CONSTRAINT tax_rate_rules_tax_code_tenant_fk
            FOREIGN KEY (tenant_id, tax_code_id)
            REFERENCES public.tax_codes (tenant_id, id)
            ON DELETE CASCADE;
    END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS tax_rate_rules_tenant_id_id_unique
    ON public.tax_rate_rules (tenant_id, id);

CREATE INDEX IF NOT EXISTS tax_rate_rules_tenant_code_idx
    ON public.tax_rate_rules (tenant_id, tax_code_id);

-- --------------------------------------------------------------------
-- 3. updated_at trigger (house convention: public.set_updated_at)
-- --------------------------------------------------------------------
DROP TRIGGER IF EXISTS tax_rate_rules_set_updated_at ON public.tax_rate_rules;
CREATE TRIGGER tax_rate_rules_set_updated_at
    BEFORE UPDATE ON public.tax_rate_rules
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- --------------------------------------------------------------------
-- 4. RLS: tenant isolation (mirrors tax_codes policy macro)
-- --------------------------------------------------------------------
ALTER TABLE public.tax_rate_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tax_rate_rules_tenant_isolation ON public.tax_rate_rules;
CREATE POLICY tax_rate_rules_tenant_isolation ON public.tax_rate_rules
    FOR ALL TO authenticated
    USING (tenant_id = private.current_tenant_id())
    WITH CHECK (tenant_id = private.current_tenant_id());

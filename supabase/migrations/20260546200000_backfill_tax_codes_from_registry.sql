-- ====================================================================
-- AIB SMART ERP - TAX SETTINGS MODULE (Phase C: backfill)
-- Migration: 20260546200000_backfill_tax_codes_from_registry.sql
-- --------------------------------------------------------------------
-- Seeds the canonical tax_codes table from existing (legacy) active
-- tax_rate_registry rows so the new Tax Settings module does not start
-- empty for tenants who completed onboarding under the old model.
--
-- Each active registry component becomes one flat tax code. This is a
-- one-time convenience copy; the registry is NOT modified or dropped
-- here (that happens later, after consumers are repointed). Idempotent:
-- a deterministic code is derived per registry row and skipped if it
-- already exists.
-- ====================================================================

INSERT INTO public.tax_codes (
    tenant_id,
    code,
    name,
    kind,
    rate,
    is_inclusive_default,
    is_variable,
    effective_from,
    effective_to,
    is_active
)
SELECT
    r.tenant_id,
    -- Deterministic, collision-free code: slug of name + short id suffix.
    left(
        NULLIF(regexp_replace(upper(btrim(r.tax_component_name)), '[^A-Z0-9]+', '-', 'g'), ''),
        18
    ) || '-' || left(replace(r.id::text, '-', ''), 6) AS code,
    btrim(r.tax_component_name) AS name,
    CASE
        WHEN COALESCE(r.tax_percentage, 0) = 0 THEN 'ZERO'::public.tax_code_kind
        ELSE 'GST'::public.tax_code_kind
    END AS kind,
    COALESCE(r.tax_percentage, 0) AS rate,
    FALSE AS is_inclusive_default,
    FALSE AS is_variable,
    r.active_from_date::date AS effective_from,
    r.active_to_date::date AS effective_to,
    TRUE AS is_active
FROM public.tax_rate_registry r
WHERE btrim(COALESCE(r.tax_component_name, '')) <> ''
  AND (r.active_to_date IS NULL OR r.active_to_date > NOW())
  AND NOT EXISTS (
        SELECT 1
        FROM public.tax_codes tc
        WHERE tc.tenant_id = r.tenant_id
          AND tc.code = (
              left(
                  NULLIF(regexp_replace(upper(btrim(r.tax_component_name)), '[^A-Z0-9]+', '-', 'g'), ''),
                  18
              ) || '-' || left(replace(r.id::text, '-', ''), 6)
          )
  );

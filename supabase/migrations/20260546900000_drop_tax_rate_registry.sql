-- ====================================================================
-- AIB SMART ERP - TAX SETTINGS MODULE (Phase G: drop legacy registry)
-- Migration: 20260546900000_drop_tax_rate_registry.sql
-- --------------------------------------------------------------------
-- Final, gated removal of the legacy tax_rate_registry table. Every
-- live consumer (onboarding write/gating, dashboard grid, bulk
-- jurisdiction sync, item options) has been repointed to tax_codes in
-- prior migrations, and the canonical data was backfilled.
--
-- The last remaining database reference was the go-live gate inside
-- private.complete_onboarding(); it is repointed to tax_codes here
-- BEFORE the table is dropped so tenant onboarding keeps working.
--
-- IRREVERSIBLE: this drops the table and its data. Only apply once the
-- tax_codes repoint (Phase F) is confirmed working on the sandbox.
-- ====================================================================

-- --------------------------------------------------------------------
-- 1. Repoint the onboarding go-live gate to tax_codes
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.complete_onboarding()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_tenant_id UUID;
    v_location_count BIGINT;
    v_account_count BIGINT;
    v_tax_count BIGINT;
    v_channel_count BIGINT;
BEGIN
    v_tenant_id := private.current_tenant_id();
    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'tenant context missing from session';
    END IF;

    SELECT COUNT(*) INTO v_location_count
    FROM public.tenant_locations
    WHERE tenant_id = v_tenant_id;

    SELECT COUNT(*) INTO v_account_count
    FROM public.accounts
    WHERE tenant_id = v_tenant_id;

    SELECT COUNT(*) INTO v_tax_count
    FROM public.tax_codes
    WHERE tenant_id = v_tenant_id;

    SELECT COUNT(*) INTO v_channel_count
    FROM public.storefront_channels
    WHERE tenant_id = v_tenant_id;

    IF v_location_count < 1 THEN
        RAISE EXCEPTION 'complete onboarding requires at least one location';
    END IF;

    IF v_account_count < 1 THEN
        RAISE EXCEPTION 'complete onboarding requires chart of accounts deployment';
    END IF;

    IF v_tax_count < 1 THEN
        RAISE EXCEPTION 'complete onboarding requires at least one tax rate';
    END IF;

    IF v_channel_count < 1 THEN
        RAISE EXCEPTION 'complete onboarding requires at least one storefront channel';
    END IF;

    UPDATE public.tenants
    SET
        onboarding_status = 'GO_LIVE_READY',
        updated_at = NOW()
    WHERE id = v_tenant_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'tenant not found or access denied';
    END IF;
END;
$$;

-- --------------------------------------------------------------------
-- 2. Drop the legacy table (RLS policies, indexes, and the
--    set_updated_at trigger are removed automatically with it)
-- --------------------------------------------------------------------
DROP TABLE IF EXISTS public.tax_rate_registry;

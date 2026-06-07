-- ====================================================================
-- AIB SMART ERP - LOCATION DOCUMENT SEQUENCE COUNTER UPDATES
-- Migration: 20260608130000_location_document_sequence_counters.sql
-- ====================================================================
-- Allow administrators to set next_value when saving location document
-- naming. Counters are applied to document_sequences but not persisted in
-- location_meta (ephemeral next/current keys are stripped on save).
-- ====================================================================

CREATE OR REPLACE FUNCTION private.strip_sequence_counters_from_naming_meta(
    p_location_meta JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    v_meta JSONB;
    v_configuration JSONB;
    v_naming JSONB;
    v_key TEXT;
    v_entry JSONB;
    v_clean_entry JSONB;
    v_clean_naming JSONB := '{}'::jsonb;
BEGIN
    v_meta := COALESCE(p_location_meta, '{}'::jsonb);
    v_configuration := COALESCE(v_meta -> 'configuration_metadata', '{}'::jsonb);
    v_naming := COALESCE(v_configuration -> 'naming_sequences', '{}'::jsonb);

    IF jsonb_typeof(v_naming) IS DISTINCT FROM 'object' THEN
        RETURN v_meta;
    END IF;

    FOR v_key, v_entry IN SELECT * FROM jsonb_each(v_naming)
    LOOP
        IF jsonb_typeof(v_entry) = 'object' THEN
            v_clean_entry := v_entry - 'next' - 'current';
        ELSE
            v_clean_entry := v_entry;
        END IF;
        v_clean_naming := v_clean_naming || jsonb_build_object(v_key, v_clean_entry);
    END LOOP;

    RETURN jsonb_set(
        v_meta,
        '{configuration_metadata,naming_sequences}',
        v_clean_naming,
        true
    );
END;
$$;

CREATE OR REPLACE FUNCTION private.sync_document_sequences_from_naming(
    p_tenant_id UUID,
    p_naming_sequences JSONB,
    p_location_id UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_key TEXT;
    v_entry JSONB;
    v_prefix TEXT;
    v_digits INTEGER;
    v_next INTEGER;
    v_voucher_type public.document_voucher_type;
    v_active_types public.document_voucher_type[] := ARRAY[]::public.document_voucher_type[];
BEGIN
    IF p_location_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1
            FROM public.tenant_locations
            WHERE id = p_location_id
              AND tenant_id = p_tenant_id
        ) THEN
            RAISE EXCEPTION 'location not found for tenant';
        END IF;
    END IF;

    IF p_naming_sequences IS NULL OR jsonb_typeof(p_naming_sequences) IS DISTINCT FROM 'object' THEN
        IF p_location_id IS NOT NULL THEN
            DELETE FROM public.document_sequences
            WHERE tenant_id = p_tenant_id
              AND location_id = p_location_id;
        END IF;
        RETURN;
    END IF;

    FOR v_key, v_entry IN SELECT * FROM jsonb_each(p_naming_sequences)
    LOOP
        IF NOT private.is_document_voucher_type(v_key) THEN
            CONTINUE;
        END IF;

        v_voucher_type := upper(v_key)::public.document_voucher_type;
        v_prefix := NULLIF(btrim(v_entry ->> 'prefix'), '');

        IF v_prefix IS NULL THEN
            IF p_location_id IS NOT NULL THEN
                DELETE FROM public.document_sequences
                WHERE tenant_id = p_tenant_id
                  AND location_id = p_location_id
                  AND voucher_type = v_voucher_type;
            END IF;
            CONTINUE;
        END IF;

        v_active_types := array_append(v_active_types, v_voucher_type);

        v_digits := COALESCE(NULLIF(v_entry ->> 'digits', '')::INTEGER, 5);
        IF v_digits < 3 OR v_digits > 12 THEN
            v_digits := 5;
        END IF;

        v_next := COALESCE(
            NULLIF(v_entry ->> 'next', '')::INTEGER,
            NULLIF(v_entry ->> 'current', '')::INTEGER
        );

        IF v_next IS NOT NULL AND v_next < 1 THEN
            RAISE EXCEPTION 'document sequence next value for % must be at least 1', v_key;
        END IF;

        UPDATE public.document_sequences
        SET
            padding_length = v_digits,
            next_value = COALESCE(v_next, next_value),
            updated_at = NOW()
        WHERE tenant_id = p_tenant_id
          AND voucher_type = v_voucher_type
          AND prefix = v_prefix
          AND location_id IS NOT DISTINCT FROM p_location_id;

        IF NOT FOUND THEN
            INSERT INTO public.document_sequences (
                tenant_id,
                location_id,
                voucher_type,
                prefix,
                next_value,
                padding_length
            )
            VALUES (
                p_tenant_id,
                p_location_id,
                v_voucher_type,
                v_prefix,
                COALESCE(v_next, 1),
                v_digits
            );
        END IF;
    END LOOP;

    IF p_location_id IS NOT NULL AND cardinality(v_active_types) = 0 THEN
        DELETE FROM public.document_sequences
        WHERE tenant_id = p_tenant_id
          AND location_id = p_location_id;
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION private.validate_location_document_naming(
    p_location_meta JSONB,
    p_is_stock_holding BOOLEAN DEFAULT FALSE,
    p_is_commercial_storefront BOOLEAN DEFAULT FALSE,
    p_is_administrative_office BOOLEAN DEFAULT FALSE
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_naming JSONB;
    v_key TEXT;
    v_entry JSONB;
    v_prefix TEXT;
    v_digits INTEGER;
    v_next INTEGER;
BEGIN
    v_naming := COALESCE(p_location_meta, '{}'::jsonb)
        -> 'configuration_metadata'
        -> 'naming_sequences';

    IF v_naming IS NULL OR v_naming = 'null'::jsonb THEN
        RETURN;
    END IF;

    IF jsonb_typeof(v_naming) IS DISTINCT FROM 'object' THEN
        RAISE EXCEPTION 'location naming_sequences must be an object';
    END IF;

    FOR v_key, v_entry IN SELECT * FROM jsonb_each(v_naming)
    LOOP
        IF NOT private.is_document_voucher_type(v_key) THEN
            CONTINUE;
        END IF;

        IF NOT private.location_supports_document_voucher_key(
            v_key,
            p_is_stock_holding,
            p_is_commercial_storefront,
            p_is_administrative_office
        ) THEN
            RAISE EXCEPTION 'document naming type % is not applicable to this location', v_key;
        END IF;

        v_prefix := NULLIF(btrim(v_entry ->> 'prefix'), '');
        IF v_prefix IS NULL THEN
            CONTINUE;
        END IF;

        IF length(v_prefix) > 32 THEN
            RAISE EXCEPTION 'document naming prefix for % exceeds 32 characters', v_key;
        END IF;

        BEGIN
            v_digits := COALESCE(NULLIF(v_entry ->> 'digits', '')::INTEGER, 5);
        EXCEPTION
            WHEN OTHERS THEN
                RAISE EXCEPTION 'document naming digits for % must be numeric', v_key;
        END;

        IF v_digits < 3 OR v_digits > 12 THEN
            RAISE EXCEPTION 'document naming digits for % must be between 3 and 12', v_key;
        END IF;

        BEGIN
            v_next := COALESCE(
                NULLIF(v_entry ->> 'next', '')::INTEGER,
                NULLIF(v_entry ->> 'current', '')::INTEGER
            );
        EXCEPTION
            WHEN OTHERS THEN
                RAISE EXCEPTION 'document sequence next value for % must be numeric', v_key;
        END;

        IF v_next IS NOT NULL AND v_next < 1 THEN
            RAISE EXCEPTION 'document sequence next value for % must be at least 1', v_key;
        END IF;
    END LOOP;
END;
$$;

-- Persist prefix/digits in location_meta; apply ephemeral next/current only to counters.
CREATE OR REPLACE FUNCTION private.save_tenant_location_core(
    p_location_id UUID,
    p_name TEXT,
    p_code TEXT,
    p_presence_type public.presence_environment DEFAULT 'PHYSICAL'::public.presence_environment,
    p_is_administrative_office BOOLEAN DEFAULT FALSE,
    p_is_commercial_storefront BOOLEAN DEFAULT FALSE,
    p_is_manufacturing_floor BOOLEAN DEFAULT FALSE,
    p_is_stock_holding BOOLEAN DEFAULT FALSE,
    p_pos_terminal_count INT DEFAULT 0,
    p_parent_location_id UUID DEFAULT NULL,
    p_address_line1 TEXT DEFAULT NULL,
    p_address_line2 TEXT DEFAULT NULL,
    p_city TEXT DEFAULT NULL,
    p_state TEXT DEFAULT NULL,
    p_zip_postal TEXT DEFAULT NULL,
    p_country_code TEXT DEFAULT NULL,
    p_manager_name TEXT DEFAULT NULL,
    p_contact_email TEXT DEFAULT NULL,
    p_contact_phone TEXT DEFAULT NULL,
    p_location_tax_identifier TEXT DEFAULT NULL,
    p_tax_registered_name TEXT DEFAULT NULL,
    p_location_meta JSONB DEFAULT NULL,
    p_valuation_calculation_rule TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_tenant_id UUID;
    v_governance JSONB;
    v_multi_location BOOLEAN;
    v_regional_hqs BOOLEAN;
    v_central_hq UUID;
    v_trimmed_name TEXT;
    v_normalized_code TEXT;
    v_location_id UUID;
    v_existing_code TEXT;
    v_active_operational_count INTEGER;
    v_depth INTEGER;
    v_resolved_presence public.presence_environment;
    v_resolved_admin BOOLEAN;
    v_resolved_storefront BOOLEAN;
    v_resolved_manufacturing BOOLEAN;
    v_resolved_stock BOOLEAN;
    v_resolved_pos INT;
    v_existing_meta JSONB;
    v_effective_meta JSONB;
    v_naming_sequences JSONB;
    v_resolved_valuation_rule public.location_valuation_calculation_rule;
    v_existing_valuation_rule public.location_valuation_calculation_rule;
    v_normalized_valuation_rule TEXT;
    v_has_location_inventory_activity BOOLEAN;
BEGIN
    v_tenant_id := private.current_tenant_id();
    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'tenant context missing from session';
    END IF;

    IF NOT private.user_can_manage_tenant_locations() THEN
        RAISE EXCEPTION 'administrative privileges required to manage locations';
    END IF;

    v_governance := private.get_location_governance_config(v_tenant_id);
    v_multi_location := COALESCE((v_governance ->> 'multi_location_enabled')::boolean, TRUE);
    v_regional_hqs := COALESCE((v_governance ->> 'regional_hqs_enabled')::boolean, FALSE);
    v_central_hq := NULLIF(v_governance ->> 'central_hq_location_id', '')::uuid;

    v_trimmed_name := btrim(p_name);
    IF v_trimmed_name IS NULL OR v_trimmed_name = '' THEN
        RAISE EXCEPTION 'location name is required';
    END IF;

    v_normalized_code := upper(btrim(p_code));
    IF v_normalized_code IS NULL OR v_normalized_code = '' THEN
        RAISE EXCEPTION 'location code is required';
    END IF;

    IF private.is_system_tenant_location(v_normalized_code) THEN
        RAISE EXCEPTION 'system location codes are reserved';
    END IF;

    IF p_address_line1 IS NULL OR btrim(p_address_line1) = '' THEN
        RAISE EXCEPTION 'address line 1 is required';
    END IF;

    IF p_city IS NULL OR btrim(p_city) = '' THEN
        RAISE EXCEPTION 'city is required';
    END IF;

    IF p_state IS NULL OR btrim(p_state) = '' THEN
        RAISE EXCEPTION 'state is required';
    END IF;

    IF p_zip_postal IS NULL OR btrim(p_zip_postal) = '' THEN
        RAISE EXCEPTION 'postal code is required';
    END IF;

    IF p_country_code IS NULL OR btrim(p_country_code) = '' THEN
        RAISE EXCEPTION 'country code is required';
    END IF;

    v_resolved_presence := COALESCE(p_presence_type, 'PHYSICAL'::public.presence_environment);
    v_resolved_admin := COALESCE(p_is_administrative_office, FALSE);
    v_resolved_storefront := COALESCE(p_is_commercial_storefront, FALSE);
    v_resolved_manufacturing := COALESCE(p_is_manufacturing_floor, FALSE);
    v_resolved_stock := COALESCE(p_is_stock_holding, FALSE);
    v_resolved_pos := COALESCE(p_pos_terminal_count, 0);

    IF v_resolved_pos < 0 THEN
        RAISE EXCEPTION 'pos terminal count cannot be negative';
    END IF;

    IF v_resolved_presence = 'VIRTUAL'::public.presence_environment AND v_resolved_stock THEN
        RAISE EXCEPTION 'virtual locations cannot be stock-holding locations';
    END IF;

    IF v_resolved_presence = 'VIRTUAL'::public.presence_environment AND v_resolved_manufacturing THEN
        RAISE EXCEPTION 'virtual locations cannot be manufacturing floors';
    END IF;

    IF NOT v_resolved_storefront AND v_resolved_pos <> 0 THEN
        RAISE EXCEPTION 'pos terminal count must be zero when location is not a commercial storefront';
    END IF;

    IF private.location_is_valuation_eligible(v_resolved_stock, v_resolved_storefront) THEN
        IF p_valuation_calculation_rule IS NOT NULL AND btrim(p_valuation_calculation_rule) <> '' THEN
            v_normalized_valuation_rule := upper(btrim(p_valuation_calculation_rule));
            IF v_normalized_valuation_rule NOT IN ('FIFO', 'MWAC') THEN
                RAISE EXCEPTION 'valuation calculation rule must be FIFO or MWAC';
            END IF;
            v_resolved_valuation_rule := v_normalized_valuation_rule::public.location_valuation_calculation_rule;
        ELSE
            v_resolved_valuation_rule := NULL;
        END IF;
    ELSE
        v_resolved_valuation_rule := NULL;
    END IF;

    IF p_location_id IS NOT NULL THEN
        SELECT code, location_meta, valuation_calculation_rule
        INTO v_existing_code, v_existing_meta, v_existing_valuation_rule
        FROM public.tenant_locations
        WHERE id = p_location_id
          AND tenant_id = v_tenant_id;

        IF v_existing_code IS NULL THEN
            RAISE EXCEPTION 'location not found for tenant';
        END IF;

        IF private.is_system_tenant_location(v_existing_code) THEN
            RAISE EXCEPTION 'system locations cannot be modified';
        END IF;

        IF v_existing_valuation_rule IS DISTINCT FROM v_resolved_valuation_rule THEN
            SELECT EXISTS (
                SELECT 1
                FROM public.inventory_ledger il
                WHERE il.tenant_id = v_tenant_id
                  AND il.location_id = p_location_id
                LIMIT 1
            )
            OR EXISTS (
                SELECT 1
                FROM public.item_valuations iv
                WHERE iv.tenant_id = v_tenant_id
                  AND iv.location_id = p_location_id
                LIMIT 1
            )
            INTO v_has_location_inventory_activity;

            IF v_has_location_inventory_activity THEN
                RAISE EXCEPTION 'valuation calculation rule cannot be changed after inventory activity exists at this location';
            END IF;
        END IF;
    ELSE
        v_existing_meta := NULL;
        v_existing_valuation_rule := NULL;

        IF NOT v_multi_location THEN
            SELECT COUNT(*)
            INTO v_active_operational_count
            FROM public.tenant_locations
            WHERE tenant_id = v_tenant_id
              AND is_active = TRUE
              AND NOT private.is_system_tenant_location(code);

            IF v_active_operational_count > 0 THEN
                RAISE EXCEPTION 'multi-location is disabled; only one operational location is permitted';
            END IF;
        END IF;
    END IF;

    IF NOT v_regional_hqs THEN
        IF p_parent_location_id IS NOT NULL THEN
            RAISE EXCEPTION 'regional hierarchy is disabled; parent location must be empty';
        END IF;
    ELSE
        IF p_parent_location_id IS NOT NULL THEN
            IF NOT EXISTS (
                SELECT 1
                FROM public.tenant_locations
                WHERE id = p_parent_location_id
                  AND tenant_id = v_tenant_id
                  AND is_active = TRUE
                  AND NOT private.is_system_tenant_location(code)
            ) THEN
                RAISE EXCEPTION 'parent location not found for tenant';
            END IF;

            WITH RECURSIVE ancestors AS (
                SELECT id, parent_location_id, 1 AS depth
                FROM public.tenant_locations
                WHERE id = p_parent_location_id
                  AND tenant_id = v_tenant_id
                UNION ALL
                SELECT tl.id, tl.parent_location_id, ancestors.depth + 1
                FROM public.tenant_locations tl
                INNER JOIN ancestors ON tl.id = ancestors.parent_location_id
                WHERE tl.tenant_id = v_tenant_id
                  AND ancestors.depth < 6
            )
            SELECT MAX(depth)
            INTO v_depth
            FROM ancestors;

            IF COALESCE(v_depth, 0) >= 5 THEN
                RAISE EXCEPTION 'location hierarchy cannot exceed five tiers';
            END IF;
        END IF;
    END IF;

    v_effective_meta := COALESCE(p_location_meta, COALESCE(v_existing_meta, '{}'::jsonb));

    PERFORM private.validate_virtual_location_configuration(
        v_resolved_presence,
        v_effective_meta
    );

    PERFORM private.validate_location_document_naming(
        v_effective_meta,
        v_resolved_stock,
        v_resolved_storefront,
        v_resolved_admin
    );

    v_naming_sequences := v_effective_meta -> 'configuration_metadata' -> 'naming_sequences';
    v_effective_meta := private.strip_sequence_counters_from_naming_meta(v_effective_meta);

    IF p_location_id IS NULL THEN
        INSERT INTO public.tenant_locations (
            tenant_id,
            parent_location_id,
            name,
            code,
            presence_type,
            is_administrative_office,
            is_commercial_storefront,
            is_manufacturing_floor,
            is_stock_holding,
            pos_terminal_count,
            address_line1,
            address_line2,
            city,
            state,
            zip_postal,
            country_code,
            manager_name,
            contact_email,
            contact_phone,
            location_tax_identifier,
            tax_registered_name,
            location_meta,
            valuation_calculation_rule,
            is_active
        )
        VALUES (
            v_tenant_id,
            CASE WHEN v_regional_hqs THEN p_parent_location_id ELSE NULL END,
            v_trimmed_name,
            v_normalized_code,
            v_resolved_presence,
            v_resolved_admin,
            v_resolved_storefront,
            v_resolved_manufacturing,
            v_resolved_stock,
            v_resolved_pos,
            btrim(p_address_line1),
            NULLIF(btrim(p_address_line2), ''),
            btrim(p_city),
            btrim(p_state),
            btrim(p_zip_postal),
            upper(btrim(p_country_code)),
            NULLIF(btrim(p_manager_name), ''),
            NULLIF(btrim(p_contact_email), ''),
            NULLIF(btrim(p_contact_phone), ''),
            NULLIF(btrim(p_location_tax_identifier), ''),
            NULLIF(btrim(p_tax_registered_name), ''),
            v_effective_meta,
            v_resolved_valuation_rule,
            TRUE
        )
        RETURNING id INTO v_location_id;
    ELSE
        UPDATE public.tenant_locations
        SET
            parent_location_id = CASE WHEN v_regional_hqs THEN p_parent_location_id ELSE NULL END,
            name = v_trimmed_name,
            code = v_normalized_code,
            presence_type = v_resolved_presence,
            is_administrative_office = v_resolved_admin,
            is_commercial_storefront = v_resolved_storefront,
            is_manufacturing_floor = v_resolved_manufacturing,
            is_stock_holding = v_resolved_stock,
            pos_terminal_count = v_resolved_pos,
            address_line1 = btrim(p_address_line1),
            address_line2 = NULLIF(btrim(p_address_line2), ''),
            city = btrim(p_city),
            state = btrim(p_state),
            zip_postal = btrim(p_zip_postal),
            country_code = upper(btrim(p_country_code)),
            manager_name = NULLIF(btrim(p_manager_name), ''),
            contact_email = NULLIF(btrim(p_contact_email), ''),
            contact_phone = NULLIF(btrim(p_contact_phone), ''),
            location_tax_identifier = NULLIF(btrim(p_location_tax_identifier), ''),
            tax_registered_name = NULLIF(btrim(p_tax_registered_name), ''),
            location_meta = v_effective_meta,
            valuation_calculation_rule = v_resolved_valuation_rule,
            updated_at = NOW()
        WHERE id = p_location_id
          AND tenant_id = v_tenant_id
        RETURNING id INTO v_location_id;
    END IF;

    PERFORM private.sync_document_sequences_from_naming(
        v_tenant_id,
        COALESCE(v_naming_sequences, '{}'::jsonb),
        v_location_id
    );

    IF v_central_hq = v_location_id AND NOT v_resolved_admin THEN
        RAISE EXCEPTION 'central HQ location must remain an administrative office';
    END IF;

    RETURN v_location_id;
END;
$$;

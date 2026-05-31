-- ====================================================================
-- AIB SMART ERP - LOCATION-ONLY DOCUMENT NUMBERING
-- Migration: 20260601000000_location_only_document_numbering.sql
-- ====================================================================
-- Moves document voucher numbering from tenant scope to location scope.
-- Copies existing tenant document sequences to eligible locations, then
-- removes tenant document keys and tenant-scoped counters.
-- ====================================================================

CREATE OR REPLACE FUNCTION private.location_supports_document_voucher_key(
    p_key TEXT,
    p_is_stock_holding BOOLEAN,
    p_is_commercial_storefront BOOLEAN,
    p_is_administrative_office BOOLEAN
)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
    IF NOT private.is_document_voucher_type(p_key) THEN
        RETURN FALSE;
    END IF;

    CASE upper(p_key)
        WHEN 'PURCHASE_ORDER', 'GOODS_RECEIPT_NOTE', 'PURCHASE_INVOICE', 'STOCK_TRANSFER' THEN
            RETURN COALESCE(p_is_stock_holding, FALSE);
        WHEN 'SALES_QUOTATION', 'SALES_ORDER', 'SALES_INVOICE', 'CUSTOMER_PAYMENT', 'SALES_CREDIT_NOTE' THEN
            RETURN COALESCE(p_is_commercial_storefront, FALSE);
        WHEN 'GENERAL_LEDGER' THEN
            RETURN COALESCE(p_is_administrative_office, FALSE);
        ELSE
            RETURN FALSE;
    END CASE;
END;
$$;

CREATE OR REPLACE FUNCTION private.strip_document_voucher_keys_from_naming(p_naming JSONB)
RETURNS JSONB
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    v_result JSONB := '{}'::jsonb;
    v_key TEXT;
    v_entry JSONB;
BEGIN
    IF p_naming IS NULL OR jsonb_typeof(p_naming) IS DISTINCT FROM 'object' THEN
        RETURN '{}'::jsonb;
    END IF;

    FOR v_key, v_entry IN SELECT * FROM jsonb_each(p_naming)
    LOOP
        IF private.is_document_voucher_type(v_key) THEN
            CONTINUE;
        END IF;
        v_result := v_result || jsonb_build_object(v_key, v_entry);
    END LOOP;

    RETURN v_result;
END;
$$;

DO $$
DECLARE
    v_tenant RECORD;
    v_location RECORD;
    v_tenant_sequences JSONB;
    v_location_meta JSONB;
    v_location_naming JSONB;
    v_key TEXT;
    v_entry JSONB;
    v_existing_prefix TEXT;
    v_new_naming JSONB;
    v_updated_meta JSONB;
    v_has_document_keys BOOLEAN;
BEGIN
    FOR v_tenant IN
        SELECT id, naming_sequences
        FROM public.tenants
    LOOP
        v_tenant_sequences := COALESCE(v_tenant.naming_sequences, '{}'::jsonb);

        SELECT EXISTS (
            SELECT 1
            FROM jsonb_each(v_tenant_sequences) AS e(key, value)
            WHERE private.is_document_voucher_type(e.key)
        )
        INTO v_has_document_keys;

        IF NOT v_has_document_keys THEN
            CONTINUE;
        END IF;

        FOR v_location IN
            SELECT
                id,
                location_meta,
                is_stock_holding,
                is_commercial_storefront,
                is_administrative_office
            FROM public.tenant_locations
            WHERE tenant_id = v_tenant.id
        LOOP
            v_location_meta := COALESCE(v_location.location_meta, '{}'::jsonb);
            v_location_naming := COALESCE(
                v_location_meta -> 'configuration_metadata' -> 'naming_sequences',
                '{}'::jsonb
            );
            v_new_naming := v_location_naming;

            FOR v_key, v_entry IN SELECT * FROM jsonb_each(v_tenant_sequences)
            LOOP
                IF NOT private.is_document_voucher_type(v_key) THEN
                    CONTINUE;
                END IF;

                IF NOT private.location_supports_document_voucher_key(
                    v_key,
                    v_location.is_stock_holding,
                    v_location.is_commercial_storefront,
                    v_location.is_administrative_office
                ) THEN
                    CONTINUE;
                END IF;

                v_existing_prefix := NULLIF(btrim(v_location_naming -> v_key ->> 'prefix'), '');
                IF v_existing_prefix IS NOT NULL THEN
                    CONTINUE;
                END IF;

                v_new_naming := v_new_naming || jsonb_build_object(v_key, v_entry);
            END LOOP;

            IF v_new_naming IS DISTINCT FROM v_location_naming THEN
                v_updated_meta := jsonb_set(
                    v_location_meta,
                    '{configuration_metadata,naming_sequences}',
                    v_new_naming,
                    true
                );

                UPDATE public.tenant_locations
                SET
                    location_meta = v_updated_meta,
                    updated_at = NOW()
                WHERE id = v_location.id;

                PERFORM private.sync_document_sequences_from_naming(
                    v_tenant.id,
                    v_new_naming,
                    v_location.id
                );
            END IF;
        END LOOP;

        UPDATE public.tenants
        SET
            naming_sequences = private.strip_document_voucher_keys_from_naming(v_tenant_sequences),
            updated_at = NOW()
        WHERE id = v_tenant.id;
    END LOOP;
END;
$$;

DELETE FROM public.document_sequences
WHERE location_id IS NULL;

CREATE OR REPLACE FUNCTION private.resolve_effective_naming_entry(
    p_tenant_id UUID,
    p_location_id UUID,
    p_voucher_type public.document_voucher_type
)
RETURNS TABLE (
    prefix TEXT,
    padding_length INTEGER,
    uses_location_scope BOOLEAN
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_location_meta JSONB;
    v_entry JSONB;
    v_prefix TEXT;
    v_digits INTEGER;
    v_key TEXT;
BEGIN
    IF p_location_id IS NULL THEN
        RAISE EXCEPTION 'location id is required for document naming';
    END IF;

    v_key := upper(p_voucher_type::text);

    SELECT location_meta
    INTO v_location_meta
    FROM public.tenant_locations
    WHERE id = p_location_id
      AND tenant_id = p_tenant_id;

    IF v_location_meta IS NULL THEN
        RAISE EXCEPTION 'location not found for tenant %', p_tenant_id;
    END IF;

    v_entry := COALESCE(v_location_meta, '{}'::jsonb)
        -> 'configuration_metadata'
        -> 'naming_sequences'
        -> v_key;

    v_prefix := NULLIF(btrim(v_entry ->> 'prefix'), '');

    IF v_prefix IS NULL THEN
        RAISE EXCEPTION
            'document naming not configured for location %, type %',
            p_location_id, p_voucher_type;
    END IF;

    v_digits := COALESCE(NULLIF(v_entry ->> 'digits', '')::INTEGER, 5);
    IF v_digits < 3 OR v_digits > 12 THEN
        v_digits := 5;
    END IF;

    prefix := v_prefix;
    padding_length := v_digits;
    uses_location_scope := TRUE;
    RETURN NEXT;
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
    END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION private.update_organization_governance_profile(
    p_legal_name TEXT,
    p_trade_name TEXT DEFAULT NULL,
    p_tax_identifier TEXT DEFAULT NULL,
    p_legal_registration_number TEXT DEFAULT NULL,
    p_primary_email TEXT DEFAULT NULL,
    p_primary_phone TEXT DEFAULT NULL,
    p_secondary_phone TEXT DEFAULT NULL,
    p_website_url TEXT DEFAULT NULL,
    p_billing_address_line1 TEXT DEFAULT NULL,
    p_billing_address_line2 TEXT DEFAULT NULL,
    p_billing_city TEXT DEFAULT NULL,
    p_billing_state TEXT DEFAULT NULL,
    p_billing_zip_postal TEXT DEFAULT NULL,
    p_billing_country_code TEXT DEFAULT NULL,
    p_base_currency TEXT DEFAULT NULL,
    p_fiscal_year_start_month SMALLINT DEFAULT NULL,
    p_logo_url TEXT DEFAULT NULL,
    p_accounting_config_patch JSONB DEFAULT NULL,
    p_location_governance_config_patch JSONB DEFAULT NULL,
    p_naming_sequences JSONB DEFAULT NULL,
    p_country_code TEXT DEFAULT NULL,
    p_timezone TEXT DEFAULT NULL,
    p_locale TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_tenant_id UUID;
    v_trimmed_legal TEXT;
    v_current_currency VARCHAR(3);
    v_has_inventory_activity BOOLEAN;
    v_sanitized_naming JSONB;
BEGIN
    v_tenant_id := private.current_tenant_id();
    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'tenant context missing from session';
    END IF;

    IF NOT private.user_can_modify_organization_settings() THEN
        RAISE EXCEPTION 'administrative privileges required to modify organization settings';
    END IF;

    v_trimmed_legal := btrim(p_legal_name);
    IF v_trimmed_legal IS NULL OR v_trimmed_legal = '' THEN
        RAISE EXCEPTION 'legal entity name is required';
    END IF;

    IF p_primary_email IS NULL OR btrim(p_primary_email) = '' THEN
        RAISE EXCEPTION 'primary corporate email is required';
    END IF;

    IF p_primary_phone IS NULL OR btrim(p_primary_phone) = '' THEN
        RAISE EXCEPTION 'primary corporate phone is required';
    END IF;

    IF p_fiscal_year_start_month IS NOT NULL
       AND (p_fiscal_year_start_month < 1 OR p_fiscal_year_start_month > 12) THEN
        RAISE EXCEPTION 'fiscal year start month must be between 1 and 12';
    END IF;

    SELECT base_currency
    INTO v_current_currency
    FROM public.tenants
    WHERE id = v_tenant_id;

    IF p_base_currency IS NOT NULL
       AND upper(btrim(p_base_currency)) IS DISTINCT FROM upper(v_current_currency) THEN
        SELECT EXISTS (
            SELECT 1 FROM public.inventory_ledger WHERE tenant_id = v_tenant_id LIMIT 1
        )
        OR EXISTS (
            SELECT 1 FROM public.item_valuations WHERE tenant_id = v_tenant_id LIMIT 1
        )
        INTO v_has_inventory_activity;

        IF v_has_inventory_activity THEN
            RAISE EXCEPTION 'base currency cannot be changed after inventory activity exists';
        END IF;
    END IF;

    IF p_naming_sequences IS NOT NULL THEN
        v_sanitized_naming := private.strip_document_voucher_keys_from_naming(p_naming_sequences);
    END IF;

    UPDATE public.tenants
    SET
        legal_name = v_trimmed_legal,
        trade_name = NULLIF(btrim(p_trade_name), ''),
        name = COALESCE(NULLIF(btrim(p_trade_name), ''), v_trimmed_legal),
        tax_identifier = NULLIF(btrim(p_tax_identifier), ''),
        legal_registration_number = NULLIF(btrim(p_legal_registration_number), ''),
        primary_email = lower(btrim(p_primary_email)),
        primary_phone = btrim(p_primary_phone),
        secondary_phone = NULLIF(btrim(p_secondary_phone), ''),
        website_url = NULLIF(btrim(p_website_url), ''),
        billing_address_line1 = NULLIF(btrim(p_billing_address_line1), ''),
        billing_address_line2 = NULLIF(btrim(p_billing_address_line2), ''),
        billing_city = NULLIF(btrim(p_billing_city), ''),
        billing_state = NULLIF(btrim(p_billing_state), ''),
        billing_zip_postal = NULLIF(btrim(p_billing_zip_postal), ''),
        billing_country_code = NULLIF(upper(btrim(p_billing_country_code)), ''),
        country_code = NULLIF(upper(btrim(p_country_code)), ''),
        timezone = COALESCE(NULLIF(btrim(p_timezone), ''), timezone),
        locale = COALESCE(NULLIF(btrim(p_locale), ''), locale),
        base_currency = COALESCE(upper(btrim(p_base_currency)), base_currency),
        fiscal_year_start_month = COALESCE(p_fiscal_year_start_month, fiscal_year_start_month),
        logo_url = COALESCE(NULLIF(btrim(p_logo_url), ''), logo_url),
        accounting_config = CASE
            WHEN p_accounting_config_patch IS NULL THEN accounting_config
            ELSE private.merge_jsonb_objects(accounting_config, p_accounting_config_patch)
        END,
        location_governance_config = CASE
            WHEN p_location_governance_config_patch IS NULL THEN location_governance_config
            ELSE private.merge_jsonb_objects(location_governance_config, p_location_governance_config_patch)
        END,
        naming_sequences = CASE
            WHEN p_naming_sequences IS NULL THEN naming_sequences
            ELSE private.merge_jsonb_objects(
                naming_sequences,
                v_sanitized_naming
            )
        END,
        updated_at = NOW()
    WHERE id = v_tenant_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'tenant not found for session';
    END IF;
END;
$$;

-- save_tenant_location_core: pass capability flags into naming validation
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
    p_location_meta JSONB DEFAULT NULL
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

    IF p_location_id IS NOT NULL THEN
        SELECT code, location_meta
        INTO v_existing_code, v_existing_meta
        FROM public.tenant_locations
        WHERE id = p_location_id
          AND tenant_id = v_tenant_id;

        IF v_existing_code IS NULL THEN
            RAISE EXCEPTION 'location not found for tenant';
        END IF;

        IF private.is_system_tenant_location(v_existing_code) THEN
            RAISE EXCEPTION 'system locations cannot be modified';
        END IF;
    ELSE
        v_existing_meta := NULL;

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
            updated_at = NOW()
        WHERE id = p_location_id
          AND tenant_id = v_tenant_id
        RETURNING id INTO v_location_id;
    END IF;

    v_naming_sequences := v_effective_meta -> 'configuration_metadata' -> 'naming_sequences';
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

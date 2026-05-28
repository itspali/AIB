-- ====================================================================
-- AIB SMART ERP - LOCATION-SCOPED DOCUMENT NAMING
-- Migration: 20260531800000_location_document_naming.sql
-- ====================================================================
-- Per-location document naming overrides stored under
-- location_meta.configuration_metadata.naming_sequences with tenant
-- defaults remaining on tenants.naming_sequences.
-- ====================================================================

ALTER TABLE public.document_sequences
    ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES public.tenant_locations (id) ON DELETE CASCADE;

ALTER TABLE public.document_sequences
    DROP CONSTRAINT IF EXISTS document_sequences_tenant_type_prefix_unique;

CREATE UNIQUE INDEX IF NOT EXISTS document_sequences_tenant_location_type_prefix_unique
    ON public.document_sequences (
        tenant_id,
        COALESCE(location_id, '00000000-0000-0000-0000-000000000000'::uuid),
        voucher_type,
        prefix
    );

CREATE INDEX IF NOT EXISTS document_sequences_location_idx
    ON public.document_sequences (tenant_id, location_id)
    WHERE location_id IS NOT NULL;

CREATE OR REPLACE FUNCTION private.is_document_voucher_type(p_key TEXT)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM pg_enum e
        JOIN pg_type t ON t.oid = e.enumtypid
        WHERE t.typname = 'document_voucher_type'
          AND e.enumlabel = upper(p_key)
    );
$$;

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
    v_tenant_sequences JSONB;
    v_entry JSONB;
    v_prefix TEXT;
    v_digits INTEGER;
    v_key TEXT;
BEGIN
    v_key := upper(p_voucher_type::text);

    IF p_location_id IS NOT NULL THEN
        SELECT location_meta
        INTO v_location_meta
        FROM public.tenant_locations
        WHERE id = p_location_id
          AND tenant_id = p_tenant_id;

        IF v_location_meta IS NOT NULL THEN
            v_entry := COALESCE(v_location_meta, '{}'::jsonb)
                -> 'configuration_metadata'
                -> 'naming_sequences'
                -> v_key;

            v_prefix := NULLIF(btrim(v_entry ->> 'prefix'), '');
            IF v_prefix IS NOT NULL THEN
                v_digits := COALESCE(NULLIF(v_entry ->> 'digits', '')::INTEGER, 5);
                IF v_digits < 3 OR v_digits > 12 THEN
                    v_digits := 5;
                END IF;

                prefix := v_prefix;
                padding_length := v_digits;
                uses_location_scope := TRUE;
                RETURN NEXT;
                RETURN;
            END IF;
        END IF;
    END IF;

    SELECT naming_sequences
    INTO v_tenant_sequences
    FROM public.tenants
    WHERE id = p_tenant_id;

    v_entry := COALESCE(v_tenant_sequences, '{}'::jsonb) -> v_key;
    v_prefix := NULLIF(btrim(v_entry ->> 'prefix'), '');

    IF v_prefix IS NULL THEN
        RAISE EXCEPTION
            'document naming not configured for tenant %, type %',
            p_tenant_id, p_voucher_type;
    END IF;

    v_digits := COALESCE(NULLIF(v_entry ->> 'digits', '')::INTEGER, 5);
    IF v_digits < 3 OR v_digits > 12 THEN
        v_digits := 5;
    END IF;

    prefix := v_prefix;
    padding_length := v_digits;
    uses_location_scope := FALSE;
    RETURN NEXT;
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

        UPDATE public.document_sequences
        SET padding_length = v_digits
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
                1,
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
    p_location_meta JSONB
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

CREATE OR REPLACE FUNCTION public.generate_next_voucher_string(
    p_tenant_id UUID,
    p_voucher_type document_voucher_type,
    p_prefix TEXT DEFAULT NULL,
    p_location_id UUID DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_row public.document_sequences%ROWTYPE;
    v_sequence_value INTEGER;
    v_resolved_prefix TEXT;
    v_resolved_padding INTEGER;
    v_uses_location_scope BOOLEAN;
    v_scope_location_id UUID;
BEGIN
    IF p_prefix IS NOT NULL THEN
        SELECT *
        INTO v_row
        FROM public.document_sequences
        WHERE tenant_id = p_tenant_id
          AND voucher_type = p_voucher_type
          AND prefix = p_prefix
          AND location_id IS NOT DISTINCT FROM p_location_id
        FOR UPDATE;
    ELSE
        SELECT prefix, padding_length, uses_location_scope
        INTO v_resolved_prefix, v_resolved_padding, v_uses_location_scope
        FROM private.resolve_effective_naming_entry(p_tenant_id, p_location_id, p_voucher_type);

        v_scope_location_id := CASE
            WHEN v_uses_location_scope THEN p_location_id
            ELSE NULL
        END;

        SELECT *
        INTO v_row
        FROM public.document_sequences
        WHERE tenant_id = p_tenant_id
          AND voucher_type = p_voucher_type
          AND prefix = v_resolved_prefix
          AND location_id IS NOT DISTINCT FROM v_scope_location_id
        FOR UPDATE;

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
                v_scope_location_id,
                p_voucher_type,
                v_resolved_prefix,
                1,
                v_resolved_padding
            )
            RETURNING * INTO v_row;
        END IF;
    END IF;

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'document sequence not configured for tenant %, type %, prefix %, location %',
            p_tenant_id, p_voucher_type, p_prefix, p_location_id;
    END IF;

    v_sequence_value := v_row.next_value;

    UPDATE public.document_sequences
    SET next_value = next_value + 1,
        updated_at = NOW()
    WHERE id = v_row.id;

    RETURN v_row.prefix || lpad(v_sequence_value::text, v_row.padding_length, '0');
END;
$$;

CREATE OR REPLACE FUNCTION private.save_tenant_location_core(
    p_location_id UUID,
    p_name TEXT,
    p_code TEXT,
    p_presence_type public.presence_environment,
    p_parent_location_id UUID,
    p_address_line1 TEXT,
    p_address_line2 TEXT,
    p_city TEXT,
    p_state TEXT,
    p_zip_postal TEXT,
    p_country_code TEXT,
    p_manager_name TEXT,
    p_contact_email TEXT,
    p_contact_phone TEXT,
    p_is_administrative_office BOOLEAN,
    p_is_commercial_storefront BOOLEAN,
    p_is_manufacturing_floor BOOLEAN,
    p_is_stock_holding BOOLEAN,
    p_pos_terminal_count INT,
    p_location_tax_identifier TEXT,
    p_tax_registered_name TEXT,
    p_location_meta JSONB
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
    v_normalized_code TEXT;
    v_trimmed_name TEXT;
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

    PERFORM private.validate_location_document_naming(v_effective_meta);

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

GRANT EXECUTE ON FUNCTION public.generate_next_voucher_string(
    UUID,
    document_voucher_type,
    TEXT,
    UUID
) TO authenticated;

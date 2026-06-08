-- ====================================================================
-- Entity profile RPCs (Milestone 2 UI)
-- save_entity_profile, save_entity_contacts, bulk active, delete, list page
-- ====================================================================

CREATE OR REPLACE FUNCTION private.normalize_entity_tax_registration(
    p_tax_treatment public.tax_treatment_type,
    p_tax_registration_number TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
    IF p_tax_treatment IN ('UNREGISTERED_B2C', 'OVERSEAS_EXPORT') THEN
        RETURN NULL;
    END IF;

    IF p_tax_registration_number IS NULL OR btrim(p_tax_registration_number) = '' THEN
        RAISE EXCEPTION 'tax registration number is required for this tax treatment';
    END IF;

    RETURN btrim(p_tax_registration_number);
END;
$$;

CREATE OR REPLACE FUNCTION private.save_entity_profile_core(
    p_entity JSONB,
    p_primary_contact JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_tenant_id UUID;
    v_entity_id UUID;
    v_name TEXT;
    v_type public.entity_commercial_type;
    v_tax_treatment public.tax_treatment_type;
    v_tax_registration_number TEXT;
    v_contact_id UUID;
    v_primary_first_name TEXT;
BEGIN
    v_tenant_id := private.current_tenant_id();
    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'tenant context missing from session';
    END IF;

    IF p_entity IS NULL OR jsonb_typeof(p_entity) IS DISTINCT FROM 'object' THEN
        RAISE EXCEPTION 'entity payload must be a JSON object';
    END IF;

    v_entity_id := NULLIF(p_entity ->> 'entity_id', '')::UUID;

    IF v_entity_id IS NOT NULL THEN
        IF NOT private.role_has_entity_permission('update') THEN
            RAISE EXCEPTION 'permission denied to update entities';
        END IF;
        IF NOT EXISTS (
            SELECT 1 FROM public.entities e
            WHERE e.id = v_entity_id AND e.tenant_id = v_tenant_id
        ) THEN
            RAISE EXCEPTION 'entity not found for tenant';
        END IF;
    ELSE
        IF NOT private.role_has_entity_permission('insert') THEN
            RAISE EXCEPTION 'permission denied to create entities';
        END IF;
    END IF;

    v_name := btrim(p_entity ->> 'name');
    IF v_name IS NULL OR v_name = '' THEN
        RAISE EXCEPTION 'entity name is required';
    END IF;

    BEGIN
        v_type := upper(btrim(p_entity ->> 'type'))::public.entity_commercial_type;
    EXCEPTION
        WHEN others THEN
            RAISE EXCEPTION 'invalid entity commercial type';
    END;

    BEGIN
        v_tax_treatment := upper(btrim(COALESCE(p_entity ->> 'tax_treatment', 'REGULAR_B2B')))::public.tax_treatment_type;
    EXCEPTION
        WHEN others THEN
            RAISE EXCEPTION 'invalid tax treatment';
    END;

    v_tax_registration_number := private.normalize_entity_tax_registration(
        v_tax_treatment,
        p_entity ->> 'tax_registration_number'
    );

    IF v_entity_id IS NULL THEN
        INSERT INTO public.entities (
            tenant_id,
            name,
            legal_name,
            code,
            type,
            tax_registration_number,
            tax_treatment,
            base_currency_override,
            credit_limit,
            payment_terms_days,
            billing_address_line1,
            billing_address_line2,
            billing_city,
            billing_state,
            billing_zip_postal,
            billing_country_code,
            shipping_address_line1,
            shipping_address_line2,
            shipping_city,
            shipping_state,
            shipping_zip_postal,
            shipping_country_code,
            incoterms_code,
            default_shipping_method,
            company_email,
            company_phone,
            website_url,
            internal_notes,
            custom_fields,
            is_active
        )
        VALUES (
            v_tenant_id,
            v_name,
            NULLIF(btrim(p_entity ->> 'legal_name'), ''),
            NULLIF(btrim(p_entity ->> 'code'), ''),
            v_type,
            v_tax_registration_number,
            v_tax_treatment,
            NULLIF(upper(btrim(p_entity ->> 'base_currency_override')), ''),
            COALESCE((p_entity ->> 'credit_limit')::NUMERIC, 0),
            COALESCE((p_entity ->> 'payment_terms_days')::INTEGER, 0),
            NULLIF(btrim(p_entity ->> 'billing_address_line1'), ''),
            NULLIF(btrim(p_entity ->> 'billing_address_line2'), ''),
            NULLIF(btrim(p_entity ->> 'billing_city'), ''),
            NULLIF(btrim(p_entity ->> 'billing_state'), ''),
            NULLIF(btrim(p_entity ->> 'billing_zip_postal'), ''),
            NULLIF(upper(btrim(p_entity ->> 'billing_country_code')), ''),
            NULLIF(btrim(p_entity ->> 'shipping_address_line1'), ''),
            NULLIF(btrim(p_entity ->> 'shipping_address_line2'), ''),
            NULLIF(btrim(p_entity ->> 'shipping_city'), ''),
            NULLIF(btrim(p_entity ->> 'shipping_state'), ''),
            NULLIF(btrim(p_entity ->> 'shipping_zip_postal'), ''),
            NULLIF(upper(btrim(p_entity ->> 'shipping_country_code')), ''),
            NULLIF(upper(btrim(p_entity ->> 'incoterms_code')), ''),
            NULLIF(btrim(p_entity ->> 'default_shipping_method'), ''),
            NULLIF(lower(btrim(p_entity ->> 'company_email')), ''),
            NULLIF(btrim(p_entity ->> 'company_phone'), ''),
            NULLIF(btrim(p_entity ->> 'website_url'), ''),
            NULLIF(btrim(p_entity ->> 'internal_notes'), ''),
            COALESCE(p_entity -> 'custom_fields', '{}'::jsonb),
            COALESCE((p_entity ->> 'is_active')::BOOLEAN, TRUE)
        )
        RETURNING id INTO v_entity_id;
    ELSE
        UPDATE public.entities
        SET
            name = v_name,
            legal_name = NULLIF(btrim(p_entity ->> 'legal_name'), ''),
            code = NULLIF(btrim(p_entity ->> 'code'), ''),
            type = v_type,
            tax_registration_number = v_tax_registration_number,
            tax_treatment = v_tax_treatment,
            base_currency_override = NULLIF(upper(btrim(p_entity ->> 'base_currency_override')), ''),
            credit_limit = COALESCE((p_entity ->> 'credit_limit')::NUMERIC, credit_limit),
            payment_terms_days = COALESCE((p_entity ->> 'payment_terms_days')::INTEGER, payment_terms_days),
            billing_address_line1 = NULLIF(btrim(p_entity ->> 'billing_address_line1'), ''),
            billing_address_line2 = NULLIF(btrim(p_entity ->> 'billing_address_line2'), ''),
            billing_city = NULLIF(btrim(p_entity ->> 'billing_city'), ''),
            billing_state = NULLIF(btrim(p_entity ->> 'billing_state'), ''),
            billing_zip_postal = NULLIF(btrim(p_entity ->> 'billing_zip_postal'), ''),
            billing_country_code = NULLIF(upper(btrim(p_entity ->> 'billing_country_code')), ''),
            shipping_address_line1 = NULLIF(btrim(p_entity ->> 'shipping_address_line1'), ''),
            shipping_address_line2 = NULLIF(btrim(p_entity ->> 'shipping_address_line2'), ''),
            shipping_city = NULLIF(btrim(p_entity ->> 'shipping_city'), ''),
            shipping_state = NULLIF(btrim(p_entity ->> 'shipping_state'), ''),
            shipping_zip_postal = NULLIF(btrim(p_entity ->> 'shipping_zip_postal'), ''),
            shipping_country_code = NULLIF(upper(btrim(p_entity ->> 'shipping_country_code')), ''),
            incoterms_code = NULLIF(upper(btrim(p_entity ->> 'incoterms_code')), ''),
            default_shipping_method = NULLIF(btrim(p_entity ->> 'default_shipping_method'), ''),
            company_email = NULLIF(lower(btrim(p_entity ->> 'company_email')), ''),
            company_phone = NULLIF(btrim(p_entity ->> 'company_phone'), ''),
            website_url = NULLIF(btrim(p_entity ->> 'website_url'), ''),
            internal_notes = NULLIF(btrim(p_entity ->> 'internal_notes'), ''),
            custom_fields = COALESCE(p_entity -> 'custom_fields', custom_fields),
            is_active = COALESCE((p_entity ->> 'is_active')::BOOLEAN, is_active)
        WHERE id = v_entity_id
          AND tenant_id = v_tenant_id;
    END IF;

    IF p_primary_contact IS NOT NULL AND jsonb_typeof(p_primary_contact) = 'object' THEN
        v_primary_first_name := btrim(p_primary_contact ->> 'first_name');
        IF v_primary_first_name IS NOT NULL AND v_primary_first_name <> '' THEN
            v_contact_id := NULLIF(p_primary_contact ->> 'contact_id', '')::UUID;

            IF v_contact_id IS NOT NULL THEN
                UPDATE public.entity_contacts
                SET
                    first_name = v_primary_first_name,
                    last_name = NULLIF(btrim(p_primary_contact ->> 'last_name'), ''),
                    email = NULLIF(lower(btrim(p_primary_contact ->> 'email')), ''),
                    phone = NULLIF(btrim(p_primary_contact ->> 'phone'), ''),
                    mobile = NULLIF(btrim(p_primary_contact ->> 'mobile'), ''),
                    whatsapp_number = NULLIF(btrim(p_primary_contact ->> 'whatsapp_number'), ''),
                    department = NULLIF(btrim(p_primary_contact ->> 'department'), ''),
                    job_title = NULLIF(btrim(p_primary_contact ->> 'job_title'), ''),
                    is_primary = TRUE,
                    is_active = TRUE
                WHERE id = v_contact_id
                  AND entity_id = v_entity_id
                  AND tenant_id = v_tenant_id;
            ELSE
                UPDATE public.entity_contacts
                SET is_primary = FALSE
                WHERE entity_id = v_entity_id
                  AND tenant_id = v_tenant_id
                  AND is_primary = TRUE;

                INSERT INTO public.entity_contacts (
                    tenant_id,
                    entity_id,
                    first_name,
                    last_name,
                    email,
                    phone,
                    mobile,
                    whatsapp_number,
                    department,
                    job_title,
                    is_primary,
                    is_active
                )
                VALUES (
                    v_tenant_id,
                    v_entity_id,
                    v_primary_first_name,
                    NULLIF(btrim(p_primary_contact ->> 'last_name'), ''),
                    NULLIF(lower(btrim(p_primary_contact ->> 'email')), ''),
                    NULLIF(btrim(p_primary_contact ->> 'phone'), ''),
                    NULLIF(btrim(p_primary_contact ->> 'mobile'), ''),
                    NULLIF(btrim(p_primary_contact ->> 'whatsapp_number'), ''),
                    NULLIF(btrim(p_primary_contact ->> 'department'), ''),
                    NULLIF(btrim(p_primary_contact ->> 'job_title'), ''),
                    TRUE,
                    TRUE
                );
            END IF;
        END IF;
    END IF;

    RETURN v_entity_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.save_entity_profile(
    p_entity JSONB,
    p_primary_contact JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
BEGIN
    RETURN private.save_entity_profile_core(p_entity, p_primary_contact);
END;
$$;

CREATE OR REPLACE FUNCTION public.save_entity_contacts(
    p_entity_id UUID,
    p_contacts JSONB DEFAULT '[]'::jsonb
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_tenant_id UUID;
    v_contact JSONB;
    v_contact_id UUID;
    v_kept_ids UUID[] := ARRAY[]::UUID[];
BEGIN
    v_tenant_id := private.current_tenant_id();
    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'tenant context missing from session';
    END IF;

    IF NOT private.role_has_entity_permission('update') THEN
        RAISE EXCEPTION 'permission denied to update entity contacts';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.entities e
        WHERE e.id = p_entity_id AND e.tenant_id = v_tenant_id
    ) THEN
        RAISE EXCEPTION 'entity not found for tenant';
    END IF;

    IF p_contacts IS NULL OR jsonb_typeof(p_contacts) IS DISTINCT FROM 'array' THEN
        RAISE EXCEPTION 'contacts payload must be a JSON array';
    END IF;

    FOR v_contact IN SELECT value FROM jsonb_array_elements(p_contacts)
    LOOP
        IF COALESCE((v_contact ->> 'is_primary')::BOOLEAN, FALSE) THEN
            RAISE EXCEPTION 'extended contacts cannot include primary contact; use save_entity_profile';
        END IF;

        v_contact_id := NULLIF(v_contact ->> 'contact_id', '')::UUID;
        IF v_contact_id IS NOT NULL THEN
            UPDATE public.entity_contacts
            SET
                first_name = btrim(v_contact ->> 'first_name'),
                last_name = NULLIF(btrim(v_contact ->> 'last_name'), ''),
                email = NULLIF(lower(btrim(v_contact ->> 'email')), ''),
                phone = NULLIF(btrim(v_contact ->> 'phone'), ''),
                mobile = NULLIF(btrim(v_contact ->> 'mobile'), ''),
                whatsapp_number = NULLIF(btrim(v_contact ->> 'whatsapp_number'), ''),
                department = NULLIF(btrim(v_contact ->> 'department'), ''),
                job_title = NULLIF(btrim(v_contact ->> 'job_title'), ''),
                is_active = COALESCE((v_contact ->> 'is_active')::BOOLEAN, TRUE),
                is_primary = FALSE
            WHERE id = v_contact_id
              AND entity_id = p_entity_id
              AND tenant_id = v_tenant_id;

            v_kept_ids := array_append(v_kept_ids, v_contact_id);
        ELSE
            IF btrim(v_contact ->> 'first_name') IS NULL OR btrim(v_contact ->> 'first_name') = '' THEN
                CONTINUE;
            END IF;

            INSERT INTO public.entity_contacts (
                tenant_id,
                entity_id,
                first_name,
                last_name,
                email,
                phone,
                mobile,
                whatsapp_number,
                department,
                job_title,
                is_primary,
                is_active
            )
            VALUES (
                v_tenant_id,
                p_entity_id,
                btrim(v_contact ->> 'first_name'),
                NULLIF(btrim(v_contact ->> 'last_name'), ''),
                NULLIF(lower(btrim(v_contact ->> 'email')), ''),
                NULLIF(btrim(v_contact ->> 'phone'), ''),
                NULLIF(btrim(v_contact ->> 'mobile'), ''),
                NULLIF(btrim(v_contact ->> 'whatsapp_number'), ''),
                NULLIF(btrim(v_contact ->> 'department'), ''),
                NULLIF(btrim(v_contact ->> 'job_title'), ''),
                FALSE,
                COALESCE((v_contact ->> 'is_active')::BOOLEAN, TRUE)
            )
            RETURNING id INTO v_contact_id;

            v_kept_ids := array_append(v_kept_ids, v_contact_id);
        END IF;
    END LOOP;

    DELETE FROM public.entity_contacts ec
    WHERE ec.entity_id = p_entity_id
      AND ec.tenant_id = v_tenant_id
      AND ec.is_primary = FALSE
      AND NOT (ec.id = ANY (v_kept_ids));
END;
$$;

CREATE OR REPLACE FUNCTION public.bulk_set_entities_active(
    p_entity_ids UUID[],
    p_is_active BOOLEAN
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_tenant_id UUID;
    v_updated INTEGER;
BEGIN
    v_tenant_id := private.current_tenant_id();
    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'tenant context missing from session';
    END IF;

    IF NOT private.role_has_entity_permission('update') THEN
        RAISE EXCEPTION 'permission denied to update entities';
    END IF;

    UPDATE public.entities e
    SET is_active = p_is_active
    WHERE e.tenant_id = v_tenant_id
      AND e.id = ANY (COALESCE(p_entity_ids, ARRAY[]::UUID[]));

    GET DIAGNOSTICS v_updated = ROW_COUNT;
    RETURN v_updated;
END;
$$;

CREATE OR REPLACE FUNCTION public.count_entity_references(p_entity_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_tenant_id UUID;
    v_total INTEGER := 0;
BEGIN
    v_tenant_id := private.current_tenant_id();
    IF v_tenant_id IS NULL OR p_entity_id IS NULL THEN
        RETURN 0;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.entities e
        WHERE e.id = p_entity_id AND e.tenant_id = v_tenant_id
    ) THEN
        RETURN 0;
    END IF;

    SELECT
        COALESCE((SELECT COUNT(*) FROM public.supplier_items si WHERE si.supplier_id = p_entity_id), 0)
        + COALESCE((SELECT COUNT(*) FROM public.purchase_orders po WHERE po.supplier_id = p_entity_id), 0)
        + COALESCE((SELECT COUNT(*) FROM public.purchase_invoices pi WHERE pi.supplier_id = p_entity_id), 0)
        + COALESCE((SELECT COUNT(*) FROM public.sales_quotations sq WHERE sq.customer_id = p_entity_id), 0)
        + COALESCE((SELECT COUNT(*) FROM public.sales_orders so WHERE so.customer_id = p_entity_id), 0)
        + COALESCE((SELECT COUNT(*) FROM public.sales_invoices si2 WHERE si2.customer_id = p_entity_id), 0)
        + COALESCE((SELECT COUNT(*) FROM public.customer_payments cp WHERE cp.customer_id = p_entity_id), 0)
        + COALESCE((SELECT COUNT(*) FROM public.sales_credit_notes scn WHERE scn.customer_id = p_entity_id), 0)
        + COALESCE((SELECT COUNT(*) FROM public.sales_returns sr WHERE sr.customer_id = p_entity_id), 0)
    INTO v_total;

    RETURN v_total;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_entity(p_entity_id UUID)
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

    IF NOT private.role_has_entity_permission('delete') THEN
        RAISE EXCEPTION 'permission denied to delete entities';
    END IF;

    IF public.count_entity_references(p_entity_id) > 0 THEN
        RAISE EXCEPTION 'ENTITY_IN_USE: entity is referenced by transactions and cannot be deleted';
    END IF;

    DELETE FROM public.entities e
    WHERE e.id = p_entity_id
      AND e.tenant_id = v_tenant_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.fetch_entity_list_page(
    p_workspace TEXT,
    p_offset INTEGER DEFAULT 0,
    p_limit INTEGER DEFAULT 50,
    p_search TEXT DEFAULT NULL,
    p_active_only BOOLEAN DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    name TEXT,
    legal_name TEXT,
    code VARCHAR(30),
    type entity_commercial_type,
    tax_treatment tax_treatment_type,
    tax_registration_number TEXT,
    credit_limit NUMERIC(15, 4),
    current_balance NUMERIC(15, 4),
    payment_terms_days INTEGER,
    company_email TEXT,
    company_phone TEXT,
    is_active BOOLEAN,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    primary_contact_name TEXT,
    primary_contact_email TEXT,
    total_count BIGINT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_tenant_id UUID;
    v_search TEXT;
BEGIN
    v_tenant_id := private.current_tenant_id();
    IF v_tenant_id IS NULL THEN
        RETURN;
    END IF;

    IF NOT private.role_has_entity_permission('select') THEN
        RETURN;
    END IF;

    v_search := NULLIF(btrim(p_search), '');

    RETURN QUERY
    WITH filtered AS (
        SELECT e.*
        FROM public.entities e
        WHERE e.tenant_id = v_tenant_id
          AND (
            CASE lower(btrim(p_workspace))
                WHEN 'customer' THEN e.type IN ('CUSTOMER', 'MUTUAL_PARTNER')
                WHEN 'supplier' THEN e.type IN ('SUPPLIER', 'MUTUAL_PARTNER')
                ELSE TRUE
            END
          )
          AND (
            p_active_only IS NULL
            OR e.is_active = p_active_only
          )
          AND (
            v_search IS NULL
            OR e.name ILIKE '%' || v_search || '%'
            OR COALESCE(e.code, '') ILIKE '%' || v_search || '%'
            OR COALESCE(e.legal_name, '') ILIKE '%' || v_search || '%'
          )
    ),
    counted AS (
        SELECT COUNT(*)::BIGINT AS cnt FROM filtered
    )
    SELECT
        f.id,
        f.name,
        f.legal_name,
        f.code,
        f.type,
        f.tax_treatment,
        f.tax_registration_number,
        f.credit_limit,
        f.current_balance,
        f.payment_terms_days,
        f.company_email,
        f.company_phone,
        f.is_active,
        f.created_at,
        f.updated_at,
        NULLIF(
            btrim(
                concat_ws(
                    ' ',
                    pc.first_name,
                    NULLIF(pc.last_name, '')
                )
            ),
            ''
        ) AS primary_contact_name,
        pc.email AS primary_contact_email,
        c.cnt AS total_count
    FROM filtered f
    CROSS JOIN counted c
    LEFT JOIN LATERAL (
        SELECT ec.first_name, ec.last_name, ec.email
        FROM public.entity_contacts ec
        WHERE ec.entity_id = f.id
          AND ec.tenant_id = f.tenant_id
          AND ec.is_primary = TRUE
        LIMIT 1
    ) pc ON TRUE
    ORDER BY f.name ASC, f.id ASC
    OFFSET GREATEST(p_offset, 0)
    LIMIT GREATEST(p_limit, 1);
END;
$$;

CREATE OR REPLACE FUNCTION public.fetch_entity_overview_stats()
RETURNS TABLE (
    customer_count BIGINT,
    supplier_count BIGINT,
    active_customer_count BIGINT,
    active_supplier_count BIGINT,
    total_credit_limit NUMERIC(15, 4),
    total_current_balance NUMERIC(15, 4)
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_tenant_id UUID;
BEGIN
    v_tenant_id := private.current_tenant_id();
    IF v_tenant_id IS NULL OR NOT private.role_has_entity_permission('select') THEN
        RETURN;
    END IF;

    RETURN QUERY
    SELECT
        COUNT(*) FILTER (WHERE e.type IN ('CUSTOMER', 'MUTUAL_PARTNER'))::BIGINT,
        COUNT(*) FILTER (WHERE e.type IN ('SUPPLIER', 'MUTUAL_PARTNER'))::BIGINT,
        COUNT(*) FILTER (
            WHERE e.type IN ('CUSTOMER', 'MUTUAL_PARTNER') AND e.is_active
        )::BIGINT,
        COUNT(*) FILTER (
            WHERE e.type IN ('SUPPLIER', 'MUTUAL_PARTNER') AND e.is_active
        )::BIGINT,
        COALESCE(
            SUM(e.credit_limit) FILTER (WHERE e.type IN ('CUSTOMER', 'MUTUAL_PARTNER')),
            0
        )::NUMERIC(15, 4),
        COALESCE(
            SUM(e.current_balance) FILTER (WHERE e.type IN ('CUSTOMER', 'MUTUAL_PARTNER')),
            0
        )::NUMERIC(15, 4)
    FROM public.entities e
    WHERE e.tenant_id = v_tenant_id;
END;
$$;

REVOKE ALL ON FUNCTION public.save_entity_profile(JSONB, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_entity_profile(JSONB, JSONB) TO authenticated;

REVOKE ALL ON FUNCTION public.save_entity_contacts(UUID, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_entity_contacts(UUID, JSONB) TO authenticated;

REVOKE ALL ON FUNCTION public.bulk_set_entities_active(UUID[], BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bulk_set_entities_active(UUID[], BOOLEAN) TO authenticated;

REVOKE ALL ON FUNCTION public.count_entity_references(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.count_entity_references(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.delete_entity(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_entity(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.fetch_entity_list_page(TEXT, INTEGER, INTEGER, TEXT, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fetch_entity_list_page(TEXT, INTEGER, INTEGER, TEXT, BOOLEAN) TO authenticated;

REVOKE ALL ON FUNCTION public.fetch_entity_overview_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fetch_entity_overview_stats() TO authenticated;

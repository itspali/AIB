-- ====================================================================
-- Entity profile photo + supplier bank accounts (IFSC / UPI)
-- ====================================================================

ALTER TABLE public.entities
    ADD COLUMN IF NOT EXISTS logo_url TEXT;

COMMENT ON COLUMN public.entities.logo_url IS
    'Storage path in entity-logos bucket for workspace profile / logo image.';

CREATE TABLE public.entity_bank_accounts (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
    entity_id           UUID NOT NULL REFERENCES public.entities (id) ON DELETE CASCADE,

    account_holder_name TEXT NOT NULL,
    account_number      TEXT NOT NULL,
    ifsc_code           VARCHAR(11),
    bank_code           VARCHAR(4),
    bank_name           TEXT,
    branch_name         TEXT,
    upi_id              TEXT,

    is_primary          BOOLEAN NOT NULL DEFAULT FALSE,
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order          INTEGER NOT NULL DEFAULT 0,

    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT entity_bank_accounts_ifsc_uppercase_chk
        CHECK (ifsc_code IS NULL OR ifsc_code = upper(ifsc_code)),
    CONSTRAINT entity_bank_accounts_upi_lowercase_chk
        CHECK (upi_id IS NULL OR upi_id = lower(upi_id)),
    CONSTRAINT entity_bank_accounts_bank_code_uppercase_chk
        CHECK (bank_code IS NULL OR bank_code = upper(bank_code))
);

ALTER TABLE public.entity_bank_accounts
    ADD CONSTRAINT entity_bank_accounts_entity_tenant_fk
    FOREIGN KEY (tenant_id, entity_id)
    REFERENCES public.entities (tenant_id, id)
    ON DELETE CASCADE;

CREATE UNIQUE INDEX entity_bank_accounts_one_primary_per_entity
    ON public.entity_bank_accounts (entity_id)
    WHERE is_primary = TRUE;

CREATE INDEX entity_bank_accounts_tenant_id_entity_id_idx
    ON public.entity_bank_accounts (tenant_id, entity_id);

CREATE TRIGGER entity_bank_accounts_set_updated_at
    BEFORE UPDATE ON public.entity_bank_accounts
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

-- --------------------------------------------------------------------
-- RLS — entity_bank_accounts (same permission helper as entities)
-- --------------------------------------------------------------------
ALTER TABLE public.entity_bank_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY entity_bank_accounts_select
    ON public.entity_bank_accounts
    FOR SELECT
    TO authenticated
    USING (
        tenant_id = private.current_tenant_id()
        AND private.role_has_entity_permission('select')
    );

CREATE POLICY entity_bank_accounts_insert
    ON public.entity_bank_accounts
    FOR INSERT
    TO authenticated
    WITH CHECK (
        tenant_id = private.current_tenant_id()
        AND private.role_has_entity_permission('insert')
    );

CREATE POLICY entity_bank_accounts_update
    ON public.entity_bank_accounts
    FOR UPDATE
    TO authenticated
    USING (
        tenant_id = private.current_tenant_id()
        AND private.role_has_entity_permission('update')
    )
    WITH CHECK (
        tenant_id = private.current_tenant_id()
        AND private.role_has_entity_permission('update')
    );

CREATE POLICY entity_bank_accounts_delete
    ON public.entity_bank_accounts
    FOR DELETE
    TO authenticated
    USING (
        tenant_id = private.current_tenant_id()
        AND private.role_has_entity_permission('delete')
    );

-- --------------------------------------------------------------------
-- Storage — entity-logos bucket
-- --------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'entity-logos',
    'entity-logos',
    FALSE,
    2097152,
    ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS entity_logos_select_tenant ON storage.objects;
CREATE POLICY entity_logos_select_tenant
    ON storage.objects
    FOR SELECT
    TO authenticated
    USING (
        bucket_id = 'entity-logos'
        AND (storage.foldername(name))[1] = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')
    );

DROP POLICY IF EXISTS entity_logos_insert_authorized ON storage.objects;
CREATE POLICY entity_logos_insert_authorized
    ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (
        bucket_id = 'entity-logos'
        AND (storage.foldername(name))[1] = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')
        AND private.role_has_entity_permission('insert')
    );

DROP POLICY IF EXISTS entity_logos_update_authorized ON storage.objects;
CREATE POLICY entity_logos_update_authorized
    ON storage.objects
    FOR UPDATE
    TO authenticated
    USING (
        bucket_id = 'entity-logos'
        AND (storage.foldername(name))[1] = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')
        AND private.role_has_entity_permission('update')
    )
    WITH CHECK (
        bucket_id = 'entity-logos'
        AND (storage.foldername(name))[1] = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')
        AND private.role_has_entity_permission('update')
    );

DROP POLICY IF EXISTS entity_logos_delete_authorized ON storage.objects;
CREATE POLICY entity_logos_delete_authorized
    ON storage.objects
    FOR DELETE
    TO authenticated
    USING (
        bucket_id = 'entity-logos'
        AND (storage.foldername(name))[1] = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')
        AND private.role_has_entity_permission('delete')
    );

-- --------------------------------------------------------------------
-- Helpers
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.normalize_entity_ifsc(p_ifsc TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    v_ifsc TEXT;
BEGIN
    v_ifsc := upper(btrim(p_ifsc));
    IF v_ifsc IS NULL OR v_ifsc = '' THEN
        RETURN NULL;
    END IF;
    IF char_length(v_ifsc) <> 11 THEN
        RAISE EXCEPTION 'IFSC must be 11 characters';
    END IF;
    RETURN v_ifsc;
END;
$$;

CREATE OR REPLACE FUNCTION private.derive_bank_code_from_ifsc(p_ifsc TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    v_ifsc TEXT;
BEGIN
    v_ifsc := private.normalize_entity_ifsc(p_ifsc);
    IF v_ifsc IS NULL THEN
        RETURN NULL;
    END IF;
    RETURN upper(substring(v_ifsc FROM 1 FOR 4));
END;
$$;

-- --------------------------------------------------------------------
-- save_entity_bank_accounts — replace non-primary bank account set
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.save_entity_bank_accounts(
    p_entity_id UUID,
    p_accounts JSONB DEFAULT '[]'::jsonb
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_tenant_id UUID;
    v_account JSONB;
    v_account_id UUID;
    v_kept_ids UUID[] := ARRAY[]::UUID[];
    v_ifsc TEXT;
    v_holder TEXT;
    v_number TEXT;
BEGIN
    v_tenant_id := private.current_tenant_id();
    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'tenant context missing from session';
    END IF;

    IF NOT private.role_has_entity_permission('update') THEN
        RAISE EXCEPTION 'permission denied to update entity bank accounts';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.entities e
        WHERE e.id = p_entity_id AND e.tenant_id = v_tenant_id
    ) THEN
        RAISE EXCEPTION 'entity not found for tenant';
    END IF;

    IF p_accounts IS NULL OR jsonb_typeof(p_accounts) IS DISTINCT FROM 'array' THEN
        RAISE EXCEPTION 'bank accounts payload must be a JSON array';
    END IF;

    FOR v_account IN SELECT value FROM jsonb_array_elements(p_accounts)
    LOOP
        v_holder := btrim(v_account ->> 'account_holder_name');
        v_number := btrim(v_account ->> 'account_number');
        IF v_holder IS NULL OR v_holder = '' OR v_number IS NULL OR v_number = '' THEN
            CONTINUE;
        END IF;

        v_ifsc := NULL;
        BEGIN
            v_ifsc := private.normalize_entity_ifsc(v_account ->> 'ifsc_code');
        EXCEPTION
            WHEN others THEN
                RAISE EXCEPTION 'invalid IFSC on bank account';
        END;

        v_account_id := NULLIF(v_account ->> 'account_id', '')::UUID;

        IF v_account_id IS NOT NULL THEN
            UPDATE public.entity_bank_accounts
            SET
                account_holder_name = v_holder,
                account_number = v_number,
                ifsc_code = v_ifsc,
                bank_code = COALESCE(
                    NULLIF(upper(btrim(v_account ->> 'bank_code')), ''),
                    private.derive_bank_code_from_ifsc(v_ifsc)
                ),
                bank_name = NULLIF(btrim(v_account ->> 'bank_name'), ''),
                branch_name = NULLIF(btrim(v_account ->> 'branch_name'), ''),
                upi_id = NULLIF(lower(btrim(v_account ->> 'upi_id')), ''),
                is_primary = COALESCE((v_account ->> 'is_primary')::BOOLEAN, FALSE),
                is_active = COALESCE((v_account ->> 'is_active')::BOOLEAN, TRUE),
                sort_order = COALESCE((v_account ->> 'sort_order')::INTEGER, 0)
            WHERE id = v_account_id
              AND entity_id = p_entity_id
              AND tenant_id = v_tenant_id;

            v_kept_ids := array_append(v_kept_ids, v_account_id);
        ELSE
            INSERT INTO public.entity_bank_accounts (
                tenant_id,
                entity_id,
                account_holder_name,
                account_number,
                ifsc_code,
                bank_code,
                bank_name,
                branch_name,
                upi_id,
                is_primary,
                is_active,
                sort_order
            )
            VALUES (
                v_tenant_id,
                p_entity_id,
                v_holder,
                v_number,
                v_ifsc,
                COALESCE(
                    NULLIF(upper(btrim(v_account ->> 'bank_code')), ''),
                    private.derive_bank_code_from_ifsc(v_ifsc)
                ),
                NULLIF(btrim(v_account ->> 'bank_name'), ''),
                NULLIF(btrim(v_account ->> 'branch_name'), ''),
                NULLIF(lower(btrim(v_account ->> 'upi_id')), ''),
                COALESCE((v_account ->> 'is_primary')::BOOLEAN, FALSE),
                COALESCE((v_account ->> 'is_active')::BOOLEAN, TRUE),
                COALESCE((v_account ->> 'sort_order')::INTEGER, 0)
            )
            RETURNING id INTO v_account_id;

            v_kept_ids := array_append(v_kept_ids, v_account_id);
        END IF;
    END LOOP;

    DELETE FROM public.entity_bank_accounts ba
    WHERE ba.entity_id = p_entity_id
      AND ba.tenant_id = v_tenant_id
      AND NOT (ba.id = ANY (v_kept_ids));
END;
$$;

-- Patch save_entity_profile_core to persist logo_url
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
            logo_url,
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
            NULLIF(btrim(p_entity ->> 'logo_url'), ''),
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
            logo_url = NULLIF(btrim(p_entity ->> 'logo_url'), ''),
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

REVOKE ALL ON FUNCTION public.save_entity_bank_accounts(UUID, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_entity_bank_accounts(UUID, JSONB) TO authenticated;

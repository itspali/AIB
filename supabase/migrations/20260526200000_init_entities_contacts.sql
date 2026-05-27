-- ====================================================================
-- AIB SMART ERP - COMMERCIAL PARTNERS & CONTACTS (Milestone 2)
-- ====================================================================
-- Unified entities table (CUSTOMER / SUPPLIER / MUTUAL_PARTNER split at UI)
-- Subsidiary entity_contacts with explicit department + job_title columns
-- Configurable role grants via tenants.metadata_json.entities_access
-- ====================================================================

-- 1. ENUM TYPES
CREATE TYPE entity_commercial_type AS ENUM ('CUSTOMER', 'SUPPLIER', 'MUTUAL_PARTNER');

CREATE TYPE tax_treatment_type AS ENUM (
    'REGULAR_B2B',
    'COMPOSITION',
    'UNREGISTERED_B2C',
    'SEZ_DEVELOPER',
    'OVERSEAS_EXPORT',
    'DEEMED_EXPORT'
);

-- 2. CONFIGURABLE ENTITY PERMISSION HELPER
-- Default entities_access (when tenants.metadata_json.entities_access is absent):
--   OWNER:   select, insert, update, delete
--   ADMIN:   select, insert, update, delete
--   MANAGER: select, insert, update
--   STAFF:   select only
CREATE OR REPLACE FUNCTION private.role_has_entity_permission(p_operation TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_role user_role;
    v_tenant_id UUID;
    v_granted BOOLEAN;
BEGIN
    v_tenant_id := private.current_tenant_id();
    v_role := private.current_user_role();

    IF v_tenant_id IS NULL OR v_role IS NULL THEN
        RETURN FALSE;
    END IF;

    IF v_role = 'OWNER' THEN
        RETURN TRUE;
    END IF;

    SELECT COALESCE(
        (t.metadata_json -> 'entities_access' -> v_role::text ->> p_operation)::boolean,
        CASE v_role
            WHEN 'ADMIN' THEN p_operation IN ('select', 'insert', 'update', 'delete')
            WHEN 'MANAGER' THEN p_operation IN ('select', 'insert', 'update')
            WHEN 'STAFF' THEN p_operation = 'select'
            ELSE FALSE
        END
    )
    INTO v_granted
    FROM public.tenants t
    WHERE t.id = v_tenant_id;

    RETURN COALESCE(v_granted, FALSE);
END;
$$;

-- 3. ENTITIES TABLE
CREATE TABLE public.entities (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id                   UUID NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,

    name                        TEXT NOT NULL,
    legal_name                  TEXT,
    code                        VARCHAR(30),
    type                        entity_commercial_type NOT NULL,

    tax_registration_number     TEXT,
    tax_treatment               tax_treatment_type NOT NULL DEFAULT 'REGULAR_B2B',

    base_currency_override      VARCHAR(3),
    credit_limit                NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
    current_balance             NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
    payment_terms_days          INTEGER NOT NULL DEFAULT 0,

    billing_address_line1       TEXT,
    billing_address_line2       TEXT,
    billing_city                TEXT,
    billing_state               TEXT,
    billing_zip_postal          VARCHAR(20),
    billing_country_code        VARCHAR(2),

    shipping_address_line1      TEXT,
    shipping_address_line2      TEXT,
    shipping_city               TEXT,
    shipping_state              TEXT,
    shipping_zip_postal         VARCHAR(20),
    shipping_country_code       VARCHAR(2),

    incoterms_code              VARCHAR(3),
    default_shipping_method     TEXT,

    company_email               TEXT,
    company_phone               VARCHAR(30),
    website_url                 TEXT,
    internal_notes              TEXT,
    custom_fields               JSONB NOT NULL DEFAULT '{}'::jsonb,

    is_active                   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT entities_base_currency_override_uppercase_chk
        CHECK (
            base_currency_override IS NULL
            OR base_currency_override = upper(base_currency_override)
        ),
    CONSTRAINT entities_tax_registration_required_chk
        CHECK (
            tax_treatment IN ('UNREGISTERED_B2C', 'OVERSEAS_EXPORT')
            OR tax_registration_number IS NOT NULL
        ),
    CONSTRAINT entities_credit_limit_non_negative_chk
        CHECK (credit_limit >= 0),
    CONSTRAINT entities_company_email_lowercase_chk
        CHECK (company_email IS NULL OR company_email = lower(company_email)),
    CONSTRAINT entities_incoterms_code_length_chk
        CHECK (incoterms_code IS NULL OR char_length(incoterms_code) = 3),
    CONSTRAINT entities_tenant_code_unique
        UNIQUE (tenant_id, code)
);

CREATE UNIQUE INDEX entities_tenant_id_id_unique
    ON public.entities (tenant_id, id);

CREATE INDEX entities_tenant_id_type_idx
    ON public.entities (tenant_id, type);

CREATE INDEX entities_tenant_id_is_active_idx
    ON public.entities (tenant_id, is_active);

-- 4. ENTITY CONTACTS TABLE
CREATE TABLE public.entity_contacts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
    entity_id       UUID NOT NULL REFERENCES public.entities (id) ON DELETE CASCADE,

    first_name      TEXT NOT NULL,
    last_name       TEXT NOT NULL,
    email           TEXT,
    phone_number    VARCHAR(30),
    department      TEXT,
    job_title       TEXT,

    is_primary      BOOLEAN NOT NULL DEFAULT FALSE,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,

    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT entity_contacts_email_lowercase_chk
        CHECK (email IS NULL OR email = lower(email))
);

ALTER TABLE public.entity_contacts
    ADD CONSTRAINT entity_contacts_entity_tenant_fk
    FOREIGN KEY (tenant_id, entity_id)
    REFERENCES public.entities (tenant_id, id)
    ON DELETE CASCADE;

CREATE UNIQUE INDEX entity_contacts_one_primary_per_entity
    ON public.entity_contacts (entity_id)
    WHERE is_primary = TRUE AND is_active = TRUE;

CREATE INDEX entity_contacts_tenant_id_entity_id_idx
    ON public.entity_contacts (tenant_id, entity_id);

-- 5. updated_at TRIGGERS (reuse public.set_updated_at from Milestone 1)
CREATE TRIGGER entities_set_updated_at
    BEFORE UPDATE ON public.entities
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER entity_contacts_set_updated_at
    BEFORE UPDATE ON public.entity_contacts
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

-- 6. ROW-LEVEL SECURITY — entities
ALTER TABLE public.entities ENABLE ROW LEVEL SECURITY;

CREATE POLICY entities_select_tenant
    ON public.entities
    FOR SELECT
    TO authenticated
    USING (
        tenant_id = private.current_tenant_id()
        AND private.role_has_entity_permission('select')
    );

CREATE POLICY entities_insert_tenant
    ON public.entities
    FOR INSERT
    TO authenticated
    WITH CHECK (
        tenant_id = private.current_tenant_id()
        AND private.role_has_entity_permission('insert')
    );

CREATE POLICY entities_update_tenant
    ON public.entities
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

CREATE POLICY entities_delete_tenant
    ON public.entities
    FOR DELETE
    TO authenticated
    USING (
        tenant_id = private.current_tenant_id()
        AND private.role_has_entity_permission('delete')
    );

-- 7. ROW-LEVEL SECURITY — entity_contacts
ALTER TABLE public.entity_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY entity_contacts_select
    ON public.entity_contacts
    FOR SELECT
    TO authenticated
    USING (
        tenant_id = private.current_tenant_id()
        AND private.role_has_entity_permission('select')
    );

CREATE POLICY entity_contacts_insert
    ON public.entity_contacts
    FOR INSERT
    TO authenticated
    WITH CHECK (
        tenant_id = private.current_tenant_id()
        AND private.role_has_entity_permission('insert')
    );

CREATE POLICY entity_contacts_update
    ON public.entity_contacts
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

CREATE POLICY entity_contacts_delete
    ON public.entity_contacts
    FOR DELETE
    TO authenticated
    USING (
        tenant_id = private.current_tenant_id()
        AND private.role_has_entity_permission('delete')
    );

-- 8. SCHEMA GRANTS
GRANT EXECUTE ON FUNCTION private.role_has_entity_permission(TEXT) TO authenticated;

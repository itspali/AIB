-- ====================================================================
-- AIB SMART ERP - SYSTEM MASTER ENGINE: GLOBAL TENANT CORE PROFILE
-- ====================================================================

-- 1. CORE CONFIGURATION ENUMS
CREATE TYPE tenant_account_status AS ENUM ('TRIAL', 'ACTIVE', 'PAST_DUE', 'SUSPENDED');
CREATE TYPE tenant_onboarding_source AS ENUM ('DIRECT_SAAS', 'PARTNER_REFERRAL', 'SALES_OUTREACH', 'MARKETPLACE_INTEGRATION');
CREATE TYPE tenant_onboarding_status AS ENUM ('ACCOUNT_CREATED', 'ORGANIZATION_CONFIGURED', 'DATABASE_SEEDED', 'COMPLIANCE_VERIFIED', 'GO_LIVE_READY');

-- 2. EXHAUSTIVE MULTI-TENANT IDENTITY & POLICY CONTROL BRAIN
CREATE TABLE tenants (
    -- --- System Keys & Identity Vectors ---
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,                             -- Primary Display Designation (e.g., 'AIB Global')
    legal_name TEXT,                                -- Formally Registered Corporate Title
    trade_name TEXT,                                -- Public Brand / Doing-Business-As (DBA) Profile
    logo_url TEXT,                                  -- Global Asset Storage Link for UI and Printed Documents
    
    -- --- Global Communication Routing Channels ---
    primary_email TEXT NOT NULL,                    -- Root System Administrative Alert Router
    primary_phone VARCHAR(30) NOT NULL,             -- Primary Corporate Identity Contact Line
    secondary_phone VARCHAR(30),
    website_url TEXT,
    
    -- --- Lifecycle Platform Account Metrics ---
    status tenant_account_status DEFAULT 'TRIAL',
    is_active BOOLEAN DEFAULT TRUE,
    
    -- --- Acquisition, Activation & Lifecycle Tracking Analytics ---
    onboarding_source tenant_onboarding_source DEFAULT 'DIRECT_SAAS',
    onboarding_status tenant_onboarding_status DEFAULT 'ACCOUNT_CREATED',
    created_by_user_id UUID,                        -- Permanent ID signature of the system account creator
    metadata_json JSONB DEFAULT '{}'::jsonb,         -- Dynamic configuration maps tracking referral payloads
    
    -- --- Global Localization & Compliance Infrastructure ---
    base_currency VARCHAR(3) DEFAULT 'USD',         -- System Base Ledger Consolidation Currency Code (ISO 4217)
    tax_identifier VARCHAR(50),                     -- Corporate Tax Registration Id (VAT, GST, EIN)
    legal_registration_number TEXT,                 -- Government Incorporation Certificate Identification
    fiscal_year_start_month SMALLINT DEFAULT 1      -- Baseline month configuration offset for accounting loops (1 to 12)
        CHECK (fiscal_year_start_month BETWEEN 1 AND 12),
    
    -- --- Corporate Legal Registration / Billing Address Matrix ---
    -- Shipping parameters are dropped; fulfillment tracks downstream via the locations system.
    billing_address_line1 TEXT,
    billing_address_line2 TEXT,
    billing_city TEXT,
    billing_state TEXT,
    billing_zip_postal VARCHAR(20),
    billing_country_code VARCHAR(2),                -- ISO 3166-1 alpha-2 Legal Framework parameters
    
    -- --- Smart Automated Transaction Numbering Sequences ---
    -- Manages automated document IDs cleanly at the business boundary:
    -- { "PO": {"prefix": "PO-2026-", "digits": 5, "current": 1}, "INV": {"prefix": "INV-", "digits": 6, "current": 420} }
    naming_sequences JSONB DEFAULT '{}'::jsonb,
    
    -- --- Deep Financial Accounting Governance Controls ---
    -- Declares structural constraint flags system-wide:
    -- { "inventory_valuation_method": "FIFO", "allow_negative_inventory": false, "multi_currency_enabled": true }
    accounting_config JSONB DEFAULT '{
        "inventory_valuation_method": "FIFO",
        "allow_negative_inventory": false,
        "multi_currency_enabled": true,
        "credit_control_enforcement": "STRICT"
    }'::jsonb,
    
    -- --- Deep Manufacturing & WIP Operations Controls ---
    -- Guides product configuration recipes and processing steps:
    -- { "auto_backflush_components": true, "wip_variance_account_code": "MFG-VAR-001" }
    manufacturing_config JSONB DEFAULT '{
        "auto_backflush_components": true,
        "wip_variance_account_code": "MFG-VAR-001"
    }'::jsonb,

    -- --- Multi-Location & Regional HQ Topology Controls ---
    -- Orchestrates location mapping behavior ahead of the physical layer layout:
    -- { "multi_location_enabled": true, "central_hq_location_id": null, "regional_hqs_enabled": false }
    location_governance_config JSONB DEFAULT '{
        "multi_location_enabled": true,
        "central_hq_location_id": null,
        "regional_hqs_enabled": false,
        "consensual_stock_transfers": true
    }'::jsonb,
    
    -- --- System Lifecycle Audit Timestamps ---
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. ENABLE ROW-LEVEL SECURITY ENFORCEMENT
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;

-- 4. SINGLE-TENANT ROW SECURITY ISOLATION BOUNDARY POLICY
-- Automatically evaluates session authentication parameters to sandbox incoming data traffic cleanly
CREATE POLICY tenant_isolation_policy ON tenants 
    FOR ALL 
    USING (id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid);

-- ====================================================================
-- USER IDENTITY & RBAC (Milestone 1)
-- Full triggers, RLS policies, and private helpers live in:
--   supabase/migrations/20260526100000_init_users_rbac.sql
-- ====================================================================

CREATE TYPE user_role AS ENUM ('OWNER', 'ADMIN', 'MANAGER', 'STAFF');

CREATE TABLE users (
    id                      UUID PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
    tenant_id               UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
    role                    user_role NOT NULL DEFAULT 'STAFF',
    assigned_location_id    UUID,

    first_name              TEXT NOT NULL,
    last_name               TEXT NOT NULL,
    email                   TEXT NOT NULL,
    phone_number            VARCHAR(30),
    avatar_url              TEXT,
    job_title               TEXT,

    is_active               BOOLEAN NOT NULL DEFAULT TRUE,
    last_login_at           TIMESTAMPTZ,
    metadata_json           JSONB NOT NULL DEFAULT '{}'::jsonb,

    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT users_email_lowercase_chk
        CHECK (email = lower(email)),
    CONSTRAINT users_role_location_scope_chk
        CHECK (
            (role IN ('OWNER', 'ADMIN') AND assigned_location_id IS NULL)
            OR
            (role IN ('MANAGER', 'STAFF') AND assigned_location_id IS NOT NULL)
        ),
    CONSTRAINT users_tenant_email_unique
        UNIQUE (tenant_id, email)
);

ALTER TABLE users
    ADD CONSTRAINT users_assigned_location_tenant_fk
    FOREIGN KEY (tenant_id, assigned_location_id)
    REFERENCES tenant_locations (tenant_id, id)
    ON DELETE SET NULL
    DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE tenants
    ADD CONSTRAINT tenants_created_by_user_id_fk
    FOREIGN KEY (created_by_user_id) REFERENCES users (id) ON DELETE SET NULL;

-- ====================================================================
-- COMMERCIAL PARTNERS & CONTACTS (Milestone 2)
-- Full triggers, RLS policies, and private helpers live in:
--   supabase/migrations/20260526200000_init_entities_contacts.sql
-- Delta alignments (phone split, frozen blueprint):
--   supabase/migrations/20260527100000_create_entities_and_contacts.sql
-- ====================================================================

CREATE TYPE entity_commercial_type AS ENUM ('CUSTOMER', 'SUPPLIER', 'MUTUAL_PARTNER');

CREATE TYPE tax_treatment_type AS ENUM (
    'REGULAR_B2B',
    'COMPOSITION',
    'UNREGISTERED_B2C',
    'SEZ_DEVELOPER',
    'OVERSEAS_EXPORT',
    'DEEMED_EXPORT'
);

CREATE TABLE entities (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id                   UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,

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
    company_phone               TEXT,
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

CREATE TABLE entity_contacts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
    entity_id       UUID NOT NULL REFERENCES entities (id) ON DELETE CASCADE,

    first_name      TEXT NOT NULL,
    last_name       TEXT,
    email           TEXT,
    phone           TEXT,
    mobile          TEXT,
    whatsapp_number TEXT,
    department      TEXT,
    job_title       TEXT,

    is_primary      BOOLEAN NOT NULL DEFAULT FALSE,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,

    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT entity_contacts_email_lowercase_chk
        CHECK (email IS NULL OR email = lower(email))
);

ALTER TABLE entity_contacts
    ADD CONSTRAINT entity_contacts_entity_tenant_fk
    FOREIGN KEY (tenant_id, entity_id)
    REFERENCES entities (tenant_id, id)
    ON DELETE CASCADE;

-- ====================================================================
-- MASTER PRODUCT & INVENTORY CATALOG (Milestone 3)
-- Full triggers, RLS policies, anon storefront policies, and guards live in:
--   supabase/migrations/20260527123000_create_master_product_and_inventory_catalog.sql
-- ====================================================================

CREATE TYPE item_classification_type AS ENUM (
    'RAW_MATERIAL', 'WIP_ASSEMBLY', 'FINISHED_GOOD', 'SERVICE', 'KIT_BUNDLE'
);

CREATE TYPE storefront_channel_type AS ENUM (
    'B2C_ECOMMERCE', 'B2B_PORTAL', 'MARKETPLACE_FEED', 'PHYSICAL_POS'
);

CREATE TYPE inventory_transaction_type AS ENUM (
    'PURCHASE_RECEIPT', 'SALES_SHIPMENT', 'PRODUCTION_CONSUMPTION',
    'PRODUCTION_YIELD', 'STOCK_TRANSFER', 'INVENTORY_ADJUSTMENT', 'CYCLE_COUNT_CORRECTION'
);

-- tenant_locations (M3 compliance columns)
-- location_tax_identifier TEXT, tax_registered_name TEXT

CREATE TABLE item_categories (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
    name                TEXT NOT NULL,
    parent_id           UUID REFERENCES item_categories (id) ON DELETE CASCADE,
    attribute_templates JSONB NOT NULL DEFAULT '[]'::jsonb,
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE items (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES tenants (id) ON DELETE RESTRICT,
    category_id             UUID,
    name                    TEXT NOT NULL,
    description             TEXT,
    classification          item_classification_type NOT NULL,
    base_unit_of_measure    TEXT NOT NULL,
    hsn_sac_code            TEXT,
    is_purchasable          BOOLEAN NOT NULL DEFAULT TRUE,
    is_salable              BOOLEAN NOT NULL DEFAULT TRUE,
    has_variants            BOOLEAN NOT NULL DEFAULT FALSE,
    default_tax_category    TEXT NOT NULL DEFAULT 'STANDARD',
    custom_fields           JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_active               BOOLEAN NOT NULL DEFAULT TRUE,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE item_variants (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id             UUID NOT NULL REFERENCES items (id) ON DELETE CASCADE,
    tenant_id           UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
    sku                 TEXT NOT NULL,
    barcode             TEXT,
    variant_attributes  JSONB NOT NULL DEFAULT '{}'::jsonb,
    weight              NUMERIC(15, 4),
    volume              NUMERIC(15, 4),
    length              NUMERIC(15, 4),
    width               NUMERIC(15, 4),
    height              NUMERIC(15, 4),
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, sku)
);

CREATE TABLE storefront_channels (
    id                              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id                       UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
    name                            TEXT NOT NULL,
    channel_type                    storefront_channel_type NOT NULL,
    slug                            TEXT NOT NULL,
    domain_url                      TEXT,
    brand_logo_url                  TEXT,
    brand_favicon_url               TEXT,
    theme_config                    JSONB NOT NULL DEFAULT '{"primary_color": "#4F46E5", "secondary_color": "#10B981", "font_family": "Inter, sans-serif"}'::jsonb,
    inventory_fulfillment_strategy  JSONB NOT NULL DEFAULT '{"fallback_to_all_locations": true}'::jsonb,
    is_active                       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at                      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, slug)
);

CREATE TABLE inventory_ledger (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES tenants (id) ON DELETE RESTRICT,
    item_id                 UUID NOT NULL REFERENCES items (id) ON DELETE RESTRICT,
    variant_id              UUID REFERENCES item_variants (id) ON DELETE RESTRICT,
    location_id             UUID NOT NULL REFERENCES tenant_locations (id) ON DELETE RESTRICT,
    transaction_type        inventory_transaction_type NOT NULL,
    quantity                NUMERIC(15, 4) NOT NULL,
    cost_at_transaction     NUMERIC(15, 4) NOT NULL,
    reference_document      TEXT NOT NULL,
    created_by              UUID NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

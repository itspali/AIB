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
    is_returnable           BOOLEAN NOT NULL DEFAULT TRUE,
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
    length_cm           NUMERIC(8, 2) NOT NULL DEFAULT 0.00,
    width_cm            NUMERIC(8, 2) NOT NULL DEFAULT 0.00,
    height_cm           NUMERIC(8, 2) NOT NULL DEFAULT 0.00,
    dead_weight_kg      NUMERIC(10, 3) NOT NULL DEFAULT 0.000,
    price               NUMERIC(15, 4),
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
    return_policy_id                UUID,
    channel_lifecycle_presets       JSONB NOT NULL DEFAULT '{}'::jsonb,
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

-- Signup bootstrap RPC: see supabase/migrations/20260527180000_create_tenant_signup_initialization.sql

-- ====================================================================
-- PROCUREMENT & CONTROL ENGINE (Milestone 4)
-- Full triggers, RLS policies, and functions live in:
--   supabase/migrations/20260527134500_create_procurement_and_control_registry.sql
-- ====================================================================

CREATE TYPE document_voucher_type AS ENUM (
    'PURCHASE_ORDER', 'GOODS_RECEIPT_NOTE', 'PURCHASE_INVOICE', 'STOCK_TRANSFER',
    'SALES_QUOTATION', 'SALES_ORDER', 'SALES_INVOICE', 'CUSTOMER_PAYMENT', 'SALES_CREDIT_NOTE',
    'GENERAL_LEDGER'
);

CREATE TYPE purchase_document_status AS ENUM (
    'DRAFT', 'PENDING_APPROVAL', 'ISSUED_ACTIVE', 'QC_HOLD',
    'PARTIALLY_FULFILLED', 'FULLY_COMPLETED', 'CANCELLED'
);

CREATE TABLE workspace_control_registry (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
    scope_level             TEXT NOT NULL,
    target_reference_id     UUID,
    registry_key            TEXT NOT NULL,
    configuration_metadata  JSONB NOT NULL DEFAULT '{
        "is_po_mandatory_for_grn": false,
        "is_qc_required_before_stocking": false
    }'::jsonb,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE document_sequences (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
    voucher_type    document_voucher_type NOT NULL,
    prefix          TEXT NOT NULL,
    next_value      INTEGER NOT NULL DEFAULT 1,
    padding_length  INTEGER NOT NULL DEFAULT 5,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, voucher_type, prefix)
);

CREATE TABLE purchase_orders (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES tenants (id) ON DELETE RESTRICT,
    destination_location_id UUID NOT NULL REFERENCES tenant_locations (id) ON DELETE RESTRICT,
    supplier_id             UUID NOT NULL REFERENCES entities (id) ON DELETE RESTRICT,
    voucher_number          TEXT NOT NULL,
    document_status         purchase_document_status NOT NULL DEFAULT 'DRAFT',
    payment_terms_days      INTEGER NOT NULL DEFAULT 0,
    currency_code           VARCHAR(3) NOT NULL DEFAULT 'USD',
    exchange_rate           NUMERIC(15, 4) NOT NULL DEFAULT 1.0000,
    total_gross_amount      NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
    total_tax_amount        NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
    total_net_amount        NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
    custom_fields           JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_by              UUID NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, voucher_number)
);

CREATE TABLE goods_receipts (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES tenants (id) ON DELETE RESTRICT,
    destination_location_id UUID NOT NULL REFERENCES tenant_locations (id) ON DELETE RESTRICT,
    purchase_order_id       UUID REFERENCES purchase_orders (id) ON DELETE SET NULL,
    voucher_number          TEXT NOT NULL,
    is_qc_pending           BOOLEAN NOT NULL DEFAULT FALSE,
    received_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    custom_fields           JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_by              UUID NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, voucher_number)
);

CREATE TABLE purchase_invoices (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES tenants (id) ON DELETE RESTRICT,
    supplier_id             UUID NOT NULL REFERENCES entities (id) ON DELETE RESTRICT,
    purchase_order_id       UUID REFERENCES purchase_orders (id) ON DELETE SET NULL,
    invoice_number_vendor   TEXT NOT NULL,
    system_voucher_number   TEXT NOT NULL,
    tax_treatment           tax_treatment_type NOT NULL DEFAULT 'REGULAR_B2B',
    total_liability_amount  NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
    billing_location_id     UUID NOT NULL REFERENCES tenant_locations (id) ON DELETE RESTRICT,
    is_paid                 BOOLEAN NOT NULL DEFAULT FALSE,
    custom_fields           JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_by              UUID NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, system_voucher_number)
);

-- ====================================================================
-- INVENTORY TRANSFERS & VALUATION (Milestone 5)
-- Full triggers, RLS policies, and functions live in:
--   supabase/migrations/20260527143000_create_inventory_transfers_and_valuation.sql
-- ====================================================================

CREATE TYPE stock_transfer_status AS ENUM (
    'DRAFT', 'PENDING_APPROVAL', 'DISPATCHED_IN_TRANSIT',
    'RECEIPT_DISCREPANCY', 'FULLY_COMPLETED', 'CANCELLED'
);

CREATE TYPE transfer_incident_type AS ENUM (
    'TOLL_TAX', 'BORDER_CHARGES', 'EMERGENCY_MAINTENANCE',
    'DRIVER_ALLOWANCE', 'OTHER_INCIDENTAL'
);

CREATE TABLE stock_transfers (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id                   UUID NOT NULL REFERENCES tenants (id) ON DELETE RESTRICT,
    transfer_number             TEXT NOT NULL,
    source_location_id          UUID NOT NULL REFERENCES tenant_locations (id) ON DELETE RESTRICT,
    destination_location_id     UUID NOT NULL REFERENCES tenant_locations (id) ON DELETE RESTRICT,
    current_status              stock_transfer_status NOT NULL DEFAULT 'DRAFT',
    inter_company_freight_cost  NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
    loading_overhead_cost       NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
    unloading_overhead_cost     NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
    dispatched_at               TIMESTAMPTZ,
    received_at                 TIMESTAMPTZ,
    created_by                  UUID NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, transfer_number)
);

CREATE TABLE stock_transfer_items (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id                   UUID NOT NULL REFERENCES tenants (id) ON DELETE RESTRICT,
    stock_transfer_id           UUID NOT NULL REFERENCES stock_transfers (id) ON DELETE CASCADE,
    item_id                     UUID NOT NULL REFERENCES items (id) ON DELETE RESTRICT,
    variant_id                  UUID REFERENCES item_variants (id) ON DELETE RESTRICT,
    quantity_dispatched         NUMERIC(15, 4) NOT NULL,
    quantity_accepted           NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
    quantity_damaged            NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
    quantity_lost               NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
    source_unit_cost_at_dispatch NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
    allocated_transfer_overhead NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE stock_transfer_incidents (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id                   UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
    stock_transfer_id           UUID NOT NULL REFERENCES stock_transfers (id) ON DELETE CASCADE,
    expense_type                transfer_incident_type NOT NULL,
    amount                      NUMERIC(15, 4) NOT NULL,
    currency_code               VARCHAR(3) NOT NULL DEFAULT 'USD',
    is_billable_to_transporter  BOOLEAN NOT NULL DEFAULT FALSE,
    receipt_document_url        TEXT,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE transfer_discrepancy_claims (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
    stock_transfer_id   UUID NOT NULL REFERENCES stock_transfers (id) ON DELETE CASCADE,
    reported_by         UUID NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
    resolution_notes    TEXT,
    is_settled          BOOLEAN NOT NULL DEFAULT FALSE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE item_valuations (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
    location_id             UUID NOT NULL REFERENCES tenant_locations (id) ON DELETE RESTRICT,
    item_id                 UUID NOT NULL REFERENCES items (id) ON DELETE RESTRICT,
    variant_id              UUID REFERENCES item_variants (id) ON DELETE RESTRICT,
    current_average_cost    NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
    total_quantity_on_hand  NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE inventory_buffer_thresholds (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
    location_id         UUID NOT NULL REFERENCES tenant_locations (id) ON DELETE CASCADE,
    item_id             UUID NOT NULL REFERENCES items (id) ON DELETE CASCADE,
    variant_id          UUID REFERENCES item_variants (id) ON DELETE CASCADE,
    min_stock_level     NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
    max_stock_level     NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
    reorder_point_qty   NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ====================================================================
-- OUTBOUND COMMERCE & OMNICHANNEL (Milestones 6 & 7)
-- Full triggers, RLS policies, and functions live in:
--   supabase/migrations/20260527150000_create_sales_outbound_and_omnichannel_integrations.sql
-- ====================================================================

CREATE TYPE sales_document_status AS ENUM (
    'DRAFT', 'PENDING_APPROVAL', 'CREDIT_HOLD', 'APPROVED_ACTIVE',
    'PARTIALLY_SHIPPED', 'FULLY_COMPLETED', 'CANCELLED'
);

CREATE TYPE sales_fulfillment_status AS ENUM (
    'NOT_FULFILLED', 'PICKING_PACKING', 'DISPATCHED_IN_TRANSIT', 'DELIVERED',
    'RETURNED_PARTIAL', 'RETURNED_FULLY'
);

CREATE TYPE sales_payment_status AS ENUM (
    'UNPAID', 'PARTIALLY_PAID', 'FULLY_PAID', 'REFUNDED'
);

CREATE TYPE gateway_provider_type AS ENUM (
    'STRIPE', 'RAZORPAY', 'PAYPAL', 'INTERNAL_CREDIT', 'BANK_TRANSFER', 'CASH_ON_DELIVERY'
);

CREATE TYPE payment_reconciliation_state AS ENUM (
    'UNRECONCILED', 'WEBHOOK_MATCHED', 'BANK_SETTLED', 'DISPUTED_CHARGEBACK'
);

CREATE TYPE refund_settlement_type AS ENUM (
    'ORIGINAL_PAYMENT_SOURCE', 'STORE_CREDIT_LEDGER'
);

CREATE TYPE shipping_carrier_provider AS ENUM (
    'FEDEX', 'DHL', 'UPS', 'BLUE_DART', 'CUSTOM_FLEET'
);

CREATE TABLE return_policies (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id                   UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
    policy_name                 TEXT NOT NULL,
    return_window_days          INTEGER NOT NULL DEFAULT 30,
    allow_refunds               BOOLEAN NOT NULL DEFAULT TRUE,
    allow_exchanges             BOOLEAN NOT NULL DEFAULT TRUE,
    refund_method_default       refund_settlement_type NOT NULL DEFAULT 'ORIGINAL_PAYMENT_SOURCE',
    restocking_fee_percentage   NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    conditional_rules_json      JSONB NOT NULL DEFAULT '{}'::jsonb,
    requires_manager_approval_past_window BOOLEAN NOT NULL DEFAULT FALSE,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, policy_name)
);

CREATE TABLE sales_quotations (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants (id) ON DELETE RESTRICT,
    customer_id         UUID NOT NULL REFERENCES entities (id) ON DELETE RESTRICT,
    quotation_number    TEXT NOT NULL,
    commercial_status   sales_document_status NOT NULL DEFAULT 'DRAFT',
    valid_until         TIMESTAMPTZ NOT NULL,
    billing_state       TEXT NOT NULL,
    shipping_state      TEXT NOT NULL,
    total_gross_amount  NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
    total_tax_amount    NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
    total_net_amount    NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
    custom_fields       JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_by          UUID NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, quotation_number)
);

CREATE TABLE sales_orders (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES tenants (id) ON DELETE RESTRICT,
    customer_id             UUID NOT NULL REFERENCES entities (id) ON DELETE RESTRICT,
    storefront_channel_id   UUID REFERENCES storefront_channels (id) ON DELETE RESTRICT,
    shipping_location_id    UUID REFERENCES tenant_locations (id) ON DELETE RESTRICT,
    source_quotation_id     UUID REFERENCES sales_quotations (id) ON DELETE SET NULL,
    voucher_number          TEXT NOT NULL,
    commercial_status       sales_document_status NOT NULL DEFAULT 'DRAFT',
    fulfillment_status      sales_fulfillment_status NOT NULL DEFAULT 'NOT_FULFILLED',
    payment_status          sales_payment_status NOT NULL DEFAULT 'UNPAID',
    billing_state           TEXT NOT NULL,
    shipping_state          TEXT NOT NULL,
    total_gross_amount      NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
    total_tax_amount        NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
    total_net_amount        NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
    custom_fields           JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_by              UUID NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, voucher_number)
);

CREATE TABLE sales_invoices (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES tenants (id) ON DELETE RESTRICT,
    customer_id             UUID NOT NULL REFERENCES entities (id) ON DELETE RESTRICT,
    source_order_id         UUID REFERENCES sales_orders (id) ON DELETE SET NULL,
    origin_location_id      UUID NOT NULL REFERENCES tenant_locations (id) ON DELETE RESTRICT,
    invoice_number          TEXT NOT NULL,
    billing_state           TEXT NOT NULL,
    shipping_state          TEXT NOT NULL,
    tax_treatment_applied   TEXT NOT NULL DEFAULT 'IGST',
    total_gross_amount      NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
    total_tax_amount        NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
    total_net_amount        NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
    total_paid_amount       NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
    invoice_payment_status  sales_payment_status NOT NULL DEFAULT 'UNPAID',
    currency_code           VARCHAR(3) NOT NULL DEFAULT 'USD',
    exchange_rate_snapshot  NUMERIC(15, 6) NOT NULL DEFAULT 1.000000,
    custom_fields           JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_by              UUID NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, invoice_number)
);

CREATE TABLE payment_gateway_vouchers (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id                   UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
    sales_order_id              UUID NOT NULL REFERENCES sales_orders (id) ON DELETE RESTRICT,
    sales_invoice_id            UUID REFERENCES sales_invoices (id) ON DELETE SET NULL,
    gateway_provider            TEXT NOT NULL,
    external_transaction_id     TEXT NOT NULL,
    gross_amount_captured       NUMERIC(15, 4) NOT NULL,
    provider_processing_fee     NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
    net_reconciled_amount       NUMERIC(15, 4) GENERATED ALWAYS AS (gross_amount_captured - provider_processing_fee) STORED,
    reconciliation_status       payment_reconciliation_state NOT NULL DEFAULT 'UNRECONCILED',
    raw_webhook_payload         JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, gateway_provider, external_transaction_id)
);

CREATE TABLE sales_shipments (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id                   UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
    sales_order_id              UUID NOT NULL REFERENCES sales_orders (id) ON DELETE RESTRICT,
    origin_location_id          UUID NOT NULL REFERENCES tenant_locations (id) ON DELETE RESTRICT,
    carrier_provider            shipping_carrier_provider NOT NULL,
    tracking_number             TEXT NOT NULL,
    estimated_freight_quote     NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
    actual_carrier_invoice_cost NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
    dispatched_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    delivered_at                TIMESTAMPTZ,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, carrier_provider, tracking_number)
);

CREATE TABLE sales_shipment_packages (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id                   UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
    sales_shipment_id           UUID NOT NULL REFERENCES sales_shipments (id) ON DELETE CASCADE,
    box_identifier              TEXT NOT NULL,
    box_length_cm               NUMERIC(8, 2) NOT NULL,
    box_width_cm                NUMERIC(8, 2) NOT NULL,
    box_height_cm               NUMERIC(8, 2) NOT NULL,
    total_dead_weight_kg        NUMERIC(10, 3) NOT NULL,
    total_volumetric_weight_kg  NUMERIC(10, 3) GENERATED ALWAYS AS ((box_length_cm * box_width_cm * box_height_cm) / 5000.000) STORED,
    billable_weight_kg          NUMERIC(10, 3) GENERATED ALWAYS AS (
        CASE WHEN total_dead_weight_kg >= ((box_length_cm * box_width_cm * box_height_cm) / 5000.000)
        THEN total_dead_weight_kg ELSE ((box_length_cm * box_width_cm * box_height_cm) / 5000.000) END
    ) STORED,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE customer_payments (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants (id) ON DELETE RESTRICT,
    customer_id         UUID NOT NULL REFERENCES entities (id) ON DELETE RESTRICT,
    payment_number      TEXT NOT NULL,
    amount_received     NUMERIC(15, 4) NOT NULL,
    payment_method      gateway_provider_type NOT NULL,
    currency_code       VARCHAR(3) NOT NULL DEFAULT 'USD',
    exchange_rate_at_receipt NUMERIC(15, 6) NOT NULL DEFAULT 1.000000,
    reference_number    TEXT,
    received_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by          UUID NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, payment_number)
);

CREATE TABLE sales_credit_notes (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants (id) ON DELETE RESTRICT,
    customer_id         UUID NOT NULL REFERENCES entities (id) ON DELETE RESTRICT,
    source_invoice_id   UUID REFERENCES sales_invoices (id) ON DELETE SET NULL,
    credit_note_number  TEXT NOT NULL,
    credit_amount       NUMERIC(15, 4) NOT NULL,
    reason              TEXT,
    created_by          UUID NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, credit_note_number)
);

CREATE TABLE sales_returns (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants (id) ON DELETE RESTRICT,
    sales_order_id      UUID NOT NULL REFERENCES sales_orders (id) ON DELETE RESTRICT,
    customer_id         UUID NOT NULL REFERENCES entities (id) ON DELETE RESTRICT,
    return_number       TEXT NOT NULL,
    return_location_id  UUID NOT NULL REFERENCES tenant_locations (id) ON DELETE RESTRICT,
    custom_fields       JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_by          UUID NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, return_number)
);

CREATE TABLE document_approvals (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
    document_type   TEXT NOT NULL,
    document_id     UUID NOT NULL,
    approved_by     UUID NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
    approved_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ====================================================================
-- FINANCIAL ACCOUNTING & LEDGER AUTOMATION (Milestone 8)
-- Full triggers, RLS policies, and functions live in:
--   supabase/migrations/20260527170000_create_financial_accounting_and_ledger_automation.sql
-- ====================================================================

CREATE TYPE account_type_class AS ENUM (
    'ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'
);

CREATE TYPE tax_split_type AS ENUM (
    'INTRA_STATE', 'INTER_STATE', 'EXEMPT_EXPORT'
);

CREATE TABLE accounts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
    account_code    TEXT NOT NULL,
    account_name    TEXT NOT NULL,
    classification  account_type_class NOT NULL,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, account_code)
);

CREATE TABLE tax_rate_registry (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
    tax_component_name      TEXT NOT NULL,
    tax_percentage          NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    active_from_date        TIMESTAMPTZ NOT NULL,
    active_to_date          TIMESTAMPTZ,
    legal_compliance_code   TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, tax_component_name, active_from_date)
);

CREATE TABLE currency_exchange_rates (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id                   UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
    from_currency               VARCHAR(3) NOT NULL,
    to_currency                 VARCHAR(3) NOT NULL,
    conversion_rate             NUMERIC(15, 6) NOT NULL,
    rate_timestamp              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_custom_contract_fixed    BOOLEAN NOT NULL DEFAULT FALSE,
    linked_sales_order_id       UUID REFERENCES sales_orders (id) ON DELETE SET NULL,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE general_ledger_headers (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES tenants (id) ON DELETE RESTRICT,
    voucher_number          TEXT NOT NULL,
    posting_date            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    source_document_type    TEXT NOT NULL,
    source_document_id      UUID NOT NULL,
    narration               TEXT,
    is_manager_backpost     BOOLEAN NOT NULL DEFAULT FALSE,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, voucher_number)
);

CREATE TABLE general_ledger_entries (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants (id) ON DELETE RESTRICT,
    gl_header_id    UUID NOT NULL REFERENCES general_ledger_headers (id) ON DELETE CASCADE,
    account_id      UUID NOT NULL REFERENCES accounts (id) ON DELETE RESTRICT,
    debit_amount    NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
    credit_amount   NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Signup bootstrap RPC: see supabase/migrations/20260527180000_create_tenant_signup_initialization.sql

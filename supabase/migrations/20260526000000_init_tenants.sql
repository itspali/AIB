-- ====================================================================
-- AIB SMART ERP - MASTER DATABASE INITIALIZATION SCHEMA
-- ====================================================================

-- 1. CORE SYSTEM ENUMS
CREATE TYPE tenant_account_status AS ENUM ('TRIAL', 'ACTIVE', 'PAST_DUE', 'SUSPENDED');
CREATE TYPE tenant_onboarding_source AS ENUM ('DIRECT_SAAS', 'PARTNER_REFERRAL', 'SALES_OUTREACH', 'MARKETPLACE_INTEGRATION');
CREATE TYPE tenant_onboarding_status AS ENUM ('ACCOUNT_CREATED', 'ORGANIZATION_CONFIGURED', 'DATABASE_SEEDED', 'COMPLIANCE_VERIFIED', 'GO_LIVE_READY');
CREATE TYPE location_operational_type AS ENUM ('HEAD_OFFICE', 'REGIONAL_HQ', 'WAREHOUSE', 'MANUFACTURING_PLANT', 'RETAIL_OUTLET');

-- 2. GLOBAL TENANT PROFILE CONTROL ENGINE
CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    legal_name TEXT,
    trade_name TEXT,
    logo_url TEXT,
    primary_email TEXT NOT NULL,
    primary_phone VARCHAR(30) NOT NULL,
    secondary_phone VARCHAR(30),
    website_url TEXT,
    status tenant_account_status DEFAULT 'TRIAL',
    is_active BOOLEAN DEFAULT TRUE,
    onboarding_source tenant_onboarding_source DEFAULT 'DIRECT_SAAS',
    onboarding_status tenant_onboarding_status DEFAULT 'ACCOUNT_CREATED',
    created_by_user_id UUID,
    metadata_json JSONB DEFAULT '{}'::jsonb,
    base_currency VARCHAR(3) DEFAULT 'USD',
    tax_identifier VARCHAR(50),
    legal_registration_number TEXT,
    fiscal_year_start_month SMALLINT DEFAULT 1 CHECK (fiscal_year_start_month BETWEEN 1 AND 12),
    billing_address_line1 TEXT,
    billing_address_line2 TEXT,
    billing_city TEXT,
    billing_state TEXT,
    billing_zip_postal VARCHAR(20),
    billing_country_code VARCHAR(2),
    naming_sequences JSONB DEFAULT '{}'::jsonb,
    accounting_config JSONB DEFAULT '{"inventory_valuation_method": "FIFO", "allow_negative_inventory": false, "multi_currency_enabled": true, "credit_control_enforcement": "STRICT"}'::jsonb,
    manufacturing_config JSONB DEFAULT '{"auto_backflush_components": true, "wip_variance_account_code": "MFG-VAR-001"}'::jsonb,
    location_governance_config JSONB DEFAULT '{"multi_location_enabled": true, "central_hq_location_id": null, "regional_hqs_enabled": false, "consensual_stock_transfers": true}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. PHYSICAL OPERATIONAL SPACES & WAREHOUSE TOPOLOGY
CREATE TABLE tenant_locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    parent_location_id UUID REFERENCES tenant_locations(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    code VARCHAR(30) NOT NULL,
    location_type location_operational_type DEFAULT 'WAREHOUSE',
    address_line1 TEXT NOT NULL,
    address_line2 TEXT,
    city TEXT NOT NULL,
    state TEXT NOT NULL,
    zip_postal VARCHAR(20) NOT NULL,
    country_code VARCHAR(2) NOT NULL,
    manager_name TEXT,
    contact_email TEXT,
    contact_phone VARCHAR(30),
    is_stock_holding BOOLEAN DEFAULT TRUE,
    location_meta JSONB DEFAULT '{}'::jsonb,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT unique_tenant_location_code UNIQUE (tenant_id, code)
);

-- 4. ROW-LEVEL SECURITY ENFORCEMENT CONFIGURATIONS
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_policy ON tenants FOR ALL USING (id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid);
CREATE POLICY location_isolation_policy ON tenant_locations FOR ALL USING (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid);
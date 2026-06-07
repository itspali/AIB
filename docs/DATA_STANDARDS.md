# AIB Smart ERP: Core Enterprise Data Standards

This document establishes the absolute architectural data-handling rules for the AIB system. All
database migrations, schema mutations, RPCs, and API handlers must strictly comply with these
standards. Every rule below reflects the conventions already shipped in
[supabase/migrations](../supabase/migrations) (notably
[20260526000000_init_tenants.sql](../supabase/migrations/20260526000000_init_tenants.sql) and
[20260542000000_item_model_foundation.sql](../supabase/migrations/20260542000000_item_model_foundation.sql)).

For **CI deploy safety** (timestamps, view column order, GRANT signatures, pre-push checklist), see
[`SUPABASE_CI_MIGRATION_ERRORS.md`](./SUPABASE_CI_MIGRATION_ERRORS.md).

---

## 1. Naming Standards, Cases & Conventions

- **Tables**: lowercase `snake_case`, **plural** (e.g. `tenants`, `tenant_locations`, `items`,
  `item_categories`, `uoms`, `tax_codes`).
- **Columns**: lowercase `snake_case` (e.g. `onboarding_source`, `base_currency`,
  `billing_country_code`, `standard_cost`).
- **Enums (types & values)**: native Postgres enum types named in `snake_case`
  (e.g. `tenant_account_status`); enum **values** are uppercase `SCREAMING_SNAKE_CASE`
  (e.g. `'ACTIVE'`, `'GO_LIVE_READY'`).
- **Constraints**: name them explicitly where it aids clarity
  (e.g. `CONSTRAINT unique_tenant_location_code UNIQUE (tenant_id, code)`).

---

## 2. Relational Keys, Multi-Tenancy & Null Handling

- **Primary keys**: every table uses `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`. Integer-
  incremented sequencing is **prohibited** for database keys (prevents enumeration and merge
  conflicts).
- **Foreign keys**: also `UUID`, with explicit referential actions
  (e.g. `tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE`,
  `parent_location_id UUID REFERENCES tenant_locations(id) ON DELETE SET NULL`).
- **Tenant isolation**: every operational table must carry a
  `tenant_id UUID NOT NULL REFERENCES tenants(id)` column. (The `tenants` table itself is the root,
  keyed by `id`.)
- **Row-Level Security**: enable RLS on every operational table and enforce tenant scoping. No
  server function or API handler may bypass RLS. The standard predicate is:

  ```sql
  ALTER TABLE <table_name> ENABLE ROW LEVEL SECURITY;

  CREATE POLICY <table_name>_isolation_policy ON <table_name>
    FOR ALL
    USING (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid);
  ```

  (On the `tenants` table the predicate compares against `id` instead of `tenant_id`.)
- **Null handling**: declare columns `NOT NULL` with structural fallback defaults
  (e.g. `DEFAULT '{}'::jsonb`, `DEFAULT 0.0000`, `DEFAULT TRUE`) unless the column records a
  genuinely optional lifecycle property.

---

## 3. System Enumerations

Hardcoded programmatic statuses use native enums with uppercase `SCREAMING_SNAKE_CASE` values. The
canonical enums currently defined are:

**Tenant lifecycle** (`init_tenants.sql`):
- `tenant_account_status`: `'TRIAL'`, `'ACTIVE'`, `'PAST_DUE'`, `'SUSPENDED'`
- `tenant_onboarding_source`: `'DIRECT_SAAS'`, `'PARTNER_REFERRAL'`, `'SALES_OUTREACH'`, `'MARKETPLACE_INTEGRATION'`
- `tenant_onboarding_status`: `'ACCOUNT_CREATED'`, `'ORGANIZATION_CONFIGURED'`, `'DATABASE_SEEDED'`, `'COMPLIANCE_VERIFIED'`, `'GO_LIVE_READY'`
- `location_operational_type`: `'HEAD_OFFICE'`, `'REGIONAL_HQ'`, `'WAREHOUSE'`, `'MANUFACTURING_PLANT'`, `'RETAIL_OUTLET'`

**Item model** (`item_model_foundation.sql`):
- `item_type` (behavioral): `'PHYSICAL'` (goods — stock/variants), `'SERVICE'`, `'DIGITAL'`. UI label for `PHYSICAL` is **Goods**.
- `item_classification_type` (supply-chain / reporting role): `'RAW_MATERIAL'`, `'WIP_ASSEMBLY'`, `'FINISHED_GOOD'`, `'CONSUMABLE'`, `'KIT_BUNDLE'`, `'SERVICE'`, `'PHYSICAL_GOOD'` (legacy — hidden from pickers). Must stay consistent with `item_type` (enforced in app + `save_product_master_profile`).
- `item_status`: `'DRAFT'`, `'ACTIVE'`, `'DISCONTINUED'`, `'ARCHIVED'`
- `item_source`: `'MANUAL'`, `'QUICK_CREATE'`, `'AI'`, `'IMPORT'`
- `item_costing_method`: `'FIFO'`, `'WEIGHTED_AVG'`, `'STANDARD'`
- `item_tracking_mode`: `'NONE'`, `'LOT'`, `'SERIAL'`
- `uom_family`: `'COUNT'`, `'WEIGHT'`, `'LENGTH'`, `'AREA'`, `'VOLUME'`, `'TIME'`
- `tax_code_kind`: `'GST'`, `'VAT'`, `'SALES_TAX'`, `'EXEMPT'`, `'NIL'`, `'ZERO'`
- `item_identifier_type`: `'BARCODE'`, `'EAN13'`, `'UPC'`, `'GTIN'`, `'ISBN'`, `'MPN'`, `'INTERNAL'`, `'OTHER'`

> New enums must follow the same conventions. When adding values, prefer
> `ALTER TYPE ... ADD VALUE IF NOT EXISTS` so migrations stay idempotent.

---

## 4. Financial Metrics & Currency Standards

- **Monetary storage**: currency values must **never** use floating-point types (`FLOAT`/`REAL`)
  due to binary rounding drift. All financial metrics, calculations, purchase costs, selling prices,
  and wholesale rates use **`NUMERIC(15,4)`**.
- **High-precision ratios**: conversion factors and coefficients that are not money may use higher
  precision where justified (e.g. UOM `factor_to_base NUMERIC(20,8)`). This is the **only** exception
  to the `NUMERIC(15,4)` rule, and it never applies to monetary fields.
- **Currency representation**: ISO 4217 alpha-3 strings stored as `VARCHAR(3)`
  (e.g. `USD`, `INR`, `EUR`, `AED`); e.g. `base_currency VARCHAR(3) DEFAULT 'USD'`.

---

## 5. International Localization & Communications

- **Country references**: ISO 3166-1 alpha-2 (two-letter uppercase) stored as `VARCHAR(2)`
  (e.g. `US`, `IN`, `GB`, `DE`); e.g. `billing_country_code VARCHAR(2)`.
- **Phone formatting**: E.164 notation stored as `VARCHAR(30)`
  (e.g. `+12125550123`, `+919876543210`).
- **Email**: stored as lowercase text, validated against native email format at the API/interface
  layer.

---

## 6. Temporal Audit Integrity & Timestamps

- Every table preserves creation and modification offsets.
- Use timezone-aware timestamps with defaults:

  ```sql
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  ```

- Raw timestamps without timezone (`TIMESTAMP WITHOUT TIME ZONE`) are **strictly banned**.

---

## 7. JSONB Configuration Columns

- Structured, evolving configuration is stored in `JSONB` columns with a non-null default object.
- Default to `'{}'::jsonb`, or seed a meaningful shape where the application expects keys, e.g.:

  ```sql
  metadata_json JSONB DEFAULT '{}'::jsonb,
  accounting_config JSONB DEFAULT '{"inventory_valuation_method": "FIFO", "allow_negative_inventory": false, "multi_currency_enabled": true, "credit_control_enforcement": "STRICT"}'::jsonb
  ```

- Keys inside JSONB documents use `snake_case`, and enumerated string values inside them follow the
  same `SCREAMING_SNAKE_CASE` convention as native enums.

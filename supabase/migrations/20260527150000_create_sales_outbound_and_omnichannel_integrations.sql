-- ====================================================================
-- AIB SMART ERP - MILESTONES 6 & 7: OUTBOUND COMMERCE & OMNICHANNEL
-- Migration: 20260527150000_create_sales_outbound_and_omnichannel_integrations.sql
-- ====================================================================
--
-- --------------------------------------------------------------------
-- ARCHITECTURAL DOCUMENTATION (downstream developer alignment)
-- --------------------------------------------------------------------
--
-- TRIPLE-VECTOR ORDER STATE TRACKING (sales_orders):
--   commercial_status  -> DRAFT / CREDIT_HOLD / PARTIALLY_SHIPPED / FULLY_COMPLETED
--   fulfillment_status -> NOT_FULFILLED / PICKING_PACKING / DISPATCHED_IN_TRANSIT / DELIVERED
--   payment_status     -> UNPAID / PARTIALLY_PAID / FULLY_PAID / REFUNDED
--
-- SHIPPING-STATE TAX NEXUS (sales_invoices):
--   origin warehouse state vs customer shipping_state
--   Same state -> tax_treatment_applied = 'CGST_SGST'
--   Different   -> tax_treatment_applied = 'IGST'
--
-- THREE-TIER PAYMENT GATEWAY FLOW:
--   payment_gateway_vouchers  -> gross capture - provider fee = net_reconciled (generated)
--   customer_payments         -> cash receipt voucher
--   payment_applications      -> allocate receipts to invoices; sync AR balance
--
-- CREDIT LOCK THRESHOLDS (sales_orders BEFORE INSERT/UPDATE):
--   projected_debt = entities.current_balance + order.total_net_amount
--   BLOCK mode -> RAISE EXCEPTION; HOLD mode -> commercial_status = CREDIT_HOLD
--
-- RETURN POLICY CONDITIONAL GATES (sales_returns / sales_return_items):
--   Channel return_policy_id -> conditional_rules_json enforcement
--   Blocks: non-returnable items, promo codes, excessive discounts, expired window
--   Manager override via sales_returns.custom_fields.manager_override_token
--
-- IATA VOLUMETRIC WEIGHT (sales_shipment_packages):
--   total_volumetric_weight_kg = (L x W x H) / 5000.000
--   billable_weight_kg = MAX(dead_weight, volumetric_weight)
--
-- COGS INVENTORY LEDGER DISPATCH (sales_shipment_items AFTER INSERT):
--   Reads item_valuations.current_average_cost at origin_location
--   Posts SALES_SHIPMENT negative qty to append-only inventory_ledger
--
-- ====================================================================

-- --------------------------------------------------------------------
-- 1. GLOBAL ENUMS & DOCUMENT VOUCHER EXTENSIONS
-- --------------------------------------------------------------------
ALTER TYPE public.document_voucher_type ADD VALUE IF NOT EXISTS 'SALES_QUOTATION';
ALTER TYPE public.document_voucher_type ADD VALUE IF NOT EXISTS 'SALES_ORDER';
ALTER TYPE public.document_voucher_type ADD VALUE IF NOT EXISTS 'SALES_INVOICE';
ALTER TYPE public.document_voucher_type ADD VALUE IF NOT EXISTS 'CUSTOMER_PAYMENT';
ALTER TYPE public.document_voucher_type ADD VALUE IF NOT EXISTS 'SALES_CREDIT_NOTE';

CREATE TYPE sales_document_status AS ENUM (
    'DRAFT',
    'PENDING_APPROVAL',
    'CREDIT_HOLD',
    'APPROVED_ACTIVE',
    'PARTIALLY_SHIPPED',
    'FULLY_COMPLETED',
    'CANCELLED'
);

CREATE TYPE sales_fulfillment_status AS ENUM (
    'NOT_FULFILLED',
    'PICKING_PACKING',
    'DISPATCHED_IN_TRANSIT',
    'DELIVERED',
    'RETURNED_PARTIAL',
    'RETURNED_FULLY'
);

CREATE TYPE sales_payment_status AS ENUM (
    'UNPAID',
    'PARTIALLY_PAID',
    'FULLY_PAID',
    'REFUNDED'
);

CREATE TYPE gateway_provider_type AS ENUM (
    'STRIPE',
    'RAZORPAY',
    'PAYPAL',
    'INTERNAL_CREDIT',
    'BANK_TRANSFER',
    'CASH_ON_DELIVERY'
);

CREATE TYPE payment_reconciliation_state AS ENUM (
    'UNRECONCILED',
    'WEBHOOK_MATCHED',
    'BANK_SETTLED',
    'DISPUTED_CHARGEBACK'
);

CREATE TYPE refund_settlement_type AS ENUM (
    'ORIGINAL_PAYMENT_SOURCE',
    'STORE_CREDIT_LEDGER'
);

CREATE TYPE shipping_carrier_provider AS ENUM (
    'FEDEX',
    'DHL',
    'UPS',
    'BLUE_DART',
    'CUSTOM_FLEET'
);

-- --------------------------------------------------------------------
-- 2. CATALOG & CHANNEL ALTERATIONS (pass A)
-- --------------------------------------------------------------------
ALTER TABLE public.items
    ADD COLUMN IF NOT EXISTS is_returnable BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE public.item_variants
    ADD COLUMN IF NOT EXISTS length_cm NUMERIC(8, 2) NOT NULL DEFAULT 0.00;

ALTER TABLE public.item_variants
    ADD COLUMN IF NOT EXISTS width_cm NUMERIC(8, 2) NOT NULL DEFAULT 0.00;

ALTER TABLE public.item_variants
    ADD COLUMN IF NOT EXISTS height_cm NUMERIC(8, 2) NOT NULL DEFAULT 0.00;

ALTER TABLE public.item_variants
    ADD COLUMN IF NOT EXISTS dead_weight_kg NUMERIC(10, 3) NOT NULL DEFAULT 0.000;

ALTER TABLE public.storefront_channels
    ADD COLUMN IF NOT EXISTS channel_lifecycle_presets JSONB NOT NULL DEFAULT '{}'::jsonb;

-- --------------------------------------------------------------------
-- 3. return_policies
-- --------------------------------------------------------------------
CREATE TABLE public.return_policies (
    id                                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id                           UUID NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
    policy_name                         TEXT NOT NULL,
    return_window_days                  INTEGER NOT NULL DEFAULT 30,
    allow_refunds                       BOOLEAN NOT NULL DEFAULT TRUE,
    allow_exchanges                     BOOLEAN NOT NULL DEFAULT TRUE,
    refund_method_default               refund_settlement_type NOT NULL DEFAULT 'ORIGINAL_PAYMENT_SOURCE',
    restocking_fee_percentage           NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    conditional_rules_json              JSONB NOT NULL DEFAULT '{
        "block_returns_on_promo_codes": true,
        "max_discount_percentage_allowed_for_return": 20.00,
        "block_returns_on_bundle_components": true
    }'::jsonb,
    requires_manager_approval_past_window BOOLEAN NOT NULL DEFAULT FALSE,
    created_at                          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT return_policies_tenant_name_unique
        UNIQUE (tenant_id, policy_name),
    CONSTRAINT return_policies_window_positive_chk
        CHECK (return_window_days >= 0),
    CONSTRAINT return_policies_restocking_fee_non_negative_chk
        CHECK (restocking_fee_percentage >= 0)
);

CREATE UNIQUE INDEX return_policies_tenant_id_id_unique
    ON public.return_policies (tenant_id, id);

-- pass B: channel return policy FK
ALTER TABLE public.storefront_channels
    ADD COLUMN IF NOT EXISTS return_policy_id UUID;

ALTER TABLE public.storefront_channels
    ADD CONSTRAINT storefront_channels_return_policy_fk
    FOREIGN KEY (return_policy_id)
    REFERENCES public.return_policies (id)
    ON DELETE SET NULL;

-- --------------------------------------------------------------------
-- 4. sales_quotations (header + lines)
-- --------------------------------------------------------------------
CREATE TABLE public.sales_quotations (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES public.tenants (id) ON DELETE RESTRICT,
    customer_id             UUID NOT NULL REFERENCES public.entities (id) ON DELETE RESTRICT,
    quotation_number        TEXT NOT NULL,
    commercial_status       sales_document_status NOT NULL DEFAULT 'DRAFT',
    valid_until             TIMESTAMPTZ NOT NULL,
    billing_state           TEXT NOT NULL,
    shipping_state          TEXT NOT NULL,
    total_gross_amount      NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
    total_tax_amount        NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
    total_net_amount        NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
    custom_fields           JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_by              UUID NOT NULL REFERENCES public.users (id) ON DELETE RESTRICT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT sales_quotations_tenant_number_unique
        UNIQUE (tenant_id, quotation_number),
    CONSTRAINT sales_quotations_valid_until_future_chk
        CHECK (valid_until > created_at)
);

CREATE UNIQUE INDEX sales_quotations_tenant_id_id_unique
    ON public.sales_quotations (tenant_id, id);

ALTER TABLE public.sales_quotations
    ADD CONSTRAINT sales_quotations_customer_tenant_fk
    FOREIGN KEY (tenant_id, customer_id)
    REFERENCES public.entities (tenant_id, id)
    ON DELETE RESTRICT;

CREATE TABLE public.sales_quotation_items (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES public.tenants (id) ON DELETE RESTRICT,
    sales_quotation_id      UUID NOT NULL REFERENCES public.sales_quotations (id) ON DELETE CASCADE,
    item_id                 UUID NOT NULL REFERENCES public.items (id) ON DELETE RESTRICT,
    variant_id              UUID REFERENCES public.item_variants (id) ON DELETE RESTRICT,
    quantity_quoted         NUMERIC(15, 4) NOT NULL,
    unit_price_selling      NUMERIC(15, 4) NOT NULL,
    discount_percentage     NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    discount_amount         NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
    line_tax_amount         NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
    line_total_gross        NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT sales_quotation_items_quantity_positive_chk
        CHECK (quantity_quoted > 0),
    CONSTRAINT sales_quotation_items_unit_price_non_negative_chk
        CHECK (unit_price_selling >= 0)
);

CREATE UNIQUE INDEX sales_quotation_items_tenant_id_id_unique
    ON public.sales_quotation_items (tenant_id, id);

ALTER TABLE public.sales_quotation_items
    ADD CONSTRAINT sales_quotation_items_quotation_tenant_fk
    FOREIGN KEY (tenant_id, sales_quotation_id)
    REFERENCES public.sales_quotations (tenant_id, id)
    ON DELETE CASCADE;

ALTER TABLE public.sales_quotation_items
    ADD CONSTRAINT sales_quotation_items_item_tenant_fk
    FOREIGN KEY (tenant_id, item_id)
    REFERENCES public.items (tenant_id, id)
    ON DELETE RESTRICT;

ALTER TABLE public.sales_quotation_items
    ADD CONSTRAINT sales_quotation_items_variant_tenant_fk
    FOREIGN KEY (tenant_id, variant_id)
    REFERENCES public.item_variants (tenant_id, id)
    ON DELETE RESTRICT;

-- --------------------------------------------------------------------
-- 5. sales_orders (header + lines)
-- --------------------------------------------------------------------
CREATE TABLE public.sales_orders (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES public.tenants (id) ON DELETE RESTRICT,
    customer_id             UUID NOT NULL REFERENCES public.entities (id) ON DELETE RESTRICT,
    storefront_channel_id   UUID REFERENCES public.storefront_channels (id) ON DELETE RESTRICT,
    shipping_location_id    UUID REFERENCES public.tenant_locations (id) ON DELETE RESTRICT,
    source_quotation_id     UUID REFERENCES public.sales_quotations (id) ON DELETE SET NULL,
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
    created_by              UUID NOT NULL REFERENCES public.users (id) ON DELETE RESTRICT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT sales_orders_tenant_voucher_unique
        UNIQUE (tenant_id, voucher_number)
);

CREATE UNIQUE INDEX sales_orders_tenant_id_id_unique
    ON public.sales_orders (tenant_id, id);

ALTER TABLE public.sales_orders
    ADD CONSTRAINT sales_orders_customer_tenant_fk
    FOREIGN KEY (tenant_id, customer_id)
    REFERENCES public.entities (tenant_id, id)
    ON DELETE RESTRICT;

ALTER TABLE public.sales_orders
    ADD CONSTRAINT sales_orders_channel_tenant_fk
    FOREIGN KEY (tenant_id, storefront_channel_id)
    REFERENCES public.storefront_channels (tenant_id, id)
    ON DELETE RESTRICT;

ALTER TABLE public.sales_orders
    ADD CONSTRAINT sales_orders_shipping_location_tenant_fk
    FOREIGN KEY (tenant_id, shipping_location_id)
    REFERENCES public.tenant_locations (tenant_id, id)
    ON DELETE RESTRICT;

ALTER TABLE public.sales_orders
    ADD CONSTRAINT sales_orders_quotation_tenant_fk
    FOREIGN KEY (tenant_id, source_quotation_id)
    REFERENCES public.sales_quotations (tenant_id, id)
    ON DELETE SET NULL;

CREATE TABLE public.sales_order_items (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES public.tenants (id) ON DELETE RESTRICT,
    sales_order_id          UUID NOT NULL REFERENCES public.sales_orders (id) ON DELETE CASCADE,
    item_id                 UUID NOT NULL REFERENCES public.items (id) ON DELETE RESTRICT,
    variant_id              UUID REFERENCES public.item_variants (id) ON DELETE RESTRICT,
    source_quotation_line_id UUID REFERENCES public.sales_quotation_items (id) ON DELETE SET NULL,
    quantity_ordered        NUMERIC(15, 4) NOT NULL,
    quantity_allocated      NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
    quantity_shipped        NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
    unit_price_selling      NUMERIC(15, 4) NOT NULL,
    discount_percentage     NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    discount_amount         NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
    line_tax_amount         NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
    line_total_gross        NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT sales_order_items_quantity_ordered_positive_chk
        CHECK (quantity_ordered > 0),
    CONSTRAINT sales_order_items_unit_price_non_negative_chk
        CHECK (unit_price_selling >= 0),
    CONSTRAINT sales_order_items_quantities_non_negative_chk
        CHECK (quantity_allocated >= 0 AND quantity_shipped >= 0)
);

CREATE UNIQUE INDEX sales_order_items_tenant_id_id_unique
    ON public.sales_order_items (tenant_id, id);

ALTER TABLE public.sales_order_items
    ADD CONSTRAINT sales_order_items_order_tenant_fk
    FOREIGN KEY (tenant_id, sales_order_id)
    REFERENCES public.sales_orders (tenant_id, id)
    ON DELETE CASCADE;

ALTER TABLE public.sales_order_items
    ADD CONSTRAINT sales_order_items_item_tenant_fk
    FOREIGN KEY (tenant_id, item_id)
    REFERENCES public.items (tenant_id, id)
    ON DELETE RESTRICT;

ALTER TABLE public.sales_order_items
    ADD CONSTRAINT sales_order_items_variant_tenant_fk
    FOREIGN KEY (tenant_id, variant_id)
    REFERENCES public.item_variants (tenant_id, id)
    ON DELETE RESTRICT;

-- --------------------------------------------------------------------
-- 6. sales_invoices (header + lines)
-- --------------------------------------------------------------------
CREATE TABLE public.sales_invoices (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES public.tenants (id) ON DELETE RESTRICT,
    customer_id             UUID NOT NULL REFERENCES public.entities (id) ON DELETE RESTRICT,
    source_order_id         UUID REFERENCES public.sales_orders (id) ON DELETE SET NULL,
    origin_location_id      UUID NOT NULL REFERENCES public.tenant_locations (id) ON DELETE RESTRICT,
    invoice_number          TEXT NOT NULL,
    billing_state           TEXT NOT NULL,
    shipping_state          TEXT NOT NULL,
    tax_treatment_applied   TEXT NOT NULL DEFAULT 'IGST',
    total_gross_amount      NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
    total_tax_amount        NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
    total_net_amount        NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
    total_paid_amount       NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
    invoice_payment_status  sales_payment_status NOT NULL DEFAULT 'UNPAID',
    custom_fields           JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_by              UUID NOT NULL REFERENCES public.users (id) ON DELETE RESTRICT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT sales_invoices_tenant_number_unique
        UNIQUE (tenant_id, invoice_number)
);

CREATE UNIQUE INDEX sales_invoices_tenant_id_id_unique
    ON public.sales_invoices (tenant_id, id);

ALTER TABLE public.sales_invoices
    ADD CONSTRAINT sales_invoices_customer_tenant_fk
    FOREIGN KEY (tenant_id, customer_id)
    REFERENCES public.entities (tenant_id, id)
    ON DELETE RESTRICT;

ALTER TABLE public.sales_invoices
    ADD CONSTRAINT sales_invoices_order_tenant_fk
    FOREIGN KEY (tenant_id, source_order_id)
    REFERENCES public.sales_orders (tenant_id, id)
    ON DELETE SET NULL;

ALTER TABLE public.sales_invoices
    ADD CONSTRAINT sales_invoices_origin_location_tenant_fk
    FOREIGN KEY (tenant_id, origin_location_id)
    REFERENCES public.tenant_locations (tenant_id, id)
    ON DELETE RESTRICT;

CREATE TABLE public.sales_invoice_items (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES public.tenants (id) ON DELETE RESTRICT,
    sales_invoice_id        UUID NOT NULL REFERENCES public.sales_invoices (id) ON DELETE CASCADE,
    item_id                 UUID NOT NULL REFERENCES public.items (id) ON DELETE RESTRICT,
    variant_id              UUID REFERENCES public.item_variants (id) ON DELETE RESTRICT,
    source_order_line_id    UUID REFERENCES public.sales_order_items (id) ON DELETE SET NULL,
    quantity_invoiced       NUMERIC(15, 4) NOT NULL,
    unit_price_selling      NUMERIC(15, 4) NOT NULL,
    applied_promo_code      TEXT,
    discount_percentage     NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    discount_amount         NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
    line_tax_amount         NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
    line_total_net          NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT sales_invoice_items_quantity_positive_chk
        CHECK (quantity_invoiced > 0),
    CONSTRAINT sales_invoice_items_unit_price_non_negative_chk
        CHECK (unit_price_selling >= 0)
);

CREATE UNIQUE INDEX sales_invoice_items_tenant_id_id_unique
    ON public.sales_invoice_items (tenant_id, id);

ALTER TABLE public.sales_invoice_items
    ADD CONSTRAINT sales_invoice_items_invoice_tenant_fk
    FOREIGN KEY (tenant_id, sales_invoice_id)
    REFERENCES public.sales_invoices (tenant_id, id)
    ON DELETE CASCADE;

ALTER TABLE public.sales_invoice_items
    ADD CONSTRAINT sales_invoice_items_item_tenant_fk
    FOREIGN KEY (tenant_id, item_id)
    REFERENCES public.items (tenant_id, id)
    ON DELETE RESTRICT;

ALTER TABLE public.sales_invoice_items
    ADD CONSTRAINT sales_invoice_items_variant_tenant_fk
    FOREIGN KEY (tenant_id, variant_id)
    REFERENCES public.item_variants (tenant_id, id)
    ON DELETE RESTRICT;

-- --------------------------------------------------------------------
-- 7. payment_gateway_vouchers
-- --------------------------------------------------------------------
CREATE TABLE public.payment_gateway_vouchers (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id                   UUID NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
    sales_order_id              UUID NOT NULL REFERENCES public.sales_orders (id) ON DELETE RESTRICT,
    sales_invoice_id            UUID REFERENCES public.sales_invoices (id) ON DELETE SET NULL,
    gateway_provider            TEXT NOT NULL,
    external_transaction_id     TEXT NOT NULL,
    external_payout_id          TEXT,
    gross_amount_captured       NUMERIC(15, 4) NOT NULL,
    provider_processing_fee     NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
    net_reconciled_amount       NUMERIC(15, 4) GENERATED ALWAYS AS (
        gross_amount_captured - provider_processing_fee
    ) STORED,
    reconciliation_status       payment_reconciliation_state NOT NULL DEFAULT 'UNRECONCILED',
    raw_webhook_payload         JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT payment_gateway_vouchers_tenant_provider_tx_unique
        UNIQUE (tenant_id, gateway_provider, external_transaction_id),
    CONSTRAINT payment_gateway_vouchers_gross_non_negative_chk
        CHECK (gross_amount_captured >= 0),
    CONSTRAINT payment_gateway_vouchers_fee_non_negative_chk
        CHECK (provider_processing_fee >= 0)
);

CREATE UNIQUE INDEX payment_gateway_vouchers_tenant_id_id_unique
    ON public.payment_gateway_vouchers (tenant_id, id);

ALTER TABLE public.payment_gateway_vouchers
    ADD CONSTRAINT payment_gateway_vouchers_order_tenant_fk
    FOREIGN KEY (tenant_id, sales_order_id)
    REFERENCES public.sales_orders (tenant_id, id)
    ON DELETE RESTRICT;

ALTER TABLE public.payment_gateway_vouchers
    ADD CONSTRAINT payment_gateway_vouchers_invoice_tenant_fk
    FOREIGN KEY (tenant_id, sales_invoice_id)
    REFERENCES public.sales_invoices (tenant_id, id)
    ON DELETE SET NULL;

-- --------------------------------------------------------------------
-- 8. sales_shipments + packages + items
-- --------------------------------------------------------------------
CREATE TABLE public.sales_shipments (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id                   UUID NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
    sales_order_id              UUID NOT NULL REFERENCES public.sales_orders (id) ON DELETE RESTRICT,
    origin_location_id          UUID NOT NULL REFERENCES public.tenant_locations (id) ON DELETE RESTRICT,
    carrier_provider            shipping_carrier_provider NOT NULL,
    tracking_number             TEXT NOT NULL,
    shipping_label_url          TEXT,
    estimated_freight_quote     NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
    actual_carrier_invoice_cost NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
    dispatched_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    delivered_at                TIMESTAMPTZ,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT sales_shipments_tenant_carrier_tracking_unique
        UNIQUE (tenant_id, carrier_provider, tracking_number)
);

CREATE UNIQUE INDEX sales_shipments_tenant_id_id_unique
    ON public.sales_shipments (tenant_id, id);

ALTER TABLE public.sales_shipments
    ADD CONSTRAINT sales_shipments_order_tenant_fk
    FOREIGN KEY (tenant_id, sales_order_id)
    REFERENCES public.sales_orders (tenant_id, id)
    ON DELETE RESTRICT;

ALTER TABLE public.sales_shipments
    ADD CONSTRAINT sales_shipments_origin_location_tenant_fk
    FOREIGN KEY (tenant_id, origin_location_id)
    REFERENCES public.tenant_locations (tenant_id, id)
    ON DELETE RESTRICT;

CREATE TABLE public.sales_shipment_packages (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id                   UUID NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
    sales_shipment_id           UUID NOT NULL REFERENCES public.sales_shipments (id) ON DELETE CASCADE,
    box_identifier              TEXT NOT NULL,
    box_length_cm               NUMERIC(8, 2) NOT NULL,
    box_width_cm                NUMERIC(8, 2) NOT NULL,
    box_height_cm               NUMERIC(8, 2) NOT NULL,
    total_dead_weight_kg        NUMERIC(10, 3) NOT NULL,
    total_volumetric_weight_kg  NUMERIC(10, 3) GENERATED ALWAYS AS (
        (box_length_cm * box_width_cm * box_height_cm) / 5000.000
    ) STORED,
    billable_weight_kg          NUMERIC(10, 3) GENERATED ALWAYS AS (
        CASE
            WHEN total_dead_weight_kg >= ((box_length_cm * box_width_cm * box_height_cm) / 5000.000)
            THEN total_dead_weight_kg
            ELSE ((box_length_cm * box_width_cm * box_height_cm) / 5000.000)
        END
    ) STORED,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT sales_shipment_packages_dimensions_positive_chk
        CHECK (
            box_length_cm > 0
            AND box_width_cm > 0
            AND box_height_cm > 0
            AND total_dead_weight_kg >= 0
        )
);

CREATE UNIQUE INDEX sales_shipment_packages_tenant_id_id_unique
    ON public.sales_shipment_packages (tenant_id, id);

ALTER TABLE public.sales_shipment_packages
    ADD CONSTRAINT sales_shipment_packages_shipment_tenant_fk
    FOREIGN KEY (tenant_id, sales_shipment_id)
    REFERENCES public.sales_shipments (tenant_id, id)
    ON DELETE CASCADE;

CREATE TABLE public.sales_shipment_items (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id                   UUID NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
    sales_shipment_package_id   UUID NOT NULL REFERENCES public.sales_shipment_packages (id) ON DELETE CASCADE,
    sales_order_item_id         UUID NOT NULL REFERENCES public.sales_order_items (id) ON DELETE RESTRICT,
    quantity_shipped            NUMERIC(15, 4) NOT NULL,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT sales_shipment_items_quantity_positive_chk
        CHECK (quantity_shipped > 0)
);

CREATE UNIQUE INDEX sales_shipment_items_tenant_id_id_unique
    ON public.sales_shipment_items (tenant_id, id);

ALTER TABLE public.sales_shipment_items
    ADD CONSTRAINT sales_shipment_items_package_tenant_fk
    FOREIGN KEY (tenant_id, sales_shipment_package_id)
    REFERENCES public.sales_shipment_packages (tenant_id, id)
    ON DELETE CASCADE;

ALTER TABLE public.sales_shipment_items
    ADD CONSTRAINT sales_shipment_items_order_item_tenant_fk
    FOREIGN KEY (tenant_id, sales_order_item_id)
    REFERENCES public.sales_order_items (tenant_id, id)
    ON DELETE RESTRICT;

-- --------------------------------------------------------------------
-- 9. customer_payments + payment_applications
-- --------------------------------------------------------------------
CREATE TABLE public.customer_payments (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES public.tenants (id) ON DELETE RESTRICT,
    customer_id         UUID NOT NULL REFERENCES public.entities (id) ON DELETE RESTRICT,
    payment_number      TEXT NOT NULL,
    amount_received     NUMERIC(15, 4) NOT NULL,
    payment_method      gateway_provider_type NOT NULL,
    reference_number    TEXT,
    received_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by          UUID NOT NULL REFERENCES public.users (id) ON DELETE RESTRICT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT customer_payments_tenant_number_unique
        UNIQUE (tenant_id, payment_number),
    CONSTRAINT customer_payments_amount_positive_chk
        CHECK (amount_received > 0)
);

CREATE UNIQUE INDEX customer_payments_tenant_id_id_unique
    ON public.customer_payments (tenant_id, id);

ALTER TABLE public.customer_payments
    ADD CONSTRAINT customer_payments_customer_tenant_fk
    FOREIGN KEY (tenant_id, customer_id)
    REFERENCES public.entities (tenant_id, id)
    ON DELETE RESTRICT;

CREATE TABLE public.payment_applications (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES public.tenants (id) ON DELETE RESTRICT,
    customer_payment_id UUID NOT NULL REFERENCES public.customer_payments (id) ON DELETE CASCADE,
    sales_invoice_id    UUID NOT NULL REFERENCES public.sales_invoices (id) ON DELETE RESTRICT,
    amount_applied      NUMERIC(15, 4) NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT payment_applications_amount_positive_chk
        CHECK (amount_applied > 0)
);

CREATE UNIQUE INDEX payment_applications_tenant_id_id_unique
    ON public.payment_applications (tenant_id, id);

ALTER TABLE public.payment_applications
    ADD CONSTRAINT payment_applications_payment_tenant_fk
    FOREIGN KEY (tenant_id, customer_payment_id)
    REFERENCES public.customer_payments (tenant_id, id)
    ON DELETE CASCADE;

ALTER TABLE public.payment_applications
    ADD CONSTRAINT payment_applications_invoice_tenant_fk
    FOREIGN KEY (tenant_id, sales_invoice_id)
    REFERENCES public.sales_invoices (tenant_id, id)
    ON DELETE RESTRICT;

-- --------------------------------------------------------------------
-- 10. sales_credit_notes
-- --------------------------------------------------------------------
CREATE TABLE public.sales_credit_notes (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES public.tenants (id) ON DELETE RESTRICT,
    customer_id         UUID NOT NULL REFERENCES public.entities (id) ON DELETE RESTRICT,
    source_invoice_id   UUID REFERENCES public.sales_invoices (id) ON DELETE SET NULL,
    credit_note_number  TEXT NOT NULL,
    credit_amount       NUMERIC(15, 4) NOT NULL,
    reason              TEXT,
    created_by          UUID NOT NULL REFERENCES public.users (id) ON DELETE RESTRICT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT sales_credit_notes_tenant_number_unique
        UNIQUE (tenant_id, credit_note_number),
    CONSTRAINT sales_credit_notes_amount_positive_chk
        CHECK (credit_amount > 0)
);

CREATE UNIQUE INDEX sales_credit_notes_tenant_id_id_unique
    ON public.sales_credit_notes (tenant_id, id);

ALTER TABLE public.sales_credit_notes
    ADD CONSTRAINT sales_credit_notes_customer_tenant_fk
    FOREIGN KEY (tenant_id, customer_id)
    REFERENCES public.entities (tenant_id, id)
    ON DELETE RESTRICT;

ALTER TABLE public.sales_credit_notes
    ADD CONSTRAINT sales_credit_notes_invoice_tenant_fk
    FOREIGN KEY (tenant_id, source_invoice_id)
    REFERENCES public.sales_invoices (tenant_id, id)
    ON DELETE SET NULL;

-- --------------------------------------------------------------------
-- 11. sales_returns + items
-- --------------------------------------------------------------------
CREATE TABLE public.sales_returns (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES public.tenants (id) ON DELETE RESTRICT,
    sales_order_id      UUID NOT NULL REFERENCES public.sales_orders (id) ON DELETE RESTRICT,
    sales_invoice_id    UUID REFERENCES public.sales_invoices (id) ON DELETE SET NULL,
    customer_id         UUID NOT NULL REFERENCES public.entities (id) ON DELETE RESTRICT,
    return_number       TEXT NOT NULL,
    return_location_id  UUID NOT NULL REFERENCES public.tenant_locations (id) ON DELETE RESTRICT,
    custom_fields       JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_by          UUID NOT NULL REFERENCES public.users (id) ON DELETE RESTRICT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT sales_returns_tenant_number_unique
        UNIQUE (tenant_id, return_number)
);

CREATE UNIQUE INDEX sales_returns_tenant_id_id_unique
    ON public.sales_returns (tenant_id, id);

ALTER TABLE public.sales_returns
    ADD CONSTRAINT sales_returns_order_tenant_fk
    FOREIGN KEY (tenant_id, sales_order_id)
    REFERENCES public.sales_orders (tenant_id, id)
    ON DELETE RESTRICT;

ALTER TABLE public.sales_returns
    ADD CONSTRAINT sales_returns_invoice_tenant_fk
    FOREIGN KEY (tenant_id, sales_invoice_id)
    REFERENCES public.sales_invoices (tenant_id, id)
    ON DELETE SET NULL;

ALTER TABLE public.sales_returns
    ADD CONSTRAINT sales_returns_customer_tenant_fk
    FOREIGN KEY (tenant_id, customer_id)
    REFERENCES public.entities (tenant_id, id)
    ON DELETE RESTRICT;

ALTER TABLE public.sales_returns
    ADD CONSTRAINT sales_returns_location_tenant_fk
    FOREIGN KEY (tenant_id, return_location_id)
    REFERENCES public.tenant_locations (tenant_id, id)
    ON DELETE RESTRICT;

CREATE TABLE public.sales_return_items (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES public.tenants (id) ON DELETE RESTRICT,
    sales_return_id         UUID NOT NULL REFERENCES public.sales_returns (id) ON DELETE CASCADE,
    sales_invoice_item_id   UUID REFERENCES public.sales_invoice_items (id) ON DELETE SET NULL,
    sales_order_item_id     UUID REFERENCES public.sales_order_items (id) ON DELETE SET NULL,
    item_id                 UUID NOT NULL REFERENCES public.items (id) ON DELETE RESTRICT,
    variant_id              UUID REFERENCES public.item_variants (id) ON DELETE RESTRICT,
    quantity_returned       NUMERIC(15, 4) NOT NULL,
    quantity_restocked        NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
    quantity_damaged          NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT sales_return_items_quantity_returned_positive_chk
        CHECK (quantity_returned > 0),
    CONSTRAINT sales_return_items_split_chk
        CHECK (
            quantity_restocked >= 0
            AND quantity_damaged >= 0
            AND quantity_restocked + quantity_damaged <= quantity_returned
        )
);

CREATE UNIQUE INDEX sales_return_items_tenant_id_id_unique
    ON public.sales_return_items (tenant_id, id);

ALTER TABLE public.sales_return_items
    ADD CONSTRAINT sales_return_items_return_tenant_fk
    FOREIGN KEY (tenant_id, sales_return_id)
    REFERENCES public.sales_returns (tenant_id, id)
    ON DELETE CASCADE;

ALTER TABLE public.sales_return_items
    ADD CONSTRAINT sales_return_items_item_tenant_fk
    FOREIGN KEY (tenant_id, item_id)
    REFERENCES public.items (tenant_id, id)
    ON DELETE RESTRICT;

ALTER TABLE public.sales_return_items
    ADD CONSTRAINT sales_return_items_variant_tenant_fk
    FOREIGN KEY (tenant_id, variant_id)
    REFERENCES public.item_variants (tenant_id, id)
    ON DELETE RESTRICT;

-- --------------------------------------------------------------------
-- 12. document_approvals
-- --------------------------------------------------------------------
CREATE TABLE public.document_approvals (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
    document_type   TEXT NOT NULL,
    document_id     UUID NOT NULL,
    approved_by     UUID NOT NULL REFERENCES public.users (id) ON DELETE RESTRICT,
    approved_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX document_approvals_tenant_document_idx
    ON public.document_approvals (tenant_id, document_type, document_id);

-- --------------------------------------------------------------------
-- 13. CONTROL & HELPER FUNCTIONS
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.get_sales_control_flag(
    p_tenant_id UUID,
    p_flag_key TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_value BOOLEAN;
BEGIN
    SELECT (configuration_metadata ->> p_flag_key)::boolean
    INTO v_value
    FROM public.workspace_control_registry
    WHERE tenant_id = p_tenant_id
      AND scope_level = 'TENANT_GLOBAL'
      AND registry_key = 'SALES_SETTINGS'
      AND target_reference_id IS NULL
    ORDER BY updated_at DESC
    LIMIT 1;

    RETURN COALESCE(v_value, TRUE);
END;
$$;

CREATE OR REPLACE FUNCTION private.get_sales_setting_text(
    p_tenant_id UUID,
    p_flag_key TEXT,
    p_default TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_value TEXT;
BEGIN
    SELECT configuration_metadata ->> p_flag_key
    INTO v_value
    FROM public.workspace_control_registry
    WHERE tenant_id = p_tenant_id
      AND scope_level = 'TENANT_GLOBAL'
      AND registry_key = 'SALES_SETTINGS'
      AND target_reference_id IS NULL
    ORDER BY updated_at DESC
    LIMIT 1;

    RETURN COALESCE(v_value, p_default);
END;
$$;

CREATE OR REPLACE FUNCTION private.get_channel_lifecycle_preset(
    p_channel_id UUID,
    p_preset_key TEXT
)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
    SELECT channel_lifecycle_presets -> p_preset_key
    FROM public.storefront_channels
    WHERE id = p_channel_id;
$$;

CREATE OR REPLACE FUNCTION private.resolve_sales_tax_mode(
    p_origin_state TEXT,
    p_shipping_state TEXT
)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT CASE
        WHEN upper(trim(COALESCE(p_origin_state, ''))) = upper(trim(COALESCE(p_shipping_state, '')))
             AND COALESCE(p_origin_state, '') <> ''
        THEN 'CGST_SGST'
        ELSE 'IGST'
    END;
$$;

-- --------------------------------------------------------------------
-- 14. LINE DISCOUNT GATEKEEPER
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sales_line_discount_gatekeeper()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
BEGIN
    IF NOT private.get_sales_control_flag(NEW.tenant_id, 'allow_line_item_discounts') THEN
        NEW.discount_percentage := 0.00;
        NEW.discount_amount := 0.0000;
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER sales_order_items_discount_gatekeeper
    BEFORE INSERT OR UPDATE ON public.sales_order_items
    FOR EACH ROW
    EXECUTE FUNCTION public.sales_line_discount_gatekeeper();

CREATE TRIGGER sales_invoice_items_discount_gatekeeper
    BEFORE INSERT OR UPDATE ON public.sales_invoice_items
    FOR EACH ROW
    EXECUTE FUNCTION public.sales_line_discount_gatekeeper();

CREATE TRIGGER sales_quotation_items_discount_gatekeeper
    BEFORE INSERT OR UPDATE ON public.sales_quotation_items
    FOR EACH ROW
    EXECUTE FUNCTION public.sales_line_discount_gatekeeper();

-- --------------------------------------------------------------------
-- 15. TRIGGER A — channel presets + fulfillment payment guard
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sales_orders_channel_and_fulfillment_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_presets JSONB;
    v_requires_payment BOOLEAN;
BEGIN
    IF TG_OP = 'INSERT' AND NEW.storefront_channel_id IS NOT NULL THEN
        SELECT channel_lifecycle_presets
        INTO v_presets
        FROM public.storefront_channels
        WHERE id = NEW.storefront_channel_id;

        IF v_presets IS NOT NULL THEN
            NEW.custom_fields := COALESCE(NEW.custom_fields, '{}'::jsonb)
                || jsonb_build_object('channel_lifecycle_presets_applied', v_presets);
        END IF;
    END IF;

    IF TG_OP = 'UPDATE'
       AND OLD.fulfillment_status = 'NOT_FULFILLED'
       AND NEW.fulfillment_status = 'PICKING_PACKING'
    THEN
        v_requires_payment := COALESCE(
            (
                SELECT (channel_lifecycle_presets ->> 'requires_payment_before_fulfillment_release')::boolean
                FROM public.storefront_channels
                WHERE id = NEW.storefront_channel_id
            ),
            (
                SELECT (configuration_metadata ->> 'requires_payment_before_fulfillment_release')::boolean
                FROM public.workspace_control_registry
                WHERE tenant_id = NEW.tenant_id
                  AND scope_level = 'TENANT_GLOBAL'
                  AND registry_key = 'SALES_SETTINGS'
                  AND target_reference_id IS NULL
                ORDER BY updated_at DESC
                LIMIT 1
            ),
            FALSE
        );

        IF v_requires_payment AND NEW.payment_status IS DISTINCT FROM 'FULLY_PAID' THEN
            RAISE EXCEPTION
                'fulfillment blocked: payment_status must be FULLY_PAID before PICKING_PACKING';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER sales_orders_channel_and_fulfillment_guard
    BEFORE INSERT OR UPDATE OF fulfillment_status ON public.sales_orders
    FOR EACH ROW
    EXECUTE FUNCTION public.sales_orders_channel_and_fulfillment_guard();

-- --------------------------------------------------------------------
-- 16. TRIGGER C — credit limit enforcement
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sales_orders_credit_limit_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_credit_limit NUMERIC(15, 4);
    v_current_balance NUMERIC(15, 4);
    v_hold_mode TEXT;
BEGIN
    SELECT credit_limit, current_balance
    INTO v_credit_limit, v_current_balance
    FROM public.entities
    WHERE id = NEW.customer_id;

    IF v_credit_limit > 0
       AND (v_current_balance + NEW.total_net_amount) > v_credit_limit
    THEN
        v_hold_mode := private.get_sales_setting_text(NEW.tenant_id, 'credit_hold_mode', 'HOLD');

        IF v_hold_mode = 'BLOCK' THEN
            RAISE EXCEPTION
                'credit limit exceeded: balance=% order=% limit=%',
                v_current_balance, NEW.total_net_amount, v_credit_limit;
        END IF;

        NEW.commercial_status := 'CREDIT_HOLD';
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER sales_orders_credit_limit_guard
    BEFORE INSERT OR UPDATE OF total_net_amount, customer_id ON public.sales_orders
    FOR EACH ROW
    EXECUTE FUNCTION public.sales_orders_credit_limit_guard();

-- --------------------------------------------------------------------
-- 17. sales_invoices tax nexus + AR posting
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sales_invoices_apply_tax_nexus()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_origin_state TEXT;
BEGIN
    SELECT state
    INTO v_origin_state
    FROM public.tenant_locations
    WHERE id = NEW.origin_location_id;

    NEW.tax_treatment_applied := private.resolve_sales_tax_mode(v_origin_state, NEW.shipping_state);

    RETURN NEW;
END;
$$;

CREATE TRIGGER sales_invoices_apply_tax_nexus
    BEFORE INSERT ON public.sales_invoices
    FOR EACH ROW
    EXECUTE FUNCTION public.sales_invoices_apply_tax_nexus();

CREATE OR REPLACE FUNCTION public.sales_invoices_post_accounts_receivable()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
BEGIN
    UPDATE public.entities
    SET current_balance = current_balance + NEW.total_net_amount,
        updated_at = NOW()
    WHERE id = NEW.customer_id;

    RETURN NEW;
END;
$$;

CREATE TRIGGER sales_invoices_post_accounts_receivable
    AFTER INSERT ON public.sales_invoices
    FOR EACH ROW
    EXECUTE FUNCTION public.sales_invoices_post_accounts_receivable();

-- --------------------------------------------------------------------
-- 18. TRIGGER B — return policy gates
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sales_return_items_policy_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_return public.sales_returns%ROWTYPE;
    v_order public.sales_orders%ROWTYPE;
    v_policy public.return_policies%ROWTYPE;
    v_is_returnable BOOLEAN;
    v_promo_code TEXT;
    v_discount_pct NUMERIC(5, 2);
    v_block_promo BOOLEAN;
    v_max_discount NUMERIC(15, 4);
    v_window_days INTEGER;
    v_reference_at TIMESTAMPTZ;
    v_override_token TEXT;
    v_config_token TEXT;
    v_days_elapsed INTEGER;
BEGIN
    SELECT *
    INTO v_return
    FROM public.sales_returns
    WHERE id = NEW.sales_return_id;

    SELECT *
    INTO v_order
    FROM public.sales_orders
    WHERE id = v_return.sales_order_id;

    IF NEW.sales_invoice_item_id IS NOT NULL THEN
        SELECT applied_promo_code, discount_percentage
        INTO v_promo_code, v_discount_pct
        FROM public.sales_invoice_items
        WHERE id = NEW.sales_invoice_item_id;
    ELSIF NEW.sales_order_item_id IS NOT NULL THEN
        SELECT discount_percentage
        INTO v_discount_pct
        FROM public.sales_order_items
        WHERE id = NEW.sales_order_item_id;
    END IF;

    SELECT is_returnable
    INTO v_is_returnable
    FROM public.items
    WHERE id = NEW.item_id;

    IF NOT COALESCE(v_is_returnable, TRUE) THEN
        RAISE EXCEPTION 'item % is not returnable', NEW.item_id;
    END IF;

    IF v_order.storefront_channel_id IS NOT NULL THEN
        SELECT rp.*
        INTO v_policy
        FROM public.storefront_channels sc
        JOIN public.return_policies rp ON rp.id = sc.return_policy_id
        WHERE sc.id = v_order.storefront_channel_id;

        IF FOUND THEN
            v_block_promo := COALESCE((v_policy.conditional_rules_json ->> 'block_returns_on_promo_codes')::boolean, TRUE);
            v_max_discount := COALESCE((v_policy.conditional_rules_json ->> 'max_discount_percentage_allowed_for_return')::numeric, 20.00);
            v_window_days := v_policy.return_window_days;

            IF v_block_promo AND v_promo_code IS NOT NULL THEN
                RAISE EXCEPTION 'returns blocked: promotional code was applied on invoice line';
            END IF;

            IF COALESCE(v_discount_pct, 0) > v_max_discount THEN
                RAISE EXCEPTION 'returns blocked: discount % exceeds policy maximum %', v_discount_pct, v_max_discount;
            END IF;

            v_reference_at := COALESCE(
                (SELECT delivered_at FROM public.sales_shipments WHERE sales_order_id = v_order.id ORDER BY delivered_at DESC NULLS LAST LIMIT 1),
                v_order.created_at
            );

            v_days_elapsed := EXTRACT(DAY FROM (NOW() - v_reference_at))::INTEGER;
            v_override_token := v_return.custom_fields ->> 'manager_override_token';
            v_config_token := private.get_sales_setting_text(v_return.tenant_id, 'manager_override_token', '');

            IF v_days_elapsed > v_window_days
               AND NOT (
                   v_override_token IS NOT NULL
                   AND v_config_token <> ''
                   AND v_override_token = v_config_token
               )
            THEN
                RAISE EXCEPTION 'returns blocked: return window of % days exceeded', v_window_days;
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER sales_return_items_policy_guard
    BEFORE INSERT ON public.sales_return_items
    FOR EACH ROW
    EXECUTE FUNCTION public.sales_return_items_policy_guard();

-- --------------------------------------------------------------------
-- 19. sales_return_items restock / scrap ledger posting
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sales_return_items_post_inventory()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_return public.sales_returns%ROWTYPE;
    v_scrap_id UUID;
    v_unit_cost NUMERIC(15, 4);
BEGIN
    SELECT *
    INTO v_return
    FROM public.sales_returns
    WHERE id = NEW.sales_return_id;

    v_unit_cost := private.get_item_average_cost(
        NEW.tenant_id,
        v_return.return_location_id,
        NEW.item_id,
        NEW.variant_id
    );

    IF NEW.quantity_restocked > 0 THEN
        INSERT INTO public.inventory_ledger (
            tenant_id, item_id, variant_id, location_id,
            transaction_type, quantity, cost_at_transaction,
            reference_document, created_by
        )
        VALUES (
            NEW.tenant_id, NEW.item_id, NEW.variant_id, v_return.return_location_id,
            'INVENTORY_ADJUSTMENT', NEW.quantity_restocked, v_unit_cost,
            v_return.return_number || '|RETURN-RESTOCK', v_return.created_by
        );
    END IF;

    IF NEW.quantity_damaged > 0 THEN
        v_scrap_id := private.ensure_system_location(
            NEW.tenant_id, '_SYSTEM_SCRAP_QUARANTINE', 'Scrap Quarantine Node'
        );

        INSERT INTO public.inventory_ledger (
            tenant_id, item_id, variant_id, location_id,
            transaction_type, quantity, cost_at_transaction,
            reference_document, created_by
        )
        VALUES (
            NEW.tenant_id, NEW.item_id, NEW.variant_id, v_scrap_id,
            'INVENTORY_ADJUSTMENT', NEW.quantity_damaged, v_unit_cost,
            v_return.return_number || '|RETURN-SCRAP', v_return.created_by
        );
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER sales_return_items_post_inventory
    AFTER INSERT ON public.sales_return_items
    FOR EACH ROW
    EXECUTE FUNCTION public.sales_return_items_post_inventory();

-- --------------------------------------------------------------------
-- 20. TRIGGER D — shipment COGS + fulfillment status sync
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sales_shipment_items_post_cogs()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_order_item public.sales_order_items%ROWTYPE;
    v_package public.sales_shipment_packages%ROWTYPE;
    v_shipment public.sales_shipments%ROWTYPE;
    v_order public.sales_orders%ROWTYPE;
    v_unit_cost NUMERIC(15, 4);
    v_all_fulfilled BOOLEAN;
    v_any_shipped BOOLEAN;
BEGIN
    SELECT *
    INTO v_order_item
    FROM public.sales_order_items
    WHERE id = NEW.sales_order_item_id;

    SELECT *
    INTO v_package
    FROM public.sales_shipment_packages
    WHERE id = NEW.sales_shipment_package_id;

    SELECT *
    INTO v_shipment
    FROM public.sales_shipments
    WHERE id = v_package.sales_shipment_id;

    SELECT *
    INTO v_order
    FROM public.sales_orders
    WHERE id = v_shipment.sales_order_id;

    v_unit_cost := private.get_item_average_cost(
        NEW.tenant_id,
        v_shipment.origin_location_id,
        v_order_item.item_id,
        v_order_item.variant_id
    );

    INSERT INTO public.inventory_ledger (
        tenant_id, item_id, variant_id, location_id,
        transaction_type, quantity, cost_at_transaction,
        reference_document, created_by
    )
    VALUES (
        NEW.tenant_id, v_order_item.item_id, v_order_item.variant_id, v_shipment.origin_location_id,
        'SALES_SHIPMENT', -NEW.quantity_shipped, v_unit_cost,
        v_shipment.tracking_number || '|COGS-DISPATCH', v_order.created_by
    );

    UPDATE public.sales_order_items
    SET quantity_shipped = quantity_shipped + NEW.quantity_shipped,
        updated_at = NOW()
    WHERE id = NEW.sales_order_item_id;

    SELECT NOT EXISTS (
        SELECT 1
        FROM public.sales_order_items soi
        WHERE soi.sales_order_id = v_shipment.sales_order_id
          AND soi.quantity_shipped < soi.quantity_ordered
    )
    INTO v_all_fulfilled;

    SELECT EXISTS (
        SELECT 1
        FROM public.sales_order_items soi
        WHERE soi.sales_order_id = v_shipment.sales_order_id
          AND soi.quantity_shipped > 0
    )
    INTO v_any_shipped;

    IF v_all_fulfilled THEN
        UPDATE public.sales_orders
        SET fulfillment_status = 'DISPATCHED_IN_TRANSIT',
            commercial_status = CASE
                WHEN commercial_status IN ('APPROVED_ACTIVE', 'PARTIALLY_SHIPPED') THEN 'FULLY_COMPLETED'
                ELSE commercial_status
            END,
            updated_at = NOW()
        WHERE id = v_shipment.sales_order_id;
    ELSIF v_any_shipped THEN
        UPDATE public.sales_orders
        SET commercial_status = 'PARTIALLY_SHIPPED',
            fulfillment_status = 'DISPATCHED_IN_TRANSIT',
            updated_at = NOW()
        WHERE id = v_shipment.sales_order_id
          AND fulfillment_status = 'NOT_FULFILLED';
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER sales_shipment_items_post_cogs
    AFTER INSERT ON public.sales_shipment_items
    FOR EACH ROW
    EXECUTE FUNCTION public.sales_shipment_items_post_cogs();

CREATE OR REPLACE FUNCTION public.sales_shipment_items_stamp_tenant()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
BEGIN
    SELECT tenant_id
    INTO NEW.tenant_id
    FROM public.sales_shipment_packages
    WHERE id = NEW.sales_shipment_package_id;

    IF NEW.tenant_id IS NULL THEN
        RAISE EXCEPTION 'sales_shipment_package % not found', NEW.sales_shipment_package_id;
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER sales_shipment_items_stamp_tenant
    BEFORE INSERT ON public.sales_shipment_items
    FOR EACH ROW
    EXECUTE FUNCTION public.sales_shipment_items_stamp_tenant();

-- --------------------------------------------------------------------
-- 21. TRIGGER E — payment application sync
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.payment_applications_sync_invoice_ar()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_invoice_id UUID;
    v_tenant_id UUID;
    v_total_applied NUMERIC(15, 4);
    v_invoice_net NUMERIC(15, 4);
    v_customer_id UUID;
    v_old_applied NUMERIC(15, 4) := 0;
    v_new_applied NUMERIC(15, 4) := 0;
    v_delta NUMERIC(15, 4);
    v_payment_status sales_payment_status;
BEGIN
    IF TG_OP = 'DELETE' THEN
        v_invoice_id := OLD.sales_invoice_id;
        v_tenant_id := OLD.tenant_id;
        v_old_applied := OLD.amount_applied;
    ELSE
        v_invoice_id := NEW.sales_invoice_id;
        v_tenant_id := NEW.tenant_id;
        v_new_applied := NEW.amount_applied;
        IF TG_OP = 'UPDATE' THEN
            v_old_applied := OLD.amount_applied;
        END IF;
    END IF;

    SELECT COALESCE(SUM(amount_applied), 0.0000)
    INTO v_total_applied
    FROM public.payment_applications
    WHERE tenant_id = v_tenant_id
      AND sales_invoice_id = v_invoice_id;

    SELECT total_net_amount, customer_id
    INTO v_invoice_net, v_customer_id
    FROM public.sales_invoices
    WHERE id = v_invoice_id;

    IF v_total_applied <= 0 THEN
        v_payment_status := 'UNPAID';
    ELSIF v_total_applied >= v_invoice_net THEN
        v_payment_status := 'FULLY_PAID';
    ELSE
        v_payment_status := 'PARTIALLY_PAID';
    END IF;

    UPDATE public.sales_invoices
    SET total_paid_amount = v_total_applied,
        invoice_payment_status = v_payment_status,
        updated_at = NOW()
    WHERE id = v_invoice_id;

    v_delta := v_new_applied - v_old_applied;

    IF v_delta <> 0 THEN
        UPDATE public.entities
        SET current_balance = current_balance - v_delta,
            updated_at = NOW()
        WHERE id = v_customer_id;
    END IF;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER payment_applications_sync_invoice_ar
    AFTER INSERT OR UPDATE OR DELETE ON public.payment_applications
    FOR EACH ROW
    EXECUTE FUNCTION public.payment_applications_sync_invoice_ar();

-- --------------------------------------------------------------------
-- 22. updated_at TRIGGERS
-- --------------------------------------------------------------------
CREATE TRIGGER return_policies_set_updated_at
    BEFORE UPDATE ON public.return_policies
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER sales_quotations_set_updated_at
    BEFORE UPDATE ON public.sales_quotations
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER sales_quotation_items_set_updated_at
    BEFORE UPDATE ON public.sales_quotation_items
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER sales_orders_set_updated_at
    BEFORE UPDATE ON public.sales_orders
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER sales_order_items_set_updated_at
    BEFORE UPDATE ON public.sales_order_items
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER sales_invoices_set_updated_at
    BEFORE UPDATE ON public.sales_invoices
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER sales_invoice_items_set_updated_at
    BEFORE UPDATE ON public.sales_invoice_items
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER payment_gateway_vouchers_set_updated_at
    BEFORE UPDATE ON public.payment_gateway_vouchers
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER sales_shipments_set_updated_at
    BEFORE UPDATE ON public.sales_shipments
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER sales_shipment_packages_set_updated_at
    BEFORE UPDATE ON public.sales_shipment_packages
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER customer_payments_set_updated_at
    BEFORE UPDATE ON public.customer_payments
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER payment_applications_set_updated_at
    BEFORE UPDATE ON public.payment_applications
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER sales_credit_notes_set_updated_at
    BEFORE UPDATE ON public.sales_credit_notes
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER sales_returns_set_updated_at
    BEFORE UPDATE ON public.sales_returns
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER sales_return_items_set_updated_at
    BEFORE UPDATE ON public.sales_return_items
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- --------------------------------------------------------------------
-- 23. ROW-LEVEL SECURITY
-- --------------------------------------------------------------------
ALTER TABLE public.return_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_quotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_quotation_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_gateway_vouchers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_shipment_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_shipment_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_credit_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_return_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_approvals ENABLE ROW LEVEL SECURITY;

CREATE POLICY return_policies_tenant_isolation
    ON public.return_policies FOR ALL TO authenticated
    USING (tenant_id = private.current_tenant_id())
    WITH CHECK (tenant_id = private.current_tenant_id());

CREATE POLICY sales_quotations_tenant_isolation
    ON public.sales_quotations FOR ALL TO authenticated
    USING (tenant_id = private.current_tenant_id())
    WITH CHECK (tenant_id = private.current_tenant_id());

CREATE POLICY sales_quotation_items_tenant_isolation
    ON public.sales_quotation_items FOR ALL TO authenticated
    USING (tenant_id = private.current_tenant_id())
    WITH CHECK (tenant_id = private.current_tenant_id());

CREATE POLICY sales_orders_tenant_isolation
    ON public.sales_orders FOR ALL TO authenticated
    USING (tenant_id = private.current_tenant_id())
    WITH CHECK (tenant_id = private.current_tenant_id());

CREATE POLICY sales_order_items_tenant_isolation
    ON public.sales_order_items FOR ALL TO authenticated
    USING (tenant_id = private.current_tenant_id())
    WITH CHECK (tenant_id = private.current_tenant_id());

CREATE POLICY sales_invoices_tenant_isolation
    ON public.sales_invoices FOR ALL TO authenticated
    USING (tenant_id = private.current_tenant_id())
    WITH CHECK (tenant_id = private.current_tenant_id());

CREATE POLICY sales_invoice_items_tenant_isolation
    ON public.sales_invoice_items FOR ALL TO authenticated
    USING (tenant_id = private.current_tenant_id())
    WITH CHECK (tenant_id = private.current_tenant_id());

CREATE POLICY payment_gateway_vouchers_tenant_isolation
    ON public.payment_gateway_vouchers FOR ALL TO authenticated
    USING (tenant_id = private.current_tenant_id())
    WITH CHECK (tenant_id = private.current_tenant_id());

CREATE POLICY sales_shipments_tenant_isolation
    ON public.sales_shipments FOR ALL TO authenticated
    USING (tenant_id = private.current_tenant_id())
    WITH CHECK (tenant_id = private.current_tenant_id());

CREATE POLICY sales_shipment_packages_tenant_isolation
    ON public.sales_shipment_packages FOR ALL TO authenticated
    USING (tenant_id = private.current_tenant_id())
    WITH CHECK (tenant_id = private.current_tenant_id());

CREATE POLICY sales_shipment_items_tenant_isolation
    ON public.sales_shipment_items FOR ALL TO authenticated
    USING (tenant_id = private.current_tenant_id())
    WITH CHECK (tenant_id = private.current_tenant_id());

CREATE POLICY customer_payments_tenant_isolation
    ON public.customer_payments FOR ALL TO authenticated
    USING (tenant_id = private.current_tenant_id())
    WITH CHECK (tenant_id = private.current_tenant_id());

CREATE POLICY payment_applications_tenant_isolation
    ON public.payment_applications FOR ALL TO authenticated
    USING (tenant_id = private.current_tenant_id())
    WITH CHECK (tenant_id = private.current_tenant_id());

CREATE POLICY sales_credit_notes_tenant_isolation
    ON public.sales_credit_notes FOR ALL TO authenticated
    USING (tenant_id = private.current_tenant_id())
    WITH CHECK (tenant_id = private.current_tenant_id());

CREATE POLICY sales_returns_tenant_isolation
    ON public.sales_returns FOR ALL TO authenticated
    USING (tenant_id = private.current_tenant_id())
    WITH CHECK (tenant_id = private.current_tenant_id());

CREATE POLICY sales_return_items_tenant_isolation
    ON public.sales_return_items FOR ALL TO authenticated
    USING (tenant_id = private.current_tenant_id())
    WITH CHECK (tenant_id = private.current_tenant_id());

CREATE POLICY document_approvals_tenant_isolation
    ON public.document_approvals FOR ALL TO authenticated
    USING (tenant_id = private.current_tenant_id())
    WITH CHECK (tenant_id = private.current_tenant_id());

-- --------------------------------------------------------------------
-- 24. GRANTS
-- --------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION private.get_sales_control_flag(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION private.get_sales_setting_text(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION private.get_channel_lifecycle_preset(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION private.resolve_sales_tax_mode(TEXT, TEXT) TO authenticated;

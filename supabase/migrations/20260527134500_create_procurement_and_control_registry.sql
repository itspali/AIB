-- ====================================================================
-- AIB SMART ERP - MILESTONE 4: PROCUREMENT & CONTROL ENGINE
-- Migration: 20260527134500_create_procurement_and_control_registry.sql
-- ====================================================================
--
-- --------------------------------------------------------------------
-- ARCHITECTURAL DOCUMENTATION (downstream developer alignment)
-- --------------------------------------------------------------------
--
-- CONTROL CENTRE PREFERENCE REGISTRY (workspace_control_registry):
--   Multi-level scoped JSON configuration keyed by registry_key.
--   scope_level values: TENANT_GLOBAL, STORE_CHANNEL, FUNCTIONAL_MODULE,
--   INTERFACE_LAYOUT. target_reference_id NULL = tenant-wide default.
--   PROCUREMENT_SETTINGS.configuration_metadata flags:
--     is_po_mandatory_for_grn, is_qc_required_before_stocking
--
-- PO MANDATORY VALIDATION GATE:
--   BEFORE INSERT on goods_receipts reads TENANT_GLOBAL PROCUREMENT_SETTINGS.
--   When is_po_mandatory_for_grn = true, purchase_order_id must be set.
--
-- QUALITY HOLD INVENTORY ROUTING:
--   AFTER INSERT on goods_receipt_items reads is_qc_required_before_stocking.
--   When true, ledger reference_document = '{voucher}|QC-QUARANTINE'.
--   When false, reference_document = voucher_number (available stock path).
--   Both paths post PURCHASE_RECEIPT rows to append-only inventory_ledger.
--
-- LANDED COST COSTING WORKFLOW:
--   total_final_landed_cost = raw_unit_cost + allocated_landed_cost (per unit).
--   Non-QC-hold path writes cost_at_transaction = total_final_landed_cost.
--   Feeds FIFO / weighted-average valuation downstream.
--
-- ATOMIC VOUCHER GENERATION:
--   Call public.generate_next_voucher_string(tenant_id, voucher_type, prefix)
--   inside the same transaction as document INSERT. Uses SELECT FOR UPDATE
--   row lock on document_sequences for gapless sequential numbering.
--
-- DOCUMENT LAYOUT TEMPLATES:
--   Per-module SCREEN_GRID / PDF_PRINT / EMAIL_HTML column definitions
--   stored in grid_columns_json and line_item_formatting JSONB arrays.
--
-- RETROACTIVE PO-GRN LINKING:
--   purchase_order_grn_mappings junction supports many-to-many PO/GRN ties
--   when receipts arrive before PO linkage or span multiple orders.
--
-- ====================================================================

-- --------------------------------------------------------------------
-- 1. COMPLIANCE ALTERATIONS — tenant_locations (idempotent)
-- --------------------------------------------------------------------
ALTER TABLE public.tenant_locations
    ADD COLUMN IF NOT EXISTS location_tax_identifier TEXT DEFAULT NULL;

ALTER TABLE public.tenant_locations
    ADD COLUMN IF NOT EXISTS tax_registered_name TEXT DEFAULT NULL;

-- --------------------------------------------------------------------
-- 2. GLOBAL ENUMS
-- --------------------------------------------------------------------
CREATE TYPE document_voucher_type AS ENUM (
    'PURCHASE_ORDER',
    'GOODS_RECEIPT_NOTE',
    'PURCHASE_INVOICE'
);

CREATE TYPE purchase_document_status AS ENUM (
    'DRAFT',
    'PENDING_APPROVAL',
    'ISSUED_ACTIVE',
    'QC_HOLD',
    'PARTIALLY_FULFILLED',
    'FULLY_COMPLETED',
    'CANCELLED'
);

-- --------------------------------------------------------------------
-- 3. CONTROL & LAYOUT REGISTRIES
-- --------------------------------------------------------------------
CREATE TABLE public.workspace_control_registry (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
    scope_level             TEXT NOT NULL,
    target_reference_id     UUID,
    registry_key            TEXT NOT NULL,
    configuration_metadata  JSONB NOT NULL DEFAULT '{
        "is_po_mandatory_for_grn": false,
        "is_qc_required_before_stocking": false
    }'::jsonb,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT workspace_control_registry_scope_level_chk
        CHECK (scope_level IN ('TENANT_GLOBAL', 'STORE_CHANNEL', 'FUNCTIONAL_MODULE', 'INTERFACE_LAYOUT'))
);

CREATE UNIQUE INDEX workspace_control_registry_scope_unique
    ON public.workspace_control_registry (
        tenant_id,
        scope_level,
        registry_key,
        COALESCE(target_reference_id, '00000000-0000-0000-0000-000000000000'::uuid)
    );

CREATE TABLE public.document_layout_templates (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id            UUID NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
    module_key           TEXT NOT NULL,
    view_context         TEXT NOT NULL,
    image_display_mode   TEXT NOT NULL DEFAULT 'INLINE_CELL',
    grid_columns_json    JSONB NOT NULL DEFAULT '[]'::jsonb,
    line_item_formatting JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT document_layout_templates_view_context_chk
        CHECK (view_context IN ('SCREEN_GRID', 'PDF_PRINT', 'EMAIL_HTML')),
    CONSTRAINT document_layout_templates_image_display_mode_chk
        CHECK (image_display_mode IN ('INLINE_CELL', 'SEPARATE_COLUMN', 'HIDDEN')),
    CONSTRAINT document_layout_templates_module_view_unique
        UNIQUE (tenant_id, module_key, view_context)
);

-- --------------------------------------------------------------------
-- 4. DOCUMENT SEQUENCES (atomic number generator)
-- --------------------------------------------------------------------
CREATE TABLE public.document_sequences (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
    voucher_type    document_voucher_type NOT NULL,
    prefix          TEXT NOT NULL,
    next_value      INTEGER NOT NULL DEFAULT 1,
    padding_length  INTEGER NOT NULL DEFAULT 5,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT document_sequences_tenant_type_prefix_unique
        UNIQUE (tenant_id, voucher_type, prefix),
    CONSTRAINT document_sequences_next_value_positive_chk
        CHECK (next_value >= 1),
    CONSTRAINT document_sequences_padding_length_positive_chk
        CHECK (padding_length >= 1)
);

CREATE OR REPLACE FUNCTION public.generate_next_voucher_string(
    p_tenant_id UUID,
    p_voucher_type document_voucher_type,
    p_prefix TEXT DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_row public.document_sequences%ROWTYPE;
    v_sequence_value INTEGER;
    v_count INTEGER;
BEGIN
    IF p_prefix IS NOT NULL THEN
        SELECT *
        INTO v_row
        FROM public.document_sequences
        WHERE tenant_id = p_tenant_id
          AND voucher_type = p_voucher_type
          AND prefix = p_prefix
        FOR UPDATE;
    ELSE
        SELECT COUNT(*)
        INTO v_count
        FROM public.document_sequences
        WHERE tenant_id = p_tenant_id
          AND voucher_type = p_voucher_type;

        IF v_count > 1 THEN
            RAISE EXCEPTION
                'multiple document_sequences exist for tenant % and type %; pass p_prefix explicitly',
                p_tenant_id, p_voucher_type;
        END IF;

        SELECT *
        INTO v_row
        FROM public.document_sequences
        WHERE tenant_id = p_tenant_id
          AND voucher_type = p_voucher_type
        FOR UPDATE;
    END IF;

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'document sequence not configured for tenant %, type %, prefix %',
            p_tenant_id, p_voucher_type, p_prefix;
    END IF;

    v_sequence_value := v_row.next_value;

    UPDATE public.document_sequences
    SET next_value = next_value + 1,
        updated_at = NOW()
    WHERE id = v_row.id;

    RETURN v_row.prefix || lpad(v_sequence_value::text, v_row.padding_length, '0');
END;
$$;

-- --------------------------------------------------------------------
-- 5. PURCHASE ORDERS (header + lines)
-- --------------------------------------------------------------------
CREATE TABLE public.purchase_orders (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES public.tenants (id) ON DELETE RESTRICT,
    destination_location_id UUID NOT NULL REFERENCES public.tenant_locations (id) ON DELETE RESTRICT,
    supplier_id             UUID NOT NULL REFERENCES public.entities (id) ON DELETE RESTRICT,
    voucher_number          TEXT NOT NULL,
    document_status         purchase_document_status NOT NULL DEFAULT 'DRAFT',
    payment_terms_days      INTEGER NOT NULL DEFAULT 0,
    currency_code           VARCHAR(3) NOT NULL DEFAULT 'USD',
    exchange_rate           NUMERIC(15, 4) NOT NULL DEFAULT 1.0000,
    total_gross_amount      NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
    total_tax_amount        NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
    total_net_amount        NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
    custom_fields           JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_by              UUID NOT NULL REFERENCES public.users (id) ON DELETE RESTRICT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT purchase_orders_tenant_voucher_unique
        UNIQUE (tenant_id, voucher_number),
    CONSTRAINT purchase_orders_exchange_rate_positive_chk
        CHECK (exchange_rate > 0)
);

CREATE UNIQUE INDEX purchase_orders_tenant_id_id_unique
    ON public.purchase_orders (tenant_id, id);

ALTER TABLE public.purchase_orders
    ADD CONSTRAINT purchase_orders_location_tenant_fk
    FOREIGN KEY (tenant_id, destination_location_id)
    REFERENCES public.tenant_locations (tenant_id, id)
    ON DELETE RESTRICT;

ALTER TABLE public.purchase_orders
    ADD CONSTRAINT purchase_orders_supplier_tenant_fk
    FOREIGN KEY (tenant_id, supplier_id)
    REFERENCES public.entities (tenant_id, id)
    ON DELETE RESTRICT;

CREATE TABLE public.purchase_order_items (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES public.tenants (id) ON DELETE RESTRICT,
    purchase_order_id       UUID NOT NULL REFERENCES public.purchase_orders (id) ON DELETE CASCADE,
    item_id                 UUID NOT NULL REFERENCES public.items (id) ON DELETE RESTRICT,
    variant_id              UUID REFERENCES public.item_variants (id) ON DELETE RESTRICT,
    uom_code                TEXT NOT NULL,
    quantity_ordered        NUMERIC(15, 4) NOT NULL,
    quantity_received       NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
    quantity_invoiced       NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
    unit_price_contractual  NUMERIC(15, 4) NOT NULL,
    tax_rate_percentage     NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
    line_tax_amount         NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
    line_total_gross        NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
    custom_fields           JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT purchase_order_items_quantity_ordered_positive_chk
        CHECK (quantity_ordered > 0),
    CONSTRAINT purchase_order_items_unit_price_non_negative_chk
        CHECK (unit_price_contractual >= 0)
);

CREATE UNIQUE INDEX purchase_order_items_tenant_id_id_unique
    ON public.purchase_order_items (tenant_id, id);

ALTER TABLE public.purchase_order_items
    ADD CONSTRAINT purchase_order_items_po_tenant_fk
    FOREIGN KEY (tenant_id, purchase_order_id)
    REFERENCES public.purchase_orders (tenant_id, id)
    ON DELETE CASCADE;

ALTER TABLE public.purchase_order_items
    ADD CONSTRAINT purchase_order_items_item_tenant_fk
    FOREIGN KEY (tenant_id, item_id)
    REFERENCES public.items (tenant_id, id)
    ON DELETE RESTRICT;

ALTER TABLE public.purchase_order_items
    ADD CONSTRAINT purchase_order_items_variant_tenant_fk
    FOREIGN KEY (tenant_id, variant_id)
    REFERENCES public.item_variants (tenant_id, id)
    ON DELETE RESTRICT;

-- --------------------------------------------------------------------
-- 6. GOODS RECEIPTS (header + lines)
-- --------------------------------------------------------------------
CREATE TABLE public.goods_receipts (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES public.tenants (id) ON DELETE RESTRICT,
    destination_location_id UUID NOT NULL REFERENCES public.tenant_locations (id) ON DELETE RESTRICT,
    purchase_order_id       UUID REFERENCES public.purchase_orders (id) ON DELETE SET NULL,
    voucher_number          TEXT NOT NULL,
    is_qc_pending           BOOLEAN NOT NULL DEFAULT FALSE,
    received_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    custom_fields           JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_by              UUID NOT NULL REFERENCES public.users (id) ON DELETE RESTRICT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT goods_receipts_tenant_voucher_unique
        UNIQUE (tenant_id, voucher_number)
);

CREATE UNIQUE INDEX goods_receipts_tenant_id_id_unique
    ON public.goods_receipts (tenant_id, id);

ALTER TABLE public.goods_receipts
    ADD CONSTRAINT goods_receipts_location_tenant_fk
    FOREIGN KEY (tenant_id, destination_location_id)
    REFERENCES public.tenant_locations (tenant_id, id)
    ON DELETE RESTRICT;

ALTER TABLE public.goods_receipts
    ADD CONSTRAINT goods_receipts_po_tenant_fk
    FOREIGN KEY (tenant_id, purchase_order_id)
    REFERENCES public.purchase_orders (tenant_id, id)
    ON DELETE SET NULL;

CREATE TABLE public.goods_receipt_items (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES public.tenants (id) ON DELETE RESTRICT,
    goods_receipt_id        UUID NOT NULL REFERENCES public.goods_receipts (id) ON DELETE CASCADE,
    po_item_id              UUID REFERENCES public.purchase_order_items (id) ON DELETE SET NULL,
    item_id                 UUID NOT NULL REFERENCES public.items (id) ON DELETE RESTRICT,
    variant_id              UUID REFERENCES public.item_variants (id) ON DELETE RESTRICT,
    quantity_received       NUMERIC(15, 4) NOT NULL,
    quantity_accepted       NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
    quantity_rejected       NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
    raw_unit_cost           NUMERIC(15, 4) NOT NULL,
    allocated_landed_cost   NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
    total_final_landed_cost NUMERIC(15, 4) NOT NULL,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT goods_receipt_items_quantity_received_positive_chk
        CHECK (quantity_received > 0),
    CONSTRAINT goods_receipt_items_cost_non_negative_chk
        CHECK (raw_unit_cost >= 0 AND allocated_landed_cost >= 0 AND total_final_landed_cost >= 0)
);

ALTER TABLE public.goods_receipt_items
    ADD CONSTRAINT goods_receipt_items_gr_tenant_fk
    FOREIGN KEY (tenant_id, goods_receipt_id)
    REFERENCES public.goods_receipts (tenant_id, id)
    ON DELETE CASCADE;

ALTER TABLE public.goods_receipt_items
    ADD CONSTRAINT goods_receipt_items_po_item_tenant_fk
    FOREIGN KEY (tenant_id, po_item_id)
    REFERENCES public.purchase_order_items (tenant_id, id)
    ON DELETE SET NULL;

ALTER TABLE public.goods_receipt_items
    ADD CONSTRAINT goods_receipt_items_item_tenant_fk
    FOREIGN KEY (tenant_id, item_id)
    REFERENCES public.items (tenant_id, id)
    ON DELETE RESTRICT;

ALTER TABLE public.goods_receipt_items
    ADD CONSTRAINT goods_receipt_items_variant_tenant_fk
    FOREIGN KEY (tenant_id, variant_id)
    REFERENCES public.item_variants (tenant_id, id)
    ON DELETE RESTRICT;

-- --------------------------------------------------------------------
-- 7. RETROACTIVE PO-GRN LINKING MATRIX
-- --------------------------------------------------------------------
CREATE TABLE public.purchase_order_grn_mappings (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
    purchase_order_id   UUID NOT NULL REFERENCES public.purchase_orders (id) ON DELETE CASCADE,
    goods_receipt_id    UUID NOT NULL REFERENCES public.goods_receipts (id) ON DELETE CASCADE,
    mapped_by           UUID NOT NULL REFERENCES public.users (id) ON DELETE RESTRICT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT purchase_order_grn_mappings_po_grn_unique
        UNIQUE (purchase_order_id, goods_receipt_id)
);

ALTER TABLE public.purchase_order_grn_mappings
    ADD CONSTRAINT purchase_order_grn_mappings_po_tenant_fk
    FOREIGN KEY (tenant_id, purchase_order_id)
    REFERENCES public.purchase_orders (tenant_id, id)
    ON DELETE CASCADE;

ALTER TABLE public.purchase_order_grn_mappings
    ADD CONSTRAINT purchase_order_grn_mappings_grn_tenant_fk
    FOREIGN KEY (tenant_id, goods_receipt_id)
    REFERENCES public.goods_receipts (tenant_id, id)
    ON DELETE CASCADE;

-- --------------------------------------------------------------------
-- 8. PURCHASE INVOICES (header + lines)
-- --------------------------------------------------------------------
CREATE TABLE public.purchase_invoices (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES public.tenants (id) ON DELETE RESTRICT,
    supplier_id             UUID NOT NULL REFERENCES public.entities (id) ON DELETE RESTRICT,
    purchase_order_id       UUID REFERENCES public.purchase_orders (id) ON DELETE SET NULL,
    invoice_number_vendor   TEXT NOT NULL,
    system_voucher_number   TEXT NOT NULL,
    tax_treatment           tax_treatment_type NOT NULL DEFAULT 'REGULAR_B2B',
    total_liability_amount  NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
    billing_location_id     UUID NOT NULL REFERENCES public.tenant_locations (id) ON DELETE RESTRICT,
    is_paid                 BOOLEAN NOT NULL DEFAULT FALSE,
    custom_fields           JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_by              UUID NOT NULL REFERENCES public.users (id) ON DELETE RESTRICT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT purchase_invoices_tenant_system_voucher_unique
        UNIQUE (tenant_id, system_voucher_number),
    CONSTRAINT purchase_invoices_liability_non_negative_chk
        CHECK (total_liability_amount >= 0)
);

CREATE UNIQUE INDEX purchase_invoices_tenant_id_id_unique
    ON public.purchase_invoices (tenant_id, id);

ALTER TABLE public.purchase_invoices
    ADD CONSTRAINT purchase_invoices_supplier_tenant_fk
    FOREIGN KEY (tenant_id, supplier_id)
    REFERENCES public.entities (tenant_id, id)
    ON DELETE RESTRICT;

ALTER TABLE public.purchase_invoices
    ADD CONSTRAINT purchase_invoices_po_tenant_fk
    FOREIGN KEY (tenant_id, purchase_order_id)
    REFERENCES public.purchase_orders (tenant_id, id)
    ON DELETE SET NULL;

ALTER TABLE public.purchase_invoices
    ADD CONSTRAINT purchase_invoices_billing_location_tenant_fk
    FOREIGN KEY (tenant_id, billing_location_id)
    REFERENCES public.tenant_locations (tenant_id, id)
    ON DELETE RESTRICT;

CREATE TABLE public.purchase_invoice_items (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES public.tenants (id) ON DELETE RESTRICT,
    purchase_invoice_id     UUID NOT NULL REFERENCES public.purchase_invoices (id) ON DELETE CASCADE,
    item_id                 UUID NOT NULL REFERENCES public.items (id) ON DELETE RESTRICT,
    variant_id              UUID REFERENCES public.item_variants (id) ON DELETE RESTRICT,
    quantity_billed         NUMERIC(15, 4) NOT NULL,
    unit_price_billed       NUMERIC(15, 4) NOT NULL,
    line_tax_computed       NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT purchase_invoice_items_quantity_billed_positive_chk
        CHECK (quantity_billed > 0),
    CONSTRAINT purchase_invoice_items_unit_price_non_negative_chk
        CHECK (unit_price_billed >= 0)
);

ALTER TABLE public.purchase_invoice_items
    ADD CONSTRAINT purchase_invoice_items_invoice_tenant_fk
    FOREIGN KEY (tenant_id, purchase_invoice_id)
    REFERENCES public.purchase_invoices (tenant_id, id)
    ON DELETE CASCADE;

ALTER TABLE public.purchase_invoice_items
    ADD CONSTRAINT purchase_invoice_items_item_tenant_fk
    FOREIGN KEY (tenant_id, item_id)
    REFERENCES public.items (tenant_id, id)
    ON DELETE RESTRICT;

ALTER TABLE public.purchase_invoice_items
    ADD CONSTRAINT purchase_invoice_items_variant_tenant_fk
    FOREIGN KEY (tenant_id, variant_id)
    REFERENCES public.item_variants (tenant_id, id)
    ON DELETE RESTRICT;

-- --------------------------------------------------------------------
-- 9. PROCUREMENT CONTROL HELPERS & TRIGGERS
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.get_procurement_control_flag(
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
      AND registry_key = 'PROCUREMENT_SETTINGS'
      AND target_reference_id IS NULL
    ORDER BY updated_at DESC
    LIMIT 1;

    RETURN COALESCE(v_value, FALSE);
END;
$$;

CREATE OR REPLACE FUNCTION public.goods_receipts_po_mandatory_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
BEGIN
    IF private.get_procurement_control_flag(NEW.tenant_id, 'is_po_mandatory_for_grn')
       AND NEW.purchase_order_id IS NULL
    THEN
        RAISE EXCEPTION
            'purchase_order_id is required: is_po_mandatory_for_grn is enabled for tenant %',
            NEW.tenant_id;
    END IF;

    IF private.get_procurement_control_flag(NEW.tenant_id, 'is_qc_required_before_stocking') THEN
        NEW.is_qc_pending := TRUE;
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER goods_receipts_enforce_po_mandatory
    BEFORE INSERT ON public.goods_receipts
    FOR EACH ROW
    EXECUTE FUNCTION public.goods_receipts_po_mandatory_guard();

CREATE OR REPLACE FUNCTION public.goods_receipt_items_post_stocking()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_gr public.goods_receipts%ROWTYPE;
    v_qc_required BOOLEAN;
    v_reference TEXT;
BEGIN
    SELECT *
    INTO v_gr
    FROM public.goods_receipts
    WHERE id = NEW.goods_receipt_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'goods receipt % not found for line item', NEW.goods_receipt_id;
    END IF;

    v_qc_required := private.get_procurement_control_flag(NEW.tenant_id, 'is_qc_required_before_stocking');

    IF v_qc_required THEN
        v_reference := v_gr.voucher_number || '|QC-QUARANTINE';
    ELSE
        v_reference := v_gr.voucher_number;
    END IF;

    INSERT INTO public.inventory_ledger (
        tenant_id,
        item_id,
        variant_id,
        location_id,
        transaction_type,
        quantity,
        cost_at_transaction,
        reference_document,
        created_by
    )
    VALUES (
        NEW.tenant_id,
        NEW.item_id,
        NEW.variant_id,
        v_gr.destination_location_id,
        'PURCHASE_RECEIPT',
        NEW.quantity_received,
        NEW.total_final_landed_cost,
        v_reference,
        v_gr.created_by
    );

    RETURN NEW;
END;
$$;

CREATE TRIGGER goods_receipt_items_apply_stocking
    AFTER INSERT ON public.goods_receipt_items
    FOR EACH ROW
    EXECUTE FUNCTION public.goods_receipt_items_post_stocking();

-- --------------------------------------------------------------------
-- 10. updated_at TRIGGERS
-- --------------------------------------------------------------------
CREATE TRIGGER workspace_control_registry_set_updated_at
    BEFORE UPDATE ON public.workspace_control_registry
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER document_layout_templates_set_updated_at
    BEFORE UPDATE ON public.document_layout_templates
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER document_sequences_set_updated_at
    BEFORE UPDATE ON public.document_sequences
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER purchase_orders_set_updated_at
    BEFORE UPDATE ON public.purchase_orders
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER purchase_order_items_set_updated_at
    BEFORE UPDATE ON public.purchase_order_items
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER goods_receipts_set_updated_at
    BEFORE UPDATE ON public.goods_receipts
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER goods_receipt_items_set_updated_at
    BEFORE UPDATE ON public.goods_receipt_items
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER purchase_invoices_set_updated_at
    BEFORE UPDATE ON public.purchase_invoices
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER purchase_invoice_items_set_updated_at
    BEFORE UPDATE ON public.purchase_invoice_items
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- --------------------------------------------------------------------
-- 11. ROW-LEVEL SECURITY
-- --------------------------------------------------------------------
ALTER TABLE public.workspace_control_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_layout_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goods_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goods_receipt_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_order_grn_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_invoice_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY workspace_control_registry_tenant_isolation
    ON public.workspace_control_registry FOR ALL TO authenticated
    USING (tenant_id = private.current_tenant_id())
    WITH CHECK (tenant_id = private.current_tenant_id());

CREATE POLICY document_layout_templates_tenant_isolation
    ON public.document_layout_templates FOR ALL TO authenticated
    USING (tenant_id = private.current_tenant_id())
    WITH CHECK (tenant_id = private.current_tenant_id());

CREATE POLICY document_sequences_tenant_isolation
    ON public.document_sequences FOR ALL TO authenticated
    USING (tenant_id = private.current_tenant_id())
    WITH CHECK (tenant_id = private.current_tenant_id());

CREATE POLICY purchase_orders_tenant_isolation
    ON public.purchase_orders FOR ALL TO authenticated
    USING (tenant_id = private.current_tenant_id())
    WITH CHECK (tenant_id = private.current_tenant_id());

CREATE POLICY purchase_order_items_tenant_isolation
    ON public.purchase_order_items FOR ALL TO authenticated
    USING (tenant_id = private.current_tenant_id())
    WITH CHECK (tenant_id = private.current_tenant_id());

CREATE POLICY goods_receipts_tenant_isolation
    ON public.goods_receipts FOR ALL TO authenticated
    USING (tenant_id = private.current_tenant_id())
    WITH CHECK (tenant_id = private.current_tenant_id());

CREATE POLICY goods_receipt_items_tenant_isolation
    ON public.goods_receipt_items FOR ALL TO authenticated
    USING (tenant_id = private.current_tenant_id())
    WITH CHECK (tenant_id = private.current_tenant_id());

CREATE POLICY purchase_order_grn_mappings_tenant_isolation
    ON public.purchase_order_grn_mappings FOR ALL TO authenticated
    USING (tenant_id = private.current_tenant_id())
    WITH CHECK (tenant_id = private.current_tenant_id());

CREATE POLICY purchase_invoices_tenant_isolation
    ON public.purchase_invoices FOR ALL TO authenticated
    USING (tenant_id = private.current_tenant_id())
    WITH CHECK (tenant_id = private.current_tenant_id());

CREATE POLICY purchase_invoice_items_tenant_isolation
    ON public.purchase_invoice_items FOR ALL TO authenticated
    USING (tenant_id = private.current_tenant_id())
    WITH CHECK (tenant_id = private.current_tenant_id());

-- --------------------------------------------------------------------
-- 12. GRANTS
-- --------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION private.get_procurement_control_flag(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_next_voucher_string(UUID, document_voucher_type, TEXT) TO authenticated;

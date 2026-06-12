-- ====================================================================
-- Procurement promotional engine: schema, entitlements, MWAC restatement, GRN/PO/BILL integration
-- Migration: 20260620200000_procurement_promo_engine.sql
-- ====================================================================

-- --------------------------------------------------------------------
-- 1. ENUMS
-- --------------------------------------------------------------------
DO $$ BEGIN
    CREATE TYPE public.promo_entitlement_status AS ENUM ('OPEN', 'PARTIAL', 'CLOSED', 'WRITTEN_OFF');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE public.promo_quarantine_type AS ENUM ('NOT_FOR_RESALE_SAMPLE', 'PROMOTIONAL_HOLD');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE public.purchase_invoice_match_status AS ENUM ('MATCHED', 'PPV_HOLD', 'VARIANCE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- --------------------------------------------------------------------
-- 2. COLUMN EXTENSIONS
-- --------------------------------------------------------------------
ALTER TABLE public.purchase_order_items
    ADD COLUMN IF NOT EXISTS is_promotional BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS linked_parent_line_id UUID,
    ADD COLUMN IF NOT EXISTS promo_group_id UUID,
    ADD COLUMN IF NOT EXISTS cost_allocation_method TEXT NOT NULL DEFAULT 'LANDED_MARKET_RATIO',
    ADD COLUMN IF NOT EXISTS promotional_category TEXT;

ALTER TABLE public.purchase_order_items
    DROP CONSTRAINT IF EXISTS purchase_order_items_cost_allocation_method_chk;

ALTER TABLE public.purchase_order_items
    ADD CONSTRAINT purchase_order_items_cost_allocation_method_chk
        CHECK (cost_allocation_method IN ('LANDED_MARKET_RATIO', 'BY_QUANTITY', 'BY_VALUE', 'BY_WEIGHT'));

ALTER TABLE public.goods_receipt_items
    ADD COLUMN IF NOT EXISTS linked_parent_line_id UUID,
    ADD COLUMN IF NOT EXISTS entitlement_id UUID;

ALTER TABLE public.tenant_locations
    ADD COLUMN IF NOT EXISTS location_subtype TEXT,
    ADD COLUMN IF NOT EXISTS is_git_holding BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS is_subcontract_wip BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.purchase_invoices
    ADD COLUMN IF NOT EXISTS match_status public.purchase_invoice_match_status NOT NULL DEFAULT 'MATCHED';

DO $$
BEGIN
    IF to_regclass('public.tax_codes') IS NOT NULL THEN
        ALTER TABLE public.tax_codes
            ADD COLUMN IF NOT EXISTS is_recoverable BOOLEAN NOT NULL DEFAULT TRUE;
    END IF;
END $$;

-- --------------------------------------------------------------------
-- 3. PROMO ENGINE TABLES
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.promotional_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    batch_number TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'POSTED', 'CANCELLED')),
    source_quarantine_type public.promo_quarantine_type NOT NULL DEFAULT 'PROMOTIONAL_HOLD',
    location_id UUID REFERENCES public.tenant_locations(id) ON DELETE SET NULL,
    quantity_total NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
    notes TEXT,
    posted_at TIMESTAMPTZ,
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, batch_number)
);

CREATE TABLE IF NOT EXISTS public.promo_fulfillment_entitlements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    purchase_order_id UUID NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
    paid_line_id UUID NOT NULL REFERENCES public.purchase_order_items(id) ON DELETE CASCADE,
    promo_line_id UUID NOT NULL REFERENCES public.purchase_order_items(id) ON DELETE CASCADE,
    promo_group_id UUID NOT NULL,
    expected_qty NUMERIC(15, 4) NOT NULL CHECK (expected_qty > 0),
    received_qty NUMERIC(15, 4) NOT NULL DEFAULT 0.0000 CHECK (received_qty >= 0),
    status public.promo_entitlement_status NOT NULL DEFAULT 'OPEN',
    written_off_at TIMESTAMPTZ,
    written_off_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, promo_line_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS promo_fulfillment_entitlements_tenant_id_id_unique
    ON public.promo_fulfillment_entitlements (tenant_id, id);

CREATE TABLE IF NOT EXISTS public.promo_entitlement_receipt_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    entitlement_id UUID NOT NULL REFERENCES public.promo_fulfillment_entitlements(id) ON DELETE CASCADE,
    goods_receipt_id UUID NOT NULL REFERENCES public.goods_receipts(id) ON DELETE CASCADE,
    goods_receipt_item_id UUID NOT NULL REFERENCES public.goods_receipt_items(id) ON DELETE CASCADE,
    quantity_linked NUMERIC(15, 4) NOT NULL CHECK (quantity_linked > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, goods_receipt_item_id)
);

CREATE TABLE IF NOT EXISTS public.promo_inventory_balances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    location_id UUID NOT NULL REFERENCES public.tenant_locations(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
    variant_id UUID REFERENCES public.item_variants(id) ON DELETE SET NULL,
    quarantine_type public.promo_quarantine_type NOT NULL,
    quantity_on_hand NUMERIC(15, 4) NOT NULL DEFAULT 0.0000 CHECK (quantity_on_hand >= 0),
    entitlement_id UUID REFERENCES public.promo_fulfillment_entitlements(id) ON DELETE SET NULL,
    promotional_batch_id UUID REFERENCES public.promotional_batches(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS promo_inventory_balances_pool_uq
    ON public.promo_inventory_balances (tenant_id, location_id, item_id, variant_id, quarantine_type)
    WHERE entitlement_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS promo_inventory_balances_entitlement_uq
    ON public.promo_inventory_balances (tenant_id, location_id, item_id, variant_id, quarantine_type, entitlement_id)
    WHERE entitlement_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.promo_entitlement_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    entitlement_id UUID NOT NULL REFERENCES public.promo_fulfillment_entitlements(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    quantity_delta NUMERIC(15, 4),
    goods_receipt_id UUID REFERENCES public.goods_receipts(id) ON DELETE SET NULL,
    goods_receipt_item_id UUID REFERENCES public.goods_receipt_items(id) ON DELETE SET NULL,
    prior_status public.promo_entitlement_status,
    new_status public.promo_entitlement_status,
    detail JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.goods_receipt_landed_charges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    goods_receipt_id UUID NOT NULL REFERENCES public.goods_receipts(id) ON DELETE CASCADE,
    charge_type TEXT NOT NULL,
    description TEXT,
    amount NUMERIC(15, 4) NOT NULL CHECK (amount >= 0),
    allocation_method TEXT NOT NULL DEFAULT 'BY_VALUE'
        CHECK (allocation_method IN ('BY_QUANTITY', 'BY_VALUE', 'BY_WEIGHT')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.purchase_invoice_receipts (
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    purchase_invoice_id UUID NOT NULL REFERENCES public.purchase_invoices(id) ON DELETE CASCADE,
    goods_receipt_id UUID NOT NULL REFERENCES public.goods_receipts(id) ON DELETE CASCADE,
    linked_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    linked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (tenant_id, purchase_invoice_id, goods_receipt_id)
);

CREATE TABLE IF NOT EXISTS public.vendor_advance_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    supplier_id UUID NOT NULL REFERENCES public.entities(id) ON DELETE RESTRICT,
    payment_reference TEXT NOT NULL,
    amount NUMERIC(15, 4) NOT NULL CHECK (amount > 0),
    unapplied_balance NUMERIC(15, 4) NOT NULL CHECK (unapplied_balance >= 0),
    currency_code VARCHAR(3) NOT NULL DEFAULT 'USD',
    payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    notes TEXT,
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, payment_reference)
);

CREATE TABLE IF NOT EXISTS public.purchase_invoice_advance_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    purchase_invoice_id UUID NOT NULL REFERENCES public.purchase_invoices(id) ON DELETE CASCADE,
    vendor_advance_payment_id UUID NOT NULL REFERENCES public.vendor_advance_payments(id) ON DELETE RESTRICT,
    amount_applied NUMERIC(15, 4) NOT NULL CHECK (amount_applied > 0),
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    applied_by UUID REFERENCES public.users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS public.goods_in_transit_vouchers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    voucher_number TEXT NOT NULL,
    source_location_id UUID REFERENCES public.tenant_locations(id) ON DELETE SET NULL,
    destination_location_id UUID REFERENCES public.tenant_locations(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'DRAFT',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, voucher_number)
);

CREATE TABLE IF NOT EXISTS public.vendor_job_work_locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    supplier_id UUID NOT NULL REFERENCES public.entities(id) ON DELETE CASCADE,
    location_id UUID NOT NULL REFERENCES public.tenant_locations(id) ON DELETE CASCADE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, supplier_id, location_id)
);

CREATE TABLE IF NOT EXISTS public.subcontract_bom_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    parent_item_id UUID NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
    component_item_id UUID NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
    quantity_per NUMERIC(15, 4) NOT NULL DEFAULT 1.0000 CHECK (quantity_per > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.goods_receipt_items
    DROP CONSTRAINT IF EXISTS goods_receipt_items_entitlement_tenant_fk;

ALTER TABLE public.goods_receipt_items
    ADD CONSTRAINT goods_receipt_items_entitlement_tenant_fk
        FOREIGN KEY (tenant_id, entitlement_id)
        REFERENCES public.promo_fulfillment_entitlements (tenant_id, id)
        ON DELETE SET NULL;

ALTER TABLE public.purchase_order_items
    DROP CONSTRAINT IF EXISTS purchase_order_items_linked_parent_tenant_fk;

ALTER TABLE public.purchase_order_items
    ADD CONSTRAINT purchase_order_items_linked_parent_tenant_fk
        FOREIGN KEY (tenant_id, linked_parent_line_id)
        REFERENCES public.purchase_order_items (tenant_id, id)
        ON DELETE SET NULL;

-- --------------------------------------------------------------------
-- 4. RLS
-- --------------------------------------------------------------------
ALTER TABLE public.promotional_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promo_fulfillment_entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promo_entitlement_receipt_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promo_inventory_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promo_entitlement_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goods_receipt_landed_charges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_invoice_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_advance_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_invoice_advance_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goods_in_transit_vouchers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_job_work_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subcontract_bom_lines ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
    t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY[
        'promotional_batches',
        'promo_fulfillment_entitlements',
        'promo_entitlement_receipt_links',
        'promo_inventory_balances',
        'promo_entitlement_events',
        'goods_receipt_landed_charges',
        'purchase_invoice_receipts',
        'vendor_advance_payments',
        'purchase_invoice_advance_applications',
        'goods_in_transit_vouchers',
        'vendor_job_work_locations',
        'subcontract_bom_lines'
    ]
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I_tenant_isolation ON public.%I', t, t);
        EXECUTE format(
            'CREATE POLICY %I_tenant_isolation ON public.%I FOR ALL USING (tenant_id = private.current_tenant_id()) WITH CHECK (tenant_id = private.current_tenant_id())',
            t, t
        );
    END LOOP;
END $$;

-- --------------------------------------------------------------------
-- 5. PO LINE PROMO HELPERS
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.get_procurement_control_text(
    p_tenant_id UUID,
    p_flag_key TEXT,
    p_default TEXT DEFAULT NULL
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
    SELECT NULLIF(btrim(configuration_metadata ->> p_flag_key), '')
    INTO v_value
    FROM public.workspace_control_registry
    WHERE tenant_id = p_tenant_id
      AND scope_level = 'TENANT_GLOBAL'
      AND registry_key = 'PROCUREMENT_SETTINGS'
      AND target_reference_id IS NULL
    ORDER BY updated_at DESC
    LIMIT 1;

    RETURN COALESCE(v_value, p_default);
END;
$$;

CREATE OR REPLACE FUNCTION private.po_line_promo_from_json(p_entry JSONB)
RETURNS TABLE (
    is_promotional BOOLEAN,
    linked_parent_line_id UUID,
    promo_group_id UUID,
    cost_allocation_method TEXT,
    promotional_category TEXT
)
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    v_unit_price NUMERIC(15, 4) := COALESCE(NULLIF(p_entry ->> 'unit_price_contractual', '')::NUMERIC, 0);
BEGIN
    is_promotional := COALESCE((p_entry ->> 'is_promotional')::BOOLEAN, v_unit_price = 0);
    linked_parent_line_id := NULLIF(p_entry ->> 'linked_parent_line_id', '')::UUID;
    promo_group_id := NULLIF(p_entry ->> 'promo_group_id', '')::UUID;
    cost_allocation_method := COALESCE(
        NULLIF(btrim(p_entry ->> 'cost_allocation_method'), ''),
        'LANDED_MARKET_RATIO'
    );
    promotional_category := NULLIF(btrim(p_entry ->> 'promotional_category'), '');
    RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION private.apply_po_save_promo_lines(
    p_po_id UUID,
    p_lines JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_tenant_id UUID;
    v_entry JSONB;
    v_ord INT;
    v_promo RECORD;
    v_line_id UUID;
    v_parent_variant UUID;
    v_parent_line_id UUID;
    v_default_category TEXT;
BEGIN
    v_tenant_id := private.current_tenant_id();
    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'tenant context missing from session';
    END IF;

    v_default_category := COALESCE(
        private.get_procurement_control_text(v_tenant_id, 'promo_default_category', 'FREE_GOODS'),
        'FREE_GOODS'
    );

    FOR v_entry, v_ord IN
        SELECT t.entry, t.ord::INT
        FROM jsonb_array_elements(p_lines) WITH ORDINALITY AS t(entry, ord)
    LOOP
        SELECT * INTO v_promo FROM private.po_line_promo_from_json(v_entry);

        SELECT poi.id
        INTO v_line_id
        FROM public.purchase_order_items poi
        WHERE poi.purchase_order_id = p_po_id
          AND poi.tenant_id = v_tenant_id
          AND poi.variant_id = NULLIF(v_entry ->> 'variant_id', '')::UUID
          AND poi.quantity_ordered = NULLIF(v_entry ->> 'quantity_ordered', '')::NUMERIC
          AND poi.unit_price_contractual = COALESCE(NULLIF(v_entry ->> 'unit_price_contractual', '')::NUMERIC, 0)
        ORDER BY poi.created_at, poi.id
        LIMIT 1;

        IF v_line_id IS NULL THEN
            CONTINUE;
        END IF;

        UPDATE public.purchase_order_items poi
        SET is_promotional = v_promo.is_promotional,
            promo_group_id = CASE
                WHEN v_promo.is_promotional THEN COALESCE(v_promo.promo_group_id, poi.promo_group_id, gen_random_uuid())
                ELSE NULL
            END,
            cost_allocation_method = COALESCE(v_promo.cost_allocation_method, poi.cost_allocation_method),
            promotional_category = COALESCE(v_promo.promotional_category, v_default_category),
            linked_parent_line_id = v_promo.linked_parent_line_id,
            updated_at = NOW()
        WHERE poi.id = v_line_id
          AND poi.tenant_id = v_tenant_id;
    END LOOP;

    FOR v_entry IN SELECT value FROM jsonb_array_elements(p_lines)
    LOOP
        v_parent_variant := NULLIF(v_entry ->> 'linked_parent_variant_id', '')::UUID;
        IF v_parent_variant IS NULL THEN
            CONTINUE;
        END IF;

        SELECT poi.id INTO v_line_id
        FROM public.purchase_order_items poi
        WHERE poi.purchase_order_id = p_po_id
          AND poi.tenant_id = v_tenant_id
          AND poi.variant_id = NULLIF(v_entry ->> 'variant_id', '')::UUID
          AND poi.is_promotional = TRUE
        LIMIT 1;

        SELECT poi.id INTO v_parent_line_id
        FROM public.purchase_order_items poi
        WHERE poi.purchase_order_id = p_po_id
          AND poi.tenant_id = v_tenant_id
          AND poi.variant_id = v_parent_variant
          AND COALESCE(poi.is_promotional, FALSE) = FALSE
        LIMIT 1;

        IF v_line_id IS NOT NULL AND v_parent_line_id IS NOT NULL THEN
            UPDATE public.purchase_order_items
            SET linked_parent_line_id = v_parent_line_id,
                updated_at = NOW()
            WHERE id = v_line_id
              AND tenant_id = v_tenant_id
              AND linked_parent_line_id IS NULL;
        END IF;
    END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.purchase_order_items_promo_defaults()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
BEGIN
    IF NEW.unit_price_contractual = 0 THEN
        NEW.is_promotional := TRUE;
    END IF;

    IF NEW.is_promotional AND NEW.promotional_category IS NULL THEN
        NEW.promotional_category := COALESCE(
            private.get_procurement_control_text(NEW.tenant_id, 'promo_default_category', 'FREE_GOODS'),
            'FREE_GOODS'
        );
    END IF;

    IF NEW.cost_allocation_method IS NULL OR btrim(NEW.cost_allocation_method) = '' THEN
        NEW.cost_allocation_method := 'LANDED_MARKET_RATIO';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS purchase_order_items_promo_defaults ON public.purchase_order_items;
CREATE TRIGGER purchase_order_items_promo_defaults
    BEFORE INSERT OR UPDATE ON public.purchase_order_items
    FOR EACH ROW
    EXECUTE FUNCTION public.purchase_order_items_promo_defaults();

-- --------------------------------------------------------------------
-- 6. PROMO POOL UPSERT HELPER
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.upsert_promo_inventory_balance(
    p_tenant_id UUID,
    p_location_id UUID,
    p_item_id UUID,
    p_variant_id UUID,
    p_quarantine_type public.promo_quarantine_type,
    p_quantity NUMERIC,
    p_entitlement_id UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
BEGIN
    IF p_entitlement_id IS NULL THEN
        INSERT INTO public.promo_inventory_balances (
            tenant_id, location_id, item_id, variant_id, quarantine_type, quantity_on_hand
        )
        VALUES (
            p_tenant_id, p_location_id, p_item_id, p_variant_id, p_quarantine_type, p_quantity
        )
        ON CONFLICT (tenant_id, location_id, item_id, variant_id, quarantine_type)
            WHERE entitlement_id IS NULL
        DO UPDATE SET
            quantity_on_hand = public.promo_inventory_balances.quantity_on_hand + EXCLUDED.quantity_on_hand,
            updated_at = NOW();
    ELSE
        INSERT INTO public.promo_inventory_balances (
            tenant_id, location_id, item_id, variant_id, quarantine_type, quantity_on_hand, entitlement_id
        )
        VALUES (
            p_tenant_id, p_location_id, p_item_id, p_variant_id, p_quarantine_type, p_quantity, p_entitlement_id
        )
        ON CONFLICT (tenant_id, location_id, item_id, variant_id, quarantine_type, entitlement_id)
            WHERE entitlement_id IS NOT NULL
        DO UPDATE SET
            quantity_on_hand = public.promo_inventory_balances.quantity_on_hand + EXCLUDED.quantity_on_hand,
            updated_at = NOW();
    END IF;
END;
$$;

-- --------------------------------------------------------------------
-- 7. goods_receipt_items_post_stocking (replacement)
-- --------------------------------------------------------------------
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
    v_stock_qty NUMERIC(15, 4);
    v_quarantine public.promo_quarantine_type;
BEGIN
    SELECT * INTO v_gr
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

    v_stock_qty := CASE
        WHEN COALESCE(NEW.quantity_accepted, 0) > 0 THEN NEW.quantity_accepted
        ELSE NEW.quantity_received
    END;

    IF NEW.is_promotional OR (v_gr.purchase_order_id IS NULL AND NEW.raw_unit_cost = 0) THEN
        v_quarantine := CASE
            WHEN v_gr.purchase_order_id IS NULL THEN 'NOT_FOR_RESALE_SAMPLE'::public.promo_quarantine_type
            ELSE 'PROMOTIONAL_HOLD'::public.promo_quarantine_type
        END;

        PERFORM private.upsert_promo_inventory_balance(
            NEW.tenant_id,
            v_gr.destination_location_id,
            NEW.item_id,
            NEW.variant_id,
            v_quarantine,
            v_stock_qty,
            NEW.entitlement_id
        );

        RETURN NEW;
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
        v_stock_qty,
        NEW.total_final_landed_cost,
        v_reference,
        v_gr.created_by
    );

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS goods_receipt_items_apply_stocking ON public.goods_receipt_items;
CREATE TRIGGER goods_receipt_items_apply_stocking
    AFTER INSERT ON public.goods_receipt_items
    FOR EACH ROW
    EXECUTE FUNCTION public.goods_receipt_items_post_stocking();

-- --------------------------------------------------------------------
-- 8. private.restate_promo_bundle_mwac
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.restate_promo_bundle_mwac(
    p_entitlement_id UUID,
    p_gr_id UUID,
    p_created_by UUID
)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_tenant_id UUID;
    v_ent public.promo_fulfillment_entitlements%ROWTYPE;
    v_paid_line public.purchase_order_items%ROWTYPE;
    v_promo_line public.purchase_order_items%ROWTYPE;
    v_gr public.goods_receipts%ROWTYPE;
    v_paid_std NUMERIC(15, 4);
    v_promo_std NUMERIC(15, 4);
    v_paid_qty NUMERIC(15, 4);
    v_promo_qty NUMERIC(15, 4);
    v_total_paid_cost NUMERIC(20, 8) := 0;
    v_market_total NUMERIC(20, 8) := 0;
    v_new_paid_unit NUMERIC(15, 4);
    v_on_hand NUMERIC(15, 4);
    v_cost_before NUMERIC(15, 4);
    v_reference TEXT;
    v_restate_delta NUMERIC(15, 4) := 0;
BEGIN
    v_tenant_id := private.current_tenant_id();
    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'tenant context missing from session';
    END IF;

    SELECT * INTO v_ent
    FROM public.promo_fulfillment_entitlements
    WHERE id = p_entitlement_id AND tenant_id = v_tenant_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'promotional entitlement not found';
    END IF;

    SELECT * INTO v_paid_line FROM public.purchase_order_items
    WHERE id = v_ent.paid_line_id AND tenant_id = v_tenant_id;

    SELECT * INTO v_promo_line FROM public.purchase_order_items
    WHERE id = v_ent.promo_line_id AND tenant_id = v_tenant_id;

    SELECT * INTO v_gr FROM public.goods_receipts
    WHERE id = p_gr_id AND tenant_id = v_tenant_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'goods receipt not found';
    END IF;

    SELECT COALESCE(poi.quantity_received, 0)
    INTO v_paid_qty
    FROM public.purchase_order_items poi
    WHERE poi.id = v_ent.paid_line_id AND poi.tenant_id = v_tenant_id;

    v_promo_qty := v_ent.received_qty;

    SELECT COALESCE(i.standard_cost, v_paid_line.unit_price_contractual, 0)
    INTO v_paid_std
    FROM public.items i
    WHERE i.id = v_paid_line.item_id AND i.tenant_id = v_tenant_id;

    SELECT COALESCE(i.standard_cost, 0)
    INTO v_promo_std
    FROM public.items i
    WHERE i.id = v_promo_line.item_id AND i.tenant_id = v_tenant_id;

    SELECT COALESCE(SUM(gri.total_final_landed_cost * gri.quantity_received), 0)
    INTO v_total_paid_cost
    FROM public.goods_receipt_items gri
    WHERE gri.tenant_id = v_tenant_id
      AND gri.po_item_id = v_ent.paid_line_id
      AND COALESCE(gri.is_promotional, FALSE) = FALSE;

    IF COALESCE(v_paid_line.cost_allocation_method, 'LANDED_MARKET_RATIO') <> 'LANDED_MARKET_RATIO' THEN
        RETURN 0;
    END IF;

    v_market_total := (GREATEST(v_paid_std, 0) * GREATEST(v_paid_qty, 0))
                    + (GREATEST(v_promo_std, 0) * GREATEST(v_promo_qty, 0));

    IF v_market_total <= 0 OR v_paid_qty <= 0 THEN
        RETURN 0;
    END IF;

    v_new_paid_unit := private.money_round(
        (v_total_paid_cost * (GREATEST(v_paid_std, 0) * GREATEST(v_paid_qty, 0)) / v_market_total)
        / GREATEST(v_paid_qty, 1)
    );

    SELECT total_quantity_on_hand, current_average_cost
    INTO v_on_hand, v_cost_before
    FROM public.item_valuations
    WHERE tenant_id = v_tenant_id
      AND location_id = v_gr.destination_location_id
      AND item_id = v_paid_line.item_id
      AND variant_id IS NOT DISTINCT FROM v_paid_line.variant_id;

    IF COALESCE(v_on_hand, 0) <= 0 THEN
        RETURN 0;
    END IF;

    v_reference := v_gr.voucher_number || '|PROMO-RESTATE';

    INSERT INTO public.inventory_ledger (
        tenant_id, item_id, variant_id, location_id,
        transaction_type, quantity, cost_at_transaction,
        reference_document, created_by
    )
    VALUES (
        v_tenant_id, v_paid_line.item_id, v_paid_line.variant_id, v_gr.destination_location_id,
        'COST_RESTATEMENT', 0, v_new_paid_unit,
        v_reference, COALESCE(p_created_by, v_gr.created_by)
    );

    PERFORM private.record_valuation_audit(
        v_tenant_id, v_gr.destination_location_id, v_paid_line.item_id, v_paid_line.variant_id,
        'grn_promo_bundle_cost_adjusted', 'COST_RESTATEMENT',
        v_on_hand, v_on_hand, v_cost_before, v_new_paid_unit,
        v_reference, 'GRN'::public.document_posting_document_type, p_gr_id, p_created_by
    );

    v_restate_delta := private.money_round(v_new_paid_unit - COALESCE(v_cost_before, 0));
    RETURN v_restate_delta;
END;
$$;

-- --------------------------------------------------------------------
-- 9. public.write_off_promotional_entitlement
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.write_off_promotional_entitlement(
    p_entitlement_id UUID,
    p_reason TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_tenant_id UUID;
    v_ent public.promo_fulfillment_entitlements%ROWTYPE;
    v_prior public.promo_entitlement_status;
BEGIN
    v_tenant_id := private.current_tenant_id();
    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'tenant context missing from session';
    END IF;

    SELECT * INTO v_ent
    FROM public.promo_fulfillment_entitlements
    WHERE id = p_entitlement_id AND tenant_id = v_tenant_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'promotional entitlement not found';
    END IF;

    IF v_ent.status = 'WRITTEN_OFF'::public.promo_entitlement_status THEN
        RETURN;
    END IF;

    v_prior := v_ent.status;

    UPDATE public.promo_fulfillment_entitlements
    SET status = 'WRITTEN_OFF'::public.promo_entitlement_status,
        written_off_at = NOW(),
        written_off_reason = NULLIF(btrim(p_reason), ''),
        updated_at = NOW()
    WHERE id = p_entitlement_id;

    UPDATE public.promo_inventory_balances
    SET quantity_on_hand = 0,
        updated_at = NOW()
    WHERE tenant_id = v_tenant_id
      AND entitlement_id = p_entitlement_id;

    INSERT INTO public.promo_entitlement_events (
        tenant_id, entitlement_id, event_type, prior_status, new_status, detail
    )
    VALUES (
        v_tenant_id, p_entitlement_id, 'WRITTEN_OFF', v_prior,
        'WRITTEN_OFF'::public.promo_entitlement_status,
        jsonb_build_object('reason', NULLIF(btrim(p_reason), ''))
    );
END;
$$;

REVOKE ALL ON FUNCTION public.write_off_promotional_entitlement(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.write_off_promotional_entitlement(UUID, TEXT) TO authenticated;

-- --------------------------------------------------------------------
-- 10. public.issue_purchase_order (JSONB + entitlements)
-- --------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.issue_purchase_order(UUID);

CREATE OR REPLACE FUNCTION public.issue_purchase_order(p_purchase_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_tenant_id UUID;
    v_po RECORD;
    v_line_count INTEGER;
    v_promo_line RECORD;
    v_paid_line_id UUID;
    v_entitlement_count INTEGER := 0;
    v_inserted_entitlements INTEGER := 0;
    v_steps JSONB := '[]'::jsonb;
BEGIN
    v_tenant_id := private.current_tenant_id();
    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'tenant context missing from session';
    END IF;

    IF NOT private.can_edit_purchase_orders() THEN
        RAISE EXCEPTION 'purchase order edit permission required';
    END IF;

    IF p_purchase_order_id IS NULL THEN
        RAISE EXCEPTION 'purchase order id is required';
    END IF;

    SELECT * INTO v_po
    FROM public.purchase_orders
    WHERE id = p_purchase_order_id AND tenant_id = v_tenant_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'purchase order not found';
    END IF;

    IF v_po.document_status <> 'DRAFT'::public.purchase_document_status THEN
        RAISE EXCEPTION 'only draft purchase orders can be issued';
    END IF;

    SELECT COUNT(*) INTO v_line_count
    FROM public.purchase_order_items
    WHERE purchase_order_id = p_purchase_order_id AND tenant_id = v_tenant_id;

    IF v_line_count < 1 THEN
        RAISE EXCEPTION 'purchase order must have at least one line before issue';
    END IF;

    UPDATE public.purchase_orders
    SET document_status = 'ISSUED_ACTIVE'::public.purchase_document_status,
        updated_at = NOW()
    WHERE id = p_purchase_order_id;

    v_steps := private.append_posting_step(v_steps, 'po_status_issued', 'success', v_po.voucher_number);

    FOR v_promo_line IN
        SELECT poi.*
        FROM public.purchase_order_items poi
        WHERE poi.purchase_order_id = p_purchase_order_id
          AND poi.tenant_id = v_tenant_id
          AND COALESCE(poi.is_promotional, FALSE) = TRUE
    LOOP
        v_paid_line_id := v_promo_line.linked_parent_line_id;

        IF v_paid_line_id IS NULL THEN
            SELECT poi.id INTO v_paid_line_id
            FROM public.purchase_order_items poi
            WHERE poi.purchase_order_id = p_purchase_order_id
              AND poi.tenant_id = v_tenant_id
              AND poi.promo_group_id IS NOT DISTINCT FROM v_promo_line.promo_group_id
              AND COALESCE(poi.is_promotional, FALSE) = FALSE
            LIMIT 1;
        END IF;

        IF v_paid_line_id IS NULL THEN
            CONTINUE;
        END IF;

        WITH ins AS (
            INSERT INTO public.promo_fulfillment_entitlements (
                tenant_id, purchase_order_id, paid_line_id, promo_line_id,
                promo_group_id, expected_qty, received_qty, status
            )
            VALUES (
                v_tenant_id, p_purchase_order_id, v_paid_line_id, v_promo_line.id,
                COALESCE(v_promo_line.promo_group_id, gen_random_uuid()),
                v_promo_line.quantity_ordered, 0,
                'OPEN'::public.promo_entitlement_status
            )
            ON CONFLICT (tenant_id, promo_line_id) DO NOTHING
            RETURNING 1
        )
        SELECT COUNT(*) INTO v_inserted_entitlements FROM ins;

        v_entitlement_count := v_entitlement_count + COALESCE(v_inserted_entitlements, 0);
    END LOOP;

    IF v_entitlement_count > 0 THEN
        v_steps := private.append_posting_step(
            v_steps, 'po_promo_commitments_created', 'success', v_entitlement_count::TEXT || ' entitlement(s)'
        );
    ELSE
        v_steps := private.append_posting_step(v_steps, 'po_promo_commitments_created', 'skipped', NULL);
    END IF;

    v_steps := private.append_posting_step(v_steps, 'po_receipt_eligibility_opened', 'success', NULL);

    INSERT INTO public.document_posting_runs (
        tenant_id, document_type, document_id, overall_status, steps, posted_by
    )
    VALUES (
        v_tenant_id, 'PO'::public.document_posting_document_type, p_purchase_order_id, 'success', v_steps, NULL
    );

    RETURN jsonb_build_object('purchase_order_id', p_purchase_order_id, 'steps', v_steps);
END;
$$;

REVOKE ALL ON FUNCTION public.issue_purchase_order(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.issue_purchase_order(UUID) TO authenticated;

-- --------------------------------------------------------------------
-- 11. ENTitlement update helper for GRN
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.process_grn_promo_entitlement(
    p_tenant_id UUID,
    p_gr_id UUID,
    p_gr_item_id UUID,
    p_po_item_id UUID,
    p_qty NUMERIC,
    p_created_by UUID,
    OUT p_entitlement_id UUID,
    OUT p_new_status public.promo_entitlement_status,
    OUT p_restate_delta NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_ent public.promo_fulfillment_entitlements%ROWTYPE;
    v_prior public.promo_entitlement_status;
BEGIN
    p_entitlement_id := NULL;
    p_new_status := NULL;
    p_restate_delta := 0;

    SELECT * INTO v_ent
    FROM public.promo_fulfillment_entitlements
    WHERE tenant_id = p_tenant_id AND promo_line_id = p_po_item_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN;
    END IF;

    v_prior := v_ent.status;
    p_entitlement_id := v_ent.id;

    UPDATE public.promo_fulfillment_entitlements
    SET received_qty = LEAST(expected_qty, received_qty + p_qty),
        status = CASE
            WHEN LEAST(expected_qty, received_qty + p_qty) >= expected_qty THEN 'CLOSED'::public.promo_entitlement_status
            WHEN received_qty + p_qty > 0 THEN 'PARTIAL'::public.promo_entitlement_status
            ELSE 'OPEN'::public.promo_entitlement_status
        END,
        updated_at = NOW()
    WHERE id = v_ent.id
    RETURNING status INTO p_new_status;

    INSERT INTO public.promo_entitlement_receipt_links (
        tenant_id, entitlement_id, goods_receipt_id, goods_receipt_item_id, quantity_linked
    )
    VALUES (p_tenant_id, v_ent.id, p_gr_id, p_gr_item_id, p_qty);

    INSERT INTO public.promo_entitlement_events (
        tenant_id, entitlement_id, event_type, quantity_delta,
        goods_receipt_id, goods_receipt_item_id, prior_status, new_status, created_by
    )
    VALUES (
        p_tenant_id, v_ent.id, 'RECEIPT_LINKED', p_qty,
        p_gr_id, p_gr_item_id, v_prior, p_new_status, p_created_by
    );

    IF p_new_status = 'CLOSED'::public.promo_entitlement_status THEN
        p_restate_delta := private.restate_promo_bundle_mwac(v_ent.id, p_gr_id, p_created_by);
    END IF;
END;
$$;

-- --------------------------------------------------------------------
-- 12. public.post_goods_receipt (full promo + landed charges)
-- --------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.post_goods_receipt(UUID, UUID, JSONB, UUID, TEXT, DATE, VARCHAR, NUMERIC, NUMERIC, NUMERIC, NUMERIC);

CREATE OR REPLACE FUNCTION public.post_goods_receipt(
    p_destination_location_id UUID,
    p_purchase_order_id UUID,
    p_lines JSONB,
    p_created_by UUID,
    p_bill_of_entry_number TEXT DEFAULT NULL,
    p_bill_of_entry_date DATE DEFAULT NULL,
    p_port_code VARCHAR(10) DEFAULT NULL,
    p_exchange_rate NUMERIC(15, 6) DEFAULT NULL,
    p_assessable_value NUMERIC(15, 4) DEFAULT NULL,
    p_customs_duty_amount NUMERIC(15, 4) DEFAULT NULL,
    p_import_igst_amount NUMERIC(15, 4) DEFAULT NULL,
    p_landed_charges JSONB DEFAULT '[]'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_tenant_id UUID;
    v_location RECORD;
    v_po public.purchase_orders%ROWTYPE;
    v_gr_id UUID;
    v_voucher_number TEXT;
    v_entry JSONB;
    v_charge JSONB;
    v_variant_id UUID;
    v_po_item_id UUID;
    v_item_id UUID;
    v_gr_item_id UUID;
    v_qty NUMERIC(15, 4);
    v_unit_cost NUMERIC(15, 4);
    v_is_promotional BOOLEAN;
    v_po_item public.purchase_order_items%ROWTYPE;
    v_open_qty NUMERIC(15, 4);
    v_line_count INTEGER := 0;
    v_total_qty NUMERIC(15, 4) := 0;
    v_track_inventory BOOLEAN;
    v_tracking public.item_tracking_mode;
    v_total_line_value NUMERIC(20, 8) := 0;
    v_total_line_qty NUMERIC(20, 8) := 0;
    v_line_value NUMERIC(20, 8);
    v_import_igst_header NUMERIC(15, 4) := GREATEST(COALESCE(p_import_igst_amount, 0), 0);
    v_customs_duty_header NUMERIC(15, 4) := GREATEST(COALESCE(p_customs_duty_amount, 0), 0);
    v_line_import_igst NUMERIC(15, 4);
    v_line_customs_duty NUMERIC(15, 4);
    v_allocated_landed NUMERIC(15, 4);
    v_final_landed NUMERIC(15, 4);
    v_exchange_rate NUMERIC(15, 6) := GREATEST(COALESCE(p_exchange_rate, 1), 0.000001);
    v_steps JSONB := '[]'::jsonb;
    v_qc_required BOOLEAN;
    v_location_label TEXT;
    v_allow_zero_cost BOOLEAN;
    v_has_promo_lines BOOLEAN := FALSE;
    v_has_orphan_sample BOOLEAN := FALSE;
    v_landed_charge_total NUMERIC(15, 4) := 0;
    v_charge_amount NUMERIC(15, 4);
    v_alloc_method TEXT;
    v_weight_total NUMERIC(20, 8) := 0;
    v_line_weight NUMERIC(20, 8);
    v_extra_landed NUMERIC(15, 4);
    v_entitlement_id UUID;
    v_ent_status public.promo_entitlement_status;
    v_restate_delta NUMERIC(15, 4);
    v_ent_closed_count INTEGER := 0;
    v_ent_partial_count INTEGER := 0;
    v_restate_total NUMERIC(15, 4) := 0;
BEGIN
    v_tenant_id := private.current_tenant_id();
    IF v_tenant_id IS NULL THEN RAISE EXCEPTION 'tenant context missing from session'; END IF;
    IF p_created_by IS NULL THEN RAISE EXCEPTION 'created_by is required'; END IF;
    IF p_destination_location_id IS NULL THEN RAISE EXCEPTION 'destination location is required'; END IF;
    IF p_lines IS NULL OR jsonb_typeof(p_lines) IS DISTINCT FROM 'array' OR jsonb_array_length(p_lines) = 0 THEN
        RAISE EXCEPTION 'at least one receipt line is required';
    END IF;

    v_qc_required := private.get_procurement_control_flag(v_tenant_id, 'is_qc_required_before_stocking');
    v_allow_zero_cost := private.get_procurement_control_flag(v_tenant_id, 'allow_zero_cost_receipts');
    v_alloc_method := COALESCE(
        private.get_procurement_control_text(v_tenant_id, 'landed_cost_allocation_method', 'BY_VALUE'),
        'BY_VALUE'
    );

    IF p_landed_charges IS NOT NULL AND jsonb_typeof(p_landed_charges) = 'array' THEN
        FOR v_charge IN SELECT value FROM jsonb_array_elements(p_landed_charges)
        LOOP
            v_landed_charge_total := v_landed_charge_total
                + GREATEST(COALESCE(NULLIF(v_charge ->> 'amount', '')::NUMERIC, 0), 0);
        END LOOP;
    END IF;

    SELECT id, code, name, is_stock_holding, presence_type
    INTO v_location FROM public.tenant_locations
    WHERE id = p_destination_location_id AND tenant_id = v_tenant_id AND is_active = TRUE;
    IF NOT FOUND THEN RAISE EXCEPTION 'destination location not found'; END IF;
    IF NOT COALESCE(v_location.is_stock_holding, FALSE) OR v_location.presence_type = 'VIRTUAL' THEN
        RAISE EXCEPTION 'destination location cannot hold inventory';
    END IF;

    v_location_label := COALESCE(v_location.name, v_location.code, 'location');

    IF p_purchase_order_id IS NOT NULL THEN
        SELECT * INTO v_po FROM public.purchase_orders
        WHERE id = p_purchase_order_id AND tenant_id = v_tenant_id;
        IF NOT FOUND THEN RAISE EXCEPTION 'purchase order not found'; END IF;
        IF v_po.document_status NOT IN (
            'ISSUED_ACTIVE'::public.purchase_document_status,
            'PARTIALLY_FULFILLED'::public.purchase_document_status
        ) THEN RAISE EXCEPTION 'purchase order is not open for receiving'; END IF;
        IF v_po.destination_location_id <> p_destination_location_id THEN
            RAISE EXCEPTION 'destination location must match purchase order destination';
        END IF;
        IF v_po.tax_supply_nature = 'IMPORT_GOODS' THEN
            IF p_bill_of_entry_number IS NULL OR btrim(p_bill_of_entry_number) = '' THEN
                RAISE EXCEPTION 'bill of entry number is required for import goods receipt';
            END IF;
            IF p_bill_of_entry_date IS NULL THEN
                RAISE EXCEPTION 'bill of entry date is required for import goods receipt';
            END IF;
        END IF;
    END IF;

    FOR v_entry IN SELECT value FROM jsonb_array_elements(p_lines)
    LOOP
        v_qty := NULLIF(v_entry ->> 'quantity_received', '')::NUMERIC;
        v_unit_cost := COALESCE(NULLIF(v_entry ->> 'raw_unit_cost', '')::NUMERIC, 0);
        v_is_promotional := COALESCE((v_entry ->> 'is_promotional')::BOOLEAN, FALSE);
        IF v_qty IS NULL OR v_qty <= 0 THEN CONTINUE; END IF;
        IF v_unit_cost <= 0 AND NOT (v_is_promotional OR v_allow_zero_cost OR p_purchase_order_id IS NULL) THEN CONTINUE; END IF;
        IF v_unit_cost > 0 THEN
            v_total_line_value := v_total_line_value + (v_qty * v_unit_cost);
        END IF;
        v_total_line_qty := v_total_line_qty + v_qty;
    END LOOP;

    v_voucher_number := public.generate_next_voucher_string(
        v_tenant_id, 'GOODS_RECEIPT_NOTE'::public.document_voucher_type, NULL, p_destination_location_id
    );

    INSERT INTO public.goods_receipts (
        tenant_id, destination_location_id, purchase_order_id, voucher_number, created_by,
        is_qc_pending,
        tax_supply_nature, tax_mechanism,
        bill_of_entry_number, bill_of_entry_date, port_code,
        exchange_rate, assessable_value, customs_duty_amount, import_igst_amount
    ) VALUES (
        v_tenant_id, p_destination_location_id, p_purchase_order_id, v_voucher_number, p_created_by,
        v_qc_required,
        CASE WHEN p_purchase_order_id IS NOT NULL THEN v_po.tax_supply_nature ELSE NULL END,
        CASE WHEN p_purchase_order_id IS NOT NULL THEN v_po.tax_mechanism ELSE NULL END,
        NULLIF(btrim(p_bill_of_entry_number), ''),
        p_bill_of_entry_date,
        NULLIF(btrim(p_port_code), ''),
        v_exchange_rate,
        GREATEST(COALESCE(p_assessable_value, 0), 0),
        v_customs_duty_header,
        v_import_igst_header
    ) RETURNING id INTO v_gr_id;

    v_steps := private.append_posting_step(v_steps, 'grn_receipt_recorded', 'success', v_voucher_number);

    IF p_landed_charges IS NOT NULL AND jsonb_typeof(p_landed_charges) = 'array' THEN
        FOR v_charge IN SELECT value FROM jsonb_array_elements(p_landed_charges)
        LOOP
            v_charge_amount := GREATEST(COALESCE(NULLIF(v_charge ->> 'amount', '')::NUMERIC, 0), 0);
            IF v_charge_amount <= 0 THEN CONTINUE; END IF;
            INSERT INTO public.goods_receipt_landed_charges (
                tenant_id, goods_receipt_id, charge_type, description, amount, allocation_method
            )
            VALUES (
                v_tenant_id, v_gr_id,
                COALESCE(NULLIF(btrim(v_charge ->> 'charge_type'), ''), 'FREIGHT'),
                NULLIF(btrim(v_charge ->> 'description'), ''),
                v_charge_amount,
                COALESCE(NULLIF(btrim(v_charge ->> 'allocation_method'), ''), v_alloc_method)
            );
        END LOOP;
    END IF;

    FOR v_entry IN SELECT value FROM jsonb_array_elements(p_lines)
    LOOP
        v_variant_id := NULLIF(v_entry ->> 'variant_id', '')::UUID;
        v_po_item_id := NULLIF(v_entry ->> 'po_item_id', '')::UUID;
        v_qty := NULLIF(v_entry ->> 'quantity_received', '')::NUMERIC;
        v_unit_cost := COALESCE(NULLIF(v_entry ->> 'raw_unit_cost', '')::NUMERIC, 0);
        v_is_promotional := COALESCE((v_entry ->> 'is_promotional')::BOOLEAN, FALSE);

        IF v_variant_id IS NULL OR v_qty IS NULL OR v_qty <= 0 THEN
            RAISE EXCEPTION 'invalid receipt line';
        END IF;

        IF v_unit_cost <= 0 AND NOT (v_is_promotional OR v_allow_zero_cost OR p_purchase_order_id IS NULL) THEN
            RAISE EXCEPTION 'unit cost must be greater than zero';
        END IF;

        IF p_purchase_order_id IS NULL AND v_unit_cost = 0 THEN
            v_has_orphan_sample := TRUE;
            v_is_promotional := TRUE;
        END IF;

        IF v_is_promotional THEN v_has_promo_lines := TRUE; END IF;

        SELECT iv.item_id, i.track_inventory, i.tracking_mode
        INTO v_item_id, v_track_inventory, v_tracking
        FROM public.item_variants iv
        INNER JOIN public.items i ON i.id = iv.item_id AND i.tenant_id = iv.tenant_id
        WHERE iv.id = v_variant_id AND iv.tenant_id = v_tenant_id AND iv.is_active = TRUE;
        IF NOT FOUND THEN RAISE EXCEPTION 'variant % not found', v_variant_id; END IF;
        IF NOT COALESCE(v_track_inventory, FALSE) THEN RAISE EXCEPTION 'item does not track inventory'; END IF;
        IF v_tracking IS DISTINCT FROM 'NONE'::public.item_tracking_mode THEN
            RAISE EXCEPTION 'lot and serial tracking are not supported in goods receipts yet';
        END IF;

        IF p_purchase_order_id IS NOT NULL THEN
            IF v_po_item_id IS NULL THEN RAISE EXCEPTION 'po_item_id is required when receiving against a purchase order'; END IF;
            SELECT * INTO v_po_item FROM public.purchase_order_items
            WHERE id = v_po_item_id AND tenant_id = v_tenant_id AND purchase_order_id = p_purchase_order_id;
            IF NOT FOUND THEN RAISE EXCEPTION 'purchase order line not found'; END IF;
            IF v_po_item.variant_id IS DISTINCT FROM v_variant_id THEN RAISE EXCEPTION 'variant does not match purchase order line'; END IF;
            IF COALESCE(v_po_item.is_promotional, FALSE) THEN v_is_promotional := TRUE; END IF;
            v_open_qty := v_po_item.quantity_ordered - v_po_item.quantity_received;
            IF v_qty > v_open_qty THEN RAISE EXCEPTION 'quantity_received exceeds open purchase order quantity'; END IF;
        END IF;

        v_line_value := v_qty * GREATEST(v_unit_cost, 0);
        IF v_total_line_value > 0 AND v_unit_cost > 0 THEN
            v_line_import_igst := private.money_round(v_import_igst_header * (v_line_value / v_total_line_value) / v_qty);
            v_line_customs_duty := private.money_round(v_customs_duty_header * (v_line_value / v_total_line_value) / v_qty);
        ELSE
            v_line_import_igst := 0;
            v_line_customs_duty := 0;
        END IF;

        v_extra_landed := 0;
        IF v_landed_charge_total > 0 AND NOT v_is_promotional THEN
            IF v_alloc_method = 'BY_QUANTITY' AND v_total_line_qty > 0 THEN
                v_extra_landed := private.money_round((v_landed_charge_total * v_qty / v_total_line_qty) / v_qty);
            ELSIF v_alloc_method = 'BY_VALUE' AND v_total_line_value > 0 AND v_unit_cost > 0 THEN
                v_extra_landed := private.money_round((v_landed_charge_total * v_line_value / v_total_line_value) / v_qty);
            ELSIF v_alloc_method = 'BY_WEIGHT' THEN
                SELECT COALESCE(iv.dead_weight_kg, 0) * v_qty INTO v_line_weight
                FROM public.item_variants iv WHERE iv.id = v_variant_id;
                SELECT COALESCE(SUM(COALESCE(iv.dead_weight_kg, 0) * NULLIF(e.value ->> 'quantity_received', '')::NUMERIC), 0)
                INTO v_weight_total
                FROM jsonb_array_elements(p_lines) e;
                IF v_weight_total > 0 THEN
                    v_extra_landed := private.money_round((v_landed_charge_total * v_line_weight / v_weight_total) / v_qty);
                END IF;
            END IF;
        END IF;

        v_allocated_landed := v_line_import_igst + v_line_customs_duty + v_extra_landed;
        v_final_landed := private.money_round(GREATEST(v_unit_cost, 0) + v_allocated_landed);

        v_entitlement_id := NULL;
        IF v_is_promotional AND p_purchase_order_id IS NOT NULL AND v_po_item_id IS NOT NULL THEN
            SELECT pfe.id INTO v_entitlement_id
            FROM public.promo_fulfillment_entitlements pfe
            WHERE pfe.tenant_id = v_tenant_id AND pfe.promo_line_id = v_po_item_id;
        END IF;

        INSERT INTO public.goods_receipt_items (
            tenant_id, goods_receipt_id, po_item_id, item_id, variant_id,
            quantity_received, quantity_accepted, quantity_rejected,
            raw_unit_cost, allocated_landed_cost, total_final_landed_cost,
            import_igst_amount, customs_duty_amount,
            is_promotional, linked_parent_line_id, entitlement_id
        ) VALUES (
            v_tenant_id, v_gr_id, v_po_item_id, v_item_id, v_variant_id,
            v_qty, v_qty, 0,
            GREATEST(v_unit_cost, 0), v_allocated_landed, v_final_landed,
            private.money_round(v_line_import_igst * v_qty), private.money_round(v_line_customs_duty * v_qty),
            v_is_promotional,
            CASE WHEN p_purchase_order_id IS NOT NULL THEN v_po_item.linked_parent_line_id ELSE NULLIF(v_entry ->> 'linked_parent_line_id', '')::UUID END,
            v_entitlement_id
        ) RETURNING id INTO v_gr_item_id;

        IF p_purchase_order_id IS NOT NULL AND v_po_item_id IS NOT NULL THEN
            UPDATE public.purchase_order_items SET
                quantity_received = quantity_received + v_qty, updated_at = NOW()
            WHERE id = v_po_item_id AND tenant_id = v_tenant_id;

            IF v_is_promotional THEN
                SELECT r.entitlement_id, r.new_status, r.restate_delta
                INTO v_entitlement_id, v_ent_status, v_restate_delta
                FROM private.process_grn_promo_entitlement(
                    v_tenant_id, v_gr_id, v_gr_item_id, v_po_item_id, v_qty, p_created_by
                ) AS r(entitlement_id, new_status, restate_delta);

                UPDATE public.goods_receipt_items
                SET entitlement_id = v_entitlement_id
                WHERE id = v_gr_item_id AND tenant_id = v_tenant_id;

                IF v_ent_status = 'PARTIAL'::public.promo_entitlement_status THEN
                    v_ent_partial_count := v_ent_partial_count + 1;
                ELSIF v_ent_status = 'CLOSED'::public.promo_entitlement_status THEN
                    v_ent_closed_count := v_ent_closed_count + 1;
                    v_restate_total := v_restate_total + COALESCE(v_restate_delta, 0);
                END IF;
            END IF;
        END IF;

        INSERT INTO public.item_variant_locations (tenant_id, item_id, variant_id, location_id, is_stocked, is_sellable, is_orderable)
        VALUES (v_tenant_id, v_item_id, v_variant_id, p_destination_location_id, TRUE, FALSE, FALSE)
        ON CONFLICT (variant_id, location_id) DO UPDATE SET is_stocked = TRUE, updated_at = NOW();

        v_line_count := v_line_count + 1;
        v_total_qty := v_total_qty + v_qty;
    END LOOP;

    IF v_line_count = 0 THEN RAISE EXCEPTION 'no valid receipt lines were posted'; END IF;

    v_steps := private.append_posting_step(
        v_steps, 'grn_quantities_received', 'success',
        v_total_qty::TEXT || ' units Â· ' || v_location_label
    );
    v_steps := private.append_posting_step(v_steps, 'grn_paid_stock_valued', 'success', v_line_count::TEXT || ' line(s) valued');

    IF v_has_promo_lines THEN
        v_steps := private.append_posting_step(v_steps, 'grn_free_stock_separated', 'success', NULL);
    ELSE
        v_steps := private.append_posting_step(v_steps, 'grn_free_stock_separated', 'skipped', NULL);
    END IF;

    IF v_has_orphan_sample THEN
        v_steps := private.append_posting_step(v_steps, 'grn_orphan_sample_quarantined', 'success', NULL);
    ELSE
        v_steps := private.append_posting_step(v_steps, 'grn_orphan_sample_quarantined', 'skipped', NULL);
    END IF;

    IF v_landed_charge_total > 0 THEN
        v_steps := private.append_posting_step(
            v_steps, 'grn_landed_charges_allocated', 'success', private.money_round(v_landed_charge_total)::TEXT
        );
    ELSE
        v_steps := private.append_posting_step(v_steps, 'grn_landed_charges_allocated', 'skipped', NULL);
    END IF;

    IF v_ent_partial_count > 0 THEN
        v_steps := private.append_posting_step(
            v_steps, 'grn_entitlement_partial', 'success', v_ent_partial_count::TEXT || ' bundle(s)'
        );
    ELSE
        v_steps := private.append_posting_step(v_steps, 'grn_entitlement_partial', 'skipped', NULL);
    END IF;

    IF v_ent_closed_count > 0 THEN
        v_steps := private.append_posting_step(
            v_steps, 'grn_entitlement_closed', 'success', v_ent_closed_count::TEXT || ' bundle(s)'
        );
        v_steps := private.append_posting_step(
            v_steps, 'grn_promo_bundle_cost_adjusted', 'success',
            CASE WHEN v_restate_total <> 0 THEN v_restate_total::TEXT ELSE NULL END
        );
    ELSE
        v_steps := private.append_posting_step(v_steps, 'grn_entitlement_closed', 'skipped', NULL);
        v_steps := private.append_posting_step(v_steps, 'grn_promo_bundle_cost_adjusted', 'skipped', NULL);
    END IF;

    IF v_qc_required THEN
        v_steps := private.append_posting_step(v_steps, 'grn_qc_quarantine_applied', 'success', NULL);
    ELSE
        v_steps := private.append_posting_step(v_steps, 'grn_qc_quarantine_applied', 'skipped', NULL);
    END IF;

    IF p_purchase_order_id IS NOT NULL THEN
        INSERT INTO public.purchase_order_grn_mappings (tenant_id, purchase_order_id, goods_receipt_id, mapped_by)
        VALUES (v_tenant_id, p_purchase_order_id, v_gr_id, p_created_by)
        ON CONFLICT (purchase_order_id, goods_receipt_id) DO NOTHING;

        UPDATE public.purchase_orders po SET document_status = CASE
            WHEN EXISTS (
                SELECT 1 FROM public.purchase_order_items poi
                WHERE poi.purchase_order_id = po.id AND poi.tenant_id = v_tenant_id
                  AND poi.quantity_received < poi.quantity_ordered
            ) THEN 'PARTIALLY_FULFILLED'::public.purchase_document_status
            ELSE 'FULLY_COMPLETED'::public.purchase_document_status
        END, updated_at = NOW()
        WHERE po.id = p_purchase_order_id AND po.tenant_id = v_tenant_id;

        v_steps := private.append_posting_step(v_steps, 'grn_po_fulfillment_updated', 'success', NULL);
    ELSE
        v_steps := private.append_posting_step(v_steps, 'grn_po_fulfillment_updated', 'skipped', NULL);
    END IF;

    INSERT INTO public.document_posting_runs (
        tenant_id, document_type, document_id, overall_status, steps, posted_by
    ) VALUES (
        v_tenant_id, 'GRN'::public.document_posting_document_type, v_gr_id, 'success', v_steps, p_created_by
    );

    RETURN jsonb_build_object('goods_receipt_id', v_gr_id, 'steps', v_steps);
END;
$$;

REVOKE ALL ON FUNCTION public.post_goods_receipt(UUID, UUID, JSONB, UUID, TEXT, DATE, VARCHAR, NUMERIC, NUMERIC, NUMERIC, NUMERIC, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.post_goods_receipt(UUID, UUID, JSONB, UUID, TEXT, DATE, VARCHAR, NUMERIC, NUMERIC, NUMERIC, NUMERIC, JSONB) TO authenticated;

-- --------------------------------------------------------------------
-- 13. save_purchase_invoice (multi-GRN + match status)
-- --------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.save_purchase_invoice(UUID, UUID, UUID, TEXT, JSONB, UUID, UUID, VARCHAR, NUMERIC, TEXT, DATE, VARCHAR, JSONB);

CREATE OR REPLACE FUNCTION public.save_purchase_invoice(
    p_purchase_invoice_id UUID,
    p_supplier_id UUID,
    p_billing_location_id UUID,
    p_invoice_number_vendor TEXT,
    p_lines JSONB,
    p_created_by UUID,
    p_purchase_order_id UUID DEFAULT NULL,
    p_currency_code VARCHAR(3) DEFAULT NULL,
    p_exchange_rate NUMERIC(15, 6) DEFAULT NULL,
    p_bill_of_entry_number TEXT DEFAULT NULL,
    p_bill_of_entry_date DATE DEFAULT NULL,
    p_port_code VARCHAR(10) DEFAULT NULL,
    p_custom_fields JSONB DEFAULT '{}'::jsonb,
    p_goods_receipt_ids UUID[] DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_tenant_id UUID;
    v_tenant_country TEXT;
    v_supplier RECORD;
    v_location RECORD;
    v_po RECORD;
    v_gst_ctx RECORD;
    v_invoice_id UUID;
    v_voucher TEXT;
    v_entry JSONB;
    v_item_id UUID;
    v_variant_id UUID;
    v_po_item_id UUID;
    v_qty NUMERIC(15, 4);
    v_unit_price NUMERIC(15, 4);
    v_line_gross NUMERIC(15, 4);
    v_line_tax NUMERIC(15, 4);
    v_tax_rate NUMERIC(15, 4);
    v_tax_components JSONB;
    v_total_gross NUMERIC(15, 4) := 0;
    v_total_tax NUMERIC(15, 4) := 0;
    v_supply_nature TEXT;
    v_mechanism public.gst_tax_mechanism;
    v_gr_id UUID;
    v_tolerance NUMERIC(15, 4);
    v_match_variance NUMERIC(15, 4) := 0;
    v_match_status public.purchase_invoice_match_status := 'MATCHED';
    v_po_rate NUMERIC(15, 4);
    v_steps JSONB := '[]'::jsonb;
BEGIN
    v_tenant_id := private.current_tenant_id();
    IF v_tenant_id IS NULL THEN RAISE EXCEPTION 'tenant context missing from session'; END IF;
    IF p_supplier_id IS NULL OR p_billing_location_id IS NULL THEN RAISE EXCEPTION 'supplier and billing location are required'; END IF;
    IF p_invoice_number_vendor IS NULL OR btrim(p_invoice_number_vendor) = '' THEN RAISE EXCEPTION 'vendor invoice number is required'; END IF;
    IF p_lines IS NULL OR jsonb_array_length(p_lines) = 0 THEN RAISE EXCEPTION 'at least one bill line is required'; END IF;

    v_tolerance := GREATEST(
        COALESCE(
            NULLIF(private.get_procurement_control_text(v_tenant_id, 'matching_tolerance_percentage', '2'), '')::NUMERIC,
            2
        ),
        0
    );

    SELECT upper(btrim(COALESCE(country_code, 'IN'))) INTO v_tenant_country FROM public.tenants WHERE id = v_tenant_id;

    SELECT id, type, tax_treatment, billing_country_code, billing_state
    INTO v_supplier FROM public.entities
    WHERE id = p_supplier_id AND tenant_id = v_tenant_id AND is_active = TRUE;
    IF NOT FOUND THEN RAISE EXCEPTION 'supplier not found'; END IF;

    SELECT id, state INTO v_location FROM public.tenant_locations
    WHERE id = p_billing_location_id AND tenant_id = v_tenant_id AND is_active = TRUE;
    IF NOT FOUND THEN RAISE EXCEPTION 'billing location not found'; END IF;

    IF p_purchase_order_id IS NOT NULL THEN
        SELECT tax_supply_nature, tax_mechanism, supplier_tax_treatment, supplier_country_code
        INTO v_po FROM public.purchase_orders
        WHERE id = p_purchase_order_id AND tenant_id = v_tenant_id;
        IF NOT FOUND THEN RAISE EXCEPTION 'purchase order not found'; END IF;
        v_supply_nature := v_po.tax_supply_nature;
        v_mechanism := v_po.tax_mechanism;
    ELSE
        SELECT * INTO v_gst_ctx FROM private.gst_resolve_supply_context(
            v_tenant_country, v_supplier.tax_treatment, v_supplier.billing_country_code,
            v_supplier.billing_state, v_location.state, 'PURCHASE', 'GOODS'
        ) LIMIT 1;
        v_supply_nature := v_gst_ctx.supply_nature;
        v_mechanism := v_gst_ctx.tax_mechanism;
    END IF;

    IF p_purchase_invoice_id IS NOT NULL THEN
        SELECT id INTO v_invoice_id FROM public.purchase_invoices
        WHERE id = p_purchase_invoice_id AND tenant_id = v_tenant_id;
        IF NOT FOUND THEN RAISE EXCEPTION 'purchase invoice not found'; END IF;
        DELETE FROM public.purchase_invoice_items
        WHERE purchase_invoice_id = p_purchase_invoice_id AND tenant_id = v_tenant_id;
        DELETE FROM public.purchase_invoice_receipts
        WHERE purchase_invoice_id = p_purchase_invoice_id AND tenant_id = v_tenant_id;
    ELSE
        v_voucher := public.generate_next_voucher_string(
            v_tenant_id, 'PURCHASE_INVOICE'::public.document_voucher_type, NULL, p_billing_location_id
        );
        INSERT INTO public.purchase_invoices (
            tenant_id, supplier_id, purchase_order_id, invoice_number_vendor, system_voucher_number,
            tax_treatment, tax_supply_nature, tax_mechanism,
            supplier_tax_treatment, supplier_country_code,
            billing_location_id, currency_code, exchange_rate,
            bill_of_entry_number, bill_of_entry_date, port_code,
            place_of_supply, rcm_applicable, custom_fields, created_by
        ) VALUES (
            v_tenant_id, p_supplier_id, p_purchase_order_id, btrim(p_invoice_number_vendor), v_voucher,
            v_supplier.tax_treatment, v_supply_nature, v_mechanism,
            v_supplier.tax_treatment, upper(btrim(v_supplier.billing_country_code)),
            p_billing_location_id,
            upper(btrim(COALESCE(p_currency_code, (SELECT base_currency FROM public.tenants WHERE id = v_tenant_id), 'INR'))),
            GREATEST(COALESCE(p_exchange_rate, 1), 0.000001),
            NULLIF(btrim(p_bill_of_entry_number), ''), p_bill_of_entry_date, NULLIF(btrim(p_port_code), ''),
            v_location.state,
            (v_mechanism = 'REVERSE_CHARGE'::public.gst_tax_mechanism),
            COALESCE(p_custom_fields, '{}'::jsonb), p_created_by
        ) RETURNING id INTO v_invoice_id;
    END IF;

    IF p_goods_receipt_ids IS NOT NULL THEN
        FOREACH v_gr_id IN ARRAY p_goods_receipt_ids
        LOOP
            INSERT INTO public.purchase_invoice_receipts (
                tenant_id, purchase_invoice_id, goods_receipt_id, linked_by
            )
            VALUES (v_tenant_id, v_invoice_id, v_gr_id, p_created_by)
            ON CONFLICT (tenant_id, purchase_invoice_id, goods_receipt_id) DO NOTHING;
        END LOOP;
    END IF;

    FOR v_entry IN SELECT value FROM jsonb_array_elements(p_lines)
    LOOP
        v_variant_id := NULLIF(v_entry ->> 'variant_id', '')::UUID;
        v_po_item_id := NULLIF(v_entry ->> 'purchase_order_item_id', '')::UUID;
        v_qty := NULLIF(v_entry ->> 'quantity_billed', '')::NUMERIC;
        v_unit_price := COALESCE(NULLIF(v_entry ->> 'unit_price_billed', '')::NUMERIC, 0);
        IF v_variant_id IS NULL OR v_qty IS NULL OR v_qty <= 0 THEN RAISE EXCEPTION 'invalid bill line'; END IF;

        SELECT iv.item_id INTO v_item_id FROM public.item_variants iv
        WHERE iv.id = v_variant_id AND iv.tenant_id = v_tenant_id;
        IF NOT FOUND THEN RAISE EXCEPTION 'variant not found'; END IF;

        IF v_po_item_id IS NOT NULL THEN
            SELECT poi.unit_price_contractual INTO v_po_rate
            FROM public.purchase_order_items poi
            WHERE poi.id = v_po_item_id AND poi.tenant_id = v_tenant_id;
            IF v_po_rate IS NOT NULL AND v_po_rate > 0 THEN
                v_match_variance := GREATEST(
                    v_match_variance,
                    ABS((v_unit_price - v_po_rate) / v_po_rate * 100)
                );
            END IF;
        END IF;

        SELECT rate, tax_amount, taxable_base, tax_components
        INTO v_tax_rate, v_line_tax, v_line_gross, v_tax_components
        FROM private.resolve_line_tax(
            v_item_id, v_qty, v_unit_price, 0, FALSE, v_supply_nature, v_mechanism
        ) LIMIT 1;

        v_total_gross := v_total_gross + COALESCE(v_line_gross, v_qty * v_unit_price);
        v_total_tax := v_total_tax + COALESCE(v_line_tax, 0);

        INSERT INTO public.purchase_invoice_items (
            tenant_id, purchase_invoice_id, item_id, variant_id,
            purchase_order_item_id, quantity_billed, unit_price_billed,
            line_tax_computed, tax_components_json, reverse_charge
        ) VALUES (
            v_tenant_id, v_invoice_id, v_item_id, v_variant_id,
            v_po_item_id, v_qty, v_unit_price,
            COALESCE(v_line_tax, 0), COALESCE(v_tax_components, '[]'::jsonb),
            (v_mechanism = 'REVERSE_CHARGE'::public.gst_tax_mechanism)
        );
    END LOOP;

    IF v_match_variance > v_tolerance THEN
        v_match_status := 'PPV_HOLD'::public.purchase_invoice_match_status;
    ELSIF v_match_variance > 0 THEN
        v_match_status := 'VARIANCE'::public.purchase_invoice_match_status;
    ELSE
        v_match_status := 'MATCHED'::public.purchase_invoice_match_status;
    END IF;

    UPDATE public.purchase_invoices SET
        total_gross_amount = v_total_gross,
        total_tax_amount = v_total_tax,
        total_liability_amount = v_total_gross + v_total_tax,
        match_status = v_match_status,
        updated_at = NOW()
    WHERE id = v_invoice_id;

    v_steps := private.append_posting_step(v_steps, 'bill_invoice_recorded', 'success', btrim(p_invoice_number_vendor));

    IF p_goods_receipt_ids IS NOT NULL AND array_length(p_goods_receipt_ids, 1) > 0 THEN
        v_steps := private.append_posting_step(
            v_steps, 'bill_grn_linked', 'success', array_length(p_goods_receipt_ids, 1)::TEXT || ' receipt(s)'
        );
    ELSE
        v_steps := private.append_posting_step(v_steps, 'bill_grn_linked', 'skipped', NULL);
    END IF;

    IF v_match_status = 'MATCHED'::public.purchase_invoice_match_status THEN
        v_steps := private.append_posting_step(v_steps, 'bill_three_way_match', 'success', NULL);
    ELSIF v_match_status = 'PPV_HOLD'::public.purchase_invoice_match_status THEN
        v_steps := private.append_posting_step(v_steps, 'bill_three_way_match', 'failure', 'Tolerance exceeded');
        v_steps := private.append_posting_step(v_steps, 'bill_on_hold', 'success', NULL);
    ELSE
        v_steps := private.append_posting_step(v_steps, 'bill_three_way_match', 'success', 'Within tolerance');
    END IF;

    INSERT INTO public.document_posting_runs (
        tenant_id, document_type, document_id, overall_status, steps, posted_by
    )
    VALUES (
        v_tenant_id, 'BILL'::public.document_posting_document_type, v_invoice_id,
        CASE WHEN v_match_status = 'PPV_HOLD'::public.purchase_invoice_match_status THEN 'failure' ELSE 'success' END,
        v_steps, p_created_by
    );

    RETURN v_invoice_id;
END;
$$;

REVOKE ALL ON FUNCTION public.save_purchase_invoice(UUID, UUID, UUID, TEXT, JSONB, UUID, UUID, VARCHAR, NUMERIC, TEXT, DATE, VARCHAR, JSONB, UUID[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_purchase_invoice(UUID, UUID, UUID, TEXT, JSONB, UUID, UUID, VARCHAR, NUMERIC, TEXT, DATE, VARCHAR, JSONB, UUID[]) TO authenticated;

-- --------------------------------------------------------------------
-- 14. post_promotional_reclassification
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.post_promotional_reclassification(p_batch_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_tenant_id UUID;
    v_batch public.promotional_batches%ROWTYPE;
    v_balance RECORD;
    v_gr_voucher TEXT;
    v_reference TEXT;
    v_unit_cost NUMERIC(15, 4);
    v_moved_qty NUMERIC(15, 4) := 0;
BEGIN
    v_tenant_id := private.current_tenant_id();
    IF v_tenant_id IS NULL THEN RAISE EXCEPTION 'tenant context missing from session'; END IF;

    SELECT * INTO v_batch
    FROM public.promotional_batches
    WHERE id = p_batch_id AND tenant_id = v_tenant_id
    FOR UPDATE;

    IF NOT FOUND THEN RAISE EXCEPTION 'promotional batch not found'; END IF;
    IF v_batch.status <> 'DRAFT' THEN RAISE EXCEPTION 'only draft promotional batches can be posted'; END IF;

    v_gr_voucher := 'PROMO-RECLASS-' || v_batch.batch_number;

    FOR v_balance IN
        SELECT *
        FROM public.promo_inventory_balances
        WHERE tenant_id = v_tenant_id
          AND promotional_batch_id = p_batch_id
          AND quantity_on_hand > 0
    LOOP
        v_reference := v_gr_voucher || '|' || v_balance.id::TEXT;

        SELECT COALESCE(iv.current_average_cost, i.standard_cost, 0)
        INTO v_unit_cost
        FROM public.items i
        LEFT JOIN public.item_valuations iv
            ON iv.tenant_id = i.tenant_id
           AND iv.item_id = i.id
           AND iv.variant_id IS NOT DISTINCT FROM v_balance.variant_id
           AND iv.location_id = v_balance.location_id
        WHERE i.id = v_balance.item_id AND i.tenant_id = v_tenant_id
        LIMIT 1;

        INSERT INTO public.inventory_ledger (
            tenant_id, item_id, variant_id, location_id,
            transaction_type, quantity, cost_at_transaction,
            reference_document, created_by
        )
        VALUES (
            v_tenant_id, v_balance.item_id, v_balance.variant_id, v_balance.location_id,
            'PURCHASE_RECEIPT', v_balance.quantity_on_hand, private.money_round(v_unit_cost),
            v_reference, v_batch.created_by
        );

        UPDATE public.promo_inventory_balances
        SET quantity_on_hand = 0, updated_at = NOW()
        WHERE id = v_balance.id;

        v_moved_qty := v_moved_qty + v_balance.quantity_on_hand;
    END LOOP;

    UPDATE public.promotional_batches
    SET status = 'POSTED', posted_at = NOW(), quantity_total = v_moved_qty, updated_at = NOW()
    WHERE id = p_batch_id;

    RETURN jsonb_build_object(
        'batch_id', p_batch_id,
        'quantity_reclassified', v_moved_qty,
        'status', 'POSTED'
    );
END;
$$;

REVOKE ALL ON FUNCTION public.post_promotional_reclassification(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.post_promotional_reclassification(UUID) TO authenticated;

-- --------------------------------------------------------------------
-- 15. apply_purchase_price_variance (LEAST rule)
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.apply_purchase_price_variance(p_invoice_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_tenant_id UUID;
    v_invoice public.purchase_invoices%ROWTYPE;
    v_line RECORD;
    v_po_rate NUMERIC(15, 4);
    v_gr_rate NUMERIC(15, 4);
    v_variance_per_unit NUMERIC(15, 4);
    v_on_hand NUMERIC(15, 4);
    v_adjust_qty NUMERIC(15, 4);
    v_total_adjustment NUMERIC(15, 4) := 0;
    v_cost_before NUMERIC(15, 4);
    v_new_cost NUMERIC(15, 4);
    v_reference TEXT;
    v_steps JSONB := '[]'::jsonb;
BEGIN
    v_tenant_id := private.current_tenant_id();
    IF v_tenant_id IS NULL THEN RAISE EXCEPTION 'tenant context missing from session'; END IF;

    SELECT * INTO v_invoice
    FROM public.purchase_invoices
    WHERE id = p_invoice_id AND tenant_id = v_tenant_id;

    IF NOT FOUND THEN RAISE EXCEPTION 'purchase invoice not found'; END IF;

    IF v_invoice.match_status = 'MATCHED'::public.purchase_invoice_match_status THEN
        RETURN jsonb_build_object('invoice_id', p_invoice_id, 'adjustment', 0, 'steps', '[]'::jsonb);
    END IF;

    v_reference := v_invoice.system_voucher_number || '|PPV';

    FOR v_line IN
        SELECT pii.*
        FROM public.purchase_invoice_items pii
        WHERE pii.purchase_invoice_id = p_invoice_id AND pii.tenant_id = v_tenant_id
    LOOP
        IF v_line.purchase_order_item_id IS NULL THEN
            CONTINUE;
        END IF;

        SELECT poi.unit_price_contractual INTO v_po_rate
        FROM public.purchase_order_items poi
        WHERE poi.id = v_line.purchase_order_item_id AND poi.tenant_id = v_tenant_id;

        SELECT COALESCE(
            SUM(gri.total_final_landed_cost * gri.quantity_received)
            / NULLIF(SUM(gri.quantity_received), 0),
            v_po_rate
        )
        INTO v_gr_rate
        FROM public.goods_receipt_items gri
        WHERE gri.tenant_id = v_tenant_id
          AND gri.po_item_id = v_line.purchase_order_item_id
          AND COALESCE(gri.is_promotional, FALSE) = FALSE;

        v_variance_per_unit := COALESCE(v_line.unit_price_billed, 0) - COALESCE(v_gr_rate, v_po_rate, 0);
        IF v_variance_per_unit = 0 THEN
            CONTINUE;
        END IF;

        SELECT COALESCE(iv.total_quantity_on_hand, 0), COALESCE(iv.current_average_cost, 0)
        INTO v_on_hand, v_cost_before
        FROM public.item_valuations iv
        WHERE iv.tenant_id = v_tenant_id
          AND iv.item_id = v_line.item_id
          AND iv.variant_id IS NOT DISTINCT FROM v_line.variant_id
        ORDER BY iv.total_quantity_on_hand DESC
        LIMIT 1;

        v_adjust_qty := LEAST(COALESCE(v_on_hand, 0), v_line.quantity_billed);
        IF v_adjust_qty <= 0 THEN
            CONTINUE;
        END IF;

        v_new_cost := private.money_round(GREATEST(v_cost_before + v_variance_per_unit, 0));

        INSERT INTO public.inventory_ledger (
            tenant_id, item_id, variant_id, location_id,
            transaction_type, quantity, cost_at_transaction,
            reference_document, created_by
        )
        SELECT
            v_tenant_id, v_line.item_id, v_line.variant_id, iv.location_id,
            'COST_CORRECTION', 0, v_new_cost,
            v_reference, v_invoice.created_by
        FROM public.item_valuations iv
        WHERE iv.tenant_id = v_tenant_id
          AND iv.item_id = v_line.item_id
          AND iv.variant_id IS NOT DISTINCT FROM v_line.variant_id
          AND iv.total_quantity_on_hand > 0
        ORDER BY iv.total_quantity_on_hand DESC
        LIMIT 1;

        v_total_adjustment := v_total_adjustment + private.money_round(v_variance_per_unit * v_adjust_qty);
    END LOOP;

    UPDATE public.purchase_invoices
    SET match_status = 'MATCHED'::public.purchase_invoice_match_status,
        updated_at = NOW()
    WHERE id = p_invoice_id;

    v_steps := private.append_posting_step(
        v_steps, 'bill_cost_variance_applied', 'success', private.money_round(v_total_adjustment)::TEXT
    );

    INSERT INTO public.document_posting_runs (
        tenant_id, document_type, document_id, overall_status, steps, posted_by
    )
    VALUES (
        v_tenant_id, 'BILL'::public.document_posting_document_type, p_invoice_id, 'success', v_steps, v_invoice.created_by
    );

    RETURN jsonb_build_object(
        'invoice_id', p_invoice_id,
        'adjustment', private.money_round(v_total_adjustment),
        'steps', v_steps
    );
END;
$$;

REVOKE ALL ON FUNCTION public.apply_purchase_price_variance(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_purchase_price_variance(UUID) TO authenticated;

-- --------------------------------------------------------------------
-- 16. save_purchase_order patch (promo line metadata)
-- --------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.save_purchase_order(UUID, UUID, UUID, JSONB, UUID, INTEGER, JSONB, VARCHAR, BOOLEAN, NUMERIC, NUMERIC, NUMERIC, TEXT, NUMERIC, NUMERIC);

CREATE OR REPLACE FUNCTION public.save_purchase_order(
    p_purchase_order_id UUID,
    p_destination_location_id UUID,
    p_supplier_id UUID,
    p_lines JSONB,
    p_created_by UUID,
    p_payment_terms_days INTEGER DEFAULT NULL,
    p_custom_fields JSONB DEFAULT NULL,
    p_currency_code VARCHAR(3) DEFAULT NULL,
    p_prices_tax_inclusive BOOLEAN DEFAULT NULL,
    p_shipping_amount NUMERIC DEFAULT NULL,
    p_shipping_tax_rate_pct NUMERIC DEFAULT NULL,
    p_shipping_tax_amount NUMERIC DEFAULT NULL,
    p_shipping_tax_type TEXT DEFAULT NULL,
    p_round_off_amount NUMERIC DEFAULT NULL,
    p_additional_charges_amount NUMERIC DEFAULT NULL,
    p_transaction_discount_percentage NUMERIC DEFAULT NULL,
    p_transaction_discount_amount NUMERIC DEFAULT NULL,
    p_transaction_discount_type TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_tenant_id UUID;
    v_tenant_country TEXT;
    v_location RECORD;
    v_supplier RECORD;
    v_gst_ctx RECORD;
    v_po_id UUID;
    v_po_status public.purchase_document_status;
    v_voucher_number TEXT;
    v_entry JSONB;
    v_scratch RECORD;
    v_variant_id UUID;
    v_item_id UUID;
    v_base_uom TEXT;
    v_line_uom TEXT;
    v_requested_uom TEXT;
    v_uom_conversion NUMERIC(15, 6);
    v_qty NUMERIC(15, 4);
    v_unit_price NUMERIC(15, 4);
    v_discount_pct NUMERIC(5, 2);
    v_discount_amt NUMERIC(15, 4);
    v_line_extension NUMERIC(15, 4);
    v_line_discount NUMERIC(15, 4);
    v_line_taxable_pre NUMERIC(15, 4);
    v_combined_discount NUMERIC(15, 4);
    v_discount_per_unit NUMERIC(15, 4);
    v_line_gross NUMERIC(15, 4);
    v_line_tax NUMERIC(15, 4);
    v_tax_rate NUMERIC(15, 4);
    v_tax_components JSONB := '[]'::jsonb;
    v_tracking public.item_tracking_mode;
    v_track_inventory BOOLEAN;
    v_total_gross NUMERIC(15, 4) := 0;
    v_total_tax NUMERIC(15, 4) := 0;
    v_subtotal_pre_txn NUMERIC(15, 4) := 0;
    v_txn_discount NUMERIC(15, 4) := 0;
    v_txn_discount_pct NUMERIC(5, 2) := 0;
    v_txn_discount_amt NUMERIC(15, 4) := 0;
    v_txn_discount_type TEXT := 'percent';
    v_apportioned_sum NUMERIC(15, 4) := 0;
    v_line_count INTEGER := 0;
    v_scratch_count INTEGER := 0;
    v_payment_terms INTEGER := GREATEST(COALESCE(p_payment_terms_days, 0), 0);
    v_custom_fields JSONB := COALESCE(p_custom_fields, '{}'::jsonb);
    v_allow_issued_edit BOOLEAN := FALSE;
    v_allow_line_discounts BOOLEAN := FALSE;
    v_allow_txn_discounts BOOLEAN := FALSE;
    v_purchase_tax_inclusive BOOLEAN := FALSE;
    v_tax_supply_nature TEXT := 'INTERSTATE';
    v_tax_mechanism public.gst_tax_mechanism := 'FORWARD';
    v_currency_code VARCHAR(3);
    v_existing_destination_id UUID;
    v_shipping_amount NUMERIC(15, 4) := GREATEST(COALESCE(p_shipping_amount, 0), 0);
    v_shipping_tax_rate_pct NUMERIC(15, 4) := GREATEST(COALESCE(p_shipping_tax_rate_pct, 0), 0);
    v_shipping_tax_amount NUMERIC(15, 4) := 0;
    v_shipping_tax_type TEXT := CASE
        WHEN lower(btrim(COALESCE(p_shipping_tax_type, 'percent'))) = 'amount' THEN 'amount'
        ELSE 'percent'
    END;
    v_round_off_amount NUMERIC(15, 4) := COALESCE(p_round_off_amount, 0);
    v_additional_charges_amount NUMERIC(15, 4) := GREATEST(COALESCE(p_additional_charges_amount, 0), 0);
BEGIN
    v_tenant_id := private.current_tenant_id();
    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'tenant context missing from session';
    END IF;

    IF NOT private.can_edit_purchase_orders() THEN
        RAISE EXCEPTION 'purchase order edit permission required';
    END IF;

    IF p_created_by IS NULL THEN
        RAISE EXCEPTION 'created_by is required';
    END IF;

    IF p_destination_location_id IS NULL THEN
        RAISE EXCEPTION 'destination location is required';
    END IF;

    IF NOT private.user_can_access_po_destination(p_destination_location_id) THEN
        RAISE EXCEPTION 'destination location is outside your procurement scope';
    END IF;

    IF p_supplier_id IS NULL THEN
        RAISE EXCEPTION 'supplier is required';
    END IF;

    IF p_lines IS NULL OR jsonb_typeof(p_lines) IS DISTINCT FROM 'array' OR jsonb_array_length(p_lines) = 0 THEN
        RAISE EXCEPTION 'at least one purchase order line is required';
    END IF;

    IF jsonb_typeof(v_custom_fields) IS DISTINCT FROM 'object' THEN
        RAISE EXCEPTION 'custom_fields must be a JSON object';
    END IF;

    IF v_shipping_tax_type = 'amount' THEN
        v_shipping_tax_amount := GREATEST(COALESCE(p_shipping_tax_amount, 0), 0);
        v_shipping_tax_rate_pct := 0;
    ELSE
        v_shipping_tax_amount := ROUND(v_shipping_amount * v_shipping_tax_rate_pct / 100, 4);
    END IF;

    SELECT upper(btrim(COALESCE(country_code, 'IN')))
    INTO v_tenant_country
    FROM public.tenants
    WHERE id = v_tenant_id;

    SELECT upper(btrim(COALESCE(
        p_currency_code,
        (SELECT t.base_currency FROM public.tenants t WHERE t.id = v_tenant_id),
        'USD'
    )))
    INTO v_currency_code;

    IF v_currency_code IS NULL OR length(v_currency_code) <> 3 THEN
        RAISE EXCEPTION 'currency_code must be a 3-letter code';
    END IF;

    SELECT id, code, is_stock_holding, presence_type, state
    INTO v_location
    FROM public.tenant_locations
    WHERE id = p_destination_location_id
      AND tenant_id = v_tenant_id
      AND is_active = TRUE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'destination location not found';
    END IF;

    IF NOT COALESCE(v_location.is_stock_holding, FALSE) OR v_location.presence_type = 'VIRTUAL' THEN
        RAISE EXCEPTION 'destination location cannot hold inventory';
    END IF;

    SELECT id, type, billing_state, tax_treatment, billing_country_code, incoterms_code
    INTO v_supplier
    FROM public.entities
    WHERE id = p_supplier_id
      AND tenant_id = v_tenant_id
      AND is_active = TRUE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'supplier not found';
    END IF;

    IF v_supplier.type NOT IN ('SUPPLIER', 'MUTUAL_PARTNER') THEN
        RAISE EXCEPTION 'entity is not a supplier';
    END IF;

    SELECT * INTO v_gst_ctx FROM private.gst_resolve_supply_context(
        v_tenant_country,
        COALESCE(v_supplier.tax_treatment, 'REGULAR_B2B'::public.tax_treatment_type),
        v_supplier.billing_country_code,
        v_supplier.billing_state,
        v_location.state,
        'PURCHASE',
        'GOODS'
    ) LIMIT 1;

    v_tax_supply_nature := v_gst_ctx.supply_nature;
    v_tax_mechanism := v_gst_ctx.tax_mechanism;

    v_allow_issued_edit := private.get_procurement_control_flag(
        v_tenant_id,
        'allow_edit_issued_purchase_orders'
    );

    v_allow_line_discounts := private.get_procurement_control_flag(
        v_tenant_id,
        'allow_line_item_discounts'
    );

    v_allow_txn_discounts := private.get_procurement_control_flag(
        v_tenant_id,
        'allow_transaction_discounts'
    );

    IF p_prices_tax_inclusive IS NOT NULL THEN
        v_purchase_tax_inclusive := p_prices_tax_inclusive;
    ELSE
        v_purchase_tax_inclusive := private.get_procurement_control_flag(
            v_tenant_id,
            'purchase_prices_tax_inclusive'
        );
    END IF;

    IF v_allow_txn_discounts THEN
        v_txn_discount_type := CASE
            WHEN lower(btrim(COALESCE(p_transaction_discount_type, 'percent'))) = 'amount' THEN 'amount'
            ELSE 'percent'
        END;
        v_txn_discount_pct := GREATEST(COALESCE(p_transaction_discount_percentage, 0), 0);
        v_txn_discount_amt := GREATEST(COALESCE(p_transaction_discount_amount, 0), 0);

        IF v_txn_discount_pct > 100 THEN
            RAISE EXCEPTION 'transaction_discount_percentage cannot exceed 100';
        END IF;
    ELSE
        v_txn_discount_type := 'percent';
        v_txn_discount_pct := 0;
        v_txn_discount_amt := 0;
    END IF;

    IF p_purchase_order_id IS NOT NULL THEN
        SELECT id, document_status, destination_location_id
        INTO v_po_id, v_po_status, v_existing_destination_id
        FROM public.purchase_orders
        WHERE id = p_purchase_order_id
          AND tenant_id = v_tenant_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'purchase order not found';
        END IF;

        IF NOT private.user_can_access_po_destination(v_existing_destination_id) THEN
            RAISE EXCEPTION 'purchase order is outside your procurement scope';
        END IF;

        IF v_po_status <> 'DRAFT'::public.purchase_document_status
           AND NOT (v_allow_issued_edit AND v_po_status = 'ISSUED_ACTIVE'::public.purchase_document_status) THEN
            RAISE EXCEPTION 'this purchase order cannot be edited';
        END IF;

        UPDATE public.purchase_orders
        SET destination_location_id = p_destination_location_id,
            supplier_id = p_supplier_id,
            payment_terms_days = v_payment_terms,
            currency_code = v_currency_code,
            custom_fields = v_custom_fields,
            prices_tax_inclusive = v_purchase_tax_inclusive,
            tax_supply_nature = v_tax_supply_nature,
            tax_mechanism = v_tax_mechanism,
            supplier_tax_treatment = v_supplier.tax_treatment,
            supplier_country_code = upper(btrim(v_supplier.billing_country_code)),
            incoterms_code = v_supplier.incoterms_code,
            rcm_applicable = (v_tax_mechanism = 'REVERSE_CHARGE'::public.gst_tax_mechanism),
            shipping_amount = v_shipping_amount,
            shipping_tax_rate_pct = v_shipping_tax_rate_pct,
            shipping_tax_amount = v_shipping_tax_amount,
            shipping_tax_type = v_shipping_tax_type,
            round_off_amount = v_round_off_amount,
            additional_charges_amount = v_additional_charges_amount,
            transaction_discount_percentage = v_txn_discount_pct,
            transaction_discount_amount = v_txn_discount_amt,
            transaction_discount_type = v_txn_discount_type,
            updated_at = NOW()
        WHERE id = p_purchase_order_id;

        DELETE FROM public.purchase_order_items
        WHERE purchase_order_id = p_purchase_order_id
          AND tenant_id = v_tenant_id;

        v_po_id := p_purchase_order_id;
    ELSE
        v_voucher_number := public.generate_next_voucher_string(
            v_tenant_id,
            'PURCHASE_ORDER'::public.document_voucher_type,
            NULL,
            p_destination_location_id
        );

        INSERT INTO public.purchase_orders (
            tenant_id,
            destination_location_id,
            supplier_id,
            voucher_number,
            document_status,
            payment_terms_days,
            currency_code,
            custom_fields,
            prices_tax_inclusive,
            tax_supply_nature,
            tax_mechanism,
            supplier_tax_treatment,
            supplier_country_code,
            incoterms_code,
            rcm_applicable,
            shipping_amount,
            shipping_tax_rate_pct,
            shipping_tax_amount,
            shipping_tax_type,
            round_off_amount,
            additional_charges_amount,
            transaction_discount_percentage,
            transaction_discount_amount,
            transaction_discount_type,
            created_by
        )
        VALUES (
            v_tenant_id,
            p_destination_location_id,
            p_supplier_id,
            v_voucher_number,
            'DRAFT'::public.purchase_document_status,
            v_payment_terms,
            v_currency_code,
            v_custom_fields,
            v_purchase_tax_inclusive,
            v_tax_supply_nature,
            v_tax_mechanism,
            v_supplier.tax_treatment,
            upper(btrim(v_supplier.billing_country_code)),
            v_supplier.incoterms_code,
            (v_tax_mechanism = 'REVERSE_CHARGE'::public.gst_tax_mechanism),
            v_shipping_amount,
            v_shipping_tax_rate_pct,
            v_shipping_tax_amount,
            v_shipping_tax_type,
            v_round_off_amount,
            v_additional_charges_amount,
            v_txn_discount_pct,
            v_txn_discount_amt,
            v_txn_discount_type,
            p_created_by
        )
        RETURNING id INTO v_po_id;
    END IF;

    CREATE TEMP TABLE _po_save_scratch (
        seq INT PRIMARY KEY,
        variant_id UUID NOT NULL,
        item_id UUID NOT NULL,
        line_uom TEXT NOT NULL,
        uom_conversion NUMERIC(15, 6) NOT NULL,
        qty NUMERIC(15, 4) NOT NULL,
        unit_price NUMERIC(15, 4) NOT NULL,
        discount_pct NUMERIC(5, 2) NOT NULL,
        discount_amt NUMERIC(15, 4) NOT NULL,
        line_taxable_pre NUMERIC(15, 4) NOT NULL,
        txn_discount_share NUMERIC(15, 4) NOT NULL DEFAULT 0
    ) ON COMMIT DROP;

    v_scratch_count := 0;

    FOR v_entry IN SELECT value FROM jsonb_array_elements(p_lines)
    LOOP
        v_variant_id := NULLIF(v_entry ->> 'variant_id', '')::UUID;
        v_qty := NULLIF(v_entry ->> 'quantity_ordered', '')::NUMERIC;
        v_unit_price := COALESCE(NULLIF(v_entry ->> 'unit_price_contractual', '')::NUMERIC, 0);
        v_discount_pct := GREATEST(COALESCE(NULLIF(v_entry ->> 'discount_percentage', '')::NUMERIC, 0), 0);
        v_discount_amt := GREATEST(COALESCE(NULLIF(v_entry ->> 'discount_amount', '')::NUMERIC, 0), 0);
        v_requested_uom := NULLIF(btrim(v_entry ->> 'uom_code'), '');

        IF v_variant_id IS NULL THEN
            RAISE EXCEPTION 'variant_id is required on each line';
        END IF;

        IF v_qty IS NULL OR v_qty <= 0 THEN
            RAISE EXCEPTION 'quantity_ordered must be greater than zero';
        END IF;

        IF v_unit_price < 0 THEN
            RAISE EXCEPTION 'unit_price_contractual cannot be negative';
        END IF;

        IF NOT v_allow_line_discounts THEN
            v_discount_pct := 0;
            v_discount_amt := 0;
        END IF;

        IF v_discount_pct > 100 THEN
            RAISE EXCEPTION 'discount_percentage cannot exceed 100';
        END IF;

        SELECT iv.item_id, i.track_inventory, i.tracking_mode, i.base_unit_of_measure
        INTO v_item_id, v_track_inventory, v_tracking, v_base_uom
        FROM public.item_variants iv
        INNER JOIN public.items i ON i.id = iv.item_id AND i.tenant_id = iv.tenant_id
        WHERE iv.id = v_variant_id
          AND iv.tenant_id = v_tenant_id
          AND iv.is_active = TRUE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'variant not found';
        END IF;

        IF NOT COALESCE(v_track_inventory, FALSE) THEN
            RAISE EXCEPTION 'variant does not track inventory';
        END IF;

        v_base_uom := COALESCE(NULLIF(btrim(v_base_uom), ''), 'PCS');

        IF v_requested_uom IS NULL OR v_requested_uom = v_base_uom THEN
            v_line_uom := v_base_uom;
            v_uom_conversion := 1;
        ELSE
            SELECT iu.conversion_factor
            INTO v_uom_conversion
            FROM public.item_uoms iu
            WHERE iu.item_id = v_item_id
              AND iu.tenant_id = v_tenant_id
              AND iu.uom_code = v_requested_uom
            LIMIT 1;

            IF NOT FOUND OR v_uom_conversion IS NULL OR v_uom_conversion <= 0 THEN
                RAISE EXCEPTION 'uom_code is not a valid alternate unit for this item';
            END IF;

            v_line_uom := v_requested_uom;
        END IF;

        v_line_extension := v_qty * v_unit_price;

        IF v_discount_amt > 0 THEN
            v_line_discount := LEAST(v_discount_amt, v_line_extension);
            v_discount_pct := 0;
        ELSIF v_discount_pct > 0 THEN
            v_line_discount := LEAST(v_line_extension, v_line_extension * v_discount_pct / 100);
            v_discount_amt := 0;
        ELSE
            v_line_discount := 0;
        END IF;

        v_discount_per_unit := CASE
            WHEN v_qty > 0 THEN ROUND(v_line_discount / v_qty, 4)
            ELSE 0
        END;

        SELECT taxable_base
        INTO v_line_taxable_pre
        FROM private.resolve_line_tax(
            v_item_id,
            v_qty,
            v_unit_price,
            v_discount_per_unit,
            v_purchase_tax_inclusive,
            v_tax_supply_nature,
            v_tax_mechanism
        )
        LIMIT 1;

        v_line_taxable_pre := COALESCE(v_line_taxable_pre, GREATEST(v_line_extension - v_line_discount, 0));
        v_subtotal_pre_txn := v_subtotal_pre_txn + v_line_taxable_pre;
        v_scratch_count := v_scratch_count + 1;

        INSERT INTO _po_save_scratch (
            seq,
            variant_id,
            item_id,
            line_uom,
            uom_conversion,
            qty,
            unit_price,
            discount_pct,
            discount_amt,
            line_taxable_pre
        )
        VALUES (
            v_scratch_count,
            v_variant_id,
            v_item_id,
            v_line_uom,
            v_uom_conversion,
            v_qty,
            v_unit_price,
            v_discount_pct,
            v_discount_amt,
            v_line_taxable_pre
        );
    END LOOP;

    IF v_scratch_count = 0 THEN
        RAISE EXCEPTION 'no valid purchase order lines were saved';
    END IF;

    IF v_allow_txn_discounts AND v_subtotal_pre_txn > 0 THEN
        IF v_txn_discount_type = 'amount' AND v_txn_discount_amt > 0 THEN
            v_txn_discount := LEAST(v_txn_discount_amt, v_subtotal_pre_txn);
            v_txn_discount_pct := 0;
        ELSIF v_txn_discount_type = 'percent' AND v_txn_discount_pct > 0 THEN
            v_txn_discount := LEAST(
                v_subtotal_pre_txn,
                ROUND(v_subtotal_pre_txn * v_txn_discount_pct / 100, 4)
            );
            v_txn_discount_amt := v_txn_discount;
        ELSE
            v_txn_discount := 0;
        END IF;
    ELSE
        v_txn_discount := 0;
        v_txn_discount_pct := 0;
        v_txn_discount_amt := 0;
    END IF;

    IF v_txn_discount > 0 THEN
        v_apportioned_sum := 0;

        FOR v_scratch IN
            SELECT seq, line_taxable_pre
            FROM _po_save_scratch
            ORDER BY seq
        LOOP
            IF v_scratch.seq < v_scratch_count THEN
                UPDATE _po_save_scratch
                SET txn_discount_share = ROUND(
                    v_txn_discount * v_scratch.line_taxable_pre / v_subtotal_pre_txn,
                    4
                )
                WHERE seq = v_scratch.seq;

                SELECT txn_discount_share
                INTO v_line_discount
                FROM _po_save_scratch
                WHERE seq = v_scratch.seq;

                v_apportioned_sum := v_apportioned_sum + COALESCE(v_line_discount, 0);
            ELSE
                UPDATE _po_save_scratch
                SET txn_discount_share = GREATEST(v_txn_discount - v_apportioned_sum, 0)
                WHERE seq = v_scratch.seq;
            END IF;
        END LOOP;
    END IF;

    UPDATE public.purchase_orders
    SET transaction_discount_amount = CASE
            WHEN v_txn_discount_type = 'amount' THEN v_txn_discount
            WHEN v_txn_discount_type = 'percent' THEN v_txn_discount
            ELSE 0
        END,
        transaction_discount_percentage = CASE
            WHEN v_txn_discount_type = 'percent' THEN v_txn_discount_pct
            ELSE 0
        END,
        transaction_discount_type = v_txn_discount_type
    WHERE id = v_po_id;

    FOR v_scratch IN SELECT * FROM _po_save_scratch ORDER BY seq
    LOOP
        v_combined_discount := (
            SELECT CASE
                WHEN v_scratch.discount_amt > 0 THEN LEAST(v_scratch.discount_amt, v_scratch.qty * v_scratch.unit_price)
                WHEN v_scratch.discount_pct > 0 THEN LEAST(
                    v_scratch.qty * v_scratch.unit_price,
                    v_scratch.qty * v_scratch.unit_price * v_scratch.discount_pct / 100
                )
                ELSE 0
            END
        ) + v_scratch.txn_discount_share;

        v_combined_discount := LEAST(v_combined_discount, v_scratch.qty * v_scratch.unit_price);

        v_discount_per_unit := CASE
            WHEN v_scratch.qty > 0 THEN ROUND(v_combined_discount / v_scratch.qty, 4)
            ELSE 0
        END;

        SELECT rate, tax_amount, taxable_base, tax_components
        INTO v_tax_rate, v_line_tax, v_line_gross, v_tax_components
        FROM private.resolve_line_tax(
            v_scratch.item_id,
            v_scratch.qty,
            v_scratch.unit_price,
            v_discount_per_unit,
            v_purchase_tax_inclusive,
            v_tax_supply_nature,
            v_tax_mechanism
        )
        LIMIT 1;

        v_tax_rate := COALESCE(v_tax_rate, 0);
        v_line_tax := COALESCE(v_line_tax, 0);
        v_line_gross := COALESCE(v_line_gross, GREATEST(v_scratch.qty * v_scratch.unit_price - v_combined_discount, 0));
        v_tax_components := COALESCE(v_tax_components, '[]'::jsonb);

        v_total_gross := v_total_gross + v_line_gross;
        v_total_tax := v_total_tax + v_line_tax;

        INSERT INTO public.purchase_order_items (
            tenant_id,
            purchase_order_id,
            item_id,
            variant_id,
            uom_code,
            uom_conversion_factor,
            quantity_ordered,
            unit_price_contractual,
            discount_percentage,
            discount_amount,
            tax_rate_percentage,
            line_tax_amount,
            line_total_gross,
            tax_components_json
        )
        VALUES (
            v_tenant_id,
            v_po_id,
            v_scratch.item_id,
            v_scratch.variant_id,
            v_scratch.line_uom,
            v_scratch.uom_conversion,
            v_scratch.qty,
            v_scratch.unit_price,
            v_scratch.discount_pct,
            v_scratch.discount_amt,
            v_tax_rate,
            v_line_tax,
            v_line_gross,
            v_tax_components
        );

        v_line_count := v_line_count + 1;
    END LOOP;

    UPDATE public.purchase_orders
    SET total_gross_amount = v_total_gross,
        total_tax_amount = v_total_tax + v_shipping_tax_amount,
        total_net_amount = v_total_gross
            + v_total_tax
            + v_shipping_tax_amount
            + v_shipping_amount
            + v_additional_charges_amount
            + v_round_off_amount,
        updated_at = NOW()
    WHERE id = v_po_id;

    PERFORM private.apply_po_save_promo_lines(v_po_id, p_lines);

    RETURN v_po_id;
END;
$$;


REVOKE ALL ON FUNCTION public.save_purchase_order(
    UUID, UUID, UUID, JSONB, UUID, INTEGER, JSONB, VARCHAR, BOOLEAN,
    NUMERIC, NUMERIC, NUMERIC, TEXT, NUMERIC, NUMERIC,
    NUMERIC, NUMERIC, TEXT
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_purchase_order(
    UUID, UUID, UUID, JSONB, UUID, INTEGER, JSONB, VARCHAR, BOOLEAN,
    NUMERIC, NUMERIC, NUMERIC, TEXT, NUMERIC, NUMERIC,
    NUMERIC, NUMERIC, TEXT
) TO authenticated;

-- Import shipments (Phase 2): schema, RLS, RPCs, document enums, activity hooks.

-- --------------------------------------------------------------------
-- 1. ENUMS
-- --------------------------------------------------------------------
DO $$ BEGIN
    CREATE TYPE public.import_shipment_status AS ENUM (
        'DRAFT',
        'BOOKED',
        'IN_TRANSIT',
        'AT_STAGING',
        'CUSTOMS_PENDING',
        'CLEARED',
        'CLOSED',
        'CANCELLED'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Enum values: see 20260802125000_import_logistics_enum_values.sql (55P04)

-- --------------------------------------------------------------------
-- 2. TABLES
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.import_shipments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    shipment_number TEXT NOT NULL,
    status public.import_shipment_status NOT NULL DEFAULT 'DRAFT',
    supplier_id UUID REFERENCES public.entities(id) ON DELETE RESTRICT,
    forwarder_entity_id UUID REFERENCES public.entities(id) ON DELETE SET NULL,
    staging_location_id UUID REFERENCES public.tenant_locations(id) ON DELETE SET NULL,
    ultimate_destination_location_id UUID REFERENCES public.tenant_locations(id) ON DELETE SET NULL,
    incoterms_code TEXT,
    bill_of_lading TEXT,
    container_numbers JSONB NOT NULL DEFAULT '[]'::jsonb,
    awb TEXT,
    vessel_name TEXT,
    port_of_loading TEXT,
    port_of_discharge TEXT,
    etd DATE,
    eta DATE,
    bill_of_entry_number TEXT,
    bill_of_entry_date DATE,
    port_code VARCHAR(10),
    exchange_rate NUMERIC(15, 6) NOT NULL DEFAULT 1.000000,
    assessable_value NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
    customs_duty_amount NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
    import_igst_amount NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
    notes TEXT,
    custom_fields JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    issued_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    issued_at TIMESTAMPTZ,
    UNIQUE (tenant_id, shipment_number)
);

CREATE UNIQUE INDEX IF NOT EXISTS import_shipments_tenant_id_id_unique
    ON public.import_shipments (tenant_id, id);

CREATE TABLE IF NOT EXISTS public.import_shipment_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    shipment_id UUID NOT NULL,
    purchase_order_id UUID NOT NULL,
    po_item_id UUID NOT NULL,
    variant_id UUID NOT NULL REFERENCES public.item_variants(id) ON DELETE RESTRICT,
    item_id UUID NOT NULL REFERENCES public.items(id) ON DELETE RESTRICT,
    quantity_shipped NUMERIC(15, 4) NOT NULL CHECK (quantity_shipped > 0),
    quantity_received_staging NUMERIC(15, 4) NOT NULL DEFAULT 0.0000 CHECK (quantity_received_staging >= 0),
    quantity_in_git NUMERIC(15, 4) NOT NULL DEFAULT 0.0000 CHECK (quantity_in_git >= 0),
    quantity_cleared NUMERIC(15, 4) NOT NULL DEFAULT 0.0000 CHECK (quantity_cleared >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, shipment_id, po_item_id),
    CONSTRAINT import_shipment_lines_shipment_tenant_fk
        FOREIGN KEY (tenant_id, shipment_id)
        REFERENCES public.import_shipments (tenant_id, id)
        ON DELETE CASCADE,
    CONSTRAINT import_shipment_lines_po_tenant_fk
        FOREIGN KEY (tenant_id, purchase_order_id)
        REFERENCES public.purchase_orders (tenant_id, id)
        ON DELETE RESTRICT,
    CONSTRAINT import_shipment_lines_po_item_tenant_fk
        FOREIGN KEY (tenant_id, po_item_id)
        REFERENCES public.purchase_order_items (tenant_id, id)
        ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS public.import_shipment_purchase_orders (
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    shipment_id UUID NOT NULL,
    purchase_order_id UUID NOT NULL,
    linked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    linked_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    PRIMARY KEY (tenant_id, shipment_id, purchase_order_id),
    CONSTRAINT import_shipment_purchase_orders_shipment_tenant_fk
        FOREIGN KEY (tenant_id, shipment_id)
        REFERENCES public.import_shipments (tenant_id, id)
        ON DELETE CASCADE,
    CONSTRAINT import_shipment_purchase_orders_po_tenant_fk
        FOREIGN KEY (tenant_id, purchase_order_id)
        REFERENCES public.purchase_orders (tenant_id, id)
        ON DELETE RESTRICT
);

-- Phase-0 nullable columns → FK to import_shipments
ALTER TABLE public.goods_receipts
    ADD COLUMN IF NOT EXISTS shipment_id UUID;

ALTER TABLE public.goods_in_transit_vouchers
    ADD COLUMN IF NOT EXISTS shipment_id UUID;

ALTER TABLE public.goods_receipts
    DROP CONSTRAINT IF EXISTS goods_receipts_shipment_tenant_fk;

ALTER TABLE public.goods_receipts
    ADD CONSTRAINT goods_receipts_shipment_tenant_fk
        FOREIGN KEY (tenant_id, shipment_id)
        REFERENCES public.import_shipments (tenant_id, id)
        ON DELETE SET NULL;

ALTER TABLE public.goods_in_transit_vouchers
    DROP CONSTRAINT IF EXISTS goods_in_transit_vouchers_shipment_tenant_fk;

ALTER TABLE public.goods_in_transit_vouchers
    ADD CONSTRAINT goods_in_transit_vouchers_shipment_tenant_fk
        FOREIGN KEY (tenant_id, shipment_id)
        REFERENCES public.import_shipments (tenant_id, id)
        ON DELETE SET NULL;

-- --------------------------------------------------------------------
-- 3. RLS
-- --------------------------------------------------------------------
ALTER TABLE public.import_shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_shipment_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_shipment_purchase_orders ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
    t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY[
        'import_shipments',
        'import_shipment_lines',
        'import_shipment_purchase_orders'
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
-- 4. ACTIVITY + POSTING MAPS
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.map_posting_document_type(
    p_document_type public.document_posting_document_type
)
RETURNS public.activity_entity_type
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT CASE p_document_type
        WHEN 'PO' THEN 'PURCHASE_ORDER'::public.activity_entity_type
        WHEN 'GRN' THEN 'GOODS_RECEIPT'::public.activity_entity_type
        WHEN 'BILL' THEN 'PURCHASE_INVOICE'::public.activity_entity_type
        WHEN 'SHIPMENT' THEN 'SHIPMENT'::public.activity_entity_type
    END;
$$;

CREATE OR REPLACE FUNCTION private.trg_activity_header_created()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_entity_type public.activity_entity_type;
    v_actor UUID;
BEGIN
    v_entity_type := CASE TG_TABLE_NAME
        WHEN 'purchase_orders' THEN 'PURCHASE_ORDER'::public.activity_entity_type
        WHEN 'goods_receipts' THEN 'GOODS_RECEIPT'::public.activity_entity_type
        WHEN 'purchase_invoices' THEN 'PURCHASE_INVOICE'::public.activity_entity_type
        WHEN 'stock_adjustments' THEN 'STOCK_ADJUSTMENT'::public.activity_entity_type
        WHEN 'stock_transfers' THEN 'STOCK_TRANSFER'::public.activity_entity_type
        WHEN 'goods_in_transit_vouchers' THEN 'GOODS_IN_TRANSIT'::public.activity_entity_type
        WHEN 'sales_quotations' THEN 'SALES_QUOTATION'::public.activity_entity_type
        WHEN 'sales_orders' THEN 'SALES_ORDER'::public.activity_entity_type
        WHEN 'sales_invoices' THEN 'SALES_INVOICE'::public.activity_entity_type
        WHEN 'import_shipments' THEN 'SHIPMENT'::public.activity_entity_type
        ELSE NULL
    END;

    IF v_entity_type IS NULL THEN
        RETURN NEW;
    END IF;

    v_actor := NEW.created_by;

    PERFORM private.insert_activity_event(
        NEW.tenant_id,
        v_entity_type,
        NEW.id,
        'created',
        'created',
        NULL,
        '{}'::jsonb,
        v_actor,
        NEW.created_at,
        TG_TABLE_NAME || '_header',
        NEW.id
    );

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS import_shipments_activity_created ON public.import_shipments;

CREATE TRIGGER import_shipments_activity_created
    AFTER INSERT ON public.import_shipments
    FOR EACH ROW
    EXECUTE FUNCTION private.trg_activity_header_created();

-- --------------------------------------------------------------------
-- 5. HELPERS
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.import_shipment_status_transition_allowed(
    p_from public.import_shipment_status,
    p_to public.import_shipment_status
)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT CASE
        WHEN p_from = p_to THEN TRUE
        WHEN p_from = 'DRAFT' AND p_to IN ('BOOKED', 'CANCELLED') THEN TRUE
        WHEN p_from = 'BOOKED' AND p_to IN ('IN_TRANSIT', 'CANCELLED') THEN TRUE
        WHEN p_from = 'IN_TRANSIT' AND p_to IN ('AT_STAGING', 'CUSTOMS_PENDING', 'CANCELLED') THEN TRUE
        WHEN p_from = 'AT_STAGING' AND p_to IN ('CUSTOMS_PENDING', 'IN_TRANSIT', 'CANCELLED') THEN TRUE
        WHEN p_from = 'CUSTOMS_PENDING' AND p_to IN ('CLEARED', 'CANCELLED') THEN TRUE
        WHEN p_from = 'CLEARED' AND p_to IN ('CLOSED') THEN TRUE
        ELSE FALSE
    END;
$$;

CREATE OR REPLACE FUNCTION private.po_item_open_qty_for_shipment(
    p_tenant_id UUID,
    p_po_item_id UUID,
    p_exclude_shipment_id UUID DEFAULT NULL
)
RETURNS NUMERIC(15, 4)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_ordered NUMERIC(15, 4);
    v_received NUMERIC(15, 4);
    v_allocated NUMERIC(15, 4);
BEGIN
    SELECT quantity_ordered, quantity_received
    INTO v_ordered, v_received
    FROM public.purchase_order_items
    WHERE id = p_po_item_id AND tenant_id = p_tenant_id;

    IF NOT FOUND THEN
        RETURN 0;
    END IF;

    SELECT COALESCE(SUM(isl.quantity_shipped), 0)
    INTO v_allocated
    FROM public.import_shipment_lines isl
    INNER JOIN public.import_shipments ish ON ish.id = isl.shipment_id AND ish.tenant_id = isl.tenant_id
    WHERE isl.tenant_id = p_tenant_id
      AND isl.po_item_id = p_po_item_id
      AND ish.status NOT IN ('CANCELLED'::public.import_shipment_status, 'CLOSED'::public.import_shipment_status)
      AND (p_exclude_shipment_id IS NULL OR isl.shipment_id <> p_exclude_shipment_id);

    RETURN GREATEST(v_ordered - v_received - v_allocated, 0);
END;
$$;

-- --------------------------------------------------------------------
-- 6. RPCs
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.save_import_shipment(
    p_shipment_id UUID,
    p_supplier_id UUID,
    p_forwarder_entity_id UUID,
    p_staging_location_id UUID,
    p_ultimate_destination_location_id UUID,
    p_incoterms_code TEXT,
    p_bill_of_lading TEXT,
    p_container_numbers JSONB,
    p_awb TEXT,
    p_vessel_name TEXT,
    p_port_of_loading TEXT,
    p_port_of_discharge TEXT,
    p_etd DATE,
    p_eta DATE,
    p_bill_of_entry_number TEXT,
    p_bill_of_entry_date DATE,
    p_port_code VARCHAR,
    p_exchange_rate NUMERIC,
    p_assessable_value NUMERIC,
    p_customs_duty_amount NUMERIC,
    p_import_igst_amount NUMERIC,
    p_notes TEXT,
    p_custom_fields JSONB,
    p_created_by UUID,
    p_purchase_order_ids JSONB DEFAULT '[]'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_tenant_id UUID;
    v_shipment_id UUID;
    v_number TEXT;
    v_status public.import_shipment_status;
    v_entry JSONB;
    v_po_id UUID;
    v_custom_fields JSONB := COALESCE(p_custom_fields, '{}'::jsonb);
    v_containers JSONB := COALESCE(p_container_numbers, '[]'::jsonb);
BEGIN
    v_tenant_id := private.current_tenant_id();
    IF v_tenant_id IS NULL THEN RAISE EXCEPTION 'tenant context missing from session'; END IF;
    IF NOT private.can_edit_purchase_orders() THEN
        RAISE EXCEPTION 'purchase order edit permission required';
    END IF;
    IF p_created_by IS NULL THEN RAISE EXCEPTION 'created_by is required'; END IF;
    IF p_supplier_id IS NULL THEN RAISE EXCEPTION 'supplier is required'; END IF;
    IF jsonb_typeof(v_custom_fields) IS DISTINCT FROM 'object' THEN
        RAISE EXCEPTION 'custom_fields must be a JSON object';
    END IF;
    IF jsonb_typeof(v_containers) IS DISTINCT FROM 'array' THEN
        RAISE EXCEPTION 'container_numbers must be a JSON array';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.entities
        WHERE id = p_supplier_id AND tenant_id = v_tenant_id AND is_active = TRUE
          AND type IN ('SUPPLIER', 'MUTUAL_PARTNER')
    ) THEN
        RAISE EXCEPTION 'supplier not found';
    END IF;

    IF p_forwarder_entity_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM public.entities
        WHERE id = p_forwarder_entity_id AND tenant_id = v_tenant_id AND is_active = TRUE
    ) THEN
        RAISE EXCEPTION 'forwarder entity not found';
    END IF;

    IF p_staging_location_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM public.tenant_locations
        WHERE id = p_staging_location_id AND tenant_id = v_tenant_id AND is_active = TRUE
    ) THEN
        RAISE EXCEPTION 'staging location not found';
    END IF;

    IF p_ultimate_destination_location_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM public.tenant_locations
        WHERE id = p_ultimate_destination_location_id AND tenant_id = v_tenant_id AND is_active = TRUE
    ) THEN
        RAISE EXCEPTION 'ultimate destination location not found';
    END IF;

    IF p_shipment_id IS NOT NULL THEN
        SELECT id, status INTO v_shipment_id, v_status
        FROM public.import_shipments
        WHERE id = p_shipment_id AND tenant_id = v_tenant_id;

        IF NOT FOUND THEN RAISE EXCEPTION 'import shipment not found'; END IF;
        IF v_status <> 'DRAFT'::public.import_shipment_status THEN
            RAISE EXCEPTION 'only draft import shipments can be edited';
        END IF;

        UPDATE public.import_shipments SET
            supplier_id = p_supplier_id,
            forwarder_entity_id = p_forwarder_entity_id,
            staging_location_id = p_staging_location_id,
            ultimate_destination_location_id = p_ultimate_destination_location_id,
            incoterms_code = NULLIF(btrim(p_incoterms_code), ''),
            bill_of_lading = NULLIF(btrim(p_bill_of_lading), ''),
            container_numbers = v_containers,
            awb = NULLIF(btrim(p_awb), ''),
            vessel_name = NULLIF(btrim(p_vessel_name), ''),
            port_of_loading = NULLIF(btrim(p_port_of_loading), ''),
            port_of_discharge = NULLIF(btrim(p_port_of_discharge), ''),
            etd = p_etd,
            eta = p_eta,
            bill_of_entry_number = NULLIF(btrim(p_bill_of_entry_number), ''),
            bill_of_entry_date = p_bill_of_entry_date,
            port_code = NULLIF(btrim(p_port_code), ''),
            exchange_rate = GREATEST(COALESCE(p_exchange_rate, 1), 0.000001),
            assessable_value = GREATEST(COALESCE(p_assessable_value, 0), 0),
            customs_duty_amount = GREATEST(COALESCE(p_customs_duty_amount, 0), 0),
            import_igst_amount = GREATEST(COALESCE(p_import_igst_amount, 0), 0),
            notes = NULLIF(btrim(p_notes), ''),
            custom_fields = v_custom_fields,
            updated_at = NOW()
        WHERE id = v_shipment_id AND tenant_id = v_tenant_id;
    ELSE
        v_number := public.generate_next_voucher_string(
            v_tenant_id, 'IMPORT_SHIPMENT'::public.document_voucher_type, NULL, p_staging_location_id
        );

        INSERT INTO public.import_shipments (
            tenant_id, shipment_number, status, supplier_id, forwarder_entity_id,
            staging_location_id, ultimate_destination_location_id,
            incoterms_code, bill_of_lading, container_numbers, awb, vessel_name,
            port_of_loading, port_of_discharge, etd, eta,
            bill_of_entry_number, bill_of_entry_date, port_code,
            exchange_rate, assessable_value, customs_duty_amount, import_igst_amount,
            notes, custom_fields, created_by
        ) VALUES (
            v_tenant_id, v_number, 'DRAFT', p_supplier_id, p_forwarder_entity_id,
            p_staging_location_id, p_ultimate_destination_location_id,
            NULLIF(btrim(p_incoterms_code), ''),
            NULLIF(btrim(p_bill_of_lading), ''),
            v_containers,
            NULLIF(btrim(p_awb), ''),
            NULLIF(btrim(p_vessel_name), ''),
            NULLIF(btrim(p_port_of_loading), ''),
            NULLIF(btrim(p_port_of_discharge), ''),
            p_etd, p_eta,
            NULLIF(btrim(p_bill_of_entry_number), ''),
            p_bill_of_entry_date,
            NULLIF(btrim(p_port_code), ''),
            GREATEST(COALESCE(p_exchange_rate, 1), 0.000001),
            GREATEST(COALESCE(p_assessable_value, 0), 0),
            GREATEST(COALESCE(p_customs_duty_amount, 0), 0),
            GREATEST(COALESCE(p_import_igst_amount, 0), 0),
            NULLIF(btrim(p_notes), ''),
            v_custom_fields,
            p_created_by
        ) RETURNING id INTO v_shipment_id;
    END IF;

    IF p_purchase_order_ids IS NOT NULL AND jsonb_typeof(p_purchase_order_ids) = 'array' THEN
        FOR v_entry IN SELECT value FROM jsonb_array_elements(p_purchase_order_ids)
        LOOP
            v_po_id := NULLIF(v_entry #>> '{}', '')::UUID;
            IF v_po_id IS NULL THEN CONTINUE; END IF;

            IF NOT EXISTS (
                SELECT 1 FROM public.purchase_orders po
                WHERE po.id = v_po_id AND po.tenant_id = v_tenant_id
                  AND po.tax_supply_nature = 'IMPORT_GOODS'
            ) THEN
                RAISE EXCEPTION 'purchase order % is not an import goods order', v_po_id;
            END IF;

            INSERT INTO public.import_shipment_purchase_orders (
                tenant_id, shipment_id, purchase_order_id, linked_by
            ) VALUES (
                v_tenant_id, v_shipment_id, v_po_id, p_created_by
            ) ON CONFLICT (tenant_id, shipment_id, purchase_order_id) DO NOTHING;
        END LOOP;
    END IF;

    RETURN v_shipment_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.allocate_po_lines_to_shipment(
    p_shipment_id UUID,
    p_lines JSONB,
    p_updated_by UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_tenant_id UUID;
    v_status public.import_shipment_status;
    v_entry JSONB;
    v_po_id UUID;
    v_po_item_id UUID;
    v_variant_id UUID;
    v_item_id UUID;
    v_qty NUMERIC(15, 4);
    v_open_qty NUMERIC(15, 4);
    v_po_item public.purchase_order_items%ROWTYPE;
    v_line_count INTEGER := 0;
BEGIN
    v_tenant_id := private.current_tenant_id();
    IF v_tenant_id IS NULL THEN RAISE EXCEPTION 'tenant context missing from session'; END IF;
    IF NOT private.can_edit_purchase_orders() THEN
        RAISE EXCEPTION 'purchase order edit permission required';
    END IF;
    IF p_shipment_id IS NULL THEN RAISE EXCEPTION 'shipment id is required'; END IF;
    IF p_updated_by IS NULL THEN RAISE EXCEPTION 'updated_by is required'; END IF;
    IF p_lines IS NULL OR jsonb_typeof(p_lines) IS DISTINCT FROM 'array' THEN
        RAISE EXCEPTION 'lines must be a JSON array';
    END IF;

    SELECT status INTO v_status
    FROM public.import_shipments
    WHERE id = p_shipment_id AND tenant_id = v_tenant_id;

    IF NOT FOUND THEN RAISE EXCEPTION 'import shipment not found'; END IF;
    IF v_status <> 'DRAFT'::public.import_shipment_status THEN
        RAISE EXCEPTION 'only draft import shipments accept line allocation';
    END IF;

    FOR v_entry IN SELECT value FROM jsonb_array_elements(p_lines)
    LOOP
        v_po_id := NULLIF(v_entry ->> 'purchase_order_id', '')::UUID;
        v_po_item_id := NULLIF(v_entry ->> 'po_item_id', '')::UUID;
        v_variant_id := NULLIF(v_entry ->> 'variant_id', '')::UUID;
        v_qty := NULLIF(v_entry ->> 'quantity_shipped', '')::NUMERIC;

        IF v_po_id IS NULL OR v_po_item_id IS NULL OR v_variant_id IS NULL OR v_qty IS NULL OR v_qty <= 0 THEN
            RAISE EXCEPTION 'invalid shipment line allocation';
        END IF;

        IF NOT EXISTS (
            SELECT 1 FROM public.purchase_orders po
            WHERE po.id = v_po_id AND po.tenant_id = v_tenant_id
              AND po.tax_supply_nature = 'IMPORT_GOODS'
              AND po.document_status IN (
                  'ISSUED_ACTIVE'::public.purchase_document_status,
                  'PARTIALLY_FULFILLED'::public.purchase_document_status
              )
        ) THEN
            RAISE EXCEPTION 'purchase order is not open for import shipment allocation';
        END IF;

        SELECT * INTO v_po_item
        FROM public.purchase_order_items
        WHERE id = v_po_item_id AND tenant_id = v_tenant_id AND purchase_order_id = v_po_id;

        IF NOT FOUND THEN RAISE EXCEPTION 'purchase order line not found'; END IF;
        IF v_po_item.variant_id IS DISTINCT FROM v_variant_id THEN
            RAISE EXCEPTION 'variant does not match purchase order line';
        END IF;
        IF COALESCE(v_po_item.is_promotional, FALSE) THEN
            RAISE EXCEPTION 'promotional lines cannot be allocated to import shipments';
        END IF;

        v_open_qty := private.po_item_open_qty_for_shipment(v_tenant_id, v_po_item_id, p_shipment_id);
        IF v_qty > v_open_qty THEN
            RAISE EXCEPTION 'quantity_shipped exceeds open purchase order quantity for line';
        END IF;

        v_item_id := v_po_item.item_id;

        INSERT INTO public.import_shipment_purchase_orders (
            tenant_id, shipment_id, purchase_order_id, linked_by
        ) VALUES (
            v_tenant_id, p_shipment_id, v_po_id, p_updated_by
        ) ON CONFLICT (tenant_id, shipment_id, purchase_order_id) DO NOTHING;

        INSERT INTO public.import_shipment_lines (
            tenant_id, shipment_id, purchase_order_id, po_item_id, variant_id, item_id, quantity_shipped
        ) VALUES (
            v_tenant_id, p_shipment_id, v_po_id, v_po_item_id, v_variant_id, v_item_id, v_qty
        )
        ON CONFLICT (tenant_id, shipment_id, po_item_id) DO UPDATE SET
            quantity_shipped = EXCLUDED.quantity_shipped,
            updated_at = NOW();

        v_line_count := v_line_count + 1;
    END LOOP;

    UPDATE public.import_shipments SET updated_at = NOW()
    WHERE id = p_shipment_id AND tenant_id = v_tenant_id;

    RETURN jsonb_build_object('shipment_id', p_shipment_id, 'line_count', v_line_count);
END;
$$;

CREATE OR REPLACE FUNCTION public.issue_import_shipment(p_shipment_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_tenant_id UUID;
    v_user_id UUID;
    v_shipment public.import_shipments%ROWTYPE;
    v_line_count INTEGER;
    v_steps JSONB := '[]'::jsonb;
BEGIN
    v_tenant_id := private.current_tenant_id();
    v_user_id := auth.uid();
    IF v_tenant_id IS NULL THEN RAISE EXCEPTION 'tenant context missing from session'; END IF;
    IF NOT private.can_edit_purchase_orders() THEN
        RAISE EXCEPTION 'purchase order edit permission required';
    END IF;
    IF p_shipment_id IS NULL THEN RAISE EXCEPTION 'shipment id is required'; END IF;

    SELECT * INTO v_shipment
    FROM public.import_shipments
    WHERE id = p_shipment_id AND tenant_id = v_tenant_id;

    IF NOT FOUND THEN RAISE EXCEPTION 'import shipment not found'; END IF;
    IF v_shipment.status <> 'DRAFT'::public.import_shipment_status THEN
        RAISE EXCEPTION 'only draft import shipments can be issued';
    END IF;

    SELECT COUNT(*) INTO v_line_count
    FROM public.import_shipment_lines
    WHERE shipment_id = p_shipment_id AND tenant_id = v_tenant_id;

    IF v_line_count = 0 THEN
        RAISE EXCEPTION 'at least one shipment line is required before issue';
    END IF;

    UPDATE public.import_shipments SET
        status = 'BOOKED'::public.import_shipment_status,
        issued_by = COALESCE(v_user_id, v_shipment.created_by),
        issued_at = NOW(),
        updated_at = NOW()
    WHERE id = p_shipment_id AND tenant_id = v_tenant_id;

    v_steps := private.append_posting_step(v_steps, 'shipment_booked', 'success', v_shipment.shipment_number);

    INSERT INTO public.document_posting_runs (
        tenant_id, document_type, document_id, overall_status, steps, posted_by
    ) VALUES (
        v_tenant_id,
        'SHIPMENT'::public.document_posting_document_type,
        p_shipment_id,
        'success',
        v_steps,
        COALESCE(v_user_id, v_shipment.created_by)
    );

    RETURN jsonb_build_object(
        'shipment_id', p_shipment_id,
        'shipment_number', v_shipment.shipment_number,
        'status', 'BOOKED',
        'steps', v_steps
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.update_import_shipment_status(
    p_shipment_id UUID,
    p_status public.import_shipment_status,
    p_updated_by UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_tenant_id UUID;
    v_current public.import_shipment_status;
    v_number TEXT;
BEGIN
    v_tenant_id := private.current_tenant_id();
    IF v_tenant_id IS NULL THEN RAISE EXCEPTION 'tenant context missing from session'; END IF;
    IF NOT private.can_edit_purchase_orders() THEN
        RAISE EXCEPTION 'purchase order edit permission required';
    END IF;
    IF p_shipment_id IS NULL THEN RAISE EXCEPTION 'shipment id is required'; END IF;
    IF p_status IS NULL THEN RAISE EXCEPTION 'status is required'; END IF;
    IF p_updated_by IS NULL THEN RAISE EXCEPTION 'updated_by is required'; END IF;

    SELECT status, shipment_number INTO v_current, v_number
    FROM public.import_shipments
    WHERE id = p_shipment_id AND tenant_id = v_tenant_id;

    IF NOT FOUND THEN RAISE EXCEPTION 'import shipment not found'; END IF;
    IF NOT private.import_shipment_status_transition_allowed(v_current, p_status) THEN
        RAISE EXCEPTION 'status transition from % to % is not allowed', v_current, p_status;
    END IF;

    UPDATE public.import_shipments SET
        status = p_status,
        updated_at = NOW()
    WHERE id = p_shipment_id AND tenant_id = v_tenant_id;

    RETURN jsonb_build_object(
        'shipment_id', p_shipment_id,
        'shipment_number', v_number,
        'prior_status', v_current,
        'status', p_status
    );
END;
$$;

REVOKE ALL ON FUNCTION public.save_import_shipment(
    UUID, UUID, UUID, UUID, UUID, TEXT, TEXT, JSONB, TEXT, TEXT, TEXT, TEXT, DATE, DATE,
    TEXT, DATE, VARCHAR, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT, JSONB, UUID, JSONB
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_import_shipment(
    UUID, UUID, UUID, UUID, UUID, TEXT, TEXT, JSONB, TEXT, TEXT, TEXT, TEXT, DATE, DATE,
    TEXT, DATE, VARCHAR, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT, JSONB, UUID, JSONB
) TO authenticated;

REVOKE ALL ON FUNCTION public.allocate_po_lines_to_shipment(UUID, JSONB, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.allocate_po_lines_to_shipment(UUID, JSONB, UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.issue_import_shipment(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.issue_import_shipment(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.update_import_shipment_status(UUID, public.import_shipment_status, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_import_shipment_status(UUID, public.import_shipment_status, UUID) TO authenticated;

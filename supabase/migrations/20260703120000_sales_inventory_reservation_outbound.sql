-- Sales order inventory reservation + outbound shipment RPCs
-- Migration: 20260703120000_sales_inventory_reservation_outbound.sql

-- --------------------------------------------------------------------
-- 1. inventory_reservations
-- --------------------------------------------------------------------
CREATE TYPE public.inventory_reservation_status AS ENUM (
    'ACTIVE',
    'RELEASED',
    'CONSUMED'
);

CREATE TYPE public.inventory_reservation_source_type AS ENUM (
    'SALES_ORDER'
);

CREATE TABLE public.inventory_reservations (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
    location_id         UUID NOT NULL REFERENCES public.tenant_locations (id) ON DELETE RESTRICT,
    item_id             UUID NOT NULL REFERENCES public.items (id) ON DELETE RESTRICT,
    variant_id          UUID NOT NULL REFERENCES public.item_variants (id) ON DELETE RESTRICT,
    source_document_type public.inventory_reservation_source_type NOT NULL,
    source_document_id  UUID NOT NULL,
    source_line_id      UUID NOT NULL,
    quantity_reserved   NUMERIC(15, 4) NOT NULL,
    status              public.inventory_reservation_status NOT NULL DEFAULT 'ACTIVE',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    released_at         TIMESTAMPTZ,
    CONSTRAINT inventory_reservations_quantity_positive_chk
        CHECK (status <> 'ACTIVE'::public.inventory_reservation_status OR quantity_reserved > 0),
    CONSTRAINT inventory_reservations_released_at_chk
        CHECK (
            (status = 'ACTIVE' AND released_at IS NULL)
            OR (status <> 'ACTIVE')
        )
);

CREATE UNIQUE INDEX inventory_reservations_tenant_id_id_unique
    ON public.inventory_reservations (tenant_id, id);

CREATE UNIQUE INDEX inventory_reservations_active_line_unique
    ON public.inventory_reservations (tenant_id, source_line_id)
    WHERE status = 'ACTIVE';

CREATE INDEX inventory_reservations_location_variant_active_idx
    ON public.inventory_reservations (tenant_id, location_id, variant_id)
    WHERE status = 'ACTIVE';

ALTER TABLE public.inventory_reservations
    ADD CONSTRAINT inventory_reservations_location_tenant_fk
    FOREIGN KEY (tenant_id, location_id)
    REFERENCES public.tenant_locations (tenant_id, id)
    ON DELETE RESTRICT;

ALTER TABLE public.inventory_reservations
    ADD CONSTRAINT inventory_reservations_item_tenant_fk
    FOREIGN KEY (tenant_id, item_id)
    REFERENCES public.items (tenant_id, id)
    ON DELETE RESTRICT;

ALTER TABLE public.inventory_reservations
    ADD CONSTRAINT inventory_reservations_variant_tenant_fk
    FOREIGN KEY (tenant_id, variant_id)
    REFERENCES public.item_variants (tenant_id, id)
    ON DELETE RESTRICT;

ALTER TABLE public.inventory_reservations ENABLE ROW LEVEL SECURITY;

CREATE POLICY inventory_reservations_tenant_isolation
    ON public.inventory_reservations FOR ALL TO authenticated
    USING (tenant_id = private.current_tenant_id())
    WITH CHECK (tenant_id = private.current_tenant_id());

CREATE TRIGGER inventory_reservations_set_updated_at
    BEFORE UPDATE ON public.inventory_reservations
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

-- --------------------------------------------------------------------
-- 2. Private reservation helpers
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.sales_line_tracks_inventory(
    p_tenant_id UUID,
    p_item_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
    SELECT COALESCE(
        (
            SELECT i.track_inventory
            FROM public.items i
            WHERE i.id = p_item_id
              AND i.tenant_id = p_tenant_id
        ),
        FALSE
    );
$$;

CREATE OR REPLACE FUNCTION private.get_item_reserved_quantity(
    p_tenant_id UUID,
    p_location_id UUID,
    p_item_id UUID,
    p_variant_id UUID
)
RETURNS NUMERIC(15, 4)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
    SELECT COALESCE(
        (
            SELECT SUM(ir.quantity_reserved)
            FROM public.inventory_reservations ir
            WHERE ir.tenant_id = p_tenant_id
              AND ir.location_id = p_location_id
              AND ir.item_id = p_item_id
              AND ir.variant_id = p_variant_id
              AND ir.status = 'ACTIVE'
        ),
        0.0000
    );
$$;

CREATE OR REPLACE FUNCTION private.get_item_available_quantity(
    p_tenant_id UUID,
    p_location_id UUID,
    p_item_id UUID,
    p_variant_id UUID
)
RETURNS NUMERIC(15, 4)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
    SELECT private.get_item_valuation_on_hand(
        p_tenant_id, p_location_id, p_item_id, p_variant_id
    ) - private.get_item_reserved_quantity(
        p_tenant_id, p_location_id, p_item_id, p_variant_id
    );
$$;

CREATE OR REPLACE FUNCTION private.get_active_line_reservation_qty(
    p_tenant_id UUID,
    p_source_line_id UUID
)
RETURNS NUMERIC(15, 4)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
    SELECT COALESCE(
        (
            SELECT ir.quantity_reserved
            FROM public.inventory_reservations ir
            WHERE ir.tenant_id = p_tenant_id
              AND ir.source_line_id = p_source_line_id
              AND ir.status = 'ACTIVE'
        ),
        0.0000
    );
$$;

CREATE OR REPLACE FUNCTION private.release_line_inventory_reservation(
    p_tenant_id UUID,
    p_source_line_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
BEGIN
    UPDATE public.inventory_reservations
    SET status = 'RELEASED',
        released_at = NOW(),
        updated_at = NOW()
    WHERE tenant_id = p_tenant_id
      AND source_line_id = p_source_line_id
      AND status = 'ACTIVE';

    UPDATE public.sales_order_items
    SET quantity_allocated = 0,
        updated_at = NOW()
    WHERE id = p_source_line_id
      AND tenant_id = p_tenant_id;
END;
$$;

CREATE OR REPLACE FUNCTION private.sync_sales_order_line_reservation(
    p_tenant_id UUID,
    p_location_id UUID,
    p_line_id UUID,
    p_item_id UUID,
    p_variant_id UUID,
    p_target_qty NUMERIC(15, 4),
    p_allow_oversell BOOLEAN
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_current_reserved NUMERIC(15, 4);
    v_on_hand NUMERIC(15, 4);
    v_total_reserved NUMERIC(15, 4);
    v_available NUMERIC(15, 4);
    v_reservation_id UUID;
BEGIN
    IF NOT private.sales_line_tracks_inventory(p_tenant_id, p_item_id) THEN
        PERFORM private.release_line_inventory_reservation(p_tenant_id, p_line_id);
        RETURN;
    END IF;

    IF p_variant_id IS NULL THEN
        RAISE EXCEPTION 'variant_id is required for inventory-tracked sales lines';
    END IF;

    IF p_target_qty <= 0 THEN
        PERFORM private.release_line_inventory_reservation(p_tenant_id, p_line_id);
        RETURN;
    END IF;

    v_current_reserved := private.get_active_line_reservation_qty(p_tenant_id, p_line_id);
    v_on_hand := private.get_item_valuation_on_hand(
        p_tenant_id, p_location_id, p_item_id, p_variant_id
    );
    v_total_reserved := private.get_item_reserved_quantity(
        p_tenant_id, p_location_id, p_item_id, p_variant_id
    );
    v_available := v_on_hand - (v_total_reserved - v_current_reserved);

    IF NOT p_allow_oversell AND p_target_qty > v_available + 0.0001 THEN
        RAISE EXCEPTION
            'insufficient available stock for variant % at location % (available=%, requested=%)',
            p_variant_id, p_location_id, v_available, p_target_qty;
    END IF;

    SELECT ir.id
    INTO v_reservation_id
    FROM public.inventory_reservations ir
    WHERE ir.tenant_id = p_tenant_id
      AND ir.source_line_id = p_line_id
      AND ir.status = 'ACTIVE'
    LIMIT 1;

    IF v_reservation_id IS NOT NULL THEN
        UPDATE public.inventory_reservations
        SET quantity_reserved = p_target_qty,
            location_id = p_location_id,
            item_id = p_item_id,
            variant_id = p_variant_id,
            updated_at = NOW()
        WHERE id = v_reservation_id;
    ELSE
        INSERT INTO public.inventory_reservations (
            tenant_id, location_id, item_id, variant_id,
            source_document_type, source_document_id, source_line_id,
            quantity_reserved, status
        )
        SELECT
            p_tenant_id, p_location_id, p_item_id, p_variant_id,
            'SALES_ORDER'::public.inventory_reservation_source_type,
            soi.sales_order_id, p_line_id,
            p_target_qty, 'ACTIVE'::public.inventory_reservation_status
        FROM public.sales_order_items soi
        WHERE soi.id = p_line_id
          AND soi.tenant_id = p_tenant_id;
    END IF;

    UPDATE public.sales_order_items
    SET quantity_allocated = p_target_qty,
        updated_at = NOW()
    WHERE id = p_line_id
      AND tenant_id = p_tenant_id;
END;
$$;

CREATE OR REPLACE FUNCTION private.release_sales_order_reservations(
    p_tenant_id UUID,
    p_sales_order_id UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_line RECORD;
    v_count INTEGER := 0;
BEGIN
    FOR v_line IN
        SELECT soi.id
        FROM public.sales_order_items soi
        WHERE soi.tenant_id = p_tenant_id
          AND soi.sales_order_id = p_sales_order_id
    LOOP
        IF private.get_active_line_reservation_qty(p_tenant_id, v_line.id) > 0 THEN
            PERFORM private.release_line_inventory_reservation(p_tenant_id, v_line.id);
            v_count := v_count + 1;
        END IF;
    END LOOP;

    RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION private.consume_sales_order_line_reservation(
    p_tenant_id UUID,
    p_line_id UUID,
    p_quantity NUMERIC(15, 4)
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_active_qty NUMERIC(15, 4);
    v_reservation_id UUID;
    v_new_qty NUMERIC(15, 4);
BEGIN
    IF p_quantity <= 0 THEN
        RAISE EXCEPTION 'consume quantity must be positive';
    END IF;

    SELECT ir.id, ir.quantity_reserved
    INTO v_reservation_id, v_active_qty
    FROM public.inventory_reservations ir
    WHERE ir.tenant_id = p_tenant_id
      AND ir.source_line_id = p_line_id
      AND ir.status = 'ACTIVE'
    LIMIT 1;

    IF v_reservation_id IS NULL THEN
        RAISE EXCEPTION 'no active reservation for sales order line %', p_line_id;
    END IF;

    IF p_quantity > v_active_qty + 0.0001 THEN
        RAISE EXCEPTION
            'ship quantity % exceeds reserved quantity % on line %',
            p_quantity, v_active_qty, p_line_id;
    END IF;

    v_new_qty := v_active_qty - p_quantity;

    IF v_new_qty <= 0.0001 THEN
        UPDATE public.inventory_reservations
        SET status = 'CONSUMED',
            released_at = NOW(),
            updated_at = NOW()
        WHERE id = v_reservation_id;

        UPDATE public.sales_order_items
        SET quantity_allocated = 0,
            updated_at = NOW()
        WHERE id = p_line_id
          AND tenant_id = p_tenant_id;
    ELSE
        UPDATE public.inventory_reservations
        SET quantity_reserved = v_new_qty,
            updated_at = NOW()
        WHERE id = v_reservation_id;

        UPDATE public.sales_order_items
        SET quantity_allocated = v_new_qty,
            updated_at = NOW()
        WHERE id = p_line_id
          AND tenant_id = p_tenant_id;
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION private.reserve_sales_order_inventory(
    p_tenant_id UUID,
    p_sales_order_id UUID,
    p_allow_oversell BOOLEAN
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_so RECORD;
    v_line RECORD;
    v_target NUMERIC(15, 4);
    v_count INTEGER := 0;
BEGIN
    SELECT *
    INTO v_so
    FROM public.sales_orders
    WHERE id = p_sales_order_id
      AND tenant_id = p_tenant_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'sales order not found';
    END IF;

    IF v_so.shipping_location_id IS NULL THEN
        RAISE EXCEPTION 'shipping location is required before confirming inventory-tracked sales orders';
    END IF;

    FOR v_line IN
        SELECT soi.*
        FROM public.sales_order_items soi
        WHERE soi.tenant_id = p_tenant_id
          AND soi.sales_order_id = p_sales_order_id
    LOOP
        v_target := GREATEST(v_line.quantity_ordered - v_line.quantity_shipped, 0);

        IF private.sales_line_tracks_inventory(p_tenant_id, v_line.item_id) THEN
            PERFORM private.sync_sales_order_line_reservation(
                p_tenant_id,
                v_so.shipping_location_id,
                v_line.id,
                v_line.item_id,
                v_line.variant_id,
                v_target,
                p_allow_oversell
            );
            IF v_target > 0 THEN
                v_count := v_count + 1;
            END IF;
        ELSE
            PERFORM private.release_line_inventory_reservation(p_tenant_id, v_line.id);
        END IF;
    END LOOP;

    RETURN v_count;
END;
$$;

-- --------------------------------------------------------------------
-- 3. confirm_sales_order (with reservation)
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.confirm_sales_order(p_sales_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_tenant_id UUID;
    v_user_id UUID;
    v_so RECORD;
    v_line_count INTEGER;
    v_allow_oversell BOOLEAN;
    v_reserved_lines INTEGER;
BEGIN
    v_tenant_id := private.current_tenant_id();
    v_user_id := auth.uid();

    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'tenant context missing from session';
    END IF;

    IF NOT private.can_edit_sales_orders() THEN
        RAISE EXCEPTION 'sales order edit permission required';
    END IF;

    SELECT * INTO v_so
    FROM public.sales_orders
    WHERE id = p_sales_order_id AND tenant_id = v_tenant_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'sales order not found';
    END IF;

    IF v_so.commercial_status = 'DRAFT'::public.sales_document_status THEN
        IF private.so_approval_required(v_tenant_id, v_so.total_net_amount, v_user_id, p_sales_order_id) THEN
            RAISE EXCEPTION 'sales order approval is required before confirmation';
        END IF;
    ELSIF v_so.commercial_status = 'PENDING_APPROVAL'::public.sales_document_status THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.document_approval_requests dar
            WHERE dar.tenant_id = v_tenant_id
              AND dar.document_type = 'SALES_ORDER'
              AND dar.document_id = p_sales_order_id
              AND dar.status = 'APPROVED'
        )
        AND NOT EXISTS (
            SELECT 1 FROM public.document_approval_runs r
            WHERE r.tenant_id = v_tenant_id
              AND r.document_type = 'SALES_ORDER'
              AND r.document_id = p_sales_order_id
              AND r.status = 'APPROVED'
        ) THEN
            RAISE EXCEPTION 'sales order must be approved before confirmation';
        END IF;
    ELSE
        RAISE EXCEPTION 'only draft or pending-approval sales orders can be confirmed';
    END IF;

    SELECT COUNT(*) INTO v_line_count
    FROM public.sales_order_items
    WHERE sales_order_id = p_sales_order_id AND tenant_id = v_tenant_id;

    IF v_line_count < 1 THEN
        RAISE EXCEPTION 'sales order must have at least one line before confirmation';
    END IF;

    v_allow_oversell := private.get_inventory_control_flag(v_tenant_id, 'allow_negative_inventory');
    v_reserved_lines := private.reserve_sales_order_inventory(
        v_tenant_id, p_sales_order_id, v_allow_oversell
    );

    UPDATE public.sales_orders
    SET commercial_status = 'APPROVED_ACTIVE'::public.sales_document_status,
        updated_at = NOW()
    WHERE id = p_sales_order_id;

    RETURN jsonb_build_object(
        'sales_order_id', p_sales_order_id,
        'commercial_status', 'APPROVED_ACTIVE',
        'reserved_line_count', v_reserved_lines
    );
END;
$$;

-- --------------------------------------------------------------------
-- 4. cancel_sales_order
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cancel_sales_order(p_sales_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_tenant_id UUID;
    v_so RECORD;
    v_released INTEGER;
BEGIN
    v_tenant_id := private.current_tenant_id();

    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'tenant context missing from session';
    END IF;

    IF NOT private.can_edit_sales_orders() THEN
        RAISE EXCEPTION 'sales order edit permission required';
    END IF;

    SELECT * INTO v_so
    FROM public.sales_orders
    WHERE id = p_sales_order_id AND tenant_id = v_tenant_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'sales order not found';
    END IF;

    IF v_so.commercial_status <> 'APPROVED_ACTIVE'::public.sales_document_status THEN
        RAISE EXCEPTION 'only confirmed sales orders can be cancelled';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.sales_order_items soi
        WHERE soi.tenant_id = v_tenant_id
          AND soi.sales_order_id = p_sales_order_id
          AND soi.quantity_shipped > 0
    ) THEN
        RAISE EXCEPTION 'cannot cancel a sales order with shipped quantities';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.sales_invoices si
        WHERE si.tenant_id = v_tenant_id
          AND si.source_order_id = p_sales_order_id
          AND si.commercial_status = 'APPROVED_ACTIVE'::public.sales_document_status
    ) THEN
        RAISE EXCEPTION 'cannot cancel a sales order with posted invoices';
    END IF;

    v_released := private.release_sales_order_reservations(v_tenant_id, p_sales_order_id);

    UPDATE public.sales_orders
    SET commercial_status = 'CANCELLED'::public.sales_document_status,
        updated_at = NOW()
    WHERE id = p_sales_order_id;

    RETURN jsonb_build_object(
        'sales_order_id', p_sales_order_id,
        'commercial_status', 'CANCELLED',
        'released_line_count', v_released
    );
END;
$$;

-- --------------------------------------------------------------------
-- 5. amend_confirmed_sales_order
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.amend_confirmed_sales_order(
    p_sales_order_id UUID,
    p_customer_id UUID,
    p_lines JSONB,
    p_billing_state TEXT,
    p_shipping_state TEXT,
    p_payment_terms_days INTEGER DEFAULT NULL,
    p_custom_fields JSONB DEFAULT NULL,
    p_currency_code VARCHAR(3) DEFAULT NULL,
    p_exchange_rate NUMERIC DEFAULT NULL,
    p_prices_tax_inclusive BOOLEAN DEFAULT NULL,
    p_shipping_amount NUMERIC DEFAULT NULL,
    p_shipping_tax_rate_pct NUMERIC DEFAULT NULL,
    p_round_off_amount NUMERIC DEFAULT NULL,
    p_additional_charges_amount NUMERIC DEFAULT NULL,
    p_transaction_discount_percentage NUMERIC DEFAULT NULL,
    p_transaction_discount_amount NUMERIC DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_tenant_id UUID;
    v_so RECORD;
    v_customer RECORD;
    v_gst RECORD;
    v_entry JSONB;
    v_line RECORD;
    v_line_id UUID;
    v_line_count INTEGER := 0;
    v_total_gross NUMERIC(15, 4) := 0;
    v_total_tax NUMERIC(15, 4) := 0;
    v_subtotal NUMERIC(15, 4) := 0;
    v_txn_discount NUMERIC(15, 4) := 0;
    v_payment_terms INTEGER := GREATEST(COALESCE(p_payment_terms_days, 0), 0);
    v_custom_fields JSONB := COALESCE(p_custom_fields, '{}'::jsonb);
    v_currency_code VARCHAR(3);
    v_exchange_rate NUMERIC(15, 4) := GREATEST(COALESCE(p_exchange_rate, 1), 0.0001);
    v_prices_tax_inclusive BOOLEAN := COALESCE(p_prices_tax_inclusive, FALSE);
    v_shipping_amount NUMERIC(15, 4) := GREATEST(COALESCE(p_shipping_amount, 0), 0);
    v_shipping_tax_rate_pct NUMERIC(15, 4) := GREATEST(COALESCE(p_shipping_tax_rate_pct, 0), 0);
    v_shipping_tax_amount NUMERIC(15, 4) := ROUND(v_shipping_amount * v_shipping_tax_rate_pct / 100, 4);
    v_round_off_amount NUMERIC(15, 4) := COALESCE(p_round_off_amount, 0);
    v_additional_charges_amount NUMERIC(15, 4) := GREATEST(COALESCE(p_additional_charges_amount, 0), 0);
    v_txn_discount_pct NUMERIC(5, 2) := GREATEST(COALESCE(p_transaction_discount_percentage, 0), 0);
    v_txn_discount_amt NUMERIC(15, 4) := GREATEST(COALESCE(p_transaction_discount_amount, 0), 0);
    v_total_net NUMERIC(15, 4);
    v_allow_oversell BOOLEAN;
    v_target NUMERIC(15, 4);
    v_payload_ids UUID[] := ARRAY[]::UUID[];
    v_existing RECORD;
BEGIN
    v_tenant_id := private.current_tenant_id();
    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'tenant context missing from session';
    END IF;

    IF NOT private.can_edit_sales_orders() THEN
        RAISE EXCEPTION 'sales order edit permission required';
    END IF;

    IF p_customer_id IS NULL THEN
        RAISE EXCEPTION 'customer_id is required';
    END IF;

    IF p_lines IS NULL OR jsonb_typeof(p_lines) <> 'array' OR jsonb_array_length(p_lines) = 0 THEN
        RAISE EXCEPTION 'at least one sales order line is required';
    END IF;

    SELECT * INTO v_so
    FROM public.sales_orders
    WHERE id = p_sales_order_id AND tenant_id = v_tenant_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'sales order not found';
    END IF;

    IF v_so.commercial_status <> 'APPROVED_ACTIVE'::public.sales_document_status THEN
        RAISE EXCEPTION 'only confirmed sales orders can be amended';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.sales_order_items soi
        WHERE soi.tenant_id = v_tenant_id
          AND soi.sales_order_id = p_sales_order_id
          AND soi.quantity_shipped > 0
    ) THEN
        RAISE EXCEPTION 'cannot amend a sales order with shipped quantities';
    END IF;

    SELECT * INTO v_customer
    FROM public.entities
    WHERE id = p_customer_id AND tenant_id = v_tenant_id AND is_active = TRUE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'customer not found';
    END IF;

    SELECT upper(btrim(COALESCE(
        p_currency_code,
        (SELECT t.base_currency FROM public.tenants t WHERE t.id = v_tenant_id),
        'INR'
    ))) INTO v_currency_code;

    SELECT * INTO v_gst
    FROM private.resolve_sales_document_gst_context(
        v_tenant_id, p_customer_id, p_billing_state, p_shipping_state, v_so.shipping_location_id
    );

    v_allow_oversell := private.get_inventory_control_flag(v_tenant_id, 'allow_negative_inventory');

    FOR v_entry IN SELECT value FROM jsonb_array_elements(p_lines)
    LOOP
        v_line_id := NULLIF(v_entry ->> 'id', '')::UUID;
        IF v_line_id IS NOT NULL THEN
            v_payload_ids := array_append(v_payload_ids, v_line_id);
        END IF;
    END LOOP;

    FOR v_existing IN
        SELECT soi.id
        FROM public.sales_order_items soi
        WHERE soi.tenant_id = v_tenant_id
          AND soi.sales_order_id = p_sales_order_id
          AND NOT (soi.id = ANY (v_payload_ids))
    LOOP
        PERFORM private.release_line_inventory_reservation(v_tenant_id, v_existing.id);
        DELETE FROM public.sales_order_items
        WHERE id = v_existing.id AND tenant_id = v_tenant_id;
    END LOOP;

    FOR v_entry IN SELECT value FROM jsonb_array_elements(p_lines)
    LOOP
        SELECT * INTO v_line
        FROM private.compute_sales_line_amounts(
            v_entry, v_tenant_id, v_prices_tax_inclusive,
            v_gst.tax_supply_nature, v_gst.tax_mechanism
        );

        v_line_id := NULLIF(v_entry ->> 'id', '')::UUID;

        IF v_line_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.sales_order_items soi
            WHERE soi.id = v_line_id
              AND soi.tenant_id = v_tenant_id
              AND soi.sales_order_id = p_sales_order_id
        ) THEN
            UPDATE public.sales_order_items
            SET item_id = v_line.item_id,
                variant_id = v_line.variant_id,
                uom_code = v_line.uom_code,
                uom_conversion_factor = v_line.uom_conversion_factor,
                quantity_ordered = v_line.quantity,
                unit_price_selling = v_line.unit_price,
                discount_percentage = v_line.discount_percentage,
                discount_amount = v_line.discount_amount,
                tax_rate_percentage = v_line.tax_rate_percentage,
                tax_components_json = v_line.tax_components_json,
                line_tax_amount = v_line.line_tax_amount,
                line_total_gross = v_line.line_total_gross,
                updated_at = NOW()
            WHERE id = v_line_id AND tenant_id = v_tenant_id;
        ELSE
            INSERT INTO public.sales_order_items (
                tenant_id, sales_order_id, item_id, variant_id,
                uom_code, uom_conversion_factor, quantity_ordered,
                unit_price_selling, discount_percentage, discount_amount,
                tax_rate_percentage, tax_components_json,
                line_tax_amount, line_total_gross
            )
            VALUES (
                v_tenant_id, p_sales_order_id, v_line.item_id, v_line.variant_id,
                v_line.uom_code, v_line.uom_conversion_factor, v_line.quantity,
                v_line.unit_price, v_line.discount_percentage, v_line.discount_amount,
                v_line.tax_rate_percentage, v_line.tax_components_json,
                v_line.line_tax_amount, v_line.line_total_gross
            )
            RETURNING id INTO v_line_id;
        END IF;

        v_target := v_line.quantity;
        PERFORM private.sync_sales_order_line_reservation(
            v_tenant_id,
            v_so.shipping_location_id,
            v_line_id,
            v_line.item_id,
            v_line.variant_id,
            v_target,
            v_allow_oversell
        );

        v_subtotal := v_subtotal + v_line.line_total_gross;
        v_total_gross := v_total_gross + v_line.line_total_gross;
        v_total_tax := v_total_tax + v_line.line_tax_amount;
        v_line_count := v_line_count + 1;
    END LOOP;

    IF v_line_count = 0 THEN
        RAISE EXCEPTION 'no valid sales order lines were saved';
    END IF;

    IF v_txn_discount_amt > 0 THEN
        v_txn_discount := LEAST(v_txn_discount_amt, v_subtotal);
    ELSIF v_txn_discount_pct > 0 THEN
        v_txn_discount := LEAST(v_subtotal, ROUND(v_subtotal * v_txn_discount_pct / 100, 4));
    END IF;

    v_total_gross := GREATEST(v_total_gross - v_txn_discount, 0);
    v_total_tax := v_total_tax + v_shipping_tax_amount;
    v_total_net := v_total_gross + v_total_tax + v_shipping_amount + v_additional_charges_amount + v_round_off_amount;

    UPDATE public.sales_orders
    SET customer_id = p_customer_id,
        billing_state = p_billing_state,
        shipping_state = p_shipping_state,
        payment_terms_days = v_payment_terms,
        currency_code = v_currency_code,
        exchange_rate = v_exchange_rate,
        prices_tax_inclusive = v_prices_tax_inclusive,
        tax_supply_nature = v_gst.tax_supply_nature,
        tax_mechanism = v_gst.tax_mechanism,
        customer_tax_treatment = v_gst.customer_tax_treatment,
        customer_country_code = v_gst.customer_country_code,
        rcm_applicable = v_gst.rcm_applicable,
        shipping_amount = v_shipping_amount,
        shipping_tax_rate_pct = v_shipping_tax_rate_pct,
        shipping_tax_amount = v_shipping_tax_amount,
        round_off_amount = v_round_off_amount,
        additional_charges_amount = v_additional_charges_amount,
        transaction_discount_percentage = v_txn_discount_pct,
        transaction_discount_amount = v_txn_discount_amt,
        custom_fields = v_custom_fields,
        total_gross_amount = v_total_gross,
        total_tax_amount = v_total_tax,
        total_net_amount = v_total_net,
        updated_at = NOW()
    WHERE id = p_sales_order_id;

    RETURN p_sales_order_id;
END;
$$;

-- --------------------------------------------------------------------
-- 6. post_sales_shipment
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.post_sales_shipment(
    p_sales_order_id UUID,
    p_lines JSONB,
    p_carrier_provider public.shipping_carrier_provider,
    p_tracking_number TEXT,
    p_created_by UUID,
    p_box_identifier TEXT DEFAULT 'PKG-1',
    p_box_length_cm NUMERIC DEFAULT 1,
    p_box_width_cm NUMERIC DEFAULT 1,
    p_box_height_cm NUMERIC DEFAULT 1,
    p_total_dead_weight_kg NUMERIC DEFAULT 0
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_tenant_id UUID;
    v_so RECORD;
    v_entry JSONB;
    v_line_id UUID;
    v_qty NUMERIC(15, 4);
    v_so_line RECORD;
    v_open NUMERIC(15, 4);
    v_shipment_id UUID;
    v_package_id UUID;
    v_line_count INTEGER := 0;
BEGIN
    v_tenant_id := private.current_tenant_id();

    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'tenant context missing from session';
    END IF;

    IF NOT private.can_edit_sales_orders() THEN
        RAISE EXCEPTION 'sales order edit permission required';
    END IF;

    IF p_created_by IS NULL THEN
        RAISE EXCEPTION 'created_by is required';
    END IF;

    IF p_tracking_number IS NULL OR btrim(p_tracking_number) = '' THEN
        RAISE EXCEPTION 'tracking number is required';
    END IF;

    IF p_lines IS NULL OR jsonb_typeof(p_lines) <> 'array' OR jsonb_array_length(p_lines) = 0 THEN
        RAISE EXCEPTION 'at least one shipment line is required';
    END IF;

    SELECT * INTO v_so
    FROM public.sales_orders
    WHERE id = p_sales_order_id AND tenant_id = v_tenant_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'sales order not found';
    END IF;

    IF v_so.commercial_status NOT IN (
        'APPROVED_ACTIVE'::public.sales_document_status,
        'PARTIALLY_SHIPPED'::public.sales_document_status
    ) THEN
        RAISE EXCEPTION 'only confirmed or partially shipped sales orders can be shipped';
    END IF;

    IF v_so.shipping_location_id IS NULL THEN
        RAISE EXCEPTION 'sales order has no shipping location';
    END IF;

    INSERT INTO public.sales_shipments (
        tenant_id, sales_order_id, origin_location_id,
        carrier_provider, tracking_number, dispatched_at
    )
    VALUES (
        v_tenant_id, p_sales_order_id, v_so.shipping_location_id,
        p_carrier_provider, btrim(p_tracking_number), NOW()
    )
    RETURNING id INTO v_shipment_id;

    INSERT INTO public.sales_shipment_packages (
        tenant_id, sales_shipment_id, box_identifier,
        box_length_cm, box_width_cm, box_height_cm, total_dead_weight_kg
    )
    VALUES (
        v_tenant_id, v_shipment_id, COALESCE(NULLIF(btrim(p_box_identifier), ''), 'PKG-1'),
        GREATEST(COALESCE(p_box_length_cm, 1), 0.01),
        GREATEST(COALESCE(p_box_width_cm, 1), 0.01),
        GREATEST(COALESCE(p_box_height_cm, 1), 0.01),
        GREATEST(COALESCE(p_total_dead_weight_kg, 0), 0)
    )
    RETURNING id INTO v_package_id;

    FOR v_entry IN SELECT value FROM jsonb_array_elements(p_lines)
    LOOP
        v_line_id := NULLIF(v_entry ->> 'sales_order_item_id', '')::UUID;
        v_qty := (v_entry ->> 'quantity_shipped')::NUMERIC(15, 4);

        IF v_line_id IS NULL OR v_qty IS NULL OR v_qty <= 0 THEN
            RAISE EXCEPTION 'each shipment line requires sales_order_item_id and positive quantity_shipped';
        END IF;

        SELECT * INTO v_so_line
        FROM public.sales_order_items
        WHERE id = v_line_id
          AND tenant_id = v_tenant_id
          AND sales_order_id = p_sales_order_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'sales order line % not found on order', v_line_id;
        END IF;

        v_open := v_so_line.quantity_ordered - v_so_line.quantity_shipped;
        IF v_qty > v_open + 0.0001 THEN
            RAISE EXCEPTION 'ship quantity exceeds open order quantity on line %', v_line_id;
        END IF;

        IF private.sales_line_tracks_inventory(v_tenant_id, v_so_line.item_id) THEN
            PERFORM private.consume_sales_order_line_reservation(v_tenant_id, v_line_id, v_qty);
        END IF;

        INSERT INTO public.sales_shipment_items (
            tenant_id, sales_shipment_package_id, sales_order_item_id, quantity_shipped
        )
        VALUES (v_tenant_id, v_package_id, v_line_id, v_qty);

        v_line_count := v_line_count + 1;
    END LOOP;

    IF v_line_count = 0 THEN
        RAISE EXCEPTION 'no valid shipment lines were posted';
    END IF;

    RETURN v_shipment_id;
END;
$$;

-- --------------------------------------------------------------------
-- 7. Batch availability read (for line stock context)
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_variant_availability_at_location(
    p_location_id UUID,
    p_variant_ids UUID[]
)
RETURNS TABLE (
    variant_id UUID,
    quantity_on_hand NUMERIC(15, 4),
    quantity_reserved NUMERIC(15, 4),
    quantity_available NUMERIC(15, 4)
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_tenant_id UUID;
BEGIN
    v_tenant_id := private.current_tenant_id();
    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'tenant context missing from session';
    END IF;

    RETURN QUERY
    WITH ids AS (
        SELECT DISTINCT unnest(p_variant_ids) AS variant_id
    ),
    variants AS (
        SELECT iv.id AS variant_id, iv.item_id
        FROM public.item_variants iv
        INNER JOIN ids ON ids.variant_id = iv.id
        WHERE iv.tenant_id = v_tenant_id
    )
    SELECT
        v.variant_id,
        COALESCE(val.total_quantity_on_hand, 0.0000) AS quantity_on_hand,
        COALESCE(res.quantity_reserved, 0.0000) AS quantity_reserved,
        COALESCE(val.total_quantity_on_hand, 0.0000) - COALESCE(res.quantity_reserved, 0.0000) AS quantity_available
    FROM variants v
    LEFT JOIN public.item_valuations val
        ON val.tenant_id = v_tenant_id
       AND val.location_id = p_location_id
       AND val.item_id = v.item_id
       AND val.variant_id = v.variant_id
    LEFT JOIN LATERAL (
        SELECT SUM(ir.quantity_reserved) AS quantity_reserved
        FROM public.inventory_reservations ir
        WHERE ir.tenant_id = v_tenant_id
          AND ir.location_id = p_location_id
          AND ir.variant_id = v.variant_id
          AND ir.status = 'ACTIVE'
    ) res ON TRUE;
END;
$$;

-- --------------------------------------------------------------------
-- 8. Backfill reservations for existing confirmed orders
-- --------------------------------------------------------------------
DO $$
DECLARE
    v_so RECORD;
    v_allow BOOLEAN;
BEGIN
    FOR v_so IN
        SELECT so.id, so.tenant_id
        FROM public.sales_orders so
        WHERE so.commercial_status = 'APPROVED_ACTIVE'::public.sales_document_status
          AND so.shipping_location_id IS NOT NULL
          AND NOT EXISTS (
              SELECT 1
              FROM public.sales_order_items soi
              WHERE soi.sales_order_id = so.id
                AND soi.tenant_id = so.tenant_id
                AND soi.quantity_shipped > 0
          )
    LOOP
        v_allow := private.get_inventory_control_flag(v_so.tenant_id, 'allow_negative_inventory');
        PERFORM private.reserve_sales_order_inventory(v_so.tenant_id, v_so.id, v_allow);
    END LOOP;
END;
$$;

-- --------------------------------------------------------------------
-- 9. Grants
-- --------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.cancel_sales_order(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_sales_order(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.amend_confirmed_sales_order(
    UUID, UUID, JSONB, TEXT, TEXT, INTEGER, JSONB, VARCHAR, NUMERIC, BOOLEAN,
    NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.amend_confirmed_sales_order(
    UUID, UUID, JSONB, TEXT, TEXT, INTEGER, JSONB, VARCHAR, NUMERIC, BOOLEAN,
    NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC
) TO authenticated;

REVOKE ALL ON FUNCTION public.post_sales_shipment(
    UUID, JSONB, public.shipping_carrier_provider, TEXT, UUID, TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.post_sales_shipment(
    UUID, JSONB, public.shipping_carrier_provider, TEXT, UUID, TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC
) TO authenticated;

REVOKE ALL ON FUNCTION public.get_variant_availability_at_location(UUID, UUID[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_variant_availability_at_location(UUID, UUID[]) TO authenticated;

GRANT EXECUTE ON FUNCTION private.get_item_reserved_quantity(UUID, UUID, UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION private.get_item_available_quantity(UUID, UUID, UUID, UUID) TO authenticated;

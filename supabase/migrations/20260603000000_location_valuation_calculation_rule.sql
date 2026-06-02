-- ====================================================================
-- Location-scoped inventory valuation calculation rules (Phase 1 plumbing)
-- ====================================================================

-- --------------------------------------------------------------------
-- 1. Enum + column + eligibility constraint
-- --------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'location_valuation_calculation_rule') THEN
        CREATE TYPE public.location_valuation_calculation_rule AS ENUM ('FIFO', 'MWAC');
    END IF;
END;
$$;

ALTER TABLE public.tenant_locations
    ADD COLUMN IF NOT EXISTS valuation_calculation_rule public.location_valuation_calculation_rule NULL;

ALTER TABLE public.tenant_locations
    DROP CONSTRAINT IF EXISTS tenant_locations_valuation_rule_eligibility_chk;

ALTER TABLE public.tenant_locations
    ADD CONSTRAINT tenant_locations_valuation_rule_eligibility_chk
    CHECK (
        (COALESCE(is_stock_holding, FALSE) OR COALESCE(is_commercial_storefront, FALSE))
        OR valuation_calculation_rule IS NULL
    );

-- --------------------------------------------------------------------
-- 2. Resolver helpers
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.location_is_valuation_eligible(
    p_is_stock_holding BOOLEAN,
    p_is_commercial_storefront BOOLEAN
)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT COALESCE(p_is_stock_holding, FALSE) OR COALESCE(p_is_commercial_storefront, FALSE);
$$;

CREATE OR REPLACE FUNCTION private.normalize_location_valuation_rule(p_rule TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    v_normalized TEXT;
BEGIN
    v_normalized := upper(btrim(COALESCE(p_rule, '')));
    IF v_normalized = 'MWAC' THEN
        RETURN 'MWAC';
    END IF;
    RETURN 'FIFO';
END;
$$;

CREATE OR REPLACE FUNCTION private.resolve_location_valuation_rule(
    p_tenant_id UUID,
    p_location_id UUID
)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_location_rule public.location_valuation_calculation_rule;
    v_tenant_rule TEXT;
BEGIN
    SELECT tl.valuation_calculation_rule,
           t.accounting_config ->> 'inventory_valuation_method'
    INTO v_location_rule, v_tenant_rule
    FROM public.tenant_locations tl
    INNER JOIN public.tenants t ON t.id = tl.tenant_id
    WHERE tl.tenant_id = p_tenant_id
      AND tl.id = p_location_id;

    IF v_location_rule IS NOT NULL THEN
        RETURN v_location_rule::TEXT;
    END IF;

    RETURN private.normalize_location_valuation_rule(v_tenant_rule);
END;
$$;

CREATE OR REPLACE FUNCTION private.assert_inventory_costing_engine_supported(p_engine TEXT)
RETURNS VOID
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
    IF upper(btrim(COALESCE(p_engine, ''))) = 'FIFO' THEN
        RAISE EXCEPTION
            'FIFO valuation calculation layers are not yet supported in the backend ledger engine.';
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION private.resolve_effective_inventory_engine(
    p_tenant_id UUID,
    p_location_id UUID,
    p_item_id UUID
)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_costing_method public.item_costing_method;
BEGIN
    SELECT i.costing_method
    INTO v_costing_method
    FROM public.items i
    WHERE i.tenant_id = p_tenant_id
      AND i.id = p_item_id;

    IF v_costing_method IS NULL THEN
        RETURN private.resolve_location_valuation_rule(p_tenant_id, p_location_id);
    END IF;

    IF v_costing_method = 'STANDARD'::public.item_costing_method THEN
        RETURN 'STANDARD';
    END IF;

    IF v_costing_method = 'FIFO'::public.item_costing_method THEN
        RETURN 'FIFO';
    END IF;

    RETURN private.resolve_location_valuation_rule(p_tenant_id, p_location_id);
END;
$$;

-- --------------------------------------------------------------------
-- 3. MWAC core (extracted unchanged from inventory_ledger_apply_mwac)
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.inventory_ledger_apply_mwac_core(
    p_tenant_id UUID,
    p_location_id UUID,
    p_item_id UUID,
    p_variant_id UUID,
    p_quantity NUMERIC,
    p_cost_at_transaction NUMERIC
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_existing_qty NUMERIC(15, 4);
    v_existing_cost NUMERIC(15, 4);
    v_new_avg NUMERIC(15, 4);
    v_new_qty NUMERIC(15, 4);
BEGIN
    IF p_quantity <= 0 THEN
        UPDATE public.item_valuations
        SET total_quantity_on_hand = GREATEST(total_quantity_on_hand + p_quantity, 0.0000),
            updated_at = NOW()
        WHERE tenant_id = p_tenant_id
          AND location_id = p_location_id
          AND item_id = p_item_id
          AND variant_id IS NOT DISTINCT FROM p_variant_id;

        IF NOT FOUND AND p_quantity < 0 THEN
            INSERT INTO public.item_valuations (
                tenant_id, location_id, item_id, variant_id,
                current_average_cost, total_quantity_on_hand
            )
            VALUES (
                p_tenant_id, p_location_id, p_item_id, p_variant_id,
                0.0000, 0.0000
            );
        END IF;

        RETURN;
    END IF;

    SELECT current_average_cost, total_quantity_on_hand
    INTO v_existing_cost, v_existing_qty
    FROM public.item_valuations
    WHERE tenant_id = p_tenant_id
      AND location_id = p_location_id
      AND item_id = p_item_id
      AND variant_id IS NOT DISTINCT FROM p_variant_id
    FOR UPDATE;

    IF NOT FOUND THEN
        INSERT INTO public.item_valuations (
            tenant_id, location_id, item_id, variant_id,
            current_average_cost, total_quantity_on_hand
        )
        VALUES (
            p_tenant_id, p_location_id, p_item_id, p_variant_id,
            p_cost_at_transaction, p_quantity
        );
        RETURN;
    END IF;

    IF v_existing_qty + p_quantity = 0 THEN
        v_new_avg := 0.0000;
        v_new_qty := 0.0000;
    ELSE
        v_new_qty := v_existing_qty + p_quantity;
        v_new_avg := (
            (v_existing_qty * v_existing_cost) + (p_quantity * p_cost_at_transaction)
        ) / v_new_qty;
    END IF;

    UPDATE public.item_valuations
    SET current_average_cost = v_new_avg,
        total_quantity_on_hand = v_new_qty,
        updated_at = NOW()
    WHERE tenant_id = p_tenant_id
      AND location_id = p_location_id
      AND item_id = p_item_id
      AND variant_id IS NOT DISTINCT FROM p_variant_id;
END;
$$;

CREATE OR REPLACE FUNCTION private.inventory_ledger_apply_standard_core(
    p_tenant_id UUID,
    p_location_id UUID,
    p_item_id UUID,
    p_variant_id UUID,
    p_quantity NUMERIC,
    p_cost_at_transaction NUMERIC
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_standard_cost NUMERIC(15, 4);
    v_existing_qty NUMERIC(15, 4);
BEGIN
    SELECT COALESCE(i.standard_cost, p_cost_at_transaction, 0.0000)
    INTO v_standard_cost
    FROM public.items i
    WHERE i.tenant_id = p_tenant_id
      AND i.id = p_item_id;

    IF p_quantity <= 0 THEN
        UPDATE public.item_valuations
        SET total_quantity_on_hand = GREATEST(total_quantity_on_hand + p_quantity, 0.0000),
            updated_at = NOW()
        WHERE tenant_id = p_tenant_id
          AND location_id = p_location_id
          AND item_id = p_item_id
          AND variant_id IS NOT DISTINCT FROM p_variant_id;

        IF NOT FOUND AND p_quantity < 0 THEN
            INSERT INTO public.item_valuations (
                tenant_id, location_id, item_id, variant_id,
                current_average_cost, total_quantity_on_hand
            )
            VALUES (
                p_tenant_id, p_location_id, p_item_id, p_variant_id,
                v_standard_cost, 0.0000
            );
        END IF;

        RETURN;
    END IF;

    SELECT total_quantity_on_hand
    INTO v_existing_qty
    FROM public.item_valuations
    WHERE tenant_id = p_tenant_id
      AND location_id = p_location_id
      AND item_id = p_item_id
      AND variant_id IS NOT DISTINCT FROM p_variant_id
    FOR UPDATE;

    IF NOT FOUND THEN
        INSERT INTO public.item_valuations (
            tenant_id, location_id, item_id, variant_id,
            current_average_cost, total_quantity_on_hand
        )
        VALUES (
            p_tenant_id, p_location_id, p_item_id, p_variant_id,
            v_standard_cost, p_quantity
        );
        RETURN;
    END IF;

    UPDATE public.item_valuations
    SET total_quantity_on_hand = v_existing_qty + p_quantity,
        updated_at = NOW()
    WHERE tenant_id = p_tenant_id
      AND location_id = p_location_id
      AND item_id = p_item_id
      AND variant_id IS NOT DISTINCT FROM p_variant_id;
END;
$$;

-- --------------------------------------------------------------------
-- 4. Valuation dispatcher trigger (replaces inventory_ledger_apply_mwac)
-- --------------------------------------------------------------------
DROP TRIGGER IF EXISTS inventory_ledger_apply_mwac ON public.inventory_ledger;

CREATE OR REPLACE FUNCTION public.inventory_ledger_apply_valuation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_engine TEXT;
BEGIN
    v_engine := private.resolve_effective_inventory_engine(
        NEW.tenant_id,
        NEW.location_id,
        NEW.item_id
    );

    IF v_engine = 'FIFO' THEN
        PERFORM private.assert_inventory_costing_engine_supported('FIFO');
    END IF;

    IF v_engine = 'STANDARD' THEN
        PERFORM private.inventory_ledger_apply_standard_core(
            NEW.tenant_id,
            NEW.location_id,
            NEW.item_id,
            NEW.variant_id,
            NEW.quantity,
            NEW.cost_at_transaction
        );
        RETURN NEW;
    END IF;

    PERFORM private.inventory_ledger_apply_mwac_core(
        NEW.tenant_id,
        NEW.location_id,
        NEW.item_id,
        NEW.variant_id,
        NEW.quantity,
        NEW.cost_at_transaction
    );

    RETURN NEW;
END;
$$;

CREATE TRIGGER inventory_ledger_apply_valuation
    AFTER INSERT ON public.inventory_ledger
    FOR EACH ROW
    EXECUTE FUNCTION public.inventory_ledger_apply_valuation();

DROP FUNCTION IF EXISTS public.inventory_ledger_apply_mwac();

-- --------------------------------------------------------------------
-- 5. Transaction unit cost lookup (location + item aware)
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.get_item_transaction_unit_cost(
    p_tenant_id UUID,
    p_location_id UUID,
    p_item_id UUID,
    p_variant_id UUID
)
RETURNS NUMERIC(15, 4)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_engine TEXT;
    v_standard_cost NUMERIC(15, 4);
BEGIN
    v_engine := private.resolve_effective_inventory_engine(
        p_tenant_id,
        p_location_id,
        p_item_id
    );

    IF v_engine = 'FIFO' THEN
        PERFORM private.assert_inventory_costing_engine_supported('FIFO');
    END IF;

    IF v_engine = 'STANDARD' THEN
        SELECT COALESCE(i.standard_cost, 0.0000)
        INTO v_standard_cost
        FROM public.items i
        WHERE i.tenant_id = p_tenant_id
          AND i.id = p_item_id;

        RETURN v_standard_cost;
    END IF;

    RETURN private.get_item_average_cost(
        p_tenant_id,
        p_location_id,
        p_item_id,
        p_variant_id
    );
END;
$$;

-- --------------------------------------------------------------------
-- 6. Update outbound / transfer call sites
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

    v_unit_cost := private.get_item_transaction_unit_cost(
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

    v_unit_cost := private.get_item_transaction_unit_cost(
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

CREATE OR REPLACE FUNCTION public.sales_shipment_items_post_gl_cogs()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_order_item public.sales_order_items%ROWTYPE;
    v_package public.sales_shipment_packages%ROWTYPE;
    v_shipment public.sales_shipments%ROWTYPE;
    v_unit_cost NUMERIC(15, 4);
    v_cogs_amount NUMERIC(15, 4);
    v_header_id UUID;
    v_voucher TEXT;
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

    v_unit_cost := private.get_item_transaction_unit_cost(
        NEW.tenant_id,
        v_shipment.origin_location_id,
        v_order_item.item_id,
        v_order_item.variant_id
    );

    v_cogs_amount := NEW.quantity_shipped * v_unit_cost;

    IF v_cogs_amount <= 0 THEN
        RETURN NEW;
    END IF;

    v_voucher := 'GL-COGS-' || left(replace(NEW.id::text, '-', ''), 12);

    v_header_id := private.create_gl_voucher(
        NEW.tenant_id,
        v_voucher,
        NOW(),
        'SALES_SHIPMENT_ITEM',
        NEW.id,
        'COGS recognition for shipment ' || v_shipment.tracking_number
    );

    PERFORM private.post_gl_line(NEW.tenant_id, v_header_id, '5000-COGS', v_cogs_amount, 0.0000);
    PERFORM private.post_gl_line(NEW.tenant_id, v_header_id, '1400-INVENTORY', 0.0000, v_cogs_amount);

    RETURN NEW;
END;
$$;

-- Patch stock transfer dispatch cost lookup only (function body section)
CREATE OR REPLACE FUNCTION public.stock_transfers_status_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_line RECORD;
    v_in_transit_id UUID;
    v_scrap_id UUID;
    v_loss_id UUID;
    v_unit_cost NUMERIC(15, 4);
    v_total_capital NUMERIC(15, 4);
    v_absorbable_incidents NUMERIC(15, 4);
    v_allocation_base NUMERIC(15, 4);
    v_line_base NUMERIC(15, 4);
    v_line_overhead NUMERIC(15, 4);
    v_dest_unit_cost NUMERIC(15, 4);
BEGIN
    IF OLD.current_status IS NOT DISTINCT FROM NEW.current_status THEN
        RETURN NEW;
    END IF;

    IF NEW.current_status = 'DISPATCHED_IN_TRANSIT'
       AND OLD.current_status IS DISTINCT FROM 'DISPATCHED_IN_TRANSIT'
    THEN
        v_in_transit_id := private.ensure_system_location(
            NEW.tenant_id, '_SYSTEM_IN_TRANSIT', 'In-Transit Escrow Buffer'
        );

        UPDATE public.stock_transfers
        SET dispatched_at = COALESCE(stock_transfers.dispatched_at, NOW())
        WHERE id = NEW.id;

        FOR v_line IN
            SELECT * FROM public.stock_transfer_items
            WHERE stock_transfer_id = NEW.id
        LOOP
            v_unit_cost := private.get_item_transaction_unit_cost(
                NEW.tenant_id,
                NEW.source_location_id,
                v_line.item_id,
                v_line.variant_id
            );

            UPDATE public.stock_transfer_items
            SET source_unit_cost_at_dispatch = v_unit_cost,
                updated_at = NOW()
            WHERE id = v_line.id;

            INSERT INTO public.inventory_ledger (
                tenant_id, item_id, variant_id, location_id,
                transaction_type, quantity, cost_at_transaction,
                reference_document, created_by
            )
            VALUES (
                NEW.tenant_id, v_line.item_id, v_line.variant_id, NEW.source_location_id,
                'STOCK_TRANSFER', -v_line.quantity_dispatched, v_unit_cost,
                NEW.transfer_number || '|DISPATCH-OUT', NEW.created_by
            );

            INSERT INTO public.inventory_ledger (
                tenant_id, item_id, variant_id, location_id,
                transaction_type, quantity, cost_at_transaction,
                reference_document, created_by
            )
            VALUES (
                NEW.tenant_id, v_line.item_id, v_line.variant_id, v_in_transit_id,
                'STOCK_TRANSFER', v_line.quantity_dispatched, v_unit_cost,
                NEW.transfer_number || '|IN-TRANSIT-IN', NEW.created_by
            );
        END LOOP;

        RETURN NEW;
    END IF;

    IF NEW.current_status IN ('FULLY_COMPLETED', 'RECEIPT_DISCREPANCY')
       AND OLD.current_status = 'DISPATCHED_IN_TRANSIT'
    THEN
        v_in_transit_id := private.ensure_system_location(
            NEW.tenant_id, '_SYSTEM_IN_TRANSIT', 'In-Transit Escrow Buffer'
        );
        v_scrap_id := private.ensure_system_location(
            NEW.tenant_id, '_SYSTEM_SCRAP_QUARANTINE', 'Scrap Quarantine Node'
        );
        v_loss_id := private.ensure_system_location(
            NEW.tenant_id, '_SYSTEM_LOGISTICAL_LOSS', 'Logistical Loss Node'
        );

        UPDATE public.stock_transfers
        SET received_at = COALESCE(stock_transfers.received_at, NOW())
        WHERE id = NEW.id;

        SELECT COALESCE(SUM(amount), 0.0000)
        INTO v_absorbable_incidents
        FROM public.stock_transfer_incidents
        WHERE stock_transfer_id = NEW.id
          AND is_billable_to_transporter = FALSE;

        v_total_capital := NEW.inter_company_freight_cost
            + NEW.loading_overhead_cost
            + NEW.unloading_overhead_cost
            + v_absorbable_incidents;

        SELECT COALESCE(SUM(quantity_dispatched * source_unit_cost_at_dispatch), 0.0000)
        INTO v_allocation_base
        FROM public.stock_transfer_items
        WHERE stock_transfer_id = NEW.id;

        FOR v_line IN
            SELECT *
            FROM public.stock_transfer_items
            WHERE stock_transfer_id = NEW.id
        LOOP
            IF v_allocation_base > 0 THEN
                v_line_base := v_line.quantity_dispatched * v_line.source_unit_cost_at_dispatch;
                v_line_overhead := v_total_capital * (v_line_base / v_allocation_base);
            ELSE
                v_line_overhead := 0.0000;
            END IF;

            UPDATE public.stock_transfer_items
            SET allocated_transfer_overhead = v_line_overhead,
                updated_at = NOW()
            WHERE id = v_line.id;

            INSERT INTO public.inventory_ledger (
                tenant_id, item_id, variant_id, location_id,
                transaction_type, quantity, cost_at_transaction,
                reference_document, created_by
            )
            VALUES (
                NEW.tenant_id, v_line.item_id, v_line.variant_id, v_in_transit_id,
                'STOCK_TRANSFER', -v_line.quantity_dispatched, v_line.source_unit_cost_at_dispatch,
                NEW.transfer_number || '|IN-TRANSIT-OUT', NEW.created_by
            );

            IF v_line.quantity_accepted > 0 THEN
                v_dest_unit_cost := v_line.source_unit_cost_at_dispatch
                    + (v_line_overhead / v_line.quantity_accepted);

                INSERT INTO public.inventory_ledger (
                    tenant_id, item_id, variant_id, location_id,
                    transaction_type, quantity, cost_at_transaction,
                    reference_document, created_by
                )
                VALUES (
                    NEW.tenant_id, v_line.item_id, v_line.variant_id, NEW.destination_location_id,
                    'STOCK_TRANSFER', v_line.quantity_accepted, v_dest_unit_cost,
                    NEW.transfer_number || '|RECEIVED-AVAILABLE', NEW.created_by
                );
            END IF;

            IF v_line.quantity_damaged > 0 THEN
                INSERT INTO public.inventory_ledger (
                    tenant_id, item_id, variant_id, location_id,
                    transaction_type, quantity, cost_at_transaction,
                    reference_document, created_by
                )
                VALUES (
                    NEW.tenant_id, v_line.item_id, v_line.variant_id, v_scrap_id,
                    'INVENTORY_ADJUSTMENT', v_line.quantity_damaged, v_line.source_unit_cost_at_dispatch,
                    NEW.transfer_number || '|SCRAP-QUARANTINE', NEW.created_by
                );
            END IF;

            IF v_line.quantity_lost > 0 THEN
                INSERT INTO public.inventory_ledger (
                    tenant_id, item_id, variant_id, location_id,
                    transaction_type, quantity, cost_at_transaction,
                    reference_document, created_by
                )
                VALUES (
                    NEW.tenant_id, v_line.item_id, v_line.variant_id, v_loss_id,
                    'INVENTORY_ADJUSTMENT', v_line.quantity_lost, v_line.source_unit_cost_at_dispatch,
                    NEW.transfer_number || '|LOGISTICAL-LOSS', NEW.created_by
                );
            END IF;
        END LOOP;
    END IF;

    RETURN NEW;
END;
$$;

GRANT EXECUTE ON FUNCTION private.get_item_transaction_unit_cost(UUID, UUID, UUID, UUID) TO authenticated;

-- --------------------------------------------------------------------
-- 7. Location save RPC + topology
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.save_tenant_location_core(
    p_location_id UUID,
    p_name TEXT,
    p_code TEXT,
    p_presence_type public.presence_environment DEFAULT 'PHYSICAL'::public.presence_environment,
    p_is_administrative_office BOOLEAN DEFAULT FALSE,
    p_is_commercial_storefront BOOLEAN DEFAULT FALSE,
    p_is_manufacturing_floor BOOLEAN DEFAULT FALSE,
    p_is_stock_holding BOOLEAN DEFAULT FALSE,
    p_pos_terminal_count INT DEFAULT 0,
    p_parent_location_id UUID DEFAULT NULL,
    p_address_line1 TEXT DEFAULT NULL,
    p_address_line2 TEXT DEFAULT NULL,
    p_city TEXT DEFAULT NULL,
    p_state TEXT DEFAULT NULL,
    p_zip_postal TEXT DEFAULT NULL,
    p_country_code TEXT DEFAULT NULL,
    p_manager_name TEXT DEFAULT NULL,
    p_contact_email TEXT DEFAULT NULL,
    p_contact_phone TEXT DEFAULT NULL,
    p_location_tax_identifier TEXT DEFAULT NULL,
    p_tax_registered_name TEXT DEFAULT NULL,
    p_location_meta JSONB DEFAULT NULL,
    p_valuation_calculation_rule TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_tenant_id UUID;
    v_governance JSONB;
    v_multi_location BOOLEAN;
    v_regional_hqs BOOLEAN;
    v_central_hq UUID;
    v_trimmed_name TEXT;
    v_normalized_code TEXT;
    v_location_id UUID;
    v_existing_code TEXT;
    v_active_operational_count INTEGER;
    v_depth INTEGER;
    v_resolved_presence public.presence_environment;
    v_resolved_admin BOOLEAN;
    v_resolved_storefront BOOLEAN;
    v_resolved_manufacturing BOOLEAN;
    v_resolved_stock BOOLEAN;
    v_resolved_pos INT;
    v_existing_meta JSONB;
    v_effective_meta JSONB;
    v_naming_sequences JSONB;
    v_resolved_valuation_rule public.location_valuation_calculation_rule;
    v_existing_valuation_rule public.location_valuation_calculation_rule;
    v_normalized_valuation_rule TEXT;
    v_has_location_inventory_activity BOOLEAN;
BEGIN
    v_tenant_id := private.current_tenant_id();
    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'tenant context missing from session';
    END IF;

    IF NOT private.user_can_manage_tenant_locations() THEN
        RAISE EXCEPTION 'administrative privileges required to manage locations';
    END IF;

    v_governance := private.get_location_governance_config(v_tenant_id);
    v_multi_location := COALESCE((v_governance ->> 'multi_location_enabled')::boolean, TRUE);
    v_regional_hqs := COALESCE((v_governance ->> 'regional_hqs_enabled')::boolean, FALSE);
    v_central_hq := NULLIF(v_governance ->> 'central_hq_location_id', '')::uuid;

    v_trimmed_name := btrim(p_name);
    IF v_trimmed_name IS NULL OR v_trimmed_name = '' THEN
        RAISE EXCEPTION 'location name is required';
    END IF;

    v_normalized_code := upper(btrim(p_code));
    IF v_normalized_code IS NULL OR v_normalized_code = '' THEN
        RAISE EXCEPTION 'location code is required';
    END IF;

    IF private.is_system_tenant_location(v_normalized_code) THEN
        RAISE EXCEPTION 'system location codes are reserved';
    END IF;

    IF p_address_line1 IS NULL OR btrim(p_address_line1) = '' THEN
        RAISE EXCEPTION 'address line 1 is required';
    END IF;

    IF p_city IS NULL OR btrim(p_city) = '' THEN
        RAISE EXCEPTION 'city is required';
    END IF;

    IF p_state IS NULL OR btrim(p_state) = '' THEN
        RAISE EXCEPTION 'state is required';
    END IF;

    IF p_zip_postal IS NULL OR btrim(p_zip_postal) = '' THEN
        RAISE EXCEPTION 'postal code is required';
    END IF;

    IF p_country_code IS NULL OR btrim(p_country_code) = '' THEN
        RAISE EXCEPTION 'country code is required';
    END IF;

    v_resolved_presence := COALESCE(p_presence_type, 'PHYSICAL'::public.presence_environment);
    v_resolved_admin := COALESCE(p_is_administrative_office, FALSE);
    v_resolved_storefront := COALESCE(p_is_commercial_storefront, FALSE);
    v_resolved_manufacturing := COALESCE(p_is_manufacturing_floor, FALSE);
    v_resolved_stock := COALESCE(p_is_stock_holding, FALSE);
    v_resolved_pos := COALESCE(p_pos_terminal_count, 0);

    IF v_resolved_pos < 0 THEN
        RAISE EXCEPTION 'pos terminal count cannot be negative';
    END IF;

    IF v_resolved_presence = 'VIRTUAL'::public.presence_environment AND v_resolved_stock THEN
        RAISE EXCEPTION 'virtual locations cannot be stock-holding locations';
    END IF;

    IF v_resolved_presence = 'VIRTUAL'::public.presence_environment AND v_resolved_manufacturing THEN
        RAISE EXCEPTION 'virtual locations cannot be manufacturing floors';
    END IF;

    IF NOT v_resolved_storefront AND v_resolved_pos <> 0 THEN
        RAISE EXCEPTION 'pos terminal count must be zero when location is not a commercial storefront';
    END IF;

    IF private.location_is_valuation_eligible(v_resolved_stock, v_resolved_storefront) THEN
        IF p_valuation_calculation_rule IS NOT NULL AND btrim(p_valuation_calculation_rule) <> '' THEN
            v_normalized_valuation_rule := upper(btrim(p_valuation_calculation_rule));
            IF v_normalized_valuation_rule NOT IN ('FIFO', 'MWAC') THEN
                RAISE EXCEPTION 'valuation calculation rule must be FIFO or MWAC';
            END IF;
            v_resolved_valuation_rule := v_normalized_valuation_rule::public.location_valuation_calculation_rule;
        ELSE
            v_resolved_valuation_rule := NULL;
        END IF;
    ELSE
        v_resolved_valuation_rule := NULL;
    END IF;

    IF p_location_id IS NOT NULL THEN
        SELECT code, location_meta, valuation_calculation_rule
        INTO v_existing_code, v_existing_meta, v_existing_valuation_rule
        FROM public.tenant_locations
        WHERE id = p_location_id
          AND tenant_id = v_tenant_id;

        IF v_existing_code IS NULL THEN
            RAISE EXCEPTION 'location not found for tenant';
        END IF;

        IF private.is_system_tenant_location(v_existing_code) THEN
            RAISE EXCEPTION 'system locations cannot be modified';
        END IF;

        IF v_existing_valuation_rule IS DISTINCT FROM v_resolved_valuation_rule THEN
            SELECT EXISTS (
                SELECT 1
                FROM public.inventory_ledger il
                WHERE il.tenant_id = v_tenant_id
                  AND il.location_id = p_location_id
                LIMIT 1
            )
            OR EXISTS (
                SELECT 1
                FROM public.item_valuations iv
                WHERE iv.tenant_id = v_tenant_id
                  AND iv.location_id = p_location_id
                LIMIT 1
            )
            INTO v_has_location_inventory_activity;

            IF v_has_location_inventory_activity THEN
                RAISE EXCEPTION 'valuation calculation rule cannot be changed after inventory activity exists at this location';
            END IF;
        END IF;
    ELSE
        v_existing_meta := NULL;
        v_existing_valuation_rule := NULL;

        IF NOT v_multi_location THEN
            SELECT COUNT(*)
            INTO v_active_operational_count
            FROM public.tenant_locations
            WHERE tenant_id = v_tenant_id
              AND is_active = TRUE
              AND NOT private.is_system_tenant_location(code);

            IF v_active_operational_count > 0 THEN
                RAISE EXCEPTION 'multi-location is disabled; only one operational location is permitted';
            END IF;
        END IF;
    END IF;

    IF NOT v_regional_hqs THEN
        IF p_parent_location_id IS NOT NULL THEN
            RAISE EXCEPTION 'regional hierarchy is disabled; parent location must be empty';
        END IF;
    ELSE
        IF p_parent_location_id IS NOT NULL THEN
            IF NOT EXISTS (
                SELECT 1
                FROM public.tenant_locations
                WHERE id = p_parent_location_id
                  AND tenant_id = v_tenant_id
                  AND is_active = TRUE
                  AND NOT private.is_system_tenant_location(code)
            ) THEN
                RAISE EXCEPTION 'parent location not found for tenant';
            END IF;

            WITH RECURSIVE ancestors AS (
                SELECT id, parent_location_id, 1 AS depth
                FROM public.tenant_locations
                WHERE id = p_parent_location_id
                  AND tenant_id = v_tenant_id
                UNION ALL
                SELECT tl.id, tl.parent_location_id, ancestors.depth + 1
                FROM public.tenant_locations tl
                INNER JOIN ancestors ON tl.id = ancestors.parent_location_id
                WHERE tl.tenant_id = v_tenant_id
                  AND ancestors.depth < 6
            )
            SELECT MAX(depth)
            INTO v_depth
            FROM ancestors;

            IF COALESCE(v_depth, 0) >= 5 THEN
                RAISE EXCEPTION 'location hierarchy cannot exceed five tiers';
            END IF;
        END IF;
    END IF;

    v_effective_meta := COALESCE(p_location_meta, COALESCE(v_existing_meta, '{}'::jsonb));

    PERFORM private.validate_virtual_location_configuration(
        v_resolved_presence,
        v_effective_meta
    );

    PERFORM private.validate_location_document_naming(
        v_effective_meta,
        v_resolved_stock,
        v_resolved_storefront,
        v_resolved_admin
    );

    IF p_location_id IS NULL THEN
        INSERT INTO public.tenant_locations (
            tenant_id,
            parent_location_id,
            name,
            code,
            presence_type,
            is_administrative_office,
            is_commercial_storefront,
            is_manufacturing_floor,
            is_stock_holding,
            pos_terminal_count,
            address_line1,
            address_line2,
            city,
            state,
            zip_postal,
            country_code,
            manager_name,
            contact_email,
            contact_phone,
            location_tax_identifier,
            tax_registered_name,
            location_meta,
            valuation_calculation_rule,
            is_active
        )
        VALUES (
            v_tenant_id,
            CASE WHEN v_regional_hqs THEN p_parent_location_id ELSE NULL END,
            v_trimmed_name,
            v_normalized_code,
            v_resolved_presence,
            v_resolved_admin,
            v_resolved_storefront,
            v_resolved_manufacturing,
            v_resolved_stock,
            v_resolved_pos,
            btrim(p_address_line1),
            NULLIF(btrim(p_address_line2), ''),
            btrim(p_city),
            btrim(p_state),
            btrim(p_zip_postal),
            upper(btrim(p_country_code)),
            NULLIF(btrim(p_manager_name), ''),
            NULLIF(btrim(p_contact_email), ''),
            NULLIF(btrim(p_contact_phone), ''),
            NULLIF(btrim(p_location_tax_identifier), ''),
            NULLIF(btrim(p_tax_registered_name), ''),
            v_effective_meta,
            v_resolved_valuation_rule,
            TRUE
        )
        RETURNING id INTO v_location_id;
    ELSE
        UPDATE public.tenant_locations
        SET
            parent_location_id = CASE WHEN v_regional_hqs THEN p_parent_location_id ELSE NULL END,
            name = v_trimmed_name,
            code = v_normalized_code,
            presence_type = v_resolved_presence,
            is_administrative_office = v_resolved_admin,
            is_commercial_storefront = v_resolved_storefront,
            is_manufacturing_floor = v_resolved_manufacturing,
            is_stock_holding = v_resolved_stock,
            pos_terminal_count = v_resolved_pos,
            address_line1 = btrim(p_address_line1),
            address_line2 = NULLIF(btrim(p_address_line2), ''),
            city = btrim(p_city),
            state = btrim(p_state),
            zip_postal = btrim(p_zip_postal),
            country_code = upper(btrim(p_country_code)),
            manager_name = NULLIF(btrim(p_manager_name), ''),
            contact_email = NULLIF(btrim(p_contact_email), ''),
            contact_phone = NULLIF(btrim(p_contact_phone), ''),
            location_tax_identifier = NULLIF(btrim(p_location_tax_identifier), ''),
            tax_registered_name = NULLIF(btrim(p_tax_registered_name), ''),
            location_meta = v_effective_meta,
            valuation_calculation_rule = v_resolved_valuation_rule,
            updated_at = NOW()
        WHERE id = p_location_id
          AND tenant_id = v_tenant_id
        RETURNING id INTO v_location_id;
    END IF;

    v_naming_sequences := v_effective_meta -> 'configuration_metadata' -> 'naming_sequences';
    PERFORM private.sync_document_sequences_from_naming(
        v_tenant_id,
        COALESCE(v_naming_sequences, '{}'::jsonb),
        v_location_id
    );

    IF v_central_hq = v_location_id AND NOT v_resolved_admin THEN
        RAISE EXCEPTION 'central HQ location must remain an administrative office';
    END IF;

    RETURN v_location_id;
END;
$$;

DROP FUNCTION IF EXISTS public.save_tenant_location(
    TEXT,
    TEXT,
    public.presence_environment,
    UUID,
    UUID,
    TEXT,
    TEXT,
    TEXT,
    TEXT,
    TEXT,
    TEXT,
    TEXT,
    TEXT,
    TEXT,
    BOOLEAN,
    BOOLEAN,
    BOOLEAN,
    BOOLEAN,
    INT,
    TEXT,
    TEXT,
    JSONB
);

CREATE OR REPLACE FUNCTION public.save_tenant_location(
    p_name TEXT,
    p_code TEXT,
    p_presence_type public.presence_environment DEFAULT 'PHYSICAL',
    p_location_id UUID DEFAULT NULL,
    p_parent_location_id UUID DEFAULT NULL,
    p_address_line1 TEXT DEFAULT NULL,
    p_address_line2 TEXT DEFAULT NULL,
    p_city TEXT DEFAULT NULL,
    p_state TEXT DEFAULT NULL,
    p_zip_postal TEXT DEFAULT NULL,
    p_country_code TEXT DEFAULT NULL,
    p_manager_name TEXT DEFAULT NULL,
    p_contact_email TEXT DEFAULT NULL,
    p_contact_phone TEXT DEFAULT NULL,
    p_is_administrative_office BOOLEAN DEFAULT FALSE,
    p_is_commercial_storefront BOOLEAN DEFAULT FALSE,
    p_is_manufacturing_floor BOOLEAN DEFAULT FALSE,
    p_is_stock_holding BOOLEAN DEFAULT FALSE,
    p_pos_terminal_count INT DEFAULT 0,
    p_location_tax_identifier TEXT DEFAULT NULL,
    p_tax_registered_name TEXT DEFAULT NULL,
    p_location_meta JSONB DEFAULT NULL,
    p_valuation_calculation_rule TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
BEGIN
    RETURN private.save_tenant_location_core(
        p_location_id := p_location_id,
        p_name := p_name,
        p_code := p_code,
        p_presence_type := p_presence_type,
        p_is_administrative_office := p_is_administrative_office,
        p_is_commercial_storefront := p_is_commercial_storefront,
        p_is_manufacturing_floor := p_is_manufacturing_floor,
        p_is_stock_holding := p_is_stock_holding,
        p_pos_terminal_count := p_pos_terminal_count,
        p_parent_location_id := p_parent_location_id,
        p_address_line1 := p_address_line1,
        p_address_line2 := p_address_line2,
        p_city := p_city,
        p_state := p_state,
        p_zip_postal := p_zip_postal,
        p_country_code := p_country_code,
        p_manager_name := p_manager_name,
        p_contact_email := p_contact_email,
        p_contact_phone := p_contact_phone,
        p_location_tax_identifier := p_location_tax_identifier,
        p_tax_registered_name := p_tax_registered_name,
        p_location_meta := p_location_meta,
        p_valuation_calculation_rule := p_valuation_calculation_rule
    );
END;
$$;

REVOKE ALL ON FUNCTION public.save_tenant_location(
    TEXT,
    TEXT,
    public.presence_environment,
    UUID,
    UUID,
    TEXT,
    TEXT,
    TEXT,
    TEXT,
    TEXT,
    TEXT,
    TEXT,
    TEXT,
    TEXT,
    BOOLEAN,
    BOOLEAN,
    BOOLEAN,
    BOOLEAN,
    INT,
    TEXT,
    TEXT,
    JSONB,
    TEXT
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.save_tenant_location(
    TEXT,
    TEXT,
    public.presence_environment,
    UUID,
    UUID,
    TEXT,
    TEXT,
    TEXT,
    TEXT,
    TEXT,
    TEXT,
    TEXT,
    TEXT,
    TEXT,
    BOOLEAN,
    BOOLEAN,
    BOOLEAN,
    BOOLEAN,
    INT,
    TEXT,
    TEXT,
    JSONB,
    TEXT
) TO authenticated;

DROP FUNCTION IF EXISTS public.get_tenant_location_topology();

CREATE OR REPLACE FUNCTION public.get_tenant_location_topology()
RETURNS TABLE (
    id UUID,
    parent_location_id UUID,
    name TEXT,
    code TEXT,
    presence_type public.presence_environment,
    is_administrative_office BOOLEAN,
    is_commercial_storefront BOOLEAN,
    is_manufacturing_floor BOOLEAN,
    is_stock_holding BOOLEAN,
    pos_terminal_count INT,
    valuation_calculation_rule public.location_valuation_calculation_rule,
    is_active BOOLEAN,
    address_line1 TEXT,
    address_line2 TEXT,
    city TEXT,
    state TEXT,
    zip_postal VARCHAR(20),
    country_code VARCHAR(2),
    manager_name TEXT,
    contact_email TEXT,
    contact_phone VARCHAR(30),
    depth INTEGER,
    path UUID[],
    child_count BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
    WITH RECURSIVE tree AS (
        SELECT
            tl.id,
            tl.parent_location_id,
            tl.name,
            tl.code,
            tl.presence_type,
            tl.is_administrative_office,
            tl.is_commercial_storefront,
            tl.is_manufacturing_floor,
            tl.is_stock_holding,
            tl.pos_terminal_count,
            tl.valuation_calculation_rule,
            tl.is_active,
            tl.address_line1,
            tl.address_line2,
            tl.city,
            tl.state,
            tl.zip_postal,
            tl.country_code,
            tl.manager_name,
            tl.contact_email,
            tl.contact_phone,
            0 AS depth,
            ARRAY[tl.id] AS path
        FROM public.tenant_locations tl
        WHERE tl.tenant_id = private.current_tenant_id()
          AND NOT private.is_system_tenant_location(tl.code)
          AND tl.parent_location_id IS NULL
        UNION ALL
        SELECT
            child.id,
            child.parent_location_id,
            child.name,
            child.code,
            child.presence_type,
            child.is_administrative_office,
            child.is_commercial_storefront,
            child.is_manufacturing_floor,
            child.is_stock_holding,
            child.pos_terminal_count,
            child.valuation_calculation_rule,
            child.is_active,
            child.address_line1,
            child.address_line2,
            child.city,
            child.state,
            child.zip_postal,
            child.country_code,
            child.manager_name,
            child.contact_email,
            child.contact_phone,
            tree.depth + 1,
            tree.path || child.id
        FROM public.tenant_locations child
        INNER JOIN tree ON child.parent_location_id = tree.id
        WHERE child.tenant_id = private.current_tenant_id()
          AND NOT private.is_system_tenant_location(child.code)
          AND tree.depth < 5
    ),
    counted AS (
        SELECT
            tree.*,
            (
                SELECT COUNT(*)
                FROM public.tenant_locations c
                WHERE c.tenant_id = private.current_tenant_id()
                  AND c.parent_location_id = tree.id
                  AND NOT private.is_system_tenant_location(c.code)
            ) AS child_count
        FROM tree
    )
    SELECT
        counted.id,
        counted.parent_location_id,
        counted.name,
        counted.code,
        counted.presence_type,
        counted.is_administrative_office,
        counted.is_commercial_storefront,
        counted.is_manufacturing_floor,
        counted.is_stock_holding,
        counted.pos_terminal_count,
        counted.valuation_calculation_rule,
        counted.is_active,
        counted.address_line1,
        counted.address_line2,
        counted.city,
        counted.state,
        counted.zip_postal,
        counted.country_code,
        counted.manager_name,
        counted.contact_email,
        counted.contact_phone,
        counted.depth,
        counted.path,
        counted.child_count
    FROM counted
    ORDER BY counted.path;
$$;

REVOKE ALL ON FUNCTION public.get_tenant_location_topology() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_tenant_location_topology() TO authenticated;

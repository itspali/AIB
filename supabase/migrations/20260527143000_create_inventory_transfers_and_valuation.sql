-- ====================================================================
-- AIB SMART ERP - MILESTONE 5: INVENTORY TRANSFERS & COSTING MATRIX
-- Migration: 20260527143000_create_inventory_transfers_and_valuation.sql
-- ====================================================================
--
-- --------------------------------------------------------------------
-- ARCHITECTURAL DOCUMENTATION (downstream developer alignment)
-- --------------------------------------------------------------------
--
-- THREE-WAY RECEIVING SPLIT (accepted / damaged / lost):
--   quantity_accepted   -> destination warehouse available stock
--   quantity_damaged    -> _SYSTEM_SCRAP_QUARANTINE virtual node
--   quantity_lost       -> _SYSTEM_LOGISTICAL_LOSS write-off node
--
-- TWO-STAGE TRANSIT ESCROW:
--   DISPATCHED_IN_TRANSIT: source (-qty) -> _SYSTEM_IN_TRANSIT (+qty)
--   FULLY_COMPLETED / RECEIPT_DISCREPANCY: IN_TRANSIT (-dispatched qty)
--     -> split across destination (+accepted), scrap (+damaged), loss (-lost)
--
-- MULTI-OVERHEAD LANDED COST ALLOCATION:
--   total_capital = freight + loading + unloading
--     + SUM(incidents.amount WHERE is_billable_to_transporter = FALSE)
--   Per-line allocated_transfer_overhead = total_capital
--     * (line.qty_dispatched * line.source_unit_cost_at_dispatch)
--     / SUM(all lines qty_dispatched * source_unit_cost_at_dispatch)
--   Destination unit cost = source_unit_cost_at_dispatch
--     + (allocated_transfer_overhead / quantity_accepted) when accepted > 0
--
-- UNPLANNED ROUTE INCIDENTALS (stock_transfer_incidents):
--   is_billable_to_transporter TRUE  -> excluded from item cost absorption
--   is_billable_to_transporter FALSE -> absorbed into allocation pool
--
-- MWAC (Moving Weighted Average Cost):
--   On inbound inventory_ledger (quantity > 0) at operational locations:
--   new_avg = ((on_hand * avg_cost) + (inbound_qty * inbound_cost))
--             / (on_hand + inbound_qty)
--   Stored in item_valuations per (location_id, item_id, variant_id).
--
-- NEGATIVE INVENTORY DEFLECTION:
--   BEFORE INSERT on inventory_ledger when quantity < 0:
--   Read workspace_control_registry INVENTORY_SETTINGS.allow_negative_inventory
--   (default FALSE). Block if on_hand + quantity < 0.
--
-- SYSTEM VIRTUAL LOCATIONS (auto-provisioned per tenant on first use):
--   _SYSTEM_IN_TRANSIT, _SYSTEM_SCRAP_QUARANTINE, _SYSTEM_LOGISTICAL_LOSS
--
-- ====================================================================

-- --------------------------------------------------------------------
-- 1. ENUM EXTENSIONS
-- --------------------------------------------------------------------
ALTER TYPE public.document_voucher_type ADD VALUE IF NOT EXISTS 'STOCK_TRANSFER';

CREATE TYPE stock_transfer_status AS ENUM (
    'DRAFT',
    'PENDING_APPROVAL',
    'DISPATCHED_IN_TRANSIT',
    'RECEIPT_DISCREPANCY',
    'FULLY_COMPLETED',
    'CANCELLED'
);

CREATE TYPE transfer_incident_type AS ENUM (
    'TOLL_TAX',
    'BORDER_CHARGES',
    'EMERGENCY_MAINTENANCE',
    'DRIVER_ALLOWANCE',
    'OTHER_INCIDENTAL'
);

-- --------------------------------------------------------------------
-- 2. SYSTEM VIRTUAL LOCATION RESOLVER
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.ensure_system_location(
    p_tenant_id UUID,
    p_code TEXT,
    p_name TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_location_id UUID;
BEGIN
    SELECT id
    INTO v_location_id
    FROM public.tenant_locations
    WHERE tenant_id = p_tenant_id
      AND code = p_code
    LIMIT 1;

    IF v_location_id IS NOT NULL THEN
        RETURN v_location_id;
    END IF;

    INSERT INTO public.tenant_locations (
        tenant_id,
        name,
        code,
        location_type,
        address_line1,
        city,
        state,
        zip_postal,
        country_code,
        is_stock_holding,
        is_active
    )
    VALUES (
        p_tenant_id,
        p_name,
        p_code,
        'WAREHOUSE',
        'System Virtual Node',
        'System',
        'NA',
        '00000',
        'US',
        FALSE,
        TRUE
    )
    ON CONFLICT ON CONSTRAINT unique_tenant_location_code DO NOTHING;

    SELECT id
    INTO v_location_id
    FROM public.tenant_locations
    WHERE tenant_id = p_tenant_id
      AND code = p_code
    LIMIT 1;

    RETURN v_location_id;
END;
$$;

-- --------------------------------------------------------------------
-- 3. stock_transfers & stock_transfer_items
-- --------------------------------------------------------------------
CREATE TABLE public.stock_transfers (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id                   UUID NOT NULL REFERENCES public.tenants (id) ON DELETE RESTRICT,
    transfer_number             TEXT NOT NULL,
    source_location_id          UUID NOT NULL REFERENCES public.tenant_locations (id) ON DELETE RESTRICT,
    destination_location_id     UUID NOT NULL REFERENCES public.tenant_locations (id) ON DELETE RESTRICT,
    current_status              stock_transfer_status NOT NULL DEFAULT 'DRAFT',
    inter_company_freight_cost  NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
    loading_overhead_cost       NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
    unloading_overhead_cost     NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
    dispatched_at               TIMESTAMPTZ,
    received_at                 TIMESTAMPTZ,
    created_by                  UUID NOT NULL REFERENCES public.users (id) ON DELETE RESTRICT,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT stock_transfers_tenant_transfer_number_unique
        UNIQUE (tenant_id, transfer_number),
    CONSTRAINT stock_transfers_distinct_locations_chk
        CHECK (source_location_id <> destination_location_id),
    CONSTRAINT stock_transfers_overhead_non_negative_chk
        CHECK (
            inter_company_freight_cost >= 0
            AND loading_overhead_cost >= 0
            AND unloading_overhead_cost >= 0
        )
);

CREATE UNIQUE INDEX stock_transfers_tenant_id_id_unique
    ON public.stock_transfers (tenant_id, id);

ALTER TABLE public.stock_transfers
    ADD CONSTRAINT stock_transfers_source_tenant_fk
    FOREIGN KEY (tenant_id, source_location_id)
    REFERENCES public.tenant_locations (tenant_id, id)
    ON DELETE RESTRICT;

ALTER TABLE public.stock_transfers
    ADD CONSTRAINT stock_transfers_destination_tenant_fk
    FOREIGN KEY (tenant_id, destination_location_id)
    REFERENCES public.tenant_locations (tenant_id, id)
    ON DELETE RESTRICT;

CREATE TABLE public.stock_transfer_items (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id                   UUID NOT NULL REFERENCES public.tenants (id) ON DELETE RESTRICT,
    stock_transfer_id           UUID NOT NULL REFERENCES public.stock_transfers (id) ON DELETE CASCADE,
    item_id                     UUID NOT NULL REFERENCES public.items (id) ON DELETE RESTRICT,
    variant_id                  UUID REFERENCES public.item_variants (id) ON DELETE RESTRICT,
    quantity_dispatched         NUMERIC(15, 4) NOT NULL,
    quantity_accepted           NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
    quantity_damaged            NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
    quantity_lost               NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
    source_unit_cost_at_dispatch NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
    allocated_transfer_overhead NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT stock_transfer_items_quantity_dispatched_positive_chk
        CHECK (quantity_dispatched > 0),
    CONSTRAINT stock_transfer_items_quantities_non_negative_chk
        CHECK (
            quantity_accepted >= 0
            AND quantity_damaged >= 0
            AND quantity_lost >= 0
        ),
    CONSTRAINT stock_transfer_items_receipt_split_chk
        CHECK (quantity_accepted + quantity_damaged + quantity_lost <= quantity_dispatched)
);

ALTER TABLE public.stock_transfer_items
    ADD CONSTRAINT stock_transfer_items_transfer_tenant_fk
    FOREIGN KEY (tenant_id, stock_transfer_id)
    REFERENCES public.stock_transfers (tenant_id, id)
    ON DELETE CASCADE;

ALTER TABLE public.stock_transfer_items
    ADD CONSTRAINT stock_transfer_items_item_tenant_fk
    FOREIGN KEY (tenant_id, item_id)
    REFERENCES public.items (tenant_id, id)
    ON DELETE RESTRICT;

ALTER TABLE public.stock_transfer_items
    ADD CONSTRAINT stock_transfer_items_variant_tenant_fk
    FOREIGN KEY (tenant_id, variant_id)
    REFERENCES public.item_variants (tenant_id, id)
    ON DELETE RESTRICT;

-- --------------------------------------------------------------------
-- 4. stock_transfer_incidents
-- --------------------------------------------------------------------
CREATE TABLE public.stock_transfer_incidents (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id                   UUID NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
    stock_transfer_id           UUID NOT NULL REFERENCES public.stock_transfers (id) ON DELETE CASCADE,
    expense_type                transfer_incident_type NOT NULL,
    amount                      NUMERIC(15, 4) NOT NULL,
    currency_code               VARCHAR(3) NOT NULL DEFAULT 'USD',
    is_billable_to_transporter  BOOLEAN NOT NULL DEFAULT FALSE,
    receipt_document_url        TEXT,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT stock_transfer_incidents_amount_non_negative_chk
        CHECK (amount >= 0)
);

ALTER TABLE public.stock_transfer_incidents
    ADD CONSTRAINT stock_transfer_incidents_transfer_tenant_fk
    FOREIGN KEY (tenant_id, stock_transfer_id)
    REFERENCES public.stock_transfers (tenant_id, id)
    ON DELETE CASCADE;

-- --------------------------------------------------------------------
-- 5. transfer_discrepancy_claims
-- --------------------------------------------------------------------
CREATE TABLE public.transfer_discrepancy_claims (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
    stock_transfer_id   UUID NOT NULL REFERENCES public.stock_transfers (id) ON DELETE CASCADE,
    reported_by         UUID NOT NULL REFERENCES public.users (id) ON DELETE RESTRICT,
    resolution_notes    TEXT,
    is_settled          BOOLEAN NOT NULL DEFAULT FALSE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.transfer_discrepancy_claims
    ADD CONSTRAINT transfer_discrepancy_claims_transfer_tenant_fk
    FOREIGN KEY (tenant_id, stock_transfer_id)
    REFERENCES public.stock_transfers (tenant_id, id)
    ON DELETE CASCADE;

-- --------------------------------------------------------------------
-- 6. item_valuations (MWAC profile)
-- --------------------------------------------------------------------
CREATE TABLE public.item_valuations (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
    location_id             UUID NOT NULL REFERENCES public.tenant_locations (id) ON DELETE RESTRICT,
    item_id                 UUID NOT NULL REFERENCES public.items (id) ON DELETE RESTRICT,
    variant_id              UUID REFERENCES public.item_variants (id) ON DELETE RESTRICT,
    current_average_cost    NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
    total_quantity_on_hand  NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT item_valuations_cost_non_negative_chk
        CHECK (current_average_cost >= 0),
    CONSTRAINT item_valuations_qty_non_negative_chk
        CHECK (total_quantity_on_hand >= 0)
);

CREATE UNIQUE INDEX item_valuations_location_item_variant_unique
    ON public.item_valuations (
        location_id,
        item_id,
        COALESCE(variant_id, '00000000-0000-0000-0000-000000000000'::uuid)
    );

ALTER TABLE public.item_valuations
    ADD CONSTRAINT item_valuations_location_tenant_fk
    FOREIGN KEY (tenant_id, location_id)
    REFERENCES public.tenant_locations (tenant_id, id)
    ON DELETE RESTRICT;

ALTER TABLE public.item_valuations
    ADD CONSTRAINT item_valuations_item_tenant_fk
    FOREIGN KEY (tenant_id, item_id)
    REFERENCES public.items (tenant_id, id)
    ON DELETE RESTRICT;

ALTER TABLE public.item_valuations
    ADD CONSTRAINT item_valuations_variant_tenant_fk
    FOREIGN KEY (tenant_id, variant_id)
    REFERENCES public.item_variants (tenant_id, id)
    ON DELETE RESTRICT;

-- --------------------------------------------------------------------
-- 7. inventory_buffer_thresholds
-- --------------------------------------------------------------------
CREATE TABLE public.inventory_buffer_thresholds (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
    location_id         UUID NOT NULL REFERENCES public.tenant_locations (id) ON DELETE CASCADE,
    item_id             UUID NOT NULL REFERENCES public.items (id) ON DELETE CASCADE,
    variant_id          UUID REFERENCES public.item_variants (id) ON DELETE CASCADE,
    min_stock_level     NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
    max_stock_level     NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
    reorder_point_qty   NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT inventory_buffer_thresholds_levels_non_negative_chk
        CHECK (
            min_stock_level >= 0
            AND max_stock_level >= 0
            AND reorder_point_qty >= 0
        )
);

CREATE UNIQUE INDEX inventory_buffer_thresholds_location_item_variant_unique
    ON public.inventory_buffer_thresholds (
        location_id,
        item_id,
        COALESCE(variant_id, '00000000-0000-0000-0000-000000000000'::uuid)
    );

ALTER TABLE public.inventory_buffer_thresholds
    ADD CONSTRAINT inventory_buffer_thresholds_location_tenant_fk
    FOREIGN KEY (tenant_id, location_id)
    REFERENCES public.tenant_locations (tenant_id, id)
    ON DELETE CASCADE;

ALTER TABLE public.inventory_buffer_thresholds
    ADD CONSTRAINT inventory_buffer_thresholds_item_tenant_fk
    FOREIGN KEY (tenant_id, item_id)
    REFERENCES public.items (tenant_id, id)
    ON DELETE CASCADE;

ALTER TABLE public.inventory_buffer_thresholds
    ADD CONSTRAINT inventory_buffer_thresholds_variant_tenant_fk
    FOREIGN KEY (tenant_id, variant_id)
    REFERENCES public.item_variants (tenant_id, id)
    ON DELETE CASCADE;

-- --------------------------------------------------------------------
-- 8. INVENTORY CONTROL HELPERS
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.get_inventory_control_flag(
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
      AND registry_key = 'INVENTORY_SETTINGS'
      AND target_reference_id IS NULL
    ORDER BY updated_at DESC
    LIMIT 1;

    RETURN COALESCE(v_value, FALSE);
END;
$$;

CREATE OR REPLACE FUNCTION private.get_item_valuation_on_hand(
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
            SELECT iv.total_quantity_on_hand
            FROM public.item_valuations iv
            WHERE iv.tenant_id = p_tenant_id
              AND iv.location_id = p_location_id
              AND iv.item_id = p_item_id
              AND iv.variant_id IS NOT DISTINCT FROM p_variant_id
        ),
        0.0000
    );
$$;

CREATE OR REPLACE FUNCTION private.get_item_average_cost(
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
            SELECT iv.current_average_cost
            FROM public.item_valuations iv
            WHERE iv.tenant_id = p_tenant_id
              AND iv.location_id = p_location_id
              AND iv.item_id = p_item_id
              AND iv.variant_id IS NOT DISTINCT FROM p_variant_id
        ),
        0.0000
    );
$$;

-- --------------------------------------------------------------------
-- 9. NEGATIVE INVENTORY GUARD (BEFORE INSERT on inventory_ledger)
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.inventory_ledger_negative_balance_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_on_hand NUMERIC(15, 4);
BEGIN
    IF NEW.quantity >= 0 THEN
        RETURN NEW;
    END IF;

    IF private.get_inventory_control_flag(NEW.tenant_id, 'allow_negative_inventory') THEN
        RETURN NEW;
    END IF;

    v_on_hand := private.get_item_valuation_on_hand(
        NEW.tenant_id,
        NEW.location_id,
        NEW.item_id,
        NEW.variant_id
    );

    IF v_on_hand + NEW.quantity < 0 THEN
        RAISE EXCEPTION
            'negative inventory blocked: on_hand=% attempt=% for item % at location %',
            v_on_hand, NEW.quantity, NEW.item_id, NEW.location_id;
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER inventory_ledger_enforce_negative_balance
    BEFORE INSERT ON public.inventory_ledger
    FOR EACH ROW
    EXECUTE FUNCTION public.inventory_ledger_negative_balance_guard();

-- --------------------------------------------------------------------
-- 10. MWAC UPDATE (AFTER INSERT on inventory_ledger)
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.inventory_ledger_apply_mwac()
RETURNS TRIGGER
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
    IF NEW.quantity <= 0 THEN
        UPDATE public.item_valuations
        SET total_quantity_on_hand = GREATEST(total_quantity_on_hand + NEW.quantity, 0.0000),
            updated_at = NOW()
        WHERE tenant_id = NEW.tenant_id
          AND location_id = NEW.location_id
          AND item_id = NEW.item_id
          AND variant_id IS NOT DISTINCT FROM NEW.variant_id;

        IF NOT FOUND AND NEW.quantity < 0 THEN
            INSERT INTO public.item_valuations (
                tenant_id, location_id, item_id, variant_id,
                current_average_cost, total_quantity_on_hand
            )
            VALUES (
                NEW.tenant_id, NEW.location_id, NEW.item_id, NEW.variant_id,
                0.0000, 0.0000
            );
        END IF;

        RETURN NEW;
    END IF;

    SELECT current_average_cost, total_quantity_on_hand
    INTO v_existing_cost, v_existing_qty
    FROM public.item_valuations
    WHERE tenant_id = NEW.tenant_id
      AND location_id = NEW.location_id
      AND item_id = NEW.item_id
      AND variant_id IS NOT DISTINCT FROM NEW.variant_id
    FOR UPDATE;

    IF NOT FOUND THEN
        INSERT INTO public.item_valuations (
            tenant_id, location_id, item_id, variant_id,
            current_average_cost, total_quantity_on_hand
        )
        VALUES (
            NEW.tenant_id, NEW.location_id, NEW.item_id, NEW.variant_id,
            NEW.cost_at_transaction, NEW.quantity
        );
        RETURN NEW;
    END IF;

    IF v_existing_qty + NEW.quantity = 0 THEN
        v_new_avg := 0.0000;
        v_new_qty := 0.0000;
    ELSE
        v_new_qty := v_existing_qty + NEW.quantity;
        v_new_avg := (
            (v_existing_qty * v_existing_cost) + (NEW.quantity * NEW.cost_at_transaction)
        ) / v_new_qty;
    END IF;

    UPDATE public.item_valuations
    SET current_average_cost = v_new_avg,
        total_quantity_on_hand = v_new_qty,
        updated_at = NOW()
    WHERE tenant_id = NEW.tenant_id
      AND location_id = NEW.location_id
      AND item_id = NEW.item_id
      AND variant_id IS NOT DISTINCT FROM NEW.variant_id;

    RETURN NEW;
END;
$$;

CREATE TRIGGER inventory_ledger_apply_mwac
    AFTER INSERT ON public.inventory_ledger
    FOR EACH ROW
    EXECUTE FUNCTION public.inventory_ledger_apply_mwac();

-- --------------------------------------------------------------------
-- 11. STOCK TRANSFER STATE MACHINE (AFTER UPDATE on stock_transfers)
-- --------------------------------------------------------------------
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

    -- DISPATCH: source (-) -> in-transit (+)
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
            SELECT *
            FROM public.stock_transfer_items
            WHERE stock_transfer_id = NEW.id
        LOOP
            v_unit_cost := private.get_item_average_cost(
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

    -- RECEIPT: in-transit (-) -> destination / scrap / loss
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

CREATE TRIGGER stock_transfers_status_transition
    AFTER UPDATE OF current_status ON public.stock_transfers
    FOR EACH ROW
    EXECUTE FUNCTION public.stock_transfers_status_transition();

-- --------------------------------------------------------------------
-- 12. updated_at TRIGGERS
-- --------------------------------------------------------------------
CREATE TRIGGER stock_transfers_set_updated_at
    BEFORE UPDATE ON public.stock_transfers
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER stock_transfer_items_set_updated_at
    BEFORE UPDATE ON public.stock_transfer_items
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER transfer_discrepancy_claims_set_updated_at
    BEFORE UPDATE ON public.transfer_discrepancy_claims
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER inventory_buffer_thresholds_set_updated_at
    BEFORE UPDATE ON public.inventory_buffer_thresholds
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- --------------------------------------------------------------------
-- 13. ROW-LEVEL SECURITY
-- --------------------------------------------------------------------
ALTER TABLE public.stock_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_transfer_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_transfer_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transfer_discrepancy_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.item_valuations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_buffer_thresholds ENABLE ROW LEVEL SECURITY;

CREATE POLICY stock_transfers_tenant_isolation
    ON public.stock_transfers FOR ALL TO authenticated
    USING (tenant_id = private.current_tenant_id())
    WITH CHECK (tenant_id = private.current_tenant_id());

CREATE POLICY stock_transfer_items_tenant_isolation
    ON public.stock_transfer_items FOR ALL TO authenticated
    USING (tenant_id = private.current_tenant_id())
    WITH CHECK (tenant_id = private.current_tenant_id());

CREATE POLICY stock_transfer_incidents_tenant_isolation
    ON public.stock_transfer_incidents FOR ALL TO authenticated
    USING (tenant_id = private.current_tenant_id())
    WITH CHECK (tenant_id = private.current_tenant_id());

CREATE POLICY transfer_discrepancy_claims_tenant_isolation
    ON public.transfer_discrepancy_claims FOR ALL TO authenticated
    USING (tenant_id = private.current_tenant_id())
    WITH CHECK (tenant_id = private.current_tenant_id());

CREATE POLICY item_valuations_tenant_isolation
    ON public.item_valuations FOR ALL TO authenticated
    USING (tenant_id = private.current_tenant_id())
    WITH CHECK (tenant_id = private.current_tenant_id());

CREATE POLICY inventory_buffer_thresholds_tenant_isolation
    ON public.inventory_buffer_thresholds FOR ALL TO authenticated
    USING (tenant_id = private.current_tenant_id())
    WITH CHECK (tenant_id = private.current_tenant_id());

-- --------------------------------------------------------------------
-- 14. GRANTS
-- --------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION private.ensure_system_location(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION private.get_inventory_control_flag(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION private.get_item_valuation_on_hand(UUID, UUID, UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION private.get_item_average_cost(UUID, UUID, UUID, UUID) TO authenticated;

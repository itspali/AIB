-- Stock adjustments (location-scoped documents) + post RPC + STOCK_ADJUSTMENT numbering.

ALTER TYPE public.document_voucher_type ADD VALUE IF NOT EXISTS 'STOCK_ADJUSTMENT';

CREATE TYPE public.stock_adjustment_kind AS ENUM (
    'OPENING',
    'CORRECTION',
    'WRITE_OFF'
);

CREATE TYPE public.stock_adjustment_status AS ENUM (
    'POSTED'
);

CREATE TABLE public.stock_adjustments (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
    location_id         UUID NOT NULL REFERENCES public.tenant_locations (id) ON DELETE RESTRICT,
    adjustment_number   TEXT NOT NULL,
    kind                public.stock_adjustment_kind NOT NULL DEFAULT 'CORRECTION',
    status              public.stock_adjustment_status NOT NULL DEFAULT 'POSTED',
    reason              TEXT NOT NULL,
    notes               TEXT,
    source_system       TEXT,
    source_document_id  TEXT,
    posted_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by          UUID NOT NULL REFERENCES public.users (id) ON DELETE RESTRICT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT stock_adjustments_tenant_number_unique UNIQUE (tenant_id, adjustment_number)
);

CREATE UNIQUE INDEX stock_adjustments_source_idempotent_idx
    ON public.stock_adjustments (tenant_id, source_system, source_document_id)
    WHERE source_system IS NOT NULL AND source_document_id IS NOT NULL;

CREATE INDEX stock_adjustments_tenant_location_idx
    ON public.stock_adjustments (tenant_id, location_id, posted_at DESC);

CREATE TABLE public.stock_adjustment_lines (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
    adjustment_id       UUID NOT NULL REFERENCES public.stock_adjustments (id) ON DELETE CASCADE,
    item_id             UUID NOT NULL REFERENCES public.items (id) ON DELETE RESTRICT,
    variant_id          UUID NOT NULL REFERENCES public.item_variants (id) ON DELETE RESTRICT,
    location_id         UUID NOT NULL REFERENCES public.tenant_locations (id) ON DELETE RESTRICT,
    quantity_delta      NUMERIC(15, 4) NOT NULL,
    unit_cost           NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
    line_notes          TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT stock_adjustment_lines_qty_nonzero_chk CHECK (quantity_delta <> 0),
    CONSTRAINT stock_adjustment_lines_unit_cost_non_negative_chk CHECK (unit_cost >= 0)
);

CREATE INDEX stock_adjustment_lines_adjustment_idx
    ON public.stock_adjustment_lines (tenant_id, adjustment_id);

ALTER TABLE public.stock_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_adjustment_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY stock_adjustments_tenant_isolation
    ON public.stock_adjustments FOR ALL TO authenticated
    USING (tenant_id = private.current_tenant_id())
    WITH CHECK (tenant_id = private.current_tenant_id());

CREATE POLICY stock_adjustment_lines_tenant_isolation
    ON public.stock_adjustment_lines FOR ALL TO authenticated
    USING (tenant_id = private.current_tenant_id())
    WITH CHECK (tenant_id = private.current_tenant_id());

CREATE TRIGGER stock_adjustments_set_updated_at
    BEFORE UPDATE ON public.stock_adjustments
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

-- STOCK_ADJUSTMENT uses stock-holding locations (same as STOCK_TRANSFER).
CREATE OR REPLACE FUNCTION private.location_supports_document_voucher_key(
    p_key TEXT,
    p_is_stock_holding BOOLEAN,
    p_is_commercial_storefront BOOLEAN,
    p_is_administrative_office BOOLEAN
)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
    IF NOT private.is_document_voucher_type(p_key) THEN
        RETURN FALSE;
    END IF;

    CASE upper(p_key)
        WHEN 'PURCHASE_ORDER', 'GOODS_RECEIPT_NOTE', 'PURCHASE_INVOICE', 'STOCK_TRANSFER', 'STOCK_ADJUSTMENT' THEN
            RETURN COALESCE(p_is_stock_holding, FALSE);
        WHEN 'SALES_QUOTATION', 'SALES_ORDER', 'SALES_INVOICE', 'CUSTOMER_PAYMENT', 'SALES_CREDIT_NOTE' THEN
            RETURN COALESCE(p_is_commercial_storefront, FALSE);
        WHEN 'GENERAL_LEDGER' THEN
            RETURN COALESCE(p_is_administrative_office, FALSE);
        ELSE
            RETURN FALSE;
    END CASE;
END;
$$;

CREATE OR REPLACE FUNCTION public.reconcile_document_sequence(
    p_tenant_id UUID,
    p_voucher_type public.document_voucher_type,
    p_location_id UUID,
    p_prefix TEXT DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_prefix TEXT;
    v_padding INTEGER;
    v_scope_location_id UUID;
    v_uses_location_scope BOOLEAN;
    v_max_suffix INTEGER := 0;
    v_next INTEGER;
    v_number TEXT;
    v_suffix_text TEXT;
BEGIN
    IF p_tenant_id IS NULL THEN
        RAISE EXCEPTION 'tenant id is required';
    END IF;
    IF p_location_id IS NULL THEN
        RAISE EXCEPTION 'location id is required';
    END IF;

    IF p_prefix IS NOT NULL THEN
        v_prefix := btrim(p_prefix);
    ELSE
        SELECT prefix, padding_length, uses_location_scope
        INTO v_prefix, v_padding, v_uses_location_scope
        FROM private.resolve_effective_naming_entry(p_tenant_id, p_location_id, p_voucher_type);

        v_scope_location_id := CASE
            WHEN v_uses_location_scope THEN p_location_id
            ELSE NULL
        END;
    END IF;

    IF v_prefix IS NULL OR v_prefix = '' THEN
        RAISE EXCEPTION 'document prefix not configured for % at location %', p_voucher_type, p_location_id;
    END IF;

    IF p_voucher_type = 'STOCK_ADJUSTMENT' THEN
        FOR v_number IN
            SELECT adjustment_number
            FROM public.stock_adjustments
            WHERE tenant_id = p_tenant_id
              AND location_id = p_location_id
              AND adjustment_number LIKE v_prefix || '%'
        LOOP
            v_suffix_text := substring(v_number from length(v_prefix) + 1);
            IF v_suffix_text ~ '^[0-9]+$' THEN
                v_max_suffix := GREATEST(v_max_suffix, v_suffix_text::INTEGER);
            END IF;
        END LOOP;
    ELSIF p_voucher_type = 'STOCK_TRANSFER' THEN
        FOR v_number IN
            SELECT transfer_number
            FROM public.stock_transfers
            WHERE tenant_id = p_tenant_id
              AND (source_location_id = p_location_id OR destination_location_id = p_location_id)
              AND transfer_number LIKE v_prefix || '%'
        LOOP
            v_suffix_text := substring(v_number from length(v_prefix) + 1);
            IF v_suffix_text ~ '^[0-9]+$' THEN
                v_max_suffix := GREATEST(v_max_suffix, v_suffix_text::INTEGER);
            END IF;
        END LOOP;
    END IF;

    v_next := v_max_suffix + 1;

    IF p_prefix IS NOT NULL THEN
        v_scope_location_id := p_location_id;
        v_padding := 5;
    END IF;

    UPDATE public.document_sequences
    SET next_value = GREATEST(next_value, v_next),
        updated_at = NOW()
    WHERE tenant_id = p_tenant_id
      AND voucher_type = p_voucher_type
      AND prefix = v_prefix
      AND location_id IS NOT DISTINCT FROM COALESCE(v_scope_location_id, p_location_id);

    IF NOT FOUND THEN
        INSERT INTO public.document_sequences (
            tenant_id, location_id, voucher_type, prefix, next_value, padding_length
        )
        VALUES (
            p_tenant_id,
            COALESCE(v_scope_location_id, p_location_id),
            p_voucher_type,
            v_prefix,
            v_next,
            COALESCE(v_padding, 5)
        );
    END IF;

    RETURN v_next;
END;
$$;

REVOKE ALL ON FUNCTION public.reconcile_document_sequence(UUID, public.document_voucher_type, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reconcile_document_sequence(UUID, public.document_voucher_type, UUID, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.post_stock_adjustment(
    p_location_id UUID,
    p_kind public.stock_adjustment_kind,
    p_reason TEXT,
    p_notes TEXT,
    p_lines JSONB,
    p_created_by UUID,
    p_source_system TEXT DEFAULT NULL,
    p_source_document_id TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_tenant_id UUID;
    v_location RECORD;
    v_adjustment_id UUID;
    v_adjustment_number TEXT;
    v_entry JSONB;
    v_variant_id UUID;
    v_item_id UUID;
    v_qty NUMERIC(15, 4);
    v_unit_cost NUMERIC(15, 4);
    v_on_hand NUMERIC(15, 4);
    v_tracking public.item_tracking_mode;
    v_track_inventory BOOLEAN;
    v_line_count INTEGER := 0;
BEGIN
    v_tenant_id := private.current_tenant_id();
    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'tenant context missing from session';
    END IF;

    IF p_created_by IS NULL THEN
        RAISE EXCEPTION 'created_by is required';
    END IF;

    IF p_location_id IS NULL THEN
        RAISE EXCEPTION 'location id is required';
    END IF;

    IF p_reason IS NULL OR btrim(p_reason) = '' THEN
        RAISE EXCEPTION 'reason is required';
    END IF;

    IF p_lines IS NULL OR jsonb_typeof(p_lines) IS DISTINCT FROM 'array' OR jsonb_array_length(p_lines) = 0 THEN
        RAISE EXCEPTION 'at least one adjustment line is required';
    END IF;

    SELECT id, code, is_stock_holding, presence_type
    INTO v_location
    FROM public.tenant_locations
    WHERE id = p_location_id
      AND tenant_id = v_tenant_id
      AND is_active = TRUE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'location not found';
    END IF;

    IF NOT COALESCE(v_location.is_stock_holding, FALSE) OR v_location.presence_type = 'VIRTUAL' THEN
        RAISE EXCEPTION 'location cannot hold inventory';
    END IF;

    IF p_source_system IS NOT NULL AND p_source_document_id IS NOT NULL THEN
        SELECT id INTO v_adjustment_id
        FROM public.stock_adjustments
        WHERE tenant_id = v_tenant_id
          AND source_system = p_source_system
          AND source_document_id = p_source_document_id;

        IF FOUND THEN
            RETURN v_adjustment_id;
        END IF;
    END IF;

    v_adjustment_number := public.generate_next_voucher_string(
        v_tenant_id,
        'STOCK_ADJUSTMENT'::public.document_voucher_type,
        NULL,
        p_location_id
    );

    INSERT INTO public.stock_adjustments (
        tenant_id,
        location_id,
        adjustment_number,
        kind,
        status,
        reason,
        notes,
        source_system,
        source_document_id,
        created_by
    )
    VALUES (
        v_tenant_id,
        p_location_id,
        v_adjustment_number,
        COALESCE(p_kind, 'CORRECTION'::public.stock_adjustment_kind),
        'POSTED'::public.stock_adjustment_status,
        btrim(p_reason),
        NULLIF(btrim(p_notes), ''),
        NULLIF(btrim(p_source_system), ''),
        NULLIF(btrim(p_source_document_id), ''),
        p_created_by
    )
    RETURNING id INTO v_adjustment_id;

    FOR v_entry IN SELECT value FROM jsonb_array_elements(p_lines)
    LOOP
        v_variant_id := NULLIF(v_entry ->> 'variant_id', '')::UUID;
        v_qty := NULLIF(v_entry ->> 'quantity_delta', '')::NUMERIC;
        v_unit_cost := COALESCE(NULLIF(v_entry ->> 'unit_cost', '')::NUMERIC, 0);

        IF v_variant_id IS NULL THEN
            RAISE EXCEPTION 'variant_id is required on each line';
        END IF;

        IF v_qty IS NULL OR v_qty = 0 THEN
            RAISE EXCEPTION 'quantity_delta must be non-zero';
        END IF;

        IF v_qty > 0 AND v_unit_cost < 0 THEN
            RAISE EXCEPTION 'unit_cost cannot be negative';
        END IF;

        SELECT iv.item_id, i.track_inventory, i.tracking_mode
        INTO v_item_id, v_track_inventory, v_tracking
        FROM public.item_variants iv
        INNER JOIN public.items i ON i.id = iv.item_id AND i.tenant_id = iv.tenant_id
        WHERE iv.id = v_variant_id
          AND iv.tenant_id = v_tenant_id
          AND iv.is_active = TRUE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'variant % not found', v_variant_id;
        END IF;

        IF NOT COALESCE(v_track_inventory, FALSE) THEN
            RAISE EXCEPTION 'item does not track inventory';
        END IF;

        IF v_tracking IS DISTINCT FROM 'NONE'::public.item_tracking_mode THEN
            RAISE EXCEPTION 'lot and serial tracking are not supported in stock adjustments yet';
        END IF;

        IF p_kind = 'OPENING' AND v_qty < 0 THEN
            RAISE EXCEPTION 'opening adjustments cannot reduce stock';
        END IF;

        v_on_hand := private.get_item_valuation_on_hand(
            v_tenant_id, p_location_id, v_item_id, v_variant_id
        );

        IF p_kind = 'OPENING' AND v_on_hand <> 0 THEN
            RAISE EXCEPTION 'opening balance requires zero on-hand for variant % at this location', v_variant_id;
        END IF;

        IF v_qty > 0 AND v_unit_cost = 0 AND p_kind <> 'WRITE_OFF' THEN
            RAISE EXCEPTION 'unit_cost is required for positive quantity lines';
        END IF;

        INSERT INTO public.stock_adjustment_lines (
            tenant_id,
            adjustment_id,
            item_id,
            variant_id,
            location_id,
            quantity_delta,
            unit_cost,
            line_notes
        )
        VALUES (
            v_tenant_id,
            v_adjustment_id,
            v_item_id,
            v_variant_id,
            p_location_id,
            v_qty,
            CASE WHEN v_qty > 0 THEN v_unit_cost ELSE 0 END,
            NULLIF(btrim(v_entry ->> 'line_notes'), '')
        );

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
            v_tenant_id,
            v_item_id,
            v_variant_id,
            p_location_id,
            'INVENTORY_ADJUSTMENT'::public.inventory_transaction_type,
            v_qty,
            CASE WHEN v_qty > 0 THEN v_unit_cost ELSE 0 END,
            v_adjustment_number,
            p_created_by
        );

        IF v_qty > 0 THEN
            INSERT INTO public.item_variant_locations (
                tenant_id, item_id, variant_id, location_id,
                is_stocked, is_sellable, is_orderable
            )
            VALUES (
                v_tenant_id, v_item_id, v_variant_id, p_location_id,
                TRUE, FALSE, FALSE
            )
            ON CONFLICT (variant_id, location_id)
            DO UPDATE SET
                is_stocked = TRUE,
                updated_at = NOW();
        END IF;

        v_line_count := v_line_count + 1;
    END LOOP;

    IF v_line_count = 0 THEN
        RAISE EXCEPTION 'no valid adjustment lines were posted';
    END IF;

    RETURN v_adjustment_id;
END;
$$;

REVOKE ALL ON FUNCTION public.post_stock_adjustment(
    UUID, public.stock_adjustment_kind, TEXT, TEXT, JSONB, UUID, TEXT, TEXT
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.post_stock_adjustment(
    UUID, public.stock_adjustment_kind, TEXT, TEXT, JSONB, UUID, TEXT, TEXT
) TO authenticated;

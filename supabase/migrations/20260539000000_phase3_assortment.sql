-- ====================================================================
-- AIB SMART ERP - PHASE 3: VARIANT ASSORTMENT + CHANNEL AVAILABILITY
-- Migration: 20260539000000_phase3_assortment.sql
-- --------------------------------------------------------------------
--   * item_variant_locations: which variants are carried/sellable where
--     (a master/planning record, distinct from on-hand stock).
--   * storefront_variant_items: per-variant visibility per channel.
-- ====================================================================

-- --------------------------------------------------------------------
-- 1. item_variant_locations (assortment)
-- --------------------------------------------------------------------
CREATE TABLE public.item_variant_locations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
    item_id         UUID NOT NULL REFERENCES public.items (id) ON DELETE CASCADE,
    variant_id      UUID NOT NULL REFERENCES public.item_variants (id) ON DELETE CASCADE,
    location_id     UUID NOT NULL REFERENCES public.tenant_locations (id) ON DELETE CASCADE,
    is_stocked      BOOLEAN NOT NULL DEFAULT TRUE,
    is_sellable     BOOLEAN NOT NULL DEFAULT TRUE,
    is_orderable    BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT item_variant_locations_unique UNIQUE (variant_id, location_id)
);

ALTER TABLE public.item_variant_locations
    ADD CONSTRAINT item_variant_locations_item_tenant_fk
    FOREIGN KEY (tenant_id, item_id)
    REFERENCES public.items (tenant_id, id)
    ON DELETE CASCADE;

ALTER TABLE public.item_variant_locations
    ADD CONSTRAINT item_variant_locations_variant_tenant_fk
    FOREIGN KEY (tenant_id, variant_id)
    REFERENCES public.item_variants (tenant_id, id)
    ON DELETE CASCADE;

ALTER TABLE public.item_variant_locations
    ADD CONSTRAINT item_variant_locations_location_tenant_fk
    FOREIGN KEY (tenant_id, location_id)
    REFERENCES public.tenant_locations (tenant_id, id)
    ON DELETE CASCADE;

CREATE INDEX item_variant_locations_tenant_item_idx
    ON public.item_variant_locations (tenant_id, item_id);

CREATE TRIGGER item_variant_locations_set_updated_at
    BEFORE UPDATE ON public.item_variant_locations
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

-- Presence-type gating: only stock-holding, non-virtual locations can be stocked.
CREATE OR REPLACE FUNCTION public.item_variant_locations_presence_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_is_stock_holding BOOLEAN;
    v_presence TEXT;
BEGIN
    IF NEW.is_stocked THEN
        SELECT is_stock_holding, presence_type::TEXT
        INTO v_is_stock_holding, v_presence
        FROM public.tenant_locations
        WHERE id = NEW.location_id
          AND tenant_id = NEW.tenant_id;

        IF NOT COALESCE(v_is_stock_holding, FALSE) OR v_presence = 'VIRTUAL' THEN
            RAISE EXCEPTION 'location % cannot stock inventory (virtual or non-stock-holding)', NEW.location_id;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER item_variant_locations_presence_guard
    BEFORE INSERT OR UPDATE ON public.item_variant_locations
    FOR EACH ROW
    EXECUTE FUNCTION public.item_variant_locations_presence_guard();

ALTER TABLE public.item_variant_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY item_variant_locations_tenant_isolation
    ON public.item_variant_locations FOR ALL TO authenticated
    USING (tenant_id = private.current_tenant_id())
    WITH CHECK (tenant_id = private.current_tenant_id());

-- --------------------------------------------------------------------
-- 2. storefront_variant_items (per-variant channel visibility)
-- --------------------------------------------------------------------
CREATE TABLE public.storefront_variant_items (
    tenant_id       UUID NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
    storefront_id   UUID NOT NULL REFERENCES public.storefront_channels (id) ON DELETE CASCADE,
    item_id         UUID NOT NULL REFERENCES public.items (id) ON DELETE CASCADE,
    variant_id      UUID NOT NULL REFERENCES public.item_variants (id) ON DELETE CASCADE,
    is_visible      BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (storefront_id, variant_id)
);

ALTER TABLE public.storefront_variant_items
    ADD CONSTRAINT storefront_variant_items_channel_tenant_fk
    FOREIGN KEY (tenant_id, storefront_id)
    REFERENCES public.storefront_channels (tenant_id, id)
    ON DELETE CASCADE;

ALTER TABLE public.storefront_variant_items
    ADD CONSTRAINT storefront_variant_items_variant_tenant_fk
    FOREIGN KEY (tenant_id, variant_id)
    REFERENCES public.item_variants (tenant_id, id)
    ON DELETE CASCADE;

CREATE INDEX storefront_variant_items_tenant_item_idx
    ON public.storefront_variant_items (tenant_id, item_id);

CREATE TRIGGER storefront_variant_items_set_updated_at
    BEFORE UPDATE ON public.storefront_variant_items
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.storefront_variant_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY storefront_variant_items_tenant_isolation
    ON public.storefront_variant_items FOR ALL TO authenticated
    USING (tenant_id = private.current_tenant_id())
    WITH CHECK (tenant_id = private.current_tenant_id());

-- --------------------------------------------------------------------
-- 3. RPC: save_item_variant_locations
--    p_rows = [{ variant_id, location_id, is_stocked, is_sellable, is_orderable }]
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.save_item_variant_locations(
    p_item_id UUID,
    p_rows JSONB
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_tenant_id UUID;
    v_entry JSONB;
    v_variant_id UUID;
    v_location_id UUID;
    v_count INTEGER := 0;
BEGIN
    v_tenant_id := private.current_tenant_id();
    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'tenant context missing from session';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.items WHERE id = p_item_id AND tenant_id = v_tenant_id
    ) THEN
        RAISE EXCEPTION 'product not found for tenant';
    END IF;

    IF p_rows IS NULL OR jsonb_typeof(p_rows) IS DISTINCT FROM 'array' THEN
        RAISE EXCEPTION 'rows payload must be a JSON array';
    END IF;

    FOR v_entry IN SELECT value FROM jsonb_array_elements(p_rows)
    LOOP
        v_variant_id := NULLIF(v_entry ->> 'variant_id', '')::UUID;
        v_location_id := NULLIF(v_entry ->> 'location_id', '')::UUID;

        IF v_variant_id IS NULL OR v_location_id IS NULL THEN
            CONTINUE;
        END IF;

        IF NOT EXISTS (
            SELECT 1 FROM public.item_variants
            WHERE id = v_variant_id AND item_id = p_item_id AND tenant_id = v_tenant_id
        ) THEN
            RAISE EXCEPTION 'variant % does not belong to this product', v_variant_id;
        END IF;

        IF NOT EXISTS (
            SELECT 1 FROM public.tenant_locations
            WHERE id = v_location_id AND tenant_id = v_tenant_id
        ) THEN
            RAISE EXCEPTION 'location % not found for tenant', v_location_id;
        END IF;

        INSERT INTO public.item_variant_locations (
            tenant_id, item_id, variant_id, location_id,
            is_stocked, is_sellable, is_orderable
        )
        VALUES (
            v_tenant_id, p_item_id, v_variant_id, v_location_id,
            COALESCE((v_entry ->> 'is_stocked')::BOOLEAN, TRUE),
            COALESCE((v_entry ->> 'is_sellable')::BOOLEAN, TRUE),
            COALESCE((v_entry ->> 'is_orderable')::BOOLEAN, TRUE)
        )
        ON CONFLICT (variant_id, location_id)
        DO UPDATE SET
            is_stocked = EXCLUDED.is_stocked,
            is_sellable = EXCLUDED.is_sellable,
            is_orderable = EXCLUDED.is_orderable,
            updated_at = NOW();

        v_count := v_count + 1;
    END LOOP;

    RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.save_item_variant_locations(UUID, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_item_variant_locations(UUID, JSONB) TO authenticated;

-- --------------------------------------------------------------------
-- 4. RPC: save_variant_channel_availability
--    p_rows = [{ storefront_id, variant_id, is_visible }]
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.save_variant_channel_availability(
    p_item_id UUID,
    p_rows JSONB
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_tenant_id UUID;
    v_entry JSONB;
    v_storefront_id UUID;
    v_variant_id UUID;
    v_count INTEGER := 0;
BEGIN
    v_tenant_id := private.current_tenant_id();
    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'tenant context missing from session';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.items WHERE id = p_item_id AND tenant_id = v_tenant_id
    ) THEN
        RAISE EXCEPTION 'product not found for tenant';
    END IF;

    IF p_rows IS NULL OR jsonb_typeof(p_rows) IS DISTINCT FROM 'array' THEN
        RAISE EXCEPTION 'rows payload must be a JSON array';
    END IF;

    FOR v_entry IN SELECT value FROM jsonb_array_elements(p_rows)
    LOOP
        v_storefront_id := NULLIF(v_entry ->> 'storefront_id', '')::UUID;
        v_variant_id := NULLIF(v_entry ->> 'variant_id', '')::UUID;

        IF v_storefront_id IS NULL OR v_variant_id IS NULL THEN
            CONTINUE;
        END IF;

        IF NOT EXISTS (
            SELECT 1 FROM public.item_variants
            WHERE id = v_variant_id AND item_id = p_item_id AND tenant_id = v_tenant_id
        ) THEN
            RAISE EXCEPTION 'variant % does not belong to this product', v_variant_id;
        END IF;

        IF NOT EXISTS (
            SELECT 1 FROM public.storefront_channels
            WHERE id = v_storefront_id AND tenant_id = v_tenant_id
        ) THEN
            RAISE EXCEPTION 'storefront channel % not found for tenant', v_storefront_id;
        END IF;

        INSERT INTO public.storefront_variant_items (
            tenant_id, storefront_id, item_id, variant_id, is_visible
        )
        VALUES (
            v_tenant_id, v_storefront_id, p_item_id, v_variant_id,
            COALESCE((v_entry ->> 'is_visible')::BOOLEAN, TRUE)
        )
        ON CONFLICT (storefront_id, variant_id)
        DO UPDATE SET
            is_visible = EXCLUDED.is_visible,
            updated_at = NOW();

        v_count := v_count + 1;
    END LOOP;

    RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.save_variant_channel_availability(UUID, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_variant_channel_availability(UUID, JSONB) TO authenticated;

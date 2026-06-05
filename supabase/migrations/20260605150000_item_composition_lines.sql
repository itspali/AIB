-- ====================================================================
-- Item composition lines (sold-as-a-set / package / BOM template)
-- Migration: 20260605150000_item_composition_lines.sql
-- ====================================================================

CREATE TABLE IF NOT EXISTS public.item_composition_lines (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
    parent_item_id          UUID NOT NULL,
    parent_variant_id       UUID,
    component_item_id       UUID NOT NULL,
    component_variant_id    UUID,
    quantity                NUMERIC(15, 4) NOT NULL DEFAULT 1.0000,
    is_mandatory            BOOLEAN NOT NULL DEFAULT TRUE,
    is_optional_addon       BOOLEAN NOT NULL DEFAULT FALSE,
    default_selected        BOOLEAN NOT NULL DEFAULT TRUE,
    unit_price              NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
    price_mode              TEXT NOT NULL DEFAULT 'FIXED',
    sort_order              INTEGER NOT NULL DEFAULT 0,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT item_composition_lines_qty_positive_chk
        CHECK (quantity > 0),
    CONSTRAINT item_composition_lines_unit_price_non_negative_chk
        CHECK (unit_price >= 0),
    CONSTRAINT item_composition_lines_price_mode_chk
        CHECK (price_mode IN ('FIXED', 'COMPLIMENTARY')),
    CONSTRAINT item_composition_lines_mandatory_xor_optional_chk
        CHECK (
            (is_mandatory = TRUE AND is_optional_addon = FALSE)
            OR (is_mandatory = FALSE AND is_optional_addon = TRUE)
        )
);

CREATE UNIQUE INDEX IF NOT EXISTS item_composition_lines_tenant_id_id_unique
    ON public.item_composition_lines (tenant_id, id);

CREATE INDEX IF NOT EXISTS item_composition_lines_parent_idx
    ON public.item_composition_lines (tenant_id, parent_item_id, parent_variant_id, sort_order);

ALTER TABLE public.item_composition_lines
    ADD CONSTRAINT item_composition_lines_parent_item_tenant_fk
    FOREIGN KEY (tenant_id, parent_item_id)
    REFERENCES public.items (tenant_id, id)
    ON DELETE CASCADE;

ALTER TABLE public.item_composition_lines
    ADD CONSTRAINT item_composition_lines_parent_variant_tenant_fk
    FOREIGN KEY (tenant_id, parent_variant_id)
    REFERENCES public.item_variants (tenant_id, id)
    ON DELETE CASCADE;

ALTER TABLE public.item_composition_lines
    ADD CONSTRAINT item_composition_lines_component_item_tenant_fk
    FOREIGN KEY (tenant_id, component_item_id)
    REFERENCES public.items (tenant_id, id)
    ON DELETE RESTRICT;

ALTER TABLE public.item_composition_lines
    ADD CONSTRAINT item_composition_lines_component_variant_tenant_fk
    FOREIGN KEY (tenant_id, component_variant_id)
    REFERENCES public.item_variants (tenant_id, id)
    ON DELETE RESTRICT;

DROP TRIGGER IF EXISTS item_composition_lines_set_updated_at ON public.item_composition_lines;
CREATE TRIGGER item_composition_lines_set_updated_at
    BEFORE UPDATE ON public.item_composition_lines
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.item_composition_lines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS item_composition_lines_tenant_isolation ON public.item_composition_lines;
CREATE POLICY item_composition_lines_tenant_isolation ON public.item_composition_lines
    FOR ALL
    USING (tenant_id = private.current_tenant_id())
    WITH CHECK (tenant_id = private.current_tenant_id());

-- --------------------------------------------------------------------
-- Replace-all composition lines for a parent item.
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.save_item_composition_lines(
    p_parent_item_id UUID,
    p_rows JSONB
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_tenant_id UUID;
    v_parent_item_type public.item_type;
    v_parent_classification public.item_classification_type;
    v_row JSONB;
    v_parent_variant_id UUID;
    v_component_item_id UUID;
    v_component_variant_id UUID;
    v_quantity NUMERIC(15, 4);
    v_is_mandatory BOOLEAN;
    v_is_optional_addon BOOLEAN;
    v_default_selected BOOLEAN;
    v_unit_price NUMERIC(15, 4);
    v_price_mode TEXT;
    v_sort_order INTEGER;
    v_component_item_type public.item_type;
    v_count INTEGER := 0;
    v_mandatory_count INTEGER := 0;
    v_seen TEXT[] := ARRAY[]::TEXT[];
    v_combo TEXT;
    v_allowed_types public.item_type[];
BEGIN
    v_tenant_id := private.current_tenant_id();
    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'tenant context missing from session';
    END IF;

    SELECT item_type, classification
    INTO v_parent_item_type, v_parent_classification
    FROM public.items
    WHERE id = p_parent_item_id
      AND tenant_id = v_tenant_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'parent item not found for tenant';
    END IF;

    IF p_rows IS NULL OR jsonb_typeof(p_rows) IS DISTINCT FROM 'array' THEN
        RAISE EXCEPTION 'rows payload must be a JSON array';
    END IF;

    v_allowed_types := CASE
        WHEN v_parent_item_type = 'SERVICE'::public.item_type THEN
            ARRAY['SERVICE'::public.item_type, 'DIGITAL'::public.item_type]
        WHEN v_parent_item_type = 'DIGITAL'::public.item_type THEN
            ARRAY['DIGITAL'::public.item_type, 'SERVICE'::public.item_type]
        WHEN v_parent_classification = 'WIP_ASSEMBLY'::public.item_classification_type THEN
            ARRAY['PHYSICAL'::public.item_type]
        WHEN v_parent_classification = 'FINISHED_GOOD'::public.item_classification_type THEN
            ARRAY['PHYSICAL'::public.item_type, 'SERVICE'::public.item_type, 'DIGITAL'::public.item_type]
        ELSE
            ARRAY[]::public.item_type[]
    END;

    IF COALESCE(array_length(v_allowed_types, 1), 0) = 0 THEN
        RAISE EXCEPTION 'composition is not allowed for this parent role';
    END IF;

    DELETE FROM public.item_composition_lines
    WHERE tenant_id = v_tenant_id
      AND parent_item_id = p_parent_item_id;

    FOR v_row IN SELECT value FROM jsonb_array_elements(p_rows)
    LOOP
        v_parent_variant_id := NULLIF(v_row ->> 'parent_variant_id', '')::UUID;
        v_component_item_id := NULLIF(v_row ->> 'component_item_id', '')::UUID;
        v_component_variant_id := NULLIF(v_row ->> 'component_variant_id', '')::UUID;
        v_quantity := COALESCE(NULLIF(v_row ->> 'quantity', '')::NUMERIC, 1);
        v_is_mandatory := COALESCE((v_row ->> 'is_mandatory')::BOOLEAN, TRUE);
        v_is_optional_addon := COALESCE((v_row ->> 'is_optional_addon')::BOOLEAN, FALSE);
        v_default_selected := COALESCE((v_row ->> 'default_selected')::BOOLEAN, TRUE);
        v_unit_price := COALESCE(NULLIF(v_row ->> 'unit_price', '')::NUMERIC, 0);
        v_price_mode := upper(COALESCE(NULLIF(btrim(v_row ->> 'price_mode'), ''), 'FIXED'));
        v_sort_order := COALESCE(NULLIF(v_row ->> 'sort_order', '')::INTEGER, v_count);

        IF v_component_item_id IS NULL THEN
            RAISE EXCEPTION 'component_item_id is required for every line';
        END IF;

        IF v_component_item_id = p_parent_item_id THEN
            RAISE EXCEPTION 'parent item cannot be its own component';
        END IF;

        IF v_quantity <= 0 THEN
            RAISE EXCEPTION 'quantity must be greater than zero';
        END IF;

        IF v_is_mandatory = v_is_optional_addon THEN
            RAISE EXCEPTION 'each line must be mandatory or optional, not both';
        END IF;

        IF v_price_mode NOT IN ('FIXED', 'COMPLIMENTARY') THEN
            RAISE EXCEPTION 'invalid price_mode';
        END IF;

        IF v_price_mode = 'COMPLIMENTARY' THEN
            v_unit_price := 0;
        ELSIF v_unit_price < 0 THEN
            RAISE EXCEPTION 'unit_price must be zero or greater';
        END IF;

        IF v_parent_variant_id IS NOT NULL AND NOT EXISTS (
            SELECT 1 FROM public.item_variants
            WHERE id = v_parent_variant_id
              AND item_id = p_parent_item_id
              AND tenant_id = v_tenant_id
        ) THEN
            RAISE EXCEPTION 'parent variant does not belong to this item';
        END IF;

        SELECT item_type
        INTO v_component_item_type
        FROM public.items
        WHERE id = v_component_item_id
          AND tenant_id = v_tenant_id
          AND is_active = TRUE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'component item not found for tenant';
        END IF;

        IF NOT (v_component_item_type = ANY (v_allowed_types)) THEN
            RAISE EXCEPTION 'component item type is not allowed for this parent';
        END IF;

        IF v_component_variant_id IS NOT NULL AND NOT EXISTS (
            SELECT 1 FROM public.item_variants
            WHERE id = v_component_variant_id
              AND item_id = v_component_item_id
              AND tenant_id = v_tenant_id
        ) THEN
            RAISE EXCEPTION 'component variant does not belong to the component item';
        END IF;

        v_combo :=
            COALESCE(v_parent_variant_id::TEXT, '*') || '|'
            || v_component_item_id::TEXT || '|'
            || COALESCE(v_component_variant_id::TEXT, '*');
        IF v_combo = ANY (v_seen) THEN
            RAISE EXCEPTION 'duplicate component for the same parent variant bucket';
        END IF;
        v_seen := array_append(v_seen, v_combo);

        IF v_is_mandatory THEN
            v_mandatory_count := v_mandatory_count + 1;
        END IF;

        INSERT INTO public.item_composition_lines (
            tenant_id,
            parent_item_id,
            parent_variant_id,
            component_item_id,
            component_variant_id,
            quantity,
            is_mandatory,
            is_optional_addon,
            default_selected,
            unit_price,
            price_mode,
            sort_order
        )
        VALUES (
            v_tenant_id,
            p_parent_item_id,
            v_parent_variant_id,
            v_component_item_id,
            v_component_variant_id,
            v_quantity,
            v_is_mandatory,
            v_is_optional_addon,
            v_default_selected,
            v_unit_price,
            v_price_mode,
            v_sort_order
        );

        v_count := v_count + 1;
    END LOOP;

    IF v_count > 0 AND v_mandatory_count < 1 THEN
        RAISE EXCEPTION 'at least one mandatory component is required';
    END IF;

    RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.save_item_composition_lines(UUID, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_item_composition_lines(UUID, JSONB) TO authenticated;

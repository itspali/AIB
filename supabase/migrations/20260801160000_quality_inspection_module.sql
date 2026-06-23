-- Quality inspection work queue: test templates, inspection records, and template resolution.

CREATE TYPE public.qc_test_parameter_type AS ENUM ('BOOLEAN', 'NUMERIC', 'TEXT', 'CHOICE');
CREATE TYPE public.qc_test_scope_type AS ENUM ('ITEM', 'CATEGORY');
CREATE TYPE public.qc_inspection_status AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED');
CREATE TYPE public.qc_parameter_result AS ENUM ('PASS', 'FAIL', 'NA');

CREATE TABLE public.qc_test_templates (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
    name                TEXT NOT NULL,
    description         TEXT,
    scope_type          public.qc_test_scope_type NOT NULL,
    scope_reference_id  UUID NOT NULL,
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT qc_test_templates_tenant_scope_unique
        UNIQUE (tenant_id, scope_type, scope_reference_id)
);

CREATE INDEX qc_test_templates_tenant_active_idx
    ON public.qc_test_templates (tenant_id, is_active);

CREATE TABLE public.qc_test_parameters (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
    template_id         UUID NOT NULL REFERENCES public.qc_test_templates (id) ON DELETE CASCADE,
    name                TEXT NOT NULL,
    parameter_type      public.qc_test_parameter_type NOT NULL,
    min_value           NUMERIC(15, 4),
    max_value           NUMERIC(15, 4),
    expected_text       TEXT,
    choice_options      JSONB NOT NULL DEFAULT '[]'::jsonb,
    is_mandatory        BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order          INT NOT NULL DEFAULT 0,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX qc_test_parameters_template_sort_idx
    ON public.qc_test_parameters (tenant_id, template_id, sort_order);

CREATE TABLE public.qc_inspections (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
    goods_receipt_id        UUID NOT NULL REFERENCES public.goods_receipts (id) ON DELETE CASCADE,
    goods_receipt_item_id   UUID NOT NULL REFERENCES public.goods_receipt_items (id) ON DELETE CASCADE,
    qc_inventory_balance_id UUID REFERENCES public.qc_inventory_balances (id) ON DELETE SET NULL,
    status                  public.qc_inspection_status NOT NULL DEFAULT 'COMPLETED',
    overall_result          public.qc_parameter_result,
    pass_quantity           NUMERIC(15, 4) NOT NULL DEFAULT 0,
    reject_quantity         NUMERIC(15, 4) NOT NULL DEFAULT 0,
    reject_disposition      public.grn_reject_disposition,
    notes                   TEXT,
    inspected_by            UUID REFERENCES public.users (id) ON DELETE SET NULL,
    completed_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX qc_inspections_tenant_grn_line_idx
    ON public.qc_inspections (tenant_id, goods_receipt_item_id, completed_at DESC);

CREATE TABLE public.qc_inspection_result_lines (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
    inspection_id       UUID NOT NULL REFERENCES public.qc_inspections (id) ON DELETE CASCADE,
    parameter_id        UUID REFERENCES public.qc_test_parameters (id) ON DELETE SET NULL,
    parameter_name      TEXT NOT NULL,
    parameter_type      public.qc_test_parameter_type NOT NULL,
    min_value           NUMERIC(15, 4),
    max_value           NUMERIC(15, 4),
    expected_text       TEXT,
    choice_options      JSONB NOT NULL DEFAULT '[]'::jsonb,
    measured_value      TEXT,
    result              public.qc_parameter_result NOT NULL DEFAULT 'NA',
    sort_order          INT NOT NULL DEFAULT 0,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX qc_inspection_result_lines_inspection_idx
    ON public.qc_inspection_result_lines (tenant_id, inspection_id, sort_order);

ALTER TABLE public.qc_test_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qc_test_parameters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qc_inspections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qc_inspection_result_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY qc_test_templates_tenant_isolation ON public.qc_test_templates
    FOR ALL TO authenticated
    USING (tenant_id = private.current_tenant_id())
    WITH CHECK (tenant_id = private.current_tenant_id());

CREATE POLICY qc_test_parameters_tenant_isolation ON public.qc_test_parameters
    FOR ALL TO authenticated
    USING (tenant_id = private.current_tenant_id())
    WITH CHECK (tenant_id = private.current_tenant_id());

CREATE POLICY qc_inspections_tenant_isolation ON public.qc_inspections
    FOR ALL TO authenticated
    USING (tenant_id = private.current_tenant_id())
    WITH CHECK (tenant_id = private.current_tenant_id());

CREATE POLICY qc_inspection_result_lines_tenant_isolation ON public.qc_inspection_result_lines
    FOR ALL TO authenticated
    USING (tenant_id = private.current_tenant_id())
    WITH CHECK (tenant_id = private.current_tenant_id());

CREATE TRIGGER qc_test_templates_set_updated_at
    BEFORE UPDATE ON public.qc_test_templates
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER qc_test_parameters_set_updated_at
    BEFORE UPDATE ON public.qc_test_parameters
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER qc_inspections_set_updated_at
    BEFORE UPDATE ON public.qc_inspections
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION private.resolve_qc_test_template_id_for_item(
    p_tenant_id UUID,
    p_item_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_template_id UUID;
    v_category_id UUID;
    v_current_id UUID;
BEGIN
    SELECT id INTO v_template_id
    FROM public.qc_test_templates
    WHERE tenant_id = p_tenant_id
      AND scope_type = 'ITEM'
      AND scope_reference_id = p_item_id
      AND is_active = TRUE
    LIMIT 1;

    IF v_template_id IS NOT NULL THEN
        RETURN v_template_id;
    END IF;

    SELECT category_id INTO v_category_id
    FROM public.items
    WHERE tenant_id = p_tenant_id AND id = p_item_id;

    v_current_id := v_category_id;
    WHILE v_current_id IS NOT NULL LOOP
        SELECT id INTO v_template_id
        FROM public.qc_test_templates
        WHERE tenant_id = p_tenant_id
          AND scope_type = 'CATEGORY'
          AND scope_reference_id = v_current_id
          AND is_active = TRUE
        LIMIT 1;

        IF v_template_id IS NOT NULL THEN
            RETURN v_template_id;
        END IF;

        SELECT parent_id INTO v_current_id
        FROM public.item_categories
        WHERE tenant_id = p_tenant_id AND id = v_current_id;
    END LOOP;

    RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_qc_line_inspection(
    p_goods_receipt_item_id UUID,
    p_quantity_released NUMERIC,
    p_quantity_failed NUMERIC DEFAULT 0,
    p_failed_disposition public.grn_reject_disposition DEFAULT 'SCRAP',
    p_notes TEXT DEFAULT NULL,
    p_result_lines JSONB DEFAULT '[]'::jsonb,
    p_inspected_by UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_tenant_id UUID;
    v_gri public.goods_receipt_items%ROWTYPE;
    v_qc_row public.qc_inventory_balances%ROWTYPE;
    v_inspection_id UUID;
    v_overall public.qc_parameter_result;
    v_line JSONB;
    v_has_mandatory_fail BOOLEAN := FALSE;
    v_release JSONB;
BEGIN
    v_tenant_id := private.current_tenant_id();
    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'tenant context missing from session';
    END IF;

    SELECT * INTO v_gri
    FROM public.goods_receipt_items
    WHERE id = p_goods_receipt_item_id AND tenant_id = v_tenant_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'goods receipt line not found';
    END IF;

    SELECT * INTO v_qc_row
    FROM public.qc_inventory_balances
    WHERE tenant_id = v_tenant_id AND goods_receipt_item_id = p_goods_receipt_item_id;

    IF jsonb_array_length(COALESCE(p_result_lines, '[]'::jsonb)) > 0 THEN
        FOR v_line IN SELECT value FROM jsonb_array_elements(COALESCE(p_result_lines, '[]'::jsonb))
        LOOP
            IF COALESCE(v_line ->> 'is_mandatory', 'false')::boolean
               AND COALESCE(v_line ->> 'result', 'NA') = 'FAIL'
            THEN
                v_has_mandatory_fail := TRUE;
            END IF;
        END LOOP;
    END IF;

    IF COALESCE(p_quantity_failed, 0) > 0 THEN
        v_overall := 'FAIL';
    ELSIF v_has_mandatory_fail THEN
        v_overall := 'FAIL';
    ELSIF COALESCE(p_quantity_released, 0) > 0 THEN
        v_overall := 'PASS';
    ELSE
        v_overall := 'NA';
    END IF;

    INSERT INTO public.qc_inspections (
        tenant_id,
        goods_receipt_id,
        goods_receipt_item_id,
        qc_inventory_balance_id,
        status,
        overall_result,
        pass_quantity,
        reject_quantity,
        reject_disposition,
        notes,
        inspected_by
    )
    VALUES (
        v_tenant_id,
        v_gri.goods_receipt_id,
        v_gri.id,
        v_qc_row.id,
        'COMPLETED',
        v_overall,
        GREATEST(COALESCE(p_quantity_released, 0), 0),
        GREATEST(COALESCE(p_quantity_failed, 0), 0),
        CASE WHEN COALESCE(p_quantity_failed, 0) > 0 THEN p_failed_disposition ELSE NULL END,
        NULLIF(trim(COALESCE(p_notes, '')), ''),
        p_inspected_by
    )
    RETURNING id INTO v_inspection_id;

    IF jsonb_array_length(COALESCE(p_result_lines, '[]'::jsonb)) > 0 THEN
        INSERT INTO public.qc_inspection_result_lines (
            tenant_id,
            inspection_id,
            parameter_id,
            parameter_name,
            parameter_type,
            min_value,
            max_value,
            expected_text,
            choice_options,
            measured_value,
            result,
            sort_order
        )
        SELECT
            v_tenant_id,
            v_inspection_id,
            NULLIF(v_line ->> 'parameter_id', '')::uuid,
            COALESCE(v_line ->> 'parameter_name', 'Parameter'),
            COALESCE(v_line ->> 'parameter_type', 'TEXT')::public.qc_test_parameter_type,
            NULLIF(v_line ->> 'min_value', '')::numeric,
            NULLIF(v_line ->> 'max_value', '')::numeric,
            NULLIF(v_line ->> 'expected_text', ''),
            COALESCE(v_line -> 'choice_options', '[]'::jsonb),
            NULLIF(v_line ->> 'measured_value', ''),
            COALESCE(v_line ->> 'result', 'NA')::public.qc_parameter_result,
            COALESCE((v_line ->> 'sort_order')::int, 0)
        FROM jsonb_array_elements(COALESCE(p_result_lines, '[]'::jsonb)) AS v_line;
    END IF;

    v_release := public.release_goods_receipt_line_from_qc(
        p_goods_receipt_item_id,
        p_quantity_released,
        p_quantity_failed,
        p_failed_disposition,
        p_inspected_by
    );

    RETURN jsonb_build_object(
        'inspection_id', v_inspection_id,
        'overall_result', v_overall,
        'release', v_release
    );
END;
$$;

REVOKE ALL ON FUNCTION public.complete_qc_line_inspection(UUID, NUMERIC, NUMERIC, public.grn_reject_disposition, TEXT, JSONB, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_qc_line_inspection(UUID, NUMERIC, NUMERIC, public.grn_reject_disposition, TEXT, JSONB, UUID) TO authenticated;

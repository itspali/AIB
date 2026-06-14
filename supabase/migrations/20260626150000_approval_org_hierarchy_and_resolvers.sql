-- ====================================================================
-- Org hierarchy + dynamic approval assignees + parallel step fix
-- Migration: 20260626150000_approval_org_hierarchy_and_resolvers.sql
-- ====================================================================

CREATE UNIQUE INDEX IF NOT EXISTS user_tenant_memberships_tenant_user_unique
    ON public.user_tenant_memberships (tenant_id, user_id);

ALTER TABLE public.user_tenant_memberships
    ADD COLUMN IF NOT EXISTS reports_to_user_id UUID;

ALTER TABLE public.user_tenant_memberships
    DROP CONSTRAINT IF EXISTS user_tenant_memberships_reports_to_tenant_fk;

ALTER TABLE public.user_tenant_memberships
    ADD CONSTRAINT user_tenant_memberships_reports_to_tenant_fk
    FOREIGN KEY (tenant_id, reports_to_user_id)
    REFERENCES public.user_tenant_memberships (tenant_id, user_id)
    ON DELETE SET NULL
    DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE public.user_tenant_memberships
    DROP CONSTRAINT IF EXISTS user_tenant_memberships_reports_to_not_self_chk;

ALTER TABLE public.user_tenant_memberships
    ADD CONSTRAINT user_tenant_memberships_reports_to_not_self_chk
    CHECK (reports_to_user_id IS NULL OR reports_to_user_id <> user_id);

CREATE OR REPLACE FUNCTION private.validate_membership_reports_to_cycle()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_cursor UUID;
    v_depth INTEGER := 0;
BEGIN
    IF NEW.reports_to_user_id IS NULL THEN
        RETURN NEW;
    END IF;

    v_cursor := NEW.reports_to_user_id;

    WHILE v_cursor IS NOT NULL AND v_depth < 25
    LOOP
        IF v_cursor = NEW.user_id THEN
            RAISE EXCEPTION 'reporting line cannot create a cycle';
        END IF;

        SELECT m.reports_to_user_id
        INTO v_cursor
        FROM public.user_tenant_memberships m
        WHERE m.tenant_id = NEW.tenant_id
          AND m.user_id = v_cursor
          AND m.is_active = TRUE;

        v_depth := v_depth + 1;
    END LOOP;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS user_tenant_memberships_reports_to_cycle_guard
    ON public.user_tenant_memberships;

CREATE TRIGGER user_tenant_memberships_reports_to_cycle_guard
    BEFORE INSERT OR UPDATE OF reports_to_user_id
    ON public.user_tenant_memberships
    FOR EACH ROW
    EXECUTE FUNCTION private.validate_membership_reports_to_cycle();

CREATE OR REPLACE FUNCTION public.save_tenant_reporting_lines(p_lines JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_tenant_id UUID;
    v_line JSONB;
    v_user_id UUID;
    v_reports_to UUID;
    v_updated INTEGER := 0;
BEGIN
    v_tenant_id := private.current_tenant_id();

    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'tenant context missing from session';
    END IF;

    IF NOT private.user_can_modify_organization_settings() THEN
        RAISE EXCEPTION 'administrative privileges required to edit reporting lines';
    END IF;

    IF p_lines IS NULL OR jsonb_typeof(p_lines) <> 'array' THEN
        RAISE EXCEPTION 'reporting lines payload must be a JSON array';
    END IF;

    SET CONSTRAINTS user_tenant_memberships_reports_to_tenant_fk DEFERRED;
    SET CONSTRAINTS user_tenant_memberships_reports_to_not_self_chk DEFERRED;

    FOR v_line IN SELECT value FROM jsonb_array_elements(p_lines) AS value
    LOOP
        v_user_id := NULLIF(v_line ->> 'user_id', '')::uuid;
        v_reports_to := NULLIF(v_line ->> 'reports_to_user_id', '')::uuid;

        IF v_user_id IS NULL THEN
            CONTINUE;
        END IF;

        IF NOT EXISTS (
            SELECT 1
            FROM public.user_tenant_memberships m
            WHERE m.tenant_id = v_tenant_id
              AND m.user_id = v_user_id
              AND m.is_active = TRUE
        ) THEN
            RAISE EXCEPTION 'reporting line user is not an active workspace member';
        END IF;

        IF v_reports_to IS NOT NULL
           AND NOT EXISTS (
               SELECT 1
               FROM public.user_tenant_memberships m
               WHERE m.tenant_id = v_tenant_id
                 AND m.user_id = v_reports_to
                 AND m.is_active = TRUE
           )
        THEN
            RAISE EXCEPTION 'reports-to user is not an active workspace member';
        END IF;

        UPDATE public.user_tenant_memberships
        SET reports_to_user_id = v_reports_to,
            updated_at = NOW()
        WHERE tenant_id = v_tenant_id
          AND user_id = v_user_id;

        v_updated := v_updated + 1;
    END LOOP;

    SET CONSTRAINTS user_tenant_memberships_reports_to_tenant_fk IMMEDIATE;
    SET CONSTRAINTS user_tenant_memberships_reports_to_not_self_chk IMMEDIATE;

    RETURN jsonb_build_object('updated', v_updated);
END;
$$;

CREATE OR REPLACE FUNCTION private.resolve_approval_step_user_ids(
    p_tenant_id UUID,
    p_submitter_id UUID,
    p_step JSONB,
    p_policy JSONB
)
RETURNS UUID[]
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_assignee TEXT;
    v_pool TEXT;
    v_manager UUID;
    v_skip UUID;
BEGIN
    v_assignee := upper(COALESCE(p_step ->> 'assignee', 'POOL'));
    v_pool := COALESCE(p_step ->> 'pool', 'default');

    IF v_assignee IN ('SUBMITTER_MANAGER', 'MANAGER') THEN
        SELECT m.reports_to_user_id
        INTO v_manager
        FROM public.user_tenant_memberships m
        WHERE m.tenant_id = p_tenant_id
          AND m.user_id = p_submitter_id
          AND m.is_active = TRUE;

        IF v_manager IS NOT NULL THEN
            RETURN ARRAY[v_manager];
        END IF;

        RETURN ARRAY[]::uuid[];
    END IF;

    IF v_assignee IN ('SUBMITTER_SKIP_MANAGER', 'SKIP_MANAGER') THEN
        SELECT m.reports_to_user_id
        INTO v_manager
        FROM public.user_tenant_memberships m
        WHERE m.tenant_id = p_tenant_id
          AND m.user_id = p_submitter_id
          AND m.is_active = TRUE;

        IF v_manager IS NULL THEN
            RETURN ARRAY[]::uuid[];
        END IF;

        SELECT m.reports_to_user_id
        INTO v_skip
        FROM public.user_tenant_memberships m
        WHERE m.tenant_id = p_tenant_id
          AND m.user_id = v_manager
          AND m.is_active = TRUE;

        IF v_skip IS NOT NULL THEN
            RETURN ARRAY[v_skip];
        END IF;

        RETURN ARRAY[]::uuid[];
    END IF;

    RETURN private.pool_user_ids(p_policy, v_pool);
END;
$$;

CREATE OR REPLACE FUNCTION private.materialize_po_approval_run(
    p_tenant_id UUID,
    p_po_id UUID,
    p_submitter_id UUID,
    p_amount NUMERIC,
    p_currency TEXT,
    p_policy JSONB,
    p_band JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_run_id UUID;
    v_level JSONB;
    v_step JSONB;
    v_level_idx INTEGER := 0;
    v_step_idx INTEGER;
    v_step_id UUID;
    v_quorum TEXT;
    v_user_id UUID;
    v_user_ids UUID[];
BEGIN
    INSERT INTO public.document_approval_runs (
        tenant_id, document_type, document_id, status,
        policy_snapshot, amount_basis, currency_code, submitted_by
    )
    VALUES (
        p_tenant_id, 'PURCHASE_ORDER', p_po_id, 'PENDING',
        p_policy, COALESCE(p_amount, 0), COALESCE(p_currency, 'USD'), p_submitter_id
    )
    RETURNING id INTO v_run_id;

    FOR v_level IN
        SELECT value
        FROM jsonb_array_elements(COALESCE(p_band -> 'levels', '[]'::jsonb)) AS value
    LOOP
        v_step_idx := 0;
        FOR v_step IN
            SELECT value
            FROM jsonb_array_elements(COALESCE(v_level -> 'steps', '[]'::jsonb)) AS value
        LOOP
            v_quorum := COALESCE(v_step ->> 'quorum', 'ANY');

            INSERT INTO public.document_approval_run_steps (
                tenant_id, run_id, level_index, step_index, step_label,
                quorum_mode, min_approvals, status, opened_at
            )
            VALUES (
                p_tenant_id,
                v_run_id,
                v_level_idx,
                v_step_idx,
                COALESCE(v_step ->> 'label', 'Approval'),
                v_quorum,
                1,
                CASE WHEN v_level_idx = 0 THEN 'PENDING' ELSE 'LOCKED' END,
                CASE WHEN v_level_idx = 0 THEN NOW() ELSE NULL END
            )
            RETURNING id INTO v_step_id;

            v_user_ids := private.resolve_approval_step_user_ids(
                p_tenant_id,
                p_submitter_id,
                v_step,
                p_policy
            );

            IF COALESCE(array_length(v_user_ids, 1), 0) = 0 THEN
                SELECT COALESCE(array_agg(m.user_id), ARRAY[]::uuid[])
                INTO v_user_ids
                FROM public.user_tenant_memberships m
                WHERE m.tenant_id = p_tenant_id
                  AND m.is_active = TRUE
                  AND m.role = 'OWNER'::public.user_role;
            END IF;

            FOREACH v_user_id IN ARRAY v_user_ids
            LOOP
                INSERT INTO public.document_approval_run_step_assignees (
                    tenant_id, step_id, user_id, is_required
                )
                VALUES (
                    p_tenant_id,
                    v_step_id,
                    v_user_id,
                    v_quorum = 'ALL'
                )
                ON CONFLICT (step_id, user_id) DO NOTHING;
            END LOOP;

            IF v_quorum = 'ALL' THEN
                UPDATE public.document_approval_run_steps
                SET min_approvals = (
                    SELECT COUNT(*)
                    FROM public.document_approval_run_step_assignees a
                    WHERE a.step_id = v_step_id AND a.is_required
                )
                WHERE id = v_step_id;
            END IF;

            v_step_idx := v_step_idx + 1;
        END LOOP;

        v_level_idx := v_level_idx + 1;
    END LOOP;

    IF NOT EXISTS (
        SELECT 1 FROM public.document_approval_run_steps s WHERE s.run_id = v_run_id
    ) THEN
        INSERT INTO public.document_approval_run_steps (
            tenant_id, run_id, level_index, step_index, step_label,
            quorum_mode, min_approvals, status, opened_at
        )
        VALUES (
            p_tenant_id, v_run_id, 0, 0, 'Approvers', 'ANY', 1, 'PENDING', NOW()
        )
        RETURNING id INTO v_step_id;

        v_user_ids := private.pool_user_ids(p_policy, 'default');
        FOREACH v_user_id IN ARRAY v_user_ids
        LOOP
            INSERT INTO public.document_approval_run_step_assignees (
                tenant_id, step_id, user_id, is_required
            )
            VALUES (p_tenant_id, v_step_id, v_user_id, FALSE)
            ON CONFLICT DO NOTHING;
        END LOOP;
    END IF;

    RETURN v_run_id;
END;
$$;

REVOKE ALL ON FUNCTION public.save_tenant_reporting_lines(JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_tenant_reporting_lines(JSONB) TO authenticated;

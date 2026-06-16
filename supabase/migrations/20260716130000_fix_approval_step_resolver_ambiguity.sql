-- ====================================================================
-- Fix ambiguous resolve_approval_step_user_ids overload
-- Migration: 20260716130000_fix_approval_step_resolver_ambiguity.sql
-- ====================================================================

DROP FUNCTION IF EXISTS private.resolve_approval_step_user_ids(uuid, uuid, jsonb, jsonb);

CREATE OR REPLACE FUNCTION private.materialize_sales_approval_run(
    p_tenant_id UUID,
    p_document_type TEXT,
    p_document_id UUID,
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
        p_tenant_id, p_document_type, p_document_id, 'PENDING',
        p_policy, COALESCE(p_amount, 0), COALESCE(p_currency, 'INR'), p_submitter_id
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
                p_tenant_id, v_run_id, v_level_idx, v_step_idx,
                COALESCE(v_step ->> 'label', 'Approval'),
                v_quorum, 1,
                CASE WHEN v_level_idx = 0 THEN 'PENDING' ELSE 'LOCKED' END,
                CASE WHEN v_level_idx = 0 THEN NOW() ELSE NULL END
            )
            RETURNING id INTO v_step_id;

            v_user_ids := private.resolve_approval_step_user_ids(
                p_tenant_id,
                p_submitter_id,
                v_step,
                p_policy,
                NULL,
                FALSE
            );

            IF COALESCE(array_length(v_user_ids, 1), 0) = 0 THEN
                v_user_ids := private.pool_user_ids(p_policy, COALESCE(v_step ->> 'pool', 'default'));
            END IF;

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
                VALUES (p_tenant_id, v_step_id, v_user_id, v_quorum = 'ALL')
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

    RETURN v_run_id;
END;
$$;

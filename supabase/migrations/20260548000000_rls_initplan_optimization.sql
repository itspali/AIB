-- ====================================================================
-- AIB SMART ERP - RLS INITPLAN OPTIMIZATION
-- Migration: 20260548000000_rls_initplan_optimization.sql
-- --------------------------------------------------------------------
-- Performance hardening for Row-Level Security policies flagged by the
-- Supabase performance advisor:
--
--   * auth_rls_initplan          -> auth.uid() was re-evaluated per row.
--                                   Wrapping it in a scalar subquery
--                                   `(select auth.uid())` lets the planner
--                                   evaluate it once per statement (InitPlan).
--   * multiple_permissive_policies -> public.users had several permissive
--                                   policies for the same role/action.
--                                   Consolidated into a single policy each
--                                   for SELECT and UPDATE.
--
-- Semantics are preserved exactly; only evaluation cost changes. The
-- private.current_tenant_id() / private.current_user_role() helpers are
-- STABLE and were not flagged, so they are left untouched.
-- ====================================================================

-- --------------------------------------------------------------------
-- 1. public.users  (consolidate + initplan)
-- --------------------------------------------------------------------
-- SELECT: self OR tenant admin/owner OR active tenant member.
DROP POLICY IF EXISTS users_select_self ON public.users;
DROP POLICY IF EXISTS users_select_admin ON public.users;
DROP POLICY IF EXISTS users_select_tenant ON public.users;

CREATE POLICY users_select ON public.users
    FOR SELECT TO authenticated
    USING (
        (id = (select auth.uid()))
        OR (
            tenant_id = private.current_tenant_id()
            AND private.current_user_role() = ANY (ARRAY['OWNER'::public.user_role, 'ADMIN'::public.user_role])
        )
        OR (
            tenant_id = private.current_tenant_id()
            AND is_active = TRUE
        )
    );

-- UPDATE: self OR tenant admin/owner.
DROP POLICY IF EXISTS users_update_self ON public.users;
DROP POLICY IF EXISTS users_update_admin ON public.users;

CREATE POLICY users_update ON public.users
    FOR UPDATE TO authenticated
    USING (
        (id = (select auth.uid()))
        OR (
            tenant_id = private.current_tenant_id()
            AND private.current_user_role() = ANY (ARRAY['OWNER'::public.user_role, 'ADMIN'::public.user_role])
        )
    )
    WITH CHECK (
        (id = (select auth.uid()))
        OR (
            tenant_id = private.current_tenant_id()
            AND private.current_user_role() = ANY (ARRAY['OWNER'::public.user_role, 'ADMIN'::public.user_role])
        )
    );

-- DELETE: owner may delete tenant members other than themselves.
DROP POLICY IF EXISTS users_delete_owner ON public.users;

CREATE POLICY users_delete_owner ON public.users
    FOR DELETE TO authenticated
    USING (
        tenant_id = private.current_tenant_id()
        AND private.current_user_role() = 'OWNER'::public.user_role
        AND id <> (select auth.uid())
    );

-- --------------------------------------------------------------------
-- 2. public.user_auth_sessions  (initplan)
-- --------------------------------------------------------------------
DROP POLICY IF EXISTS user_auth_sessions_select_self ON public.user_auth_sessions;
CREATE POLICY user_auth_sessions_select_self ON public.user_auth_sessions
    FOR SELECT TO authenticated
    USING (
        user_id = (select auth.uid())
        AND tenant_id = private.current_tenant_id()
    );

DROP POLICY IF EXISTS user_auth_sessions_insert_self ON public.user_auth_sessions;
CREATE POLICY user_auth_sessions_insert_self ON public.user_auth_sessions
    FOR INSERT TO authenticated
    WITH CHECK (
        user_id = (select auth.uid())
        AND tenant_id = private.current_tenant_id()
    );

DROP POLICY IF EXISTS user_auth_sessions_update_self ON public.user_auth_sessions;
CREATE POLICY user_auth_sessions_update_self ON public.user_auth_sessions
    FOR UPDATE TO authenticated
    USING (
        user_id = (select auth.uid())
        AND tenant_id = private.current_tenant_id()
    )
    WITH CHECK (
        user_id = (select auth.uid())
        AND tenant_id = private.current_tenant_id()
    );

DROP POLICY IF EXISTS user_auth_sessions_delete_self ON public.user_auth_sessions;
CREATE POLICY user_auth_sessions_delete_self ON public.user_auth_sessions
    FOR DELETE TO authenticated
    USING (
        user_id = (select auth.uid())
        AND tenant_id = private.current_tenant_id()
    );

-- --------------------------------------------------------------------
-- 3. public.search_telemetry_logs  (initplan)
-- --------------------------------------------------------------------
DROP POLICY IF EXISTS search_telemetry_logs_tenant_insert ON public.search_telemetry_logs;
CREATE POLICY search_telemetry_logs_tenant_insert ON public.search_telemetry_logs
    FOR INSERT TO authenticated
    WITH CHECK (
        tenant_id = private.current_tenant_id()
        AND user_id = (select auth.uid())
    );

DROP POLICY IF EXISTS search_telemetry_logs_tenant_select ON public.search_telemetry_logs;
CREATE POLICY search_telemetry_logs_tenant_select ON public.search_telemetry_logs
    FOR SELECT TO authenticated
    USING (
        tenant_id = private.current_tenant_id()
        AND (
            user_id = (select auth.uid())
            OR private.current_user_role() = ANY (ARRAY['OWNER'::public.user_role, 'ADMIN'::public.user_role])
        )
    );

-- --------------------------------------------------------------------
-- 4. public.search_filter_violations  (initplan)
-- --------------------------------------------------------------------
DROP POLICY IF EXISTS search_filter_violations_tenant_insert ON public.search_filter_violations;
CREATE POLICY search_filter_violations_tenant_insert ON public.search_filter_violations
    FOR INSERT TO authenticated
    WITH CHECK (
        tenant_id = private.current_tenant_id()
        AND user_id = (select auth.uid())
    );

-- --------------------------------------------------------------------
-- 5. public.custom_module_views  (initplan)
-- --------------------------------------------------------------------
DROP POLICY IF EXISTS custom_module_views_owner_all ON public.custom_module_views;
CREATE POLICY custom_module_views_owner_all ON public.custom_module_views
    FOR ALL TO authenticated
    USING (
        tenant_id = private.current_tenant_id()
        AND user_id = (select auth.uid())
    )
    WITH CHECK (
        tenant_id = private.current_tenant_id()
        AND user_id = (select auth.uid())
    );

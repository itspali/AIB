-- ====================================================================
-- AIB SMART ERP - RESOURCE DELETION RPCs
-- Migration: 20260718120000_resource_deletion_rpcs.sql
-- Locations (permanent), tenant groups, workspaces, and user accounts.
-- ====================================================================

CREATE OR REPLACE FUNCTION private.count_tenant_location_references(
    p_location_id UUID,
    p_tenant_id UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_total INTEGER := 0;
BEGIN
    IF p_location_id IS NULL OR p_tenant_id IS NULL THEN
        RETURN 0;
    END IF;

    SELECT
        COALESCE((SELECT COUNT(*) FROM public.item_valuations iv WHERE iv.tenant_id = p_tenant_id AND iv.location_id = p_location_id), 0)
        + COALESCE((SELECT COUNT(*) FROM public.inventory_ledger il WHERE il.tenant_id = p_tenant_id AND il.location_id = p_location_id), 0)
        + COALESCE((SELECT COUNT(*) FROM public.stock_transfers st WHERE st.tenant_id = p_tenant_id AND (st.source_location_id = p_location_id OR st.destination_location_id = p_location_id)), 0)
        + COALESCE((SELECT COUNT(*) FROM public.stock_adjustments sa WHERE sa.tenant_id = p_tenant_id AND sa.location_id = p_location_id), 0)
        + COALESCE((SELECT COUNT(*) FROM public.stock_adjustment_lines sal WHERE sal.tenant_id = p_tenant_id AND sal.location_id = p_location_id), 0)
        + COALESCE((SELECT COUNT(*) FROM public.purchase_orders po WHERE po.tenant_id = p_tenant_id AND (po.destination_location_id = p_location_id OR po.billing_location_id = p_location_id)), 0)
        + COALESCE((SELECT COUNT(*) FROM public.goods_receipts gr WHERE gr.tenant_id = p_tenant_id AND gr.destination_location_id = p_location_id), 0)
        + COALESCE((SELECT COUNT(*) FROM public.purchase_invoices pi WHERE pi.tenant_id = p_tenant_id AND pi.billing_location_id = p_location_id), 0)
        + COALESCE((SELECT COUNT(*) FROM public.sales_quotations sq WHERE sq.tenant_id = p_tenant_id AND sq.origin_location_id = p_location_id), 0)
        + COALESCE((SELECT COUNT(*) FROM public.sales_orders so WHERE so.tenant_id = p_tenant_id AND (so.origin_location_id = p_location_id OR so.shipping_location_id = p_location_id)), 0)
        + COALESCE((SELECT COUNT(*) FROM public.sales_invoices si WHERE si.tenant_id = p_tenant_id AND si.origin_location_id = p_location_id), 0)
        + COALESCE((SELECT COUNT(*) FROM public.sales_returns sr WHERE sr.tenant_id = p_tenant_id AND sr.return_location_id = p_location_id), 0)
        + COALESCE((SELECT COUNT(*) FROM public.sales_inventory_reservations sir WHERE sir.tenant_id = p_tenant_id AND sir.location_id = p_location_id), 0)
        + COALESCE((SELECT COUNT(*) FROM public.user_tenant_memberships m WHERE m.tenant_id = p_tenant_id AND m.assigned_location_id = p_location_id), 0)
    INTO v_total;

    RETURN v_total;
END;
$$;

CREATE OR REPLACE FUNCTION private.delete_tenant_location(p_location_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_tenant_id UUID;
    v_code TEXT;
    v_is_active BOOLEAN;
    v_governance JSONB;
    v_central_hq UUID;
    v_on_hand NUMERIC(15, 4);
BEGIN
    v_tenant_id := private.current_tenant_id();
    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'tenant context missing from session';
    END IF;

    IF NOT private.user_can_manage_tenant_locations() THEN
        RAISE EXCEPTION 'administrative privileges required to manage locations';
    END IF;

    SELECT code, is_active
    INTO v_code, v_is_active
    FROM public.tenant_locations
    WHERE id = p_location_id
      AND tenant_id = v_tenant_id;

    IF v_code IS NULL THEN
        RAISE EXCEPTION 'location not found for tenant';
    END IF;

    IF private.is_system_tenant_location(v_code) THEN
        RAISE EXCEPTION 'system locations cannot be deleted';
    END IF;

    v_governance := private.get_location_governance_config(v_tenant_id);
    v_central_hq := NULLIF(v_governance ->> 'central_hq_location_id', '')::uuid;

    IF v_central_hq = p_location_id THEN
        RAISE EXCEPTION 'cannot delete the central HQ location; reassign central HQ first';
    END IF;

    IF v_is_active THEN
        RAISE EXCEPTION 'deactivate the location before permanent deletion';
    END IF;

    SELECT COALESCE(SUM(current_quantity_on_hand), 0)
    INTO v_on_hand
    FROM public.item_valuations
    WHERE tenant_id = v_tenant_id
      AND location_id = p_location_id;

    IF v_on_hand > 0 THEN
        RAISE EXCEPTION 'cannot delete location with on-hand inventory';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.stock_transfers
        WHERE tenant_id = v_tenant_id
          AND current_status NOT IN ('FULLY_COMPLETED', 'CANCELLED')
          AND (source_location_id = p_location_id OR destination_location_id = p_location_id)
    ) THEN
        RAISE EXCEPTION 'cannot delete location with open stock transfers';
    END IF;

    IF private.count_tenant_location_references(p_location_id, v_tenant_id) > 0 THEN
        RAISE EXCEPTION 'LOCATION_IN_USE: location is referenced by transactions and cannot be deleted';
    END IF;

    DELETE FROM public.tenant_locations
    WHERE id = p_location_id
      AND tenant_id = v_tenant_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_tenant_location(p_location_id UUID)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, private
AS $$
    SELECT private.delete_tenant_location(p_location_id);
$$;

CREATE OR REPLACE FUNCTION private.delete_tenant_group(p_group_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, private
AS $$
BEGIN
    IF p_group_id IS NULL THEN
        RAISE EXCEPTION 'group id is required';
    END IF;

    IF NOT private.user_is_group_admin(p_group_id) THEN
        RAISE EXCEPTION 'group admin privileges required';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.tenant_group_memberships tgm
        WHERE tgm.group_id = p_group_id
          AND tgm.status IN ('ACTIVE', 'SUSPENDED', 'EXIT_PENDING')
    ) THEN
        RAISE EXCEPTION 'remove or exit all organizations before deleting the group';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.group_organization_invitations i
        WHERE i.group_id = p_group_id
          AND i.status = 'PENDING'
    ) THEN
        RAISE EXCEPTION 'revoke pending group invitations before deleting the group';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.tenants t
        WHERE t.group_id = p_group_id
    ) THEN
        RAISE EXCEPTION 'detach all organizations from the group before deleting it';
    END IF;

    PERFORM private.log_group_membership_event(
        p_group_id,
        NULL,
        'GROUP_DELETED',
        jsonb_build_object('deleted_by_user_id', auth.uid())
    );

    DELETE FROM public.tenant_groups
    WHERE id = p_group_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_tenant_group(p_group_id UUID)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, private
AS $$
    SELECT private.delete_tenant_group(p_group_id);
$$;

CREATE OR REPLACE FUNCTION private.delete_tenant_workspace(p_confirmation_name TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, private
AS $$
DECLARE
    v_tenant_id UUID;
    v_name TEXT;
    v_trade_name TEXT;
    v_legal_name TEXT;
    v_group_id UUID;
    v_next_tenant_id UUID;
    v_confirmation TEXT;
BEGIN
    v_tenant_id := private.current_tenant_id();
    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'tenant context missing from session';
    END IF;

    IF private.current_user_role() <> 'OWNER'::public.user_role THEN
        RAISE EXCEPTION 'workspace owner privileges required';
    END IF;

    v_confirmation := lower(btrim(COALESCE(p_confirmation_name, '')));
    IF v_confirmation = '' THEN
        RAISE EXCEPTION 'workspace name confirmation is required';
    END IF;

    SELECT t.name, t.trade_name, t.legal_name, t.group_id
    INTO v_name, v_trade_name, v_legal_name, v_group_id
    FROM public.tenants t
    WHERE t.id = v_tenant_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'workspace not found';
    END IF;

    IF v_confirmation NOT IN (
        lower(btrim(v_name)),
        lower(btrim(COALESCE(v_trade_name, ''))),
        lower(btrim(COALESCE(v_legal_name, '')))
    ) THEN
        RAISE EXCEPTION 'workspace name confirmation does not match';
    END IF;

    IF v_group_id IS NOT NULL AND EXISTS (
        SELECT 1
        FROM public.tenant_group_memberships tgm
        WHERE tgm.group_id = v_group_id
          AND tgm.tenant_id = v_tenant_id
          AND tgm.status IN ('ACTIVE', 'SUSPENDED', 'EXIT_PENDING')
    ) THEN
        RAISE EXCEPTION 'leave the enterprise group before deleting this workspace';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.stock_transfers st
        WHERE st.tenant_id = v_tenant_id
          AND st.current_status = 'DISPATCHED_IN_TRANSIT'
    ) THEN
        RAISE EXCEPTION 'cannot delete workspace while stock is in transit';
    END IF;

    SELECT m.tenant_id
    INTO v_next_tenant_id
    FROM public.user_tenant_memberships m
    WHERE m.user_id = auth.uid()
      AND m.is_active = TRUE
      AND m.tenant_id <> v_tenant_id
    ORDER BY m.created_at
    LIMIT 1;

    DELETE FROM public.tenants
    WHERE id = v_tenant_id;

    IF v_next_tenant_id IS NOT NULL THEN
        PERFORM private.switch_active_tenant_membership(v_next_tenant_id);
    END IF;

    RETURN jsonb_build_object(
        'deleted_tenant_id', v_tenant_id,
        'switched_to_tenant_id', v_next_tenant_id
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_tenant_workspace(p_confirmation_name TEXT)
RETURNS JSONB
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, private
AS $$
    SELECT private.delete_tenant_workspace(p_confirmation_name);
$$;

CREATE OR REPLACE FUNCTION private.delete_my_user_account()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, private
AS $$
DECLARE
    v_user_id UUID;
    v_membership RECORD;
    v_other_members INTEGER;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'authentication required';
    END IF;

    FOR v_membership IN
        SELECT m.tenant_id, m.role
        FROM public.user_tenant_memberships m
        WHERE m.user_id = v_user_id
          AND m.is_active = TRUE
    LOOP
        IF v_membership.role = 'OWNER'::public.user_role THEN
            SELECT COUNT(*)
            INTO v_other_members
            FROM public.user_tenant_memberships m2
            WHERE m2.tenant_id = v_membership.tenant_id
              AND m2.is_active = TRUE
              AND m2.user_id <> v_user_id;

            IF v_other_members > 0 THEN
                RAISE EXCEPTION
                    'transfer workspace ownership or remove team members before deleting your account';
            END IF;
        END IF;
    END LOOP;

    FOR v_membership IN
        SELECT m.tenant_id, m.role
        FROM public.user_tenant_memberships m
        WHERE m.user_id = v_user_id
          AND m.is_active = TRUE
          AND m.role = 'OWNER'::public.user_role
    LOOP
        IF EXISTS (
            SELECT 1
            FROM public.tenants t
            WHERE t.id = v_membership.tenant_id
              AND t.group_id IS NOT NULL
        ) AND EXISTS (
            SELECT 1
            FROM public.tenant_group_memberships tgm
            WHERE tgm.tenant_id = v_membership.tenant_id
              AND tgm.status IN ('ACTIVE', 'SUSPENDED', 'EXIT_PENDING')
        ) THEN
            RAISE EXCEPTION 'leave the enterprise group before deleting your account';
        END IF;

        IF EXISTS (
            SELECT 1
            FROM public.stock_transfers st
            WHERE st.tenant_id = v_membership.tenant_id
              AND st.current_status = 'DISPATCHED_IN_TRANSIT'
        ) THEN
            RAISE EXCEPTION 'cannot delete account while workspace stock is in transit';
        END IF;

        DELETE FROM public.tenants
        WHERE id = v_membership.tenant_id;
    END LOOP;

    DELETE FROM public.user_tenant_memberships
    WHERE user_id = v_user_id;

    DELETE FROM public.group_memberships
    WHERE user_id = v_user_id;

    DELETE FROM public.users
    WHERE id = v_user_id;

    RETURN jsonb_build_object('deleted_user_id', v_user_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_my_user_account()
RETURNS JSONB
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, private
AS $$
    SELECT private.delete_my_user_account();
$$;

REVOKE ALL ON FUNCTION public.delete_tenant_location(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_tenant_location(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.delete_tenant_group(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_tenant_group(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.delete_tenant_workspace(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_tenant_workspace(TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.delete_my_user_account() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_my_user_account() TO authenticated;

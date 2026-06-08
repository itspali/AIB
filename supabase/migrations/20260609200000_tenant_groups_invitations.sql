-- ====================================================================
-- AIB SMART ERP - TENANT GROUP INVITATIONS & SUSPENSION (Task Sequence 22 Phase 2)
-- Migration: 20260609200000_tenant_groups_invitations.sql
-- ====================================================================

CREATE TYPE public.group_organization_invitation_status AS ENUM (
    'PENDING', 'ACCEPTED', 'REJECTED', 'REVOKED', 'EXPIRED'
);

CREATE TABLE public.group_organization_invitations (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id            UUID NOT NULL REFERENCES public.tenant_groups (id) ON DELETE CASCADE,
    tenant_id           UUID NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
    status              public.group_organization_invitation_status NOT NULL DEFAULT 'PENDING',
    message             TEXT,
    invited_by_user_id  UUID REFERENCES public.users (id) ON DELETE SET NULL,
    responded_by_user_id UUID REFERENCES public.users (id) ON DELETE SET NULL,
    responded_at        TIMESTAMPTZ,
    expires_at          TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '14 days'),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX group_organization_invitations_pending_unique
    ON public.group_organization_invitations (group_id, tenant_id)
    WHERE status = 'PENDING';

CREATE INDEX group_organization_invitations_tenant_pending_idx
    ON public.group_organization_invitations (tenant_id)
    WHERE status = 'PENDING';

CREATE TRIGGER group_organization_invitations_set_updated_at
    BEFORE UPDATE ON public.group_organization_invitations
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.group_organization_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY group_organization_invitations_select_scope
    ON public.group_organization_invitations
    FOR SELECT
    TO authenticated
    USING (
        private.user_is_group_member(group_id)
        OR (
            tenant_id = private.current_tenant_id()
            AND private.current_user_role() = 'OWNER'::public.user_role
        )
    );

-- 1. INVITE
CREATE OR REPLACE FUNCTION private.invite_organization_to_group(
    p_group_id UUID,
    p_tenant_id UUID,
    p_message TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, private
AS $$
DECLARE
    v_invitation_id UUID;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'authentication required';
    END IF;

    IF NOT private.user_is_group_admin(p_group_id) THEN
        RAISE EXCEPTION 'group admin access required';
    END IF;

    IF p_tenant_id IS NULL THEN
        RAISE EXCEPTION 'tenant_id is required';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.tenants t
        WHERE t.id = p_tenant_id
          AND t.group_id IS NOT NULL
    ) THEN
        RAISE EXCEPTION 'organization already belongs to a group';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.group_organization_invitations i
        WHERE i.group_id = p_group_id
          AND i.tenant_id = p_tenant_id
          AND i.status = 'PENDING'
          AND i.expires_at > NOW()
    ) THEN
        RAISE EXCEPTION 'a pending invitation already exists for this organization';
    END IF;

    INSERT INTO public.group_organization_invitations (
        group_id,
        tenant_id,
        message,
        invited_by_user_id
    )
    VALUES (
        p_group_id,
        p_tenant_id,
        NULLIF(btrim(p_message), ''),
        auth.uid()
    )
    RETURNING id INTO v_invitation_id;

    PERFORM private.log_group_membership_event(
        p_group_id,
        p_tenant_id,
        'ORG_INVITED',
        jsonb_build_object('invitation_id', v_invitation_id)
    );

    RETURN v_invitation_id;
END;
$$;

-- 2. LIST PENDING FOR CURRENT TENANT
CREATE OR REPLACE FUNCTION private.list_pending_group_invitations_for_tenant()
RETURNS TABLE (
    invitation_id UUID,
    group_id UUID,
    group_name TEXT,
    message TEXT,
    invited_by_name TEXT,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, private
AS $$
DECLARE
    v_tenant_id UUID;
BEGIN
    v_tenant_id := private.current_tenant_id();
    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'tenant context missing from session';
    END IF;

    IF private.current_user_role() <> 'OWNER'::public.user_role THEN
        RAISE EXCEPTION 'organization owner required';
    END IF;

    RETURN QUERY
    SELECT
        i.id,
        i.group_id,
        g.name,
        i.message,
        NULLIF(btrim(COALESCE(u.first_name, '') || ' ' || COALESCE(u.last_name, '')), ''),
        i.expires_at,
        i.created_at
    FROM public.group_organization_invitations i
    JOIN public.tenant_groups g ON g.id = i.group_id
    LEFT JOIN public.users u ON u.id = i.invited_by_user_id
    WHERE i.tenant_id = v_tenant_id
      AND i.status = 'PENDING'
      AND i.expires_at > NOW()
    ORDER BY i.created_at DESC;
END;
$$;

-- 3. ACCEPT
CREATE OR REPLACE FUNCTION private.accept_group_organization_invitation(p_invitation_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, private
AS $$
DECLARE
    v_invitation public.group_organization_invitations%ROWTYPE;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'authentication required';
    END IF;

    SELECT *
    INTO v_invitation
    FROM public.group_organization_invitations
    WHERE id = p_invitation_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'invitation not found';
    END IF;

    IF v_invitation.status <> 'PENDING' OR v_invitation.expires_at <= NOW() THEN
        RAISE EXCEPTION 'invitation is not pending';
    END IF;

    IF private.current_tenant_id() IS DISTINCT FROM v_invitation.tenant_id THEN
        RAISE EXCEPTION 'invitation does not belong to active organization';
    END IF;

    IF private.current_user_role() <> 'OWNER'::public.user_role THEN
        RAISE EXCEPTION 'organization owner required';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.tenants t
        WHERE t.id = v_invitation.tenant_id
          AND t.group_id IS NOT NULL
    ) THEN
        RAISE EXCEPTION 'organization already belongs to a group';
    END IF;

    UPDATE public.tenants
    SET group_id = v_invitation.group_id, updated_at = NOW()
    WHERE id = v_invitation.tenant_id;

    INSERT INTO public.tenant_group_memberships (
        group_id, tenant_id, status, joined_by_user_id
    )
    VALUES (v_invitation.group_id, v_invitation.tenant_id, 'ACTIVE', auth.uid());

    UPDATE public.group_organization_invitations
    SET
        status = 'ACCEPTED',
        responded_by_user_id = auth.uid(),
        responded_at = NOW(),
        updated_at = NOW()
    WHERE id = p_invitation_id;

    PERFORM private.patch_auth_active_membership(
        auth.uid(),
        v_invitation.tenant_id,
        private.current_user_role(),
        private.current_assigned_location_id(),
        v_invitation.group_id
    );

    PERFORM private.log_group_membership_event(
        v_invitation.group_id,
        v_invitation.tenant_id,
        'ORG_JOINED',
        jsonb_build_object('invitation_id', p_invitation_id, 'source', 'invitation_accept')
    );
END;
$$;

-- 4. REJECT
CREATE OR REPLACE FUNCTION private.reject_group_organization_invitation(p_invitation_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, private
AS $$
DECLARE
    v_invitation public.group_organization_invitations%ROWTYPE;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'authentication required';
    END IF;

    SELECT *
    INTO v_invitation
    FROM public.group_organization_invitations
    WHERE id = p_invitation_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'invitation not found';
    END IF;

    IF v_invitation.status <> 'PENDING' THEN
        RAISE EXCEPTION 'invitation is not pending';
    END IF;

    IF private.current_tenant_id() IS DISTINCT FROM v_invitation.tenant_id THEN
        RAISE EXCEPTION 'invitation does not belong to active organization';
    END IF;

    IF private.current_user_role() <> 'OWNER'::public.user_role THEN
        RAISE EXCEPTION 'organization owner required';
    END IF;

    UPDATE public.group_organization_invitations
    SET
        status = 'REJECTED',
        responded_by_user_id = auth.uid(),
        responded_at = NOW(),
        updated_at = NOW()
    WHERE id = p_invitation_id;

    PERFORM private.log_group_membership_event(
        v_invitation.group_id,
        v_invitation.tenant_id,
        'ORG_INVITE_REJECTED',
        jsonb_build_object('invitation_id', p_invitation_id)
    );
END;
$$;

-- 5. REVOKE (group admin)
CREATE OR REPLACE FUNCTION private.revoke_group_organization_invitation(p_invitation_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, private
AS $$
DECLARE
    v_invitation public.group_organization_invitations%ROWTYPE;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'authentication required';
    END IF;

    SELECT *
    INTO v_invitation
    FROM public.group_organization_invitations
    WHERE id = p_invitation_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'invitation not found';
    END IF;

    IF v_invitation.status <> 'PENDING' THEN
        RAISE EXCEPTION 'invitation is not pending';
    END IF;

    IF NOT private.user_is_group_admin(v_invitation.group_id) THEN
        RAISE EXCEPTION 'group admin access required';
    END IF;

    UPDATE public.group_organization_invitations
    SET status = 'REVOKED', updated_at = NOW()
    WHERE id = p_invitation_id;

    PERFORM private.log_group_membership_event(
        v_invitation.group_id,
        v_invitation.tenant_id,
        'ORG_INVITE_REVOKED',
        jsonb_build_object('invitation_id', p_invitation_id)
    );
END;
$$;

-- 6. SUSPEND / REINSTATE
CREATE OR REPLACE FUNCTION private.suspend_group_organization(
    p_tenant_id UUID,
    p_reason TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, private
AS $$
DECLARE
    v_group_id UUID;
    v_membership_id UUID;
BEGIN
    v_group_id := (SELECT group_id FROM public.tenants WHERE id = p_tenant_id);

    IF v_group_id IS NULL THEN
        RAISE EXCEPTION 'organization is not part of a group';
    END IF;

    IF NOT private.user_is_group_admin(v_group_id) THEN
        RAISE EXCEPTION 'group admin access required';
    END IF;

    SELECT tgm.id
    INTO v_membership_id
    FROM public.tenant_group_memberships tgm
    WHERE tgm.group_id = v_group_id
      AND tgm.tenant_id = p_tenant_id
      AND tgm.status = 'ACTIVE';

    IF v_membership_id IS NULL THEN
        RAISE EXCEPTION 'active group membership not found';
    END IF;

    UPDATE public.tenant_group_memberships
    SET
        status = 'SUSPENDED',
        exit_reason = NULLIF(btrim(p_reason), ''),
        updated_at = NOW()
    WHERE id = v_membership_id;

    PERFORM private.log_group_membership_event(
        v_group_id,
        p_tenant_id,
        'ORG_SUSPENDED',
        jsonb_build_object('reason', p_reason)
    );
END;
$$;

CREATE OR REPLACE FUNCTION private.reinstate_group_organization(p_tenant_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, private
AS $$
DECLARE
    v_group_id UUID;
    v_membership_id UUID;
BEGIN
    v_group_id := (SELECT group_id FROM public.tenants WHERE id = p_tenant_id);

    IF v_group_id IS NULL THEN
        RAISE EXCEPTION 'organization is not part of a group';
    END IF;

    IF NOT private.user_is_group_admin(v_group_id) THEN
        RAISE EXCEPTION 'group admin access required';
    END IF;

    SELECT tgm.id
    INTO v_membership_id
    FROM public.tenant_group_memberships tgm
    WHERE tgm.group_id = v_group_id
      AND tgm.tenant_id = p_tenant_id
      AND tgm.status = 'SUSPENDED';

    IF v_membership_id IS NULL THEN
        RAISE EXCEPTION 'suspended group membership not found';
    END IF;

    UPDATE public.tenant_group_memberships
    SET status = 'ACTIVE', exit_reason = NULL, updated_at = NOW()
    WHERE id = v_membership_id;

    PERFORM private.log_group_membership_event(
        v_group_id,
        p_tenant_id,
        'ORG_REINSTATED',
        NULL
    );
END;
$$;

-- 7. PUBLIC WRAPPERS
CREATE OR REPLACE FUNCTION public.invite_organization_to_group(
    p_group_id UUID,
    p_tenant_id UUID,
    p_message TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, private
AS $$
    SELECT private.invite_organization_to_group(p_group_id, p_tenant_id, p_message);
$$;

CREATE OR REPLACE FUNCTION public.list_pending_group_invitations_for_tenant()
RETURNS TABLE (
    invitation_id UUID,
    group_id UUID,
    group_name TEXT,
    message TEXT,
    invited_by_name TEXT,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, private
AS $$
    SELECT * FROM private.list_pending_group_invitations_for_tenant();
$$;

CREATE OR REPLACE FUNCTION public.accept_group_organization_invitation(p_invitation_id UUID)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, private
AS $$
    SELECT private.accept_group_organization_invitation(p_invitation_id);
$$;

CREATE OR REPLACE FUNCTION public.reject_group_organization_invitation(p_invitation_id UUID)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, private
AS $$
    SELECT private.reject_group_organization_invitation(p_invitation_id);
$$;

CREATE OR REPLACE FUNCTION public.revoke_group_organization_invitation(p_invitation_id UUID)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, private
AS $$
    SELECT private.revoke_group_organization_invitation(p_invitation_id);
$$;

CREATE OR REPLACE FUNCTION public.suspend_group_organization(p_tenant_id UUID, p_reason TEXT DEFAULT NULL)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, private
AS $$
    SELECT private.suspend_group_organization(p_tenant_id, p_reason);
$$;

CREATE OR REPLACE FUNCTION public.reinstate_group_organization(p_tenant_id UUID)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, private
AS $$
    SELECT private.reinstate_group_organization(p_tenant_id);
$$;

REVOKE ALL ON FUNCTION public.invite_organization_to_group(UUID, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.invite_organization_to_group(UUID, UUID, TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.list_pending_group_invitations_for_tenant() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_pending_group_invitations_for_tenant() TO authenticated;

REVOKE ALL ON FUNCTION public.accept_group_organization_invitation(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_group_organization_invitation(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.reject_group_organization_invitation(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reject_group_organization_invitation(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.revoke_group_organization_invitation(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.revoke_group_organization_invitation(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.suspend_group_organization(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.suspend_group_organization(UUID, TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.reinstate_group_organization(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reinstate_group_organization(UUID) TO authenticated;

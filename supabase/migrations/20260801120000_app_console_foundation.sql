-- Bootstrap first console operator (run manually after migration):
-- INSERT INTO public.app_console_operators (user_id, email, role, mfa_enforced, notes)
-- SELECT id, lower(email), 'ADMIN', TRUE, 'Bootstrap operator'
-- FROM auth.users WHERE email = 'you@example.com'
-- ON CONFLICT (user_id) DO NOTHING;

CREATE TYPE public.app_console_role AS ENUM ('VIEWER', 'OPERATOR', 'ADMIN');

CREATE TYPE public.app_console_action AS ENUM (
    'TENANT_VIEW',
    'TENANT_SUSPEND',
    'TENANT_REACTIVATE',
    'TENANT_STATUS_UPDATE',
    'ONBOARDING_FORCE_STATUS',
    'USER_DEACTIVATE',
    'USER_REACTIVATE',
    'AUTH_EMAIL_CONFIRM',
    'AUTH_PASSWORD_RESET',
    'SIGNUP_RETRY_PROVISION',
    'IMPERSONATION_START',
    'IMPERSONATION_END',
    'GROUP_VIEW',
    'GROUP_SUSPEND',
    'PLATFORM_CONFIG_UPDATE',
    'INTERNAL_ADMIN_GRANT',
    'INTERNAL_ADMIN_REVOKE',
    'MFA_ENROLL',
    'MFA_VERIFY_SUCCESS',
    'MFA_VERIFY_FAILED',
    'PLAN_CREATE',
    'PLAN_UPDATE',
    'PLAN_ARCHIVE',
    'SUBSCRIPTION_ASSIGN',
    'SUBSCRIPTION_CHANGE_PLAN',
    'TRIAL_EXTEND',
    'TRIAL_CONVERT',
    'TRIAL_END',
    'SUBSCRIPTION_CANCEL',
    'SUBSCRIPTION_MARK_PAST_DUE'
);

CREATE TABLE public.app_console_operators (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL UNIQUE REFERENCES auth.users (id) ON DELETE CASCADE,
    email           TEXT NOT NULL,
    role            public.app_console_role NOT NULL DEFAULT 'VIEWER',
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    mfa_enforced    BOOLEAN NOT NULL DEFAULT TRUE,
    granted_by      UUID REFERENCES auth.users (id) ON DELETE SET NULL,
    granted_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revoked_at      TIMESTAMPTZ,
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT app_console_operators_email_lowercase_chk CHECK (email = lower(email))
);

CREATE TRIGGER app_console_operators_set_updated_at
    BEFORE UPDATE ON public.app_console_operators
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.app_console_audit_log (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    operator_id     UUID NOT NULL REFERENCES public.app_console_operators (id),
    operator_email  TEXT NOT NULL,
    action          public.app_console_action NOT NULL,
    target_type     TEXT NOT NULL,
    target_id       TEXT,
    tenant_id       UUID REFERENCES public.tenants (id) ON DELETE SET NULL,
    payload         JSONB NOT NULL DEFAULT '{}'::jsonb,
    ip_address      INET,
    user_agent      TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX app_console_audit_log_created_at_idx
    ON public.app_console_audit_log (created_at DESC);

CREATE INDEX app_console_audit_log_tenant_id_idx
    ON public.app_console_audit_log (tenant_id)
    WHERE tenant_id IS NOT NULL;

CREATE TABLE public.app_console_impersonation_sessions (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    operator_id      UUID NOT NULL REFERENCES public.app_console_operators (id),
    target_tenant_id UUID NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
    target_user_id   UUID REFERENCES auth.users (id) ON DELETE SET NULL,
    mode             TEXT NOT NULL DEFAULT 'READ_ONLY'
        CHECK (mode IN ('READ_ONLY', 'WRITE')),
    reason           TEXT NOT NULL,
    started_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at       TIMESTAMPTZ NOT NULL,
    ended_at         TIMESTAMPTZ,
    ended_by         UUID REFERENCES auth.users (id) ON DELETE SET NULL
);

CREATE TABLE public.platform_config (
    key         TEXT PRIMARY KEY,
    value       JSONB NOT NULL,
    updated_by  UUID REFERENCES auth.users (id) ON DELETE SET NULL,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.platform_config (key, value) VALUES
    ('signup_enabled', 'true'::jsonb),
    ('maintenance_mode', 'false'::jsonb),
    ('console_mfa_required', 'true'::jsonb),
    ('trial_expiry_action', '"SUSPEND"'::jsonb)
ON CONFLICT (key) DO NOTHING;

ALTER TABLE public.app_console_operators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_console_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_console_impersonation_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_config ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION private.is_app_console_operator()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.app_console_operators o
        WHERE o.user_id = auth.uid()
          AND o.is_active = TRUE
          AND o.revoked_at IS NULL
    );
$$;

CREATE OR REPLACE FUNCTION private.app_console_role()
RETURNS public.app_console_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
    SELECT o.role
    FROM public.app_console_operators o
    WHERE o.user_id = auth.uid()
      AND o.is_active = TRUE
      AND o.revoked_at IS NULL
    LIMIT 1;
$$;

-- Subscription plans (Phase 5)
CREATE TYPE public.subscription_plan_interval AS ENUM ('MONTHLY', 'YEARLY');

CREATE TYPE public.tenant_subscription_status AS ENUM (
    'TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELED', 'EXPIRED'
);

CREATE TABLE public.subscription_plans (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code                VARCHAR(40) NOT NULL UNIQUE,
    name                TEXT NOT NULL,
    description         TEXT,
    price_amount        NUMERIC(15, 4) NOT NULL DEFAULT 0,
    price_currency      VARCHAR(3) NOT NULL DEFAULT 'USD',
    billing_interval    public.subscription_plan_interval NOT NULL DEFAULT 'MONTHLY',
    trial_days          INT NOT NULL DEFAULT 14,
    limits_json         JSONB NOT NULL DEFAULT '{}'::jsonb,
    features_json       JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    is_public           BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order          INT NOT NULL DEFAULT 0,
    stripe_product_id   TEXT,
    stripe_price_id     TEXT,
    metadata_json       JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER subscription_plans_set_updated_at
    BEFORE UPDATE ON public.subscription_plans
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.tenant_subscriptions (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL UNIQUE REFERENCES public.tenants (id) ON DELETE CASCADE,
    plan_id                 UUID NOT NULL REFERENCES public.subscription_plans (id),
    status                  public.tenant_subscription_status NOT NULL DEFAULT 'TRIALING',
    trial_started_at        TIMESTAMPTZ,
    trial_ends_at           TIMESTAMPTZ,
    current_period_start    TIMESTAMPTZ,
    current_period_end      TIMESTAMPTZ,
    canceled_at             TIMESTAMPTZ,
    stripe_customer_id      TEXT,
    stripe_subscription_id  TEXT,
    assigned_by             UUID REFERENCES auth.users (id) ON DELETE SET NULL,
    metadata_json           JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER tenant_subscriptions_set_updated_at
    BEFORE UPDATE ON public.tenant_subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_subscriptions ENABLE ROW LEVEL SECURITY;

INSERT INTO public.subscription_plans (code, name, description, trial_days, sort_order)
VALUES
    ('TRIAL', 'Trial', 'Default trial workspace', 14, 0),
    ('STARTER', 'Starter', 'Entry paid tier', 0, 1),
    ('GROWTH', 'Growth', 'Mid tier', 0, 2)
ON CONFLICT (code) DO NOTHING;

CREATE OR REPLACE FUNCTION private.sync_tenant_access_from_subscription(p_tenant_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_sub public.tenant_subscriptions%ROWTYPE;
BEGIN
    SELECT * INTO v_sub
    FROM public.tenant_subscriptions
    WHERE tenant_id = p_tenant_id;

    IF NOT FOUND THEN
        RETURN;
    END IF;

    UPDATE public.tenants t
    SET
        status = CASE v_sub.status
            WHEN 'TRIALING' THEN 'TRIAL'::public.tenant_account_status
            WHEN 'ACTIVE' THEN 'ACTIVE'::public.tenant_account_status
            WHEN 'PAST_DUE' THEN 'PAST_DUE'::public.tenant_account_status
            WHEN 'CANCELED' THEN 'SUSPENDED'::public.tenant_account_status
            WHEN 'EXPIRED' THEN 'SUSPENDED'::public.tenant_account_status
            ELSE t.status
        END,
        is_active = CASE
            WHEN v_sub.status IN ('CANCELED', 'EXPIRED') THEN FALSE
            ELSE TRUE
        END,
        updated_at = NOW()
    WHERE t.id = p_tenant_id;
END;
$$;

CREATE OR REPLACE FUNCTION private.seed_tenant_trial_subscription(p_tenant_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_plan_id UUID;
    v_trial_days INT;
BEGIN
    SELECT id, trial_days
    INTO v_plan_id, v_trial_days
    FROM public.subscription_plans
    WHERE code = 'TRIAL' AND is_active = TRUE
    LIMIT 1;

    IF v_plan_id IS NULL THEN
        RETURN;
    END IF;

    INSERT INTO public.tenant_subscriptions (
        tenant_id,
        plan_id,
        status,
        trial_started_at,
        trial_ends_at
    )
    VALUES (
        p_tenant_id,
        v_plan_id,
        'TRIALING',
        NOW(),
        NOW() + (v_trial_days || ' days')::INTERVAL
    )
    ON CONFLICT (tenant_id) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION private.initialize_new_tenant(
    company_name TEXT,
    admin_name TEXT,
    user_email TEXT,
    auth_user_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, private
AS $$
DECLARE
    v_tenant_id UUID;
    v_first_name TEXT;
    v_last_name TEXT;
    v_normalized_email TEXT;
    v_existing_tenant_id UUID;
BEGIN
    IF auth.uid() IS NULL OR auth.uid() IS DISTINCT FROM auth_user_id THEN
        RAISE EXCEPTION 'unauthorized: caller must match auth_user_id';
    END IF;

    IF company_name IS NULL OR btrim(company_name) = '' THEN
        RAISE EXCEPTION 'company_name is required';
    END IF;

    IF admin_name IS NULL OR btrim(admin_name) = '' THEN
        RAISE EXCEPTION 'admin_name is required';
    END IF;

    IF user_email IS NULL OR btrim(user_email) = '' THEN
        RAISE EXCEPTION 'user_email is required';
    END IF;

    v_normalized_email := lower(btrim(user_email));

    SELECT tenant_id
    INTO v_existing_tenant_id
    FROM public.users
    WHERE id = auth_user_id;

    IF v_existing_tenant_id IS NOT NULL THEN
        RETURN v_existing_tenant_id;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = auth_user_id) THEN
        RAISE EXCEPTION 'auth user % does not exist', auth_user_id;
    END IF;

    v_first_name := btrim(split_part(btrim(admin_name), ' ', 1));
    v_last_name := NULLIF(btrim(substring(btrim(admin_name) FROM position(' ' IN btrim(admin_name)) + 1)), '');

    IF v_last_name IS NULL THEN
        v_last_name := v_first_name;
    END IF;

    INSERT INTO public.tenants (
        name,
        primary_email,
        primary_phone,
        onboarding_source,
        onboarding_status
    )
    VALUES (
        btrim(company_name),
        v_normalized_email,
        'PENDING',
        'DIRECT_SAAS',
        'ACCOUNT_CREATED'
    )
    RETURNING id INTO v_tenant_id;

    INSERT INTO public.users (
        id,
        tenant_id,
        role,
        assigned_location_id,
        first_name,
        last_name,
        email
    )
    VALUES (
        auth_user_id,
        v_tenant_id,
        'OWNER',
        NULL,
        v_first_name,
        v_last_name,
        v_normalized_email
    );

    UPDATE auth.users
    SET
        raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object(
            'tenant_id', v_tenant_id,
            'role', 'OWNER',
            'first_name', v_first_name,
            'last_name', v_last_name
        ),
        raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) - 'signup_pending'
    WHERE id = auth_user_id;

    UPDATE public.tenants
    SET created_by_user_id = auth_user_id
    WHERE id = v_tenant_id;

    PERFORM private.seed_tenant_trial_subscription(v_tenant_id);

    RETURN v_tenant_id;
END;
$$;

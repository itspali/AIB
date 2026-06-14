-- ====================================================================
-- Notification templates: Email, SMS, WhatsApp (no delivery providers)
-- Migration: 20260625100000_notification_templates_foundation.sql
-- ====================================================================

CREATE TYPE public.notification_channel AS ENUM ('EMAIL', 'SMS', 'WHATSAPP');

-- --------------------------------------------------------------------
-- 1. System default catalog (global, immutable via app)
-- --------------------------------------------------------------------
CREATE TABLE public.notification_template_system_defaults (
    template_key                    TEXT NOT NULL,
    channel                         public.notification_channel NOT NULL,
    locale                          VARCHAR(10) NOT NULL DEFAULT 'en-US',
    event_code                      TEXT NOT NULL,
    document_domain                 TEXT NOT NULL,
    label                           TEXT NOT NULL,
    description                     TEXT,
    subject_template                TEXT,
    body_template                   TEXT NOT NULL,
    body_template_html              TEXT,
    whatsapp_provider_template_name TEXT,
    whatsapp_param_mapping          JSONB NOT NULL DEFAULT '[]'::jsonb,
    PRIMARY KEY (template_key, channel, locale),
    CONSTRAINT notification_template_system_defaults_domain_chk
        CHECK (document_domain IN ('PROCUREMENT', 'SALES', 'CREDIT'))
);

-- --------------------------------------------------------------------
-- 2. Tenant-customizable templates
-- --------------------------------------------------------------------
CREATE TABLE public.notification_templates (
    id                              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id                       UUID NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
    template_key                    TEXT NOT NULL,
    channel                         public.notification_channel NOT NULL,
    locale                          VARCHAR(10) NOT NULL DEFAULT 'en-US',
    event_code                      TEXT NOT NULL,
    document_domain                 TEXT NOT NULL,
    label                           TEXT NOT NULL,
    description                     TEXT,
    subject_template                TEXT,
    body_template                   TEXT NOT NULL,
    body_template_html              TEXT,
    whatsapp_provider_template_name TEXT,
    whatsapp_param_mapping          JSONB NOT NULL DEFAULT '[]'::jsonb,
    is_active                       BOOLEAN NOT NULL DEFAULT TRUE,
    is_customized                   BOOLEAN NOT NULL DEFAULT FALSE,
    created_at                      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, template_key, channel, locale),
    CONSTRAINT notification_templates_domain_chk
        CHECK (document_domain IN ('PROCUREMENT', 'SALES', 'CREDIT'))
);

CREATE INDEX notification_templates_tenant_domain_idx
    ON public.notification_templates (tenant_id, document_domain);

ALTER TABLE public.notification_template_system_defaults ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY notification_template_system_defaults_select
    ON public.notification_template_system_defaults
    FOR SELECT
    TO authenticated
    USING (TRUE);

CREATE POLICY notification_templates_tenant_isolation
    ON public.notification_templates
    FOR ALL
    TO authenticated
    USING (tenant_id = private.current_tenant_id())
    WITH CHECK (tenant_id = private.current_tenant_id());

REVOKE INSERT, UPDATE, DELETE ON public.notification_template_system_defaults
    FROM PUBLIC, anon, authenticated;

-- --------------------------------------------------------------------
-- 3. Seed system defaults — procurement PO approval
-- --------------------------------------------------------------------
INSERT INTO public.notification_template_system_defaults (
    template_key, channel, locale, event_code, document_domain, label, description,
    subject_template, body_template, body_template_html,
    whatsapp_provider_template_name, whatsapp_param_mapping
) VALUES
-- approval.po.submitted — EMAIL
(
    'approval.po.submitted', 'EMAIL', 'en-US', 'approval.submitted', 'PROCUREMENT',
    'PO submitted (confirmation)',
    'Sent to the submitter when a purchase order is submitted for approval.',
    '{{document.number}} submitted for approval',
    E'Hi {{submitter.name}},\n\nYour {{document.type_label}} **{{document.number}}** ({{document.currency}} {{document.amount}}) has been submitted for approval.\n\nSupplier: {{party.name}}\nCurrent step: {{workflow.step_label}}\n\nView: {{document.url}}',
    E'<p>Hi {{submitter.name}},</p><p>Your <strong>{{document.type_label}} {{document.number}}</strong> ({{document.currency}} {{document.amount}}) has been submitted for approval.</p><p><strong>Supplier:</strong> {{party.name}}<br/><strong>Current step:</strong> {{workflow.step_label}}</p><p><a href="{{document.url}}">View document</a></p>',
    NULL, '[]'::jsonb
),
-- approval.po.submitted — SMS
(
    'approval.po.submitted', 'SMS', 'en-US', 'approval.submitted', 'PROCUREMENT',
    'PO submitted (confirmation)',
    'Sent to the submitter when a purchase order is submitted for approval.',
    NULL,
    'AIB: {{document.number}} submitted for approval. {{document.currency}} {{document.amount}}. View: {{document.url}}',
    NULL, NULL, '[]'::jsonb
),
-- approval.po.submitted — WHATSAPP
(
    'approval.po.submitted', 'WHATSAPP', 'en-US', 'approval.submitted', 'PROCUREMENT',
    'PO submitted (confirmation)',
    'Sent to the submitter when a purchase order is submitted for approval.',
    NULL,
    'Your {{document.type_label}} {{document.number}} ({{document.amount}} {{document.currency}}) was submitted for approval.',
    NULL,
    'aib_approval_submitted',
    '["{{document.number}}", "{{document.amount}} {{document.currency}}", "{{document.url}}"]'::jsonb
),
-- approval.po.step_opened — EMAIL
(
    'approval.po.step_opened', 'EMAIL', 'en-US', 'approval.step_opened', 'PROCUREMENT',
    'PO approval required',
    'Sent to assignees when a purchase order approval step opens.',
    '[Action required] Approve {{document.number}} — {{document.currency}} {{document.amount}}',
    E'Hi {{approver.name}},\n\n{{submitter.name}} submitted {{document.number}} for {{party.name}}.\n\nAmount: {{document.currency}} {{document.amount}}\nYour step: Level {{workflow.level_current}} — {{workflow.step_label}} ({{workflow.quorum}})\nDue by: {{sla.due_at}}\n\nReview: {{document.url}}',
    E'<p>Hi {{approver.name}},</p><p><strong>{{submitter.name}}</strong> submitted <strong>{{document.number}}</strong> for {{party.name}}.</p><p><strong>Amount:</strong> {{document.currency}} {{document.amount}}<br/><strong>Your step:</strong> Level {{workflow.level_current}} — {{workflow.step_label}} ({{workflow.quorum}})<br/><strong>Due by:</strong> {{sla.due_at}}</p><p><a href="{{document.url}}">Review and approve</a></p>',
    NULL, '[]'::jsonb
),
-- approval.po.step_opened — SMS
(
    'approval.po.step_opened', 'SMS', 'en-US', 'approval.step_opened', 'PROCUREMENT',
    'PO approval required',
    'Sent to assignees when a purchase order approval step opens.',
    NULL,
    'ACTION: Approve {{document.number}} {{document.currency}}{{document.amount}} from {{submitter.name}}. {{document.url}}',
    NULL, NULL, '[]'::jsonb
),
-- approval.po.step_opened — WHATSAPP
(
    'approval.po.step_opened', 'WHATSAPP', 'en-US', 'approval.step_opened', 'PROCUREMENT',
    'PO approval required',
    'Sent to assignees when a purchase order approval step opens.',
    NULL,
    'Approval required for {{document.number}}.',
    NULL,
    'aib_approval_action_required',
    '["{{document.number}}", "{{document.amount}}", "{{submitter.name}}", "{{document.url}}"]'::jsonb
),
-- approval.po.approved — EMAIL
(
    'approval.po.approved', 'EMAIL', 'en-US', 'approval.approved', 'PROCUREMENT',
    'PO fully approved',
    'Sent when a purchase order approval run is fully approved.',
    '{{document.number}} approved',
    E'Good news — {{document.number}} has been fully approved.\n\nFinal approver: {{approver.name}}\n{{decision.notes}}\n\nOpen: {{document.url}}',
    E'<p>Good news — <strong>{{document.number}}</strong> has been fully approved.</p><p><strong>Final approver:</strong> {{approver.name}}</p><p>{{decision.notes}}</p><p><a href="{{document.url}}">Open document</a></p>',
    NULL, '[]'::jsonb
),
-- approval.po.approved — SMS
(
    'approval.po.approved', 'SMS', 'en-US', 'approval.approved', 'PROCUREMENT',
    'PO fully approved',
    'Sent when a purchase order approval run is fully approved.',
    NULL,
    'AIB: {{document.number}} approved. Open: {{document.url}}',
    NULL, NULL, '[]'::jsonb
),
-- approval.po.approved — WHATSAPP
(
    'approval.po.approved', 'WHATSAPP', 'en-US', 'approval.approved', 'PROCUREMENT',
    'PO fully approved',
    'Sent when a purchase order approval run is fully approved.',
    NULL,
    '{{document.number}} was approved by {{approver.name}}.',
    NULL,
    'aib_approval_approved',
    '["{{document.number}}", "{{approver.name}}", "{{document.url}}"]'::jsonb
),
-- approval.po.rejected — EMAIL
(
    'approval.po.rejected', 'EMAIL', 'en-US', 'approval.rejected', 'PROCUREMENT',
    'PO rejected',
    'Sent when a purchase order approval is rejected.',
    '{{document.number}} rejected — action needed',
    E'{{document.number}} was rejected by {{approver.name}}.\n\nReason: {{decision.notes}}\n\nThe document has been returned to Draft. Edit and re-submit when ready.\n\nOpen: {{document.url}}',
    E'<p><strong>{{document.number}}</strong> was rejected by {{approver.name}}.</p><p><strong>Reason:</strong> {{decision.notes}}</p><p>The document has been returned to Draft. Edit and re-submit when ready.</p><p><a href="{{document.url}}">Open document</a></p>',
    NULL, '[]'::jsonb
),
-- approval.po.rejected — SMS
(
    'approval.po.rejected', 'SMS', 'en-US', 'approval.rejected', 'PROCUREMENT',
    'PO rejected',
    'Sent when a purchase order approval is rejected.',
    NULL,
    'AIB: {{document.number}} rejected. Reason: {{decision.notes}}. {{document.url}}',
    NULL, NULL, '[]'::jsonb
),
-- approval.po.rejected — WHATSAPP
(
    'approval.po.rejected', 'WHATSAPP', 'en-US', 'approval.rejected', 'PROCUREMENT',
    'PO rejected',
    'Sent when a purchase order approval is rejected.',
    NULL,
    '{{document.number}} was rejected.',
    NULL,
    'aib_approval_rejected',
    '["{{document.number}}", "{{decision.notes}}", "{{document.url}}"]'::jsonb
),
-- approval.po.reminder — EMAIL
(
    'approval.po.reminder', 'EMAIL', 'en-US', 'approval.reminder', 'PROCUREMENT',
    'PO approval reminder',
    'Reminder for pending purchase order approvers.',
    'Reminder: approve {{document.number}}',
    E'Reminder: {{document.number}} still needs your approval.\n\nDue: {{sla.due_at}}\n\nReview: {{document.url}}',
    E'<p>Reminder: <strong>{{document.number}}</strong> still needs your approval.</p><p><strong>Due:</strong> {{sla.due_at}}</p><p><a href="{{document.url}}">Review</a></p>',
    NULL, '[]'::jsonb
),
-- approval.po.reminder — SMS
(
    'approval.po.reminder', 'SMS', 'en-US', 'approval.reminder', 'PROCUREMENT',
    'PO approval reminder',
    'Reminder for pending purchase order approvers.',
    NULL,
    'Reminder: approve {{document.number}}. Due {{sla.due_at}}. {{document.url}}',
    NULL, NULL, '[]'::jsonb
),
-- approval.po.reminder — WHATSAPP
(
    'approval.po.reminder', 'WHATSAPP', 'en-US', 'approval.reminder', 'PROCUREMENT',
    'PO approval reminder',
    'Reminder for pending purchase order approvers.',
    NULL,
    'Reminder: {{document.number}} needs approval by {{sla.due_at}}.',
    NULL,
    'aib_approval_reminder',
    '["{{document.number}}", "{{sla.due_at}}", "{{document.url}}"]'::jsonb
);

-- Sales order approval defaults (ready for sales module)
INSERT INTO public.notification_template_system_defaults (
    template_key, channel, locale, event_code, document_domain, label, description,
    subject_template, body_template, body_template_html,
    whatsapp_provider_template_name, whatsapp_param_mapping
)
SELECT
    replace(template_key, 'approval.po.', 'approval.sales_order.'),
    channel,
    locale,
    event_code,
    'SALES',
    replace(label, 'PO', 'Sales order'),
    replace(description, 'purchase order', 'sales order'),
    CASE
        WHEN subject_template IS NOT NULL
        THEN replace(subject_template, 'purchase order', 'sales order')
        ELSE NULL
    END,
    replace(replace(body_template, 'purchase order', 'sales order'), '{{party.name}}', '{{customer.name}}'),
    replace(replace(body_template_html, 'purchase order', 'sales order'), '{{party.name}}', '{{customer.name}}'),
    whatsapp_provider_template_name,
    whatsapp_param_mapping
FROM public.notification_template_system_defaults
WHERE template_key LIKE 'approval.po.%';

-- Credit hold release defaults
INSERT INTO public.notification_template_system_defaults (
    template_key, channel, locale, event_code, document_domain, label, description,
    subject_template, body_template, body_template_html,
    whatsapp_provider_template_name, whatsapp_param_mapping
) VALUES
(
    'credit_hold.release_requested', 'EMAIL', 'en-US', 'credit_hold.release_requested', 'CREDIT',
    'Credit hold release requested',
    'Sent when a sales order on credit hold needs manager release.',
    'Credit hold release requested — {{document.number}}',
    E'Hi {{approver.name}},\n\nSales order {{document.number}} for {{customer.name}} is on credit hold.\nProjected balance: {{credit.projected_balance}} (limit {{credit.limit}})\n\nReview: {{document.url}}',
    E'<p>Hi {{approver.name}},</p><p>Sales order <strong>{{document.number}}</strong> for {{customer.name}} is on credit hold.</p><p>Projected balance: {{credit.projected_balance}} (limit {{credit.limit}})</p><p><a href="{{document.url}}">Review</a></p>',
    NULL, '[]'::jsonb
),
(
    'credit_hold.release_requested', 'SMS', 'en-US', 'credit_hold.release_requested', 'CREDIT',
    'Credit hold release requested',
    'Sent when a sales order on credit hold needs manager release.',
    NULL,
    'Credit hold: release {{document.number}} for {{customer.name}}. {{document.url}}',
    NULL, NULL, '[]'::jsonb
),
(
    'credit_hold.release_requested', 'WHATSAPP', 'en-US', 'credit_hold.release_requested', 'CREDIT',
    'Credit hold release requested',
    'Sent when a sales order on credit hold needs manager release.',
    NULL,
    'Credit hold release requested for {{document.number}}.',
    NULL,
    'aib_credit_hold_release',
    '["{{document.number}}", "{{customer.name}}", "{{document.url}}"]'::jsonb
),
(
    'credit_hold.released', 'EMAIL', 'en-US', 'credit_hold.released', 'CREDIT',
    'Credit hold released',
    'Sent when a manager releases a sales order from credit hold.',
    '{{document.number}} released from credit hold',
    E'{{document.number}} for {{customer.name}} was released from credit hold by {{approver.name}}.\n\nOpen: {{document.url}}',
    E'<p><strong>{{document.number}}</strong> for {{customer.name}} was released from credit hold by {{approver.name}}.</p><p><a href="{{document.url}}">Open document</a></p>',
    NULL, '[]'::jsonb
),
(
    'credit_hold.released', 'SMS', 'en-US', 'credit_hold.released', 'CREDIT',
    'Credit hold released',
    'Sent when a manager releases a sales order from credit hold.',
    NULL,
    'AIB: {{document.number}} credit hold released. {{document.url}}',
    NULL, NULL, '[]'::jsonb
),
(
    'credit_hold.released', 'WHATSAPP', 'en-US', 'credit_hold.released', 'CREDIT',
    'Credit hold released',
    'Sent when a manager releases a sales order from credit hold.',
    NULL,
    '{{document.number}} credit hold released by {{approver.name}}.',
    NULL,
    'aib_credit_hold_released',
    '["{{document.number}}", "{{approver.name}}", "{{document.url}}"]'::jsonb
);

-- --------------------------------------------------------------------
-- 4. RPCs
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ensure_tenant_notification_templates(
    p_locale TEXT DEFAULT 'en-US'
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_tenant_id UUID;
    v_inserted INTEGER;
BEGIN
    v_tenant_id := private.current_tenant_id();
    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'tenant context missing from session';
    END IF;

    INSERT INTO public.notification_templates (
        tenant_id,
        template_key,
        channel,
        locale,
        event_code,
        document_domain,
        label,
        description,
        subject_template,
        body_template,
        body_template_html,
        whatsapp_provider_template_name,
        whatsapp_param_mapping,
        is_active,
        is_customized
    )
    SELECT
        v_tenant_id,
        std.template_key,
        std.channel,
        std.locale,
        std.event_code,
        std.document_domain,
        std.label,
        std.description,
        std.subject_template,
        std.body_template,
        std.body_template_html,
        std.whatsapp_provider_template_name,
        std.whatsapp_param_mapping,
        TRUE,
        FALSE
    FROM public.notification_template_system_defaults std
    WHERE std.locale = p_locale
    ON CONFLICT (tenant_id, template_key, channel, locale) DO NOTHING;

    GET DIAGNOSTICS v_inserted = ROW_COUNT;
    RETURN v_inserted;
END;
$$;

CREATE OR REPLACE FUNCTION private.ensure_tenant_notification_templates_for_tenant(
    p_tenant_id UUID,
    p_locale TEXT DEFAULT 'en-US'
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_inserted INTEGER;
BEGIN
    IF p_tenant_id IS NULL THEN
        RAISE EXCEPTION 'tenant id is required';
    END IF;

    INSERT INTO public.notification_templates (
        tenant_id,
        template_key,
        channel,
        locale,
        event_code,
        document_domain,
        label,
        description,
        subject_template,
        body_template,
        body_template_html,
        whatsapp_provider_template_name,
        whatsapp_param_mapping,
        is_active,
        is_customized
    )
    SELECT
        p_tenant_id,
        std.template_key,
        std.channel,
        std.locale,
        std.event_code,
        std.document_domain,
        std.label,
        std.description,
        std.subject_template,
        std.body_template,
        std.body_template_html,
        std.whatsapp_provider_template_name,
        std.whatsapp_param_mapping,
        TRUE,
        FALSE
    FROM public.notification_template_system_defaults std
    WHERE std.locale = p_locale
    ON CONFLICT (tenant_id, template_key, channel, locale) DO NOTHING;

    GET DIAGNOSTICS v_inserted = ROW_COUNT;
    RETURN v_inserted;
END;
$$;

CREATE OR REPLACE FUNCTION public.upsert_notification_template(
    p_template_key TEXT,
    p_channel public.notification_channel,
    p_locale TEXT DEFAULT 'en-US',
    p_subject_template TEXT DEFAULT NULL,
    p_body_template TEXT DEFAULT NULL,
    p_body_template_html TEXT DEFAULT NULL,
    p_whatsapp_provider_template_name TEXT DEFAULT NULL,
    p_whatsapp_param_mapping JSONB DEFAULT NULL,
    p_is_active BOOLEAN DEFAULT TRUE
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_tenant_id UUID;
    v_std RECORD;
    v_id UUID;
    v_body TEXT;
BEGIN
    v_tenant_id := private.current_tenant_id();
    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'tenant context missing from session';
    END IF;

    IF NOT private.user_can_modify_organization_settings() THEN
        RAISE EXCEPTION 'administrative privileges required to modify notification templates';
    END IF;

    PERFORM public.ensure_tenant_notification_templates(p_locale);

    SELECT *
    INTO v_std
    FROM public.notification_template_system_defaults
    WHERE template_key = p_template_key
      AND channel = p_channel
      AND locale = p_locale;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'unknown notification template key';
    END IF;

    v_body := NULLIF(BTRIM(p_body_template), '');
    IF v_body IS NULL THEN
        RAISE EXCEPTION 'body template is required';
    END IF;

    IF p_channel = 'EMAIL' AND NULLIF(BTRIM(p_subject_template), '') IS NULL THEN
        RAISE EXCEPTION 'subject template is required for email';
    END IF;

    IF p_channel = 'WHATSAPP' AND NULLIF(BTRIM(p_whatsapp_provider_template_name), '') IS NULL THEN
        RAISE EXCEPTION 'whatsapp provider template name is required';
    END IF;

    UPDATE public.notification_templates
    SET
        subject_template = CASE WHEN p_channel = 'EMAIL' THEN NULLIF(BTRIM(p_subject_template), '') ELSE NULL END,
        body_template = v_body,
        body_template_html = CASE WHEN p_channel = 'EMAIL' THEN NULLIF(BTRIM(p_body_template_html), '') ELSE NULL END,
        whatsapp_provider_template_name = CASE WHEN p_channel = 'WHATSAPP' THEN NULLIF(BTRIM(p_whatsapp_provider_template_name), '') ELSE NULL END,
        whatsapp_param_mapping = CASE
            WHEN p_channel = 'WHATSAPP' THEN COALESCE(p_whatsapp_param_mapping, '[]'::jsonb)
            ELSE '[]'::jsonb
        END,
        is_active = COALESCE(p_is_active, TRUE),
        is_customized = TRUE,
        updated_at = NOW()
    WHERE tenant_id = v_tenant_id
      AND template_key = p_template_key
      AND channel = p_channel
      AND locale = p_locale
    RETURNING id INTO v_id;

    RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.reset_notification_template(
    p_template_key TEXT,
    p_channel public.notification_channel,
    p_locale TEXT DEFAULT 'en-US'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_tenant_id UUID;
    v_std RECORD;
    v_id UUID;
BEGIN
    v_tenant_id := private.current_tenant_id();
    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'tenant context missing from session';
    END IF;

    IF NOT private.user_can_modify_organization_settings() THEN
        RAISE EXCEPTION 'administrative privileges required to modify notification templates';
    END IF;

    SELECT *
    INTO v_std
    FROM public.notification_template_system_defaults
    WHERE template_key = p_template_key
      AND channel = p_channel
      AND locale = p_locale;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'unknown notification template key';
    END IF;

    PERFORM public.ensure_tenant_notification_templates(p_locale);

    UPDATE public.notification_templates
    SET
        subject_template = v_std.subject_template,
        body_template = v_std.body_template,
        body_template_html = v_std.body_template_html,
        whatsapp_provider_template_name = v_std.whatsapp_provider_template_name,
        whatsapp_param_mapping = v_std.whatsapp_param_mapping,
        is_active = TRUE,
        is_customized = FALSE,
        updated_at = NOW()
    WHERE tenant_id = v_tenant_id
      AND template_key = p_template_key
      AND channel = p_channel
      AND locale = p_locale
    RETURNING id INTO v_id;

    RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_tenant_notification_templates(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_tenant_notification_templates(TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.upsert_notification_template(
    TEXT, public.notification_channel, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, BOOLEAN
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_notification_template(
    TEXT, public.notification_channel, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, BOOLEAN
) TO authenticated;

REVOKE ALL ON FUNCTION public.reset_notification_template(
    TEXT, public.notification_channel, TEXT
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reset_notification_template(
    TEXT, public.notification_channel, TEXT
) TO authenticated;

-- Backfill existing tenants
DO $$
DECLARE
    v_tenant RECORD;
BEGIN
    FOR v_tenant IN SELECT id FROM public.tenants
    LOOP
        PERFORM private.ensure_tenant_notification_templates_for_tenant(v_tenant.id, 'en-US');
    END LOOP;
END;
$$;

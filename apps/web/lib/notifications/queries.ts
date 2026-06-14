import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  NOTIFICATION_CHANNELS,
  NOTIFICATION_TEMPLATE_DEFINITIONS,
} from "@/lib/notifications/template-catalog";
import { parseWhatsappParamMapping } from "@/lib/notifications/render-template";
import type {
  NotificationTemplateGroup,
  NotificationTemplateRow,
} from "@/lib/notifications/types";
import { formatRpcDeployError, isMissingRpcError } from "@/lib/supabase/rpc-error";

function mapTemplateRow(row: Record<string, unknown>): NotificationTemplateRow {
  return {
    id: row.id as string,
    tenant_id: row.tenant_id as string,
    template_key: row.template_key as string,
    channel: row.channel as NotificationTemplateRow["channel"],
    locale: row.locale as string,
    event_code: row.event_code as string,
    document_domain: row.document_domain as NotificationTemplateRow["document_domain"],
    label: row.label as string,
    description: (row.description as string | null) ?? null,
    subject_template: (row.subject_template as string | null) ?? null,
    body_template: row.body_template as string,
    body_template_html: (row.body_template_html as string | null) ?? null,
    whatsapp_provider_template_name:
      (row.whatsapp_provider_template_name as string | null) ?? null,
    whatsapp_param_mapping: parseWhatsappParamMapping(row.whatsapp_param_mapping),
    is_active: Boolean(row.is_active),
    is_customized: Boolean(row.is_customized),
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

export async function ensureTenantNotificationTemplates(
  supabase: SupabaseClient,
  locale = "en-US"
): Promise<{ ensured: boolean; error?: string }> {
  const { error } = await supabase.rpc("ensure_tenant_notification_templates", {
    p_locale: locale,
  });

  if (error) {
    if (isMissingRpcError(error)) {
      return { ensured: false, error: formatRpcDeployError("ensure_tenant_notification_templates") };
    }
    return { ensured: false, error: error.message };
  }

  return { ensured: true };
}

export async function fetchNotificationTemplateGroups(
  supabase: SupabaseClient,
  tenantId: string,
  locale = "en-US"
): Promise<{ groups: NotificationTemplateGroup[]; deployError?: string }> {
  const ensureResult = await ensureTenantNotificationTemplates(supabase, locale);

  const { data, error } = await supabase
    .from("notification_templates")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("locale", locale)
    .order("template_key", { ascending: true })
    .order("channel", { ascending: true });

  if (error) {
    return { groups: [], deployError: ensureResult.error ?? error.message };
  }

  const rows = (data ?? []).map((row) => mapTemplateRow(row as Record<string, unknown>));
  const rowByKey = new Map<string, NotificationTemplateRow>();
  for (const row of rows) {
    rowByKey.set(`${row.template_key}:${row.channel}`, row);
  }

  const groups: NotificationTemplateGroup[] = NOTIFICATION_TEMPLATE_DEFINITIONS.map((definition) => {
    const channels = NOTIFICATION_CHANNELS.reduce(
      (acc, channel) => {
        acc[channel] = rowByKey.get(`${definition.templateKey}:${channel}`) ?? null;
        return acc;
      },
      {
        EMAIL: null,
        SMS: null,
        WHATSAPP: null,
      } as NotificationTemplateGroup["channels"]
    );

    return {
      templateKey: definition.templateKey,
      eventCode: definition.eventCode,
      documentDomain: definition.documentDomain,
      label: definition.label,
      description: definition.description,
      channels,
    };
  });

  return { groups, deployError: ensureResult.error };
}

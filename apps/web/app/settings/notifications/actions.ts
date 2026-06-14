"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { SaveNotificationTemplateInput } from "@/lib/notifications/types";
import { resolveOrganizationSettingsAccess } from "@/lib/organization/access";
import { requireTenantId } from "@/lib/supabase/require-tenant";
import { formatRpcDeployError, isMissingRpcError } from "@/lib/supabase/rpc-error";

const saveSchema = z.object({
  templateKey: z.string().min(1),
  channel: z.enum(["EMAIL", "SMS", "WHATSAPP"]),
  locale: z.string().min(2).default("en-US"),
  subjectTemplate: z.string().nullable().optional(),
  bodyTemplate: z.string().min(1),
  bodyTemplateHtml: z.string().nullable().optional(),
  whatsappProviderTemplateName: z.string().nullable().optional(),
  whatsappParamMapping: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
});

const resetSchema = z.object({
  templateKey: z.string().min(1),
  channel: z.enum(["EMAIL", "SMS", "WHATSAPP"]),
  locale: z.string().min(2).default("en-US"),
});

async function requireSettingsEditor(): Promise<
  | { supabase: Awaited<ReturnType<typeof requireTenantId>>["supabase"]; tenantId: string; userId: string }
  | { error: string }
> {
  const { supabase, tenantId, userId } = await requireTenantId();
  const access = await resolveOrganizationSettingsAccess(supabase, userId, tenantId);
  if (!access.granted) {
    return { error: "You do not have permission to edit notification templates." };
  }
  return { supabase, tenantId, userId };
}

export async function saveNotificationTemplate(
  input: SaveNotificationTemplateInput
): Promise<{ success: true } | { error: string }> {
  const parsed = saveSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Invalid notification template payload." };
  }

  const editor = await requireSettingsEditor();
  if ("error" in editor) return editor;

  const { supabase } = editor;
  const payload = parsed.data;

  const { error } = await supabase.rpc("upsert_notification_template", {
    p_template_key: payload.templateKey,
    p_channel: payload.channel,
    p_locale: payload.locale,
    p_subject_template: payload.subjectTemplate ?? null,
    p_body_template: payload.bodyTemplate,
    p_body_template_html: payload.bodyTemplateHtml ?? null,
    p_whatsapp_provider_template_name: payload.whatsappProviderTemplateName ?? null,
    p_whatsapp_param_mapping: payload.whatsappParamMapping ?? [],
    p_is_active: payload.isActive ?? true,
  });

  if (error) {
    if (isMissingRpcError(error)) {
      return { error: formatRpcDeployError("upsert_notification_template") };
    }
    return { error: error.message };
  }

  revalidatePath("/settings/notifications");
  return { success: true };
}

export async function resetNotificationTemplate(
  input: Pick<SaveNotificationTemplateInput, "templateKey" | "channel" | "locale">
): Promise<{ success: true } | { error: string }> {
  const parsed = resetSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Invalid reset payload." };
  }

  const editor = await requireSettingsEditor();
  if ("error" in editor) return editor;

  const { error } = await editor.supabase.rpc("reset_notification_template", {
    p_template_key: parsed.data.templateKey,
    p_channel: parsed.data.channel,
    p_locale: parsed.data.locale,
  });

  if (error) {
    if (isMissingRpcError(error)) {
      return { error: formatRpcDeployError("reset_notification_template") };
    }
    return { error: error.message };
  }

  revalidatePath("/settings/notifications");
  return { success: true };
}

export async function ensureNotificationTemplates(): Promise<
  { success: true; inserted: number } | { error: string }
> {
  const editor = await requireSettingsEditor();
  if ("error" in editor) return editor;

  const { data, error } = await editor.supabase.rpc("ensure_tenant_notification_templates", {
    p_locale: "en-US",
  });

  if (error) {
    if (isMissingRpcError(error)) {
      return { error: formatRpcDeployError("ensure_tenant_notification_templates") };
    }
    return { error: error.message };
  }

  revalidatePath("/settings/notifications");
  return { success: true, inserted: Number(data ?? 0) };
}

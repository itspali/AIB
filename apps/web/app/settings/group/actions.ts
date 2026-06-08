"use server";

import { revalidatePath } from "next/cache";
import {
  createGroupOrganizationSchema,
  createTenantGroupSchema,
  groupSettingsSchema,
} from "@/lib/group/schemas";
import { requireTenantId } from "@/lib/supabase/require-tenant";

const GROUP_PATHS = ["/settings/group", "/settings/organization", "/dashboard"];

export async function createTenantGroup(input: {
  name: string;
  primary_email: string;
  primary_phone?: string;
}) {
  const parsed = createTenantGroupSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { supabase } = await requireTenantId();
  const { data, error } = await supabase.rpc("create_tenant_group", {
    p_name: parsed.data.name,
    p_primary_email: parsed.data.primary_email,
    p_primary_phone: parsed.data.primary_phone || "PENDING",
  });

  if (error) return { error: error.message };

  for (const path of GROUP_PATHS) revalidatePath(path);
  return { success: true as const, groupId: data as string };
}

export async function saveGroupSettings(input: {
  group_id: string;
  name: string;
  legal_name?: string;
  trade_name?: string;
  primary_email: string;
  primary_phone: string;
}) {
  const parsed = groupSettingsSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { supabase } = await requireTenantId();
  const { error } = await supabase.rpc("update_tenant_group_profile", {
    p_group_id: input.group_id,
    p_name: parsed.data.name,
    p_legal_name: parsed.data.legal_name || null,
    p_trade_name: parsed.data.trade_name || null,
    p_primary_email: parsed.data.primary_email,
    p_primary_phone: parsed.data.primary_phone,
  });

  if (error) return { error: error.message };

  for (const path of GROUP_PATHS) revalidatePath(path);
  return { success: true as const };
}

export async function createGroupOrganization(input: {
  group_id: string;
  company_name: string;
  primary_email: string;
  primary_phone?: string;
}) {
  const parsed = createGroupOrganizationSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { supabase } = await requireTenantId();
  const { data, error } = await supabase.rpc("create_group_organization", {
    p_group_id: input.group_id,
    p_company_name: parsed.data.company_name,
    p_primary_email: parsed.data.primary_email,
    p_primary_phone: parsed.data.primary_phone || "PENDING",
  });

  if (error) return { error: error.message };

  for (const path of GROUP_PATHS) revalidatePath(path);
  return { success: true as const, tenantId: data as string };
}

export async function requestGroupExit(tenantId: string, reason?: string) {
  const { supabase } = await requireTenantId();
  const { error } = await supabase.rpc("request_group_exit", {
    p_tenant_id: tenantId,
    p_reason: reason?.trim() || null,
  });

  if (error) return { error: error.message };

  for (const path of GROUP_PATHS) revalidatePath(path);
  return { success: true as const };
}

export async function completeGroupExit(tenantId: string, reason?: string) {
  const { supabase } = await requireTenantId();
  const { error } = await supabase.rpc("complete_group_exit", {
    p_tenant_id: tenantId,
    p_reason: reason?.trim() || null,
  });

  if (error) return { error: error.message };

  for (const path of GROUP_PATHS) revalidatePath(path);
  return { success: true as const };
}

export async function switchActiveTenantMembership(tenantId: string) {
  const { supabase } = await requireTenantId();
  const { error } = await supabase.rpc("switch_active_tenant_membership", {
    p_tenant_id: tenantId,
  });

  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  return { success: true as const };
}

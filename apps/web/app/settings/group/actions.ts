"use server";

import { revalidatePath } from "next/cache";
import {
  entitySettingsWorkspaceKey,
  sanitizeEntityCustomFieldDefinitions,
  validateEntityCustomFieldDefinitions,
  type EntityCustomFieldDefinition,
} from "@/lib/entities/custom-field-definitions";
import { fetchGroupEntitySettingsMetadata } from "@/lib/entities/custom-field-queries";
import type { EntityWorkspace } from "@/lib/entities/types";
import { resolveGroupSettingsAccess } from "@/lib/group/access";
import {
  createGroupOrganizationSchema,
  createTenantGroupSchema,
  groupSettingsSchema,
  inviteOrganizationToGroupSchema,
  suspendGroupOrganizationSchema,
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

export async function inviteOrganizationToGroup(input: {
  group_id: string;
  identifier: string;
  message?: string;
}) {
  const parsed = inviteOrganizationToGroupSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { supabase } = await requireTenantId();
  const { data, error } = await supabase.rpc("invite_standalone_organization_to_group", {
    p_group_id: parsed.data.group_id,
    p_identifier: parsed.data.identifier,
    p_message: parsed.data.message || null,
  });

  if (error) return { error: error.message };

  for (const path of GROUP_PATHS) revalidatePath(path);
  return { success: true as const, invitationId: data as string };
}

export async function acceptGroupInvitation(invitationId: string) {
  if (!invitationId.trim()) return { error: "Invitation is required" };

  const { supabase } = await requireTenantId();
  const { error } = await supabase.rpc("accept_group_organization_invitation", {
    p_invitation_id: invitationId,
  });

  if (error) return { error: error.message };

  for (const path of GROUP_PATHS) revalidatePath(path);
  revalidatePath("/", "layout");
  return { success: true as const };
}

export async function rejectGroupInvitation(invitationId: string) {
  if (!invitationId.trim()) return { error: "Invitation is required" };

  const { supabase } = await requireTenantId();
  const { error } = await supabase.rpc("reject_group_organization_invitation", {
    p_invitation_id: invitationId,
  });

  if (error) return { error: error.message };

  for (const path of GROUP_PATHS) revalidatePath(path);
  return { success: true as const };
}

export async function revokeGroupInvitation(invitationId: string) {
  if (!invitationId.trim()) return { error: "Invitation is required" };

  const { supabase } = await requireTenantId();
  const { error } = await supabase.rpc("revoke_group_organization_invitation", {
    p_invitation_id: invitationId,
  });

  if (error) return { error: error.message };

  for (const path of GROUP_PATHS) revalidatePath(path);
  return { success: true as const };
}

export async function suspendGroupOrganization(input: {
  tenant_id: string;
  reason?: string;
}) {
  const parsed = suspendGroupOrganizationSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { supabase } = await requireTenantId();
  const { error } = await supabase.rpc("suspend_group_organization", {
    p_tenant_id: parsed.data.tenant_id,
    p_reason: parsed.data.reason || null,
  });

  if (error) return { error: error.message };

  for (const path of GROUP_PATHS) revalidatePath(path);
  return { success: true as const };
}

export async function reinstateGroupOrganization(tenantId: string) {
  if (!tenantId.trim()) return { error: "Organization is required" };

  const { supabase } = await requireTenantId();
  const { error } = await supabase.rpc("reinstate_group_organization", {
    p_tenant_id: tenantId,
  });

  if (error) return { error: error.message };

  for (const path of GROUP_PATHS) revalidatePath(path);
  return { success: true as const };
}

export async function saveGroupEntityCustomFields(
  groupId: string,
  workspace: EntityWorkspace,
  definitions: EntityCustomFieldDefinition[]
) {
  const validationError = validateEntityCustomFieldDefinitions(definitions);
  if (validationError) {
    return { error: validationError };
  }

  const { supabase, userId } = await requireTenantId();
  const access = await resolveGroupSettingsAccess(supabase, userId, groupId);
  if (!access.granted) {
    return { error: "Group admin privileges required." };
  }

  const entitySettings = await fetchGroupEntitySettingsMetadata(supabase, groupId);
  const workspaceKey = entitySettingsWorkspaceKey(workspace);
  const nextEntitySettings = {
    ...entitySettings,
    [workspaceKey]: {
      custom_field_definitions: sanitizeEntityCustomFieldDefinitions(definitions),
    },
  };

  const { error } = await supabase.rpc("patch_group_metadata_json", {
    p_group_id: groupId,
    p_patch: { entity_settings: nextEntitySettings },
  });

  if (error) return { error: error.message };

  for (const path of GROUP_PATHS) {
    revalidatePath(path);
  }
  revalidatePath("/sales");
  revalidatePath("/sales/customers");
  revalidatePath("/procurement/suppliers");
  revalidatePath("/entities");
  revalidatePath("/entities/customers");
  revalidatePath("/entities/suppliers");

  return { success: true as const };
}

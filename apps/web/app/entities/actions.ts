"use server";

import { revalidatePath } from "next/cache";
import { fetchResolvedEntityCustomFieldDefinitions } from "@/lib/entities/custom-field-queries";
import type { EntityCustomFieldDefinition } from "@/lib/entities/custom-field-definitions";
import { fetchEntityDetailById } from "@/lib/entities/queries";
import { fetchEntityListPage } from "@/lib/entities/list-queries";
import { entityListHref } from "@/lib/entities/entity-navigation";
import { buildEntityLogoStoragePath, ENTITY_LOGO_BUCKET } from "@/lib/entities/logo";
import type { EntityDetailSnapshot, EntityWorkspace } from "@/lib/entities/types";
import { fetchEntityCategoryRows } from "@/lib/entity-categories/queries";
import type { EntityCategoryRow } from "@/lib/entity-categories/types";
import { requireTenantId } from "@/lib/supabase/require-tenant";

const ENTITY_PATHS = [
  "/entities",
  "/entities/customers",
  "/entities/suppliers",
  "/sales/customers",
  "/procurement/suppliers",
] as const;

function revalidateEntityPaths(workspace?: EntityWorkspace) {
  for (const path of ENTITY_PATHS) {
    revalidatePath(path);
  }
  if (workspace) {
    revalidatePath(entityListHref(workspace));
  }
}

function uniqueEntityIds(entityIds: string[]): string[] {
  return [...new Set(entityIds.filter(Boolean))];
}

function mapEntityRpcError(message: string): string {
  if (message.includes("ENTITY_IN_USE")) {
    return "This record is linked to purchase orders, sales documents, or catalog entries and cannot be deleted.";
  }
  if (message.includes("permission denied")) {
    return "You do not have permission to perform this action.";
  }
  return message;
}

async function relocateDraftEntityLogo(
  supabase: Awaited<ReturnType<typeof requireTenantId>>["supabase"],
  tenantId: string,
  entityId: string,
  entityPayload: Record<string, unknown>
): Promise<void> {
  const draftKey = String(entityPayload.draft_storage_key ?? "");
  const logoUrl = String(entityPayload.logo_url ?? "");
  if (!draftKey || !logoUrl || !logoUrl.includes(draftKey)) return;

  const extension = logoUrl.split(".").pop()?.toLowerCase() ?? "jpg";
  const nextPath = buildEntityLogoStoragePath(tenantId, entityId, extension);

  const { error: copyError } = await supabase.storage
    .from(ENTITY_LOGO_BUCKET)
    .copy(logoUrl, nextPath);

  if (copyError) return;

  await supabase.storage.from(ENTITY_LOGO_BUCKET).remove([logoUrl]);

  const { name, type, tax_treatment, is_active } = entityPayload;
  await supabase.rpc("save_entity_profile", {
    p_entity: {
      entity_id: entityId,
      name,
      type,
      tax_treatment,
      logo_url: nextPath,
      is_active,
    },
  });
}

export async function loadEntityDetail(
  entityId: string
): Promise<EntityDetailSnapshot | null> {
  const { supabase, tenantId } = await requireTenantId();
  return fetchEntityDetailById(supabase, tenantId, entityId);
}

export async function fetchMoreEntities(workspace: EntityWorkspace, offset: number) {
  const { supabase } = await requireTenantId();
  return fetchEntityListPage(supabase, workspace, { offset });
}

export async function loadEntityListCategoryRows(
  workspace: EntityWorkspace
): Promise<EntityCategoryRow[]> {
  const { supabase, tenantId } = await requireTenantId();
  return fetchEntityCategoryRows(supabase, tenantId, workspace);
}

export async function loadEntityCustomFieldDefinitions(
  workspace: EntityWorkspace
): Promise<EntityCustomFieldDefinition[]> {
  const { supabase, tenantId } = await requireTenantId();
  return fetchResolvedEntityCustomFieldDefinitions(supabase, tenantId, workspace);
}

type EntitySavePayload = {
  entity: Record<string, unknown>;
  primary_contact: Record<string, unknown> | null;
  extended_contacts: Record<string, unknown>[];
  bank_accounts: Record<string, unknown>[];
};

function entityTypeSupportsBankAccounts(type: string): boolean {
  return type === "SUPPLIER" || type === "MUTUAL_PARTNER";
}

export async function saveEntity(
  workspace: EntityWorkspace,
  payload: EntitySavePayload
): Promise<{ entity: EntityDetailSnapshot } | { error: string }> {
  const { supabase, tenantId } = await requireTenantId();

  const { data: entityId, error } = await supabase.rpc("save_entity_profile", {
    p_entity: payload.entity,
    p_primary_contact: payload.primary_contact,
  });

  if (error) {
    return { error: mapEntityRpcError(error.message) };
  }

  const id = String(entityId ?? "");
  if (!id) {
    return { error: "Entity saved but no id was returned." };
  }

  if (!payload.entity.entity_id) {
    await relocateDraftEntityLogo(supabase, tenantId, id, payload.entity);
  }

  const isEdit = Boolean(payload.entity.entity_id);
  if (isEdit || payload.extended_contacts.length > 0) {
    const { error: contactsError } = await supabase.rpc("save_entity_contacts", {
      p_entity_id: id,
      p_contacts: payload.extended_contacts,
    });
    if (contactsError) {
      return { error: mapEntityRpcError(contactsError.message) };
    }
  }

  const entityType = String(payload.entity.type ?? "");
  if (entityTypeSupportsBankAccounts(entityType)) {
    const { error: bankError } = await supabase.rpc("save_entity_bank_accounts", {
      p_entity_id: id,
      p_accounts: payload.bank_accounts,
    });
    if (bankError) {
      return { error: mapEntityRpcError(bankError.message) };
    }
  }

  const detail = await loadEntityDetail(id);
  if (!detail) {
    return { error: "Entity saved but detail could not be loaded." };
  }

  revalidateEntityPaths(workspace);
  return { entity: detail };
}

export async function bulkActivateEntities(entityIds: string[]) {
  const ids = uniqueEntityIds(entityIds);
  if (ids.length === 0) return { error: "Select at least one entity." };

  const { supabase } = await requireTenantId();

  const { error } = await supabase.rpc("bulk_set_entities_active", {
    p_entity_ids: ids,
    p_is_active: true,
  });

  if (error) return { error: mapEntityRpcError(error.message) };

  revalidateEntityPaths();
  return { success: true as const, affectedIds: ids };
}

export async function bulkDeactivateEntities(entityIds: string[]) {
  const ids = uniqueEntityIds(entityIds);
  if (ids.length === 0) return { error: "Select at least one entity." };

  const { supabase } = await requireTenantId();

  const { error } = await supabase.rpc("bulk_set_entities_active", {
    p_entity_ids: ids,
    p_is_active: false,
  });

  if (error) return { error: mapEntityRpcError(error.message) };

  revalidateEntityPaths();
  return { success: true as const, affectedIds: ids };
}

export async function deactivateEntity(entityId: string) {
  const { supabase } = await requireTenantId();

  const { error } = await supabase.rpc("bulk_set_entities_active", {
    p_entity_ids: [entityId],
    p_is_active: false,
  });

  if (error) return { error: mapEntityRpcError(error.message) };

  const detail = await loadEntityDetail(entityId);
  if (!detail) return { error: "Entity deactivated but detail could not be loaded." };

  revalidateEntityPaths();
  return { entity: detail };
}

export async function deleteEntity(entityId: string) {
  const { supabase } = await requireTenantId();

  const { error } = await supabase.rpc("delete_entity", {
    p_entity_id: entityId,
  });

  if (error) {
    return { error: mapEntityRpcError(error.message) };
  }

  revalidateEntityPaths();
  return { success: true as const, entityId };
}

export async function loadEntityReferenceCount(entityId: string): Promise<number> {
  const { supabase } = await requireTenantId();
  const { data, error } = await supabase.rpc("count_entity_references", {
    p_entity_id: entityId,
  });
  if (error) return 0;
  return Number(data) || 0;
}

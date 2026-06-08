"use server";

import { revalidatePath } from "next/cache";
import { fetchEntityDetailById } from "@/lib/entities/queries";
import type { EntityDetailSnapshot, EntityListRow, EntityWorkspace } from "@/lib/entities/types";
import { entityListHref } from "@/lib/entities/entity-navigation";
import { requireTenantId } from "@/lib/supabase/require-tenant";

const ENTITY_PATHS = ["/entities", "/entities/customers", "/entities/suppliers"] as const;

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

export function listRowFromDetail(detail: EntityDetailSnapshot): EntityListRow {
  const primary = detail.primary_contact;
  const primaryName = primary
    ? [primary.first_name, primary.last_name].filter(Boolean).join(" ").trim()
    : null;

  return {
    id: detail.id,
    name: detail.name,
    legal_name: detail.legal_name,
    code: detail.code,
    type: detail.type,
    tax_treatment: detail.tax_treatment,
    tax_registration_number: detail.tax_registration_number,
    credit_limit: detail.credit_limit,
    current_balance: detail.current_balance,
    payment_terms_days: detail.payment_terms_days,
    company_email: detail.company_email,
    company_phone: detail.company_phone,
    is_active: detail.is_active,
    created_at: detail.created_at,
    updated_at: detail.updated_at,
    primary_contact_name: primaryName || null,
    primary_contact_email: primary?.email ?? null,
  };
}

export async function loadEntityDetail(
  entityId: string
): Promise<EntityDetailSnapshot | null> {
  const { supabase, tenantId } = await requireTenantId();
  return fetchEntityDetailById(supabase, tenantId, entityId);
}

type EntitySavePayload = {
  entity: Record<string, unknown>;
  primary_contact: Record<string, unknown> | null;
  extended_contacts: Record<string, unknown>[];
};

export async function saveEntity(
  workspace: EntityWorkspace,
  payload: EntitySavePayload
): Promise<{ entity: EntityDetailSnapshot } | { error: string }> {
  const { supabase } = await requireTenantId();

  const { data, error } = await supabase.rpc("save_entity_master", {
    p_workspace: workspace,
    p_entity: payload.entity,
    p_primary_contact: payload.primary_contact,
    p_extended_contacts: payload.extended_contacts,
  });

  if (error) {
    return { error: error.message };
  }

  const entityId =
    typeof data === "object" && data && "entity_id" in data
      ? String((data as { entity_id: string }).entity_id)
      : String(payload.entity.entity_id ?? "");

  if (!entityId) {
    return { error: "Entity saved but no id was returned." };
  }

  const detail = await loadEntityDetail(entityId);
  if (!detail) {
    return { error: "Entity saved but detail could not be loaded." };
  }

  revalidateEntityPaths(workspace);
  return { entity: detail };
}

export async function bulkActivateEntities(entityIds: string[]) {
  const ids = uniqueEntityIds(entityIds);
  if (ids.length === 0) return { error: "Select at least one entity." };

  const { supabase, tenantId } = await requireTenantId();

  const { data, error } = await supabase
    .from("entities")
    .update({ is_active: true })
    .in("id", ids)
    .eq("tenant_id", tenantId)
    .select("id");

  if (error) return { error: error.message };

  revalidateEntityPaths();
  return {
    success: true as const,
    affectedIds: (data ?? []).map((row) => row.id as string),
  };
}

export async function bulkDeactivateEntities(entityIds: string[]) {
  const ids = uniqueEntityIds(entityIds);
  if (ids.length === 0) return { error: "Select at least one entity." };

  const { supabase, tenantId } = await requireTenantId();

  const { data, error } = await supabase
    .from("entities")
    .update({ is_active: false })
    .in("id", ids)
    .eq("tenant_id", tenantId)
    .select("id");

  if (error) return { error: error.message };

  revalidateEntityPaths();
  return {
    success: true as const,
    affectedIds: (data ?? []).map((row) => row.id as string),
  };
}

export async function deactivateEntity(entityId: string) {
  const { supabase, tenantId } = await requireTenantId();

  const { data, error } = await supabase
    .from("entities")
    .update({ is_active: false })
    .eq("id", entityId)
    .eq("tenant_id", tenantId)
    .select("id")
    .maybeSingle();

  if (error) return { error: error.message };
  if (!data) return { error: "Entity not found." };

  const detail = await loadEntityDetail(entityId);
  if (!detail) return { error: "Entity deactivated but detail could not be loaded." };

  revalidateEntityPaths();
  return { entity: detail };
}

export async function deleteEntity(entityId: string) {
  const { supabase, tenantId } = await requireTenantId();

  const { error } = await supabase
    .from("entities")
    .delete()
    .eq("id", entityId)
    .eq("tenant_id", tenantId);

  if (error) {
    return { error: error.message };
  }

  revalidateEntityPaths();
  return { success: true as const, entityId };
}

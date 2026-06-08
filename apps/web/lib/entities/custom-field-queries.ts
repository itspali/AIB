import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  parseEntitySettingsMetadata,
  resolveEntityCustomFieldDefinitions,
  type EntityCustomFieldDefinition,
  type EntitySettingsMetadata,
} from "@/lib/entities/custom-field-definitions";
import type { EntityWorkspace } from "@/lib/entities/types";

export async function fetchTenantEntitySettingsMetadata(
  supabase: SupabaseClient,
  tenantId: string
): Promise<{ entitySettings: EntitySettingsMetadata; groupId: string | null }> {
  const { data: tenant } = await supabase
    .from("tenants")
    .select("metadata_json, group_id")
    .eq("id", tenantId)
    .maybeSingle();

  const metadata =
    tenant?.metadata_json && typeof tenant.metadata_json === "object"
      ? tenant.metadata_json
      : {};

  return {
    entitySettings: parseEntitySettingsMetadata(metadata),
    groupId: (tenant?.group_id as string | null) ?? null,
  };
}

export async function fetchGroupEntitySettingsMetadata(
  supabase: SupabaseClient,
  groupId: string
): Promise<EntitySettingsMetadata> {
  const { data: group } = await supabase
    .from("tenant_groups")
    .select("metadata_json")
    .eq("id", groupId)
    .maybeSingle();

  const metadata =
    group?.metadata_json && typeof group.metadata_json === "object"
      ? group.metadata_json
      : {};

  return parseEntitySettingsMetadata(metadata);
}

export async function fetchResolvedEntityCustomFieldDefinitions(
  supabase: SupabaseClient,
  tenantId: string,
  workspace: EntityWorkspace
): Promise<EntityCustomFieldDefinition[]> {
  const { entitySettings, groupId } = await fetchTenantEntitySettingsMetadata(supabase, tenantId);
  const groupEntitySettings = groupId
    ? await fetchGroupEntitySettingsMetadata(supabase, groupId)
    : null;

  return resolveEntityCustomFieldDefinitions(entitySettings, groupEntitySettings, workspace);
}

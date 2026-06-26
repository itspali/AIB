"use server";

import { revalidatePath } from "next/cache";
import { SETTINGS_ROUTES } from "@/lib/settings/navigation";
import {
  entitySettingsWorkspaceKey,
  sanitizeEntityCustomFieldDefinitions,
  validateEntityCustomFieldDefinitions,
  type EntityCustomFieldDefinition,
} from "@/lib/entities/custom-field-definitions";
import { fetchTenantEntitySettingsMetadata } from "@/lib/entities/custom-field-queries";
import type { EntityWorkspace } from "@/lib/entities/types";
import {
  grantDelegateSchema,
  grantPoApprovalDelegateSchema,
  organizationSettingsSchema,
} from "@/lib/organization/schemas";
import { resolveOrganizationSettingsAccess } from "@/lib/organization/access";
import { formatRpcDeployError, isMissingRpcError } from "@/lib/supabase/rpc-error";
import { requireTenantId, requireTenantMutation } from "@/lib/supabase/require-tenant";
import {
  buildDefaultProductFieldsAccessMatrix,
  parseTenantProductFieldsAccess,
  PRODUCT_FIELD_KEYS,
  type TenantProductFieldsAccess,
} from "@/lib/products/field-permissions";
import type { UserRole } from "@/lib/user/types";
import { buildTenantThemeSettingsPayload, THEME_SETTINGS_REGISTRY_KEY } from "@/lib/theme/governance";
import {
  getMissingChannelSuggestions,
  parseBusinessModel,
  type BusinessModel,
  type ChannelSuggestion,
} from "@/lib/onboarding/business-model";

const ORGANIZATION_PATHS = [SETTINGS_ROUTES.company, "/dashboard"];

export async function saveOrganizationSettings(raw: unknown) {
  const parsed = organizationSettingsSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid organization settings" };
  }

  const values = parsed.data;
  const { supabase, tenantId, userId } = await requireTenantMutation();

  const access = await resolveOrganizationSettingsAccess(supabase, userId, tenantId);
  if (!access.granted) {
    return { error: "Administrative privileges required." };
  }

  const { error: profileError } = await supabase.rpc("update_organization_governance_profile", {
    p_legal_name: values.legal_name,
    p_trade_name: values.trade_name || null,
    p_tax_identifier: values.tax_identifier || null,
    p_legal_registration_number: values.legal_registration_number || null,
    p_primary_email: values.primary_email,
    p_primary_phone: values.primary_phone,
    p_secondary_phone: values.secondary_phone || null,
    p_website_url: values.website_url || null,
    p_billing_address_line1: values.billing_address_line1 || null,
    p_billing_address_line2: values.billing_address_line2 || null,
    p_billing_city: values.billing_city || null,
    p_billing_state: values.billing_state || null,
    p_billing_zip_postal: values.billing_zip_postal || null,
    p_billing_country_code: values.billing_country_code || null,
    p_country_code: values.country_code || null,
    p_timezone: values.timezone || null,
    p_locale: values.locale || null,
    p_base_currency: values.base_currency,
    p_fiscal_year_start_month: Number(values.fiscal_year_start_month),
    p_logo_url: values.logo_url || null,
    p_accounting_config_patch: {
      inventory_valuation_method: values.inventory_valuation_method,
      allow_negative_inventory: values.allow_negative_inventory,
      multi_currency_enabled: values.multi_currency_enabled,
      credit_control_enforcement: values.credit_control_enforcement,
      scan_identifier_policy: values.scan_identifier_policy,
      sku_auto_generation_enabled: values.sku_auto_generation_enabled,
      sku_auto_pattern: values.sku_auto_pattern,
      sku_auto_prefix: values.sku_auto_prefix,
    },
    p_location_governance_config_patch: {
      multi_location_enabled: values.multi_location_enabled,
      regional_hqs_enabled: values.regional_hqs_enabled,
      central_hq_location_id: values.central_hq_location_id,
      consensual_stock_transfers: !values.restrict_cross_warehouse_transfers,
    },
  });

  if (profileError) {
    if (isMissingRpcError(profileError)) {
      return { error: formatRpcDeployError("update_organization_governance_profile") };
    }
    if (profileError.message.toLowerCase().includes("base currency cannot be changed")) {
      return {
        error:
          "Base currency is locked because inventory activity already exists in this workspace.",
      };
    }
    return { error: profileError.message };
  }

  const closingDate = values.accounting_period_closing_date
    ? new Date(values.accounting_period_closing_date).toISOString()
    : null;

  const registryCalls = await Promise.all([
    supabase.rpc("upsert_tenant_workspace_control", {
      p_registry_key: "SALES_SETTINGS",
      p_metadata_patch: {
        allow_line_item_discounts: values.allow_line_item_discounts,
      },
    }),
    supabase.rpc("upsert_tenant_workspace_control", {
      p_registry_key: "PROCUREMENT_SETTINGS",
      p_metadata_patch: {
        allow_line_item_discounts: values.allow_line_item_discounts,
        allow_transaction_discounts: values.allow_transaction_discounts,
      },
    }),
    supabase.rpc("upsert_tenant_workspace_control", {
      p_registry_key: "FINANCIAL_SETTINGS",
      p_metadata_patch: {
        accounting_period_closing_date: closingDate,
      },
    }),
    supabase.rpc("upsert_tenant_workspace_control", {
      p_registry_key: THEME_SETTINGS_REGISTRY_KEY,
      p_metadata_patch: buildTenantThemeSettingsPayload({
        default_theme: values.default_theme,
        primary_hue: values.primary_hue,
        accent_hue: values.accent_hue,
        allow_location_theme_override: values.allow_location_theme_override,
        allow_user_theme_override: values.allow_user_theme_override,
      }),
    }),
  ]);

  for (const result of registryCalls) {
    if (result.error) {
      if (isMissingRpcError(result.error)) {
        return { error: formatRpcDeployError("upsert_tenant_workspace_control") };
      }
      return { error: result.error.message };
    }
  }

  if (values.search_financial_fields_mode === "role_default") {
    const { error: clearError } = await supabase.rpc("clear_tenant_workspace_control", {
      p_registry_key: "SEARCH_SETTINGS",
    });
    if (clearError) {
      if (isMissingRpcError(clearError)) {
        return { error: formatRpcDeployError("clear_tenant_workspace_control") };
      }
      return { error: clearError.message };
    }
  } else {
    const { error: searchError } = await supabase.rpc("upsert_tenant_workspace_control", {
      p_registry_key: "SEARCH_SETTINGS",
      p_metadata_patch: {
        search_financial_fields_visible: values.search_financial_fields_mode === "enabled",
      },
    });
    if (searchError) {
      if (isMissingRpcError(searchError)) {
        return { error: formatRpcDeployError("upsert_tenant_workspace_control") };
      }
      return { error: searchError.message };
    }
  }

  for (const path of ORGANIZATION_PATHS) {
    revalidatePath(path);
  }

  return { success: true as const };
}

export async function grantOrganizationSettingsDelegate(raw: unknown) {
  const parsed = grantDelegateSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid delegate selection" };
  }

  const { supabase, tenantId, userId } = await requireTenantMutation();

  const access = await resolveOrganizationSettingsAccess(supabase, userId, tenantId);
  if (!access.canGrantDelegates) {
    return { error: "Only workspace owners can grant settings access." };
  }

  const { error } = await supabase.rpc("grant_organization_settings_delegate", {
    p_user_id: parsed.data.user_id,
  });

  if (error) {
    if (isMissingRpcError(error)) {
      return { error: formatRpcDeployError("grant_organization_settings_delegate") };
    }
    return { error: error.message };
  }

  revalidatePath(SETTINGS_ROUTES.company);
  return { success: true as const };
}

export async function revokeOrganizationSettingsDelegate(userId: string) {
  const { supabase, tenantId, userId: actorId } = await requireTenantMutation();

  const access = await resolveOrganizationSettingsAccess(supabase, actorId, tenantId);
  if (!access.canGrantDelegates) {
    return { error: "Only workspace owners can revoke settings access." };
  }

  const { error } = await supabase.rpc("revoke_organization_settings_delegate", {
    p_user_id: userId,
  });

  if (error) {
    if (isMissingRpcError(error)) {
      return { error: formatRpcDeployError("revoke_organization_settings_delegate") };
    }
    return { error: error.message };
  }

  revalidatePath(SETTINGS_ROUTES.company);
  return { success: true as const };
}

export async function grantPurchaseOrderEditDelegate(raw: unknown) {
  const parsed = grantDelegateSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid delegate selection" };
  }

  const { supabase, tenantId, userId } = await requireTenantMutation();

  const access = await resolveOrganizationSettingsAccess(supabase, userId, tenantId);
  if (!access.canGrantDelegates) {
    return { error: "Only workspace owners can grant purchase order edit access." };
  }

  const { error } = await supabase.rpc("grant_purchase_order_edit_delegate", {
    p_user_id: parsed.data.user_id,
  });

  if (error) {
    if (isMissingRpcError(error)) {
      return { error: formatRpcDeployError("grant_purchase_order_edit_delegate") };
    }
    return { error: error.message };
  }

  revalidatePath(SETTINGS_ROUTES.company);
  revalidatePath("/procurement/purchase-orders");
  return { success: true as const };
}

export async function revokePurchaseOrderEditDelegate(userId: string) {
  const { supabase, tenantId, userId: actorId } = await requireTenantMutation();

  const access = await resolveOrganizationSettingsAccess(supabase, actorId, tenantId);
  if (!access.canGrantDelegates) {
    return { error: "Only workspace owners can revoke purchase order edit access." };
  }

  const { error } = await supabase.rpc("revoke_purchase_order_edit_delegate", {
    p_user_id: userId,
  });

  if (error) {
    if (isMissingRpcError(error)) {
      return { error: formatRpcDeployError("revoke_purchase_order_edit_delegate") };
    }
    return { error: error.message };
  }

  revalidatePath(SETTINGS_ROUTES.company);
  revalidatePath("/procurement/purchase-orders");
  return { success: true as const };
}

export async function grantPoApprovalDelegate(raw: unknown) {
  const parsed = grantPoApprovalDelegateSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid approval delegate selection" };
  }

  const { supabase, tenantId, userId } = await requireTenantMutation();
  const access = await resolveOrganizationSettingsAccess(supabase, userId, tenantId);
  if (!access.canGrantDelegates) {
    return { error: "Only workspace owners can manage approval delegates." };
  }

  const { error } = await supabase.rpc("grant_po_approval_delegate", {
    p_delegate_user_id: parsed.data.delegate_user_id,
    p_delegator_user_id: parsed.data.delegator_user_id,
    p_valid_until: parsed.data.valid_until ?? null,
  });

  if (error) {
    if (isMissingRpcError(error)) {
      return { error: formatRpcDeployError("grant_po_approval_delegate") };
    }
    return { error: error.message };
  }

  revalidatePath(SETTINGS_ROUTES.company);
  revalidatePath("/approvals");
  revalidatePath("/procurement/purchase-orders");
  return { success: true as const };
}

export async function revokePoApprovalDelegate(delegatorUserId: string) {
  const { supabase, tenantId, userId: actorId } = await requireTenantMutation();

  const access = await resolveOrganizationSettingsAccess(supabase, actorId, tenantId);
  if (!access.canGrantDelegates) {
    return { error: "Only workspace owners can revoke approval delegates." };
  }

  const { error } = await supabase.rpc("revoke_po_approval_delegate", {
    p_delegator_user_id: delegatorUserId,
  });

  if (error) {
    if (isMissingRpcError(error)) {
      return { error: formatRpcDeployError("revoke_po_approval_delegate") };
    }
    return { error: error.message };
  }

  revalidatePath(SETTINGS_ROUTES.company);
  revalidatePath("/approvals");
  revalidatePath("/procurement/purchase-orders");
  return { success: true as const };
}

const PRODUCT_FIELD_ROLES: UserRole[] = ["OWNER", "ADMIN", "MANAGER", "STAFF"];

function sanitizeProductFieldsAccess(raw: unknown): TenantProductFieldsAccess {
  const source =
    raw && typeof raw === "object"
      ? (parseTenantProductFieldsAccess(raw) ?? (raw as TenantProductFieldsAccess))
      : {};

  const defaults = buildDefaultProductFieldsAccessMatrix();
  const sanitized: TenantProductFieldsAccess = {};

  for (const role of PRODUCT_FIELD_ROLES) {
    const roleAccess: Partial<Record<(typeof PRODUCT_FIELD_KEYS)[number], boolean>> = {};
    for (const field of PRODUCT_FIELD_KEYS) {
      const value = source[role]?.[field];
      roleAccess[field] =
        typeof value === "boolean" ? value : (defaults[role]?.[field] ?? true);
    }
    sanitized[role] = roleAccess;
  }

  return sanitized;
}

export async function saveProductFieldsAccess(raw: unknown) {
  if (!raw || typeof raw !== "object") {
    return { error: "Invalid product field access matrix." };
  }

  const accessMatrix = sanitizeProductFieldsAccess(raw);

  const { supabase, tenantId, userId } = await requireTenantMutation();

  const settingsAccess = await resolveOrganizationSettingsAccess(supabase, userId, tenantId);
  if (!settingsAccess.isOwner) {
    return { error: "Only workspace owners can edit product field access." };
  }

  const { error } = await supabase.rpc("patch_tenant_metadata_json", {
    p_patch: { product_fields_access: accessMatrix },
  });

  if (error) {
    if (isMissingRpcError(error)) {
      return { error: formatRpcDeployError("patch_tenant_metadata_json") };
    }
    return { error: error.message };
  }

  for (const path of ORGANIZATION_PATHS) {
    revalidatePath(path);
  }

  return { success: true as const };
}

export async function saveOrganizationEntityCustomFields(
  workspace: EntityWorkspace,
  definitions: EntityCustomFieldDefinition[]
) {
  const validationError = validateEntityCustomFieldDefinitions(definitions);
  if (validationError) {
    return { error: validationError };
  }

  const { supabase, tenantId, userId } = await requireTenantMutation();
  const access = await resolveOrganizationSettingsAccess(supabase, userId, tenantId);
  if (!access.isOwner) {
    return { error: "Only workspace owners can edit entity custom fields." };
  }

  const { entitySettings } = await fetchTenantEntitySettingsMetadata(supabase, tenantId);
  const workspaceKey = entitySettingsWorkspaceKey(workspace);
  const nextEntitySettings = {
    ...entitySettings,
    [workspaceKey]: {
      custom_field_definitions: sanitizeEntityCustomFieldDefinitions(definitions),
    },
  };

  const { error } = await supabase.rpc("patch_tenant_metadata_json", {
    p_patch: { entity_settings: nextEntitySettings },
  });

  if (error) {
    if (isMissingRpcError(error)) {
      return { error: formatRpcDeployError("patch_tenant_metadata_json") };
    }
    return { error: error.message };
  }

  for (const path of [
    ...ORGANIZATION_PATHS,
    "/sales",
    "/sales/customers",
    "/procurement/suppliers",
    "/entities",
    "/entities/customers",
    "/entities/suppliers",
  ]) {
    revalidatePath(path);
  }

  return { success: true as const };
}

export async function saveTenantReportingLines(
  lines: Array<{ user_id: string; reports_to_user_id: string | null }>
): Promise<{ success: true } | { error: string }> {
  try {
    const { supabase, tenantId, userId } = await requireTenantMutation();
    const access = await resolveOrganizationSettingsAccess(supabase, userId, tenantId);
    if (!access.granted) {
      return { error: "You do not have permission to edit reporting lines." };
    }

    const { error } = await supabase.rpc("save_tenant_reporting_lines", {
      p_lines: lines,
    });

    if (error) {
      if (isMissingRpcError(error)) {
        return { error: formatRpcDeployError("save_tenant_reporting_lines") };
      }
      return { error: error.message };
    }

    revalidatePath(SETTINGS_ROUTES.company);
    revalidatePath(SETTINGS_ROUTES.operationsProcurement);
    return { success: true as const };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Unable to save reporting lines.",
    };
  }
}

export async function saveSellingFocus(
  raw: unknown
): Promise<{ success: true; suggestions: ChannelSuggestion[] } | { error: string }> {
  const businessModel = parseBusinessModel(raw);
  const { supabase, tenantId, userId } = await requireTenantMutation();

  const access = await resolveOrganizationSettingsAccess(supabase, userId, tenantId);
  if (!access.granted) {
    return { error: "Administrative privileges required." };
  }

  const { data: tenant, error: tenantError } = await supabase
    .from("tenants")
    .select("name, metadata_json")
    .eq("id", tenantId)
    .single();

  if (tenantError || !tenant) {
    return { error: tenantError?.message ?? "Unable to load organization." };
  }

  const metadata = (tenant.metadata_json as Record<string, unknown> | null) ?? {};
  const { error: updateError } = await supabase
    .from("tenants")
    .update({
      metadata_json: { ...metadata, business_model: businessModel },
    })
    .eq("id", tenantId);

  if (updateError) {
    return { error: updateError.message };
  }

  const { data: channels } = await supabase
    .from("storefront_channels")
    .select("channel_type")
    .eq("tenant_id", tenantId);

  const existingTypes = (channels ?? []).map((row) => String(row.channel_type));
  const brandName =
    (typeof tenant.name === "string" && tenant.name.trim()) ||
    (typeof metadata.trade_name === "string" && metadata.trade_name.trim()) ||
    "Main";

  const suggestions = getMissingChannelSuggestions(businessModel, existingTypes, brandName);

  for (const path of ORGANIZATION_PATHS) {
    revalidatePath(path);
  }

  return { success: true as const, suggestions };
}

export async function requestWorkspaceDeletion(input: {
  confirmationName: string;
  backupAcknowledged: boolean;
}) {
  const trimmed = input.confirmationName.trim();
  if (!trimmed) {
    return { error: "Workspace name confirmation is required" };
  }
  if (!input.backupAcknowledged) {
    return { error: "You must acknowledge the data backup notice before scheduling deletion." };
  }

  const { supabase, tenantId, userId } = await requireTenantId();
  const access = await resolveOrganizationSettingsAccess(supabase, userId, tenantId);
  if (!access.isOwner) {
    return { error: "Workspace owner privileges required." };
  }

  const { data, error } = await supabase.rpc("request_tenant_workspace_deletion", {
    p_confirmation_name: trimmed,
    p_backup_acknowledged: true,
  });

  if (error) {
    if (isMissingRpcError(error)) {
      return { error: formatRpcDeployError("request_tenant_workspace_deletion") };
    }
    return { error: error.message };
  }

  const payload = (data ?? {}) as Record<string, unknown>;
  const scheduledPurgeAt =
    typeof payload.scheduled_purge_at === "string" ? payload.scheduled_purge_at : null;
  const graceDays = typeof payload.grace_days === "number" ? payload.grace_days : null;

  revalidatePath("/", "layout");
  for (const path of ORGANIZATION_PATHS) {
    revalidatePath(path);
  }

  return { success: true as const, scheduledPurgeAt, graceDays };
}

export async function cancelWorkspaceDeletion() {
  const { supabase, tenantId, userId } = await requireTenantId();
  const access = await resolveOrganizationSettingsAccess(supabase, userId, tenantId);
  if (!access.isOwner) {
    return { error: "Workspace owner privileges required." };
  }

  const { error } = await supabase.rpc("cancel_tenant_workspace_deletion");

  if (error) {
    if (isMissingRpcError(error)) {
      return { error: formatRpcDeployError("cancel_tenant_workspace_deletion") };
    }
    return { error: error.message };
  }

  revalidatePath("/", "layout");
  for (const path of ORGANIZATION_PATHS) {
    revalidatePath(path);
  }

  return { success: true as const };
}

/** @deprecated Use requestWorkspaceDeletion — immediate delete is disabled. */
export async function deleteWorkspace(confirmationName: string) {
  return requestWorkspaceDeletion({
    confirmationName,
    backupAcknowledged: true,
  });
}

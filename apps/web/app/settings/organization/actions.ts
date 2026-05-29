"use server";

import { revalidatePath } from "next/cache";
import {
  grantDelegateSchema,
  organizationSettingsSchema,
} from "@/lib/organization/schemas";
import { resolveOrganizationSettingsAccess } from "@/lib/organization/access";
import { buildNamingSequencesPayload } from "@/lib/naming/sequences";
import { formatRpcDeployError, isMissingRpcError } from "@/lib/supabase/rpc-error";
import { requireTenantId } from "@/lib/supabase/require-tenant";
import {
  buildDefaultProductFieldsAccessMatrix,
  parseTenantProductFieldsAccess,
  PRODUCT_FIELD_KEYS,
  type TenantProductFieldsAccess,
} from "@/lib/products/field-permissions";
import type { UserRole } from "@/lib/user/types";

const ORGANIZATION_PATHS = ["/settings/organization", "/dashboard"];

export async function saveOrganizationSettings(raw: unknown) {
  const parsed = organizationSettingsSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid organization settings" };
  }

  const values = parsed.data;
  const { supabase, tenantId } = await requireTenantId();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Not authenticated" };

  const access = await resolveOrganizationSettingsAccess(supabase, user.id, tenantId);
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
    p_base_currency: values.base_currency,
    p_fiscal_year_start_month: Number(values.fiscal_year_start_month),
    p_logo_url: values.logo_url || null,
    p_accounting_config_patch: {
      inventory_valuation_method: values.inventory_valuation_method,
      allow_negative_inventory: values.allow_negative_inventory,
      multi_currency_enabled: values.multi_currency_enabled,
      credit_control_enforcement: values.credit_control_enforcement,
    },
    p_location_governance_config_patch: {
      multi_location_enabled: values.multi_location_enabled,
      regional_hqs_enabled: values.regional_hqs_enabled,
      central_hq_location_id: values.central_hq_location_id,
      consensual_stock_transfers: !values.restrict_cross_warehouse_transfers,
    },
    p_naming_sequences: buildNamingSequencesPayload(values.naming_sequences),
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
      p_registry_key: "FINANCIAL_SETTINGS",
      p_metadata_patch: {
        accounting_period_closing_date: closingDate,
      },
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

  const { supabase, tenantId } = await requireTenantId();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const access = await resolveOrganizationSettingsAccess(supabase, user.id, tenantId);
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

  revalidatePath("/settings/organization");
  return { success: true as const };
}

export async function revokeOrganizationSettingsDelegate(userId: string) {
  const { supabase, tenantId } = await requireTenantId();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const access = await resolveOrganizationSettingsAccess(supabase, user.id, tenantId);
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

  revalidatePath("/settings/organization");
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

  const { supabase, tenantId } = await requireTenantId();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const settingsAccess = await resolveOrganizationSettingsAccess(supabase, user.id, tenantId);
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

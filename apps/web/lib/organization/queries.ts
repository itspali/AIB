import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { OrganizationCurrency } from "@/lib/organization/currency-options";
import {
  mapTenantRowToSnapshotParts,
  type DocumentSequenceRow,
  type OrganizationDelegateRow,
  type OrganizationSettingsSnapshot,
  type TenantLocationOption,
} from "@/lib/organization/types";

const DELEGATE_REGISTRY_KEY = "allow_organization_settings_modification";

function toDateOnly(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  return value;
}

export async function fetchOrganizationSettingsSnapshot(
  supabase: SupabaseClient,
  tenantId: string
): Promise<OrganizationSettingsSnapshot | null> {
  const [
    { data: tenant, error: tenantError },
    { data: documentSequences },
    { data: registryRows },
    { data: delegateRows },
    { data: locations },
    { data: eligibleUsers },
    inventoryLedgerProbe,
    itemValuationsProbe,
  ] = await Promise.all([
    supabase.from("tenants").select("*").eq("id", tenantId).maybeSingle(),
    supabase
      .from("document_sequences")
      .select("id, voucher_type, prefix, next_value, padding_length")
      .eq("tenant_id", tenantId)
      .order("voucher_type"),
    supabase
      .from("workspace_control_registry")
      .select("registry_key, configuration_metadata")
      .eq("tenant_id", tenantId)
      .eq("scope_level", "TENANT_GLOBAL")
      .is("target_reference_id", null)
      .in("registry_key", ["SALES_SETTINGS", "FINANCIAL_SETTINGS"]),
    supabase
      .from("workspace_control_registry")
      .select("target_reference_id, created_at, configuration_metadata")
      .eq("tenant_id", tenantId)
      .eq("registry_key", DELEGATE_REGISTRY_KEY)
      .not("target_reference_id", "is", null),
    supabase
      .from("tenant_locations")
      .select("id, name, code")
      .eq("tenant_id", tenantId)
      .eq("is_active", true)
      .order("name"),
    supabase
      .from("users")
      .select("id, first_name, last_name, email")
      .eq("tenant_id", tenantId)
      .eq("is_active", true)
      .order("first_name"),
    supabase.from("inventory_ledger").select("id").eq("tenant_id", tenantId).limit(1),
    supabase.from("item_valuations").select("id").eq("tenant_id", tenantId).limit(1),
  ]);

  if (tenantError || !tenant) return null;

  const parsed = mapTenantRowToSnapshotParts(tenant as Record<string, unknown>);

  let allowLineItemDiscounts = true;
  let accountingPeriodClosingDate: string | null = null;

  for (const row of registryRows ?? []) {
    const meta = row.configuration_metadata as Record<string, unknown>;
    if (row.registry_key === "SALES_SETTINGS") {
      if (typeof meta?.allow_line_item_discounts === "boolean") {
        allowLineItemDiscounts = meta.allow_line_item_discounts;
      }
    }
    if (row.registry_key === "FINANCIAL_SETTINGS") {
      accountingPeriodClosingDate = toDateOnly(meta?.accounting_period_closing_date);
    }
  }

  const delegateUserIds = (delegateRows ?? [])
    .map((row) => row.target_reference_id)
    .filter((id): id is string => Boolean(id));

  const delegateUsersById = new Map<
    string,
    { first_name: string; last_name: string; email: string }
  >();
  if (delegateUserIds.length) {
    const { data: delegateUsers } = await supabase
      .from("users")
      .select("id, first_name, last_name, email")
      .eq("tenant_id", tenantId)
      .in("id", delegateUserIds);

    for (const user of delegateUsers ?? []) {
      delegateUsersById.set(user.id, user);
    }
  }

  const delegates: OrganizationDelegateRow[] = (delegateRows ?? [])
    .map((row) => {
      if (!row.target_reference_id) return null;
      const user = delegateUsersById.get(row.target_reference_id);
      if (!user) return null;
      const meta = row.configuration_metadata as Record<string, unknown> | null;
      const grantedAt =
        typeof meta?.granted_at === "string" ? meta.granted_at : row.created_at;
      return {
        user_id: row.target_reference_id,
        first_name: user.first_name,
        last_name: user.last_name,
        email: user.email,
        granted_at: grantedAt,
      };
    })
    .filter((row): row is OrganizationDelegateRow => row !== null);

  let createdByName: string | null = null;
  if (tenant.created_by_user_id) {
    const { data: creator } = await supabase
      .from("users")
      .select("first_name, last_name")
      .eq("id", tenant.created_by_user_id)
      .maybeSingle();
    if (creator) {
      createdByName = `${creator.first_name} ${creator.last_name}`.trim();
    }
  }

  const baseCurrency = (tenant.base_currency ?? "USD") as OrganizationCurrency;
  const delegateIdSet = new Set(delegateUserIds);

  return {
    tenant_id: tenant.id,
    name: tenant.name,
    legal_name: tenant.legal_name,
    trade_name: tenant.trade_name,
    tax_identifier: tenant.tax_identifier,
    legal_registration_number: tenant.legal_registration_number,
    primary_email: tenant.primary_email,
    primary_phone: tenant.primary_phone,
    secondary_phone: tenant.secondary_phone,
    website_url: tenant.website_url,
    billing_address_line1: tenant.billing_address_line1,
    billing_address_line2: tenant.billing_address_line2,
    billing_city: tenant.billing_city,
    billing_state: tenant.billing_state,
    billing_zip_postal: tenant.billing_zip_postal,
    billing_country_code: tenant.billing_country_code,
    base_currency: baseCurrency,
    fiscal_year_start_month: tenant.fiscal_year_start_month ?? 1,
    logo_url: tenant.logo_url,
    status: tenant.status ?? "TRIAL",
    onboarding_status: tenant.onboarding_status ?? "ACCOUNT_CREATED",
    is_active: tenant.is_active !== false,
    created_by_user_id: tenant.created_by_user_id,
    created_by_name: createdByName,
    created_at: tenant.created_at,
    updated_at: tenant.updated_at,
    base_currency_locked:
      (inventoryLedgerProbe.data?.length ?? 0) > 0 ||
      (itemValuationsProbe.data?.length ?? 0) > 0,
    accounting_config: parsed.accounting_config,
    location_governance_config: parsed.location_governance_config,
    naming_sequences: parsed.naming_sequences,
    document_sequences: (documentSequences ?? []) as DocumentSequenceRow[],
    allow_line_item_discounts: allowLineItemDiscounts,
    accounting_period_closing_date: accountingPeriodClosingDate,
    delegates,
    locations: (locations ?? []) as TenantLocationOption[],
    eligible_delegate_users: (eligibleUsers ?? []).filter((user) => !delegateIdSet.has(user.id)),
  };
}

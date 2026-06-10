import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { OrganizationCurrency } from "@/lib/organization/currency-options";
import {
  mapTenantRowToSnapshotParts,
  type OrganizationDelegateRow,
  type OrganizationSettingsSnapshot,
  type SearchFinancialFieldsMode,
  type TenantLocationOption,
} from "@/lib/organization/types";
import { parseEntitySettingsMetadata } from "@/lib/entities/custom-field-definitions";
import { fetchGroupEntitySettingsMetadata } from "@/lib/entities/custom-field-queries";
import { parseTenantProductFieldsAccess } from "@/lib/products/field-permissions";
import {
  DEFAULT_TENANT_THEME_SETTINGS,
  parseTenantThemeSettings,
  THEME_SETTINGS_REGISTRY_KEY,
} from "@/lib/theme/governance";

const DELEGATE_REGISTRY_KEY = "allow_organization_settings_modification";
const PO_EDIT_DELEGATE_REGISTRY_KEY = "allow_purchase_order_modification";

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
    { data: registryRows },
    { data: delegateRows },
    { data: poEditDelegateRows },
    { data: locations },
    { data: eligibleUsers },
    inventoryLedgerProbe,
    itemValuationsProbe,
  ] = await Promise.all([
    supabase.from("tenants").select("*").eq("id", tenantId).maybeSingle(),
    supabase
      .from("workspace_control_registry")
      .select("registry_key, configuration_metadata")
      .eq("tenant_id", tenantId)
      .eq("scope_level", "TENANT_GLOBAL")
      .is("target_reference_id", null)
      .in("registry_key", [
        "SALES_SETTINGS",
        "FINANCIAL_SETTINGS",
        "SEARCH_SETTINGS",
        "PROCUREMENT_SETTINGS",
        THEME_SETTINGS_REGISTRY_KEY,
      ]),
    supabase
      .from("workspace_control_registry")
      .select("target_reference_id, created_at, configuration_metadata")
      .eq("tenant_id", tenantId)
      .eq("registry_key", DELEGATE_REGISTRY_KEY)
      .not("target_reference_id", "is", null),
    supabase
      .from("workspace_control_registry")
      .select("target_reference_id, created_at, configuration_metadata")
      .eq("tenant_id", tenantId)
      .eq("registry_key", PO_EDIT_DELEGATE_REGISTRY_KEY)
      .not("target_reference_id", "is", null),
    supabase
      .from("tenant_locations")
      .select("id, name, code")
      .eq("tenant_id", tenantId)
      .eq("is_active", true)
      .order("name"),
    supabase
      .from("user_tenant_memberships")
      .select("user_id, email")
      .eq("tenant_id", tenantId)
      .eq("is_active", true),
    supabase.from("inventory_ledger").select("id").eq("tenant_id", tenantId).limit(1),
    supabase.from("item_valuations").select("id").eq("tenant_id", tenantId).limit(1),
  ]);

  if (tenantError || !tenant) return null;

  const parsed = mapTenantRowToSnapshotParts(tenant as Record<string, unknown>);
  const tenantMetadata =
    tenant.metadata_json && typeof tenant.metadata_json === "object"
      ? (tenant.metadata_json as Record<string, unknown>)
      : {};
  const productFieldsAccess = parseTenantProductFieldsAccess(tenantMetadata.product_fields_access);
  const entitySettings = parseEntitySettingsMetadata(tenantMetadata);

  let allowLineItemDiscounts = true;
  let allowEditIssuedPurchaseOrders = false;
  let accountingPeriodClosingDate: string | null = null;
  let searchFinancialFieldsMode: SearchFinancialFieldsMode = "role_default";
  let themeSettings = DEFAULT_TENANT_THEME_SETTINGS;

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
    if (row.registry_key === "SEARCH_SETTINGS") {
      if (meta?.search_financial_fields_visible === true) {
        searchFinancialFieldsMode = "enabled";
      } else if (meta?.search_financial_fields_visible === false) {
        searchFinancialFieldsMode = "disabled";
      }
    }
    if (row.registry_key === THEME_SETTINGS_REGISTRY_KEY) {
      themeSettings = parseTenantThemeSettings(meta);
    }
    if (row.registry_key === "PROCUREMENT_SETTINGS") {
      if (typeof meta?.allow_edit_issued_purchase_orders === "boolean") {
        allowEditIssuedPurchaseOrders = meta.allow_edit_issued_purchase_orders;
      }
      if (typeof meta?.allow_line_item_discounts === "boolean") {
        allowLineItemDiscounts = meta.allow_line_item_discounts;
      }
    }
  }

  const delegateUserIds = (delegateRows ?? [])
    .map((row) => row.target_reference_id)
    .filter((id): id is string => Boolean(id));

  const poEditDelegateUserIds = (poEditDelegateRows ?? [])
    .map((row) => row.target_reference_id)
    .filter((id): id is string => Boolean(id));

  const allDelegateUserIds = [...new Set([...delegateUserIds, ...poEditDelegateUserIds])];

  const delegateUsersById = new Map<
    string,
    { first_name: string; last_name: string; email: string }
  >();
  if (allDelegateUserIds.length) {
    const { data: delegateUsers } = await supabase
      .from("users")
      .select("id, first_name, last_name, email")
      .in("id", allDelegateUserIds);

    for (const user of delegateUsers ?? []) {
      delegateUsersById.set(user.id, user);
    }
  }

  function buildDelegateList(
    rows: typeof delegateRows
  ): OrganizationDelegateRow[] {
    return (rows ?? [])
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
  }

  const delegates = buildDelegateList(delegateRows);
  const po_edit_delegates = buildDelegateList(poEditDelegateRows);

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
  const poEditDelegateIdSet = new Set(poEditDelegateUserIds);

  const eligibleMemberships = eligibleUsers ?? [];
  const eligibleUserIds = eligibleMemberships.map((row) => row.user_id as string);
  const eligibleProfilesById = new Map<
    string,
    { id: string; first_name: string; last_name: string; email: string }
  >();

  if (eligibleUserIds.length) {
    const { data: eligibleProfiles } = await supabase
      .from("users")
      .select("id, first_name, last_name, email")
      .in("id", eligibleUserIds);

    for (const user of eligibleProfiles ?? []) {
      eligibleProfilesById.set(user.id, user);
    }
  }

  const eligibleDelegateUsers = eligibleMemberships
    .map((row) => {
      const profile = eligibleProfilesById.get(row.user_id as string);
      if (!profile) return null;
      return {
        id: profile.id,
        first_name: profile.first_name,
        last_name: profile.last_name,
        email: profile.email || (row.email as string),
      };
    })
    .filter((row): row is { id: string; first_name: string; last_name: string; email: string } =>
      row !== null
    );

  let parentGroupName: string | null = null;
  const groupId = (tenant.group_id as string | null) ?? null;
  if (groupId) {
    const { data: parentGroup } = await supabase
      .from("tenant_groups")
      .select("name, trade_name")
      .eq("id", groupId)
      .maybeSingle();
    parentGroupName = parentGroup?.trade_name || parentGroup?.name || null;
  }

  const groupEntitySettings = groupId
    ? await fetchGroupEntitySettingsMetadata(supabase, groupId)
    : null;

  return {
    tenant_id: tenant.id,
    organization_code: (tenant.organization_code as string | null) ?? "",
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
    country_code: tenant.country_code ?? null,
    timezone: tenant.timezone ?? "UTC",
    locale: tenant.locale ?? "en-US",
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
    allow_line_item_discounts: allowLineItemDiscounts,
    allow_edit_issued_purchase_orders: allowEditIssuedPurchaseOrders,
    accounting_period_closing_date: accountingPeriodClosingDate,
    search_financial_fields_mode: searchFinancialFieldsMode,
    theme_settings: themeSettings,
    product_fields_access: productFieldsAccess,
    entity_settings: entitySettings,
    group_entity_settings: groupEntitySettings,
    delegates,
    po_edit_delegates,
    locations: (locations ?? []) as TenantLocationOption[],
    group_id: groupId,
    parent_group_name: parentGroupName,
    eligible_delegate_users: eligibleDelegateUsers.filter((user) => !delegateIdSet.has(user.id)),
    po_edit_eligible_delegate_users: eligibleDelegateUsers.filter(
      (user) => !poEditDelegateIdSet.has(user.id)
    ),
  };
}

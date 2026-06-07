import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { filterOperationalLocations } from "@/lib/locations/governance";
import type {
  LocationGovernanceSnapshot,
  LocationModuleContext,
  LocationRow,
  LocationTopologyRow,
  PresenceEnvironment,
  RevenueAccountOption,
} from "@/lib/locations/types";
import type { DocumentSequenceRow } from "@/lib/organization/types";
import { mapTenantRowToSnapshotParts } from "@/lib/organization/types";
import { fetchTenantThemeSettings } from "@/lib/theme/queries";
import { VALUATION_METHOD_OPTIONS } from "@/lib/organization/naming-options";
import type { ValuationMethodOption } from "@/lib/organization/naming-options";

function parseValuationCalculationRule(value: unknown): ValuationMethodOption | null {
  if (value === "FIFO" || value === "MWAC") return value;
  return null;
}

function parseDefaultInventoryValuationMethod(
  accountingConfig: Record<string, unknown> | undefined
): ValuationMethodOption {
  const method = accountingConfig?.inventory_valuation_method;
  if (typeof method === "string" && VALUATION_METHOD_OPTIONS.includes(method as ValuationMethodOption)) {
    return method as ValuationMethodOption;
  }
  return "FIFO";
}

function mapLocationRow(row: Record<string, unknown>): LocationRow {
  return {
    id: String(row.id),
    parent_location_id: row.parent_location_id ? String(row.parent_location_id) : null,
    name: String(row.name),
    code: String(row.code),
    presence_type: (row.presence_type as PresenceEnvironment) ?? "PHYSICAL",
    is_administrative_office: Boolean(row.is_administrative_office),
    is_commercial_storefront: Boolean(row.is_commercial_storefront),
    is_manufacturing_floor: Boolean(row.is_manufacturing_floor),
    is_stock_holding: Boolean(row.is_stock_holding),
    pos_terminal_count: Number(row.pos_terminal_count ?? 0),
    valuation_calculation_rule: parseValuationCalculationRule(row.valuation_calculation_rule),
    address_line1: String(row.address_line1),
    address_line2: row.address_line2 ? String(row.address_line2) : null,
    city: String(row.city),
    state: String(row.state),
    zip_postal: String(row.zip_postal),
    country_code: String(row.country_code),
    manager_name: row.manager_name ? String(row.manager_name) : null,
    contact_email: row.contact_email ? String(row.contact_email) : null,
    contact_phone: row.contact_phone ? String(row.contact_phone) : null,
    is_active: Boolean(row.is_active),
    location_tax_identifier: row.location_tax_identifier
      ? String(row.location_tax_identifier)
      : null,
    tax_registered_name: row.tax_registered_name ? String(row.tax_registered_name) : null,
    location_meta:
      row.location_meta && typeof row.location_meta === "object"
        ? (row.location_meta as Record<string, unknown>)
        : {},
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

function mapTopologyRow(row: Record<string, unknown>): LocationTopologyRow {
  return {
    id: String(row.id),
    parent_location_id: row.parent_location_id ? String(row.parent_location_id) : null,
    name: String(row.name),
    code: String(row.code),
    presence_type: (row.presence_type as PresenceEnvironment) ?? "PHYSICAL",
    is_administrative_office: Boolean(row.is_administrative_office),
    is_commercial_storefront: Boolean(row.is_commercial_storefront),
    is_manufacturing_floor: Boolean(row.is_manufacturing_floor),
    is_stock_holding: Boolean(row.is_stock_holding),
    pos_terminal_count: Number(row.pos_terminal_count ?? 0),
    valuation_calculation_rule: parseValuationCalculationRule(row.valuation_calculation_rule),
    is_active: Boolean(row.is_active),
    address_line1: String(row.address_line1),
    address_line2: row.address_line2 ? String(row.address_line2) : null,
    city: String(row.city),
    state: String(row.state),
    zip_postal: String(row.zip_postal),
    country_code: String(row.country_code),
    manager_name: row.manager_name ? String(row.manager_name) : null,
    contact_email: row.contact_email ? String(row.contact_email) : null,
    contact_phone: row.contact_phone ? String(row.contact_phone) : null,
    depth: Number(row.depth ?? 0),
    path: Array.isArray(row.path) ? row.path.map(String) : [],
    child_count: Number(row.child_count ?? 0),
  };
}

export async function fetchLocationGovernanceSnapshot(
  supabase: SupabaseClient,
  tenantId: string
): Promise<LocationGovernanceSnapshot | null> {
  const { data, error } = await supabase
    .from("tenants")
    .select("location_governance_config")
    .eq("id", tenantId)
    .maybeSingle();

  if (error || !data) return null;
  return mapTenantRowToSnapshotParts(data as Record<string, unknown>).location_governance_config;
}

export async function fetchLocationRows(
  supabase: SupabaseClient,
  tenantId: string
): Promise<LocationRow[]> {
  const { data, error } = await supabase
    .from("tenant_locations")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("name");

  if (error || !data) return [];
  return filterOperationalLocations(data.map((row) => mapLocationRow(row as Record<string, unknown>)));
}

export async function fetchLocationTopologyRows(
  supabase: SupabaseClient
): Promise<LocationTopologyRow[]> {
  const { data, error } = await supabase.rpc("get_tenant_location_topology");

  if (error || !data) return [];
  return (data as Record<string, unknown>[]).map(mapTopologyRow);
}

export async function fetchRevenueAccounts(
  supabase: SupabaseClient,
  tenantId: string
): Promise<RevenueAccountOption[]> {
  const { data, error } = await supabase
    .from("accounts")
    .select("id, account_code, account_name")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .eq("classification", "REVENUE")
    .order("account_code");

  if (error || !data) return [];

  return data.map((row) => ({
    id: String(row.id),
    account_code: String(row.account_code),
    account_name: String(row.account_name),
  }));
}

export async function fetchLocationDocumentSequenceMap(
  supabase: SupabaseClient,
  tenantId: string
): Promise<Record<string, DocumentSequenceRow[]>> {
  const { data, error } = await supabase
    .from("document_sequences")
    .select("id, voucher_type, prefix, next_value, padding_length, location_id")
    .eq("tenant_id", tenantId)
    .not("location_id", "is", null)
    .order("voucher_type");

  if (error || !data) return {};

  const grouped: Record<string, DocumentSequenceRow[]> = {};
  for (const row of data) {
    const locationId = row.location_id ? String(row.location_id) : null;
    if (!locationId) continue;
    const mapped: DocumentSequenceRow = {
      id: String(row.id),
      voucher_type: String(row.voucher_type),
      prefix: String(row.prefix),
      next_value: Number(row.next_value),
      padding_length: Number(row.padding_length),
      location_id: locationId,
    };
    grouped[locationId] = [...(grouped[locationId] ?? []), mapped];
  }

  return grouped;
}

export async function fetchLocationModuleContext(
  supabase: SupabaseClient,
  tenantId: string,
  canManage: boolean
): Promise<LocationModuleContext | null> {
  const [governance, revenueAccounts, documentSequencesByLocationId, tenantRow, themeSettings] =
    await Promise.all([
      fetchLocationGovernanceSnapshot(supabase, tenantId),
      fetchRevenueAccounts(supabase, tenantId),
      fetchLocationDocumentSequenceMap(supabase, tenantId),
      supabase.from("tenants").select("accounting_config").eq("id", tenantId).maybeSingle(),
      fetchTenantThemeSettings(supabase, tenantId),
    ]);
  if (!governance) return null;

  const accountingConfig =
    tenantRow.data?.accounting_config && typeof tenantRow.data.accounting_config === "object"
      ? (tenantRow.data.accounting_config as Record<string, unknown>)
      : undefined;

  return {
    governance,
    centralHqLocationId: governance.central_hq_location_id,
    canManage,
    themeSettings,
    defaultInventoryValuationMethod: parseDefaultInventoryValuationMethod(accountingConfig),
    revenueAccounts,
    documentSequencesByLocationId,
  };
}

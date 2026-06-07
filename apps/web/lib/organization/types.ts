import type { DomRoutingConfig } from "@/lib/locations/dom-routing";
import { parseDomRoutingConfig } from "@/lib/locations/dom-routing";
import type { CreditControlEnforcement } from "@/lib/organization/credit-control-options";
import type { OrganizationCurrency } from "@/lib/organization/currency-options";
import type { CountryCode } from "@/lib/organization/country-options";
import type { TenantProductFieldsAccess } from "@/lib/products/field-permissions";
import {
  DEFAULT_TENANT_THEME_SETTINGS,
  type TenantThemeSettings,
} from "@/lib/theme/governance";
import type { Theme } from "@/lib/theme/themes";
import {
  DEFAULT_CATALOG_ITEM_SETTINGS,
  isScanIdentifierPolicy,
  type CatalogItemSettings,
  type ScanIdentifierPolicy,
} from "@/lib/products/catalog-item-settings";

export type { CatalogItemSettings, ScanIdentifierPolicy };

export type OrganizationAccountingConfig = {
  inventory_valuation_method: string;
  allow_negative_inventory: boolean;
  multi_currency_enabled: boolean;
  credit_control_enforcement: CreditControlEnforcement;
  catalog_items: CatalogItemSettings;
};

export type OrganizationLocationGovernanceConfig = {
  multi_location_enabled: boolean;
  regional_hqs_enabled: boolean;
  central_hq_location_id: string | null;
  consensual_stock_transfers: boolean;
  dom_routing?: DomRoutingConfig;
};

export type DocumentSequenceRow = {
  id: string;
  voucher_type: string;
  prefix: string;
  next_value: number;
  padding_length: number;
  location_id?: string | null;
};

export type OrganizationDelegateRow = {
  user_id: string;
  first_name: string;
  last_name: string;
  email: string;
  granted_at: string;
};

export type TenantLocationOption = {
  id: string;
  name: string;
  code: string;
};

export type SearchFinancialFieldsMode = "role_default" | "enabled" | "disabled";

export type OrganizationSettingsSnapshot = {
  tenant_id: string;
  name: string;
  legal_name: string | null;
  trade_name: string | null;
  tax_identifier: string | null;
  legal_registration_number: string | null;
  primary_email: string;
  primary_phone: string;
  secondary_phone: string | null;
  website_url: string | null;
  billing_address_line1: string | null;
  billing_address_line2: string | null;
  billing_city: string | null;
  billing_state: string | null;
  billing_zip_postal: string | null;
  billing_country_code: string | null;
  country_code: string | null;
  timezone: string;
  locale: string;
  base_currency: OrganizationCurrency;
  fiscal_year_start_month: number;
  logo_url: string | null;
  status: string;
  onboarding_status: string;
  is_active: boolean;
  created_by_user_id: string | null;
  created_by_name: string | null;
  created_at: string;
  updated_at: string;
  base_currency_locked: boolean;
  accounting_config: OrganizationAccountingConfig;
  location_governance_config: OrganizationLocationGovernanceConfig;
  allow_line_item_discounts: boolean;
  accounting_period_closing_date: string | null;
  search_financial_fields_mode: SearchFinancialFieldsMode;
  theme_settings: TenantThemeSettings;
  product_fields_access: TenantProductFieldsAccess | null;
  delegates: OrganizationDelegateRow[];
  locations: TenantLocationOption[];
  eligible_delegate_users: Array<{ id: string; first_name: string; last_name: string; email: string }>;
};

export type OrganizationSettingsFormValues = {
  legal_name: string;
  trade_name: string;
  tax_identifier: string;
  legal_registration_number: string;
  primary_email: string;
  primary_phone: string;
  secondary_phone: string;
  website_url: string;
  billing_address_line1: string;
  billing_address_line2: string;
  billing_city: string;
  billing_state: string;
  billing_zip_postal: string;
  billing_country_code: CountryCode | "";
  country_code: CountryCode | "";
  timezone: string;
  locale: string;
  base_currency: OrganizationCurrency;
  fiscal_year_start_month: string;
  logo_url: string;
  multi_location_enabled: boolean;
  regional_hqs_enabled: boolean;
  central_hq_location_id: string | null;
  restrict_cross_warehouse_transfers: boolean;
  inventory_valuation_method: string;
  allow_negative_inventory: boolean;
  multi_currency_enabled: boolean;
  credit_control_enforcement: CreditControlEnforcement;
  scan_identifier_policy: ScanIdentifierPolicy;
  sku_auto_generation_enabled: boolean;
  sku_auto_pattern: string;
  sku_auto_prefix: string;
  allow_line_item_discounts: boolean;
  accounting_period_closing_date: string;
  search_financial_fields_mode: SearchFinancialFieldsMode;
  default_theme: Theme;
  primary_hue: number | null;
  accent_hue: number | null;
  allow_location_theme_override: boolean;
  allow_user_theme_override: boolean;
  show_advanced: boolean;
};

function parseAccountingConfig(raw: unknown): OrganizationAccountingConfig {
  const config =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const enforcement = config.credit_control_enforcement;
  return {
    inventory_valuation_method:
      typeof config.inventory_valuation_method === "string"
        ? config.inventory_valuation_method
        : "FIFO",
    allow_negative_inventory: Boolean(config.allow_negative_inventory),
    multi_currency_enabled: config.multi_currency_enabled !== false,
    credit_control_enforcement:
      enforcement === "WARN" || enforcement === "OFF" ? enforcement : "STRICT",
    catalog_items: parseCatalogItemSettingsFromAccounting(config),
  };
}

function parseCatalogItemSettingsFromAccounting(
  config: Record<string, unknown>
): CatalogItemSettings {
  const policy = config.scan_identifier_policy;
  return {
    scan_identifier_policy: isScanIdentifierPolicy(String(policy ?? ""))
      ? policy
      : DEFAULT_CATALOG_ITEM_SETTINGS.scan_identifier_policy,
    sku_auto_generation_enabled: Boolean(config.sku_auto_generation_enabled),
    sku_auto_pattern:
      typeof config.sku_auto_pattern === "string" && config.sku_auto_pattern.trim()
        ? config.sku_auto_pattern.trim()
        : DEFAULT_CATALOG_ITEM_SETTINGS.sku_auto_pattern,
    sku_auto_prefix:
      typeof config.sku_auto_prefix === "string" && config.sku_auto_prefix.trim()
        ? config.sku_auto_prefix.trim()
        : DEFAULT_CATALOG_ITEM_SETTINGS.sku_auto_prefix,
  };
}

function parseLocationGovernance(raw: unknown): OrganizationLocationGovernanceConfig {
  const config =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const hq = config.central_hq_location_id;
  const centralHq = typeof hq === "string" ? hq : null;
  return {
    multi_location_enabled: config.multi_location_enabled !== false,
    regional_hqs_enabled: Boolean(config.regional_hqs_enabled),
    central_hq_location_id: centralHq,
    consensual_stock_transfers: config.consensual_stock_transfers !== false,
    dom_routing: parseDomRoutingConfig(config.dom_routing, centralHq),
  };
}

export function snapshotToFormValues(
  snapshot: OrganizationSettingsSnapshot
): OrganizationSettingsFormValues {
  const lg = snapshot.location_governance_config;
  return {
    legal_name: snapshot.legal_name ?? "",
    trade_name: snapshot.trade_name ?? "",
    tax_identifier: snapshot.tax_identifier ?? "",
    legal_registration_number: snapshot.legal_registration_number ?? "",
    primary_email: snapshot.primary_email,
    primary_phone: snapshot.primary_phone,
    secondary_phone: snapshot.secondary_phone ?? "",
    website_url: snapshot.website_url ?? "",
    billing_address_line1: snapshot.billing_address_line1 ?? "",
    billing_address_line2: snapshot.billing_address_line2 ?? "",
    billing_city: snapshot.billing_city ?? "",
    billing_state: snapshot.billing_state ?? "",
    billing_zip_postal: snapshot.billing_zip_postal ?? "",
    billing_country_code: (snapshot.billing_country_code as CountryCode | null) ?? "",
    country_code: (snapshot.country_code as CountryCode | null) ?? "",
    timezone: snapshot.timezone,
    locale: snapshot.locale,
    base_currency: snapshot.base_currency,
    fiscal_year_start_month: String(snapshot.fiscal_year_start_month),
    logo_url: snapshot.logo_url ?? "",
    multi_location_enabled: lg.multi_location_enabled,
    regional_hqs_enabled: lg.regional_hqs_enabled,
    central_hq_location_id: lg.central_hq_location_id,
    restrict_cross_warehouse_transfers: !lg.consensual_stock_transfers,
    inventory_valuation_method: snapshot.accounting_config.inventory_valuation_method,
    allow_negative_inventory: snapshot.accounting_config.allow_negative_inventory,
    multi_currency_enabled: snapshot.accounting_config.multi_currency_enabled,
    credit_control_enforcement: snapshot.accounting_config.credit_control_enforcement,
    scan_identifier_policy: snapshot.accounting_config.catalog_items.scan_identifier_policy,
    sku_auto_generation_enabled:
      snapshot.accounting_config.catalog_items.sku_auto_generation_enabled,
    sku_auto_pattern: snapshot.accounting_config.catalog_items.sku_auto_pattern,
    sku_auto_prefix: snapshot.accounting_config.catalog_items.sku_auto_prefix,
    allow_line_item_discounts: snapshot.allow_line_item_discounts,
    accounting_period_closing_date: snapshot.accounting_period_closing_date
      ? snapshot.accounting_period_closing_date.slice(0, 10)
      : "",
    search_financial_fields_mode: snapshot.search_financial_fields_mode,
    default_theme: snapshot.theme_settings.default_theme,
    primary_hue: snapshot.theme_settings.primary_hue,
    accent_hue: snapshot.theme_settings.accent_hue,
    allow_location_theme_override: snapshot.theme_settings.allow_location_theme_override,
    allow_user_theme_override: snapshot.theme_settings.allow_user_theme_override,
    show_advanced: Boolean(
      snapshot.logo_url ||
        snapshot.secondary_phone ||
        snapshot.website_url ||
        !lg.consensual_stock_transfers ||
        !lg.multi_location_enabled ||
        lg.regional_hqs_enabled ||
        lg.central_hq_location_id ||
        snapshot.accounting_config.allow_negative_inventory ||
        !snapshot.accounting_config.multi_currency_enabled ||
        snapshot.accounting_config.credit_control_enforcement !== "STRICT" ||
        !snapshot.allow_line_item_discounts ||
        snapshot.accounting_period_closing_date ||
        snapshot.search_financial_fields_mode !== "role_default" ||
        snapshot.theme_settings.default_theme !== DEFAULT_TENANT_THEME_SETTINGS.default_theme ||
        snapshot.theme_settings.primary_hue !== null ||
        snapshot.theme_settings.accent_hue !== null ||
        snapshot.theme_settings.allow_location_theme_override ||
        !snapshot.theme_settings.allow_user_theme_override
    ),
  };
}

export function mapTenantRowToSnapshotParts(row: Record<string, unknown>) {
  return {
    accounting_config: parseAccountingConfig(row.accounting_config),
    location_governance_config: parseLocationGovernance(row.location_governance_config),
  };
}

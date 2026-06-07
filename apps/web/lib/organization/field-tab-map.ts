import { ORG_SETTINGS_TAB_IDS, type OrgSettingsTabId } from "@/lib/organization/section-nav";
import type { OrganizationSettingsFormValues } from "@/lib/organization/types";

const FIELD_TAB: Partial<Record<keyof OrganizationSettingsFormValues, OrgSettingsTabId>> = {
  legal_name: ORG_SETTINGS_TAB_IDS.identity,
  trade_name: ORG_SETTINGS_TAB_IDS.identity,
  tax_identifier: ORG_SETTINGS_TAB_IDS.identity,
  legal_registration_number: ORG_SETTINGS_TAB_IDS.identity,
  primary_email: ORG_SETTINGS_TAB_IDS.identity,
  primary_phone: ORG_SETTINGS_TAB_IDS.identity,
  country_code: ORG_SETTINGS_TAB_IDS.regional,
  timezone: ORG_SETTINGS_TAB_IDS.regional,
  locale: ORG_SETTINGS_TAB_IDS.regional,
  billing_address_line1: ORG_SETTINGS_TAB_IDS.billingFiscal,
  billing_address_line2: ORG_SETTINGS_TAB_IDS.billingFiscal,
  billing_city: ORG_SETTINGS_TAB_IDS.billingFiscal,
  billing_state: ORG_SETTINGS_TAB_IDS.billingFiscal,
  billing_zip_postal: ORG_SETTINGS_TAB_IDS.billingFiscal,
  billing_country_code: ORG_SETTINGS_TAB_IDS.billingFiscal,
  base_currency: ORG_SETTINGS_TAB_IDS.billingFiscal,
  fiscal_year_start_month: ORG_SETTINGS_TAB_IDS.billingFiscal,
  logo_url: ORG_SETTINGS_TAB_IDS.branding,
  secondary_phone: ORG_SETTINGS_TAB_IDS.branding,
  website_url: ORG_SETTINGS_TAB_IDS.branding,
  default_theme: ORG_SETTINGS_TAB_IDS.branding,
  primary_hue: ORG_SETTINGS_TAB_IDS.branding,
  accent_hue: ORG_SETTINGS_TAB_IDS.branding,
  allow_location_theme_override: ORG_SETTINGS_TAB_IDS.branding,
  allow_user_theme_override: ORG_SETTINGS_TAB_IDS.branding,
  multi_location_enabled: ORG_SETTINGS_TAB_IDS.locations,
  regional_hqs_enabled: ORG_SETTINGS_TAB_IDS.locations,
  central_hq_location_id: ORG_SETTINGS_TAB_IDS.locations,
  restrict_cross_warehouse_transfers: ORG_SETTINGS_TAB_IDS.locations,
  inventory_valuation_method: ORG_SETTINGS_TAB_IDS.accounting,
  allow_negative_inventory: ORG_SETTINGS_TAB_IDS.accounting,
  multi_currency_enabled: ORG_SETTINGS_TAB_IDS.accounting,
  credit_control_enforcement: ORG_SETTINGS_TAB_IDS.accounting,
  scan_identifier_policy: ORG_SETTINGS_TAB_IDS.accounting,
  sku_auto_generation_enabled: ORG_SETTINGS_TAB_IDS.accounting,
  sku_auto_pattern: ORG_SETTINGS_TAB_IDS.accounting,
  sku_auto_prefix: ORG_SETTINGS_TAB_IDS.accounting,
  allow_line_item_discounts: ORG_SETTINGS_TAB_IDS.accounting,
  accounting_period_closing_date: ORG_SETTINGS_TAB_IDS.accounting,
  search_financial_fields_mode: ORG_SETTINGS_TAB_IDS.access,
};

export function tabForField(field: keyof OrganizationSettingsFormValues): OrgSettingsTabId | null {
  return FIELD_TAB[field] ?? null;
}

export function firstErrorTab(
  errors: Partial<Record<keyof OrganizationSettingsFormValues, unknown>>
): OrgSettingsTabId | null {
  for (const field of Object.keys(errors) as Array<keyof OrganizationSettingsFormValues>) {
    const tab = tabForField(field);
    if (tab) return tab;
  }
  return null;
}

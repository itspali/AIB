import {
  ORG_SETTINGS_TAB_IDS,
  ORG_SETTINGS_TABS,
  type OrgSettingsTabId,
} from "@/lib/organization/section-nav";
import { tabForField } from "@/lib/organization/field-tab-map";
import type {
  OrganizationSettingsFormValues,
  OrganizationSettingsSnapshot,
} from "@/lib/organization/types";
import { cn } from "@/lib/utils";

export type OrgSectionStatus = "error" | "complete" | "empty";

function hasText(value: string | null | undefined): boolean {
  return Boolean(value?.trim());
}

export function buildSectionErrorMap(
  errors: Partial<Record<keyof OrganizationSettingsFormValues, unknown>>
): Record<OrgSettingsTabId, boolean> {
  const map = Object.fromEntries(
    ORG_SETTINGS_TABS.map((tab) => [tab.id, false])
  ) as Record<OrgSettingsTabId, boolean>;

  for (const key of Object.keys(errors) as Array<keyof OrganizationSettingsFormValues>) {
    const section = tabForField(key);
    if (section) map[section] = true;
  }

  return map;
}

export function orgSectionStatus(
  sectionId: OrgSettingsTabId,
  values: OrganizationSettingsFormValues,
  snapshot: OrganizationSettingsSnapshot,
  sectionErrors: Record<OrgSettingsTabId, boolean>
): OrgSectionStatus {
  if (sectionErrors[sectionId]) return "error";

  switch (sectionId) {
    case ORG_SETTINGS_TAB_IDS.identity:
      return hasText(values.legal_name) &&
        hasText(values.primary_email) &&
        hasText(values.primary_phone) &&
        values.primary_phone !== "PENDING"
        ? "complete"
        : "empty";

    case ORG_SETTINGS_TAB_IDS.regional:
      return hasText(values.country_code) && hasText(values.timezone) && hasText(values.locale)
        ? "complete"
        : "empty";

    case ORG_SETTINGS_TAB_IDS.billingFiscal:
      return hasText(values.billing_address_line1) &&
        hasText(values.billing_city) &&
        hasText(values.billing_country_code) &&
        hasText(values.base_currency) &&
        hasText(values.fiscal_year_start_month)
        ? "complete"
        : "empty";

    case ORG_SETTINGS_TAB_IDS.branding:
      return hasText(values.logo_url) ||
        hasText(values.website_url) ||
        hasText(values.secondary_phone) ||
        values.primary_hue !== null ||
        values.accent_hue !== null ||
        values.default_theme !== "dark" ||
        values.allow_location_theme_override ||
        !values.allow_user_theme_override
        ? "complete"
        : "empty";

    case ORG_SETTINGS_TAB_IDS.locations:
      return snapshot.locations.length > 0 ? "complete" : "empty";

    case ORG_SETTINGS_TAB_IDS.accounting:
      return hasText(values.inventory_valuation_method) &&
        hasText(values.credit_control_enforcement)
        ? "complete"
        : "empty";

    case ORG_SETTINGS_TAB_IDS.access:
      return snapshot.delegates.length > 0 ||
        values.search_financial_fields_mode !== "role_default" ||
        snapshot.product_fields_access !== null
        ? "complete"
        : "empty";

    default:
      return "empty";
  }
}

export function OrgSectionStatusDot({ status }: { status: OrgSectionStatus }) {
  return (
    <span
      aria-hidden
      className={cn(
        "h-2 w-2 shrink-0 rounded-full",
        status === "error" && "bg-destructive",
        status === "complete" && "bg-emerald-500",
        status === "empty" && "bg-muted-foreground/30"
      )}
    />
  );
}

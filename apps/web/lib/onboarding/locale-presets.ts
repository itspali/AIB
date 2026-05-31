import type { TaxRateRow } from "@/lib/onboarding/types";
import {
  INDIA_COA_TEMPLATE,
  US_COA_TEMPLATE,
  VAT_COA_TEMPLATE,
  type CoaAccountTemplate,
} from "@/lib/onboarding/coa-template";

export type SupportedCountryCode = "US" | "IN" | "GB" | "AU" | "CA";

export const COUNTRY_OPTIONS: { code: SupportedCountryCode; label: string }[] = [
  { code: "US", label: "United States" },
  { code: "IN", label: "India" },
  { code: "GB", label: "United Kingdom" },
  { code: "AU", label: "Australia" },
  { code: "CA", label: "Canada" },
];

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

const INDIA_TAX_DEFAULTS: TaxRateRow[] = [
  {
    tax_component_name: "CGST_9",
    tax_percentage: "9.00",
    active_from_date: todayIsoDate(),
    legal_compliance_code: "HSN",
  },
  {
    tax_component_name: "SGST_9",
    tax_percentage: "9.00",
    active_from_date: todayIsoDate(),
    legal_compliance_code: "HSN",
  },
  {
    tax_component_name: "IGST_18",
    tax_percentage: "18.00",
    active_from_date: todayIsoDate(),
    legal_compliance_code: "HSN",
  },
];

const US_TAX_DEFAULTS: TaxRateRow[] = [
  {
    tax_component_name: "STATE_SALES_TAX",
    tax_percentage: "0.00",
    active_from_date: todayIsoDate(),
    legal_compliance_code: "SALES",
  },
];

const GENERIC_TAX_DEFAULTS: TaxRateRow[] = [
  {
    tax_component_name: "STANDARD_VAT",
    tax_percentage: "0.00",
    active_from_date: todayIsoDate(),
    legal_compliance_code: "VAT",
  },
];

export function defaultTaxRatesForCountry(countryCode: string): TaxRateRow[] {
  const code = countryCode.toUpperCase();
  if (code === "IN") return INDIA_TAX_DEFAULTS.map((row) => ({ ...row }));
  if (code === "US") return US_TAX_DEFAULTS.map((row) => ({ ...row }));
  return GENERIC_TAX_DEFAULTS.map((row) => ({ ...row }));
}

export function coaTemplateForCountry(countryCode: string): {
  template: CoaAccountTemplate[];
  label: string;
} {
  const code = countryCode.toUpperCase();
  if (code === "IN") {
    return { template: INDIA_COA_TEMPLATE.map((row) => ({ ...row })), label: "India GST compliance" };
  }
  if (code === "US") {
    return { template: US_COA_TEMPLATE.map((row) => ({ ...row })), label: "United States standard" };
  }
  return { template: VAT_COA_TEMPLATE.map((row) => ({ ...row })), label: "International VAT standard" };
}

export function usesIndiaCoaTemplate(countryCode: string): boolean {
  return countryCode.toUpperCase() === "IN";
}

export function humanOnboardingStatus(status: string, progressPercent: number): string {
  if (status === "GO_LIVE_READY") return "Ready to operate";
  if (status === "COMPLIANCE_VERIFIED") return "Final step — sales channels";
  if (status === "DATABASE_SEEDED") return "Tax and compliance setup";
  if (status === "ORGANIZATION_CONFIGURED") return "Financial setup in progress";
  if (progressPercent >= 100) return "Launching workspace";
  return "Workspace setup in progress";
}

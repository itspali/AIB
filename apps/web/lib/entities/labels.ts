import type { EntityCommercialType, TaxTreatmentType } from "@/lib/entities/types";

export type TaxTreatmentLabel = {
  label: string;
  description: string;
};

/** UI label map from Milestone 2 entities migration blueprint. */
export const TAX_TREATMENT_LABELS: Record<TaxTreatmentType, TaxTreatmentLabel> = {
  REGULAR_B2B: {
    label: "Registered Business",
    description: "Standard local business with a valid Tax ID",
  },
  UNREGISTERED_B2C: {
    label: "Unregistered / Consumer",
    description: "Retail clients or entities without a tax number",
  },
  COMPOSITION: {
    label: "Composition Scheme",
    description: "Small businesses under flat-rate tax tiers",
  },
  SEZ_DEVELOPER: {
    label: "SEZ Developer / Unit",
    description: "Located in a Special Economic Zone — Zero-Rated",
  },
  OVERSEAS_EXPORT: {
    label: "Overseas International",
    description: "Foreign entities outside national borders",
  },
  DEEMED_EXPORT: {
    label: "Deemed Export",
    description: "Supplies treated as exports under local tax rules",
  },
};

export const ENTITY_TYPE_LABELS: Record<EntityCommercialType, string> = {
  CUSTOMER: "Customer",
  SUPPLIER: "Supplier",
  MUTUAL_PARTNER: "Customer & Supplier",
};

export function getTaxTreatmentLabel(taxTreatment: TaxTreatmentType): string {
  return TAX_TREATMENT_LABELS[taxTreatment].label;
}

export function getEntityTypeLabel(type: EntityCommercialType): string {
  return ENTITY_TYPE_LABELS[type];
}

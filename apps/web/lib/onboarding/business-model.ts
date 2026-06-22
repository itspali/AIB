import type { GettingStartedTaskId } from "@/lib/dashboard/getting-started";
import type { ChannelFormValues, OnboardingDraft } from "@/lib/onboarding/types";

export type BusinessModel = "D2C" | "B2B" | "BOTH";

export const BUSINESS_MODEL_OPTIONS: {
  value: BusinessModel;
  label: string;
  description: string;
}[] = [
  {
    value: "D2C",
    label: "Sell to consumers",
    description: "Online store, retail, or direct-to-consumer brand",
  },
  {
    value: "B2B",
    label: "Sell to businesses",
    description: "Wholesale, distribution, or trade sales",
  },
  {
    value: "BOTH",
    label: "Both",
    description: "Consumer storefront and business customers",
  },
];

const DEFAULT_MODEL: BusinessModel = "BOTH";

export function parseBusinessModel(value: unknown): BusinessModel {
  if (value === "D2C" || value === "B2B" || value === "BOTH") return value;
  return DEFAULT_MODEL;
}

export function resolveBusinessModelFromMetadata(
  metadata: Record<string, unknown> | null | undefined
): BusinessModel {
  if (!metadata) return DEFAULT_MODEL;
  return parseBusinessModel(metadata.business_model);
}

export function resolveBusinessModelFromDraft(draft: OnboardingDraft | undefined): BusinessModel {
  if (draft?.business_model) return parseBusinessModel(draft.business_model);
  return DEFAULT_MODEL;
}

export type SignupCopy = {
  title: string;
  description: string;
  nameFieldLabel: string;
  businessNameLabel: string;
  countryHelper: string;
  submitLabel: string;
  resumeTitle: string;
  resumeDescription: string;
};

export type ProfileCopy = {
  stepTitle: string;
  businessNameLabel: string;
  locationSectionTitle: string;
  locationSectionHint: string;
  locationNameLabel: string;
  compliancePanelTitle: string;
  compliancePanelHint: string;
  taxIdLabel: string;
  registrationLabel: string;
  defaultComplianceExpanded: boolean;
};

export type FinanceSetupCopy = {
  stepTitle: string;
  summaryTitle: string;
  summaryDescription: string;
  applyButton: string;
  customizeHint: string;
};

export type FinanceSetupReminderCopy = {
  title: string;
  description: string;
  cta: string;
};

export const NEUTRAL_SIGNUP_COPY: SignupCopy = {
  title: "Create your workspace",
  description: "Set up your account and start managing inventory, sales, and finance.",
  nameFieldLabel: "Your name",
  businessNameLabel: "Business name",
  countryHelper: "Sets tax rules and accounting templates for your market.",
  submitLabel: "Create account and continue",
  resumeTitle: "Finish workspace setup",
  resumeDescription: "Your account is ready. Add a few details to continue.",
};

export const NEUTRAL_PROFILE_COPY: ProfileCopy = {
  stepTitle: "Business details",
  businessNameLabel: "Business name",
  locationSectionTitle: "Primary location",
  locationSectionHint:
    "You can add warehouses and other locations later in Settings → Locations.",
  locationNameLabel: "Location name",
  compliancePanelTitle: "Tax and registration details",
  compliancePanelHint:
    "Add before you issue tax invoices. You can update this anytime in Settings.",
  taxIdLabel: "Tax ID (GSTIN / EIN / VAT)",
  registrationLabel: "Business registration number",
  defaultComplianceExpanded: false,
};

export const NEUTRAL_FINANCE_SETUP_COPY: FinanceSetupCopy = {
  stepTitle: "Finance and selling setup",
  summaryTitle: "Recommended setup",
  summaryDescription:
    "We will apply a chart of accounts, tax rates, and sales channels based on your selling focus and country.",
  applyButton: "Apply recommended setup",
  customizeHint: "You can adjust accounts, tax rates, and channels later in Settings.",
};

export const NEUTRAL_FINANCE_REMINDER_COPY: FinanceSetupReminderCopy = {
  title: "Finish finance setup",
  description:
    "Apply recommended accounts, tax, and channel defaults before you create purchase orders or invoices.",
  cta: "Complete setup",
};

/** @deprecated Use NEUTRAL_SIGNUP_COPY */
export function getSignupCopy(_model?: BusinessModel): SignupCopy {
  return NEUTRAL_SIGNUP_COPY;
}

/** @deprecated Use NEUTRAL_PROFILE_COPY */
export function getProfileCopy(_model?: BusinessModel): ProfileCopy {
  return NEUTRAL_PROFILE_COPY;
}

/** @deprecated Use NEUTRAL_FINANCE_SETUP_COPY */
export function getFinanceSetupCopy(_model?: BusinessModel): FinanceSetupCopy {
  return NEUTRAL_FINANCE_SETUP_COPY;
}

/** @deprecated Use NEUTRAL_FINANCE_REMINDER_COPY */
export function getFinanceSetupReminderCopy(_model?: BusinessModel): FinanceSetupReminderCopy {
  return NEUTRAL_FINANCE_REMINDER_COPY;
}

export type DefaultLocationDefaults = {
  name: string;
  code: string;
};

export function getDefaultLocationDefaults(): DefaultLocationDefaults {
  return { name: "Headquarters", code: "HQ" };
}

function slugifyChannel(value: string): string {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
  return slug || "main";
}

export type DefaultChannelConfig = ChannelFormValues & { key: string };

export function getDefaultChannelConfigs(
  model: BusinessModel,
  brandName: string
): DefaultChannelConfig[] {
  const baseName = brandName.trim() || "Main";
  const baseSlug = slugifyChannel(baseName);

  switch (model) {
    case "D2C":
      return [
        {
          key: "d2c",
          name: `${baseName} Store`,
          slug: baseSlug,
          channel_type: "B2C_ECOMMERCE",
          new_policy_name: "Standard returns",
          return_window_days: "30",
        },
      ];
    case "BOTH":
      return [
        {
          key: "d2c",
          name: `${baseName} Store`,
          slug: baseSlug,
          channel_type: "B2C_ECOMMERCE",
          new_policy_name: "Standard returns",
          return_window_days: "30",
        },
        {
          key: "b2b",
          name: `${baseName} B2B Portal`,
          slug: `${baseSlug}-b2b`,
          channel_type: "B2B_PORTAL",
          new_policy_name: "B2B returns",
          return_window_days: "14",
        },
      ];
    default:
      return [
        {
          key: "b2b",
          name: `${baseName} Portal`,
          slug: `${baseSlug}-portal`,
          channel_type: "B2B_PORTAL",
          new_policy_name: "Standard returns",
          return_window_days: "30",
        },
      ];
  }
}

export type ChannelSuggestion = {
  name: string;
  channel_type: string;
  label: string;
};

const CHANNEL_TYPE_LABELS: Record<string, string> = {
  B2C_ECOMMERCE: "consumer storefront",
  B2B_PORTAL: "business portal",
};

export function getMissingChannelSuggestions(
  model: BusinessModel,
  existingTypes: string[],
  brandName: string
): ChannelSuggestion[] {
  const existing = new Set(existingTypes);
  return getDefaultChannelConfigs(model, brandName)
    .filter((config) => !existing.has(config.channel_type))
    .map((config) => ({
      name: config.name,
      channel_type: config.channel_type,
      label: CHANNEL_TYPE_LABELS[config.channel_type] ?? config.channel_type,
    }));
}

export function channelPreviewLabel(model: BusinessModel): string {
  switch (model) {
    case "D2C":
      return "Consumer storefront";
    case "B2B":
      return "Business portal";
    default:
      return "Store + B2B portal";
  }
}

const GETTING_STARTED_TASK_ORDER: GettingStartedTaskId[] = [
  "first_product",
  "first_supplier",
  "categories",
  "first_customer",
  "org_settings",
  "locations",
];

export function orderGettingStartedTasks(_model?: BusinessModel): GettingStartedTaskId[] {
  return GETTING_STARTED_TASK_ORDER;
}

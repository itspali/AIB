export type MilestoneStatus = "COMPLETED" | "ACTION_REQUIRED" | "LOCKED";

export type TenantProfile = {
  id: string;
  name: string;
  trade_name: string | null;
  legal_name: string | null;
  legal_registration_number: string | null;
  tax_identifier: string | null;
  onboarding_status: string;
  metadata_json: Record<string, unknown> | null;
};

export type PrimaryLocation = {
  id: string;
  name: string;
  tax_registered_name: string | null;
  location_tax_identifier: string | null;
  state: string;
  city: string;
};

export type OnboardingStepState = {
  id: string;
  title: string;
  status: MilestoneStatus;
  completed: boolean;
};

export type OnboardingSnapshot = {
  tenant: TenantProfile;
  primaryLocation: PrimaryLocation | null;
  accountCount: number;
  taxRateCount: number;
  channelCount: number;
  returnPolicies: { id: string; policy_name: string }[];
  steps: OnboardingStepState[];
  progressPercent: number;
  canLaunch: boolean;
  isOnboardingComplete: boolean;
};

export type LocationFormValues = {
  name: string;
  code: string;
  address_line1: string;
  city: string;
  state: string;
  zip_postal: string;
  country_code: string;
  billing_state: string;
  shipping_state: string;
  tax_registered_name?: string;
  location_tax_identifier?: string;
};

export type TaxRateRow = {
  tax_component_name: string;
  tax_percentage: string;
  active_from_date: string;
  active_to_date?: string;
  legal_compliance_code?: string;
};

export type ChannelFormValues = {
  name: string;
  slug: string;
  channel_type: string;
  domain_url?: string;
  return_policy_id?: string;
  new_policy_name?: string;
  return_window_days?: string;
};

export type OnboardingDraft = {
  location?: Partial<LocationFormValues>;
  taxRates?: TaxRateRow[];
  channel?: Partial<ChannelFormValues>;
  advanced?: Record<string, unknown>;
};

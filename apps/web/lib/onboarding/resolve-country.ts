import type { OnboardingDraft } from "@/lib/onboarding/types";

export function resolveOnboardingCountryCode(input: {
  draft?: OnboardingDraft;
  tenantCountryCode?: string | null;
  primaryLocationCountryCode?: string | null;
  signupCountryCode?: string | null;
}): string {
  const candidates = [
    input.draft?.corporateProfile?.country_code,
    input.draft?.location?.country_code,
    input.primaryLocationCountryCode,
    input.tenantCountryCode,
    input.signupCountryCode,
  ];

  for (const value of candidates) {
    const code = typeof value === "string" ? value.trim().toUpperCase() : "";
    if (code.length === 2) return code;
  }

  return "US";
}

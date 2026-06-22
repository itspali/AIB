"use client";

import { lazyClientExport } from "@/lib/lazy/lazy-client-export";
import type { OnboardingSnapshot } from "@/lib/onboarding/types";

const OnboardingWizard = lazyClientExport(
  () => import("@/components/onboarding/onboarding-wizard"),
  "OnboardingWizard"
);

type Props = {
  snapshot: OnboardingSnapshot;
  signupCountryCode?: string | null;
};

export function OnboardingWizardLazy({ snapshot, signupCountryCode }: Props) {
  return <OnboardingWizard snapshot={snapshot} signupCountryCode={signupCountryCode} />;
}

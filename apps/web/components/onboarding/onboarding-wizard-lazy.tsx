"use client";

import { lazyClientExport } from "@/lib/lazy/lazy-client-export";
import type { OnboardingSnapshot } from "@/lib/onboarding/types";

const OnboardingWizard = lazyClientExport(
  () => import("@/components/onboarding/onboarding-wizard"),
  "OnboardingWizard"
);

type Props = {
  snapshot: OnboardingSnapshot;
};

export function OnboardingWizardLazy({ snapshot }: Props) {
  return <OnboardingWizard snapshot={snapshot} />;
}

import { NEUTRAL_FINANCE_REMINDER_COPY } from "@/lib/onboarding/business-model";

export const FINANCE_SETUP_REQUIRED_MESSAGE =
  "Complete finance setup in onboarding before creating purchase orders or invoices.";

export function isFinanceSetupComplete(onboardingStatus: string | null | undefined): boolean {
  return onboardingStatus === "GO_LIVE_READY";
}

export function getFinanceSetupBlockMessage(): string {
  return NEUTRAL_FINANCE_REMINDER_COPY.description;
}

"use client";

import dynamic from "next/dynamic";
import { useRef, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { OnboardingStepSkeleton } from "@/components/onboarding/onboarding-step-skeleton";
import { WizardFooter } from "@/components/onboarding/wizard-footer";
import { WizardStepNav } from "@/components/onboarding/wizard-step-nav";
import { useOnboardingDraftSaver } from "@/components/onboarding/use-onboarding-draft";
import { getFirstIncompleteStepId } from "@/lib/onboarding/status";
import type {
  OnboardingDraft,
  OnboardingSnapshot,
  StepSubmitHandle,
  WizardStepId,
} from "@/lib/onboarding/types";

const STEP_ORDER: WizardStepId[] = ["profile", "finance_setup"];

const stepLoading = () => <OnboardingStepSkeleton />;

const StepCorporateProfile = dynamic(
  () =>
    import("@/components/onboarding/steps/step-corporate-profile").then(
      (module) => module.StepCorporateProfile
    ),
  { ssr: false, loading: stepLoading }
);

const StepFinanceSetup = dynamic(
  () =>
    import("@/components/onboarding/steps/step-finance-setup").then(
      (module) => module.StepFinanceSetup
    ),
  { ssr: false, loading: stepLoading }
);

const AdvancedParametersPanel = dynamic(
  () =>
    import("@/components/onboarding/advanced-parameters-panel").then(
      (module) => module.AdvancedParametersPanel
    ),
  { ssr: false }
);

type Props = {
  snapshot: OnboardingSnapshot;
};

export function OnboardingWizard({ snapshot }: Props) {
  const [activeStepId, setActiveStepId] = useState<WizardStepId>(() =>
    getFirstIncompleteStepId(snapshot.steps)
  );
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);

  const profileRef = useRef<StepSubmitHandle>(null);
  const financeRef = useRef<StepSubmitHandle>(null);

  const draft: OnboardingDraft = {
    business_model: snapshot.businessModel,
    ...((snapshot.tenant.metadata_json?.onboarding_draft as OnboardingDraft | undefined) ?? {}),
  };
  const { queueSave } = useOnboardingDraftSaver(draft);
  const resolvedCountryCode =
    draft.corporateProfile?.country_code ||
    draft.location?.country_code ||
    snapshot.primaryLocation?.country_code ||
    "US";

  const stepMap = Object.fromEntries(snapshot.steps.map((s) => [s.id, s]));
  const activeStep = stepMap[activeStepId];

  const stepRefMap: Record<WizardStepId, React.RefObject<StepSubmitHandle | null>> = {
    profile: profileRef,
    finance_setup: financeRef,
  };

  const showAdvancedPanel = activeStepId === "profile";

  const advanceStep = () => {
    const currentIndex = STEP_ORDER.indexOf(activeStepId);
    for (let i = currentIndex + 1; i < STEP_ORDER.length; i++) {
      const nextId = STEP_ORDER[i];
      const step = stepMap[nextId];
      if (step && step.status !== "LOCKED") {
        setActiveStepId(nextId);
        return;
      }
    }
  };

  const goBack = () => {
    const currentIndex = STEP_ORDER.indexOf(activeStepId);
    if (currentIndex > 0) {
      setActiveStepId(STEP_ORDER[currentIndex - 1]);
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-8 max-w-5xl mx-auto py-4 md:py-8">
      <aside className="md:col-span-4 md:border-r md:pr-6">
        <WizardStepNav
          steps={snapshot.steps}
          activeStepId={activeStepId}
          onStepSelect={setActiveStepId}
        />
      </aside>

      <section className="min-w-0 md:col-span-8">
        {snapshot.schemaWarning && (
          <div className="mb-6 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              Some setup modules are not available yet. Contact your administrator if this persists
              after a few minutes.
            </p>
          </div>
        )}

        {snapshot.rlsWarning && !snapshot.schemaWarning && (
          <div className="mb-6 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              Your workspace permissions blocked financial setup tables. Contact support to restore
              access.
            </p>
          </div>
        )}

        <div className="mb-4 md:mb-6">
          <h3 className="text-xl font-semibold tracking-tight hidden md:block">{activeStep?.title}</h3>
          {activeStep?.status === "ACTION_REQUIRED" && !activeStep.completed && (
            <p className="mt-1 text-sm text-muted-foreground hidden md:block">
              Complete the fields below to continue setup.
            </p>
          )}
        </div>

        <div className="space-y-6">
          {activeStepId === "profile" && (
            <StepCorporateProfile
              ref={profileRef}
              completed={stepMap.profile?.completed ?? false}
              tenant={snapshot.tenant}
              primaryLocation={snapshot.primaryLocation}
              defaultValues={draft.corporateProfile ?? draft.location}
              showAdvanced={showAdvanced}
              onDraftChange={(corporateProfile) => queueSave({ corporateProfile })}
              onEditingChange={setEditingProfile}
            />
          )}

          {activeStepId === "finance_setup" && (
            <StepFinanceSetup
              ref={financeRef}
              initialBusinessModel={draft.business_model ?? snapshot.businessModel}
              brandName={snapshot.tenant.name}
              countryCode={resolvedCountryCode}
              completed={stepMap.finance_setup?.completed ?? false}
              accountCount={snapshot.accountCount}
              taxRateCount={snapshot.taxRateCount}
              channelCount={snapshot.channelCount}
              onBusinessModelChange={(business_model) => queueSave({ business_model })}
            />
          )}

          {showAdvancedPanel && (
            <AdvancedParametersPanel enabled={showAdvanced} onEnabledChange={setShowAdvanced} />
          )}
        </div>

        <WizardFooter
          activeStepId={activeStepId}
          stepCompleted={
            activeStepId === "profile"
              ? (stepMap.profile?.completed ?? false) && !editingProfile
              : (activeStep?.completed ?? false)
          }
          canLaunch={snapshot.canLaunch}
          stepRef={stepRefMap[activeStepId]}
          onBack={goBack}
          onContinue={advanceStep}
        />
      </section>
    </div>
  );
}

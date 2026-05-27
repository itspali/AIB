"use client";

import { useRef, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { AdvancedParametersPanel } from "@/components/onboarding/advanced-parameters-panel";
import { StepCorporateProfile } from "@/components/onboarding/steps/step-corporate-profile";
import { StepCoa } from "@/components/onboarding/steps/step-coa";
import { StepTaxRegistry } from "@/components/onboarding/steps/step-tax-registry";
import { StepChannels } from "@/components/onboarding/steps/step-channels";
import { WizardFooter } from "@/components/onboarding/wizard-footer";
import { WizardStepNav } from "@/components/onboarding/wizard-step-nav";
import { getFirstIncompleteStepId } from "@/lib/onboarding/status";
import type { OnboardingDraft, OnboardingSnapshot, StepSubmitHandle, WizardStepId } from "@/lib/onboarding/types";

const STEP_ORDER: WizardStepId[] = ["locations", "coa", "tax", "channels"];

type Props = {
  snapshot: OnboardingSnapshot;
};

export function OnboardingWizard({ snapshot }: Props) {
  const [activeStepId, setActiveStepId] = useState<WizardStepId>(() =>
    getFirstIncompleteStepId(snapshot.steps)
  );
  const [showAdvanced, setShowAdvanced] = useState(false);

  const corporateRef = useRef<StepSubmitHandle>(null);
  const coaRef = useRef<StepSubmitHandle>(null);
  const taxRef = useRef<StepSubmitHandle>(null);
  const channelsRef = useRef<StepSubmitHandle>(null);

  const draft = (snapshot.tenant.metadata_json?.onboarding_draft as OnboardingDraft | undefined) ?? {};
  const stepMap = Object.fromEntries(snapshot.steps.map((s) => [s.id, s]));
  const activeStep = stepMap[activeStepId];

  const stepRefMap: Record<WizardStepId, React.RefObject<StepSubmitHandle | null>> = {
    locations: corporateRef,
    coa: coaRef,
    tax: taxRef,
    channels: channelsRef,
  };

  const showAdvancedPanel = activeStepId === "locations" || activeStepId === "tax" || activeStepId === "channels";

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
            <p>Financial tables not deployed — run Supabase migrations on this project.</p>
          </div>
        )}

        {snapshot.rlsWarning && !snapshot.schemaWarning && (
          <div className="mb-6 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>RLS policy misconfiguration — authenticated users cannot access financial tables for this tenant.</p>
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
          {activeStepId === "locations" && (
            <StepCorporateProfile
              ref={corporateRef}
              completed={stepMap.locations.completed}
              tenant={snapshot.tenant}
              primaryLocation={snapshot.primaryLocation}
              defaultValues={draft.corporateProfile ?? draft.location}
              showAdvanced={showAdvanced}
            />
          )}

          {activeStepId === "coa" && (
            <StepCoa
              ref={coaRef}
              completed={stepMap.coa.completed}
              accountCount={snapshot.accountCount}
            />
          )}

          {activeStepId === "tax" && (
            <StepTaxRegistry
              ref={taxRef}
              completed={stepMap.tax.completed}
              taxRateCount={snapshot.taxRateCount}
              initialRows={draft.taxRates}
              showAdvanced={showAdvanced}
            />
          )}

          {activeStepId === "channels" && (
            <StepChannels
              ref={channelsRef}
              completed={stepMap.channels.completed}
              channelCount={snapshot.channelCount}
              returnPolicies={snapshot.returnPolicies}
              defaultValues={draft.channel}
              showAdvanced={showAdvanced}
            />
          )}

          {showAdvancedPanel && (
            <AdvancedParametersPanel enabled={showAdvanced} onEnabledChange={setShowAdvanced} />
          )}
        </div>

        <WizardFooter
          activeStepId={activeStepId}
          stepCompleted={activeStep?.completed ?? false}
          canLaunch={snapshot.canLaunch}
          stepRef={stepRefMap[activeStepId]}
          onBack={goBack}
          onContinue={advanceStep}
        />
      </section>
    </div>
  );
}

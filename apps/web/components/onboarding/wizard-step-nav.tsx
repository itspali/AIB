"use client";

import { cn } from "@/lib/utils";
import { WizardStepBadge } from "@/components/onboarding/wizard-step-badge";
import type { OnboardingStepState, WizardNavStatus, WizardStepId } from "@/lib/onboarding/types";

const STEP_SHORT_LABELS: Record<WizardStepId, string> = {
  locations: "Corporate Profile",
  coa: "Chart of Accounts",
  tax: "Tax Registry",
  channels: "Channels",
};

type Props = {
  steps: OnboardingStepState[];
  activeStepId: WizardStepId;
  onStepSelect: (stepId: WizardStepId) => void;
};

function getNavStatus(step: OnboardingStepState, activeStepId: WizardStepId): WizardNavStatus {
  if (step.id === activeStepId) return "ACTIVE";
  if (step.status === "LOCKED") return "LOCKED";
  if (step.completed) return "DONE";
  return "LOCKED";
}

function canSelectStep(step: OnboardingStepState, activeStepId: WizardStepId): boolean {
  if (step.status === "LOCKED") return false;
  if (step.id === activeStepId) return false;
  return step.completed;
}

function StepNavButton({
  step,
  index,
  activeStepId,
  onStepSelect,
  compact = false,
}: {
  step: OnboardingStepState;
  index: number;
  activeStepId: WizardStepId;
  onStepSelect: (stepId: WizardStepId) => void;
  compact?: boolean;
}) {
  const navStatus = getNavStatus(step, activeStepId);
  const selectable = canSelectStep(step, activeStepId);

  return (
    <button
      type="button"
      disabled={!selectable}
      onClick={() => selectable && onStepSelect(step.id)}
      className={cn(
        "flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors duration-200",
        compact ? "p-2.5" : "p-3",
        navStatus === "ACTIVE" && "border-indigo-200 bg-indigo-50/50",
        navStatus === "DONE" && selectable && "hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring",
        navStatus === "LOCKED" && "cursor-not-allowed opacity-60"
      )}
    >
      <span
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-medium",
          navStatus === "ACTIVE" ? "bg-indigo-100 text-indigo-800" : "bg-muted text-muted-foreground"
        )}
      >
        {index + 1}
      </span>
      <span className="min-w-0 flex-1 space-y-1">
        <span className="block text-sm font-medium leading-snug break-words">
          {compact ? STEP_SHORT_LABELS[step.id] : step.title}
        </span>
        <WizardStepBadge status={navStatus} />
      </span>
    </button>
  );
}

export function WizardStepNav({ steps, activeStepId, onStepSelect }: Props) {
  const activeIndex = steps.findIndex((s) => s.id === activeStepId);
  const activeStep = steps[activeIndex];
  const completedSteps = steps.filter((s) => s.completed && s.id !== activeStepId);

  return (
    <nav aria-label="Onboarding steps" className="space-y-1">
      {/* Mobile: compact progress stepper — full-width stack, no horizontal scroll */}
      <div className="space-y-4 md:hidden">
        <div>
          <div className="mb-2 flex items-center justify-between gap-2 text-sm">
            <span className="font-medium text-muted-foreground">
              Step {activeIndex + 1} of {steps.length}
            </span>
            {activeStep && <WizardStepBadge status={getNavStatus(activeStep, activeStepId)} />}
          </div>
          <div
            className="flex gap-1.5"
            role="progressbar"
            aria-valuenow={activeIndex + 1}
            aria-valuemin={1}
            aria-valuemax={steps.length}
          >
            {steps.map((step, index) => (
              <div
                key={step.id}
                className={cn(
                  "h-1.5 flex-1 rounded-full transition-colors duration-200",
                  step.completed
                    ? "bg-emerald-500"
                    : index === activeIndex
                      ? "bg-indigo-500"
                      : "bg-muted"
                )}
              />
            ))}
          </div>
          {activeStep && (
            <p className="mt-2 text-sm font-medium leading-snug">{STEP_SHORT_LABELS[activeStep.id]}</p>
          )}
        </div>

        {completedSteps.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Completed steps
            </p>
            {completedSteps.map((step) => {
              const index = steps.findIndex((s) => s.id === step.id);
              return (
                <StepNavButton
                  key={step.id}
                  step={step}
                  index={index}
                  activeStepId={activeStepId}
                  onStepSelect={onStepSelect}
                  compact
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Desktop: vertical step rail */}
      <div className="hidden md:block">
        <div className="mb-4">
          <h2 className="text-lg font-semibold tracking-tight">Setup Checklist</h2>
          <p className="text-sm text-muted-foreground">Complete each milestone to launch your workspace.</p>
        </div>

        <div className="flex flex-col gap-3">
          {steps.map((step, index) => (
            <StepNavButton
              key={step.id}
              step={step}
              index={index}
              activeStepId={activeStepId}
              onStepSelect={onStepSelect}
            />
          ))}
        </div>
      </div>
    </nav>
  );
}

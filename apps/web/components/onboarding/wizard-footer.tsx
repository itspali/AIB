"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { completeOnboarding } from "@/app/onboarding/actions";
import { useOnboardingContext } from "@/components/onboarding/onboarding-context";
import type { StepSubmitHandle, WizardStepId } from "@/lib/onboarding/types";

type Props = {
  activeStepId: WizardStepId;
  stepCompleted: boolean;
  canLaunch: boolean;
  stepRef: React.RefObject<StepSubmitHandle | null>;
  onBack: () => void;
  onContinue: () => void;
};

export function WizardFooter({
  activeStepId,
  stepCompleted,
  canLaunch,
  stepRef,
  onBack,
  onContinue,
}: Props) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const { setOnboardingComplete } = useOnboardingContext();

  const isStep4 = activeStepId === "channels";
  const showLaunch = isStep4 && canLaunch;

  const handlePrimary = () => {
    if (showLaunch) {
      startTransition(async () => {
        const result = await completeOnboarding();
        if (result.error) {
          toast.error(result.error);
          return;
        }
        setOnboardingComplete(true);
        toast.success("Welcome to your live AIB Smart ERP workspace!");
        router.push("/dashboard");
        router.refresh();
      });
      return;
    }

    if (stepCompleted) {
      onContinue();
      return;
    }

    startTransition(async () => {
      const handler = stepRef.current;
      if (!handler) {
        toast.error("Step handler unavailable");
        return;
      }
      const result = await handler.submit();
      if (result.error) {
        toast.error(result.error);
        return;
      }
      router.refresh();
      onContinue();
    });
  };

  const primaryLabel = showLaunch
    ? "Complete Setup & Launch Workspace"
    : stepCompleted
      ? "Continue"
      : "Save & Continue";

  return (
    <div className="mt-6 flex flex-col-reverse gap-3 border-t pt-4 md:mt-8 md:flex-row md:items-center md:justify-between md:pt-6">
      {activeStepId !== "locations" ? (
        <Button
          type="button"
          variant="ghost"
          disabled={pending}
          onClick={onBack}
          className="w-full md:w-auto"
        >
          Back
        </Button>
      ) : (
        <span className="hidden md:block" />
      )}
      <Button
        type="button"
        disabled={pending || (showLaunch && !canLaunch)}
        size="lg"
        onClick={handlePrimary}
        className="w-full md:ml-auto md:w-auto"
      >
        {pending ? "Saving…" : primaryLabel}
      </Button>
    </div>
  );
}

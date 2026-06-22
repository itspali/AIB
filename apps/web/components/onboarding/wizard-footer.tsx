"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
  const { setOnboardingComplete, setHasWorkspaceAccess } = useOnboardingContext();

  const isFinanceStep = activeStepId === "finance_setup";
  const showLaunchOnly = isFinanceStep && stepCompleted && canLaunch;

  const finishSetup = () => {
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
      setOnboardingComplete(true);
      setHasWorkspaceAccess(true);
      toast.success("Your business setup is complete!");
      router.push("/dashboard");
      router.refresh();
    });
  };

  const handlePrimary = () => {
    if (showLaunchOnly) {
      router.push("/dashboard");
      router.refresh();
      return;
    }

    if (stepCompleted && isFinanceStep) {
      finishSetup();
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

      if (activeStepId === "profile") {
        setHasWorkspaceAccess(true);
      }

      if (isFinanceStep) {
        setOnboardingComplete(true);
        setHasWorkspaceAccess(true);
        toast.success("Your business setup is complete!");
        router.push("/dashboard");
        router.refresh();
        return;
      }

      router.refresh();
      onContinue();
    });
  };

  const primaryLabel = showLaunchOnly
    ? "Go to dashboard"
    : stepCompleted && isFinanceStep
      ? "Go to dashboard"
      : isFinanceStep
        ? "Apply recommended setup"
        : "Save and continue";

  return (
    <div className="mt-6 flex flex-col-reverse gap-3 border-t pt-4 md:mt-8 md:flex-row md:items-center md:justify-between md:pt-6">
      {activeStepId !== "profile" ? (
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
        disabled={pending}
        size="lg"
        onClick={handlePrimary}
        className="w-full md:ml-auto md:w-auto"
      >
        {pending ? "Saving…" : primaryLabel}
      </Button>
    </div>
  );
}

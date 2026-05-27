"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { completeOnboarding, saveDraft } from "@/app/onboarding/actions";
import { useOnboardingContext } from "@/components/onboarding/onboarding-context";
import type { OnboardingDraft } from "@/lib/onboarding/types";

type Props = {
  canLaunch: boolean;
  getDraft: () => OnboardingDraft;
};

export function OnboardingActionBar({ canLaunch, getDraft }: Props) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const { setOnboardingComplete } = useOnboardingContext();

  return (
    <div className="sticky bottom-0 flex justify-end gap-3 border-t bg-background py-4">
      <Button
        variant="outline"
        disabled={pending}
        onClick={() => {
          startTransition(async () => {
            const result = await saveDraft(getDraft());
            if (result.error) toast.error(result.error);
            else toast.success("Progress draft saved");
          });
        }}
      >
        Save Progress Draft
      </Button>
      <Button
        disabled={!canLaunch || pending}
        size="lg"
        onClick={() => {
          startTransition(async () => {
            const result = await completeOnboarding();
            if (result.error) {
              toast.error(result.error);
              return;
            }
            setOnboardingComplete(true);
            toast.success("Welcome to your live AIB Smart ERP workspace!");
            router.push("/");
            router.refresh();
          });
        }}
      >
        Complete Setup & Launch Workspace
      </Button>
    </div>
  );
}

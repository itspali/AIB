"use client";

import { forwardRef, useImperativeHandle, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { deployCoaTemplate } from "@/app/onboarding/actions";
import type { StepSubmitHandle } from "@/lib/onboarding/types";

type Props = {
  completed: boolean;
  accountCount: number;
};

export const StepCoa = forwardRef<StepSubmitHandle, Props>(function StepCoa({ completed, accountCount }, ref) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useImperativeHandle(ref, () => ({
    submit: async () => {
      setError(null);
      const result = await deployCoaTemplate();
      if (result.error) {
        setError(result.error);
        return { error: result.error };
      }
      return { success: true };
    },
  }));

  if (completed) {
    return (
      <p className="text-sm text-muted-foreground">
        {accountCount} ledger account{accountCount === 1 ? "" : "s"} mapped to your compliance COA template.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Deploy the standard compliance chart of accounts required for automated COGS, tax liability, and forex
        variance posting.
      </p>
      <div className="flex justify-center">
        <Button
          disabled={pending}
          onClick={() => {
            setError(null);
            startTransition(async () => {
              const result = await deployCoaTemplate();
              if (result.error) setError(result.error);
            });
          }}
        >
          {pending ? "Deploying…" : "Deploy Standard Compliance COA Template"}
        </Button>
      </div>
      {error && <p className="text-sm text-destructive text-center">{error}</p>}
    </div>
  );
});

"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { deployCoaTemplate } from "@/app/onboarding/actions";

type Props = {
  completed: boolean;
  accountCount: number;
};

export function StepCoa({ completed, accountCount }: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

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
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

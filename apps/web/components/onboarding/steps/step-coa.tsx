"use client";

import { forwardRef, useImperativeHandle } from "react";
import { deployCoaTemplate } from "@/app/onboarding/actions";
import type { StepSubmitHandle } from "@/lib/onboarding/types";

type Props = {
  completed: boolean;
  accountCount: number;
};

export const StepCoa = forwardRef<StepSubmitHandle, Props>(function StepCoa(
  { completed, accountCount },
  ref
) {
  useImperativeHandle(ref, () => ({
    submit: async () => deployCoaTemplate(),
  }));

  if (completed) {
    return (
      <p className="text-sm text-muted-foreground">
        {accountCount} ledger account{accountCount === 1 ? "" : "s"} mapped to your compliance COA
        template.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Deploy the standard compliance chart of accounts required for automated COGS, tax liability,
        and forex variance posting. Use <span className="font-medium">Save &amp; Continue</span>{" "}
        below to deploy the template.
      </p>
    </div>
  );
});

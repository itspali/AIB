"use client";

import { forwardRef, useImperativeHandle } from "react";
import { deployCoaTemplate } from "@/app/onboarding/actions";
import { coaTemplateForCountry } from "@/lib/onboarding/locale-presets";
import type { StepSubmitHandle } from "@/lib/onboarding/types";

type Props = {
  completed: boolean;
  accountCount: number;
  countryCode: string;
};

export const StepCoa = forwardRef<StepSubmitHandle, Props>(function StepCoa(
  { completed, accountCount, countryCode },
  ref
) {
  const { label, template } = coaTemplateForCountry(countryCode);

  useImperativeHandle(ref, () => ({
    submit: async () => deployCoaTemplate(),
  }));

  if (completed) {
    return (
      <p className="text-sm text-muted-foreground">
        {accountCount} ledger account{accountCount === 1 ? "" : "s"} mapped to your {label} COA
        template.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Deploy the <span className="font-medium">{label}</span> chart of accounts ({template.length}{" "}
        accounts) for automated COGS, tax liability, and forex variance posting. Use{" "}
        <span className="font-medium">Save &amp; Continue</span> below to deploy the template.
      </p>
    </div>
  );
});

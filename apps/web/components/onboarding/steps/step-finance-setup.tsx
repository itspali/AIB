"use client";

import { forwardRef, useImperativeHandle, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { applyRecommendedFinanceSetup } from "@/app/onboarding/actions";
import { BusinessModelSelector } from "@/components/auth/business-model-selector";
import {
  NEUTRAL_FINANCE_SETUP_COPY,
  channelPreviewLabel,
  type BusinessModel,
} from "@/lib/onboarding/business-model";
import {
  coaTemplateForCountry,
  defaultTaxRatesForCountry,
} from "@/lib/onboarding/locale-presets";
import type { StepSubmitHandle } from "@/lib/onboarding/types";

type Props = {
  initialBusinessModel: BusinessModel;
  brandName: string;
  countryCode: string;
  completed: boolean;
  accountCount: number;
  taxRateCount: number;
  channelCount: number;
  onBusinessModelChange?: (model: BusinessModel) => void;
};

export const StepFinanceSetup = forwardRef<StepSubmitHandle, Props>(function StepFinanceSetup(
  {
    initialBusinessModel,
    brandName,
    countryCode,
    completed,
    accountCount,
    taxRateCount,
    channelCount,
    onBusinessModelChange,
  },
  ref
) {
  const [businessModel, setBusinessModel] = useState(initialBusinessModel);
  const copy = NEUTRAL_FINANCE_SETUP_COPY;
  const { template, label: coaLabel } = coaTemplateForCountry(countryCode);
  const taxPresets = defaultTaxRatesForCountry(countryCode);
  const expectedChannels = businessModel === "BOTH" ? 2 : 1;

  const handleModelChange = (model: BusinessModel) => {
    setBusinessModel(model);
    onBusinessModelChange?.(model);
  };

  useImperativeHandle(ref, () => ({
    submit: async () => applyRecommendedFinanceSetup(businessModel),
  }));

  if (completed) {
    return (
      <div className="rounded-md border bg-muted/30 p-4 text-sm space-y-2">
        <p className="font-medium flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          Finance setup applied
        </p>
        <p className="text-muted-foreground">
          {accountCount} accounts · {taxRateCount} tax rates · {channelCount} sales channel
          {channelCount === 1 ? "" : "s"}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <BusinessModelSelector
        value={businessModel}
        onChange={handleModelChange}
        label="Main selling focus (for setup defaults)"
        helperText="Used for recommended sales channels. You can change this later in Settings."
      />

      <div className="rounded-lg border bg-muted/20 p-4 space-y-4">
        <div>
          <p className="font-medium">{copy.summaryTitle}</p>
          <p className="mt-1 text-sm text-muted-foreground">{copy.summaryDescription}</p>
        </div>
        <dl className="grid gap-3 text-sm sm:grid-cols-3">
          <div className="rounded-md border bg-background p-3">
            <dt className="text-muted-foreground">Chart of accounts</dt>
            <dd className="mt-1 font-medium">{template.length} accounts</dd>
            <dd className="text-xs text-muted-foreground">{coaLabel}</dd>
          </div>
          <div className="rounded-md border bg-background p-3">
            <dt className="text-muted-foreground">Tax rates</dt>
            <dd className="mt-1 font-medium">{taxPresets.length} presets</dd>
            <dd className="text-xs text-muted-foreground">{countryCode.toUpperCase()} defaults</dd>
          </div>
          <div className="rounded-md border bg-background p-3">
            <dt className="text-muted-foreground">Sales channels</dt>
            <dd className="mt-1 font-medium">{expectedChannels}</dd>
            <dd className="text-xs text-muted-foreground">{channelPreviewLabel(businessModel)}</dd>
          </div>
        </dl>
        {brandName.trim() ? (
          <p className="text-xs text-muted-foreground">
            Defaults will use <span className="font-medium text-foreground">{brandName.trim()}</span>{" "}
            as the business name.
          </p>
        ) : null}
      </div>
      <p className="text-sm text-muted-foreground">{copy.customizeHint}</p>
    </div>
  );
});

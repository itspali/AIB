"use client";

import { ChevronLeft } from "lucide-react";
import { MutationPrimaryButton } from "@/components/layout/mutation-form/mutation-primary-button";
import { Button } from "@/components/ui/button";

type Props = {
  isFirst: boolean;
  isLast: boolean;
  onBack: () => void;
  onSkip: () => void;
  onPrimary: () => void;
  primaryLabel: string;
  isPending?: boolean;
  isNavigatePending?: boolean;
};

/** Footer action bar for catalog create/edit wizards (Items, categories, entities). */
export function CatalogWizardActionBar({
  isFirst,
  isLast,
  onBack,
  onSkip,
  onPrimary,
  primaryLabel,
  isPending = false,
  isNavigatePending = false,
}: Props) {
  const disabled = isPending || isNavigatePending;

  return (
    <div className="flex w-full flex-wrap items-center justify-between gap-2">
      <div className="flex min-w-0 flex-wrap items-center gap-1">
        {!isFirst ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 gap-1 px-2"
            disabled={disabled}
            onClick={onBack}
          >
            <ChevronLeft className="h-4 w-4 shrink-0" aria-hidden />
            <span className="hidden sm:inline">Back</span>
          </Button>
        ) : null}
        {!isFirst && !isLast ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8"
            disabled={disabled}
            onClick={onSkip}
            title="Save and finish later"
          >
            Skip
          </Button>
        ) : null}
      </div>
      <MutationPrimaryButton
        label={primaryLabel}
        disabled={disabled}
        onClick={onPrimary}
        className="ml-auto"
      />
    </div>
  );
}

type EditProps = {
  saveLabel: string;
  onSave: () => void;
  isPending?: boolean;
  isNavigatePending?: boolean;
};

/** Single-save footer for flat catalog edit surfaces (non-wizard). */
export function CatalogEditActionBar({
  saveLabel,
  onSave,
  isPending = false,
  isNavigatePending = false,
}: EditProps) {
  return (
    <div className="flex w-full justify-end">
      <MutationPrimaryButton
        label={saveLabel}
        disabled={isPending || isNavigatePending}
        onClick={() => void onSave()}
      />
    </div>
  );
}

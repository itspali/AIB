"use client";

import { MutationPrimaryButton } from "@/components/layout/mutation-form/mutation-primary-button";
import { Button } from "@/components/ui/button";

type Props = {
  onCancel: () => void;
  cancelLabel?: string;
  saveLabel: string;
  onSave: () => void;
  saveAndNewLabel?: string;
  onSaveAndNew?: () => void;
  primaryLabel?: string;
  onPrimary?: () => void;
  isPending?: boolean;
  disabled?: boolean;
};

/**
 * POS-style header/footer cluster for operational documents (PO, payment, invoice).
 * Primary commit sits rightmost; Cancel is explicit for high-velocity entry.
 */
export function DocumentPosActionBar({
  onCancel,
  cancelLabel = "Cancel",
  saveLabel,
  onSave,
  saveAndNewLabel = "Save & new",
  onSaveAndNew,
  primaryLabel,
  onPrimary,
  isPending = false,
  disabled = false,
}: Props) {
  const blocked = disabled || isPending;
  const commit = onPrimary ?? onSave;
  const commitLabel = primaryLabel ?? saveLabel;

  return (
    <div className="flex flex-wrap items-center justify-end gap-1.5">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-8"
        disabled={blocked}
        onClick={onCancel}
      >
        {cancelLabel}
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-8"
        disabled={blocked}
        onClick={onSave}
      >
        {saveLabel}
      </Button>
      {onSaveAndNew ? (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="h-8"
          disabled={blocked}
          onClick={onSaveAndNew}
        >
          {saveAndNewLabel}
        </Button>
      ) : null}
      <MutationPrimaryButton
        label={commitLabel}
        disabled={blocked}
        onClick={commit}
        className="min-w-[7rem]"
      />
    </div>
  );
}

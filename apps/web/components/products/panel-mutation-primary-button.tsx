"use client";

import { Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  title?: string;
};

export function PanelMutationPrimaryButton({
  label,
  disabled,
  onClick,
  title = "Save (Ctrl+Enter)",
}: Props) {
  const saving = label.startsWith("Saving");

  return (
    <Button
      type="button"
      size="sm"
      disabled={disabled}
      onClick={onClick}
      title={title}
      aria-label={label}
      className="gap-1.5"
    >
      {saving ? (
        <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
      ) : (
        <Save className="h-4 w-4 shrink-0" aria-hidden />
      )}
      <span className="hidden sm:inline">{label}</span>
    </Button>
  );
}

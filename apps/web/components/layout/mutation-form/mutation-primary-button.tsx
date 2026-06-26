"use client";

import { Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  title?: string;
  className?: string;
};

/** Compact primary commit control for catalog and document mutation surfaces. */
export function MutationPrimaryButton({
  label,
  disabled,
  onClick,
  title = "Save (Ctrl+Enter)",
  className,
}: Props) {
  const saving = label.startsWith("Saving") || label.endsWith("…");

  return (
    <Button
      type="button"
      size="sm"
      disabled={disabled}
      onClick={onClick}
      title={title}
      aria-label={label}
      className={cn("h-8 shrink-0 gap-1.5", className)}
    >
      {saving ? (
        <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
      ) : (
        <Save className="h-4 w-4 shrink-0" aria-hidden />
      )}
      <span>{label}</span>
    </Button>
  );
}

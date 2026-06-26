"use client";

import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  label: string;
  title?: string;
  onClick?: () => void;
  disabled?: boolean;
  icon: LucideIcon;
  destructive?: boolean;
  className?: string;
};

/** Icon-only utility control for drawer headers (edit, delete, expand). */
export function MutationIconButton({
  label,
  title,
  onClick,
  disabled,
  icon: Icon,
  destructive = false,
  className,
}: Props) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={cn(
        "h-9 w-9 shrink-0 p-0",
        destructive && "text-muted-foreground hover:text-destructive",
        className
      )}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={title ?? label}
    >
      <Icon className="h-4 w-4" aria-hidden />
    </Button>
  );
}

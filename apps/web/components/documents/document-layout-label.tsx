"use client";

import { Label } from "@/components/ui/label";
import { documentFieldTypographyClassName } from "@/lib/documents/document-typography-classes";
import type { DocumentColumnPref } from "@/lib/documents/types";
import { cn } from "@/lib/utils";

type Props = React.ComponentProps<typeof Label> & {
  field: Pick<DocumentColumnPref, "label" | "typography"> | undefined;
  fallbackLabel: string;
  defaultClassName?: string;
};

export function DocumentLayoutLabel({
  field,
  fallbackLabel,
  defaultClassName,
  className,
  children,
  ...props
}: Props) {
  return (
    <Label
      className={cn(
        documentFieldTypographyClassName(field, defaultClassName ?? ""),
        className
      )}
      {...props}
    >
      {children ?? field?.label ?? fallbackLabel}
    </Label>
  );
}

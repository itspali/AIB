"use client";

import type { ReactNode } from "react";
import { FieldLabelInfo, fieldHelpText } from "@/components/ui/field-label-info";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type Props = {
  label: string;
  htmlFor?: string;
  help: string;
  className?: string;
};

/** Field label with info popover — inline hints stay on errors only. */
export function CategoryFieldLabel({ label, htmlFor, help, className }: Props) {
  return (
    <div className={cn("flex min-w-0 items-center gap-1.5", className)}>
      <Label htmlFor={htmlFor} className="text-xs font-medium text-muted-foreground">
        {label}
      </Label>
      <FieldLabelInfo label={label}>{fieldHelpText(help)}</FieldLabelInfo>
    </div>
  );
}

export function CategorySectionHeading({
  title,
  help,
}: {
  title: string;
  help: string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <h2 className="text-base font-semibold tracking-tight">{title}</h2>
      <FieldLabelInfo label={title}>{fieldHelpText(help)}</FieldLabelInfo>
    </div>
  );
}

export function CategoryToggleLabel({
  label,
  htmlFor,
  help,
}: {
  label: string;
  htmlFor?: string;
  help: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-1.5">
      <Label htmlFor={htmlFor} className="text-xs font-medium text-muted-foreground">
        {label}
      </Label>
      <FieldLabelInfo label={label}>{fieldHelpText(help)}</FieldLabelInfo>
    </div>
  );
}

export function CategoryAttrFieldLabel({
  label,
  htmlFor,
  help,
  error,
  children,
  className,
  /** Keep row controls aligned; render error below without affecting flex height. */
  errorLayout = "flow",
}: {
  label: string;
  htmlFor?: string;
  help: string;
  error?: string;
  children: ReactNode;
  className?: string;
  errorLayout?: "flow" | "absolute";
}) {
  const errorId = error && htmlFor ? `${htmlFor}-error` : undefined;

  return (
    <div className={cn("min-w-0", errorLayout === "absolute" && "relative", className)}>
      <div className="space-y-1.5">
        <CategoryFieldLabel label={label} htmlFor={htmlFor} help={help} />
        {children}
      </div>
      {error && errorLayout === "flow" ? (
        <p id={errorId} className="mt-1.5 text-xs text-destructive">
          {error}
        </p>
      ) : null}
      {error && errorLayout === "absolute" ? (
        <p
          id={errorId}
          role="alert"
          className="pointer-events-none absolute left-0 top-full z-10 mt-1 line-clamp-3 max-w-[min(16rem,90vw)] text-xs leading-snug text-destructive"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}

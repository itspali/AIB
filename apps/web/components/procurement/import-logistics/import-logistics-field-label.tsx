"use client";

import type { ReactNode } from "react";
import { Label } from "@/components/ui/label";
import { FieldLabelInfo } from "@/components/ui/field-label-info";

type Props = {
  label: string;
  help?: ReactNode;
  htmlFor?: string;
};

export function ImportLogisticsFieldLabel({ label, help, htmlFor }: Props) {
  return (
    <div className="flex items-center gap-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {help ? <FieldLabelInfo label={label}>{help}</FieldLabelInfo> : null}
    </div>
  );
}

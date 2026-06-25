"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { ImportLogisticsFieldLabel } from "@/components/procurement/import-logistics/import-logistics-field-label";
import {
  INCOTERMS_OPTIONS,
  INCOTERMS_OTHER_VALUE,
} from "@/lib/procurement/import-logistics/incoterms-options";
import type { ReactNode } from "react";

type Props = {
  value: string;
  disabled?: boolean;
  label: string;
  help?: ReactNode;
  onChange: (code: string) => void;
};

export function IncotermsSelect({ value, disabled, label, help, onChange }: Props) {
  const normalized = value.trim().toUpperCase();
  const known = INCOTERMS_OPTIONS.some((row) => row.code === normalized);
  const selectValue = normalized.length === 0 ? "" : known ? normalized : INCOTERMS_OTHER_VALUE;

  return (
    <div className="space-y-2">
      <ImportLogisticsFieldLabel label={label} help={help} />
      <Select
        value={selectValue || undefined}
        disabled={disabled}
        onValueChange={(next) => {
          if (next === INCOTERMS_OTHER_VALUE) {
            onChange(known ? "" : normalized);
            return;
          }
          onChange(next);
        }}
      >
        <SelectTrigger>
          <SelectValue placeholder="Select Incoterms" />
        </SelectTrigger>
        <SelectContent>
          {INCOTERMS_OPTIONS.map((row) => (
            <SelectItem key={row.code} value={row.code}>
              {row.label}
            </SelectItem>
          ))}
          <SelectItem value={INCOTERMS_OTHER_VALUE}>Other (type below)</SelectItem>
        </SelectContent>
      </Select>
      {selectValue === INCOTERMS_OTHER_VALUE ? (
        <Input
          value={normalized}
          disabled={disabled}
          placeholder="3-letter code"
          maxLength={3}
          className="uppercase"
          onChange={(event) => onChange(event.target.value.toUpperCase())}
        />
      ) : null}
    </div>
  );
}

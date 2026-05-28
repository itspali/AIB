"use client";

import { NAMING_SEQUENCE_KEYS } from "@/lib/organization/naming-options";
import type { NamingSequenceEntry } from "@/lib/organization/types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = {
  values: Record<string, NamingSequenceEntry>;
  disabled?: boolean;
  onChange: (key: string, field: keyof NamingSequenceEntry, value: string) => void;
};

export function NamingSequenceEditor({ values, disabled, onChange }: Props) {
  return (
    <div className="space-y-3">
      {NAMING_SEQUENCE_KEYS.map((key) => {
        const entry = values[key] ?? { prefix: "", digits: "5" };
        return (
          <div key={key} className="grid grid-cols-1 gap-3 rounded-lg border border-border p-3 sm:grid-cols-[1fr_2fr_1fr]">
            <div>
              <Label className="text-xs text-muted-foreground">Document type</Label>
              <p className="text-sm font-medium">{key.replace(/_/g, " ")}</p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Prefix</Label>
              <Input
                disabled={disabled}
                className="font-mono"
                value={entry.prefix}
                placeholder="e.g. PO-2026-"
                onChange={(event) => onChange(key, "prefix", event.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Padding digits</Label>
              <Input
                disabled={disabled}
                className="text-right font-mono"
                inputMode="numeric"
                value={entry.digits}
                onChange={(event) => onChange(key, "digits", event.target.value)}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

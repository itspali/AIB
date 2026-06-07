"use client";

import { NAMING_SEQUENCE_KEYS } from "@/lib/organization/naming-options";
import type { NamingSequenceEntry } from "@/lib/naming/sequences";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = {
  values: Record<string, NamingSequenceEntry>;
  keys?: readonly string[];
  disabled?: boolean;
  showNextValue?: boolean;
  onChange: (key: string, field: keyof NamingSequenceEntry, value: string) => void;
};

export function NamingSequenceEditor({
  values,
  keys = NAMING_SEQUENCE_KEYS,
  disabled,
  showNextValue = false,
  onChange,
}: Props) {
  return (
    <div className="space-y-3">
      {keys.map((key) => {
        const entry = values[key] ?? { prefix: "", digits: "5", next: "" };
        const hasPrefix = entry.prefix.trim().length > 0;
        return (
          <div
            key={key}
            className={`grid grid-cols-1 gap-3 rounded-lg border border-border p-3 ${
              showNextValue
                ? "sm:grid-cols-[1fr_2fr_1fr_1fr]"
                : "sm:grid-cols-[1fr_2fr_1fr]"
            }`}
          >
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
                placeholder="5"
                onChange={(event) => onChange(key, "digits", event.target.value)}
              />
            </div>
            {showNextValue && (
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Next number</Label>
                <Input
                  disabled={disabled || !hasPrefix}
                  className="text-right font-mono"
                  inputMode="numeric"
                  value={entry.next ?? ""}
                  placeholder="1"
                  onChange={(event) => onChange(key, "next", event.target.value)}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

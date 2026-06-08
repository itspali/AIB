"use client";

import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

type Props = {
  enabled: boolean;
  onEnabledChange: (v: boolean) => void;
  children?: React.ReactNode;
};

export function AdvancedParametersPanel({ enabled, onEnabledChange, children }: Props) {
  return (
    <div
      className="space-y-4 rounded-lg border border-dashed p-4"
      data-advanced-open={enabled ? "true" : "false"}
    >
      <div className="flex items-center justify-between gap-3">
        <Label htmlFor="advanced-toggle" className="text-sm font-medium leading-snug">
          Show Advanced Parameters
        </Label>
        <Switch id="advanced-toggle" checked={enabled} onCheckedChange={onEnabledChange} />
      </div>
      {enabled ? children : null}
    </div>
  );
}

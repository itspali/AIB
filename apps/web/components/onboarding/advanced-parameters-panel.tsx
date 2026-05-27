"use client";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

type Props = {
  enabled: boolean;
  onEnabledChange: (v: boolean) => void;
};

export function AdvancedParametersPanel({ enabled, onEnabledChange }: Props) {
  return (
    <div className="space-y-4 rounded-lg border border-dashed p-4">
      <div className="flex items-center justify-between">
        <Label htmlFor="advanced-toggle" className="text-sm font-medium">
          Show Advanced System Parameters
        </Label>
        <Switch id="advanced-toggle" checked={enabled} onCheckedChange={onEnabledChange} />
      </div>
      {enabled && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 text-sm">
          <div className="space-y-2 rounded-md border p-3">
            <p className="font-medium">Currency Exchange Rates</p>
            <p className="text-muted-foreground text-xs">
              Configure daily spot pairs and contract-fixed B2B overrides after go-live.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="From (USD)" disabled />
              <Input placeholder="To (INR)" disabled />
            </div>
          </div>
          <div className="space-y-2 rounded-md border p-3">
            <p className="font-medium">Document Sequences</p>
            <p className="text-muted-foreground text-xs">
              Voucher prefix and padding managed via workspace control registry post-launch.
            </p>
            <Input placeholder="Auto-configured on first transaction" disabled />
          </div>
          <div className="space-y-2 rounded-md border p-3 md:col-span-2">
            <p className="font-medium">Inventory Buffer Thresholds</p>
            <p className="text-muted-foreground text-xs">
              Min/max/reorder gates unlock after product catalog seeding in Inventory module.
            </p>
            <Input placeholder="Available after catalog setup" disabled />
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { saveProcurementPolicies } from "@/app/settings/modules/procurement/actions";
import { OrgSettingsSection } from "@/components/settings/org-settings-section";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  PO_AUTO_ROUND_OFF_STEP_PRESETS,
  type PoAutoRoundOffStepPreset,
} from "@/lib/procurement/purchase-orders/po-auto-round-off";

type Props = {
  initialSettings: {
    po_auto_round_off_enabled: boolean;
    po_auto_round_off_step: number;
  };
  canEdit: boolean;
};

function formatStepLabel(step: PoAutoRoundOffStepPreset): string {
  if (step === 1) return "1.00 (whole unit)";
  return step.toFixed(2);
}

export function ProcurementPoliciesPanel({ initialSettings, canEdit }: Props) {
  const [enabled, setEnabled] = useState(initialSettings.po_auto_round_off_enabled);
  const [step, setStep] = useState<PoAutoRoundOffStepPreset>(
    PO_AUTO_ROUND_OFF_STEP_PRESETS.includes(
      initialSettings.po_auto_round_off_step as PoAutoRoundOffStepPreset
    )
      ? (initialSettings.po_auto_round_off_step as PoAutoRoundOffStepPreset)
      : 1
  );
  const [isPending, startTransition] = useTransition();

  const isDirty =
    enabled !== initialSettings.po_auto_round_off_enabled ||
    step !== initialSettings.po_auto_round_off_step;

  const handleSave = () => {
    startTransition(async () => {
      const result = await saveProcurementPolicies({
        po_auto_round_off_enabled: enabled,
        po_auto_round_off_step: step,
      });
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("Procurement policies saved.");
    });
  };

  return (
    <div className="space-y-4">
      <OrgSettingsSection
        title="Purchase order totals"
        description="Control how purchase order grand totals are rounded before issue."
      >
        <div className="space-y-3">
          <div className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
            <div>
              <Label htmlFor="po_auto_round_off_enabled" className="text-sm font-medium">
                Auto round-off on purchase order totals
              </Label>
              <p className="text-xs text-muted-foreground">
                When enabled, round-off is computed automatically and grand total is adjusted to
                the nearest configured step.
              </p>
            </div>
            <Switch
              id="po_auto_round_off_enabled"
              checked={enabled}
              disabled={!canEdit || isPending}
              onCheckedChange={setEnabled}
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border px-4 py-3">
            <div>
              <Label htmlFor="po_auto_round_off_step" className="text-sm font-medium">
                Round to nearest
              </Label>
              <p className="text-xs text-muted-foreground">
                Applies when auto round-off is enabled.
              </p>
            </div>
            <Select
              value={String(step)}
              disabled={!canEdit || isPending || !enabled}
              onValueChange={(value) =>
                setStep(Number(value) as PoAutoRoundOffStepPreset)
              }
            >
              <SelectTrigger id="po_auto_round_off_step" className="h-8 w-[10rem] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PO_AUTO_ROUND_OFF_STEP_PRESETS.map((preset) => (
                  <SelectItem key={preset} value={String(preset)} className="text-xs">
                    {formatStepLabel(preset)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </OrgSettingsSection>

      {canEdit ? (
        <div className="flex justify-end">
          <Button size="sm" disabled={!isDirty || isPending} onClick={handleSave}>
            {isPending ? "Saving…" : "Save policies"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

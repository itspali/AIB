"use client";

import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { ApprovalPolicyBand } from "@/lib/approvals/policy-types";

type Props = {
  bands: ApprovalPolicyBand[];
  disabled?: boolean;
  onChange: (bands: ApprovalPolicyBand[]) => void;
};

function defaultBand(): ApprovalPolicyBand {
  return {
    min_amount: 0,
    max_amount: null,
    levels: [{ steps: [{ label: "First approver", quorum: "ANY", pool: "default" }] }],
  };
}

export function ApprovalExtraStepsEditor({ bands, disabled = false, onChange }: Props) {
  const band = bands[0] ?? defaultBand();
  const levels = band.levels ?? [{ steps: [{ label: "First approver", quorum: "ANY", pool: "default" }] }];

  const updateLevels = (nextLevels: ApprovalPolicyBand["levels"]) => {
    onChange([{ ...band, levels: nextLevels }]);
  };

  const addStep = () => {
    updateLevels([
      ...levels,
      {
        steps: [
          {
            label: `Step ${levels.length + 1}`,
            quorum: "ANY",
            pool: "default",
          },
        ],
      },
    ]);
  };

  const removeStep = (index: number) => {
    if (levels.length <= 1 || index === 0) return;
    updateLevels(levels.filter((_, i) => i !== index));
  };

  const setEveryoneMustApprove = (index: number, checked: boolean) => {
    updateLevels(
      levels.map((level, i) =>
        i !== index
          ? level
          : {
              steps: level.steps.map((step, stepIndex) =>
                stepIndex === 0
                  ? { ...step, quorum: checked ? "ALL" : "ANY" }
                  : step
              ),
            }
      )
    );
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Step 1 is always first. Add more steps if a second person (or everyone) must approve after
        that.
      </p>

      {levels.map((level, index) => (
        <div
          key={`step-${index}`}
          className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-background px-3 py-2"
        >
          <div>
            <p className="text-sm font-medium">
              {index === 0 ? "Step 1 — First approver" : `Step ${index + 1} — Next approver`}
            </p>
            <p className="text-xs text-muted-foreground">
              {index === 0
                ? "Any listed approver or owner can approve."
                : "Runs after the previous step is done."}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {index > 0 ? (
              <>
                <Label htmlFor={`everyone-${index}`} className="text-xs whitespace-nowrap">
                  Everyone must approve
                </Label>
                <Switch
                  id={`everyone-${index}`}
                  checked={level.steps[0]?.quorum === "ALL"}
                  disabled={disabled}
                  onCheckedChange={(checked) => setEveryoneMustApprove(index, checked)}
                />
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 p-0"
                  disabled={disabled}
                  aria-label={`Remove step ${index + 1}`}
                  onClick={() => removeStep(index)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </>
            ) : null}
          </div>
        </div>
      ))}

      <Button type="button" size="sm" variant="outline" disabled={disabled} onClick={addStep}>
        <Plus className="mr-1 h-3.5 w-3.5" />
        Add another approval step
      </Button>
    </div>
  );
}

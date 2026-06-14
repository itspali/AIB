"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type {
  ApprovalPolicyBand,
  ApprovalPolicyLevel,
  ApprovalPolicyStep,
} from "@/lib/approvals/policy-types";
import { describePolicyBand } from "@/lib/approvals/normalize-policy";
import type { WorkspaceEligibleUser } from "@/lib/organization/queries";

type Props = {
  bands: ApprovalPolicyBand[];
  defaultApproverUserIds: string[];
  eligibleUsers: WorkspaceEligibleUser[];
  disabled?: boolean;
  onChange: (bands: ApprovalPolicyBand[]) => void;
};

function emptyApprovalBand(minAmount = 0): ApprovalPolicyBand {
  return {
    min_amount: minAmount,
    max_amount: null,
    levels: [
      {
        steps: [{ label: "Approvers", quorum: "ANY", pool: "default" }],
      },
    ],
  };
}

export function ApprovalPolicyBandEditor({
  bands,
  defaultApproverUserIds,
  eligibleUsers,
  disabled = false,
  onChange,
}: Props) {
  const rows = bands.length ? bands : [emptyApprovalBand()];

  const patchBand = (index: number, partial: Partial<ApprovalPolicyBand>) => {
    const next = rows.map((band, i) => (i === index ? { ...band, ...partial } : band));
    onChange(next);
  };

  const patchLevel = (bandIndex: number, levelIndex: number, level: ApprovalPolicyLevel) => {
    const band = rows[bandIndex];
    const levels = [...(band.levels ?? [])];
    levels[levelIndex] = level;
    patchBand(bandIndex, { levels, skip: false });
  };

  const addBand = () => {
    const last = rows[rows.length - 1];
    const minAmount =
      last?.max_amount != null
        ? last.max_amount
        : (last?.min_amount ?? 0) + 10000;
    onChange([...rows, emptyApprovalBand(minAmount)]);
  };

  return (
    <div className="space-y-4">
      {rows.map((band, bandIndex) => (
        <div
          key={`band-${bandIndex}`}
          className="rounded-lg border border-border bg-card/40 p-4 space-y-3"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium">Band {bandIndex + 1}</p>
            <p className="text-xs text-muted-foreground">{describePolicyBand(band)}</p>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <Label>Min amount</Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                disabled={disabled}
                value={band.min_amount}
                onChange={(e) =>
                  patchBand(bandIndex, { min_amount: Number(e.target.value) || 0 })
                }
              />
            </div>
            <div className="space-y-1">
              <Label>Max amount (empty = no limit)</Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                disabled={disabled}
                value={band.max_amount ?? ""}
                onChange={(e) => {
                  const raw = e.target.value.trim();
                  patchBand(bandIndex, {
                    max_amount: raw === "" ? null : Number(raw),
                  });
                }}
              />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
            <div>
              <p className="text-sm">Skip approval in this band</p>
              <p className="text-xs text-muted-foreground">
                Use for low-value self-approve bands only.
              </p>
            </div>
            <Switch
              checked={Boolean(band.skip)}
              disabled={disabled}
              onCheckedChange={(checked) =>
                patchBand(bandIndex, {
                  skip: checked,
                  levels: checked ? [] : band.levels?.length ? band.levels : emptyApprovalBand().levels,
                })
              }
            />
          </div>

          {!band.skip ? (
            <div className="space-y-3">
              {(band.levels ?? []).map((level, levelIndex) => (
                <div key={`level-${levelIndex}`} className="rounded-md border border-dashed border-border p-3 space-y-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Level {levelIndex + 1}
                  </p>
                  {(level.steps ?? []).map((step, stepIndex) => (
                    <div key={`step-${stepIndex}`} className="grid gap-2 md:grid-cols-3">
                      <Input
                        disabled={disabled}
                        value={step.label}
                        placeholder="Step label"
                        onChange={(e) => {
                          const steps = [...level.steps];
                          steps[stepIndex] = { ...step, label: e.target.value };
                          patchLevel(bandIndex, levelIndex, { steps });
                        }}
                      />
                      <Select
                        disabled={disabled}
                        value={step.quorum}
                        onValueChange={(value: ApprovalPolicyStep["quorum"]) => {
                          const steps = [...level.steps];
                          steps[stepIndex] = { ...step, quorum: value };
                          patchLevel(bandIndex, levelIndex, { steps });
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ANY">Any one approver</SelectItem>
                          <SelectItem value="ALL">All assignees</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input
                        disabled={disabled}
                        value={step.pool}
                        placeholder="Pool key (default)"
                        onChange={(e) => {
                          const steps = [...level.steps];
                          steps[stepIndex] = { ...step, pool: e.target.value || "default" };
                          patchLevel(bandIndex, levelIndex, { steps });
                        }}
                      />
                    </div>
                  ))}
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={disabled}
                    onClick={() => {
                      const steps = [
                        ...(level.steps ?? []),
                        { label: "Parallel step", quorum: "ANY" as const, pool: "default" },
                      ];
                      patchLevel(bandIndex, levelIndex, { steps });
                    }}
                  >
                    Add parallel step
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={disabled}
                onClick={() => {
                  const levels = [
                    ...(band.levels ?? []),
                    {
                      steps: [{ label: "Next level", quorum: "ANY" as const, pool: "default" }],
                    },
                  ];
                  patchBand(bandIndex, { levels });
                }}
              >
                Add sequential level
              </Button>
            </div>
          ) : null}

          {rows.length > 1 ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="text-destructive"
              disabled={disabled}
              onClick={() => onChange(rows.filter((_, i) => i !== bandIndex))}
            >
              <Trash2 className="mr-1 h-3.5 w-3.5" />
              Remove band
            </Button>
          ) : null}
        </div>
      ))}

      <Button type="button" size="sm" variant="outline" disabled={disabled} onClick={addBand}>
        <Plus className="mr-1 h-3.5 w-3.5" />
        Add amount band
      </Button>

      <p className="text-xs text-muted-foreground">
        Default approver pool uses {defaultApproverUserIds.length} named user(s) from the Approvers
        section. Pool key <code className="font-mono">default</code> maps to that list.
        {eligibleUsers.length ? ` ${eligibleUsers.length} eligible workspace users.` : ""}
      </p>
    </div>
  );
}

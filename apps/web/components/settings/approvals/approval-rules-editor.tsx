"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  PO_APPROVAL_RULE_DEFINITIONS,
  type PoApprovalRule,
} from "@/lib/approvals/approval-rules";

export type ApprovalRuleEditorDefinition = {
  type: string;
  label: string;
  description: string;
  usesThreshold: boolean;
  usesTolerance: boolean;
  thresholdLabel?: string;
  toleranceLabel?: string;
};

export type ApprovalRuleEditorRow = {
  type: string;
  enabled: boolean;
  threshold?: number | null;
  tolerance_percent?: number | null;
};

type Props = {
  rules: ApprovalRuleEditorRow[];
  definitions?: readonly ApprovalRuleEditorDefinition[];
  disabled?: boolean;
  onChange: (rules: ApprovalRuleEditorRow[]) => void;
  helperText?: string;
};

export function ApprovalRulesEditor({
  rules,
  definitions = PO_APPROVAL_RULE_DEFINITIONS,
  disabled = false,
  onChange,
  helperText = "These checks can require approval even when a document is below your amount exemption.",
}: Props) {
  const updateRule = (type: string, patch: Partial<ApprovalRuleEditorRow>) => {
    onChange(
      rules.map((rule) => (rule.type === type ? { ...rule, ...patch } : rule))
    );
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">{helperText}</p>

      {definitions.map((def) => {
        const rule = rules.find((entry) => entry.type === def.type);
        if (!rule) return null;

        return (
          <div
            key={def.type}
            className="rounded-md border border-border bg-background px-3 py-3"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium">{def.label}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{def.description}</p>
              </div>
              <Switch
                checked={rule.enabled}
                disabled={disabled}
                onCheckedChange={(checked) => updateRule(def.type, { enabled: checked })}
              />
            </div>

            {rule.enabled ? (
              <div className="mt-3 grid gap-3 border-t border-border pt-3 sm:grid-cols-2">
                {def.usesThreshold ? (
                  <div className="space-y-1">
                    <Label className="text-xs">{def.thresholdLabel ?? "Threshold"}</Label>
                    <Input
                      type="number"
                      min={0}
                      step="0.0001"
                      disabled={disabled}
                      value={rule.threshold ?? ""}
                      onChange={(event) => {
                        const raw = event.target.value.trim();
                        updateRule(def.type, {
                          threshold: raw === "" ? null : Number(raw),
                        });
                      }}
                    />
                  </div>
                ) : null}

                {def.usesTolerance ? (
                  <div className="space-y-1">
                    <Label className="text-xs">
                      {def.toleranceLabel ?? "Allow up to (% over catalog)"}
                    </Label>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      disabled={disabled}
                      value={rule.tolerance_percent ?? 0}
                      onChange={(event) => {
                        const raw = event.target.value.trim();
                        updateRule(def.type, {
                          tolerance_percent: raw === "" ? 0 : Number(raw),
                        });
                      }}
                    />
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

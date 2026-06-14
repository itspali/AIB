"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  PO_APPROVAL_RULE_DEFINITIONS,
  type PoApprovalRule,
} from "@/lib/approvals/approval-rules";

type Props = {
  rules: PoApprovalRule[];
  disabled?: boolean;
  onChange: (rules: PoApprovalRule[]) => void;
};

export function ApprovalRulesEditor({ rules, disabled = false, onChange }: Props) {
  const updateRule = (type: PoApprovalRule["type"], patch: Partial<PoApprovalRule>) => {
    onChange(
      rules.map((rule) => (rule.type === type ? { ...rule, ...patch } : rule))
    );
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        These checks can require approval even when an order is below your amount exemption.
      </p>

      {PO_APPROVAL_RULE_DEFINITIONS.map((def) => {
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
                    <Label className="text-xs">Allow up to (% over catalog)</Label>
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

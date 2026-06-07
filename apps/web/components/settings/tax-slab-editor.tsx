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
import {
  TAX_RULE_BASES,
  taxRuleBasisLabel,
  type TaxRuleBasis,
  type TaxRuleFormEntry,
} from "@/lib/tax/types";

type Props = {
  rules: TaxRuleFormEntry[];
  disabled?: boolean;
  onChange: (rules: TaxRuleFormEntry[]) => void;
};

export function TaxSlabEditor({ rules, disabled = false, onChange }: Props) {
  const updateRule = (index: number, patch: Partial<TaxRuleFormEntry>) => {
    onChange(rules.map((rule, i) => (i === index ? { ...rule, ...patch } : rule)));
  };

  const addRule = () => {
    const lastMax = rules.length ? rules[rules.length - 1].threshold_max : "0";
    onChange([
      ...rules,
      {
        basis: rules[0]?.basis ?? "UNIT_PRICE",
        threshold_min: lastMax || "0",
        threshold_max: "",
        rate: "0",
      },
    ]);
  };

  const removeRule = (index: number) => {
    onChange(rules.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium text-muted-foreground">Slab tiers</Label>
        <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={addRule}>
          <Plus className="h-4 w-4" />
          Add tier
        </Button>
      </div>

      {rules.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">
          Add at least one tier. Tiers must be contiguous and start at 0 (e.g. 0–1000 at 5%, then
          1000+ at 12%). Leave the upper bound blank for the open-ended top tier.
        </p>
      ) : (
        <div className="space-y-3">
          {rules.map((rule, index) => (
            <div
              key={index}
              className="grid grid-cols-1 gap-3 rounded-lg border border-border/80 border-black/[0.06] p-3 sm:grid-cols-[1fr_auto] dark:border-white/10"
            >
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="col-span-2 space-y-1 sm:col-span-1">
                  <Label className="text-xs text-muted-foreground">Basis</Label>
                  <Select
                    value={rule.basis}
                    disabled={disabled}
                    onValueChange={(value) =>
                      updateRule(index, { basis: value as TaxRuleBasis })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TAX_RULE_BASES.map((basis) => (
                        <SelectItem key={basis} value={basis}>
                          {taxRuleBasisLabel(basis)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">From</Label>
                  <Input
                    inputMode="decimal"
                    className="text-right font-mono"
                    value={rule.threshold_min}
                    disabled={disabled}
                    onChange={(e) => updateRule(index, { threshold_min: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">To (blank = ∞)</Label>
                  <Input
                    inputMode="decimal"
                    className="text-right font-mono"
                    placeholder="∞"
                    value={rule.threshold_max}
                    disabled={disabled}
                    onChange={(e) => updateRule(index, { threshold_max: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Rate %</Label>
                  <Input
                    inputMode="decimal"
                    className="text-right font-mono"
                    value={rule.rate}
                    disabled={disabled}
                    onChange={(e) => updateRule(index, { rate: e.target.value })}
                  />
                </div>
              </div>
              <div className="flex items-end justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={disabled}
                  onClick={() => removeRule(index)}
                  aria-label="Remove tier"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

"use client";

import type { BusinessModel } from "@/lib/onboarding/business-model";
import { BUSINESS_MODEL_OPTIONS } from "@/lib/onboarding/business-model";
import { cn } from "@/lib/utils";

type Props = {
  value: BusinessModel;
  onChange: (value: BusinessModel) => void;
  disabled?: boolean;
  label?: string;
  helperText?: string;
};

export function BusinessModelSelector({
  value,
  onChange,
  disabled,
  label = "How do you sell?",
  helperText,
}: Props) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      {helperText ? <p className="text-xs text-muted-foreground">{helperText}</p> : null}
      <div className="grid gap-2">
        {BUSINESS_MODEL_OPTIONS.map((option) => {
          const selected = value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              disabled={disabled}
              onClick={() => onChange(option.value)}
              className={cn(
                "rounded-lg border p-3 text-left transition-colors",
                selected
                  ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                  : "border-border hover:bg-muted/40",
                disabled && "cursor-not-allowed opacity-60"
              )}
            >
              <span className="block text-sm font-medium">{option.label}</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">{option.description}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

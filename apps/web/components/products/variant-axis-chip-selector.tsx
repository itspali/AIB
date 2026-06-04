"use client";

import { fieldHelpText, SubsectionHeading } from "@/components/ui/field-label-info";
import type { AttributeTemplateEntry } from "@/lib/categories/types";
import { VARIANT_AXES_HELP, VARIANT_AXES_LABEL } from "@/lib/products/product-user-labels";
import { cn } from "@/lib/utils";

type Props = {
  templates: AttributeTemplateEntry[];
  axisKeys: string[];
  suggestedAxisKeys?: string[];
  disabled?: boolean;
  compact?: boolean;
  /** When omitted, title/help are hidden (e.g. inside the matrix drawer). */
  showHeading?: boolean;
  onChange: (axisKeys: string[]) => void;
};

/**
 * One-click selection of which category attributes are variant axes.
 * Selected chips split the product into SKUs; unselected chips are descriptive only.
 */
export function VariantAxisChipSelector({
  templates,
  axisKeys,
  suggestedAxisKeys = [],
  disabled,
  compact,
  showHeading = true,
  onChange,
}: Props) {
  if (templates.length === 0) return null;

  const axisSet = new Set(axisKeys);
  const suggestionLabels = suggestedAxisKeys
    .map((key) => templates.find((template) => template.key === key)?.label ?? key)
    .filter((label, index, list) => list.indexOf(label) === index);

  const toggle = (key: string) => {
    const next = new Set(axisKeys);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    onChange(templates.filter((template) => next.has(template.key)).map((template) => template.key));
  };

  return (
    <div className="space-y-2.5">
      {showHeading ? (
        <SubsectionHeading
          title={VARIANT_AXES_LABEL}
          compact={compact}
          className={compact ? "bg-transparent px-0 py-0" : undefined}
          info={fieldHelpText(VARIANT_AXES_HELP)}
        />
      ) : null}
      {showHeading && axisKeys.length === 0 && suggestionLabels.length > 0 ? (
        <p className="text-[11px] text-muted-foreground">
          Suggested: {suggestionLabels.join(", ")}
        </p>
      ) : null}
      <div className={cn("flex flex-wrap", compact ? "gap-1" : "gap-2")}>
        {templates.map((template) => {
          const selected = axisSet.has(template.key);
          return (
            <button
              key={template.key}
              type="button"
              disabled={disabled}
              onClick={() => toggle(template.key)}
              className={cn(
                "transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                "disabled:cursor-not-allowed disabled:opacity-50",
                compact ? "rounded-md px-2 py-0.5 text-xs" : "rounded-full px-3 py-1.5 text-sm",
                selected
                  ? "bg-primary/10 font-medium text-foreground ring-1 ring-primary/40"
                  : "bg-muted/30 text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              )}
              aria-pressed={selected}
              title={template.key}
            >
              {template.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

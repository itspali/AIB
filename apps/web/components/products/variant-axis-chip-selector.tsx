"use client";

import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { fieldHelpText, SubsectionHeading } from "@/components/ui/field-label-info";
import type { AttributeTemplateEntry } from "@/lib/categories/types";
import {
  VARIANT_AXES_HELP,
  VARIANT_AXES_LABEL,
  VARIANT_AXES_LOCKED_HELP,
  VARIANT_AXES_ORDER_HELP,
} from "@/lib/products/product-user-labels";
import {
  filterVariantAxisCandidateTemplates,
  moveVariantAxisKey,
  toggleVariantAxisKey,
} from "@/lib/products/variant-composition";
import { cn } from "@/lib/utils";

type Props = {
  templates: AttributeTemplateEntry[];
  axisKeys: string[];
  suggestedAxisKeys?: string[];
  disabled?: boolean;
  /** When true, selected axes are read-only (sellable variants already exist). */
  locked?: boolean;
  compact?: boolean;
  /** When omitted, title/help are hidden (e.g. inside the matrix drawer). */
  showHeading?: boolean;
  onChange: (axisKeys: string[]) => void;
};

/**
 * One-click selection of which category attributes are variant axes.
 * Selected axes show reorder controls; unselected attributes stay as add chips.
 */
export function VariantAxisChipSelector({
  templates,
  axisKeys,
  suggestedAxisKeys = [],
  disabled,
  locked = false,
  compact,
  showHeading = true,
  onChange,
}: Props) {
  const pickerTemplates = filterVariantAxisCandidateTemplates(templates);
  if (pickerTemplates.length === 0) return null;

  const axisSet = new Set(axisKeys);
  const suggestionLabels = suggestedAxisKeys
    .map((key) => pickerTemplates.find((template) => template.key === key)?.label ?? key)
    .filter((label, index, list) => list.indexOf(label) === index);
  const chipsDisabled = disabled || locked;

  const selectedTemplates = axisKeys
    .map((key) => pickerTemplates.find((template) => template.key === key))
    .filter((template): template is AttributeTemplateEntry => template != null);
  const unselectedTemplates = pickerTemplates.filter((template) => !axisSet.has(template.key));

  const toggle = (key: string) => {
    if (chipsDisabled) return;
    onChange(toggleVariantAxisKey(axisKeys, key));
  };

  const moveAxis = (key: string, direction: -1 | 1) => {
    if (chipsDisabled) return;
    onChange(moveVariantAxisKey(axisKeys, key, direction));
  };

  const chipSizeClass = compact ? "rounded-md text-xs" : "rounded-full text-sm";

  return (
    <div className="space-y-2.5">
      {showHeading ? (
        <SubsectionHeading
          title={VARIANT_AXES_LABEL}
          compact={compact}
          info={fieldHelpText(locked ? VARIANT_AXES_LOCKED_HELP : VARIANT_AXES_HELP)}
        />
      ) : null}
      {locked && showHeading ? (
        <p className="text-[11px] text-muted-foreground">{VARIANT_AXES_LOCKED_HELP}</p>
      ) : null}
      {showHeading && !locked && axisKeys.length === 0 && suggestionLabels.length > 0 ? (
        <p className="text-[11px] text-muted-foreground">
          Suggested: {suggestionLabels.join(", ")}
        </p>
      ) : null}
      {selectedTemplates.length > 0 && !chipsDisabled ? (
        <p className="text-[11px] text-muted-foreground">{VARIANT_AXES_ORDER_HELP}</p>
      ) : null}

      <div
        className={cn("flex flex-wrap", compact ? "gap-1.5" : "gap-2")}
        aria-label="Variant axis attributes"
      >
        {selectedTemplates.map((template) => {
          const index = axisKeys.indexOf(template.key);
          return (
            <span
              key={template.key}
              className={cn(
                "inline-flex items-center gap-0.5 border border-primary/40 bg-primary/10 text-foreground shadow-sm ring-1 ring-inset ring-primary/40",
                compact ? "px-1 py-0.5" : "py-1 pl-3 pr-1",
                chipSizeClass
              )}
            >
              <span className="font-medium">{template.label}</span>
              {!chipsDisabled ? (
                <span className="inline-flex items-center">
                  <button
                    type="button"
                    disabled={index === 0}
                    className={cn(
                      "rounded-sm p-0.5 text-muted-foreground transition-colors hover:bg-muted/30 hover:text-foreground disabled:opacity-30",
                      compact ? "size-5" : "size-6"
                    )}
                    aria-label={`Move ${template.label} earlier in SKU order`}
                    onClick={() => moveAxis(template.key, -1)}
                  >
                    <ChevronLeft className={compact ? "size-3.5" : "size-4"} aria-hidden />
                  </button>
                  <button
                    type="button"
                    disabled={index === axisKeys.length - 1}
                    className={cn(
                      "rounded-sm p-0.5 text-muted-foreground transition-colors hover:bg-muted/30 hover:text-foreground disabled:opacity-30",
                      compact ? "size-5" : "size-6"
                    )}
                    aria-label={`Move ${template.label} later in SKU order`}
                    onClick={() => moveAxis(template.key, 1)}
                  >
                    <ChevronRight className={compact ? "size-3.5" : "size-4"} aria-hidden />
                  </button>
                  <button
                    type="button"
                    className={cn(
                      "rounded-sm p-0.5 text-muted-foreground transition-colors hover:bg-muted/30 hover:text-foreground",
                      compact ? "size-5" : "size-6"
                    )}
                    aria-label={`Remove ${template.label} from variant axes`}
                    onClick={() => toggle(template.key)}
                  >
                    <X className={compact ? "size-3.5" : "size-4"} aria-hidden />
                  </button>
                </span>
              ) : null}
            </span>
          );
        })}

        {unselectedTemplates.map((template) => (
          <button
            key={template.key}
            type="button"
            disabled={chipsDisabled}
            onClick={() => toggle(template.key)}
            className={cn(
              "border font-medium transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              compact ? "px-2.5 py-1" : "px-3 py-1.5",
              chipSizeClass,
              chipsDisabled
                ? "cursor-default border-border/60 bg-muted/20 text-muted-foreground opacity-80"
                : "cursor-pointer border-border bg-card text-foreground shadow-sm ring-1 ring-border/50 hover:border-primary/30 hover:bg-muted/60 dark:bg-card/70 dark:ring-0 dark:hover:bg-muted/40"
            )}
            aria-pressed={false}
            title={template.key}
          >
            {template.label}
          </button>
        ))}
      </div>
    </div>
  );
}

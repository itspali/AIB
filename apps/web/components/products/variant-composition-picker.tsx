"use client";

import { ArrowLeftRight, Layers, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fieldHelpText, SubsectionHeading } from "@/components/ui/field-label-info";
import type { AttributeTemplateEntry } from "@/lib/categories/types";
import { splitTemplatesByAxis } from "@/lib/products/variant-composition";
import { cn } from "@/lib/utils";

type Props = {
  templates: AttributeTemplateEntry[];
  axisKeys: string[];
  disabled?: boolean;
  compact?: boolean;
  onChange: (axisKeys: string[]) => void;
};

const COMPOSITION_HELP =
  "Choose which category attributes create separate versions (SKUs). Attributes under “Same for every version” describe the item but don’t split it — e.g. Brand stays the same while Size varies.";

/**
 * Lets the item author decide which category attributes compose its variants
 * (the axes) versus which simply describe it. The category only suggests a
 * default; the choice here drives the variant matrix generator.
 */
export function VariantCompositionPicker({
  templates,
  axisKeys,
  disabled,
  compact,
  onChange,
}: Props) {
  if (templates.length === 0) return null;

  const { axes, descriptive } = splitTemplatesByAxis(templates, axisKeys);

  const move = (key: string, toAxis: boolean) => {
    const next = new Set(axisKeys);
    if (toAxis) next.add(key);
    else next.delete(key);
    onChange(templates.filter((template) => next.has(template.key)).map((template) => template.key));
  };

  return (
    <div className="space-y-3">
      <SubsectionHeading
        title="Variant composition"
        compact={compact}
        info={fieldHelpText(COMPOSITION_HELP)}
      />
      <div className={cn("grid gap-3", compact ? "grid-cols-1" : "sm:grid-cols-2")}>
        <Bucket
          icon={Layers}
          title="Varies by"
          hint="Each value becomes a separate SKU"
          emptyLabel="No variant axes yet — move an attribute here to split this item into SKUs."
          actionLabel="Make descriptive"
          tone="axis"
          items={axes}
          disabled={disabled}
          onAction={(key) => move(key, false)}
        />
        <Bucket
          icon={Tag}
          title="Same for every version"
          hint="Describes the item; does not split it"
          emptyLabel="Every attribute currently creates variants."
          actionLabel="Make an axis"
          tone="descriptive"
          items={descriptive}
          disabled={disabled}
          onAction={(key) => move(key, true)}
        />
      </div>
    </div>
  );
}

function Bucket({
  icon: Icon,
  title,
  hint,
  emptyLabel,
  actionLabel,
  tone,
  items,
  disabled,
  onAction,
}: {
  icon: typeof Layers;
  title: string;
  hint: string;
  emptyLabel: string;
  actionLabel: string;
  tone: "axis" | "descriptive";
  items: AttributeTemplateEntry[];
  disabled?: boolean;
  onAction: (key: string) => void;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border p-3",
        tone === "axis"
          ? "border-primary/40 bg-primary/5"
          : "border-border bg-muted/30"
      )}
    >
      <div className="flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
        <p className="text-xs font-medium text-foreground">{title}</p>
      </div>
      <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>
      {items.length === 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">{emptyLabel}</p>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {items.map((template) => (
            <li
              key={template.key}
              className="flex items-center justify-between gap-2 rounded-md border border-border bg-background px-2 py-1.5"
            >
              <span className="min-w-0 truncate text-sm">
                {template.label}
                <span className="ml-1 font-mono text-[11px] text-muted-foreground">
                  {template.key}
                </span>
              </span>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-7 shrink-0 gap-1 px-2 text-[11px] text-muted-foreground hover:text-foreground"
                disabled={disabled}
                onClick={() => onAction(template.key)}
              >
                <ArrowLeftRight className="h-3 w-3" aria-hidden />
                {actionLabel}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

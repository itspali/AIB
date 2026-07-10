"use client";

import { Input } from "@/components/ui/input";
import { FieldLabelInfo, fieldHelpText } from "@/components/ui/field-label-info";
import { VARIANT_FIELD_HELP } from "@/lib/products/item-editor-field-help";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { AttributeTemplateEntry } from "@/lib/categories/types";
import {
  editorFieldSpanFullClass,
  editorGridClass,
  useEditorPanelLayout,
} from "@/lib/products/editor-chrome";
import { cn } from "@/lib/utils";

type Props = {
  templates: AttributeTemplateEntry[];
  values: Record<string, string>;
  disabled?: boolean;
  emptyMessage?: string;
  onChange: (key: string, value: string) => void;
};

function parseMultiselectValue(value: string): Set<string> {
  return new Set(
    value
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean)
  );
}

function formatMultiselectValue(selected: Iterable<string>): string {
  return [...selected].join(", ");
}

export function VariantAttributeFields({
  templates,
  values,
  disabled,
  emptyMessage = "Pick a category first to show size, color, and other options for each version.",
  onChange,
}: Props) {
  const panel = useEditorPanelLayout();

  if (templates.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyMessage}</p>;
  }

  return (
    <div className={editorGridClass(panel)}>
      {templates.map((template) => {
        const fieldId = `variant_attr_${template.key}`;
        const currentValue = values[template.key] ?? "";

        if (template.type === "boolean") {
          return (
            <div
              key={template.key}
              className={cn(
                "editor-toggle-row flex items-center justify-between",
                editorFieldSpanFullClass(panel),
                panel
                  ? "variant-attribute-toggle"
                  : "rounded-lg border border-border px-4 py-3"
              )}
            >
              <div className="flex items-center gap-1.5">
                <p className="text-sm font-medium">{template.label}</p>
                <FieldLabelInfo label={template.label}>
                  {fieldHelpText(VARIANT_FIELD_HELP.categoryAttribute(template.key))}
                </FieldLabelInfo>
              </div>
              <Switch
                checked={currentValue === "true"}
                disabled={disabled}
                onCheckedChange={(checked) => onChange(template.key, checked ? "true" : "false")}
              />
            </div>
          );
        }

        if (template.type === "multiselect" && template.options?.length) {
          const selected = parseMultiselectValue(currentValue);
          return (
            <div
              key={template.key}
              className={cn(panel ? "space-y-1.5" : "space-y-2", editorFieldSpanFullClass(panel))}
            >
              <div className="flex items-center gap-1.5">
                <Label
                  className={cn(
                    "font-medium text-muted-foreground",
                    panel ? "text-xs" : "text-sm"
                  )}
                >
                  {template.label}
                  {template.required && " *"}
                </Label>
                <FieldLabelInfo label={template.label}>
                  {fieldHelpText(VARIANT_FIELD_HELP.categoryAttribute(template.key))}
                </FieldLabelInfo>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {template.options.map((option) => {
                  const isSelected = selected.has(option.label);
                  return (
                    <button
                      key={option.label}
                      type="button"
                      disabled={disabled}
                      aria-pressed={isSelected}
                      onClick={() => {
                        const next = new Set(selected);
                        if (next.has(option.label)) next.delete(option.label);
                        else next.add(option.label);
                        onChange(template.key, formatMultiselectValue(next));
                      }}
                      className={cn(
                        "cursor-pointer border font-medium transition-colors",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        "disabled:cursor-not-allowed disabled:opacity-50",
                        panel ? "rounded-md px-2.5 py-1 text-xs" : "rounded-full px-3 py-1.5 text-sm",
                        isSelected
                          ? "border-primary bg-primary/10 text-foreground ring-1 ring-inset ring-primary/40"
                          : "border-border bg-background text-foreground shadow-sm hover:border-primary/30 hover:bg-muted/60"
                      )}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        }

        if (template.type === "select" && template.options?.length) {
          return (
            <div key={template.key} className={panel ? "space-y-1.5" : "space-y-2"}>
              <div className="flex items-center gap-1.5">
                <Label
                  htmlFor={fieldId}
                  className={cn(
                    "font-medium text-muted-foreground",
                    panel ? "text-xs" : "text-sm"
                  )}
                >
                  {template.label}
                  {template.required && " *"}
                </Label>
                <FieldLabelInfo label={template.label}>
                  {fieldHelpText(VARIANT_FIELD_HELP.categoryAttribute(template.key))}
                </FieldLabelInfo>
              </div>
              <Select
                value={currentValue || "none"}
                disabled={disabled}
                onValueChange={(value) => onChange(template.key, value === "none" ? "" : value)}
              >
                <SelectTrigger id={fieldId}>
                  <SelectValue placeholder={`Select ${template.label.toLowerCase()}`} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not set</SelectItem>
                  {template.options.map((option) => (
                    <SelectItem key={option.label} value={option.label}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          );
        }

        return (
          <div key={template.key} className={panel ? "space-y-1.5" : "space-y-2"}>
            <div className="flex items-center gap-1.5">
              <Label
                htmlFor={fieldId}
                className={cn(
                  "font-medium text-muted-foreground",
                  panel ? "text-xs" : "text-sm"
                )}
              >
                {template.label}
                {template.required && " *"}
              </Label>
              <FieldLabelInfo label={template.label}>
                {fieldHelpText(
                  `Category attribute (“${template.key}”). Used when building variant SKUs from your SKU mask.`
                )}
              </FieldLabelInfo>
            </div>
            <Input
              id={fieldId}
              disabled={disabled}
              value={currentValue}
              onChange={(event) => onChange(template.key, event.target.value)}
            />
          </div>
        );
      })}
    </div>
  );
}

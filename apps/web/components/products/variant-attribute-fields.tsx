"use client";

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
import type { AttributeTemplateEntry } from "@/lib/categories/types";
import { useEditorPanelLayout } from "@/lib/products/editor-chrome";
import { cn } from "@/lib/utils";

type Props = {
  templates: AttributeTemplateEntry[];
  values: Record<string, string>;
  disabled?: boolean;
  onChange: (key: string, value: string) => void;
};

export function VariantAttributeFields({ templates, values, disabled, onChange }: Props) {
  const panel = useEditorPanelLayout();

  if (templates.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Select a category with attribute templates to capture variant-specific parameters.
      </p>
    );
  }

  return (
    <div className={cn("grid grid-cols-1 sm:grid-cols-2", panel ? "gap-3" : "gap-4")}>
      {templates.map((template) => {
        const fieldId = `variant_attr_${template.key}`;
        const currentValue = values[template.key] ?? "";

        if (template.type === "boolean") {
          return (
            <div
              key={template.key}
              className={cn(
                "flex items-center justify-between sm:col-span-2",
                panel
                  ? "variant-attribute-toggle"
                  : "rounded-lg border border-border px-4 py-3"
              )}
            >
              <div>
                <p className="text-sm font-medium">{template.label}</p>
                <p className="text-xs text-muted-foreground">{template.key}</p>
              </div>
              <Switch
                checked={currentValue === "true"}
                disabled={disabled}
                onCheckedChange={(checked) => onChange(template.key, checked ? "true" : "false")}
              />
            </div>
          );
        }

        if (template.type === "select" && template.options?.length) {
          return (
            <div key={template.key} className={panel ? "space-y-1.5" : "space-y-2"}>
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
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          );
        }

        return (
          <div key={template.key} className={panel ? "space-y-1.5" : "space-y-2"}>
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

"use client";

import { FieldLabelInfo, fieldHelpText } from "@/components/ui/field-label-info";
import { DrawerFormField, DrawerFormGrid } from "@/components/layout/drawer-form-grid";
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
import type { EntityCustomFieldDefinition } from "@/lib/entities/custom-field-definitions";

type Props = {
  definitions: EntityCustomFieldDefinition[];
  values: Record<string, string>;
  disabled?: boolean;
  onChange: (values: Record<string, string>) => void;
};

export function EntityCustomFieldsSection({
  definitions,
  values,
  disabled = false,
  onChange,
}: Props) {
  if (definitions.length === 0) return null;

  const setValue = (key: string, value: string) => {
    onChange({ ...values, [key]: value });
  };

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-medium">Custom fields</p>
        <p className="text-xs text-muted-foreground">
          Additional profile fields configured for this workspace.
        </p>
      </div>
      <DrawerFormGrid>
        {definitions.map((definition) => (
          <DrawerFormField key={definition.key}>
            <div className="flex items-center gap-1.5">
              <Label htmlFor={`entity-custom-${definition.key}`}>
                {definition.label}
                {definition.required ? " *" : ""}
              </Label>
              {definition.help_text ? (
                <FieldLabelInfo label={definition.label}>
                  {fieldHelpText(definition.help_text)}
                </FieldLabelInfo>
              ) : null}
            </div>

            {definition.type === "boolean" ? (
              <div className="flex items-center gap-2 rounded-md border border-border/70 px-3 py-2">
                <Switch
                  id={`entity-custom-${definition.key}`}
                  checked={values[definition.key] === "true"}
                  disabled={disabled}
                  onCheckedChange={(checked) => setValue(definition.key, checked ? "true" : "false")}
                />
                <Label htmlFor={`entity-custom-${definition.key}`} className="font-normal">
                  {values[definition.key] === "true" ? "Yes" : "No"}
                </Label>
              </div>
            ) : definition.type === "select" ? (
              <Select
                value={values[definition.key] || undefined}
                disabled={disabled}
                onValueChange={(value) => setValue(definition.key, value)}
              >
                <SelectTrigger id={`entity-custom-${definition.key}`}>
                  <SelectValue placeholder="Select…" />
                </SelectTrigger>
                <SelectContent>
                  {(definition.options ?? []).map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                id={`entity-custom-${definition.key}`}
                type={definition.type === "number" ? "number" : definition.type === "date" ? "date" : "text"}
                value={values[definition.key] ?? ""}
                disabled={disabled}
                onChange={(event) => setValue(definition.key, event.target.value)}
              />
            )}
          </DrawerFormField>
        ))}
      </DrawerFormGrid>
    </div>
  );
}

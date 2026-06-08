"use client";

import { Plus, Trash2 } from "lucide-react";
import {
  ENTITY_CUSTOM_FIELD_TYPES,
  entityCustomFieldTypeNeedsOptions,
  suggestUniqueAttributeKey,
  type EntityCustomFieldDefinition,
} from "@/lib/entities/custom-field-definitions";
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
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

type Props = {
  rows: EntityCustomFieldDefinition[];
  onChange: (rows: EntityCustomFieldDefinition[]) => void;
  disabled?: boolean;
  readOnlyKeys?: Set<string>;
};

function emptyRow(): EntityCustomFieldDefinition {
  return {
    key: "",
    label: "",
    type: "text",
    required: false,
  };
}

export function EntityCustomFieldsBuilder({
  rows,
  onChange,
  disabled = false,
  readOnlyKeys,
}: Props) {
  const updateRow = (index: number, patch: Partial<EntityCustomFieldDefinition>) => {
    onChange(rows.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)));
  };

  const handleLabelChange = (index: number, label: string) => {
    const current = rows[index];
    const shouldSuggestKey = !current.key || current.key === suggestUniqueAttributeKey(current.label, rows, index);
    onChange(
      rows.map((row, rowIndex) =>
        rowIndex === index
          ? {
              ...row,
              label,
              key: shouldSuggestKey ? suggestUniqueAttributeKey(label, rows, index) : row.key,
            }
          : row
      )
    );
  };

  return (
    <div className="space-y-3">
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No custom fields configured yet. Add fields to capture partner-specific data on entity
          profiles.
        </p>
      ) : null}

      {rows.map((row, index) => {
        const isReadOnly = readOnlyKeys?.has(row.key) ?? false;
        return (
          <div
            key={`entity-custom-field-${index}-${row.key || "new"}`}
            className="space-y-3 rounded-lg border border-border/80 p-3"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="grid flex-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor={`entity-field-label-${index}`}>Label</Label>
                  <Input
                    id={`entity-field-label-${index}`}
                    value={row.label}
                    disabled={disabled || isReadOnly}
                    placeholder="Credit rating"
                    onChange={(event) => handleLabelChange(index, event.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`entity-field-key-${index}`}>Key</Label>
                  <Input
                    id={`entity-field-key-${index}`}
                    value={row.key}
                    disabled={disabled || isReadOnly}
                    placeholder="credit_rating"
                    onChange={(event) =>
                      updateRow(index, { key: event.target.value.toLowerCase() })
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`entity-field-type-${index}`}>Type</Label>
                  <Select
                    value={row.type}
                    disabled={disabled || isReadOnly}
                    onValueChange={(value) =>
                      updateRow(index, {
                        type: value as EntityCustomFieldDefinition["type"],
                        options: value === "select" ? row.options ?? [""] : undefined,
                      })
                    }
                  >
                    <SelectTrigger id={`entity-field-type-${index}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ENTITY_CUSTOM_FIELD_TYPES.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`entity-field-help-${index}`}>Help text</Label>
                  <Input
                    id={`entity-field-help-${index}`}
                    value={row.help_text ?? ""}
                    disabled={disabled || isReadOnly}
                    placeholder="Optional hint shown in the entity form"
                    onChange={(event) => updateRow(index, { help_text: event.target.value })}
                  />
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={disabled || isReadOnly}
                aria-label="Remove custom field"
                onClick={() => onChange(rows.filter((_, rowIndex) => rowIndex !== index))}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>

            {entityCustomFieldTypeNeedsOptions(row.type) ? (
              <div className="space-y-1.5">
                <Label htmlFor={`entity-field-options-${index}`}>Options (comma-separated)</Label>
                <Input
                  id={`entity-field-options-${index}`}
                  value={(row.options ?? []).join(", ")}
                  disabled={disabled || isReadOnly}
                  placeholder="Gold, Silver, Bronze"
                  onChange={(event) =>
                    updateRow(index, {
                      options: event.target.value
                        .split(",")
                        .map((option) => option.trim())
                        .filter(Boolean),
                    })
                  }
                />
              </div>
            ) : null}

            <div className="flex items-center justify-between rounded-md border border-border/70 px-3 py-2">
              <div>
                <p className="text-sm font-medium">Required on entity save</p>
                {row.source ? (
                  <p className="text-xs text-muted-foreground">
                    Inherited from {row.source === "group" ? "group" : "organization"} settings
                  </p>
                ) : null}
              </div>
              <Switch
                checked={row.required === true}
                disabled={disabled || isReadOnly}
                onCheckedChange={(checked) => updateRow(index, { required: checked })}
                aria-label={`Required field ${row.label || index + 1}`}
              />
            </div>
          </div>
        );
      })}

      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled}
        className={cn(rows.length > 0 && "mt-1")}
        onClick={() => onChange([...rows, emptyRow()])}
      >
        <Plus className="mr-2 h-4 w-4" />
        Add custom field
      </Button>
    </div>
  );
}

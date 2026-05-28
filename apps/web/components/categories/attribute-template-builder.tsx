"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { isDuplicateAttributeKey, suggestUniqueAttributeKey } from "@/lib/categories/attribute-key";
import {
  ATTRIBUTE_FIELD_TYPES,
  attributeTypeNeedsOptions,
  type AttributeFieldType,
} from "@/lib/categories/attribute-types";
import { attributeTemplateMissingOptions } from "@/lib/categories/validate-templates";
import type { AttributeTemplateEntry } from "@/lib/categories/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Props = {
  rows: AttributeTemplateEntry[];
  onChange: (rows: AttributeTemplateEntry[]) => void;
};

const emptyRow = (): AttributeTemplateEntry => ({
  key: "",
  label: "",
  type: "text",
  required: false,
});

const FIELD_TYPE_GROUPS = ATTRIBUTE_FIELD_TYPES.reduce<Map<string, typeof ATTRIBUTE_FIELD_TYPES[number][]>>(
  (groups, entry) => {
    const list = groups.get(entry.group) ?? [];
    list.push(entry);
    groups.set(entry.group, list);
    return groups;
  },
  new Map()
);

function parseOptionsInput(raw: string): string[] {
  return raw
    .split(",")
    .map((option) => option.trim())
    .filter(Boolean);
}

function formatOptionsDisplay(options: string[] | undefined): string {
  return (options ?? []).join(", ");
}

export function AttributeTemplateBuilder({ rows, onChange }: Props) {
  const [manualKeys, setManualKeys] = useState<Set<number>>(() => {
    const initial = new Set<number>();
    rows.forEach((row, index) => {
      if (row.key.trim()) initial.add(index);
    });
    return initial;
  });
  const [optionsDrafts, setOptionsDrafts] = useState<Record<number, string>>({});

  const updateRow = (index: number, patch: Partial<AttributeTemplateEntry>) => {
    onChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  const handleLabelChange = (index: number, label: string) => {
    const nextRows = rows.map((row, i) => {
      if (i !== index) return row;
      const nextRow = { ...row, label };
      if (!manualKeys.has(index)) {
        nextRow.key = suggestUniqueAttributeKey(label, rows, index);
      }
      return nextRow;
    });
    onChange(nextRows);
  };

  const handleKeyChange = (index: number, key: string) => {
    setManualKeys((current) => new Set(current).add(index));
    updateRow(index, { key });
  };

  const handleTypeChange = (index: number, type: AttributeFieldType) => {
    const patch: Partial<AttributeTemplateEntry> = { type };
    if (!attributeTypeNeedsOptions(type)) {
      patch.options = undefined;
      setOptionsDrafts((current) => {
        const next = { ...current };
        delete next[index];
        return next;
      });
    } else if (!rows[index]?.options?.length) {
      patch.options = [];
      setOptionsDrafts((current) => ({ ...current, [index]: "" }));
    }
    updateRow(index, patch);
  };

  const groupedOptions = useMemo(
    () => Array.from(FIELD_TYPE_GROUPS.entries()),
    []
  );

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Declare attribute keys child products under this category inherit on creation. Keys are
        auto-suggested from labels unless you edit them manually.
      </p>
      {rows.map((row, index) => (
        <div
          key={index}
          className="space-y-3 rounded-lg border border-border/80 p-3 dark:border-white/10"
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-muted-foreground">Label</Label>
              <Input
                value={row.label}
                placeholder="Size"
                onChange={(e) => handleLabelChange(index, e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-muted-foreground">Key</Label>
              <Input
                value={row.key}
                placeholder="size"
                aria-invalid={isDuplicateAttributeKey(rows, index)}
                className={isDuplicateAttributeKey(rows, index) ? "border-destructive" : undefined}
                onChange={(e) => handleKeyChange(index, e.target.value)}
              />
              {isDuplicateAttributeKey(rows, index) ? (
                <p className="text-xs text-destructive">This key is already used by another attribute.</p>
              ) : !manualKeys.has(index) && row.label.trim() ? (
                <p className="text-xs text-muted-foreground">Auto-generated from label</p>
              ) : null}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-muted-foreground">Type</Label>
              <Select value={row.type} onValueChange={(value) => handleTypeChange(index, value as AttributeFieldType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {groupedOptions.map(([group, entries]) => (
                    <SelectGroup key={group}>
                      <SelectLabel>{group}</SelectLabel>
                      {entries.map((entry) => (
                        <SelectItem key={entry.value} value={entry.value}>
                          {entry.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`required-${index}`} className="text-sm font-medium text-muted-foreground">
                Required
              </Label>
              <div className="flex h-10 items-center justify-end rounded-md border border-input bg-background px-3">
                <Switch
                  id={`required-${index}`}
                  checked={Boolean(row.required)}
                  onCheckedChange={(required) => updateRow(index, { required })}
                />
              </div>
            </div>
          </div>

          {attributeTypeNeedsOptions(row.type) && (
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-muted-foreground">Options</Label>
              <Input
                value={
                  index in optionsDrafts
                    ? optionsDrafts[index]
                    : formatOptionsDisplay(row.options)
                }
                placeholder="Small, Medium, Large"
                aria-invalid={attributeTemplateMissingOptions(
                  row,
                  index in optionsDrafts ? optionsDrafts[index] : undefined
                )}
                className={
                  attributeTemplateMissingOptions(
                    row,
                    index in optionsDrafts ? optionsDrafts[index] : undefined
                  )
                    ? "border-destructive"
                    : undefined
                }
                onChange={(e) => {
                  const raw = e.target.value;
                  setOptionsDrafts((current) => ({ ...current, [index]: raw }));
                  updateRow(index, { options: parseOptionsInput(raw) });
                }}
                onBlur={() => {
                  setOptionsDrafts((current) => {
                    if (!(index in current)) return current;
                    const next = { ...current };
                    delete next[index];
                    return next;
                  });
                }}
              />
              {attributeTemplateMissingOptions(
                row,
                index in optionsDrafts ? optionsDrafts[index] : undefined
              ) ? (
                <p className="text-xs text-destructive">
                  Add at least one comma-separated choice for this field.
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">Comma-separated choices for this field.</p>
              )}
            </div>
          )}

          <div className="flex justify-end">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                onChange(rows.filter((_, i) => i !== index));
                setManualKeys((current) => {
                  const next = new Set<number>();
                  for (const keyIndex of current) {
                    if (keyIndex < index) next.add(keyIndex);
                    else if (keyIndex > index) next.add(keyIndex - 1);
                  }
                  return next;
                });
                setOptionsDrafts((current) => {
                  const next: Record<number, string> = {};
                  for (const [draftIndex, value] of Object.entries(current)) {
                    const numericIndex = Number(draftIndex);
                    if (numericIndex < index) next[numericIndex] = value;
                    else if (numericIndex > index) next[numericIndex - 1] = value;
                  }
                  return next;
                });
              }}
              aria-label="Remove attribute row"
            >
              <Trash2 className="h-4 w-4" />
              Remove
            </Button>
          </div>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={() => onChange([...rows, emptyRow()])}>
        <Plus className="h-4 w-4" />
        Add Attribute
      </Button>
    </div>
  );
}

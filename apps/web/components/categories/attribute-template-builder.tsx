"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { isDuplicateAttributeKey, suggestUniqueAttributeKey } from "@/lib/categories/attribute-key";
import {
  formatOptionsDraftDisplay,
  parseOptionsDraftInput,
} from "@/lib/categories/attribute-options";
import {
  ATTRIBUTE_FIELD_TYPES,
  attributeTypeNeedsOptions,
  type AttributeFieldType,
} from "@/lib/categories/attribute-types";
import { attributeTemplateMissingOptions } from "@/lib/categories/validate-templates";
import type { AttributeTemplateEntry } from "@/lib/categories/types";
import { CATEGORY_EDITOR_FIELD_HELP } from "@/lib/categories/category-editor-field-help";
import { isDefaultAxisTemplate } from "@/lib/products/variant-composition";
import { FieldLabelInfo, fieldHelpText } from "@/components/ui/field-label-info";
import { CategoryAttrFieldLabel, CategoryFieldLabel } from "@/components/categories/category-field-label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  /** When true, show per-attribute version-axis suggestion. */
  showAdvancedOptions?: boolean;
  /** Hide the per-attribute Required control (e.g. Extra SKU options in item editor). */
  hideRequiredField?: boolean;
};

const emptyRow = (): AttributeTemplateEntry => ({
  key: "",
  label: "",
  type: "text",
  required: false,
});

const FIELD_TYPE_GROUPS = ATTRIBUTE_FIELD_TYPES.reduce<
  Map<string, (typeof ATTRIBUTE_FIELD_TYPES)[number][]>
>((groups, entry) => {
  const list = groups.get(entry.group) ?? [];
  list.push(entry);
  groups.set(entry.group, list);
  return groups;
}, new Map());

function versionAxisSelectValue(row: AttributeTemplateEntry): "axis" | "descriptive" {
  if (row.role === "axis") return "axis";
  if (row.role === "descriptive") return "descriptive";
  return isDefaultAxisTemplate(row) ? "axis" : "descriptive";
}

export function AttributeTemplateBuilder({
  rows,
  onChange,
  showAdvancedOptions = false,
  hideRequiredField = false,
}: Props) {
  const [optionsDrafts, setOptionsDrafts] = useState<Record<number, string>>({});

  const updateRow = (index: number, patch: Partial<AttributeTemplateEntry>) => {
    onChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  const handleLabelChange = (index: number, label: string) => {
    onChange(
      rows.map((row, i) =>
        i === index
          ? { ...row, label, key: suggestUniqueAttributeKey(label, rows, index) }
          : row
      )
    );
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

  const groupedOptions = useMemo(() => Array.from(FIELD_TYPE_GROUPS.entries()), []);

  const removeRow = (index: number) => {
    onChange(rows.filter((_, i) => i !== index));
    setOptionsDrafts((current) => {
      const next: Record<number, string> = {};
      for (const [draftIndex, value] of Object.entries(current)) {
        const numericIndex = Number(draftIndex);
        if (numericIndex < index) next[numericIndex] = value;
        else if (numericIndex > index) next[numericIndex - 1] = value;
      }
      return next;
    });
  };

  return (
    <div className="attribute-template-builder">
      {rows.length === 0 ? (
        <div className="pb-2">
          <CategoryFieldLabel
            label="No attributes yet"
            help={CATEGORY_EDITOR_FIELD_HELP.attributeEmpty}
          />
        </div>
      ) : (
        <ul className="divide-y divide-border/60">
          {rows.map((row, index) => {
            const duplicateKey = isDuplicateAttributeKey(rows, index);
            const optionsDraft =
              index in optionsDrafts ? optionsDrafts[index] : undefined;
            const needsOptions = attributeTypeNeedsOptions(row.type);
            const optionsMissing = attributeTemplateMissingOptions(row, optionsDraft);
            const labelId = `attr-label-${index}`;
            const typeId = `attr-type-${index}`;
            const optionsId = `attr-options-${index}`;
            const versionAxisId = `attr-version-axis-${index}`;
            const requiredId = `attr-required-${index}`;
            const duplicateKeyError = duplicateKey
              ? "Two attributes cannot share the same internal key."
              : undefined;
            const optionsError = optionsMissing
              ? "Add at least one choice for this field (Label or Label:CODE)."
              : undefined;
            const hasRowError = Boolean(duplicateKeyError || optionsError);

            return (
              <li key={index} className="py-4 first:pt-0">
                <div
                  className="attribute-template-row -mx-1 overflow-x-auto overscroll-x-contain px-1 touch-pan-x"
                  tabIndex={0}
                  role="group"
                  aria-label={`Attribute ${index + 1} fields`}
                >
                  <div
                    className={
                      hasRowError
                        ? "flex w-max min-w-full items-end gap-3 pb-9"
                        : "flex w-max min-w-full items-end gap-3 pb-0.5"
                    }
                  >
                    <CategoryAttrFieldLabel
                      label="Label"
                      htmlFor={labelId}
                      help={CATEGORY_EDITOR_FIELD_HELP.attributeLabel}
                      error={duplicateKeyError}
                      errorLayout="absolute"
                      className="w-[7.5rem] shrink-0"
                    >
                      <Input
                        id={labelId}
                        value={row.label}
                        placeholder="e.g. Size"
                        aria-invalid={duplicateKey}
                        aria-describedby={duplicateKeyError ? `${labelId}-error` : undefined}
                        onChange={(e) => handleLabelChange(index, e.target.value)}
                      />
                    </CategoryAttrFieldLabel>

                    <CategoryAttrFieldLabel
                      label="Type"
                      htmlFor={typeId}
                      help={CATEGORY_EDITOR_FIELD_HELP.attributeType}
                      className="w-[8.75rem] shrink-0"
                    >
                      <Select
                        value={row.type}
                        onValueChange={(value) =>
                          handleTypeChange(index, value as AttributeFieldType)
                        }
                      >
                        <SelectTrigger id={typeId}>
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
                    </CategoryAttrFieldLabel>

                    {needsOptions ? (
                      <CategoryAttrFieldLabel
                        label="Options"
                        htmlFor={optionsId}
                        help={CATEGORY_EDITOR_FIELD_HELP.attributeOptions}
                        error={optionsError}
                        errorLayout="absolute"
                        className="w-[min(16rem,40vw)] shrink-0 sm:w-[14rem]"
                      >
                        <Input
                          id={optionsId}
                          value={
                            index in optionsDrafts
                              ? optionsDrafts[index]
                              : formatOptionsDraftDisplay(row.options)
                          }
                          placeholder="Black:BLK, Red:RD, 128GB:128G"
                          aria-invalid={optionsMissing}
                          aria-describedby={optionsError ? `${optionsId}-error` : undefined}
                          onChange={(e) => {
                            const raw = e.target.value;
                            setOptionsDrafts((current) => ({ ...current, [index]: raw }));
                            updateRow(index, { options: parseOptionsDraftInput(raw) });
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
                      </CategoryAttrFieldLabel>
                    ) : null}

                    {showAdvancedOptions ? (
                      <CategoryAttrFieldLabel
                        label="Version axis"
                        htmlFor={versionAxisId}
                        help={CATEGORY_EDITOR_FIELD_HELP.attributeVersionAxis}
                        className="w-[7.25rem] shrink-0"
                      >
                        <Select
                          value={versionAxisSelectValue(row)}
                          onValueChange={(value) =>
                            updateRow(index, {
                              role: value as "axis" | "descriptive",
                            })
                          }
                        >
                          <SelectTrigger id={versionAxisId}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="axis">Yes</SelectItem>
                            <SelectItem value="descriptive">No</SelectItem>
                          </SelectContent>
                        </Select>
                      </CategoryAttrFieldLabel>
                    ) : null}

                    {!hideRequiredField ? (
                      <CategoryAttrFieldLabel
                        label="Required"
                        htmlFor={requiredId}
                        help={CATEGORY_EDITOR_FIELD_HELP.attributeRequired}
                        className="w-[6.75rem] shrink-0"
                      >
                        <Select
                          value={row.required ? "yes" : "no"}
                          onValueChange={(value) =>
                            updateRow(index, { required: value === "yes" })
                          }
                        >
                          <SelectTrigger id={requiredId}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="yes">Yes</SelectItem>
                            <SelectItem value="no">No</SelectItem>
                          </SelectContent>
                        </Select>
                      </CategoryAttrFieldLabel>
                    ) : null}

                    <div className="flex h-9 w-9 shrink-0 items-center justify-center">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => removeRow(index)}
                        aria-label={`Remove ${row.label || "attribute"}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-1 flex w-full items-center gap-1.5 border-b border-dashed border-border/70 py-3">
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:border-border hover:text-foreground"
          onClick={() => onChange([...rows, emptyRow()])}
        >
          <Plus className="h-4 w-4 shrink-0" aria-hidden />
          Add attribute
        </button>
        <FieldLabelInfo label="Add attribute">
          {fieldHelpText(CATEGORY_EDITOR_FIELD_HELP.attributeAdd)}
        </FieldLabelInfo>
      </div>
    </div>
  );
}

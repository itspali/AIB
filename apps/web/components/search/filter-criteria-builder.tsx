"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { listFilterValueOptions } from "@/app/search/actions";
import { useOmnibarContext } from "@/components/search/omnibar-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { buildFieldDict } from "@/lib/search/permissions/resolve-field-dict";
import { getFieldMetadata } from "@/lib/search/permissions/field-metadata";
import {
  getOperatorsForField,
  getPrimaryFieldLabel,
  type FieldOperatorOption,
} from "@/lib/search/permissions/field-operators";
import type { CriterionDraft, CriterionDraftPart, FilterValueOption } from "@/lib/search/types";
import { cn } from "@/lib/utils";

type PartDraft = CriterionDraftPart & { id: string };

function createPartDraft(operator?: FieldOperatorOption): PartDraft {
  return {
    id: crypto.randomUUID(),
    operator: operator?.operator ?? "EQ",
    value: operator?.valueMode === "multi" ? [] : operator?.valueMode === "range" ? ["", ""] : "",
  };
}

function ValueEditor({
  fieldKey,
  part,
  options,
  loading,
  onChange,
}: {
  fieldKey: string;
  part: PartDraft;
  options: FilterValueOption[];
  loading: boolean;
  onChange: (value: unknown) => void;
}) {
  const metadata = getFieldMetadata(fieldKey);
  const operatorOption = getOperatorsForField(fieldKey).find((entry) => entry.operator === part.operator);
  const valueMode = operatorOption?.valueMode ?? "single";

  if (valueMode === "boolean") {
    return (
      <Select
        value={String(part.value ?? "true")}
        onValueChange={(next) => onChange(next === "true")}
      >
        <SelectTrigger className="h-8">
          <SelectValue placeholder="Select status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="true">Active</SelectItem>
          <SelectItem value="false">Inactive</SelectItem>
        </SelectContent>
      </Select>
    );
  }

  if (valueMode === "range") {
    const range = Array.isArray(part.value) ? part.value : ["", ""];
    return (
      <div className="flex items-center gap-2">
        <Input
          className="h-8"
          placeholder="Min"
          value={String(range[0] ?? "")}
          onChange={(event) => onChange([event.target.value, range[1] ?? ""])}
        />
        <span className="text-xs text-muted-foreground">and</span>
        <Input
          className="h-8"
          placeholder="Max"
          value={String(range[1] ?? "")}
          onChange={(event) => onChange([range[0] ?? "", event.target.value])}
        />
      </div>
    );
  }

  if (valueMode === "multi") {
    const selected = Array.isArray(part.value) ? part.value.map(String) : [];
    return (
      <div className="space-y-2">
        {loading ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Loading options…
          </div>
        ) : null}
        <div className="flex flex-wrap gap-1.5">
          {(options.length > 0 ? options : selected.map((value) => ({ value, label: value }))).map(
            (option) => {
              const active = selected.includes(option.value);
              return (
                <button
                  key={option.value}
                  type="button"
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-xs transition-colors",
                    active
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-background text-muted-foreground hover:bg-accent"
                  )}
                  onClick={() => {
                    const next = active
                      ? selected.filter((entry) => entry !== option.value)
                      : [...selected, option.value];
                    onChange(next);
                  }}
                >
                  {option.label}
                </button>
              );
            }
          )}
        </div>
        <Input
          className="h-8"
          placeholder="Or type a custom value"
          onKeyDown={(event) => {
            if (event.key !== "Enter") return;
            event.preventDefault();
            const value = event.currentTarget.value.trim();
            if (!value || selected.includes(value)) return;
            onChange([...selected, value]);
            event.currentTarget.value = "";
          }}
        />
      </div>
    );
  }

  if (options.length > 0) {
    return (
      <Select value={String(part.value ?? "")} onValueChange={(next) => onChange(next)}>
        <SelectTrigger className="h-8">
          <SelectValue placeholder={loading ? "Loading…" : "Select value"} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  return (
    <Input
      className="h-8"
      placeholder="Enter value"
      value={String(part.value ?? "")}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

function isPartComplete(fieldKey: string, part: PartDraft): boolean {
  const operatorOption = getOperatorsForField(fieldKey).find((entry) => entry.operator === part.operator);
  const valueMode = operatorOption?.valueMode ?? "single";

  if (valueMode === "multi") {
    return Array.isArray(part.value) && part.value.length > 0;
  }
  if (valueMode === "range") {
    return (
      Array.isArray(part.value) &&
      part.value.length === 2 &&
      String(part.value[0]).trim().length > 0 &&
      String(part.value[1]).trim().length > 0
    );
  }
  if (valueMode === "boolean") {
    return typeof part.value === "boolean";
  }
  return String(part.value ?? "").trim().length > 0;
}

export function FilterCriteriaBuilder() {
  const { scope, permissions, addDraftCriterionFromBuilder } = useOmnibarContext();
  const fieldDict = useMemo(
    () => (permissions ? buildFieldDict(scope, permissions) : []),
    [permissions, scope]
  );

  const [fieldKey, setFieldKey] = useState<string>("");
  const [parts, setParts] = useState<PartDraft[]>([]);
  const [valueOptions, setValueOptions] = useState<FilterValueOption[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(false);

  const operators = useMemo(
    () => (fieldKey ? getOperatorsForField(fieldKey) : []),
    [fieldKey]
  );

  useEffect(() => {
    if (!fieldKey) {
      setParts([]);
      setValueOptions([]);
      return;
    }

    const defaultOperator = operators[0];
    setParts([createPartDraft(defaultOperator)]);
  }, [fieldKey, operators]);

  useEffect(() => {
    if (!fieldKey) return;
    const metadata = getFieldMetadata(fieldKey);
    if (!metadata.valueSource) {
      setValueOptions([]);
      return;
    }

    let cancelled = false;
    setLoadingOptions(true);
    void listFilterValueOptions(scope, fieldKey).then((result) => {
      if (cancelled) return;
      setLoadingOptions(false);
      if (!result.ok) {
        setValueOptions([]);
        return;
      }
      setValueOptions(result.options);
    });

    return () => {
      cancelled = true;
    };
  }, [fieldKey, scope]);

  const updatePart = useCallback((id: string, patch: Partial<PartDraft>) => {
    setParts((current) =>
      current.map((part) => (part.id === id ? { ...part, ...patch } : part))
    );
  }, []);

  const addPart = useCallback(() => {
    if (!fieldKey) return;
    const defaultOperator = operators[0];
    setParts((current) => [...current, createPartDraft(defaultOperator)]);
  }, [fieldKey, operators]);

  const removePart = useCallback((id: string) => {
    setParts((current) => (current.length <= 1 ? current : current.filter((part) => part.id !== id)));
  }, []);

  const canAddCriterion = fieldKey.length > 0 && parts.every((part) => isPartComplete(fieldKey, part));

  const handleAddCriterion = () => {
    if (!canAddCriterion) return;

    const draft: CriterionDraft = {
      field: fieldKey,
      parts: parts.map(({ operator, value }) => {
        if (parts[0] && getOperatorsForField(fieldKey).find((entry) => entry.operator === operator)?.valueMode === "range") {
          const range = Array.isArray(value) ? value : ["", ""];
          return {
            operator,
            value: [Number(range[0]), Number(range[1])],
          };
        }
        return { operator, value };
      }),
    };

    const added = addDraftCriterionFromBuilder(draft);
    if (!added) {
      toast.error("Unable to add criterion. Check field permissions or values.");
      return;
    }

    setFieldKey("");
    setParts([]);
    setValueOptions([]);
  };

  if (!fieldDict.length) {
    return (
      <p className="text-sm text-muted-foreground">
        No filterable fields are available for this module with your current permissions.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Field</p>
        <Select value={fieldKey || undefined} onValueChange={setFieldKey}>
          <SelectTrigger className="h-9">
            <SelectValue placeholder="Choose a field" />
          </SelectTrigger>
          <SelectContent>
            {fieldDict.map((entry) => (
              <SelectItem key={entry.key} value={entry.key}>
                {getPrimaryFieldLabel(entry.key)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {fieldKey ? (
        <div className="space-y-3">
          {parts.map((part, index) => (
            <div key={part.id} className="rounded-lg border border-border/80 bg-muted/20 p-3 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium text-muted-foreground">
                  {index === 0 ? "Condition" : `Condition ${index + 1}`}
                </p>
                {parts.length > 1 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={() => removePart(part.id)}
                    aria-label="Remove condition"
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                ) : null}
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <Select
                  value={part.operator}
                  onValueChange={(next) => {
                    const nextOperator = operators.find((entry) => entry.operator === next);
                    updatePart(part.id, {
                      operator: next as PartDraft["operator"],
                      value:
                        nextOperator?.valueMode === "multi"
                          ? []
                          : nextOperator?.valueMode === "range"
                            ? ["", ""]
                            : nextOperator?.valueMode === "boolean"
                              ? true
                              : "",
                    });
                  }}
                >
                  <SelectTrigger className="h-8">
                    <SelectValue placeholder="Operator" />
                  </SelectTrigger>
                  <SelectContent>
                    {operators.map((option) => (
                      <SelectItem key={option.operator} value={option.operator}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <ValueEditor
                  fieldKey={fieldKey}
                  part={part}
                  options={valueOptions}
                  loading={loadingOptions}
                  onChange={(value) => updatePart(part.id, { value })}
                />
              </div>
            </div>
          ))}

          {getFieldMetadata(fieldKey).supportsCompound !== false ? (
            <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={addPart}>
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Add condition on this field
            </Button>
          ) : null}
        </div>
      ) : null}

      <Button type="button" size="sm" disabled={!canAddCriterion} onClick={handleAddCriterion}>
        Add criterion
      </Button>
    </div>
  );
}

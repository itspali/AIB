"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CHIP_COLOR_PRESET_CLASSES,
  CHIP_COLOR_PRESET_LABELS,
  CHIP_COLOR_PRESET_ORDER,
  getDefaultColorRulesForColumn,
  getEffectiveChipDisplay,
} from "@/lib/list-columns/chip-colors";
import type {
  ColumnChipDisplay,
  ColumnValueColorRule,
  ListColumnDef,
} from "@/lib/list-columns/types";
import { CHIP_DEFAULT_FALLBACK_KEY } from "@/lib/list-columns/types";
import { cn } from "@/lib/utils";

type Props<TId extends string> = {
  column: ListColumnDef<TId>;
  display?: ColumnChipDisplay;
  onChange: (display: ColumnChipDisplay) => void;
  disabled?: boolean;
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
};

function PresetSwatch({ preset }: { preset: (typeof CHIP_COLOR_PRESET_ORDER)[number] }) {
  return (
    <span
      className={cn(
        "inline-block h-3 w-3 shrink-0 rounded-full ring-1 ring-border/60",
        CHIP_COLOR_PRESET_CLASSES[preset].split(" ").find((c) => c.startsWith("bg-"))
      )}
      aria-hidden
    />
  );
}

function ColorRuleRow({
  label,
  rule,
  onChange,
  onReset,
  disabled,
}: {
  label: string;
  rule: ColumnValueColorRule;
  onChange: (rule: ColumnValueColorRule) => void;
  onReset: () => void;
  disabled?: boolean;
}) {
  const preset = rule.preset ?? "neutral";
  const customHex = rule.customHex ?? "#64748B";

  return (
    <div className="flex items-center gap-1 py-0.5">
      <span className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground">{label}</span>
      <Select
        value={preset}
        disabled={disabled}
        onValueChange={(value) =>
          onChange({
            preset: value as ColumnValueColorRule["preset"],
            customHex: rule.customHex,
          })
        }
      >
        <SelectTrigger
          className="h-6 w-[5.5rem] shrink-0 px-1.5 py-0 text-[11px] [&>svg]:h-3 [&>svg]:w-3"
          aria-label={`Color preset for ${label}`}
          onClick={(event) => event.stopPropagation()}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent align="end">
          {CHIP_COLOR_PRESET_ORDER.map((token) => (
            <SelectItem key={token} value={token} className="text-xs py-1">
              <span className="flex items-center gap-1.5">
                <PresetSwatch preset={token} />
                {CHIP_COLOR_PRESET_LABELS[token]}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <label className="relative shrink-0">
        <span className="sr-only">Custom color for {label}</span>
        <input
          type="color"
          value={customHex}
          disabled={disabled}
          onClick={(event) => event.stopPropagation()}
          onChange={(event) =>
            onChange({
              preset: rule.preset,
              customHex: event.target.value.toUpperCase(),
            })
          }
          className="h-6 w-6 cursor-pointer rounded border border-border bg-transparent p-0"
          title="Custom color"
        />
      </label>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-6 w-6 shrink-0 p-0"
        disabled={disabled}
        onClick={(event) => {
          event.stopPropagation();
          onReset();
        }}
        aria-label={`Reset color for ${label}`}
        title="Reset to default"
      >
        <RotateCcw className="h-3 w-3" />
      </Button>
    </div>
  );
}

export function ColumnChipColorEditor<TId extends string>({
  column,
  display,
  onChange,
  disabled = false,
  expanded,
  onExpandedChange,
}: Props<TId>) {
  const [newValueInput, setNewValueInput] = useState("");
  const effective = getEffectiveChipDisplay(column, display);
  const defaults = getDefaultColorRulesForColumn(column);

  const catalogEntries = useMemo(() => {
    const entries = [...(column.chipValueCatalog ?? [])];
    const configuredKeys = Object.keys(effective.valueColors ?? {}).filter(
      (key) => key !== CHIP_DEFAULT_FALLBACK_KEY
    );
    for (const key of configuredKeys) {
      if (!entries.some((entry) => entry.value === key)) {
        entries.push({ value: key, label: key });
      }
    }
    return entries;
  }, [column.chipValueCatalog, effective.valueColors]);

  const isDynamic = !column.chipValueCatalog?.length;

  const updateRule = (valueKey: string, rule: ColumnValueColorRule) => {
    onChange({
      mode: "chip",
      valueColors: {
        ...display?.valueColors,
        [valueKey]: rule,
      },
    });
  };

  const resetRule = (valueKey: string) => {
    const next = { ...(display?.valueColors ?? {}) };
    if (defaults[valueKey]) {
      next[valueKey] = defaults[valueKey];
    } else {
      delete next[valueKey];
    }
    onChange({
      mode: "chip",
      valueColors: Object.keys(next).length > 0 ? next : undefined,
    });
  };

  const addDynamicValue = () => {
    const trimmed = newValueInput.trim();
    if (!trimmed) return;
    updateRule(trimmed, defaults[CHIP_DEFAULT_FALLBACK_KEY] ?? { preset: "neutral" });
    setNewValueInput("");
  };

  if (effective.mode !== "chip") return null;

  return (
    <div className="ml-6 mr-0.5 border-l border-border/60 pl-2">
      <button
        type="button"
        className="flex w-full items-center gap-1 py-0.5 text-[11px] font-medium text-muted-foreground hover:text-foreground"
        onClick={(event) => {
          event.stopPropagation();
          onExpandedChange(!expanded);
        }}
      >
        {expanded ? (
          <ChevronDown className="h-3 w-3 shrink-0" aria-hidden />
        ) : (
          <ChevronRight className="h-3 w-3 shrink-0" aria-hidden />
        )}
        Value colors
      </button>
      {expanded ? (
        <div className="space-y-0.5 pb-1">
          {catalogEntries.map((entry) => (
            <ColorRuleRow
              key={entry.value}
              label={entry.label}
              rule={resolveEffectiveRule(effective, entry.value, defaults)}
              onChange={(rule) => updateRule(entry.value, rule)}
              onReset={() => resetRule(entry.value)}
              disabled={disabled}
            />
          ))}
          <ColorRuleRow
            label="Other (unmapped)"
            rule={resolveEffectiveRule(effective, CHIP_DEFAULT_FALLBACK_KEY, defaults)}
            onChange={(rule) => updateRule(CHIP_DEFAULT_FALLBACK_KEY, rule)}
            onReset={() => resetRule(CHIP_DEFAULT_FALLBACK_KEY)}
            disabled={disabled}
          />
          {isDynamic ? (
            <div className="flex items-center gap-1 pt-0.5">
              <Input
                value={newValueInput}
                disabled={disabled}
                onClick={(event) => event.stopPropagation()}
                onChange={(event) => setNewValueInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    addDynamicValue();
                  }
                }}
                placeholder="Add value…"
                className="h-6 flex-1 px-1.5 text-[11px]"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-6 px-2 text-[11px]"
                disabled={disabled || !newValueInput.trim()}
                onClick={(event) => {
                  event.stopPropagation();
                  addDynamicValue();
                }}
              >
                Add
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function resolveEffectiveRule(
  effective: ColumnChipDisplay,
  valueKey: string,
  defaults: Record<string, ColumnValueColorRule>
): ColumnValueColorRule {
  return (
    effective.valueColors?.[valueKey] ??
    defaults[valueKey] ??
    defaults[CHIP_DEFAULT_FALLBACK_KEY] ?? { preset: "neutral" }
  );
}

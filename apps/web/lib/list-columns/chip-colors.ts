import type { CSSProperties } from "react";
import { ITEM_CLASSIFICATIONS } from "@/lib/products/classification-labels";
import type {
  ChipColorPreset,
  ColumnChipDisplay,
  ColumnValueColorRule,
  ListColumnDef,
  ListColumnPrefs,
} from "@/lib/list-columns/types";
import { CHIP_DEFAULT_FALLBACK_KEY as FALLBACK_KEY } from "@/lib/list-columns/types";

export { CHIP_DEFAULT_FALLBACK_KEY } from "@/lib/list-columns/types";

export const CHIP_COLOR_PRESET_ORDER: ChipColorPreset[] = [
  "emerald",
  "red",
  "amber",
  "indigo",
  "sky",
  "violet",
  "slate",
  "neutral",
];

export const CHIP_COLOR_PRESET_LABELS: Record<ChipColorPreset, string> = {
  emerald: "Green",
  red: "Red",
  amber: "Amber",
  indigo: "Indigo",
  sky: "Sky",
  violet: "Violet",
  slate: "Slate",
  neutral: "Neutral",
};

export const CHIP_COLOR_PRESET_CLASSES: Record<ChipColorPreset, string> = {
  emerald:
    "bg-emerald-500/15 text-emerald-700 ring-1 ring-emerald-500/30 dark:text-emerald-300 dark:ring-emerald-500/25",
  red: "bg-red-500/15 text-red-800 ring-1 ring-red-500/30 dark:text-red-300 dark:ring-red-500/25",
  amber:
    "bg-amber-500/15 text-amber-800 ring-1 ring-amber-500/30 dark:text-amber-300 dark:ring-amber-500/25",
  indigo:
    "bg-indigo-500/15 text-indigo-700 ring-1 ring-indigo-500/30 dark:text-indigo-300 dark:ring-indigo-500/25",
  sky: "bg-sky-500/15 text-sky-800 ring-1 ring-sky-500/30 dark:text-sky-300 dark:ring-sky-500/25",
  violet:
    "bg-violet-500/15 text-violet-800 ring-1 ring-violet-500/30 dark:text-violet-300 dark:ring-violet-500/25",
  slate: "bg-slate-500/15 text-slate-700 ring-1 ring-slate-500/30 dark:text-slate-300 dark:ring-slate-500/25",
  neutral: "bg-secondary text-secondary-foreground ring-1 ring-border/80",
};

const CLASSIFICATION_CHIP_PRESETS: ChipColorPreset[] = [
  "indigo",
  "sky",
  "violet",
  "slate",
  "amber",
  "emerald",
  "neutral",
];

export const BOOLEAN_YES_NO_CATALOG = [
  { value: "true", label: "Yes" },
  { value: "false", label: "No" },
] as const;

export const BOOLEAN_ACTIVE_INACTIVE_CATALOG = [
  { value: "true", label: "Active" },
  { value: "false", label: "Inactive" },
] as const;

export function isChipColorPreset(value: string): value is ChipColorPreset {
  return (CHIP_COLOR_PRESET_ORDER as readonly string[]).includes(value);
}

export function isValidCustomHex(value: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/.test(value);
}

export function normalizeColorRule(raw: unknown): ColumnValueColorRule | undefined {
  if (!raw || typeof raw !== "object") return undefined;

  const parsed = raw as ColumnValueColorRule;
  const preset =
    typeof parsed.preset === "string" && isChipColorPreset(parsed.preset)
      ? parsed.preset
      : undefined;
  const customHex =
    typeof parsed.customHex === "string" && isValidCustomHex(parsed.customHex)
      ? parsed.customHex.toUpperCase()
      : undefined;

  if (!preset && !customHex) return undefined;
  return { preset, customHex };
}

export type ResolvedChipColor = {
  className?: string;
  style?: CSSProperties;
};

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const match = /^#([0-9A-Fa-f]{6})$/.exec(hex);
  if (!match) return null;
  const value = parseInt(match[1], 16);
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  };
}

export function resolveChipColorRule(rule?: ColumnValueColorRule): ResolvedChipColor {
  if (rule?.customHex && isValidCustomHex(rule.customHex)) {
    const rgb = hexToRgb(rule.customHex);
    if (rgb) {
      return {
        style: {
          backgroundColor: `color-mix(in srgb, rgb(${rgb.r} ${rgb.g} ${rgb.b}) 18%, transparent)`,
          color: rule.customHex,
          boxShadow: `inset 0 0 0 1px color-mix(in srgb, rgb(${rgb.r} ${rgb.g} ${rgb.b}) 35%, transparent)`,
        },
      };
    }
  }

  const preset = rule?.preset ?? "neutral";
  return { className: CHIP_COLOR_PRESET_CLASSES[preset] };
}

export function booleanValueKey(value: boolean): "true" | "false" {
  return value ? "true" : "false";
}

export function getDefaultColorRulesForColumn<TId extends string>(
  column: ListColumnDef<TId>
): Record<string, ColumnValueColorRule> {
  if (column.chipDefaultColors) {
    return { ...column.chipDefaultColors };
  }
  return { [FALLBACK_KEY]: { preset: "neutral" } };
}

export function resolveChipDisplayMode<TId extends string>(
  column: ListColumnDef<TId>,
  prefs?: ColumnChipDisplay | null
): "text" | "chip" {
  if (prefs?.mode === "text" || prefs?.mode === "chip") return prefs.mode;
  return column.chipEligible ? "chip" : "text";
}

export function getEffectiveChipDisplay<TId extends string>(
  column: ListColumnDef<TId>,
  prefs?: ColumnChipDisplay | null
): ColumnChipDisplay {
  const defaults = getDefaultColorRulesForColumn(column);
  const userColors = prefs?.valueColors ?? {};

  const merged: Record<string, ColumnValueColorRule> = { ...defaults };
  for (const [key, rule] of Object.entries(userColors)) {
    const normalized = normalizeColorRule(rule);
    if (normalized) merged[key] = normalized;
  }

  return {
    mode: resolveChipDisplayMode(column, prefs),
    valueColors: merged,
  };
}

export function resolveValueColorRule(
  valueKey: string,
  chipDisplay: ColumnChipDisplay
): ColumnValueColorRule {
  const colors = chipDisplay.valueColors ?? {};
  return (
    colors[valueKey] ??
    colors[FALLBACK_KEY] ??
    ({ preset: "neutral" } satisfies ColumnValueColorRule)
  );
}

export function isChipModeEnabled<TId extends string>(
  column: ListColumnDef<TId>,
  prefs: ListColumnPrefs<TId>
): boolean {
  return (
    resolveChipDisplayMode(column, prefs.columnChipDisplay?.[column.id]) === "chip"
  );
}

export function buildClassificationDefaultColors(): Record<string, ColumnValueColorRule> {
  const rules: Record<string, ColumnValueColorRule> = {
    [FALLBACK_KEY]: { preset: "neutral" },
  };
  ITEM_CLASSIFICATIONS.forEach((value, index) => {
    rules[value] = { preset: CLASSIFICATION_CHIP_PRESETS[index % CLASSIFICATION_CHIP_PRESETS.length] };
  });
  return rules;
}

import type { ListColumnValueKind } from "@/lib/list-columns/types";
import type { ProductListViewMode } from "@/lib/products/list-prefs";
import { cn } from "@/lib/utils";

export const TEXT_WRAP_MODES = [
  "truncate",
  "line-clamp-1",
  "line-clamp-2",
  "wrap",
] as const;

export type TextWrapMode = (typeof TEXT_WRAP_MODES)[number];

export const TEXT_WRAP_MODE_LABELS: Record<TextWrapMode, string> = {
  truncate: "Truncate",
  "line-clamp-1": "1 line",
  "line-clamp-2": "2 lines",
  wrap: "Wrap",
};

export function isTextWrapMode(value: unknown): value is TextWrapMode {
  return typeof value === "string" && (TEXT_WRAP_MODES as readonly string[]).includes(value);
}

export function columnSupportsWrapControl(valueKind?: ListColumnValueKind): boolean {
  return valueKind === "text" || valueKind === "multiline";
}

export function defaultWrapModeForValueKind(
  valueKind: ListColumnValueKind,
  layout: ProductListViewMode
): TextWrapMode {
  if (valueKind === "multiline") {
    return layout === "compact" ? "line-clamp-1" : "line-clamp-2";
  }
  return "truncate";
}

export function textWrapModeClassName(mode: TextWrapMode, valueKind?: ListColumnValueKind): string {
  switch (mode) {
    case "truncate":
      return "truncate";
    case "line-clamp-1":
      return "line-clamp-1";
    case "line-clamp-2":
      return "line-clamp-2";
    case "wrap":
      return valueKind === "multiline"
        ? "whitespace-pre-wrap break-words"
        : "whitespace-normal break-words";
    default:
      return "truncate";
  }
}

export function textWrapModeCellClassName(mode: TextWrapMode, valueKind?: ListColumnValueKind): string {
  return cn("min-w-0", textWrapModeClassName(mode, valueKind));
}

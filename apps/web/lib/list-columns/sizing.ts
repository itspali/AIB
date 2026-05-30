import type { TextWrapMode } from "@/lib/display/text-wrap";
import type { DeviceClass } from "@/lib/layout/device-class";
import type { CSSProperties } from "react";
import type { ListColumnDef, ListColumnValueKind } from "@/lib/list-columns/types";

export type ColumnWidthValue = number | string;

export type ColumnWidthSpec = {
  min?: ColumnWidthValue;
  max?: ColumnWidthValue;
  preferred?: ColumnWidthValue;
};

export type ResponsiveColumnWidths = {
  default: ColumnWidthSpec;
  mobile?: ColumnWidthSpec;
  tablet?: ColumnWidthSpec;
  desktop?: ColumnWidthSpec;
};

const GLOBAL_MIN_PX = 72;
export const USER_COLUMN_RESIZE_MIN_PX = 48;
export const USER_COLUMN_RESIZE_MAX_PX = 640;

const WRAP_MIN_BOOST_PX: Record<TextWrapMode, number> = {
  truncate: 0,
  "line-clamp-1": 8,
  "line-clamp-2": 24,
  wrap: 48,
};

const DEFAULT_WIDTHS_BY_VALUE_KIND: Record<ListColumnValueKind, ColumnWidthSpec> = {
  text: { min: 120, max: 240 },
  multiline: { min: 160, max: 280 },
  code: { min: 96, max: 160 },
  number: { min: 88, max: 120 },
  boolean: { min: 80, max: 96 },
  date: { min: 100, max: 140 },
};

function toCssLength(value: ColumnWidthValue | undefined): string | undefined {
  if (value == null) return undefined;
  return typeof value === "number" ? `${value}px` : value;
}

function parsePx(value: ColumnWidthValue | undefined): number | undefined {
  if (value == null) return undefined;
  if (typeof value === "number") return value;
  const match = /^(\d+(?:\.\d+)?)px$/.exec(value.trim());
  return match ? Number(match[1]) : undefined;
}

function mergeWidthSpecs(base: ColumnWidthSpec, override?: ColumnWidthSpec): ColumnWidthSpec {
  if (!override) return base;
  return {
    min: override.min ?? base.min,
    max: override.max ?? base.max,
    preferred: override.preferred ?? base.preferred,
  };
}

function resolveBaseWidthSpec<TId extends string>(
  column: ListColumnDef<TId>,
  deviceClass: DeviceClass
): ColumnWidthSpec {
  if (column.widths) {
    const deviceOverride =
      deviceClass === "mobile"
        ? column.widths.mobile
        : deviceClass === "tablet"
          ? column.widths.tablet
          : column.widths.desktop;
    return mergeWidthSpecs(column.widths.default, deviceOverride);
  }

  if (column.valueKind) {
    return { ...DEFAULT_WIDTHS_BY_VALUE_KIND[column.valueKind] };
  }

  return { min: 120, max: 240 };
}

function applyWrapBoost(
  minPx: number | undefined,
  wrapMode: TextWrapMode,
  columnBoost?: number
): number | undefined {
  if (minPx == null) return undefined;
  const modeBoost = WRAP_MIN_BOOST_PX[wrapMode];
  const extra = modeBoost + (modeBoost > 0 ? (columnBoost ?? 0) : 0);
  return minPx + extra;
}

export function resolveColumnWidthSpec<TId extends string>(
  column: ListColumnDef<TId>,
  deviceClass: DeviceClass,
  wrapMode: TextWrapMode = "truncate",
  userWidthPx?: number
): ColumnWidthSpec {
  if (userWidthPx != null && Number.isFinite(userWidthPx)) {
    const clamped = clampUserColumnWidth(column, deviceClass, userWidthPx);
    return { min: clamped, max: clamped, preferred: clamped };
  }

  const base = resolveBaseWidthSpec(column, deviceClass);
  const minPx = parsePx(base.min);
  const boostedMin = applyWrapBoost(minPx, wrapMode, column.wrapWidthBoost);

  return {
    ...base,
    min: boostedMin != null ? Math.max(boostedMin, GLOBAL_MIN_PX) : base.min ?? GLOBAL_MIN_PX,
  };
}

export function getColumnResizeBounds<TId extends string>(
  column: ListColumnDef<TId>,
  deviceClass: DeviceClass
): { min: number; max: number } {
  const base = resolveBaseWidthSpec(column, deviceClass);
  const registryMax = parsePx(base.max) ?? USER_COLUMN_RESIZE_MAX_PX;
  return {
    min: USER_COLUMN_RESIZE_MIN_PX,
    max: Math.max(USER_COLUMN_RESIZE_MIN_PX, Math.min(registryMax, USER_COLUMN_RESIZE_MAX_PX)),
  };
}

export function clampUserColumnWidth<TId extends string>(
  column: ListColumnDef<TId>,
  deviceClass: DeviceClass,
  widthPx: number
): number {
  const { min, max } = getColumnResizeBounds(column, deviceClass);
  return Math.round(Math.max(min, Math.min(widthPx, max)));
}

export function resolveColumnWidthStyles<TId extends string>(
  column: ListColumnDef<TId>,
  deviceClass: DeviceClass,
  wrapMode: TextWrapMode = "truncate",
  userWidthPx?: number
): CSSProperties {
  const spec = resolveColumnWidthSpec(column, deviceClass, wrapMode, userWidthPx);
  const minWidth = toCssLength(spec.min);
  const maxWidth = toCssLength(spec.max);
  const width = toCssLength(spec.preferred);

  const style: CSSProperties = {};
  if (userWidthPx != null && width) {
    style.width = width;
    style.minWidth = width;
    style.maxWidth = width;
    return style;
  }
  if (minWidth) style.minWidth = minWidth;
  if (maxWidth) style.maxWidth = maxWidth;
  if (width) style.width = width;
  return style;
}

export function mergeColumnCellStyles(
  base: CSSProperties | undefined,
  columnStyles: CSSProperties
): CSSProperties {
  return { ...base, ...columnStyles };
}

/** Helper for module column registries. */
export function columnWidths(spec: ResponsiveColumnWidths): ResponsiveColumnWidths {
  return spec;
}

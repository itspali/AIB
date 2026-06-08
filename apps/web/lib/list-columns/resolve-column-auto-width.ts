import type { DeviceClass } from "@/lib/layout/device-class";
import {
  clampUserColumnWidth,
  getColumnResizeBounds,
} from "@/lib/list-columns/sizing";
import {
  measureMaxContentWidth,
  resolveMeasureClassName,
} from "@/lib/list-columns/measure-content-width";
import type { ListColumnDef } from "@/lib/list-columns/types";

const DEFAULT_HEADER_PADDING_PX = 20;
const DEFAULT_BODY_PADDING_PX = 20;
const SORT_INDICATOR_EXTRA_PX = 22;
const STATUS_BADGE_EXTRA_PX = 20;

export type ListColumnAutoWidthMeasureHints = {
  mono?: boolean;
  tabular?: boolean;
  headerPaddingPx?: number;
  bodyPaddingPx?: number;
  sortIndicatorExtraPx?: number;
  statusBadgeExtraPx?: number;
};

export type ResolveListColumnAutoWidthOptions<TId extends string> = {
  column: ListColumnDef<TId>;
  deviceClass: DeviceClass;
  headerElement?: HTMLElement | null;
  bodyTexts: readonly string[];
  sortable?: boolean;
  measure?: ListColumnAutoWidthMeasureHints;
};

/** Width (px) that fits header label and body plain-text values, clamped to column bounds. */
export function resolveListColumnAutoWidth<TId extends string>({
  column,
  deviceClass,
  headerElement,
  bodyTexts,
  sortable = false,
  measure,
}: ResolveListColumnAutoWidthOptions<TId>): number {
  const measureClass = resolveMeasureClassName({
    mono: measure?.mono,
    tabular: measure?.tabular,
  });
  const headerPadding = measure?.headerPaddingPx ?? DEFAULT_HEADER_PADDING_PX;
  const bodyPadding = measure?.bodyPaddingPx ?? DEFAULT_BODY_PADDING_PX;
  const sortExtra = sortable ? (measure?.sortIndicatorExtraPx ?? SORT_INDICATOR_EXTRA_PX) : 0;

  const headerWidth = measureMaxContentWidth({
    texts: [column.label],
    referenceElement: headerElement,
    className: measureClass,
    paddingPx: headerPadding,
    extraPx: sortExtra,
  });

  const bodyWidth = measureMaxContentWidth({
    texts: bodyTexts.length > 0 ? bodyTexts : ["—"],
    referenceElement: headerElement,
    className: measureClass,
    paddingPx: bodyPadding,
    extraPx: measure?.statusBadgeExtraPx ?? 0,
  });

  return clampUserColumnWidth(column, deviceClass, Math.max(headerWidth, bodyWidth));
}

export function measureHintsFromValueKind<TId extends string>(
  column: ListColumnDef<TId>,
  options?: { statusBadge?: boolean }
): ListColumnAutoWidthMeasureHints {
  const kind = column.valueKind;
  return {
    mono: kind === "code",
    tabular: kind === "number" || kind === "date",
    statusBadgeExtraPx: options?.statusBadge ? STATUS_BADGE_EXTRA_PX : 0,
  };
}

export function fallbackColumnAutoWidth<TId extends string>(
  column: ListColumnDef<TId>,
  deviceClass: DeviceClass,
  headerElement?: HTMLElement | null
): number {
  const bounds = getColumnResizeBounds(column, deviceClass);
  const measured = headerElement?.offsetWidth;
  if (measured && measured > 0) {
    return Math.min(bounds.max, Math.max(bounds.min, measured));
  }
  return bounds.min;
}

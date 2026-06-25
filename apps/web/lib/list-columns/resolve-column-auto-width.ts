import type { DeviceClass } from "@/lib/layout/device-class";
import { LIST_TABLE_CELL_PADDING_INLINE_PX } from "@/lib/layout/list-table-chrome";
import {
  clampAutoFitColumnWidth,
  getColumnResizeBounds,
} from "@/lib/list-columns/sizing";
import {
  measureMaxContentWidth,
  resolveHeaderLabelTypographyElement,
  resolveMeasureClassName,
} from "@/lib/list-columns/measure-content-width";
import type { ListColumnDef } from "@/lib/list-columns/types";

/** Left + right cell padding included in border-box column widths. */
const DEFAULT_HEADER_PADDING_PX = LIST_TABLE_CELL_PADDING_INLINE_PX * 2;
const DEFAULT_BODY_PADDING_PX = LIST_TABLE_CELL_PADDING_INLINE_PX * 2;
const STATUS_BADGE_EXTRA_PX = 20;

export type ListColumnAutoWidthMeasureHints = {
  mono?: boolean;
  tabular?: boolean;
  headerPaddingPx?: number;
  bodyPaddingPx?: number;
  sortIndicatorExtraPx?: number;
  statusBadgeExtraPx?: number;
  /** Extra classes for header measurement only (body classes stay separate). */
  headerClassName?: string;
};

export type ResolveListColumnAutoWidthOptions<TId extends string> = {
  column: ListColumnDef<TId>;
  deviceClass: DeviceClass;
  headerElement?: HTMLElement | null;
  /** Plain-text header label when it differs from `column.label`. */
  headerLabel?: string;
  bodyTexts: readonly string[];
  sortable?: boolean;
  measure?: ListColumnAutoWidthMeasureHints;
};

/** Width (px) that fits header label and body plain-text values, clamped to column bounds. */
export function resolveListColumnAutoWidth<TId extends string>({
  column,
  deviceClass,
  headerElement,
  headerLabel,
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
  const sortExtra = 0;
  const headerText = headerLabel ?? column.label;
  const headerTypographyElement = resolveHeaderLabelTypographyElement(headerElement);

  const headerWidth = measureMaxContentWidth({
    texts: [headerText],
    typographyElement: headerTypographyElement,
    className: measure?.headerClassName,
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

  return clampAutoFitColumnWidth(column, deviceClass, Math.max(headerWidth, bodyWidth));
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

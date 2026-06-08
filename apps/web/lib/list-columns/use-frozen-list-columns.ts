import { useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type RefObject } from "react";
import type { DeviceClass } from "@/lib/layout/device-class";
import {
  AUTO_LAYOUT_PREF,
  getAutoFrozenColumnCount,
  type FrozenColumnPref,
} from "@/lib/products/list-prefs";
import {
  LIST_TABLE_FROZEN_CELL_BG,
  LIST_TABLE_FROZEN_EDGE_SHADOW,
  LIST_TABLE_HEADER_CELL_BG,
  listTableBodyCellInteractionClass,
} from "@/lib/layout/list-table-chrome";
import { cn } from "@/lib/utils";

export type ListFrozenColumnCount = 0 | 1 | 2 | 3;

export const FROZEN_CELL_BG = LIST_TABLE_FROZEN_CELL_BG;
export const FROZEN_EDGE_SHADOW = LIST_TABLE_FROZEN_EDGE_SHADOW;

const TABLE_HEADER_Z = 10;
const FROZEN_HEADER_Z_BASE = 40;
const FROZEN_BODY_Z_BASE = 10;

export const LIST_TABLE_HEADER_Z = TABLE_HEADER_Z;
export const LIST_SELECTION_COLUMN_Z_HEADER = 50;
export const LIST_SELECTION_COLUMN_Z_BODY = 15;

export function isAutoFrozenColumnPref(pref: FrozenColumnPref): boolean {
  return pref === AUTO_LAYOUT_PREF;
}

export function parseFrozenColumnPref(value: unknown): FrozenColumnPref {
  if (value === AUTO_LAYOUT_PREF) return AUTO_LAYOUT_PREF;
  if (value === 0 || value === 1 || value === 2 || value === 3) return value;
  return AUTO_LAYOUT_PREF;
}

export function resolveListFrozenColumnCount(
  pref: FrozenColumnPref,
  deviceClass: DeviceClass
): ListFrozenColumnCount {
  if (deviceClass === "mobile") return 0;
  if (pref === AUTO_LAYOUT_PREF) {
    return getAutoFrozenColumnCount(deviceClass);
  }
  return pref;
}

export function rowEdgeClass(isLastFrozenColumn = false) {
  return isLastFrozenColumn ? FROZEN_EDGE_SHADOW : undefined;
}

type StickyStyle = {
  className?: string;
  style?: CSSProperties;
};

type Options = {
  columnCount: number;
  frozenColumnCount: ListFrozenColumnCount;
  /** When true (Auto pref), skip freeze until the table overflows horizontally. */
  freezeColumnsAuto?: boolean;
  /** Leading column (e.g. bulk checkbox) width added to sticky offsets. */
  leadingColumnRef?: RefObject<HTMLElement | null>;
  /** Bumps sticky offset remeasure when row count or column widths change. */
  remeasureKey?: unknown;
};

export function useFrozenListColumns({
  columnCount,
  frozenColumnCount,
  freezeColumnsAuto = false,
  leadingColumnRef,
  remeasureKey,
}: Options) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const headerRefs = useRef<(HTMLTableCellElement | null)[]>([]);
  const [stickyOffsets, setStickyOffsets] = useState<number[]>([]);
  const [hasHorizontalScroll, setHasHorizontalScroll] = useState(false);
  /** Latched while Auto freeze is on — drawer resize must not drop columns that were frozen. */
  const latchedOverflowRef = useRef(false);
  const [freezeWhileAuto, setFreezeWhileAuto] = useState(false);

  const effectiveFrozenCount = useMemo(() => {
    const requested = Math.min(frozenColumnCount, columnCount) as ListFrozenColumnCount;
    if (freezeColumnsAuto && !freezeWhileAuto) return 0 as ListFrozenColumnCount;
    return requested;
  }, [columnCount, freezeColumnsAuto, freezeWhileAuto, frozenColumnCount]);

  useLayoutEffect(() => {
    latchedOverflowRef.current = false;
    setFreezeWhileAuto(false);
  }, [columnCount, remeasureKey]);

  useLayoutEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const measureScroll = () => {
      const overflow = container.scrollWidth > container.clientWidth + 1;
      setHasHorizontalScroll(overflow);
      if (overflow) {
        latchedOverflowRef.current = true;
      }
      if (freezeColumnsAuto) {
        setFreezeWhileAuto(latchedOverflowRef.current || overflow);
      }
    };

    measureScroll();
    const observer = new ResizeObserver(measureScroll);
    observer.observe(container);
    const table = container.querySelector("table");
    if (table) observer.observe(table);

    return () => observer.disconnect();
  }, [columnCount, freezeColumnsAuto, remeasureKey]);

  useLayoutEffect(() => {
    if (effectiveFrozenCount === 0) {
      setStickyOffsets([]);
      return;
    }

    let left = leadingColumnRef?.current?.offsetWidth ?? 0;
    const offsets: number[] = [];
    for (let index = 0; index < effectiveFrozenCount; index += 1) {
      offsets.push(left);
      left += headerRefs.current[index]?.offsetWidth ?? 0;
    }
    setStickyOffsets(offsets);
  }, [columnCount, effectiveFrozenCount, remeasureKey, leadingColumnRef]);

  const getStickyCellProps = (index: number, variant: "header" | "body"): StickyStyle => {
    if (effectiveFrozenCount === 0 || index >= effectiveFrozenCount) {
      return { className: variant === "header" ? "sticky top-0" : undefined, style: undefined };
    }

    const stackOrder = effectiveFrozenCount - 1 - index;
    const zIndex =
      (variant === "header" ? FROZEN_HEADER_Z_BASE : FROZEN_BODY_Z_BASE) + stackOrder;

    return {
      className: cn("sticky isolate overflow-hidden", variant === "header" && "top-0"),
      style: { left: stickyOffsets[index] ?? 0, zIndex },
    };
  };

  const headerCellClass = (index: number) => {
    const isFrozen = effectiveFrozenCount > 0 && index < effectiveFrozenCount;
    const isLastFrozenColumn = effectiveFrozenCount > 0 && index === effectiveFrozenCount - 1;
    return cn(
      LIST_TABLE_HEADER_CELL_BG,
      isFrozen && isLastFrozenColumn && FROZEN_EDGE_SHADOW
    );
  };

  const bodyCellClass = (index: number, selected: boolean) => {
    const isFrozen = effectiveFrozenCount > 0 && index < effectiveFrozenCount;
    const isLastFrozenColumn = effectiveFrozenCount > 0 && index === effectiveFrozenCount - 1;
    return cn(
      rowEdgeClass(isFrozen && isLastFrozenColumn),
      isFrozen
        ? listTableBodyCellInteractionClass(selected, { frozen: true })
        : listTableBodyCellInteractionClass(selected)
    );
  };

  return {
    scrollContainerRef,
    headerRefs,
    effectiveFrozenCount,
    hasHorizontalScroll,
    getStickyCellProps,
    headerCellClass,
    bodyCellClass,
  };
}

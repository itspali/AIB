import { useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { DeviceClass } from "@/lib/layout/device-class";
import {
  AUTO_LAYOUT_PREF,
  getAutoFrozenColumnCount,
  type FrozenColumnPref,
} from "@/lib/products/list-prefs";
import { cn } from "@/lib/utils";

export type ListFrozenColumnCount = 0 | 1 | 2 | 3;

export const FROZEN_CELL_BG =
  "bg-[color-mix(in_srgb,hsl(var(--primary))_14%,hsl(var(--background)))] dark:bg-muted";
export const FROZEN_CELL_HOVER =
  "group-hover:bg-[color-mix(in_srgb,hsl(var(--primary))_18%,hsl(var(--background)))] dark:group-hover:bg-[color-mix(in_srgb,hsl(var(--accent))_55%,hsl(var(--muted)))]";
export const FROZEN_CELL_SELECTED =
  "bg-[color-mix(in_srgb,hsl(var(--primary))_18%,hsl(var(--background)))] dark:bg-[color-mix(in_srgb,hsl(var(--primary))_14%,hsl(var(--muted)))]";
export const FROZEN_CELL_SELECTED_HOVER =
  "group-hover:bg-[color-mix(in_srgb,hsl(var(--primary))_22%,hsl(var(--background)))] dark:group-hover:bg-[color-mix(in_srgb,hsl(var(--primary))_14%,hsl(var(--accent))_35%,hsl(var(--muted)))]";
export const FROZEN_EDGE_SHADOW =
  "shadow-[inset_-12px_0_18px_-8px_hsl(var(--primary)/0.16)] dark:shadow-[inset_-14px_0_18px_-10px_hsl(0_0%_0%/0.28)]";

const TABLE_HEADER_Z = 10;
const FROZEN_HEADER_Z_BASE = 40;
const FROZEN_BODY_Z_BASE = 10;

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
  freezeColumnsAuto?: boolean;
};

export function useFrozenListColumns({
  columnCount,
  frozenColumnCount,
  freezeColumnsAuto = true,
}: Options) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const headerRefs = useRef<(HTMLTableCellElement | null)[]>([]);
  const [stickyOffsets, setStickyOffsets] = useState<number[]>([]);
  const [hasHorizontalScroll, setHasHorizontalScroll] = useState(false);

  const effectiveFrozenCount = useMemo(() => {
    const requested = Math.min(frozenColumnCount, columnCount) as ListFrozenColumnCount;
    if (freezeColumnsAuto && !hasHorizontalScroll) return 0 as ListFrozenColumnCount;
    return requested;
  }, [columnCount, freezeColumnsAuto, frozenColumnCount, hasHorizontalScroll]);

  useLayoutEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const measureScroll = () => {
      setHasHorizontalScroll(container.scrollWidth > container.clientWidth + 1);
    };

    measureScroll();
    const observer = new ResizeObserver(measureScroll);
    observer.observe(container);
    const table = container.querySelector("table");
    if (table) observer.observe(table);

    return () => observer.disconnect();
  }, [columnCount]);

  useLayoutEffect(() => {
    if (effectiveFrozenCount === 0) {
      setStickyOffsets([]);
      return;
    }

    let left = 0;
    const offsets: number[] = [];
    for (let index = 0; index < effectiveFrozenCount; index += 1) {
      offsets.push(left);
      left += headerRefs.current[index]?.offsetWidth ?? 0;
    }
    setStickyOffsets(offsets);
  }, [columnCount, effectiveFrozenCount]);

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
      "bg-muted/40",
      isFrozen && FROZEN_CELL_BG,
      isFrozen && isLastFrozenColumn && FROZEN_EDGE_SHADOW
    );
  };

  const bodyCellClass = (index: number, selected: boolean) => {
    const isFrozen = effectiveFrozenCount > 0 && index < effectiveFrozenCount;
    const isLastFrozenColumn = effectiveFrozenCount > 0 && index === effectiveFrozenCount - 1;
    return cn(
      rowEdgeClass(isFrozen && isLastFrozenColumn),
      isFrozen &&
        (selected
          ? cn(FROZEN_CELL_SELECTED, FROZEN_CELL_SELECTED_HOVER)
          : cn(FROZEN_CELL_BG, FROZEN_CELL_HOVER))
    );
  };

  return {
    scrollContainerRef,
    headerRefs,
    effectiveFrozenCount,
    getStickyCellProps,
    headerCellClass,
    bodyCellClass,
  };
}

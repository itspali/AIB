"use client";

import {
  createContext,
  useContext,
  useMemo,
  type CSSProperties,
  type ReactNode,
} from "react";
import { useRightDrawerLayout } from "@/components/ui/right-drawer";
import {
  drawerFormFieldSpanClass,
  drawerFormGridStyle,
  estimateDrawerContentWidthPx,
  resolveDrawerFormColumnCount,
  type DrawerFormColumnCount,
} from "@/lib/layout/drawer-form-layout";
import { useElementWidth } from "@/lib/layout/use-element-width";
import { cn } from "@/lib/utils";

type DrawerFormLayoutContextValue = {
  columnCount: DrawerFormColumnCount;
};

const DrawerFormLayoutContext = createContext<DrawerFormLayoutContextValue | null>(null);

export function useDrawerFormLayoutContext() {
  return useContext(DrawerFormLayoutContext);
}

export function useDrawerFormFieldSpan(span: "full" | 1 | 2 = 1) {
  const layout = useDrawerFormLayoutContext();
  return drawerFormFieldSpanClass(layout?.columnCount ?? 1, span);
}

type DrawerFormGridProps = {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
};

/** Responsive field grid sized to the active drawer content width. */
export function DrawerFormGrid({ children, className, style }: DrawerFormGridProps) {
  const { ref, width } = useElementWidth<HTMLDivElement>();
  const drawerLayout = useRightDrawerLayout();

  const columnCount = useMemo(() => {
    if (width != null) {
      return resolveDrawerFormColumnCount(width);
    }
    return resolveDrawerFormColumnCount(estimateDrawerContentWidthPx(drawerLayout));
  }, [drawerLayout, width]);

  const value = useMemo(() => ({ columnCount }), [columnCount]);

  return (
    <DrawerFormLayoutContext.Provider value={value}>
      <div
        ref={ref}
        className={cn("grid gap-4", className)}
        style={{ ...drawerFormGridStyle(columnCount), ...style }}
      >
        {children}
      </div>
    </DrawerFormLayoutContext.Provider>
  );
}

type DrawerFormFieldProps = {
  children: ReactNode;
  span?: "full" | 1 | 2;
  className?: string;
};

/** Single labeled field cell inside a `DrawerFormGrid`. */
export function DrawerFormField({ children, span = 1, className }: DrawerFormFieldProps) {
  const layout = useDrawerFormLayoutContext();
  const columnCount = layout?.columnCount ?? 1;

  return (
    <div
      className={cn(
        "space-y-1.5",
        drawerFormFieldSpanClass(columnCount, span),
        className
      )}
    >
      {children}
    </div>
  );
}

"use client";

import type { ReactNode } from "react";
import {
  LIST_MODULE_PAGE_CHROME,
  LIST_MODULE_VIEWPORT_FALLBACK_HEIGHT,
  LIST_MODULE_VIEWPORT_OFFSET,
} from "@/lib/layout/list-module-chrome";
import { useListModuleScrollLock } from "@/lib/layout/use-list-module-scroll-lock";
import { useAvailablePaneHeight } from "@/lib/layout/use-viewport-remaining-height";
import { cn } from "@/lib/utils";

type Props = {
  title: ReactNode;
  toolbar?: ReactNode;
  bulkToolbar?: ReactNode;
  children: ReactNode;
  /** When false, dashboard page scroll is not locked (e.g. loading skeleton). */
  scrollLock?: boolean;
  /** When false, viewport height is not measured (e.g. loading skeleton). */
  measureViewport?: boolean;
  className?: string;
  "aria-label"?: string;
  "aria-busy"?: boolean;
};

export function ListModuleShell({
  title,
  toolbar,
  bulkToolbar,
  children,
  scrollLock = true,
  measureViewport = true,
  className,
  "aria-label": ariaLabel,
  "aria-busy": ariaBusy,
}: Props) {
  const { ref: viewportRef, height: viewportHeight } = useAvailablePaneHeight(
    measureViewport,
    "remaining-viewport"
  );
  useListModuleScrollLock(scrollLock && measureViewport);

  return (
    <div
      ref={viewportRef}
      style={
        viewportHeight != null
          ? { height: viewportHeight, maxHeight: viewportHeight }
          : undefined
      }
      className={cn(
        "flex min-h-0 flex-col overflow-hidden",
        viewportHeight == null && measureViewport && LIST_MODULE_VIEWPORT_FALLBACK_HEIGHT,
        LIST_MODULE_VIEWPORT_OFFSET,
        className
      )}
      aria-label={ariaLabel}
      aria-busy={ariaBusy}
    >
      <div className="flex h-full min-h-0 flex-1 basis-0 flex-col overflow-hidden">
        <div className={LIST_MODULE_PAGE_CHROME}>
          <div className="space-y-2.5">
            {title}
            {toolbar}
          </div>
          {bulkToolbar ? <div className="mt-2.5">{bulkToolbar}</div> : null}
        </div>
        <div className="flex min-h-0 flex-1 basis-0 flex-col overflow-hidden pb-1">
          {children}
        </div>
      </div>
    </div>
  );
}

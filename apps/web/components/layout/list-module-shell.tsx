"use client";

import type { ReactNode } from "react";
import {
  LIST_MODULE_PAGE_CHROME,
  LIST_MODULE_VIEWPORT_FALLBACK_HEIGHT,
  LIST_MODULE_VIEWPORT_OFFSET,
  LIST_WORKSPACE_GLASS_V2_ROOT,
} from "@/lib/layout/list-module-chrome";
import { useListModuleScrollLock } from "@/lib/layout/use-list-module-scroll-lock";
import { useOptionalListWorkspace } from "@/lib/layout/list-workspace";
import { useAvailablePaneHeight } from "@/lib/layout/use-viewport-remaining-height";
import { cn } from "@/lib/utils";

export type ListModuleShellSurface = "classic" | "glass-v2";

type Props = {
  title: ReactNode;
  toolbar?: ReactNode;
  bulkToolbar?: ReactNode;
  children: ReactNode;
  /** Glass V2 list workspace chrome (default glass-v2; frozen Items/Categories pass classic). */
  surface?: ListModuleShellSurface;
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
  surface = "glass-v2",
  scrollLock = true,
  measureViewport = true,
  className,
  "aria-label": ariaLabel,
  "aria-busy": ariaBusy,
}: Props) {
  const workspace = useOptionalListWorkspace();
  const workspaceLayout = workspace?.layout;
  const { ref: viewportRef, height: viewportHeight } = useAvailablePaneHeight(
    measureViewport,
    "remaining-viewport"
  );
  useListModuleScrollLock(scrollLock && measureViewport);

  return (
    <div
      ref={viewportRef}
      data-list-workspace-layout={
        workspaceLayout ?? (surface === "glass-v2" ? "matrix" : undefined)
      }
      style={
        viewportHeight != null
          ? { height: viewportHeight, maxHeight: viewportHeight }
          : undefined
      }
      className={cn(
        "flex min-h-0 flex-col overflow-hidden",
        viewportHeight == null && measureViewport && LIST_MODULE_VIEWPORT_FALLBACK_HEIGHT,
        LIST_MODULE_VIEWPORT_OFFSET,
        surface === "glass-v2" && LIST_WORKSPACE_GLASS_V2_ROOT,
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
          <div
            aria-hidden={!bulkToolbar}
            className={cn(
              "grid transition-[grid-template-rows,opacity,margin] duration-300 ease-[cubic-bezier(0.25,1,0.5,1)]",
              bulkToolbar
                ? "mt-2.5 grid-rows-[1fr] opacity-100"
                : "mt-0 grid-rows-[0fr] opacity-0 pointer-events-none"
            )}
          >
            <div className="min-h-0 overflow-hidden">{bulkToolbar}</div>
          </div>
        </div>
        <div
          className={cn(
            "flex min-h-0 flex-1 basis-0 flex-col",
            surface === "glass-v2"
              ? "revamp-catalog-body overflow-hidden"
              : "overflow-hidden pb-1"
          )}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

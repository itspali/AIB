"use client";

import type { ReactNode } from "react";
import { useViewportMatches } from "@/lib/layout/use-viewport-matches";
import { cn } from "@/lib/utils";

const SPATIAL_DESKTOP_MEDIA = "(min-width: 901px)";

type Props = {
  listPane: ReactNode;
  detailPane: ReactNode;
  detailOpen: boolean;
  mobileDetailOpen: boolean;
  className?: string;
};

export function ListWorkspaceSplitLayout({
  listPane,
  detailPane,
  detailOpen,
  mobileDetailOpen,
  className,
}: Props) {
  const isDesktop = useViewportMatches(SPATIAL_DESKTOP_MEDIA);
  const showMobileDetail = !isDesktop && mobileDetailOpen && detailOpen;

  return (
    <div className={cn("list-workspace-split-container", className)}>
      <aside
        className={cn(
          "list-workspace-split-list-pane",
          showMobileDetail && "list-workspace-split-list-pane--hidden-mobile"
        )}
      >
        {listPane}
      </aside>
      <div
        className={cn(
          "list-workspace-split-detail-pane",
          showMobileDetail && "list-workspace-split-detail-pane--mobile-open"
        )}
      >
        {detailPane}
      </div>
    </div>
  );
}

export function useListWorkspaceSplitDesktop(): boolean {
  return useViewportMatches(SPATIAL_DESKTOP_MEDIA);
}

"use client";

import { useState, type ReactNode } from "react";
import { FileText, History } from "lucide-react";
import { DocumentActivityTimelinePanel } from "@/components/activity/document-activity-timeline-panel";
import { Button } from "@/components/ui/button";
import { useRightDrawerLayout } from "@/components/ui/right-drawer";
import { useDeviceClass } from "@/hooks/use-device-class";
import { resolveDocumentPeekActivityLayoutMode } from "@/lib/activity/document-peek-activity-layout";
import type { ActivityEntityType } from "@/lib/activity/types";
import { cn } from "@/lib/utils";

export type DocumentPeekPane = "document" | "activity";

type Props = {
  entityType: ActivityEntityType;
  entityId: string;
  refreshKey?: number | string;
  children: ReactNode;
  className?: string;
};

function PeekIconRail({
  activePane,
  onSelect,
  className,
}: {
  activePane: DocumentPeekPane;
  onSelect: (pane: DocumentPeekPane) => void;
  className?: string;
}) {
  return (
    <nav
      className={cn(
        "flex shrink-0 flex-col gap-1 border-r border-border pr-2",
        className
      )}
      aria-label="Document peek views"
    >
      <Button
        type="button"
        variant={activePane === "document" ? "secondary" : "ghost"}
        size="sm"
        className="h-9 w-9 px-0"
        aria-pressed={activePane === "document"}
        aria-label="Document details"
        title="Document details"
        onClick={() => onSelect("document")}
      >
        <FileText className="size-4" aria-hidden />
      </Button>
      <Button
        type="button"
        variant={activePane === "activity" ? "secondary" : "ghost"}
        size="sm"
        className="h-9 w-9 px-0"
        aria-pressed={activePane === "activity"}
        aria-label="Activity history"
        title="Activity history"
        onClick={() => onSelect("activity")}
      >
        <History className="size-4" aria-hidden />
      </Button>
    </nav>
  );
}

export function DocumentPeekActivityShell({
  entityType,
  entityId,
  refreshKey,
  children,
  className,
}: Props) {
  const drawerLayout = useRightDrawerLayout();
  const { isMobile } = useDeviceClass();
  const layoutMode = resolveDocumentPeekActivityLayoutMode(drawerLayout, isMobile);
  const [activePane, setActivePane] = useState<DocumentPeekPane>("document");

  const timeline = (
    <DocumentActivityTimelinePanel
      entityType={entityType}
      entityId={entityId}
      refreshKey={refreshKey}
      presentation={layoutMode === "stack" ? "collapsible" : "pane"}
      active={layoutMode === "split" || activePane === "activity"}
    />
  );

  if (layoutMode === "stack") {
    return (
      <div className={cn("space-y-4", className)}>
        {children}
        {timeline}
      </div>
    );
  }

  if (layoutMode === "split") {
    return (
      <div
        className={cn(
          "flex min-h-0 flex-1 flex-col gap-4 lg:flex-row lg:items-stretch lg:gap-0",
          className
        )}
      >
        <div className="min-h-0 min-w-0 flex-1 overflow-auto lg:pr-4">{children}</div>
        <div className="min-h-0 w-full shrink-0 overflow-auto border-border lg:w-[min(22rem,34%)] lg:border-l lg:pl-4">
          {timeline}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex min-h-0 flex-1 gap-3", className)}>
      <PeekIconRail activePane={activePane} onSelect={setActivePane} />
      <div className="min-h-0 min-w-0 flex-1 overflow-auto">
        {activePane === "document" ? (
          children
        ) : (
          <DocumentActivityTimelinePanel
            entityType={entityType}
            entityId={entityId}
            refreshKey={refreshKey}
            presentation="pane"
            active
          />
        )}
      </div>
    </div>
  );
}

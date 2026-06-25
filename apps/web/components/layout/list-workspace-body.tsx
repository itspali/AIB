"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ListWorkspaceMatrixLayout } from "@/components/layout/list-workspace-matrix-layout";
import { ListWorkspaceMatrixRegistry } from "@/components/layout/list-workspace-matrix-registry";
import { ListWorkspaceSplitDetailPane } from "@/components/layout/list-workspace-split-detail-pane";
import {
  ListWorkspaceSplitLayout,
  useListWorkspaceSplitDesktop,
} from "@/components/layout/list-workspace-split-layout";
import { useListWorkspace } from "@/lib/layout/list-workspace";
import { cn } from "@/lib/utils";

type Props = {
  listContent: ReactNode;
  /** Items-master compact feed for split layout (defaults to `listContent`). */
  splitListContent?: ReactNode;
  footer?: ReactNode;
  matrixPeek?: ReactNode;
  peekOpen?: boolean;
  splitEmptyTitle?: string;
  splitEmptyMessage?: string;
  listPaneClassName?: string;
  onMobileDetailOpenChange?: (open: boolean) => void;
};

export function ListWorkspaceBody({
  listContent,
  splitListContent,
  footer,
  matrixPeek,
  peekOpen = false,
  splitEmptyTitle,
  splitEmptyMessage,
  listPaneClassName,
  onMobileDetailOpenChange,
}: Props) {
  const { layout } = useListWorkspace();
  const isSplitDesktop = useListWorkspaceSplitDesktop();
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);

  useEffect(() => {
    if (peekOpen && layout === "split" && !isSplitDesktop) {
      setMobileDetailOpen(true);
    }
  }, [isSplitDesktop, layout, peekOpen]);

  useEffect(() => {
    onMobileDetailOpenChange?.(mobileDetailOpen);
  }, [mobileDetailOpen, onMobileDetailOpenChange]);

  const splitPaneContent = splitListContent ?? listContent;

  const listPane = (
    <div
      className={cn("flex min-h-0 flex-1 flex-col overflow-hidden", listPaneClassName)}
    >
      <div className="flex min-h-0 flex-1 basis-0 flex-col">{splitPaneContent}</div>
      {footer}
    </div>
  );

  if (layout === "split") {
    return (
      <ListWorkspaceSplitLayout
        detailOpen={peekOpen}
        mobileDetailOpen={mobileDetailOpen}
        listPane={listPane}
        detailPane={
          <ListWorkspaceSplitDetailPane
            peekOpen={peekOpen}
            emptyTitle={splitEmptyTitle}
            emptyMessage={splitEmptyMessage}
          />
        }
      />
    );
  }

  return (
    <>
      <ListWorkspaceMatrixLayout footer={footer}>
        <ListWorkspaceMatrixRegistry>{listContent}</ListWorkspaceMatrixRegistry>
      </ListWorkspaceMatrixLayout>
      {matrixPeek}
    </>
  );
}

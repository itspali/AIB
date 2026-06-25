"use client";

import { ListWorkspaceDetailCanvas } from "@/components/layout/list-workspace-detail-canvas";
import { useListWorkspaceSplitDetailHost } from "@/lib/layout/list-workspace-split-detail-context";
import { cn } from "@/lib/utils";

type Props = {
  peekOpen: boolean;
  emptyTitle?: string;
  emptyMessage?: string;
  className?: string;
};

/** Split-layout detail column — hosts inline peek panels via portal target ref. */
export function ListWorkspaceSplitDetailPane({
  peekOpen,
  emptyTitle,
  emptyMessage,
  className,
}: Props) {
  const splitDetail = useListWorkspaceSplitDetailHost();
  const hostRef = splitDetail?.hostRef;

  return (
    <div className={cn("list-workspace-split-detail-host relative flex min-h-0 flex-1 flex-col", className)}>
      {!peekOpen ? (
        <ListWorkspaceDetailCanvas emptyTitle={emptyTitle} emptyMessage={emptyMessage} />
      ) : null}
      <div
        ref={hostRef}
        className={cn(
          "flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden",
          !peekOpen && "hidden"
        )}
      />
    </div>
  );
}

"use client";

import type { ReactNode } from "react";
import { ListWorkspaceBody } from "@/components/layout/list-workspace-body";
import { LIST_WORKSPACE_GLASS_V2_ROOT } from "@/lib/layout/list-module-chrome";
import { ListWorkspaceSplitDetailProvider } from "@/lib/layout/list-workspace-split-detail-context";
import { useListWorkspace, useOptionalListWorkspace } from "@/lib/layout/list-workspace";
import { cn } from "@/lib/utils";

type CatalogBodyProps = {
  listContent: ReactNode;
  splitListContent?: ReactNode;
  footer?: ReactNode;
  peekOpen?: boolean;
  splitEmptyTitle?: string;
  splitEmptyMessage?: string;
  listPaneClassName?: string;
};

export function useListWorkspaceCatalogLayout() {
  const { layout } = useListWorkspace();
  return { layout };
}

export { ListWorkspaceMatrixRegistry } from "@/components/layout/list-workspace-matrix-registry";

export function ListWorkspaceCatalogBody(props: CatalogBodyProps) {
  return <ListWorkspaceBody {...props} />;
}

type ModuleFrameProps = {
  peekOpen: boolean;
  children: ReactNode;
};

export function ListWorkspaceModuleFrame({ peekOpen, children }: ModuleFrameProps) {
  const workspace = useOptionalListWorkspace();

  return (
    <ListWorkspaceSplitDetailProvider peekOpen={peekOpen}>
      <div
        data-list-workspace-layout={workspace?.layout}
        data-ui-header-chrome="unified"
        className={cn("flex min-h-0 flex-1 flex-col", LIST_WORKSPACE_GLASS_V2_ROOT)}
      >
        {children}
      </div>
    </ListWorkspaceSplitDetailProvider>
  );
}

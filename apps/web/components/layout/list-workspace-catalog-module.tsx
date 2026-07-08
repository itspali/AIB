"use client";

import type { ReactNode } from "react";
import { ListWorkspaceBody } from "@/components/layout/list-workspace-body";
import { ListWorkspaceSplitDetailProvider } from "@/lib/layout/list-workspace-split-detail-context";
import { useListWorkspace } from "@/lib/layout/list-workspace";

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
  return (
    <ListWorkspaceSplitDetailProvider peekOpen={peekOpen}>{children}</ListWorkspaceSplitDetailProvider>
  );
}

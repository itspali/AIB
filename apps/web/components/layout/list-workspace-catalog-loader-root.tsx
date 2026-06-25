"use client";

import type { ReactNode } from "react";
import { ListWorkspaceProvider } from "@/lib/layout/list-workspace";

type Props = {
  moduleId: string;
  children: ReactNode;
};

export function ListWorkspaceCatalogLoaderRoot({ moduleId, children }: Props) {
  return <ListWorkspaceProvider moduleId={moduleId}>{children}</ListWorkspaceProvider>;
}

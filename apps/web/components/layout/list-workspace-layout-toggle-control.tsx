"use client";

import { useListWorkspace } from "@/lib/layout/list-workspace";
import { ListWorkspaceLayoutToggle } from "@/components/layout/list-workspace-layout-toggle";

/** Toolbar layout toggle wired to list workspace context. */
export function ListWorkspaceLayoutToggleControl() {
  const { layout, setLayout } = useListWorkspace();
  return <ListWorkspaceLayoutToggle layout={layout} onLayoutChange={setLayout} />;
}

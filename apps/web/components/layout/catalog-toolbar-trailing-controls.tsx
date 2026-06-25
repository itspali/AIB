"use client";

import type { ReactNode } from "react";
import { ListWorkspaceLayoutToggleControl } from "@/components/layout/list-workspace-layout-toggle-control";

type Props = {
  columnSettings: ReactNode;
};

/** Trailing toolbar segment — split/matrix toggle then column settings (Items order). */
export function CatalogToolbarTrailingControls({ columnSettings }: Props) {
  return (
    <>
      <ListWorkspaceLayoutToggleControl />
      {columnSettings}
    </>
  );
}

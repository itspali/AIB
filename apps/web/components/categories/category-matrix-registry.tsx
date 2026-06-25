"use client";

import { ListWorkspaceMatrixRegistry } from "@/components/layout/list-workspace-matrix-registry";
import type { ComponentProps } from "react";

type Props = ComponentProps<typeof ListWorkspaceMatrixRegistry>;

/** Re-export of Items-master matrix registry shell. */
export function CategoryMatrixRegistry(props: Props) {
  return <ListWorkspaceMatrixRegistry {...props} />;
}

"use client";

import { ListWorkspaceMatrixRegistry } from "@/components/layout/list-workspace-matrix-registry";
import type { ComponentProps } from "react";

type Props = ComponentProps<typeof ListWorkspaceMatrixRegistry>;

/** @deprecated Use `ListWorkspaceMatrixRegistry` — re-export preserves Items API. */
export function ItemsMatrixRegistry(props: Props) {
  return <ListWorkspaceMatrixRegistry {...props} />;
}

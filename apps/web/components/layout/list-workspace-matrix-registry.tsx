"use client";

import type { ReactNode } from "react";
import {
  LIST_WORKSPACE_MATRIX_REGISTRY_BODY,
  LIST_WORKSPACE_MATRIX_REGISTRY_CARD,
} from "@/lib/layout/list-module-chrome";
import { cn } from "@/lib/utils";

type Props = {
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
};

/**
 * Items-master matrix registry shell — frosted glass card + scroll body.
 * Used by all list modules in matrix layout for visual parity with `/items`.
 */
export function ListWorkspaceMatrixRegistry({ children, className, bodyClassName }: Props) {
  return (
    <div className={cn(LIST_WORKSPACE_MATRIX_REGISTRY_CARD, className)}>
      <div className={cn(LIST_WORKSPACE_MATRIX_REGISTRY_BODY, bodyClassName)}>{children}</div>
    </div>
  );
}

"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Props = {
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
};

/** Full-width registry table surface for matrix workspace layout (Items master spacing). */
export function ListWorkspaceMatrixLayout({ children, footer, className }: Props) {
  return (
    <div
      className={cn(
        "list-workspace-matrix-layout flex min-h-0 flex-1 flex-col overflow-hidden",
        className
      )}
    >
      <div className="flex min-h-0 flex-1 basis-0 flex-col">{children}</div>
      {footer ? <div className="list-workspace-matrix-footer shrink-0">{footer}</div> : null}
    </div>
  );
}

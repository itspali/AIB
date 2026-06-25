import { Skeleton } from "@/components/ui/skeleton";
import {
  LIST_MODULE_PAGE_CHROME,
  LIST_MODULE_VIEWPORT_OFFSET,
  LIST_WORKSPACE_GLASS_V2_ROOT,
} from "@/lib/layout/list-module-chrome";
import { cn } from "@/lib/utils";

import type { EntityWorkspace } from "@/lib/entities/types";
import { getEntityWorkspaceConfig } from "@/lib/entities/workspace-config";

type Props = {
  workspace?: EntityWorkspace;
  title?: string;
};

export function EntityCatalogPageSkeleton({ workspace, title }: Props) {
  const resolvedTitle =
    title ??
    (workspace ? `${getEntityWorkspaceConfig(workspace).title} loading` : "Loading entities");
  return (
    <div
      className={cn("flex min-h-0 flex-col overflow-hidden", LIST_MODULE_VIEWPORT_OFFSET, LIST_WORKSPACE_GLASS_V2_ROOT)}
      aria-busy="true"
      aria-label={resolvedTitle}
    >
      <div className={LIST_MODULE_PAGE_CHROME}>
        <div className="space-y-2.5">
          <div className="flex items-center justify-between gap-2.5">
            <Skeleton className="h-7 w-32 shimmer" />
            <Skeleton className="h-8 w-24 shrink-0 rounded-md shimmer" />
          </div>
          <Skeleton className="h-7 w-full max-w-md shimmer" />
        </div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-1">
        <Skeleton className="h-full min-h-[240px] shimmer" />
      </div>
    </div>
  );
}

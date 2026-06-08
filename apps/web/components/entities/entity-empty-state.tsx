import { Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getEntityWorkspaceConfig } from "@/lib/entities/workspace-config";
import type { EntityWorkspace } from "@/lib/entities/types";

type Props = {
  workspace: EntityWorkspace;
  onCreate?: () => void;
  hasExistingEntities?: boolean;
};

export function EntityEmptyState({
  workspace,
  onCreate,
  hasExistingEntities = false,
}: Props) {
  const config = getEntityWorkspaceConfig(workspace);
  const label = hasExistingEntities ? config.createLabel : config.createLabel;

  return (
    <div className="flex min-h-[360px] flex-col items-center justify-center rounded-xl border border-dashed border-border/80 border-black/[0.06] bg-muted/35 px-6 py-12 text-center dark:border-white/10 dark:bg-muted/20">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-primary/20">
        <Users className="h-8 w-8 text-primary" aria-hidden />
      </div>
      <p className="max-w-md text-sm font-medium">{config.emptyStateTitle}</p>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        {config.emptyStateDescription}
      </p>
      {onCreate ? (
        <Button className="mt-6 shadow-glow-sm" onClick={onCreate}>
          {label}
        </Button>
      ) : null}
    </div>
  );
}

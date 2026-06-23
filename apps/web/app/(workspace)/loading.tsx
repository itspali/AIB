import { ModuleWorkspaceSkeleton } from "@/components/layout/module-workspace-skeleton";

/** Instant feedback while the workspace page segment streams in (shell layout stays mounted). */
export default function WorkspaceLoading() {
  return <ModuleWorkspaceSkeleton titleWidth="w-36" />;
}

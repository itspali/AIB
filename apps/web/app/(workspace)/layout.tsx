import { ModuleDashboardShell } from "@/components/layout/module-dashboard-shell";

/** Shared workspace shell — one layout for all ERP modules so cross-module nav skips re-running getModulePageContext. */
export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  return <ModuleDashboardShell>{children}</ModuleDashboardShell>;
}

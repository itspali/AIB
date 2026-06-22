import { ModuleDashboardShell } from "@/components/layout/module-dashboard-shell";

export default async function SalesLayout({ children }: { children: React.ReactNode }) {
  return <ModuleDashboardShell>{children}</ModuleDashboardShell>;
}

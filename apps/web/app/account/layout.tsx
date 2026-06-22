import { ModuleDashboardShell } from "@/components/layout/module-dashboard-shell";

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  return <ModuleDashboardShell>{children}</ModuleDashboardShell>;
}

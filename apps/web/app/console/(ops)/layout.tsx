import { ConsoleShell } from "@/components/console/console-shell";
import { requireConsoleAccess } from "@/lib/console/require-console";

export default async function ConsoleOpsLayout({ children }: { children: React.ReactNode }) {
  const { operator } = await requireConsoleAccess("VIEWER");

  return (
    <ConsoleShell operatorEmail={operator.email} operatorRole={operator.role}>
      {children}
    </ConsoleShell>
  );
}

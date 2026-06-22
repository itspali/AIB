import Link from "next/link";
import { ConsoleShell } from "@/components/console/console-shell";
import { ConsoleAccessError, requireConsoleAccess } from "@/lib/console/require-console";
import { isNextRedirectError } from "@/lib/console/redirect-error";
import { Button } from "@/components/ui/button";

type Props = {
  children: React.ReactNode;
};

function ConsoleSetupError({ message }: { message: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="surface-panel w-full max-w-lg space-y-4 p-6">
        <h1 className="text-xl font-semibold">App Console unavailable</h1>
        <p className="text-sm text-muted-foreground">{message}</p>
        <p className="text-sm text-muted-foreground">
          If this persists, verify the Supabase project is active and that Vercel has{" "}
          <code className="text-xs">SUPABASE_SERVICE_ROLE_KEY</code> from the same project as{" "}
          <code className="text-xs">NEXT_PUBLIC_SUPABASE_URL</code>.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href="/dashboard">Go to ERP</Link>
          </Button>
          <Button asChild variant="ghost">
            <Link href="/login">Sign in</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

export default async function ConsoleOpsLayout({ children }: Props) {
  try {
    const { operator } = await requireConsoleAccess("VIEWER");

    return (
      <ConsoleShell operatorEmail={operator.email} operatorRole={operator.role}>
        {children}
      </ConsoleShell>
    );
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    if (error instanceof ConsoleAccessError) {
      return <ConsoleSetupError message={error.message} />;
    }
    throw error;
  }
}

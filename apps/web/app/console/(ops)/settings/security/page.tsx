import Link from "next/link";
import { ConsoleMfaEnroll } from "@/components/console/console-mfa-enroll";
import { requireConsoleAccess } from "@/lib/console/require-console";

export default async function ConsoleSettingsSecurityPage() {
  await requireConsoleAccess("VIEWER");

  return (
    <div className="canvas-scroll-endpad space-y-5">
      <header>
        <p className="text-sm">
          <Link href="/console/settings" className="text-primary hover:underline">
            ← Settings
          </Link>
        </p>
        <h1 className="text-2xl font-bold tracking-tight">Security</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Enroll a TOTP authenticator app for console access (AAL2).
        </p>
      </header>

      <ConsoleMfaEnroll />
    </div>
  );
}

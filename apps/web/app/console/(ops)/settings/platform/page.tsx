import Link from "next/link";
import {
  ConsolePlatformConfig,
  type PlatformConfigState,
} from "@/components/console/console-platform-config";
import { requireConsoleAccess } from "@/lib/console/require-console";
import { getPlatformConfigValue } from "@/lib/console/platform-config";

function parseTrialExpiryAction(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "object" && value !== null) return String(value);
  return "SUSPEND";
}

export default async function ConsoleSettingsPlatformPage() {
  const { admin } = await requireConsoleAccess("ADMIN");

  const [signupEnabled, maintenanceMode, mfaRequired, trialExpiryAction] = await Promise.all([
    getPlatformConfigValue(admin, "signup_enabled", true),
    getPlatformConfigValue(admin, "maintenance_mode", false),
    getPlatformConfigValue(admin, "console_mfa_required", true),
    getPlatformConfigValue(admin, "trial_expiry_action", "SUSPEND"),
  ]);

  const initial: PlatformConfigState = {
    signup_enabled: signupEnabled,
    maintenance_mode: maintenanceMode,
    console_mfa_required: mfaRequired,
    trial_expiry_action: parseTrialExpiryAction(trialExpiryAction),
  };

  return (
    <div className="canvas-scroll-endpad space-y-5">
      <header>
        <p className="text-sm">
          <Link href="/console/settings" className="text-primary hover:underline">
            ← Settings
          </Link>
        </p>
        <h1 className="text-2xl font-bold tracking-tight">Platform config</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Global feature flags stored in platform_config. Changes are audited.
        </p>
      </header>

      <ConsolePlatformConfig initial={initial} />
    </div>
  );
}

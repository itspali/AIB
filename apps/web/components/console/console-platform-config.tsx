"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updatePlatformConfig } from "@/lib/console/actions/platform-config";
import type { PlatformConfigKey } from "@/lib/console/platform-config";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type PlatformConfigState = {
  signup_enabled: boolean;
  maintenance_mode: boolean;
  console_mfa_required: boolean;
  trial_expiry_action: string;
};

type ConsolePlatformConfigProps = {
  initial: PlatformConfigState;
};

export function ConsolePlatformConfig({ initial }: ConsolePlatformConfigProps) {
  const router = useRouter();
  const [config, setConfig] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const update = (key: PlatformConfigKey, value: unknown) => {
    setError(null);
    startTransition(async () => {
      const result = await updatePlatformConfig(key, value);
      if ("error" in result && result.error) {
        setError(result.error);
        return;
      }
      setConfig((prev) => ({ ...prev, [key]: value as never }));
      router.refresh();
    });
  };

  return (
    <div className="surface-panel space-y-6 p-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <Label htmlFor="signup_enabled">Signup enabled</Label>
          <p className="text-xs text-muted-foreground">Allow new tenant registrations.</p>
        </div>
        <Switch
          id="signup_enabled"
          checked={config.signup_enabled}
          disabled={isPending}
          onCheckedChange={(checked) => update("signup_enabled", checked)}
        />
      </div>

      <div className="flex items-center justify-between gap-4">
        <div>
          <Label htmlFor="maintenance_mode">Maintenance mode</Label>
          <p className="text-xs text-muted-foreground">Block tenant app access during maintenance.</p>
        </div>
        <Switch
          id="maintenance_mode"
          checked={config.maintenance_mode}
          disabled={isPending}
          onCheckedChange={(checked) => update("maintenance_mode", checked)}
        />
      </div>

      <div className="flex items-center justify-between gap-4">
        <div>
          <Label htmlFor="console_mfa_required">Console MFA required</Label>
          <p className="text-xs text-muted-foreground">Require TOTP for all console sessions.</p>
        </div>
        <Switch
          id="console_mfa_required"
          checked={config.console_mfa_required}
          disabled={isPending}
          onCheckedChange={(checked) => update("console_mfa_required", checked)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="trial_expiry_action">Trial expiry action</Label>
        <Select
          value={config.trial_expiry_action}
          disabled={isPending}
          onValueChange={(value) => update("trial_expiry_action", value)}
        >
          <SelectTrigger id="trial_expiry_action" className="max-w-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="SUSPEND">Suspend tenant</SelectItem>
            <SelectItem value="DOWNGRADE">Downgrade plan</SelectItem>
            <SelectItem value="NOTIFY_ONLY">Notify only</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

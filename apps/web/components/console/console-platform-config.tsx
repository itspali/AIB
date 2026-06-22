"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updatePlatformConfig } from "@/lib/console/actions/platform-config";
import { purgeDueWorkspaceDeletions } from "@/lib/console/actions/workspace-deletion";
import type { PlatformConfigKey } from "@/lib/console/platform-config";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  workspace_deletion_grace_days: number;
};

type ConsolePlatformConfigProps = {
  initial: PlatformConfigState;
};

export function ConsolePlatformConfig({ initial }: ConsolePlatformConfigProps) {
  const router = useRouter();
  const [config, setConfig] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [purgeMessage, setPurgeMessage] = useState<string | null>(null);
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

  const handleGraceDaysBlur = () => {
    const days = Math.min(365, Math.max(1, Math.round(config.workspace_deletion_grace_days || 14)));
    if (days !== config.workspace_deletion_grace_days) {
      setConfig((prev) => ({ ...prev, workspace_deletion_grace_days: days }));
    }
    update("workspace_deletion_grace_days", days);
  };

  const handlePurgeDue = () => {
    setError(null);
    startTransition(async () => {
      const result = await purgeDueWorkspaceDeletions();
      if ("error" in result && result.error) {
        setError(result.error);
        return;
      }
      if ("purgedCount" in result) {
        setPurgeMessage(
          `Processed due deletions: ${result.purgedCount} purged, ${result.failedCount} failed.`,
        );
      }
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

      <div className="space-y-2 border-t border-border pt-6">
        <Label htmlFor="workspace_deletion_grace_days">Workspace deletion grace period (days)</Label>
        <p className="text-xs text-muted-foreground">
          Days a workspace stays read-only after an owner schedules deletion, before purge runs.
        </p>
        <Input
          id="workspace_deletion_grace_days"
          type="number"
          min={1}
          max={365}
          className="max-w-xs"
          value={config.workspace_deletion_grace_days}
          disabled={isPending}
          onChange={(event) =>
            setConfig((prev) => ({
              ...prev,
              workspace_deletion_grace_days: Number(event.target.value),
            }))
          }
          onBlur={handleGraceDaysBlur}
        />
      </div>

      <div className="space-y-2 border-t border-border pt-6">
        <Label>Due workspace deletions</Label>
        <p className="text-xs text-muted-foreground">
          Run purge for workspaces whose grace period has ended. Failed purges remain flagged for
          ops review.
        </p>
        <Button type="button" variant="outline" disabled={isPending} onClick={handlePurgeDue}>
          {isPending ? "Running…" : "Purge due workspaces"}
        </Button>
        {purgeMessage ? <p className="text-sm text-muted-foreground">{purgeMessage}</p> : null}
      </div>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

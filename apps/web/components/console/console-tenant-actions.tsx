"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { reactivateTenant, suspendTenant } from "@/lib/console/actions/tenant-lifecycle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { TenantAccountStatus } from "@/lib/console/types";

type ConsoleTenantActionsProps = {
  tenantId: string;
  status: TenantAccountStatus;
  isActive: boolean;
  canOperate: boolean;
};

export function ConsoleTenantActions({
  tenantId,
  status,
  isActive,
  canOperate,
}: ConsoleTenantActionsProps) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (!canOperate) {
    return (
      <p className="text-sm text-muted-foreground">
        Operator role required to suspend or reactivate tenants.
      </p>
    );
  }

  const suspended = status === "SUSPENDED" || !isActive;

  const handleSuspend = (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    startTransition(async () => {
      const result = await suspendTenant(tenantId, reason);
      if ("error" in result && result.error) {
        setError(result.error);
        return;
      }
      setReason("");
      router.refresh();
    });
  };

  const handleReactivate = () => {
    setError(null);
    startTransition(async () => {
      const result = await reactivateTenant(tenantId);
      if ("error" in result && result.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  };

  return (
    <div className="space-y-4">
      {suspended ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            This tenant is suspended. Reactivate to restore access.
          </p>
          <Button type="button" disabled={isPending} onClick={handleReactivate}>
            {isPending ? "Reactivating…" : "Reactivate tenant"}
          </Button>
        </div>
      ) : (
        <form className="space-y-3" onSubmit={handleSuspend}>
          <div className="space-y-2">
            <Label htmlFor="suspend_reason">Suspension reason</Label>
            <Input
              id="suspend_reason"
              value={reason}
              disabled={isPending}
              placeholder="Required — logged in audit trail"
              onChange={(event) => setReason(event.target.value)}
            />
          </div>
          <Button type="submit" variant="destructive" disabled={isPending || !reason.trim()}>
            {isPending ? "Suspending…" : "Suspend tenant"}
          </Button>
        </form>
      )}

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

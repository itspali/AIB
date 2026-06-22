"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { startImpersonation } from "@/lib/console/actions/impersonation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = {
  tenantId: string;
  tenantName: string;
  canImpersonate: boolean;
  canWrite: boolean;
};

export function ConsoleImpersonationPanel({
  tenantId,
  tenantName,
  canImpersonate,
  canWrite,
}: Props) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (!canImpersonate) {
    return (
      <p className="text-sm text-muted-foreground">
        Operator role required to impersonate tenant workspaces.
      </p>
    );
  }

  const handleStart = (mode: "READ_ONLY" | "WRITE") => {
    setError(null);
    startTransition(async () => {
      const result = await startImpersonation({ tenantId, reason, mode });
      if ("error" in result && result.error) {
        setError(result.error);
        return;
      }
      if ("redirectTo" in result && result.redirectTo) {
        router.push(result.redirectTo);
        router.refresh();
      }
    });
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Open <span className="font-medium text-foreground">{tenantName}</span> in the tenant ERP as
        this operator. Read-only is the default; write mode requires admin role.
      </p>
      <div className="space-y-2">
        <Label htmlFor="impersonation_reason">Reason (required)</Label>
        <Input
          id="impersonation_reason"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Support ticket, billing investigation…"
          disabled={isPending}
        />
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          disabled={isPending || !reason.trim()}
          onClick={() => handleStart("READ_ONLY")}
        >
          {isPending ? "Starting…" : "View as tenant (read-only)"}
        </Button>
        {canWrite ? (
          <Button
            type="button"
            variant="secondary"
            disabled={isPending || !reason.trim()}
            onClick={() => handleStart("WRITE")}
          >
            View with write access
          </Button>
        ) : null}
      </div>
    </div>
  );
}

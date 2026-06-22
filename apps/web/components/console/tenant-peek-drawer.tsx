"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { PipelineStageBadge } from "@/components/console/pipeline-stage-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RightDrawer } from "@/components/ui/right-drawer";
import type { PipelineStage, TenantAccountStatus } from "@/lib/console/types";
import { cn } from "@/lib/utils";

export type TenantPeekData = {
  tenantId: string;
  orgCode: string;
  companyName: string;
  primaryEmail?: string | null;
  accountStatus?: TenantAccountStatus | null;
  pipelineStage?: PipelineStage | null;
  planName?: string | null;
  trialEndsAt?: string | null;
  memberCount?: number | null;
  detailHref: string;
};

type TenantPeekDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenant: TenantPeekData | null;
  className?: string;
};

function accountStatusVariant(status: TenantAccountStatus | null | undefined) {
  switch (status) {
    case "ACTIVE":
      return "completed" as const;
    case "TRIAL":
      return "action_required" as const;
    case "PAST_DUE":
      return "action_required" as const;
    case "SUSPENDED":
      return "administrative" as const;
    default:
      return "locked" as const;
  }
}

function PeekField({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="text-sm">{value}</div>
    </div>
  );
}

export function TenantPeekDrawer({ open, onOpenChange, tenant, className }: TenantPeekDrawerProps) {
  if (!tenant) {
    return (
      <RightDrawer
        open={open}
        onOpenChange={onOpenChange}
        title="Tenant"
        description="Select a tenant row to preview details."
        className={className}
      >
        <p className="text-sm text-muted-foreground">No tenant selected.</p>
      </RightDrawer>
    );
  }

  return (
    <RightDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={tenant.companyName}
      description={tenant.orgCode}
      className={className}
      footer={
        <div className="flex justify-end gap-2 border-t border-border px-4 py-3">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button asChild>
            <Link href={tenant.detailHref}>
              Open full record
              <ExternalLink className="ml-2 h-4 w-4" aria-hidden />
            </Link>
          </Button>
        </div>
      }
    >
      <div className={cn("space-y-5 p-1")}>
        <div className="flex flex-wrap gap-2">
          {tenant.accountStatus ? (
            <Badge variant={accountStatusVariant(tenant.accountStatus)}>{tenant.accountStatus}</Badge>
          ) : null}
          {tenant.pipelineStage ? <PipelineStageBadge stage={tenant.pipelineStage} /> : null}
        </div>

        <PeekField label="Organization code" value={<span className="font-mono">{tenant.orgCode}</span>} />
        {tenant.primaryEmail ? <PeekField label="Primary email" value={tenant.primaryEmail} /> : null}
        {tenant.planName ? <PeekField label="Plan" value={tenant.planName} /> : null}
        {tenant.trialEndsAt ? <PeekField label="Trial ends" value={tenant.trialEndsAt} /> : null}
        {tenant.memberCount != null ? (
          <PeekField label="Members" value={tenant.memberCount} />
        ) : null}
      </div>
    </RightDrawer>
  );
}

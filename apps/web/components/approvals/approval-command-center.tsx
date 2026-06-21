"use client";

import Link from "next/link";
import { ClipboardCheck } from "lucide-react";
import { HubPanel, HubSectionHeading } from "@/components/dashboard/hub-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ApprovalTaskRow, ApprovalDocumentType } from "@/lib/approvals/types";
import { formatDate } from "@/lib/dashboard/format";
import { formatMoneyDetail } from "@/lib/procurement/math";
import { poListReturnHref } from "@/lib/procurement/navigation";
import {
  invoiceListReturnHref,
  quoteListReturnHref,
  soListReturnHref,
} from "@/lib/sales/navigation";

export type ApprovalCommandCenterProps = {
  tasks: ApprovalTaskRow[];
};

function resolveDocumentHref(task: ApprovalTaskRow): string {
  switch (task.document_type as ApprovalDocumentType) {
    case "PURCHASE_ORDER":
      return poListReturnHref(task.document_id);
    case "SALES_ORDER":
      return soListReturnHref(task.document_id);
    case "SALES_QUOTATION":
      return quoteListReturnHref(task.document_id);
    case "SALES_INVOICE":
      return invoiceListReturnHref(task.document_id);
    default:
      return "/approvals";
  }
}

export function ApprovalTaskCard({ task }: { task: ApprovalTaskRow }) {
  return (
    <article className="rounded-xl border border-border bg-card p-4 shadow-sm transition-colors hover:border-primary/30">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium">{task.voucher_number ?? "Document"}</p>
            <Badge variant="administrative">{task.document_type.replaceAll("_", " ")}</Badge>
            <Badge variant="default">
              L{task.level_index + 1} · {task.quorum_mode}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">{task.party_name ?? "—"}</p>
          <p className="text-sm tabular-nums">
            {formatMoneyDetail(task.amount_basis, task.currency_code)}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button type="button" size="sm" variant="outline" asChild>
            <Link href={resolveDocumentHref(task)}>Review</Link>
          </Button>
        </div>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        {task.step_label} · submitted {formatDate(task.submitted_at)}
      </p>
    </article>
  );
}

export function ApprovalCommandCenter({ tasks }: ApprovalCommandCenterProps) {
  return (
    <div className="mx-auto w-full max-w-5xl">
      <div className="mb-6">
        <div className="flex items-center gap-2">
          <ClipboardCheck className="h-7 w-7 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight">Approvals</h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Documents waiting for your action on the current approval step.
        </p>
      </div>

      <HubSectionHeading
        step="!"
        title="My queue"
        description={
          tasks.length
            ? `${tasks.length} item(s) need your approval.`
            : "Nothing assigned to you right now."
        }
      />

      {tasks.length === 0 ? (
        <HubPanel accent="emerald" icon={ClipboardCheck} className="p-6">
          <p className="text-sm text-muted-foreground">All clear — no pending approval steps for you.</p>
        </HubPanel>
      ) : (
        <div className="space-y-3">
          {tasks.map((task) => (
            <ApprovalTaskCard key={`${task.run_id}-${task.step_id}`} task={task} />
          ))}
        </div>
      )}

      <p className="mt-6 text-xs text-muted-foreground">
        Configure bands, levels, and approver pools under{" "}
        <Link href="/settings/modules/procurement?tab=approvals" className="text-primary hover:underline">
          Procurement › Approvals
        </Link>{" "}
        or{" "}
        <Link href="/settings/modules/sales?tab=approvals" className="text-primary hover:underline">
          Sales › Approvals
        </Link>
        . Notification templates live under{" "}
        <Link href="/settings/notifications" className="text-primary hover:underline">
          Administration › Notification templates
        </Link>
        .
      </p>
    </div>
  );
}
